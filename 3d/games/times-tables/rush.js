// Lightning Rush props: a glowing ring of 60 beads (one per second) that
// empties as time runs out, and treats raining from the sky.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { label } from "./world.js";
import { TreatInstances } from "./instanced.js";

const BEADS = 60;

export function createTimerRing(stage) {
  const root = new THREE.Group();
  const R = 1.5;
  const base = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.035, 8, 96),
    Kit.flat("#ffffff", { opacity: 0.55 }),
  );
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(R - 0.16, R + 0.16, 96),
    Kit.flat("#fff3bf", { opacity: 0.22, additive: true }),
  );
  const beads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.085, 12, 8),
    Kit.toon("#ffffff", { rim: 0.7, emissive: "#222222" }),
    BEADS,
  );
  const colA = new THREE.Color("#51cf66");
  const colB = new THREE.Color("#ffd43b");
  const colC = new THREE.Color("#ff6b6b");
  const c = new THREE.Color();
  for (let i = 0; i < BEADS; i++) {
    const k = i / (BEADS - 1); // 0 = last second, 1 = first
    if (k < 0.18) c.copy(colC).lerp(colB, k / 0.18);
    else c.copy(colB).lerp(colA, Math.min(1, (k - 0.18) / 0.4));
    beads.setColorAt(i, c);
  }
  const secs = label("60", {
    size: 0.62,
    color: "#26315c",
    bg: "rgba(255,255,255,0.9)",
  });
  secs.position.set(0, R + 0.02, 0.2);
  secs.renderOrder = 5;
  root.add(glow, base, beads);
  root.traverse((o) => (o.raycast = () => {}));
  root.visible = false;

  const scales = new Float32Array(BEADS).fill(1);
  let left = BEADS;
  let hurry = false;
  let lastText = "";
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  stage.onFrame((dt, t) => {
    if (!root.visible) return;
    for (let i = 0; i < BEADS; i++) {
      // bead i = second i+1 (bead 0 at the top, going clockwise)
      const on = i < left;
      scales[i] = Kit.damp(scales[i], on ? 1 : 0, on ? 10 : 7, dt);
      const pulse =
        hurry && on && !stage.reducedMotion
          ? 1 + 0.25 * Math.max(0, Math.sin(t * 10 - i * 0.3))
          : 1;
      const a = Math.PI / 2 - (i / BEADS) * Math.PI * 2;
      p.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      m.compose(p, q, s.setScalar(Math.max(1e-3, scales[i] * pulse)));
      beads.setMatrixAt(i, m);
    }
    beads.instanceMatrix.needsUpdate = true;
    glow.material.opacity = hurry
      ? 0.3 + 0.2 * Math.abs(Math.sin(t * 5))
      : 0.22;
  });

  return {
    root,
    // seconds left (may exceed 60 with bonuses: the ring stays full)
    set(secondsLeft, isHurry) {
      left = Math.max(0, Math.min(BEADS, secondsLeft));
      hurry = isHurry;
      const txt = String(Math.max(0, secondsLeft));
      if (txt !== lastText) {
        lastText = txt;
        secs.userData.setText(txt);
      }
    },
    reset() {
      scales.fill(0);
      left = BEADS;
      hurry = false;
    },
    flash() {
      stage.burst(
        root
          .getWorldPosition(new THREE.Vector3())
          .add(new THREE.Vector3(0, R, 0)),
        {
          shape: "star",
          count: 16,
          speed: 3,
          colors: ["#ffd43b", "#ffffff", "#51cf66"],
        },
      );
    },
  };
}

// Treats falling from the sky, spinning. Ambient drizzle + bursts.
export function createRain(stage, { max = 28 } = {}) {
  const inst = new TreatInstances(stage, max);
  const drops = [];
  let area = { x: 0, w: 10, top: 7, bottom: -3 };
  let rate = 0; // drops per second (0 = off)
  let acc = 0;
  const spawn = () => {
    if (drops.length >= max) return;
    drops.push({
      x: area.x + (Math.random() - 0.5) * area.w,
      y: area.top + Math.random() * 1.5,
      z: -1.2 - Math.random() * 3,
      vy: -(2.4 + Math.random() * 1.6),
      rx: Math.random() * 6,
      ry: Math.random() * 6,
      spin: (Math.random() - 0.5) * 5,
      s: 0.45 + Math.random() * 0.25,
    });
  };
  stage.onFrame((dt) => {
    if (rate > 0 && !stage.reducedMotion) {
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        spawn();
      }
    }
    if (!drops.length && !inst.count) return;
    for (let k = drops.length - 1; k >= 0; k--) {
      const d = drops[k];
      d.y += d.vy * dt;
      d.rx += d.spin * dt;
      d.ry += d.spin * 0.7 * dt;
      if (d.y < area.bottom) drops.splice(k, 1);
    }
    inst.count = drops.length;
    drops.forEach((d, i) =>
      inst.set(i, {
        x: d.x,
        y: d.y,
        z: d.z,
        rx: d.rx,
        ry: d.ry,
        rz: 0,
        s: d.s,
      }),
    );
    inst.flush();
  });
  return {
    group: inst.group,
    setTreat: (id) => inst.setTreat(id),
    setArea(a) {
      area = { ...area, ...a };
    },
    set rate(v) {
      rate = v;
    },
    burst(n = 12) {
      if (stage.reducedMotion) n = Math.ceil(n / 4);
      for (let i = 0; i < n; i++) spawn();
    },
    clear() {
      drops.length = 0;
      rate = 0;
    },
  };
}
