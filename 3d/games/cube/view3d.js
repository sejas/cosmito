// The 3D cube: cubies with toy-like rounded bodies and candy stickers, smooth
// layer turns, curved arrows for the next move, glowing pieces, and swipe
// input (drag a side = turn that layer; drag around the cube = whole cube).
// It only DRAWS a sticker array; the game logic lives in cube3d.js.
/* global CubeEngine */
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { STICKER, BLANK } from "./palette.js";

const E = CubeEngine;
const BODY = "#232845";
const AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
];

// Rounded box: a segmented box whose vertices are pushed onto rounded edges.
function roundedBox(size, radius, seg = 4) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
  const p = g.attributes.position;
  const inner = size / 2 - radius;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(
      Kit.clamp(v.x, -inner, inner),
      Kit.clamp(v.y, -inner, inner),
      Kit.clamp(v.z, -inner, inner),
    );
    v.sub(c);
    if (v.lengthSq() > 1e-9) v.setLength(radius);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function roundedSquare(size, radius) {
  return new THREE.ShapeGeometry(roundedShape(size, radius), 4);
}
function roundedShape(size, radius) {
  const s = size / 2;
  const r = radius;
  const sh = new THREE.Shape();
  sh.moveTo(-s + r, -s);
  sh.lineTo(s - r, -s);
  sh.quadraticCurveTo(s, -s, s, -s + r);
  sh.lineTo(s, s - r);
  sh.quadraticCurveTo(s, s, s - r, s);
  sh.lineTo(-s + r, s);
  sh.quadraticCurveTo(-s, s, -s, s - r);
  sh.lineTo(-s, -s + r);
  sh.quadraticCurveTo(-s, -s, -s + r, -s);
  return sh;
}

