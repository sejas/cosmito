// 3D mascots, built procedurally from primitives (no model files), with the
// SAME mood API as the 2D Mascots in shared/mascot.js:
//
//   const m = Kit.mascot(stage, "bollo");     // or Kit.buddyMascot(stage, "pipo")
//   m.object.position.set(0, 0, 0);           // stands on y = 0, faces +z
//   m.setMood("happy", 1200);                 // idle | happy | wow | think | sleep | hop
//   m.say("Wheek!", 2500);  m.mouth(0.6);  m.lookAt(vec3 | "pointer" | null);
//   m.use("pipo");  m.sound();  m.celebrate();  m.shake();
//
// Names, sounds, treats and greetings come from the 2D registry (Mascots.get).
//
// Add a 3D mascot: register3D(id, (colors) => rig), where rig is
//   { root: Object3D, body: Object3D (breathes/tilts), height, shadow,
//     eyes(mode: "open"|"happy"|"closed"), blink(k 0..1), look(x, y -1..1),
//     pupils(scale), mouth(v 0..1), limbs(angle rad, t) }
// Unknown ids fall back to a round buddy in the 2D mascot's `color`.
import * as THREE from "three";
import { toon, flat, label, blobShadow } from "./materials.js";
import { starGeometry } from "./particles.js";
import { Spring, damp, clamp } from "./motion.js";
import * as ui from "./ui.js";
import { AUDIO, MASCOTS } from "./shared.js";

const INK = "#26315c";
const geoCache = new Map();
const g = (key, make) =>
  geoCache.has(key) ? geoCache.get(key) : geoCache.set(key, make()).get(key);
const SPH = () => g("sph", () => new THREE.SphereGeometry(1, 28, 20));
const SPH_LO = () => g("sphlo", () => new THREE.SphereGeometry(1, 16, 12));

function mesh(geo, mat, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  if (typeof s === "number") m.scale.setScalar(s);
  else m.scale.set(...s);
  m.rotation.set(...r);
  m.castShadow = true;
  return m;
}

// Unit direction for latitude/longitude (radians). lon 0 = front (+z).
const dirOf = (lat, lon) =>
  new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  );

// A group sitting on the surface of an ellipsoid (center, radii), facing out.
function onSurface(center, radii, lat, lon, lift = 0) {
  const d = dirOf(lat, lon);
  const p = new THREE.Vector3(d.x * radii[0], d.y * radii[1], d.z * radii[2]);
  const n = new THREE.Vector3(
    d.x / radii[0],
    d.y / radii[1],
    d.z / radii[2],
  ).normalize();
  const grp = new THREE.Group();
  grp.position.copy(p).addScaledVector(n, lift).add(center);
  grp.lookAt(grp.position.clone().add(n));
  return grp;
}

