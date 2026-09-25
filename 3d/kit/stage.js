// The stage: renderer + scene + camera + loop, with the kit's defaults baked in
// (pixel-ratio cap, resize, pause when hidden/off-screen, adaptive quality,
// soft lights, sky, pointer parallax, tap picking, HTML pins, particles).
//
//   const stage = Kit.createStage({ fallback: "../../games/sing/" });
//   if (!stage) return;            // no WebGL: a friendly fallback is showing
//   stage.scene.add(mesh);
//   stage.onFrame((dt, t) => { … });
import * as THREE from "three";
import { Tweens, Spring, damp } from "./motion.js";
import { QualityGovernor, settingsFor, initialLevel } from "./quality.js";
import { frame as frameView, fitPoints } from "./view.js";
import { clampPin, isShown } from "./screen.js";
import { createSky } from "./sky.js";
import { timed } from "./materials.js";
import { Particles } from "./particles.js";
import * as ui from "./ui.js";
import { kt } from "./i18n.js";
import { I18N, AUDIO } from "./shared.js";

export const stages = [];
if (typeof window !== "undefined") window.__kitStages = stages; // for e2e tests / debugging

export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createStage({
  container = null, // element to fill; default: a full-viewport layer
  fallback = "../index.html", // 2D page to offer when 3D can't run
  sky = true, // true | false | { top, middle, bottom }
  fov = 40,
  camera = { position: [0, 3, 10], target: [0, 1, 0] },
  parallax = 0.5, // world units the camera drifts with pointer/tilt (0 = off)
  quality = "auto", // "auto" | 0 | 1 | 2
  shadows = true, // allow real shadows at high quality
  background = null, // colour when sky is false (null = transparent)
} = {}) {
  let host = container;
  if (!host) {
    host = document.createElement("div");
    document.body.prepend(host);
  }
  host.classList.add("kit-stage");
  if (container) host.classList.add("kit-inline");

  if (!hasWebGL()) {
    ui.fallback(null, fallback);
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: !sky,
      powerPreference: "high-performance",
    });
  } catch {
    ui.fallback(null, fallback);
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (!sky && background) renderer.setClearColor(background, 1);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const overlay = document.createElement("div");
  overlay.className = "kit-overlay";
  host.appendChild(overlay);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 400);
  const view = {
    position: new THREE.Vector3(...camera.position),
    target: new THREE.Vector3(...(camera.target || [0, 0, 0])),
  };

  // Lights: sky/ground bounce + a warm key light (casts shadows on "high").
  const hemi = new THREE.HemisphereLight("#eaf4ff", "#ffd9c2", 1.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#fff4e0", 2.3);
  key.position.set(-5, 10, 7);
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -10;
  key.shadow.camera.right = key.shadow.camera.top = 10;
  key.shadow.bias = -0.0008;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight("#d6c8ff", 0.7);
  fill.position.set(6, 3, -4);
  scene.add(fill);

  if (sky) createSky(scene, typeof sky === "object" ? sky : {});

  const reduced = reducedMotion();
  const particles = new Particles(scene);
  const tweens = new Tweens();
  const frameFns = [];
  const resizeFns = [];
  const pins = [];
  const hits = new Map(); // Object3D -> handlers
  let camMove = null; // running setView tween
  let width = 1;
  let height = 1;

  // ---- quality -----------------------------------------------------------
  const deviceDpr = window.devicePixelRatio || 1;
  const startLevel =
    quality === "auto"
      ? initialLevel({
          cores: navigator.hardwareConcurrency || 4,
          memory: navigator.deviceMemory || 4,
          coarse: matchMedia("(pointer: coarse)").matches,
          saveData: !!navigator.connection?.saveData,
          minSide: Math.min(screen.width, screen.height) * deviceDpr,
        })
      : quality;
  let settings = settingsFor(startLevel, deviceDpr);
  const applyQuality = (level) => {
    settings = settingsFor(level, deviceDpr);
    renderer.setPixelRatio(settings.dpr);
    renderer.setSize(width, height, false);
    const sh = shadows && settings.shadows;
    if (renderer.shadowMap.enabled !== sh) {
      renderer.shadowMap.enabled = sh;
      key.castShadow = sh;
      scene.traverse((o) => o.material && (o.material.needsUpdate = true));
    }
    particles.scale = settings.particles;
    document.documentElement.classList.toggle("kit-lowfx", !settings.blur);
  };
  const governor = new QualityGovernor({
    level: startLevel,
    onChange: applyQuality,
    onStruggle: () =>
      ui.toast(`${kt("slowTitle")} ${kt("slowBody")}`, {
        ms: 12000,
        action: { text: kt("tryClassic"), href: fallback },
      }),
  });
  if (quality !== "auto") governor.frame = () => {};

  // ---- size ----------------------------------------------------------------
  const resize = () => {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(settings.dpr);
    renderer.setSize(width, height, false);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    resizeFns.forEach((fn) => fn(width, height, cam.aspect));
  };
  new ResizeObserver(resize).observe(host);

  // ---- pointer, parallax, picking -----------------------------------------
  const pointer = new THREE.Vector2(0, 0); // NDC, -1..1
  let pointerInside = false;
  const tilt = new THREE.Vector2(0, 0);
  const par = {
    x: new Spring(0, { stiffness: 40, damping: 10 }),
    y: new Spring(0, { stiffness: 40, damping: 10 }),
  };
  const raycaster = new THREE.Raycaster();
  const setPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  };
  const hitRoot = (obj) => {
    for (let o = obj; o; o = o.parent) if (hits.has(o)) return o;
    return null;
  };
  const pick = () => {
    if (!hits.size) return null;
    raycaster.setFromCamera(pointer, cam);
    const list = raycaster.intersectObjects(
      [...hits.keys()].filter((o) => isShown(o)),
      true,
    );
    for (const h of list) {
      // three.js raycasts hidden children too: skip anything not rendered
      if (!isShown(h.object)) continue;
      const root = hitRoot(h.object);
      if (root && hits.get(root).enabled !== false) return root;
    }
    return null;
  };
  let hovered = null;
  let pressed = null;
  let pressAt = null;
  const setHover = (obj) => {
    if (hovered === obj) return;
    if (hovered) {
      const h = hits.get(hovered);
      if (h) {
        h.spring.target = 1;
        h.onHover?.(false);
      }
    }
    hovered = obj;
    canvas.style.cursor = obj ? "pointer" : "";
    if (obj) {
      const h = hits.get(obj);
      h.spring.target = 1.07;
      h.onHover?.(true);
    }
  };
  canvas.addEventListener("pointermove", (e) => {
    setPointer(e);
    pointerInside = true;
    if (e.pointerType === "mouse") setHover(pick());
  });
  canvas.addEventListener("pointerleave", () => {
    pointerInside = false;
    setHover(null);
  });
  canvas.addEventListener("pointerdown", (e) => {
    setPointer(e);
    pressed = pick();
    pressAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (pressed) {
      const h = hits.get(pressed);
      if (h.squish !== false) h.spring.target = 0.86;
    }
  });
  const release = (e) => {
    if (!pressed) return;
    const obj = pressed;
    pressed = null;
    const h = hits.get(obj);
    if (!h) return;
    h.spring.target = hovered === obj ? 1.07 : 1;
    if (h.squish !== false) h.spring.kick(4);
    if (e.type !== "pointerup") return;
    setPointer(e);
    const moved = Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y);
    if (moved < 24 && pick() === obj) {
      AUDIO()?.ensure();
      h.onTap?.(obj);
    }
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  if (!reduced && parallax) {
    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (e.gamma == null) return;
        tilt.set(
          Math.max(-1, Math.min(1, e.gamma / 30)),
          Math.max(-1, Math.min(1, (e.beta - 45) / 30)),
        );
      },
      { passive: true },
    );
  }

  // ---- loop --------------------------------------------------------------------
  const clock = new THREE.Timer();
  let elapsed = 0;
  let running = false;
  let visible = true;
  let fpsFrames = 0;
  let fpsTime = 0;
  const stats = { fps: 0, level: startLevel, drawCalls: 0, triangles: 0 };
  const v3 = new THREE.Vector3();

  function tick(timestamp) {
    clock.update(timestamp);
    const dt = Math.min(clock.getDelta(), 0.1);
    elapsed += dt;
    governor.frame(dt);
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 1) {
      stats.fps = Math.round(fpsFrames / fpsTime);
      fpsFrames = 0;
      fpsTime = 0;
    }
    stats.level = governor.level;

    tweens.update(dt);
    for (const m of timed) m.uniforms.uTime.value = elapsed;
    for (const [obj, h] of hits) {
      if (h.squish === false) continue;
      const s = h.spring.step(dt);
      obj.scale.copy(h.baseScale).multiplyScalar(s);
    }
    particles.update(dt);
    for (const fn of frameFns) fn(dt, elapsed);

    // camera: goal view + gentle parallax
    const amt = reduced ? 0 : parallax;
    par.x.target = (pointerInside ? pointer.x : 0) * amt + tilt.x * amt;
    par.y.target =
      (pointerInside ? pointer.y : 0) * amt * 0.5 - tilt.y * amt * 0.5;
    par.x.step(dt);
    par.y.step(dt);
    cam.position.copy(view.position);
    cam.position.x += par.x.value;
    cam.position.y += par.y.value;
    cam.lookAt(view.target);

    renderer.render(scene, cam);
    stats.drawCalls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;

    for (const p of pins) placePin(p);
  }

  // Pins are positioned with the CSS `translate` property (not `transform`),
  // so a press effect like `:active { scale: 0.94 }` or `transform: scale()`
  // on the pinned element scales it in place instead of sliding it away.
  function placePin(p) {
    p.obj.updateWorldMatrix(true, false);
    v3.copy(p.offset).applyMatrix4(p.obj.matrixWorld);
    v3.project(cam);
    const behind = v3.z > 1;
    const x = (v3.x * 0.5 + 0.5) * width;
    const y = (-v3.y * 0.5 + 0.5) * height;
    const hidden =
      behind || p.hidden || (p.followVisible && !isShown(p.obj));
    p.el.classList.toggle("kit-hidden", hidden);
    p.x = x;
    p.y = y;
    if (p.clamp !== false && p.w) {
      const c = clampPin({
        x,
        y,
        w: p.w,
        h: p.h,
        align: p.align,
        width,
        height,
        margin: p.clamp,
      });
      p.el.style.translate = `${c.left.toFixed(1)}px ${c.top.toFixed(1)}px`;
      const tail = `${c.tail.toFixed(1)}px`;
      if (p.tail !== tail) p.el.style.setProperty("--kit-tail-x", (p.tail = tail));
      return;
    }
    const ax = p.align === "left" ? "0%" : "-50%";
    const ay =
      p.align === "bottom" ? "-100%" : p.align === "top" ? "0%" : "-50%";
    p.el.style.translate = `calc(${x.toFixed(1)}px + ${ax}) calc(${y.toFixed(1)}px + ${ay})`;
  }

  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    renderer.setAnimationLoop(on ? tick : null);
    if (on) clock.reset?.();
  };
  const refresh = () => setRunning(visible && !document.hidden && !disposed);
  document.addEventListener("visibilitychange", refresh);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    refresh();
  }).observe(host);
  let disposed = false;

  applyQuality(startLevel);
  resize();
  setRunning(true);

  // ---- public API ----------------------------------------------------------
  const stage = {
    THREE,
    renderer,
    scene,
    camera: cam,
    canvas,
    overlay,
    host,
    lights: { hemi, key, fill },
    particles,
    stats,
    reducedMotion: reduced,
    get quality() {
      return settings;
    },
    get time() {
      return elapsed;
    },
    get size() {
      return { width, height, aspect: width / height };
    },
    pointer,

    // Run fn(dt, t) every frame. Returns an unsubscribe function.
    onFrame(fn) {
      frameFns.push(fn);
      return () => frameFns.splice(frameFns.indexOf(fn), 1);
    },
    // fn(width, height, aspect) now and on every resize.
    onResize(fn) {
      resizeFns.push(fn);
      fn(width, height, cam.aspect);
      return () => resizeFns.splice(resizeFns.indexOf(fn), 1);
    },
    // Tween a number: stage.tween({ from, to, ms, ease, onUpdate, onDone }).
    tween: (opts) => tweens.add(opts),

    // Camera goal. Instant, or animated over `ms`. A new setView/fit/fitPoints
    // cancels a move still running (the newest move always wins). Returns a
    // Promise (true when the move finished, false when cancelled) that also
    // has `cancel()`.
    setView({ position, target }, ms = 0, easeName = "inOutCubic") {
      camMove?.cancel();
      camMove = null;
      const p0 = view.position.clone();
      const t0 = view.target.clone();
      const p1 = position ? new THREE.Vector3(...position) : p0.clone();
      const t1 = target ? new THREE.Vector3(...target) : t0.clone();
      if (!ms || reduced) {
        view.position.copy(p1);
        view.target.copy(t1);
        return Object.assign(Promise.resolve(true), { cancel() {} });
      }
      const move = tweens.add({
        ms,
        ease: easeName,
        onUpdate: (k) => {
          view.position.lerpVectors(p0, p1, k);
          view.target.lerpVectors(t0, t1, k);
        },
      });
      camMove = move;
      move.done.then(() => camMove === move && (camMove = null));
      return Object.assign(move.done, { cancel: move.cancel });
    },
    // Frame a width×height area (world units) for the current aspect.
    // Call it inside onResize so phones and laptops both see everything.
    fit(
      {
        center = [0, 1, 0],
        width: w = 8,
        height: h = 5,
        elevation = 20,
        azimuth = 0,
        margin = 1.1,
      } = {},
      ms = 0,
    ) {
      const f = frameView({
        center,
        width: w,
        height: h,
        fov: cam.fov,
        aspect: cam.aspect,
        elevation,
        azimuth,
        margin,
      });
      return stage.setView(f, ms);
    },
    // Frame world points ([x, y, z]) exactly, perspective included, inside the
    // part of the stage the HUD leaves free. Use Kit.boxPoints / ellipsePoints
    // to describe the area. Same return value as setView.
    //   stage.fitPoints(Kit.boxPoints([-3, 0, -2], [3, 1, 2]), { elevation: 50, insets: { top: 90 } })
    fitPoints(
      points,
      { elevation = 55, azimuth = 0, margin = 1.04, insets, minFree } = {},
      ms = 0,
      easeName,
    ) {
      const f = fitPoints({
        points,
        elevation,
        azimuth,
        margin,
        insets,
        minFree,
        fov: cam.fov,
        viewW: width,
        viewH: height,
      });
      return stage.setView(f, ms, easeName);
    },
    // Re-run every onResize handler now (e.g. after the HUD changed height
    // because the language changed).
    refit() {
      resizeFns.forEach((fn) => fn(width, height, cam.aspect));
    },
    get view() {
      return view;
    },

    // Make a 3D object tappable. Returns a handle { button, remove() }.
    //   stage.tap(mesh, { label: () => t("play"), onTap, onHover, squish: true, hitRadius })
    // - label (string or function, re-read on language change) creates an
    //   invisible focusable <button> pinned over the object, so keyboard and
    //   screen-reader users can use it too (Enter/Space = tap, focus = hover).
    // - hitRadius adds an invisible sphere so small things are easy to hit.
    tap(
      obj,
      {
        label = null,
        onTap,
        onHover,
        squish = true,
        hitRadius = 0,
        hitOffset = [0, 0, 0],
      } = {},
    ) {
      if (hitRadius) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(hitRadius, 8, 6),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        m.position.set(...hitOffset);
        m.userData.kitHitArea = true;
        obj.add(m);
      }
      const h = {
        onTap,
        onHover,
        squish,
        spring: new Spring(1, { stiffness: 420, damping: 14 }),
        baseScale: obj.scale.clone(),
        enabled: true,
      };
      hits.set(obj, h);
      let pin = null;
      if (label) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "kit-hit";
        const setLabel = () =>
          b.setAttribute(
            "aria-label",
            typeof label === "function" ? label() : label,
          );
        setLabel();
        I18N()?.onChange(setLabel);
        b.addEventListener("click", () => {
          AUDIO()?.ensure();
          if (squish !== false) h.spring.kick(-6);
          onTap?.(obj);
        });
        b.addEventListener("focus", () => setHover(obj));
        b.addEventListener("blur", () => setHover(null));
        pin = stage.pin(b, obj, { offset: hitOffset, followVisible: true });
        h.button = b;
        h.setLabel = setLabel;
      }
      return {
        button: h.button,
        setBase: () => h.baseScale.copy(obj.scale),
        // Press-and-bounce by code (e.g. when a key answers): same as a tap's squish.
        kick: (v = -6) => {
          if (squish !== false) h.spring.kick(v);
        },
        refreshLabel: () => h.setLabel?.(),
        set enabled(v) {
          h.enabled = v;
          if (h.button) h.button.disabled = !v;
        },
        remove() {
          hits.delete(obj);
          pin?.remove();
        },
      };
    },

    // Pin an HTML element to a 3D point (object + local offset).
    //   align: "center" | "bottom" (element sits above the point) | "top" | "left"
    //   clamp: px margin that keeps the element fully inside the stage (false =
    //     off, the default). Clamped pins get `--kit-tail-x`: how far the anchor
    //     is from their centre, so a speech-bubble tail can keep pointing at it.
    //   followVisible: hide the element while the object (or a parent) is hidden.
    // Press effects: scale the element with `scale` or `transform` freely; the
    // pin itself only uses the `translate` property.
    pin(
      el,
      obj,
      {
        offset = [0, 0, 0],
        align = "center",
        clamp = false,
        followVisible = false,
      } = {},
    ) {
      el.classList.add("kit-pin");
      if (!el.isConnected) overlay.appendChild(el);
      const p = {
        el,
        obj,
        offset: new THREE.Vector3(...offset),
        align,
        hidden: false,
        clamp: clamp === true ? 10 : clamp,
        followVisible,
        w: 0,
        h: 0,
      };
      let ro = null;
      if (p.clamp !== false) {
        // measure with a ResizeObserver, never in the frame loop
        const measure = () => {
          p.w = el.offsetWidth;
          p.h = el.offsetHeight;
        };
        ro = new ResizeObserver(measure);
        ro.observe(el);
        measure();
      }
      pins.push(p);
      placePin(p);
      return {
        el,
        set hidden(v) {
          p.hidden = v;
        },
        setOffset: (o) => p.offset.set(...o),
        setAlign: (a) => (p.align = a),
        get x() {
          return p.x;
        },
        get y() {
          return p.y;
        },
        remove() {
          const i = pins.indexOf(p);
          if (i >= 0) pins.splice(i, 1);
          ro?.disconnect();
          el.remove();
        },
      };
    },

    // Screen position (CSS px) of a world point.
    toScreen(worldPoint) {
      const p = worldPoint.clone().project(cam);
      return {
        x: (p.x * 0.5 + 0.5) * width,
        y: (-p.y * 0.5 + 0.5) * height,
        behind: p.z > 1,
      };
    },
    // Where the pointer ray meets the horizontal plane y = h (or null).
    pointerOnPlane(h = 0, out = new THREE.Vector3()) {
      raycaster.setFromCamera(pointer, cam);
      return raycaster.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -h),
        out,
      );
    },
    get pointerActive() {
      return pointerInside;
    },

    // Celebrations (counts shrink automatically on low quality).
    burst(position, opts) {
      const p = position.isVector3 ? position : new THREE.Vector3(...position);
      particles.burst(
        p,
        reduced
          ? { ...opts, count: Math.ceil((opts?.count || 26) / 3), speed: 2 }
          : opts,
      );
    },
    // Remove every burst and confetti bit still flying (e.g. on a screen change).
    clearBursts() {
      particles.clear();
    },
    confetti(opts = {}) {
      if (reduced) return;
      const dir = new THREE.Vector3()
        .subVectors(view.target, view.position)
        .normalize();
      const c = view.position.clone().addScaledVector(dir, 7);
      const vh = 2 * Math.tan((cam.fov * Math.PI) / 360) * 7;
      particles.confetti(c, {
        width: vh * cam.aspect * 1.1,
        height: vh,
        ...opts,
      });
    },

    pause: () => setRunning(false),
    resume: () => refresh(),
    dispose() {
      disposed = true;
      setRunning(false);
      renderer.dispose();
      host.remove();
    },
  };
  stages.push(stage);
  return stage;
}

export { damp };
