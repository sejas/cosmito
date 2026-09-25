// The floating island the buddy lives on: grass top, candy-coloured cliffs,
// instanced trees and flowers, a glowing crystal underneath, mini islands.
import * as THREE from "three";
import * as Kit from "../kit/kit.js";

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function islandMesh(radius, depth) {
  const grp = new THREE.Group();
  // grass cap: flat top with a soft rounded rim
  const top = [];
  top.push(new THREE.Vector2(0, 0.3));
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    top.push(new THREE.Vector2(radius - 0.5 + Math.sin(a) * 0.5, -0.1 + Math.cos(a) * 0.4));
  }
  top.push(new THREE.Vector2(radius - 0.05, -0.35));
  const grassGeo = new THREE.LatheGeometry(top.reverse(), 72); // bottom-to-top order = outward normals
  {
    // lighter meadow in the middle, deeper green on the rounded rim
    const gp = grassGeo.attributes.position;
    const gc = new Float32Array(gp.count * 3);
    const mid = new THREE.Color("#b8f5a0");
    const edge = new THREE.Color("#63d471");
    const lip = new THREE.Color("#40c057");
    const col = new THREE.Color();
    for (let i = 0; i < gp.count; i++) {
      const r = Math.hypot(gp.getX(i), gp.getZ(i)) / radius;
      const y = gp.getY(i);
      col.copy(mid).lerp(edge, Math.min(1, Math.max(0, (r - 0.35) / 0.55)));
      if (y < 0.25) col.lerp(lip, Math.min(1, (0.25 - y) / 0.4));
      col.toArray(gc, i * 3);
    }
    grassGeo.setAttribute("color", new THREE.BufferAttribute(gc, 3));
  }
  const grass = new THREE.Mesh(grassGeo, Kit.toon("#ffffff", { vertexColors: true, rim: 0.25, rimColor: "#e6fcf5" }));
  grass.receiveShadow = true;
  grp.add(grass);
  // cliffs: lumpy cone with a sand → peach → lavender gradient
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push(
      new THREE.Vector2(
        Math.max(
          0.01,
          (radius - 0.1) * Math.pow(1 - t, 0.8) * (1 - 0.08 * Math.sin(t * 9)),
        ),
        -0.1 - t * depth,
      ),
    );
  }
  const cliffGeo = new THREE.LatheGeometry(prof.reverse(), 48);
  const p = cliffGeo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const stops = [
    new THREE.Color("#ffd8a8"),
    new THREE.Color("#ffb3c6"),
    new THREE.Color("#b197fc"),
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const t = -v.y / depth;
    const bump =
      1 + 0.07 * Math.sin(a * 7 + t * 5) + 0.05 * Math.sin(a * 13 - t * 3);
    if (t > 0.02) p.setXYZ(i, v.x * bump, v.y, v.z * bump);
    const k = Math.min(1, t * 1.6);
    if (k < 0.5) c.copy(stops[0]).lerp(stops[1], k * 2);
    else c.copy(stops[1]).lerp(stops[2], (k - 0.5) * 2);
    c.toArray(cols, i * 3);
  }
  cliffGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  cliffGeo.computeVertexNormals();
  grp.add(
    new THREE.Mesh(
      cliffGeo,
      Kit.toon("#ffffff", {
        vertexColors: true,
        rim: 0.5,
        rimColor: "#fff0f6",
      }),
    ),
  );
  return grp;
}