// Sphere with painted fur patches (vertex colours, soft edges).
// regions: [{ color, mask: (dir) => 0..1 }]
function paintedSphere(base, regions, segW = 48, segH = 32) {
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const b = new THREE.Color(base);
  const rc = regions.map((r) => new THREE.Color(r.color));
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    c.copy(b);
    regions.forEach((r, k) => c.lerp(rc[k], clamp(r.mask(d))));
    c.toArray(cols, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return geo;
}
const soft = (x, a, b) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const cap = (axis, angle, feather = 0.08) => {
  const ax = new THREE.Vector3(...axis).normalize();
  const c0 = Math.cos(angle + feather);
  const c1 = Math.cos(angle - feather);
  return (d) => soft(d.dot(ax), c0, c1);
};

// Cartoon eye: sclera + pupil (+ shine), happy arc "^", closed arc "u".
function makeEye({ sclera = "#ffffff", r = 0.2, pupilR = 0.13, depth = 0.55 }) {
  const grp = new THREE.Group();
  const open = new THREE.Group();
  open.add(
    mesh(SPH(), toon(sclera, { rim: 0.15 }), { s: [r, r * 1.12, r * depth] }),
  );
  const pupil = new THREE.Group();
  pupil.position.z = r * depth * 0.62;
  pupil.add(
    mesh(SPH(), toon(INK, { rim: 0.25, rimColor: "#8aa0ff" }), {
      s: [pupilR, pupilR * 1.1, pupilR * 0.55],
    }),
  );
  pupil.add(
    mesh(SPH_LO(), flat("#ffffff"), {
      p: [pupilR * 0.38, pupilR * 0.45, pupilR * 0.5],
      s: pupilR * 0.34,
    }),
  );
  pupil.add(
    mesh(SPH_LO(), flat("#ffffff"), {
      p: [-pupilR * 0.35, -pupilR * 0.4, pupilR * 0.48],
      s: pupilR * 0.15,
    }),
  );
  open.add(pupil);
  const arc = g(
    `arc${r}`,
    () => new THREE.TorusGeometry(r * 0.72, r * 0.2, 8, 20, Math.PI),
  );
  const happy = mesh(arc, toon(INK, { rim: 0.1 }), {
    p: [0, -r * 0.3, r * 0.3],
  });
  const closed = mesh(arc, toon(INK, { rim: 0.1 }), {
    p: [0, r * 0.25, r * 0.3],
    r: [0, 0, Math.PI],
  });
  happy.visible = closed.visible = false;
  grp.add(open, happy, closed);
  return { grp, open, happy, closed, pupil, r };
}

function eyeControls(eyes) {
  return {
    eyes(mode) {
      for (const e of eyes) {
        e.open.visible = mode === "open";
        e.happy.visible = mode === "happy";
        e.closed.visible = mode === "closed";
      }
    },
    blink(k) {
      for (const e of eyes) e.open.scale.y = Math.max(0.08, 1 - k);
    },
    look(x, y) {
      for (const e of eyes)
        e.pupil.position.set(x * e.r * 0.32, y * e.r * 0.3, e.pupil.position.z);
    },
    pupils(s) {
      for (const e of eyes) e.pupil.scale.setScalar(s);
    },
  };
}

// ---------------------------------------------------------------- Pipo
function buildPipo() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const C = new THREE.Vector3(0, 1.02, 0);
  const R = [1, 0.97, 0.98];
  const YEL = "#ffd23f";
  const ORANGE = "#ffb627";
  const bodyGeo = g("pipoBody", () =>
    paintedSphere(YEL, [
      { color: "#fff3c4", mask: cap([0, -0.62, 0.78], 0.62, 0.1) },
      { color: "#ffe066", mask: cap([-0.3, 0.8, 0.5], 0.35, 0.3) }, // sunny top highlight
    ]),
  );
  body.add(
    mesh(
      bodyGeo,
      toon("#ffffff", { vertexColors: true, rim: 0.45, rimColor: "#fff6d0" }),
      { p: C.toArray(), s: R },
    ),
  );

  // tuft
  const tuft = new THREE.Group();
  tuft.position.set(0, C.y + R[1] - 0.04, 0.05);
  const cg = g("tuftCap", () => new THREE.CapsuleGeometry(0.075, 0.26, 6, 12));
  [
    [-0.12, -0.55, 0.26],
    [0.02, 0.05, 0.32],
    [0.15, 0.6, 0.22],
  ].forEach(([x, rz, h]) =>
    tuft.add(
      mesh(cg, toon(ORANGE), {
        p: [x, h * 0.55, 0],
        r: [0.25, 0, rz],
        s: [1, h / 0.26, 1],
      }),
    ),
  );
  body.add(tuft);

  // face
  const eyes = [-1, 1].map((side) => {
    const e = makeEye({ r: 0.2, pupilR: 0.13 });
    const at = onSurface(C, R, 0.22, side * 0.36, -0.02);
    at.add(e.grp);
    body.add(at);
    return e;
  });
  const cheekGeo = g("cheek", () => new THREE.CircleGeometry(0.13, 20));
  [-1, 1].forEach((side) => {
    const at = onSurface(C, R, -0.08, side * 0.66, 0.012);
    at.add(
      mesh(cheekGeo, flat("#ff8fab", { opacity: 0.7 }), { s: [1, 0.62, 1] }),
    );
    body.add(at);
  });
  const beak = onSurface(C, R, -0.02, 0, -0.02);
  const cone = g("beakCone", () => new THREE.ConeGeometry(0.17, 0.3, 20));
  const upper = mesh(cone, toon("#f79222", { rim: 0.3 }), {
    p: [0, 0.02, 0.12],
    r: [Math.PI / 2, 0, 0],
    s: [1, 1, 0.62],
  });
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.03, 0.02);
  jaw.add(
    mesh(cone, toon("#e0701a"), {
      p: [0, -0.05, 0.08],
      r: [Math.PI / 2, 0, 0],
      s: [0.78, 0.7, 0.45],
    }),
  );
  const inner = mesh(SPH_LO(), flat("#8a2d1b"), {
    p: [0, -0.04, 0.02],
    s: [0.1, 0.07, 0.06],
  });
  beak.add(inner, upper, jaw);
  body.add(beak);

  // wings (the limbs)
  const wings = [-1, 1].map((side) => {
    const pivot = onSurface(C, R, 0.12, side * 1.42, -0.1);
    pivot.lookAt(pivot.position.clone().add(new THREE.Vector3(0, 0, 1))); // keep upright
    const w = mesh(SPH(), toon(ORANGE, { rim: 0.4 }), {
      p: [side * 0.05, -0.3, 0],
      s: [0.15, 0.42, 0.3],
    });
    pivot.add(w);
    body.add(pivot);
    return { pivot, side };
  });

  // feet
  const toe = g("toe", () => new THREE.CapsuleGeometry(0.05, 0.14, 4, 8));
  [-1, 1].forEach((side) => {
    const foot = new THREE.Group();
    foot.position.set(side * 0.38, 0.06, 0.42);
    [-0.45, 0, 0.45].forEach((a) =>
      foot.add(
        mesh(toe, toon("#f08a24"), {
          p: [Math.sin(a) * 0.09, 0, Math.cos(a) * 0.09],
          r: [Math.PI / 2, 0, -a],
        }),
      ),
    );
    root.add(foot);
  });

  return {
    root,
    body,
    height: 2.3,
    shadow: 1.1,
    ...eyeControls(eyes),
    mouth(v) {
      jaw.rotation.x = v * 0.6;
      upper.rotation.x = Math.PI / 2 - v * 0.15;
      inner.scale.y = 0.05 + v * 0.1;
    },
    limbs(a) {
      for (const w of wings) w.pivot.rotation.z = w.side * (0.12 + a);
    },
  };
}

