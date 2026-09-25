// 3D treats: each mascot's favourite food, used as the reward in games.
//   Kit.treat("pipo")  -> corn cob     Kit.treat("bollo") -> red bell pepper
//   Kit.corn(), Kit.pepper(), Kit.star3D()
// Every model is ~1 unit tall, centred on its middle, and shares geometries.
import * as THREE from "three";
import { toon, candy } from "./materials.js";
import { starGeometry } from "./particles.js";

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

export function corn() {
  const grp = new THREE.Group();
  // cob: a lathe with rounded ends
  const cob = once("cob", () => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = -0.45 + t * 0.9;
      const r =
        0.2 *
        Math.pow(Math.sin(Math.PI * (0.06 + t * 0.9)), 0.55) *
        (1 - t * 0.2);
      pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
    }
    return new THREE.LatheGeometry(pts, 20);
  });
  grp.add(new THREE.Mesh(cob, toon("#f5b700")));
  // kernels: instanced little spheres in rows
  const rows = 10;
  const cols = 9;
  const kernels = new THREE.InstancedMesh(
    once("kernel", () => new THREE.SphereGeometry(0.052, 8, 6)),
    candy("#ffd43b", "#3a2a00"),
    rows * cols,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const t = (r + 0.5) / rows;
    const y = -0.38 + t * 0.74;
    const rad =
      0.2 *
      Math.pow(Math.sin(Math.PI * (0.06 + ((y + 0.45) / 0.9) * 0.9)), 0.55) *
      (1 - ((y + 0.45) / 0.9) * 0.2);
    for (let c = 0; c < cols; c++) {
      const a = (c / cols) * Math.PI * 2 + (r % 2) * (Math.PI / cols);
      e.set(0, a, 0);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(Math.sin(a) * rad, y, Math.cos(a) * rad),
        q,
        new THREE.Vector3(1, 1.15, 0.8),
      );
      kernels.setMatrixAt(k++, m);
    }
  }
  grp.add(kernels);
  // husk leaves peeling back from the bottom
  const leaf = once("leaf", () => {
    const g = new THREE.SphereGeometry(1, 12, 10, 0, Math.PI, 0, Math.PI);
    g.scale(0.16, 0.42, 0.06);
    return g;
  });
  [0, 2.1, 4.2].forEach((a) => {
    const l = new THREE.Mesh(leaf, toon("#69db7c", { rim: 0.4 }));
    l.position.set(Math.sin(a) * 0.14, -0.3, Math.cos(a) * 0.14);
    l.rotation.set(0, a, 0);
    l.rotateX(0.5);
    grp.add(l);
  });
  grp.userData.kind = "corn";
  return grp;
}

export function pepper() {
  const grp = new THREE.Group();
  const body = once("pepperBody", () => {
    const g = new THREE.SphereGeometry(0.36, 36, 24);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = Math.atan2(v.z, v.x);
      const h = v.y / 0.36; // -1..1
      const lobes = 1 + 0.1 * Math.cos(a * 4) * (1 - Math.abs(h) * 0.3);
      const taper = h < 0 ? 1 - 0.18 * h * h : 1 - 0.1 * h;
      v.x *= lobes * taper;
      v.z *= lobes * taper;
      // dimples between lobes at the bottom, flat shoulders at the top
      if (h < -0.6) v.y += 0.05 * (1 - Math.cos(a * 4)) * (-h - 0.6);
      v.y *= h > 0 ? 0.92 : 1.12;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
  grp.add(
    new THREE.Mesh(
      body,
      toon("#e8413c", { rim: 0.7, rimColor: "#ffd0c8", emissive: "#2a0000" }),
    ),
  );
  const calyx = once("calyx", () => {
    const g = new THREE.CylinderGeometry(0.16, 0.2, 0.06, 5, 1);
    return g;
  });
  const c = new THREE.Mesh(calyx, toon("#40c057"));
  c.position.y = 0.33;
  grp.add(c);
  const stem = once("stem", () => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.33, 0),
      new THREE.Vector3(0.02, 0.5, 0),
      new THREE.Vector3(0.14, 0.56, 0),
    );
    return new THREE.TubeGeometry(curve, 8, 0.04, 8, false);
  });
  grp.add(new THREE.Mesh(stem, toon("#2f9e44")));
  // glossy highlight streak
  const shine = new THREE.Mesh(
    once("shine", () => new THREE.CapsuleGeometry(0.035, 0.22, 4, 8)),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.7,
    }),
  );
  shine.position.set(-0.2, 0.02, 0.26);
  shine.rotation.z = 0.25;
  grp.add(shine);
  grp.userData.kind = "pepper";
  return grp;
}

// Puffy golden star (for stars earned, level complete, generic rewards).
export function star3D(color = "#ffc93c") {
  const m = new THREE.Mesh(
    once("star3d", () => {
      const g = starGeometry(0.5);
      return g;
    }),
    candy(color, "#3a2600"),
  );
  m.userData.kind = "star";
  return m;
}

const BY_MASCOT = { pipo: corn, bollo: pepper };
export function registerTreat(mascotId, factory) {
  BY_MASCOT[mascotId] = factory;
}
// The treat of a mascot id (or a Mascots def). Unknown mascots get a star.
export function treat(idOrDef = "pipo") {
  const id = typeof idOrDef === "string" ? idOrDef : idOrDef?.id;
  return (BY_MASCOT[id] || star3D)();
}