export function createIsland(stage, { radius = 7.4, keepOut = [] } = {}) {
  const root = new THREE.Group();
  root.add(islandMesh(radius, 4.2));

  // landing pad where the buddy stands, and stepping stones to each portal
  const pad = new THREE.Group();
  const padTop = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.12, 48), Kit.toon("#ffffff", { rim: 0.35, rimColor: "#d0bfff" }));
  padTop.receiveShadow = true;
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 8, 64), Kit.flat("#b197fc"));
  padRing.rotation.x = Math.PI / 2;
  padRing.position.y = 0.06;
  const padGlow = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), Kit.holo("#d0bfff", { opacity: 0.5, swirl: 0.3 }));
  padGlow.rotation.x = -Math.PI / 2;
  padGlow.position.y = 0.065;
  pad.add(padTop, padRing, padGlow);
  pad.position.y = 0.3;
  root.add(pad);
  const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.26, 0.28, 0.08, 20), Kit.toon("#fff9db", { rim: 0.3 }), 80);
  stones.receiveShadow = true;
  root.add(stones);
  // paths: [{from:{x,z}, to:{x,z}}] — called by the hub whenever the layout changes
  root.userData.setPaths = (paths) => {
    const m = new THREE.Matrix4();
    let k = 0;
    for (const { from, to } of paths) {
      const d = Math.hypot(to.x - from.x, to.z - from.z);
      const n = Math.max(0, Math.floor((d - 2.4) / 0.62));
      for (let i = 1; i <= n && k < 80; i++) {
        const t = (1.5 + i * 0.62) / d;
        const wob = Math.sin(i * 1.9) * 0.08;
        m.makeScale(1 - i * 0.02, 1, 1 - i * 0.02).setPosition(from.x + (to.x - from.x) * t + wob, 0.31, from.z + (to.z - from.z) * t);
        stones.setMatrixAt(k++, m);
      }
    }
    stones.count = k;
    stones.instanceMatrix.needsUpdate = true;
  };
  root.userData.pad = pad;

  // trees and flowers, kept away from portals and the plaza
  const free = (x, z, r) =>
    Math.hypot(x, z - 2.4) > 2.4 &&
    keepOut.every((k) => Math.hypot(x - k.x, z - k.z) > r);
  const trees = [];
  for (let tries = 0; trees.length < 14 && tries < 400; tries++) {
    const a = rnd() * Math.PI * 2;
    const d = radius * (0.55 + rnd() * 0.35);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (
      free(x, z, 1.9) &&
      (z < 0.8 || (Math.abs(x) > 4.6 && z < 5)) &&
      trees.every((t) => Math.hypot(t.x - x, t.z - z) > 1.3)
    )
      trees.push({ x, z, s: 0.7 + rnd() * 0.5 });
  }
  const canopy = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.6, 2),
    Kit.toon("#ffffff", { rim: 0.45 }),
    trees.length,
  );
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.7, 8),
    Kit.toon("#c08457"),
    trees.length,
  );
  const leafCols = ["#69db7c", "#8ce99a", "#ffc9e3", "#b2f2bb", "#d0bfff"];
  const m = new THREE.Matrix4();
  trees.forEach((t, i) => {
    m.makeScale(t.s, t.s * 1.1, t.s).setPosition(t.x, 0.3 + 0.95 * t.s, t.z);
    canopy.setMatrixAt(i, m);
    canopy.setColorAt(i, new THREE.Color(leafCols[i % leafCols.length]));
    m.makeScale(t.s, t.s, t.s).setPosition(t.x, 0.3 + 0.35 * t.s, t.z);
    trunk.setMatrixAt(i, m);
  });
  canopy.castShadow = trunk.castShadow = true;
  root.add(canopy, trunk);

  const flowers = [];
  for (let tries = 0; flowers.length < 60 && tries < 800; tries++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * (radius - 0.7);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (free(x, z, 1.2)) flowers.push({ x, z });
  }
  const petals = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    Kit.toon("#ffffff", { rim: 0.3 }),
    flowers.length,
  );
  const fCols = ["#ff8fab", "#ffd43b", "#ffffff", "#b197fc", "#74c0fc"];
  flowers.forEach((f, i) => {
    m.makeScale(1, 0.6, 1).setPosition(f.x, 0.34, f.z);
    petals.setMatrixAt(i, m);
    petals.setColorAt(i, new THREE.Color(fCols[i % fCols.length]));
  });
  root.add(petals);

  // glowing crystal under the island + mini islands drifting around
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9, 0),
    Kit.holo("#74c0fc", { opacity: 0.85, swirl: 1.5 }),
  );
  crystal.scale.set(1, 1.6, 1);
  crystal.position.y = -5.2;
  root.add(crystal);
  const minis = [
    [-11, -1.5, -6, 0.22],
    [12, 0.5, -9, 0.18],
    [-8, 3.5, -14, 0.14],
    [9, -3, -3, 0.12],
  ].map(([x, y, z, s], i) => {
    const mi = islandMesh(7, 4);
    mi.scale.setScalar(s);
    mi.position.set(x, y, z);
    mi.userData = { y, i };
    root.add(mi);
    return mi;
  });

  stage.scene.add(root);
  Kit.createClouds(stage.scene, {
    count: 9,
    center: [0, 3, -22],
    area: [70, 10, 20],
  });
  Kit.createSparkles(stage.scene, {
    count: 70,
    center: [0, 4, -2],
    area: [30, 10, 18],
  });
  stage.onFrame((dt, t) => {
    if (stage.reducedMotion) return;
    crystal.rotation.y = t * 0.6;
    crystal.position.y = -5.2 + Math.sin(t * 1.2) * 0.2;
    for (const mi of minis)
      mi.position.y =
        mi.userData.y + Math.sin(t * 0.7 + mi.userData.i * 1.7) * 0.35;
  });
  return root;
}