// --------------------------------------------------------------- Bollo
function buildBollo() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const C = new THREE.Vector3(0, 0.92, 0);
  const R = [1.16, 0.9, 1.04];
  const BROWN = "#a8652f";
  const DARK = "#7a4420";
  const CREAM = "#fffaf3";
  const bodyGeo = g("bolloBody", () =>
    paintedSphere(BROWN, [
      { color: "#b97440", mask: cap([-0.3, 0.8, 0.5], 0.4, 0.35) },
      {
        color: CREAM,
        mask: (d) =>
          soft(0.11 - Math.abs(d.x), -0.03, 0.03) *
          soft(d.z, 0.25, 0.4) *
          soft(d.y, -0.2, 0),
      },
      { color: CREAM, mask: cap([0, -0.28, 1], 0.42, 0.08) },
      { color: CREAM, mask: cap([0, -0.85, 0.55], 0.62, 0.1) },
    ]),
  );
  body.add(
    mesh(
      bodyGeo,
      toon("#ffffff", { vertexColors: true, rim: 0.4, rimColor: "#ffe6cc" }),
      { p: C.toArray(), s: R },
    ),
  );

  // fluffy side tufts and cream head tuft
  const tuftGeo = g("furTuft", () => new THREE.ConeGeometry(0.12, 0.3, 10));
  [-1, 1].forEach((side) => {
    [-0.35, -0.08].forEach((lat, i) => {
      const at = onSurface(C, R, lat, side * 1.5, -0.08);
      at.add(
        mesh(tuftGeo, toon(BROWN), {
          p: [0, 0, 0.1],
          r: [Math.PI / 2, 0, 0],
          s: [1, 1 - i * 0.2, 1],
        }),
      );
      body.add(at);
    });
  });
  const tuft = new THREE.Group();
  tuft.position.set(0, C.y + R[1] - 0.03, 0.18);
  [
    [-0.09, 0, 0.1],
    [0.06, 0.05, 0.12],
    [0, 0.1, 0.09],
  ].forEach(([x, y, s]) =>
    tuft.add(mesh(SPH_LO(), toon(CREAM), { p: [x, y, 0], s })),
  );
  body.add(tuft);

  // ears (the limbs): droopy, dark with pink insides
  const ears = [-1, 1].map((side) => {
    const pivot = onSurface(C, R, 0.58, side * 0.95, -0.05);
    pivot.lookAt(
      pivot.position.clone().add(new THREE.Vector3(side * 0.35, 0.1, 1)),
    );
    const ear = new THREE.Group();
    ear.position.set(side * 0.22, -0.02, 0);
    ear.rotation.z = side * -0.45;
    ear.add(mesh(SPH(), toon(DARK, { rim: 0.35 }), { s: [0.3, 0.19, 0.08] }));
    ear.add(
      mesh(SPH(), toon("#f4a3ae", { rim: 0.2 }), {
        p: [side * 0.02, -0.01, 0.045],
        s: [0.2, 0.11, 0.05],
      }),
    );
    const flap = new THREE.Group();
    flap.add(ear);
    pivot.add(flap);
    body.add(pivot);
    return { pivot: flap, side };
  });

  // face
  const eyes = [-1, 1].map((side) => {
    const e = makeEye({ sclera: CREAM, r: 0.17, pupilR: 0.145, depth: 0.5 });
    const at = onSurface(C, R, 0.2, side * 0.5, -0.015);
    at.add(e.grp);
    body.add(at);
    return e;
  });
  const cheekGeo = g("cheek", () => new THREE.CircleGeometry(0.13, 20));
  [-1, 1].forEach((side) => {
    const at = onSurface(C, R, -0.14, side * 0.72, 0.012);
    at.add(
      mesh(cheekGeo, flat("#ff9fb5", { opacity: 0.75 }), { s: [1, 0.62, 1] }),
    );
    body.add(at);
  });
  const snout = onSurface(C, R, -0.08, 0, 0);
  snout.add(
    mesh(SPH(), toon("#ff8fab", { rim: 0.4 }), {
      p: [0, 0, 0.02],
      s: [0.11, 0.075, 0.07],
    }),
  );
  const mouthAt = new THREE.Group();
  mouthAt.position.set(0, -0.2, -0.03);
  const teeth = new THREE.Group();
  const tooth = g("tooth", () => new THREE.CapsuleGeometry(0.025, 0.05, 4, 8));
  teeth.add(
    mesh(tooth, toon("#ffffff"), { p: [-0.028, 0.04, 0.04] }),
    mesh(tooth, toon("#ffffff"), { p: [0.028, 0.04, 0.04] }),
  );
  const mouthIn = mesh(SPH_LO(), flat("#8a2d1b"), {
    p: [0, 0, 0.01],
    s: [0.075, 0.02, 0.04],
  });
  mouthAt.add(mouthIn, teeth);
  snout.add(mouthAt);
  // whiskers
  const wg = g(
    "whisker",
    () => new THREE.CylinderGeometry(0.007, 0.004, 0.42, 4),
  );
  [-1, 1].forEach((side) => {
    [-0.05, 0.1].forEach((tiltZ) => {
      const w = mesh(wg, flat("#f6e7d6"), {
        p: [side * 0.3, -0.07 - tiltZ * 0.3, -0.02],
        r: [0, side * 0.35, Math.PI / 2 + side * tiltZ],
      });
      w.castShadow = false;
      snout.add(w);
    });
  });
  body.add(snout);

  // paws
  [-1, 1].forEach((side) => {
    root.add(
      mesh(SPH_LO(), toon(CREAM), {
        p: [side * 0.33, 0.07, 0.8],
        s: [0.14, 0.08, 0.16],
      }),
    );
    root.add(
      mesh(SPH_LO(), toon(CREAM), {
        p: [side * 0.74, 0.06, 0.3],
        s: [0.15, 0.08, 0.2],
      }),
    );
  });

  return {
    root,
    body,
    height: 1.95,
    shadow: 1.35,
    ...eyeControls(eyes),
    mouth(v) {
      mouthIn.scale.y = 0.02 + v * 0.08;
      mouthIn.position.y = -v * 0.04;
    },
    limbs(a) {
      for (const e of ears) e.pivot.rotation.z = e.side * a * 0.6;
    },
  };
}

