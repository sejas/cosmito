// Ways to answer: four bouncy glass bubbles (Practice, Rush) and a chunky
// glass keypad (Pro). Both are real 3D objects with focusable twins
// (stage.tap labels) for keyboard and screen readers.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { label } from "./world.js";
import { keypadKeys } from "./logic.js";

const BUBBLE_COLORS = ["#ff8fb8", "#b197fc", "#4fd8b0", "#5cb8ff"];
const bubbleMat = (c) =>
  Kit.toon(c, {
    transparent: true,
    opacity: 0.55,
    rim: 1.1,
    rimColor: "#ffffff",
  });
const GOOD = "#40c057";
const DULL = "#c9cde6";

export function createBubbles(stage, { label: ariaLabel, onPick }) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.8, 40, 28);
  const shineGeo = new THREE.CapsuleGeometry(0.07, 0.26, 4, 8);
  const shineMat = Kit.flat("#ffffff", { opacity: 0.85 });
  const bubbles = BUBBLE_COLORS.map((color, i) => {
    const root = new THREE.Group();
    const wob = new THREE.Group();
    root.add(wob);
    const ball = new THREE.Mesh(geo, bubbleMat(color));
    ball.renderOrder = 1;
    const shine = new THREE.Mesh(shineGeo, shineMat);
    const d = new THREE.Vector3(-0.42, 0.5, 0.76)
      .normalize()
      .multiplyScalar(0.8);
    shine.position.copy(d);
    shine.rotation.z = 0.7;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), shineMat);
    dot.position.copy(
      new THREE.Vector3(-0.2, 0.66, 0.5).normalize().multiplyScalar(0.8),
    );
    const num = label("0", {
      size: 0.7,
      color: "#26315c",
      outline: "#ffffff",
    });
    num.position.set(0, 0, 0.86);
    num.renderOrder = 3;
    const key = label(String(i + 1), {
      size: 0.3,
      color: "#ffffff",
      bg: "rgba(38,49,92,0.55)",
    });
    key.position.set(0.56, -0.58, 0.62);
    key.renderOrder = 3;
    wob.add(ball, shine, dot, num, key);
    group.add(root);
    const b = {
      i,
      color,
      root,
      wob,
      ball,
      num,
      key,
      value: 0,
      state: "idle",
      phase: i * 1.9,
      shakeT: -1,
      glow: 0,
      appear: 1,
      anim: null,
    };
    b.tap = stage.tap(root, {
      label: () => ariaLabel(b.value, i + 1),
      onTap: () => onPick(i),
      hitRadius: 0.85,
    });
    return b;
  });

  stage.onFrame((dt, t) => {
    const still = stage.reducedMotion;
    for (const b of bubbles) {
      if (!b.root.visible) continue;
      const k = still ? 0 : 1;
      b.wob.position.y = Math.sin(t * 1.7 + b.phase) * 0.09 * k;
      const j = Math.sin(t * 3.1 + b.phase) * 0.025 * k;
      let s = 1 + b.glow * 0.14;
      b.glow = Kit.damp(b.glow, b.state === "reveal" ? 1 : 0, 8, dt);
      let x = 0;
      if (b.shakeT >= 0) {
        b.shakeT += dt;
        x = Math.sin(b.shakeT * 30) * 0.14 * Math.max(0, 1 - b.shakeT / 0.55);
        if (b.shakeT > 0.55) b.shakeT = -1;
      }
      b.wob.position.x = x;
      const a = Math.max(0.01, b.appear);
      b.wob.scale.set(a * s * (1 + j), a * s * (1 - j), a * s);
    }
  });

  const api = {
    group,
    bubbles,
    layout(positions) {
      bubbles.forEach((b, i) => {
        b.root.position.set(positions[i].x, positions[i].y, positions[i].z);
        b.tap.setBase();
      });
    },
    // New question: values in key order, pop in one by one.
    show(values) {
      bubbles.forEach((b, i) => {
        b.value = values[i];
        b.state = "idle";
        b.glow = 0;
        b.num.userData.setText(String(values[i]));
        b.ball.material = bubbleMat(b.color);
        b.root.visible = true;
        b.tap.enabled = true;
        b.tap.refreshLabel();
        b.wob.visible = true;
        b.appear = 0;
        b.anim?.cancel();
        b.anim = stage.tween({
          ms: stage.reducedMotion ? 1 : 520,
          delay: stage.reducedMotion ? 0 : i * 70,
          ease: "outBack",
          onUpdate: (s) => (b.appear = s),
        });
      });
    },
    lock() {
      bubbles.forEach((b) => (b.tap.enabled = false));
    },
    // Right answer: the bubble pops into sparkles.
    pop(i) {
      const b = bubbles[i];
      b.state = "popped";
      const p = b.root.getWorldPosition(new THREE.Vector3());
      stage.burst(p, {
        shape: "dot",
        count: 22,
        speed: 4,
        up: 1.2,
        colors: [b.color, "#ffffff", "#e7f5ff"],
      });
      stage.burst(p, { shape: "star", count: 10, speed: 3.2, up: 1.5 });
      b.anim?.cancel();
      b.anim = stage.tween({
        ms: stage.reducedMotion ? 1 : 180,
        ease: "outQuad",
        onUpdate: (k) => (b.appear = 1 + k * 0.35),
        onDone: () => (b.wob.visible = false),
      });
      return p;
    },
    // Wrong answer: wobble "no no" and go dull.
    wrong(i) {
      const b = bubbles[i];
      b.state = "wrong";
      b.shakeT = 0;
      b.ball.material = bubbleMat(DULL);
    },
    // Show the right one: glowing green.
    reveal(i) {
      const b = bubbles[i];
      b.state = "reveal";
      b.ball.material = bubbleMat(GOOD);
    },
    // Float the remaining bubbles away (before a hint or next question).
    clear(ms = 320) {
      bubbles.forEach((b) => {
        b.tap.enabled = false;
        if (!b.wob.visible) return (b.root.visible = false);
        const s0 = b.appear;
        b.anim?.cancel();
        b.anim = stage.tween({
          ms: stage.reducedMotion ? 1 : ms,
          ease: "inQuad",
          onUpdate: (k) => (b.appear = s0 * (1 - k)),
          onDone: () => (b.root.visible = false),
        });
      });
    },
    hide() {
      bubbles.forEach((b) => {
        b.root.visible = false;
        b.tap.enabled = false;
      });
    },
    indexOf: (v) => bubbles.findIndex((b) => b.value === v),
    worldOf: (i) => bubbles[i].root.getWorldPosition(new THREE.Vector3()),
  };
  api.hide();
  return api;
}