export function createCubeView(stage, handlers = {}) {
  const root = new THREE.Group(); // presentation: paint-mode facing, peeking
  const cube = new THREE.Group(); // the cube itself (axes = cube axes)
  root.add(cube);
  stage.scene.add(root);
  const bodyGeo = roundedBox(0.95, 0.13);
  const stickerGeo = roundedSquare(0.8, 0.16);
  // glow: a pulsing frame around a sticker (rounded square with a hole)
  const glowShape = roundedShape(1.0, 0.24);
  glowShape.holes.push(new THREE.Path(roundedShape(0.8, 0.16).getPoints(4).reverse()));
  const glowGeo = new THREE.ShapeGeometry(glowShape, 4);
  const bodyMat = Kit.toon(BODY, { rim: 0.25, rimColor: "#8f9bff" });
  const mats = STICKER.map((c) => Kit.toon(c, { rim: 0.22 }));
  const blankMat = Kit.toon(BLANK, { rim: 0.2 });
  const glowMat = Kit.flat("#fff27a", { opacity: 0.9, unique: true });
  glowMat.depthWrite = false;
  const errMat = Kit.flat("#ff3d7f", { opacity: 0.9, unique: true });
  errMat.depthWrite = false;

  let n = 3;
  let cubies = [];
  let stickers = [];
  let pickables = [];
  let current = null;
  let busy = 0;
  let glowing = [];
  let arrowObj = null;
  let enabled = true;

  function build(size) {
    for (const c of cubies) cube.remove(c.group);
    n = size;
    const geo = E.geometry(n);
    cubies = [];
    stickers = new Array(geo.stickers.length);
    pickables = [];
    for (const cb of geo.cubies) {
      const group = new THREE.Group();
      group.position.set(...cb.pos);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.userData.cubie = cb;
      group.add(body);
      pickables.push(body);
      for (const i of cb.stickers) {
        const s = geo.stickers[i];
        const m = new THREE.Mesh(stickerGeo, blankMat);
        const nrm = new THREE.Vector3(...s.normal);
        m.position.copy(nrm).multiplyScalar(0.478);
        m.lookAt(nrm.clone().multiplyScalar(2));
        m.userData = { cubie: cb, index: i };
        group.add(m);
        stickers[i] = m;
        pickables.push(m);
      }
      cube.add(group);
      cubies.push({ ...cb, group });
    }
    glowing = [];
    if (current && current.length === stickers.length) setState(current);
  }

  function setState(s) {
    current = s.slice();
    s.forEach((c, i) => {
      if (stickers[i])
        stickers[i].material = c >= 0 && c < 6 ? mats[c] : blankMat;
    });
  }

  // ---- turns --------------------------------------------------------------
  // Animate a move, then show `after` (the state once the move is done).
  function turn(move, { ms = 250, after = null, from = 0 } = {}) {
    const info = E.moveInfo(move, n);
    if (stage.reducedMotion) ms = Math.min(ms, 60);
    const moving = info.rotation
      ? cubies
      : cubies.filter((c) => info.layers.includes(c.pos[info.axis]));
    const pivot = new THREE.Group();
    cube.add(pivot);
    for (const c of moving) pivot.attach(c.group);
    busy++;
    const axis = AXES[info.axis];
    const finish = () => {
      for (const c of moving) {
        cube.add(c.group);
        c.group.position.set(...c.pos);
        c.group.rotation.set(0, 0, 0);
      }
      cube.remove(pivot);
      busy--;
      if (after) setState(after);
    };
    if (ms <= 0) {
      finish();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      stage.tween({
        from,
        to: info.angle,
        ms: ms * (info.turns === 2 ? 1.5 : 1),
        ease: "outCubic",
        onUpdate: (v) => pivot.quaternion.setFromAxisAngle(axis, v),
        onDone: () => {
          finish();
          resolve();
        },
      });
    });
  }

  // ---- arrows ---------------------------------------------------------------
  const arrowMat = Kit.candy("#ff4f9a", "#5a0d2c");
  const wholeMat = Kit.candy("#8c6bff", "#1f1060");
  function arrow(move) {
    if (arrowObj) {
      cube.remove(arrowObj);
      arrowObj.traverse((o) => o.geometry?.dispose());
      arrowObj = null;
    }
    if (!move) return;
    const info = E.moveInfo(move, n);
    const a = AXES[info.axis].clone();
    const centre = info.rotation
      ? 0
      : info.layers.reduce((x, y) => x + y, 0) / info.layers.length;
    // the arc sits on the side of the layer that faces the camera
    const cam = cube.worldToLocal(stage.camera.position.clone());
    const u = cam.clone().addScaledVector(a, -cam.dot(a));
    if (u.lengthSq() < 1e-6) u.copy(AXES[(info.axis + 1) % 3]);
    u.normalize();
    const w = new THREE.Vector3().crossVectors(a, u);
    const r = (n / 2) * Math.SQRT2 + (info.rotation ? 0.62 : 0.34);
    const span = ((info.turns === 2 ? 180 : 96) * Math.PI) / 180;
    const sgn = Math.sign(info.angle);
    const pts = [];
    const at = (t) =>
      a
        .clone()
        .multiplyScalar(centre)
        .addScaledVector(u, r * Math.cos(t))
        .addScaledVector(w, r * Math.sin(t));
    const t0 = -sgn * (span / 2);
    const t1 = sgn * (span / 2 - 0.22);
    for (let k = 0; k <= 32; k++) pts.push(at(t0 + ((t1 - t0) * k) / 32));
    const group = new THREE.Group();
    const mat = info.rotation ? wholeMat : arrowMat;
    const thick = info.rotation ? 0.1 : 0.085;
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, thick, 10),
      mat,
    );
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(thick * 2.6, 0.42, 16),
      mat,
    );
    const tip = at(sgn * (span / 2));
    const dir = tip
      .clone()
      .sub(pts[pts.length - 1])
      .normalize();
    head.position.copy(pts[pts.length - 1]).addScaledVector(dir, 0.14);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.add(tube, head);
    if (info.turns === 2) {
      const lbl = Kit.label("×2", {
        size: 0.5,
        color: "#ffffff",
        outline: "#c2255c",
      });
      lbl.position.copy(at(0)).addScaledVector(u, 0.45);
      group.add(lbl);
    }
    group.userData.base = 1;
    cube.add(group);
    arrowObj = group;
  }

  // ---- glow ---------------------------------------------------------------
  function glow(indices, { error = false } = {}) {
    for (const g of glowing) g.parent?.remove(g);
    glowing = [];
    for (const i of indices || []) {
      const st = stickers[i];
      if (!st) continue;
      const m = new THREE.Mesh(glowGeo, error ? errMat : glowMat);
      m.position.z = 0.004;
      m.renderOrder = 2;
      st.add(m);
      glowing.push(m);
    }
  }
  stage.onFrame((dt, t) => {
    glowMat.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 5));
    errMat.opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 7));
    if (arrowObj && !stage.reducedMotion)
      arrowObj.scale.setScalar(1 + 0.035 * Math.sin(t * 6));
    if (arrowObj) arrowObj.visible = busy === 0;
  });

  // ---- presentation (paint mode faces, idle spin, peeking) -----------------
  const FACE_Q = [
    new THREE.Euler(Math.PI / 2, 0, 0), // U: tip the top towards you
    new THREE.Euler(0, -Math.PI / 2, 0), // R: turn the cube to the left
    new THREE.Euler(0, 0, 0), // F
    new THREE.Euler(-Math.PI / 2, 0, 0), // D: tip the other way
    new THREE.Euler(0, Math.PI / 2, 0), // L
    new THREE.Euler(0, Math.PI, 0), // B
  ].map((e) => new THREE.Quaternion().setFromEuler(e));
  const TILT = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-0.18, 0.3, 0), // turned towards the camera, a little of the top and right showing
  );
  const peek = new THREE.Quaternion();
  const base = new THREE.Quaternion();
  let presentMove = null;
  function present(face, ms = 600) {
    const to =
      face == null
        ? new THREE.Quaternion()
        : TILT.clone().multiply(FACE_Q[face]);
    presentMove?.cancel();
    const from = base.clone();
    if (ms <= 0 || stage.reducedMotion) {
      base.copy(to);
      return;
    }
    presentMove = stage.tween({
      ms,
      ease: "inOutCubic",
      onUpdate: (k) => base.slerpQuaternions(from, to, k),
    });
  }
  // idle: a slow showroom spin (home screen)
  let idle = false;
  let idleA = 0;
  const idleQ = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  stage.onFrame((dt) => {
    if (idle && !stage.reducedMotion) idleA += dt * 0.45;
    else if (idleA) {
      const goal = Math.round(idleA / (Math.PI * 2)) * Math.PI * 2;
      idleA = Kit.damp(idleA, goal, 5, dt);
      if (Math.abs(idleA - goal) < 1e-3) idleA = 0;
    }
    idleQ.setFromAxisAngle(Y, idleA);
    root.quaternion.copy(base).multiply(idleQ).multiply(peek);
  });

  // ---- input --------------------------------------------------------------
  const canvas = stage.canvas;
  canvas.style.touchAction = "none";
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag = null;
  const hitAt = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, stage.camera);
    return ray.intersectObjects(pickables, false)[0] || null;
  };
  const toScreen = (localPoint) =>
    stage.toScreen(cube.localToWorld(localPoint.clone()));
  canvas.addEventListener("pointerdown", (e) => {
    if (!enabled || drag || (e.pointerType === "mouse" && e.button !== 0))
      return;
    const hit = hitAt(e);
    drag = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      hit,
      axis: null,
      angle: 0,
    };
    if (hit) {
      // which face of the cubie was touched (in cube axes)
      const nrm = hit.face.normal
        .clone()
        .transformDirection(hit.object.matrixWorld);
      const inv = cube.getWorldQuaternion(new THREE.Quaternion()).invert();
      nrm.applyQuaternion(inv);
      const k = [0, 1, 2].reduce(
        (b, i) =>
          Math.abs(nrm.getComponent(i)) > Math.abs(nrm.getComponent(b)) ? i : b,
        0,
      );
      const N = AXES[k].clone().multiplyScalar(Math.sign(nrm.getComponent(k)));
      drag.normal = N;
      drag.cubie = hit.object.userData.cubie;
    }
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    const dist = Math.hypot(dx, dy);
    if (drag.hit) {
      if (dist < 16 || drag.done) return;
      drag.done = true;
      const C = new THREE.Vector3(...drag.cubie.pos);
      const N = drag.normal;
      const P = C.clone().addScaledVector(N, 0.5);
      const p0 = toScreen(P);
      let best = null;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(N.getComponent(k)) > 0.5) continue;
        const p1 = toScreen(P.clone().addScaledVector(AXES[k], 0.5));
        const sx = p1.x - p0.x;
        const sy = p1.y - p0.y;
        const len = Math.hypot(sx, sy) || 1;
        const score = (dx * sx + dy * sy) / (dist * len);
        if (!best || Math.abs(score) > Math.abs(best.score))
          best = { k, score };
      }
      const D = AXES[best.k].clone().multiplyScalar(Math.sign(best.score));
      const A = new THREE.Vector3().crossVectors(N, D);
      const k = [0, 1, 2].find((i) => Math.abs(A.getComponent(i)) > 0.5);
      const move = E.moveFromTurn(
        n,
        k,
        drag.cubie.pos[k],
        Math.sign(A.getComponent(k)),
      );
      if (move) handlers.onTurn?.(move, "swipe");
      return;
    }
    // background: turn the whole cube with the finger
    if (!drag.axis) {
      if (dist < 10) return;
      drag.axis = Math.abs(dx) >= Math.abs(dy) ? "y" : "x";
    }
    const k = 0.012;
    drag.angle = drag.axis === "y" ? dx * k : dy * k;
    drag.angle = Kit.clamp(drag.angle, -Math.PI / 1.8, Math.PI / 1.8);
    peek.setFromAxisAngle(drag.axis === "y" ? AXES[1] : AXES[0], drag.angle);
  });
  const release = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    if (d.hit) {
      if (!d.done && e.type === "pointerup")
        handlers.onStickerTap?.(d.hit.object.userData.index);
      return;
    }
    if (!d.axis) return;
    const move =
      Math.abs(d.angle) > 0.55
        ? d.axis === "y"
          ? d.angle > 0
            ? "y'"
            : "y"
          : d.angle < 0
            ? "x"
            : "x'"
        : null;
    const accepted = move && handlers.onWholeTurn?.(move, d.angle);
    if (accepted) {
      // hand the finger's angle over to the whole-cube turn animation
      peek.identity();
      return;
    }
    const from = d.angle;
    const ax = d.axis === "y" ? AXES[1] : AXES[0];
    stage.tween({
      ms: 380,
      ease: "outBack",
      onUpdate: (k) => peek.setFromAxisAngle(ax, from * (1 - k)),
    });
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // points to frame the cube (+ a margin for the arrows)
  const framePoints = () => {
    const h = n / 2 + 0.45;
    return Kit.boxPoints([-h, -h, -h], [h, h, h]);
  };

  build(3);
  return {
    root,
    cube,
    get n() {
      return n;
    },
    get busy() {
      return busy > 0;
    },
    set enabled(v) {
      enabled = v;
    },
    set idle(v) {
      idle = v;
    },
    build,
    setState,
    turn,
    arrow,
    glow,
    present,
    framePoints,
    stickerScreen: (i) => {
      const m = stickers[i];
      return m ? stage.toScreen(m.getWorldPosition(new THREE.Vector3())) : null;
    },
  };
}