// Fallback for mascots that only exist in 2D: a round buddy in their colour.
function buildGeneric(color = "#9ad") {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const C = new THREE.Vector3(0, 1, 0);
  const R = [1, 0.98, 0.95];
  body.add(mesh(SPH(), toon(color, { rim: 0.4 }), { p: C.toArray(), s: R }));
  const eyes = [-1, 1].map((side) => {
    const e = makeEye({});
    const at = onSurface(C, R, 0.18, side * 0.36, -0.02);
    at.add(e.grp);
    body.add(at);
    return e;
  });
  const m = onSurface(C, R, -0.15, 0, 0);
  const mouthIn = mesh(SPH_LO(), flat("#8a2d1b"), { s: [0.1, 0.03, 0.04] });
  m.add(mouthIn);
  body.add(m);
  return {
    root,
    body,
    height: 2.1,
    shadow: 1.1,
    ...eyeControls(eyes),
    mouth: (v) => (mouthIn.scale.y = 0.03 + v * 0.08),
    limbs() {},
  };
}

const BUILDERS = { pipo: buildPipo, bollo: buildBollo };
export function register3D(id, builder) {
  BUILDERS[id] = builder;
}
export function buildModel(id) {
  const def = MASCOTS()?.get(id);
  return (BUILDERS[id] || (() => buildGeneric(def?.color)))();
}