// ------------------------------------------------------------------ keypad
function keyShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createKeypad(stage, { label: ariaLabel, onKey }) {
  const group = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(keyShape(0.8, 0.8, 0.24), {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geo.center();
  const mats = {
    digit: Kit.toon("#f3f0ff", {
      rim: 0.9,
      rimColor: "#b197fc",
      transparent: true,
      opacity: 0.92,
    }),
    del: Kit.toon("#ffd8a8", { rim: 0.8, rimColor: "#ffffff" }),
    ok: Kit.toon("#63e6be", { rim: 0.8, rimColor: "#ffffff" }),
  };
  // soft holographic plate behind the keys
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 5.4),
    Kit.holo("#b197fc", { opacity: 0.55, swirl: 0.35 }),
  );
  plate.position.z = -0.35;
  plate.raycast = () => {};
  group.add(plate);
  const keys = keypadKeys().map(({ key, x, y }) => {
    const root = new THREE.Group();
    root.position.set(x, y, 0);
    const press = new THREE.Group();
    root.add(press);
    const kind = key === "⌫" ? "del" : key === "✓" ? "ok" : "digit";
    const cap = new THREE.Mesh(geo, mats[kind]);
    cap.castShadow = true;
    const txt = label(key, {
      size: key.length > 1 || kind !== "digit" ? 0.5 : 0.56,
      color: kind === "ok" ? "#ffffff" : "#26315c",
      outline: kind === "ok" ? "#0ca678" : null,
    });
    txt.position.z = 0.24;
    txt.renderOrder = 3;
    press.add(cap, txt);
    group.add(root);
    const k = { key, root, press, pressT: -1 };
    k.tap = stage.tap(root, {
      label: () => ariaLabel(key),
      onTap: () => onKey(key),
      hitRadius: 0.55,
    });
    return k;
  });
  stage.onFrame((dt) => {
    for (const k of keys) {
      if (k.pressT < 0) continue;
      k.pressT += dt / 0.22;
      k.press.position.z = -Math.sin(Math.min(1, k.pressT) * Math.PI) * 0.14;
      if (k.pressT >= 1) {
        k.pressT = -1;
        k.press.position.z = 0;
      }
    }
  });
  return {
    group,
    keys,
    press(key) {
      const k = keys.find((x) => x.key === key);
      if (k) k.pressT = 0;
    },
    enable(on) {
      keys.forEach((k) => (k.tap.enabled = on));
    },
    refreshLabels() {
      keys.forEach((k) => k.tap.refreshLabel());
    },
  };
}
