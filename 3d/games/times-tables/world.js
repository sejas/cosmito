// Backdrop and shared props: floating maths toys in the sky, the buddy's pad,
// the treat jar and the streak fire ring.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { jarSlot, JAR_CAPACITY } from "./logic.js";

// Pop an object's scale from 0 (or `from`) to `to` with a springy ease.
export function pop(
  stage,
  obj,
  { from = 0, to = 1, ms = 520, delay = 0, ease = "outBack" } = {},
) {
  obj.scale.setScalar(Math.max(1e-4, from));
  return stage.tween({
    from,
    to,
    ms: stage.reducedMotion ? 1 : ms,
    delay: stage.reducedMotion ? 0 : delay,
    ease,
    onUpdate: (s) => obj.scale.setScalar(Math.max(1e-4, s)),
  });
}

// Move an object to a point with an arc (a little hop) over `ms`.
export function hopTo(stage, obj, to, { ms = 600, height = 0.8 } = {}) {
  const from = obj.position.clone();
  const target = new THREE.Vector3(to.x, to.y, to.z);
  if (from.distanceTo(target) < 1e-3 || stage.reducedMotion) {
    obj.position.copy(target);
    return Promise.resolve();
  }
  return stage.tween({
    ms,
    ease: "inOutCubic",
    onUpdate: (k) => {
      obj.position.lerpVectors(from, target, k);
      obj.position.y += Math.sin(k * Math.PI) * height;
    },
  }).done;
}

export function createBackdrop(stage) {
  Kit.createClouds(stage.scene, {
    count: 8,
    center: [0, 3, -26],
    area: [80, 14, 16],
  });
  Kit.createSparkles(stage.scene, {
    count: 60,
    center: [0, 4, -6],
    area: [34, 14, 10],
  });
  // Big soft "×" and "+" toys drifting far behind: one draw call each shape.
  const bar = new THREE.CapsuleGeometry(0.22, 1.3, 4, 12);
  const cols = [
    "#ffc9e3",
    "#d0bfff",
    "#b2f2bb",
    "#a5d8ff",
    "#ffe066",
    "#ffd8a8",
  ];
  const toys = new THREE.InstancedMesh(
    bar,
    Kit.toon("#ffffff", { rim: 0.5 }),
    24,
  );
  toys.raycast = () => {};
  const spots = [];
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    spots.push({
      x: side * (7 + rnd() * 12),
      y: -2 + rnd() * 10,
      z: -9 - rnd() * 10,
      s: 0.7 + rnd() * 0.7,
      plus: i % 3 === 0,
      spin: (rnd() - 0.5) * 0.6,
      phase: rnd() * 6,
    });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const place = (t) => {
    let k = 0;
    spots.forEach((o, i) => {
      const rot = o.phase + t * o.spin;
      for (let b = 0; b < 2; b++) {
        e.set(
          0.3 * Math.sin(t * 0.3 + i),
          0,
          rot + (o.plus ? 0 : Math.PI / 4) + (b * Math.PI) / 2,
        );
        q.setFromEuler(e);
        p.set(o.x, o.y + Math.sin(t * 0.5 + o.phase) * 0.4, o.z);
        m.compose(p, q, s.setScalar(o.s));
        toys.setMatrixAt(k++, m);
      }
    });
    toys.instanceMatrix.needsUpdate = true;
  };
  spots.forEach((o, i) => {
    const c = new THREE.Color(cols[i % cols.length]);
    toys.setColorAt(i * 2, c);
    toys.setColorAt(i * 2 + 1, c);
  });
  place(0);
  stage.scene.add(toys);
  stage.onFrame((dt, t) => !stage.reducedMotion && place(t));
}

// A round glowing pad to stand on (buddy, jar).
export function createPad(radius = 1.1, color = "#d0bfff") {
  const pad = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.08, 0.16, 48),
    Kit.toon("#ffffff", { rim: 0.4, rimColor: color }),
  );
  top.position.y = -0.08;
  top.receiveShadow = true;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, 0.04, 8, 64),
    Kit.flat(color),
  );
  ring.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.86, 48),
    Kit.holo(color, { opacity: 0.45, swirl: 0.3 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.005;
  // soft underside so it reads as floating
  const under = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.98, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    Kit.toon("#e5dbff", { rim: 0.5 }),
  );
  under.scale.y = 0.28;
  under.position.y = -0.15;
  pad.add(top, ring, glow, under);
  pad.traverse((o) => (o.raycast = () => {}));
  return pad;
}