// ------------------------------------------------------------ Mascot3D
const MOODS = ["idle", "happy", "wow", "think", "sleep", "hop"];

export class Mascot3D {
  constructor(
    stage,
    id = "pipo",
    { scale = 1, bubble = true, followBuddy = false, fallbackId = id } = {},
  ) {
    this.stage = stage;
    this.object = new THREE.Group(); // position/rotate this
    this.object.scale.setScalar(scale);
    this.holder = new THREE.Group(); // hops and squashes
    this.object.add(this.holder);
    this.mood = "idle";
    this.base = "idle";
    this.moodTimer = 0;
    this.sayTimer = 0;
    this.target = null;
    this.userMouth = 0;
    this.moodStart = 0;
    this.nextBlink = 1.5;
    this.blinkT = -1;
    this.wander = { x: 0, y: 0, next: 2 };
    this.s = {
      hop: 0,
      tilt: 0,
      lean: 0,
      flap: 0,
      pupil: 1,
      yaw: 0,
      lookX: 0,
      lookY: 0,
      eyeScale: 1,
      shakeT: -1,
    };
    this.squash = new Spring(1, { stiffness: 380, damping: 11 });
    this.lastHopPhase = 0;
    stage.scene.add(this.object);
    this.buildDecor();
    this.use(id, { pop: false });
    if (bubble) {
      this.bubbleEl = ui.bubble();
      this.bubbleText = document.createElement("span");
      this.bubbleEl.appendChild(this.bubbleText);
      this.bubblePin = stage.pin(this.bubbleEl, this.anchor, {
        align: "bottom",
      });
    }
    if (followBuddy && MASCOTS()) {
      MASCOTS().onBuddyChange((nid) => this.use(nid));
    }
    this.unsub = stage.onFrame((dt, t) => this.update(dt, t));
  }

