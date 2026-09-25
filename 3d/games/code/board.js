// A level as a toy diorama: a floating slab with grass tiles, rippling water,
// rocks and trees as props, spinning gems, glowing magic pads, the start pad
// and the buddy's treat on the goal tile. Everything repeated is instanced.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { TILE, cellToWorld, seeded } from "./logic.js";

const TOP = 0.1; // y of the walkable tile surface
export const PAD_COLORS = { y: "#ffd43b", p: "#f783c4" };
const GRASS = ["#8fe07a", "#7ad168"];

// ---------- shared geometries / materials (built once, reused per level) ----
const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

function roundedRect(w, h, r) {
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

// A soft rounded slab lying flat, top face at y = 0, `depth` thick.
function slabGeometry(w, h, r, depth, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(
    roundedRect(w - bevel * 2, h - bevel * 2, r),
    {
      depth: depth - bevel * 2,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      curveSegments: 6,
    },
  );
  g.rotateX(-Math.PI / 2); // extrusion now points up (+y)
  g.translate(0, -depth + bevel, 0);
  g.computeVertexNormals();
  return g;
}

const tileGeo = () =>
  once("tile", () => slabGeometry(TILE * 0.95, TILE * 0.95, 0.16, 0.26, 0.06));
const rockGeo = () =>
  once("rock", () => {
    const g = new THREE.IcosahedronGeometry(0.3, 1);
    const p = g.attributes.position;
    const r = seeded(3);
    for (let i = 0; i < p.count; i++) {
      const k = 0.9 + r() * 0.18;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  });
const canopyGeo = () =>
  once("canopy", () => new THREE.IcosahedronGeometry(0.3, 2));
const trunkGeo = () =>
  once("trunk", () => new THREE.CylinderGeometry(0.06, 0.09, 0.4, 8));
const gemGeo = () =>
  once("gem", () => {
    const g = new THREE.OctahedronGeometry(0.19, 0);
    g.scale(1, 1.35, 1);
    return g;
  });
const dotGeo = () =>
  once("dot", () => new THREE.CircleGeometry(0.1, 16).rotateX(-Math.PI / 2));
const flowerGeo = () =>
  once("flower", () => new THREE.SphereGeometry(0.05, 8, 6));
const ringGeo = () =>
  once("ring", () =>
    new THREE.TorusGeometry(0.36, 0.04, 8, 40).rotateX(Math.PI / 2),
  );
const discGeo = () =>
  once("disc", () => new THREE.CircleGeometry(0.34, 40).rotateX(-Math.PI / 2));

const padHolo = (c) =>
  once(`holo-${c}`, () => Kit.holo(c, { opacity: 0.95, swirl: 0.8 }));

// Water: gentle waves and sparkles, one draw call for the whole pond.
let waterMat = null;
function water() {
  if (waterMat) return waterMat;
  waterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += sin(w.x * 2.4 + uTime * 1.7) * 0.022 + cos(w.z * 2.9 + uTime * 1.3) * 0.022;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime; varying vec3 vW;
      void main() {
        float n = sin(vW.x * 3.1 + uTime * 0.9) * 0.5 + sin(vW.z * 2.3 - uTime * 0.7) * 0.5;
        vec3 deep = vec3(0.13, 0.48, 0.93);
        vec3 light = vec3(0.30, 0.68, 1.0);
        vec3 c = mix(deep, light, 0.5 + 0.35 * n);
        float s = sin(vW.x * 6.0 + sin(vW.z * 4.0 + uTime * 1.1) * 1.6 + uTime * 1.4);
        c += vec3(1.0) * smoothstep(0.93, 1.0, s) * 0.55;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return waterMat;
}

// Gradient the slab: world colour on the rim, peach -> lavender underneath.
function paintSlab(geo, rim) {
  const p = geo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const top = new THREE.Color(rim).lerp(new THREE.Color("#ffffff"), 0.25);
  const mid = new THREE.Color("#ffd0b5");
  const bot = new THREE.Color("#b9a4ff");
  let minY = Infinity;
  for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
  for (let i = 0; i < p.count; i++) {
    const k = Math.min(1, Math.max(0, p.getY(i) / minY)); // 0 top .. 1 bottom
    if (k < 0.18) c.copy(top);
    else if (k < 0.55) c.copy(top).lerp(mid, (k - 0.18) / 0.37);
    else c.copy(mid).lerp(bot, (k - 0.55) / 0.45);
    c.toArray(cols, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
}

export function createBoard(stage, { world, level, color, buddyId }) {
  const { w, h } = world;
  const root = new THREE.Group();
  const rnd = seeded(level.world * 97 + level.num * 13 + 5);
  const pos = (x, y, lift = TOP) => {
    const [wx, wz] = cellToWorld(x, y, w, h);
    return new THREE.Vector3(wx, lift, wz);
  };
  const frameFns = [];
  const onFrame = (fn) => frameFns.push(fn);

  // --- slab + underside --------------------------------------------------
  const W = w * TILE + 0.7;
  const H = h * TILE + 0.7;
  const slabGeo = slabGeometry(W, H, 0.5, 0.55, 0.14);
  paintSlab(slabGeo, color);
  const slab = new THREE.Mesh(
    slabGeo,
    Kit.toon("#ffffff", { vertexColors: true, rim: 0.35, rimColor: "#fff0f6" }),
  );
  slab.position.y = -0.1;
  slab.receiveShadow = true;
  root.add(slab);
  const under = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 0.25, 1, 28, 1),
    Kit.toon("#c3b1ff", { rim: 0.5, rimColor: "#ffe3f1" }),
  );
  under.scale.set(
    W * 0.42,
    Math.min(2.4, 0.9 + Math.max(w, h) * 0.22),
    H * 0.42,
  );
  under.position.y = -0.62 - under.scale.y / 2;
  root.add(under);

  // --- water: one pond under the whole board ----------------------------
  const pond = new THREE.Mesh(
    new THREE.PlaneGeometry(
      w * TILE + 0.3,
      h * TILE + 0.3,
      w * 6,
      h * 6,
    ).rotateX(-Math.PI / 2),
    water(),
  );
  pond.position.y = -0.06;
  root.add(pond);

  // --- land tiles (everything but water) ---------------------------------
  const land = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (world.tiles[y][x] !== "~") land.push({ x, y });
  const tiles = new THREE.InstancedMesh(
    tileGeo(),
    Kit.toon("#ffffff", { rim: 0.18, rimColor: "#f4fce3" }),
    land.length,
  );
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  land.forEach(({ x, y }, i) => {
    m4.makeTranslation(pos(x, y, TOP));
    tiles.setMatrixAt(i, m4);
    tiles.setColorAt(i, col.set(GRASS[(x + y) % 2]));
  });
  tiles.receiveShadow = true;
  root.add(tiles);

  // --- props: rocks and trees (instanced, each can wobble on a bump) -----
  const cellsOf = (ch) => land.filter(({ x, y }) => world.tiles[y][x] === ch);
  const rocks = cellsOf("#");
  const trees = cellsOf("^");
  const rockMesh = new THREE.InstancedMesh(
    rockGeo(),
    Kit.toon("#b4bddb", { rim: 0.45, rimColor: "#eef0ff" }),
    Math.max(1, rocks.length * 2),
  );
  const trunkMesh = new THREE.InstancedMesh(
    trunkGeo(),
    Kit.toon("#c08457"),
    Math.max(1, trees.length),
  );
  const canopyMesh = new THREE.InstancedMesh(
    canopyGeo(),
    Kit.toon("#ffffff", { rim: 0.25 }),
    Math.max(1, trees.length * 2),
  );
  rockMesh.count = rocks.length * 2;
  trunkMesh.count = trees.length;
  canopyMesh.count = trees.length * 2;
  rockMesh.castShadow = trunkMesh.castShadow = canopyMesh.castShadow = true;
  const props = new Map(); // "x,y" -> { place(tilt, lean) }
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  // Compose a matrix: position p + local offset o, rotated by a tilt about the prop base.
  const placeAt = (mesh, idx, base, off, s, spin, tilt) => {
    e.set(tilt.x, spin, tilt.z);
    q.setFromEuler(e);
    v.copy(off).applyQuaternion(q).add(base);
    sc.set(s[0], s[1], s[2]);
    m4.compose(v, q, sc);
    mesh.setMatrixAt(idx, m4);
    mesh.instanceMatrix.needsUpdate = true;
  };
  rocks.forEach(({ x, y }, i) => {
    const base = pos(x, y, TOP);
    const spin = rnd() * 6;
    const big = 1 + rnd() * 0.15;
    const place = (tilt) => {
      placeAt(
        rockMesh,
        i * 2,
        base,
        new THREE.Vector3(-0.06, 0.2, 0.02),
        [big, big, big],
        spin,
        tilt,
      );
      placeAt(
        rockMesh,
        i * 2 + 1,
        base,
        new THREE.Vector3(0.24, 0.1, 0.18),
        [0.45, 0.45, 0.45],
        spin + 1,
        tilt,
      );
    };
    place({ x: 0, z: 0 });
    props.set(`${x},${y}`, { place });
  });
  const leaf = ["#51cf66", "#69db7c", "#38d9a9", "#8ce99a"];
  trees.forEach(({ x, y }, i) => {
    const base = pos(x, y, TOP);
    const s = 0.95 + rnd() * 0.2;
    const spin = rnd() * 6;
    canopyMesh.setColorAt(i * 2, col.set(leaf[i % leaf.length]));
    canopyMesh.setColorAt(i * 2 + 1, col.set(leaf[(i + 1) % leaf.length]));
    const place = (tilt) => {
      placeAt(
        trunkMesh,
        i,
        base,
        new THREE.Vector3(0, 0.2 * s, 0),
        [s, s, s],
        spin,
        tilt,
      );
      placeAt(
        canopyMesh,
        i * 2,
        base,
        new THREE.Vector3(0, 0.52 * s, 0),
        [1.0 * s, 1.0 * s, 1.0 * s],
        spin,
        tilt,
      );
      placeAt(
        canopyMesh,
        i * 2 + 1,
        base,
        new THREE.Vector3(0.04, 0.8 * s, 0.02),
        [0.66 * s, 0.62 * s, 0.66 * s],
        spin,
        tilt,
      );
    };
    place({ x: 0, z: 0 });
    props.set(`${x},${y}`, { place });
  });
  root.add(rockMesh, trunkMesh, canopyMesh);

  // flowers on plain grass, away from the walking line in the middle of the tile
  const plain = land.filter(({ x, y }) => {
    const ch = world.tiles[y][x];
    return (
      ch === "." &&
      !(x === world.start.x && y === world.start.y) &&
      !(x === world.treat.x && y === world.treat.y) &&
      !world.gems.some((g) => g.x === x && g.y === y)
    );
  });
  const fl = [];
  plain.forEach(({ x, y }) => {
    const n = rnd() < 0.55 ? 1 + Math.floor(rnd() * 2) : 0;
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const p = pos(x, y, TOP + 0.03);
      p.x += Math.cos(a) * 0.36;
      p.z += Math.sin(a) * 0.36;
      fl.push(p);
    }
  });
  if (fl.length) {
    const flowers = new THREE.InstancedMesh(
      flowerGeo(),
      Kit.toon("#ffffff", { rim: 0.2 }),
      fl.length,
    );
    const fc = ["#ff8fab", "#ffd43b", "#ffffff", "#b197fc", "#74c0fc"];
    fl.forEach((p, i) => {
      m4.makeScale(1, 0.7, 1).setPosition(p);
      flowers.setMatrixAt(i, m4);
      flowers.setColorAt(i, col.set(fc[i % fc.length]));
    });
    flowers.raycast = () => {};
    root.add(flowers);
  }

  // --- magic pads ---------------------------------------------------------
  const pads = new Map();
  land.forEach(({ x, y }) => {
    const ch = world.tiles[y][x];
    if (!PAD_COLORS[ch]) return;
    const g = new THREE.Group();
    g.position.copy(pos(x, y, TOP + 0.012));
    const disc = new THREE.Mesh(discGeo(), padHolo(PAD_COLORS[ch]));
    const ring = new THREE.Mesh(
      ringGeo(),
      Kit.toon(PAD_COLORS[ch], {
        rim: 0.6,
        emissive: ch === "y" ? "#5a4500" : "#5a1840",
      }),
    );
    ring.position.y = 0.02;
    g.add(disc, ring);
    root.add(g);
    const pad = { g, ring, flash: 0, pass: true, phase: rnd() * 6 };
    pads.set(`${x},${y}`, pad);
  });
  onFrame((dt, t) => {
    for (const pad of pads.values()) {
      pad.flash = Math.max(0, pad.flash - dt * 1.6);
      const glow = stage.reducedMotion
        ? 0
        : Math.sin(t * 2.4 + pad.phase) * 0.04;
      const f = pad.flash;
      const s = 1 + glow + (pad.pass ? f * 0.35 : -f * 0.12);
      pad.ring.scale.set(s, 1 + f * 2, s);
      pad.ring.position.y = 0.02 + (pad.pass ? f * 0.18 : 0);
    }
  });

  // --- start pad ----------------------------------------------------------
  const startPad = new THREE.Group();
  startPad.position.copy(pos(world.start.x, world.start.y, TOP + 0.01));
  const sRing = new THREE.Mesh(ringGeo(), Kit.flat("#b197fc"));
  sRing.scale.setScalar(1.08);
  const sDisc = new THREE.Mesh(discGeo(), padHolo("#d0bfff"));
  sDisc.scale.setScalar(1.05);
  startPad.add(sDisc, sRing);
  root.add(startPad);

  // --- gems -----------------------------------------------------------------
  const gemMat = Kit.candy("#5cd6ff", "#083a5a");
  const gems = world.gems.map((gp, i) => {
    const g = new THREE.Group();
    g.position.copy(pos(gp.x, gp.y, TOP));
    const gem = new THREE.Mesh(gemGeo(), gemMat);
    gem.position.y = 0.5;
    gem.castShadow = true;
    const sh = Kit.blobShadow(0.22);
    sh.position.y = 0.02;
    g.add(gem, sh);
    root.add(g);
    return { g, gem, taken: false, k: 1, phase: i * 1.7 };
  });
  onFrame((dt, t) => {
    for (const gm of gems) {
      gm.k = Kit.damp(gm.k, gm.taken ? 0 : 1, 9, dt);
      gm.g.visible = gm.k > 0.02;
      const still = stage.reducedMotion;
      gm.gem.rotation.y = still ? 0.4 : t * 1.8 + gm.phase;
      gm.gem.position.y =
        0.5 +
        (still ? 0 : Math.sin(t * 2.6 + gm.phase) * 0.06) +
        (1 - gm.k) * 0.8;
      gm.gem.scale.setScalar(gm.k);
    }
  });

  // --- the treat on the goal tile -----------------------------------------
  const goal = new THREE.Group();
  goal.position.copy(pos(world.treat.x, world.treat.y, TOP + 0.01));
  const gRing = new THREE.Mesh(
    ringGeo(),
    Kit.toon("#ffffff", { rim: 0.8, rimColor: "#a5d8ff" }),
  );
  gRing.scale.setScalar(1.12);
  const gDisc = new THREE.Mesh(discGeo(), padHolo("#74c0fc"));
  gDisc.scale.setScalar(1.1);
  const treatHolder = new THREE.Group();
  treatHolder.position.y = 0.62;
  const treatShadow = Kit.blobShadow(0.3);
  treatShadow.position.y = 0.02;
  goal.add(gDisc, gRing, treatHolder, treatShadow);
  root.add(goal);
  // three little stars circling the treat: "this is the goal!"
  const orbit = new THREE.Group();
  orbit.position.y = 0.62;
  for (let k = 0; k < 3; k++) {
    const st = Kit.star3D("#ffd43b");
    const a = (k / 3) * Math.PI * 2;
    st.position.set(Math.cos(a) * 0.46, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.46);
    st.scale.setScalar(0.2);
    orbit.add(st);
  }
  goal.add(orbit);
  let treat = null;
  let treatK = 1;
  let treatTarget = 1;
  function setTreat(id) {
    if (treat) treatHolder.remove(treat);
    treat = Kit.treat(id);
    treat.scale.setScalar(0.62);
    treat.rotation.z = 0.25;
    treat.traverse((o) => (o.castShadow = true));
    treatHolder.add(treat);
  }
  setTreat(buddyId);
  onFrame((dt, t) => {
    treatK = Kit.damp(treatK, treatTarget, 8, dt);
    treatHolder.visible = treatK > 0.02;
    orbit.visible = treatHolder.visible;
    orbit.scale.setScalar(treatK);
    treatHolder.scale.setScalar(treatK);
    const still = stage.reducedMotion;
    treatHolder.rotation.y = still ? 0.5 : t * 1.1;
    treatHolder.position.y = 0.62 + (still ? 0 : Math.sin(t * 2) * 0.06);
    gRing.rotation.y = t * 0.5;
    orbit.rotation.y = still ? 0 : -t * 1.4;
  });

  // --- hint path: glowing dots marching along the solution ----------------
  const maxDots = w * h * 2 + 2;
  const dots = new THREE.InstancedMesh(
    dotGeo(),
    Kit.flat("#ffd43b", { opacity: 0.95 }),
    maxDots,
  );
  dots.count = 0;
  dots.renderOrder = 2;
  dots.raycast = () => {};
  dots.frustumCulled = false;
  root.add(dots);
  let dotPts = [];
  function setHintPath(cells) {
    dotPts = [];
    if (cells && cells.length > 1) {
      for (let i = 0; i < cells.length; i++) {
        const a = pos(cells[i].x, cells[i].y, TOP + 0.03);
        if (i > 0) {
          const b = pos(cells[i - 1].x, cells[i - 1].y, TOP + 0.03);
          dotPts.push({ p: a.clone().lerp(b, 0.5), k: i - 0.5, small: true });
        }
        if (i > 0) dotPts.push({ p: a, k: i, small: false });
      }
    }
    dots.count = Math.min(maxDots, dotPts.length);
  }
  onFrame((dt, t) => {
    if (!dots.count) return;
    const n = dotPts.at(-1).k + 3;
    const head = stage.reducedMotion ? n : (t * 3.2) % n;
    dotPts.forEach((d, i) => {
      if (i >= maxDots) return;
      const near = Math.max(0, 1 - Math.abs(head - d.k) / 1.5);
      const s = (d.small ? 0.6 : 1) * (0.8 + near * 0.7);
      m4.makeScale(s, 1, s).setPosition(d.p.x, d.p.y + near * 0.03, d.p.z);
      dots.setMatrixAt(i, m4);
    });
    dots.instanceMatrix.needsUpdate = true;
  });

  // --- the bug marker for a failed block ------------------------------------
  const bug = Kit.label("🐞", { size: 0.55 });
  bug.visible = false;
  bug.renderOrder = 5;
  root.add(bug);

  // --- wobble (an obstacle shakes when bumped) -------------------------------
  const wobbles = [];
  onFrame((dt) => {
    for (let i = wobbles.length - 1; i >= 0; i--) {
      const wb = wobbles[i];
      wb.t += dt;
      const k = Math.max(0, 1 - wb.t / 0.8);
      const a = Math.sin(wb.t * 24) * 0.22 * k;
      wb.prop.place({ x: wb.dz * a, z: -wb.dx * a });
      if (k <= 0) wobbles.splice(i, 1);
    }
  });

  // --- ripples (splash) -------------------------------------------------------
  const ripple = new THREE.Mesh(
    ringGeo(),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false }),
  );
  ripple.visible = false;
  root.add(ripple);
  let rippleT = -1;
  onFrame((dt) => {
    if (rippleT < 0) return;
    rippleT += dt;
    const k = rippleT / 0.9;
    ripple.scale.setScalar(0.4 + k * 1.8);
    ripple.material.opacity = 0.8 * (1 - k);
    if (k >= 1) {
      rippleT = -1;
      ripple.visible = false;
    }
  });

  // ---------------------------------------------------------------------------
  const unsub = stage.onFrame((dt, t) => {
    water().uniforms.uTime.value = t;
    for (const fn of frameFns) fn(dt, t);
  });

  return {
    root,
    world,
    pos,
    goalPos: () => goal.getWorldPosition(new THREE.Vector3()),
    setTreat,
    // treat: eaten (bursts into stars) or back
    eatTreat() {
      const p = treatHolder.getWorldPosition(new THREE.Vector3());
      stage.burst(p, { shape: "star", count: 36, speed: 4.5, up: 3 });
      stage.burst(p, {
        shape: "dot",
        count: 20,
        colors: ["#fff3bf", "#ffd43b", "#ffffff"],
        speed: 3,
      });
      treatTarget = 0;
    },
    showTreat() {
      treatTarget = 1;
    },
    takeGem(i) {
      const gm = gems[i];
      if (!gm || gm.taken) return;
      gm.taken = true;
      const p = gm.gem.getWorldPosition(new THREE.Vector3());
      stage.burst(p, {
        shape: "star",
        count: 14,
        colors: ["#5cd6ff", "#ffffff", "#b197fc"],
        speed: 3,
      });
    },
    missingGems() {
      gems.forEach((gm) => {
        if (gm.taken) return;
        gm.k = 1.8; // pop to say "you forgot me!"
      });
    },
    resetGems() {
      gems.forEach((gm) => (gm.taken = false));
    },
    flashPad(x, y, pass) {
      const pad = pads.get(`${x},${y}`);
      if (pad) {
        pad.flash = 1;
        pad.pass = pass;
        if (pass)
          stage.burst(
            pad.g.getWorldPosition(new THREE.Vector3()).setY(TOP + 0.3),
            {
              shape: "dot",
              count: 10,
              speed: 2,
              up: 3,
              colors: ["#ffffff", PAD_COLORS[world.tiles[y][x]]],
            },
          );
      }
    },
    wobble(x, y, d) {
      const prop = props.get(`${x},${y}`);
      if (!prop) return;
      const [dx, dy] = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[d];
      wobbles.push({ prop, t: 0, dx, dz: dy });
    },
    splash(x, y) {
      const p = pos(x, y, 0);
      ripple.position.set(p.x, -0.02, p.z);
      ripple.visible = true;
      rippleT = 0;
      stage.burst(p.clone().setY(0.1), {
        shape: "dot",
        count: 26,
        speed: 3.2,
        up: 4,
        colors: ["#74c0fc", "#a5d8ff", "#ffffff", "#4dabf7"],
      });
    },
    showBug(x, y) {
      bug.position.copy(pos(x, y, TOP + 1.25));
      bug.visible = true;
    },
    hideBug() {
      bug.visible = false;
    },
    setHintPath,
    dispose() {
      unsub();
      root.parent?.remove(root);
      root.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
      slabGeo.dispose();
      pond.geometry.dispose();
      under.geometry.dispose();
      bug.material.map?.dispose();
      bug.material.dispose();
    },
  };
}