// The treat jar: a glass pot that fills up with the buddy's treats.
export function createJar(stage) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // wobbles when a treat lands
  root.add(body);
  const glassMat = Kit.toon("#e7f5ff", {
    transparent: true,
    opacity: 0.26,
    rim: 1.3,
    rimColor: "#ffffff",
  });
  glassMat.depthWrite = false;
  glassMat.side = THREE.DoubleSide;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.55, 1.6, 36, 1, true),
    glassMat,
  );
  glass.position.y = 0.8;
  glass.renderOrder = 2;
  const bottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.5, 0.1, 36),
    Kit.candy("#d0bfff"),
  );
  bottom.position.y = 0.05;
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(0.63, 0.075, 12, 40),
    Kit.candy("#ff8fb8"),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 1.6;
  const shine = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.045, 0.8, 4, 8),
    Kit.flat("#ffffff", { opacity: 0.55, depthWrite: false }),
  );
  shine.position.set(-0.36, 0.95, 0.44);
  shine.rotation.z = 0.05;
  shine.renderOrder = 3;
  const treats = new Kit.TreatInstances(stage, JAR_CAPACITY);
  body.add(bottom, treats.group, glass, lip, shine);
  const shadow = Kit.blobShadow(0.9);
  root.add(shadow);
  root.traverse((o) => (o.raycast = () => {}));

  const SCALE = 0.44;
  let shown = 0;
  let wob = 0;
  const pops = []; // { i, t }
  const place = (i, s = 1) => {
    const p = jarSlot(i);
    treats.set(i, { x: p.x, y: p.y, z: p.z, ry: p.ry, rz: p.rz, s: SCALE * s });
  };
  stage.onFrame((dt) => {
    if (wob > 0) {
      wob = Math.max(0, wob - dt * 1.6);
      body.rotation.z = Math.sin(wob * 18) * 0.08 * wob;
      body.scale.set(1 + 0.06 * wob, 1 - 0.05 * wob, 1 + 0.06 * wob);
    }
    if (!pops.length) return;
    for (let k = pops.length - 1; k >= 0; k--) {
      const p = pops[k];
      p.t += dt / 0.35;
      place(p.i, Kit.ease.outBack(Math.min(1, p.t)));
      if (p.t >= 1) pops.splice(k, 1);
    }
    treats.flush();
  });

  return {
    root,
    setTreat(id) {
      treats.setTreat(id);
      for (let i = 0; i < shown; i++) place(i);
      treats.flush();
    },
    // Show n treats (capped), no animation.
    fill(n) {
      shown = Math.min(JAR_CAPACITY, n);
      treats.count = shown;
      for (let i = 0; i < shown; i++) place(i);
      treats.flush();
    },
    // One more treat drops in (when full, the jar just wobbles happily).
    add() {
      wob = 1;
      if (shown >= JAR_CAPACITY) return;
      const i = shown++;
      treats.count = shown;
      place(i, 0);
      pops.push({ i, t: 0 });
      treats.flush();
    },
    wobble() {
      wob = 1;
    },
    // World point just above the jar's mouth (where flying treats go).
    mouth: () => root.localToWorld(new THREE.Vector3(0, 1.75, 0)),
  };
}

// Streak fire: a ring of toy flames around the buddy's feet.
export function createFireRing(stage) {
  const root = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.07, 10, 64),
    Kit.flat("#ff922b", { additive: true }),
  );
  ring.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.3, 64),
    Kit.flat("#ffd43b", { opacity: 0.35, additive: true }),
  );
  glow.rotation.x = -Math.PI / 2;
  const N = 18;
  const drop = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10; // 0 = bottom, 1 = tip
    const r = 0.14 * Math.sin(Math.PI * Math.min(1, k * 1.6 + 0.001)) * (1 - k * 0.55) ** 1.4;
    drop.push(new THREE.Vector2(Math.max(0.001, k > 0.62 ? r * (1 - (k - 0.62) / 0.38) : r), k * 0.55));
  }
  const flames = new THREE.InstancedMesh(
    new THREE.LatheGeometry(drop, 12),
    Kit.toon("#ffffff", { emissive: "#8a3300", rim: 1.2, rimColor: "#fff3bf" }),
    N,
  );
  const fc = ["#ff922b", "#ffd43b", "#ff6b6b"];
  for (let i = 0; i < N; i++) flames.setColorAt(i, new THREE.Color(fc[i % 3]));
  root.add(ring, glow, flames);
  root.traverse((o) => (o.raycast = () => {}));
  root.visible = false;
  let level = 0; // 0 = off; grows with the streak
  let shown = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  stage.onFrame((dt, t) => {
    shown = Kit.damp(
      shown,
      level ? Math.min(1.35, 0.8 + level * 0.08) : 0,
      8,
      dt,
    );
    root.visible = shown > 0.02;
    if (!root.visible) return;
    root.scale.setScalar(shown);
    const still = stage.reducedMotion;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (still ? 0 : t * 0.9);
      const flick = still
        ? 1
        : 0.75 + 0.35 * Math.abs(Math.sin(t * 9 + i * 1.7));
      e.set(0, -a, 0);
      q.setFromEuler(e);
      p.set(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0);
      m.compose(p, q, s.set(1, flick * (0.8 + Math.min(level, 10) * 0.05), 1));
      flames.setMatrixAt(i, m);
    }
    flames.instanceMatrix.needsUpdate = true;
    glow.material.opacity = 0.25 + 0.12 * Math.sin(t * 6);
  });
  return {
    root,
    set level(v) {
      level = v;
    },
    get level() {
      return level;
    },
  };
}