  get def() {
    return MASCOTS()?.get(this.id) || { id: this.id, sound: "chirp" };
  }

  buildDecor() {
    // sparkles (happy/wow), Zzz (sleep), thought dots (think)
    this.sparkles = new THREE.Group();
    const sg = starGeometry(0.1);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(sg, flat(i % 2 ? "#fff7b0" : "#ffffff"));
      m.userData.phase = (i / 5) * Math.PI * 2;
      this.sparkles.add(m);
    }
    this.zzz = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const z = label("Z", {
        size: 0.34 - i * 0.05,
        color: "#ffffff",
        outline: INK,
      });
      z.userData.phase = i / 3;
      this.zzz.add(z);
    }
    this.dots = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(
        SPH_LO(),
        toon("#ffffff", { rim: 0.6, rimColor: "#b197fc" }),
      );
      d.scale.setScalar(0.06 + i * 0.03);
      d.position.set(i * 0.2, i * 0.22, 0);
      this.dots.add(d);
    }
    this.anchor = new THREE.Object3D();
    this.holder.add(this.sparkles, this.zzz, this.dots, this.anchor);
    this.shadow = blobShadow(1);
    this.object.add(this.shadow);
  }

  // Swap to another mascot in place (keeps mood, bubble and position).
  use(id, { pop = true } = {}) {
    if (this.model) this.holder.remove(this.model.root);
    this.id = id;
    this.model = buildModel(id);
    this.holder.add(this.model.root);
    const h = this.model.height;
    this.anchor.position.set(0, h + 0.15, 0);
    this.sparkles.position.set(0, h * 0.6, 0);
    this.zzz.position.set(0.55, h * 0.85, 0.2);
    this.dots.position.set(0.7, h * 0.95, 0.2);
    this.shadow.scale.setScalar(this.model.shadow);
    this.apply(this.mood, true);
    if (pop) {
      this.squash.value = 0.4;
      this.squash.kick(6);
      const p = new THREE.Vector3(0, h * 0.5, 0);
      this.object.localToWorld(p);
      this.stage.burst(p, {
        shape: "dot",
        count: 18,
        speed: 3,
        up: 1.5,
        colors: [
          "#ffffff",
          MASCOTS()?.get(id)?.color || "#ffd23f",
          "#b197fc",
        ],
      });
    }
  }

  // Permanent mood (ms omitted) or temporary mood that returns to the base mood.
  setMood(mood, ms) {
    if (!MOODS.includes(mood)) return;
    clearTimeout(this.moodTimer);
    this.moodTimer = 0;
    if (!ms) this.base = mood;
    this.apply(mood);
    if (ms) this.moodTimer = setTimeout(() => this.apply(this.base), ms);
  }
  setBase(mood) {
    if (this.base === mood) return;
    this.base = mood;
    if (!this.moodTimer || this.mood === this.base) this.apply(mood);
  }
  apply(mood, force = false) {
    if (mood === this.mood && !force) return;
    this.mood = mood;
    this.moodStart = this.stage.time;
    if (mood === this.base) this.moodTimer = 0;
    this.model.eyes(
      mood === "happy" ? "happy" : mood === "sleep" ? "closed" : "open",
    );
    this.sparkles.visible = mood === "happy" || mood === "wow";
    this.zzz.visible = mood === "sleep";
    this.dots.visible = mood === "think";
  }

  say(text, ms = 2600) {
    if (!this.bubbleEl) return;
    clearTimeout(this.sayTimer);
    this.bubbleText.textContent = text;
    this.bubbleEl.classList.add("show");
    if (ms) this.sayTimer = setTimeout(() => this.hush(), ms);
  }
  hush() {
    this.bubbleEl?.classList.remove("show");
  }
  mouth(v) {
    this.userMouth = clamp(v);
  }
  // Vector3 (world) | "pointer" | null (wander)
  lookAt(target) {
    this.target = target;
  }
  sound() {
    AUDIO()?.sfx(this.def.sound || "chirp");
  }
  // Happy hop + sound + star burst: the standard "well done!".
  celebrate(ms = 1400) {
    this.setMood("happy", ms);
    this.sound();
    const p = this.anchor.getWorldPosition(new THREE.Vector3());
    this.stage.burst(p, { shape: "star", count: 20 });
  }
  // Gentle "no no" head shake for a wrong answer (never scary).
  shake() {
    this.s.shakeT = 0;
  }
  dispose() {
    this.unsub();
    this.bubblePin?.remove();
    this.stage.scene.remove(this.object);
  }

  update(dt, t) {
    const s = this.s;
    const m = this.model;
    const reduced = this.stage.reducedMotion;
    const mood = this.mood;
    const since = t - this.moodStart;

    // hops
    let hop = 0;
    let phase = 0;
    if (mood === "happy") {
      phase = (since * 2) % 1;
      hop = Math.sin(phase * Math.PI) * 0.36;
    } else if (mood === "hop" && since < 0.4) {
      phase = since / 0.4;
      hop = Math.sin(phase * Math.PI) * 0.4;
    } else if (mood === "wow" && since < 1.2) {
      phase = (since / 0.6) % 1;
      hop = Math.sin(phase * Math.PI) * 0.28;
    }
    if (reduced) hop *= 0.3;
    if (phase < this.lastHopPhase || (hop === 0 && s.hop > 0.02))
      this.squash.kick(-2.5); // landing
    this.lastHopPhase = phase;
    s.hop = hop;
    this.squash.target = hop > 0 ? 1 + 0.08 * Math.cos(phase * Math.PI) : 1;
    const sq = this.squash.step(dt);
    this.holder.position.y = hop;
    this.holder.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.shadow.material.opacity = 1 - hop * 1.4;
    this.shadow.scale.setScalar(m.shadow * (1 - hop * 0.5));

    // breathing
    const sleep = mood === "sleep";
    const br = Math.sin(t * (sleep ? 1.3 : 2.2)) * (sleep ? 0.04 : 0.022);
    m.body.scale.set(1 - br * 0.5, 1 + br, 1 - br * 0.5);

    // tilt / lean / shake
    let tilt = 0;
    if (mood === "think") tilt = -0.14 + Math.sin(t * 2) * 0.06;
    if (sleep) tilt = 0.12;
    s.tilt = damp(s.tilt, reduced ? tilt * 0.5 : tilt, 6, dt);
    let shake = 0;
    if (s.shakeT >= 0) {
      s.shakeT += dt;
      shake = Math.sin(s.shakeT * 22) * 0.18 * Math.max(0, 1 - s.shakeT / 0.7);
      if (s.shakeT > 0.7) s.shakeT = -1;
    }
    m.body.rotation.z = s.tilt;
    m.body.rotation.x = damp(m.body.rotation.x, sleep ? 0.12 : 0, 4, dt);

    // look: target -> local direction
    let lx = 0;
    let ly = 0;
    let tgt = this.target;
    if (tgt === "pointer")
      tgt = this.stage.pointerActive
        ? this.stage.pointerOnPlane(this.object.position.y + 1.2)
        : null;
    if (tgt && tgt.isVector3) {
      const local = this.object.worldToLocal(tgt.clone());
      local.y -= m.height * 0.6;
      const yaw = Math.atan2(local.x, Math.max(0.3, local.z));
      lx = clamp(yaw / 0.8, -1, 1);
      ly = clamp(local.y / Math.max(1, Math.hypot(local.x, local.z)), -1, 1);
    } else {
      if (t > this.wander.next) {
        this.wander.x = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 1.4;
        this.wander.y = (Math.random() - 0.5) * 0.6;
        this.wander.next = t + 1.5 + Math.random() * 3;
      }
      lx = this.wander.x;
      ly = this.wander.y;
    }
    if (mood === "think") {
      lx = -0.6;
      ly = 0.8;
    }
    s.lookX = damp(s.lookX, lx, 10, dt);
    s.lookY = damp(s.lookY, ly, 10, dt);
    m.look(s.lookX, s.lookY);
    s.yaw = damp(s.yaw, s.lookX * (reduced ? 0.1 : 0.35), 5, dt);
    m.body.rotation.y = s.yaw + shake;

    // eyes: blink, wow pupils
    if (t > this.nextBlink && this.blinkT < 0) this.blinkT = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const k =
        this.blinkT < 0.07
          ? this.blinkT / 0.07
          : 1 - (this.blinkT - 0.07) / 0.08;
      m.blink(clamp(k));
      if (this.blinkT > 0.15) {
        this.blinkT = -1;
        m.blink(0);
        this.nextBlink = t + 2.2 + Math.random() * 3.5;
      }
    }
    s.pupil = damp(s.pupil, mood === "wow" ? 1.3 : 1, 12, dt);
    m.pupils(s.pupil);

    // limbs
    let flap = Math.sin(t * 1.6) * 0.04;
    if (mood === "happy") flap = 0.25 + Math.sin(t * 26) * 0.35;
    if (mood === "wow") flap = 0.35;
    if (sleep) flap = -0.05;
    s.flap = mood === "happy" ? flap : damp(s.flap, flap, 10, dt);
    m.limbs(s.flap, t);

    // mouth: user control, or a little "o" for wow
    const moodMouth = mood === "wow" ? 0.55 : mood === "happy" ? 0.35 : 0;
    m.mouth(Math.max(this.userMouth, moodMouth));

    // decorations
    if (this.sparkles.visible) {
      this.sparkles.children.forEach((sp, i) => {
        const a = sp.userData.phase + t * 1.2;
        const rr = m.height * 0.62;
        sp.position.set(
          Math.cos(a) * rr,
          Math.sin(a * 2 + i) * 0.25 + 0.4,
          Math.sin(a) * rr * 0.5 + 0.2,
        );
        sp.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(t * 4 + i)));
        sp.rotation.z = t * 2 + i;
      });
    }
    if (this.zzz.visible) {
      this.zzz.children.forEach((z) => {
        const k = (t * 0.35 + z.userData.phase) % 1;
        z.position.set(k * 0.5, k * 0.9, 0);
        z.material.opacity = Math.sin(k * Math.PI);
      });
    }
    if (this.dots.visible) {
      this.dots.children.forEach((d, i) => {
        d.position.y = i * 0.22 + Math.sin(t * 3 - i) * 0.04;
      });
    }
  }
}

export const mascot = (stage, id, opts) => new Mascot3D(stage, id, opts);
// The player's chosen buddy (or `fallbackId`), swapping when the buddy changes.
export const buddyMascot = (stage, fallbackId = "pipo", opts = {}) =>
  new Mascot3D(
    stage,
    MASCOTS() ? MASCOTS().buddy(fallbackId) : fallbackId,
    { followBuddy: true, ...opts },
  );
