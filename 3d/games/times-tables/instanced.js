// Many copies of the buddy's treat in a handful of draw calls.
//
// Kit.treat() returns a small Group (corn = cob + instanced kernels + leaves,
// pepper = body + calyx + stem + shine). We take it apart once: every mesh
// part becomes one InstancedMesh (parts sharing geometry + material are
// merged), and nested instanced parts (the corn kernels) are baked into one
// low-poly geometry. A 10 × 10 array of corn is then 3 draw calls.
//
//   const arr = new TreatInstances(stage, 100);   arr.setTreat("pipo");
//   arr.set(i, { x, y, z, s, ry, rz }); arr.count = n;   // then arr.flush()
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";

const tmp = new THREE.Matrix4();
const item = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const sc = new THREE.Vector3();

// Bake an InstancedMesh into one plain geometry using a low-poly stand-in
// for its geometry (every `stride`-th instance, slightly bigger).
function bakeInstanced(im, stride = 2, grow = 1.25) {
  im.geometry.computeBoundingSphere();
  const r = im.geometry.boundingSphere.radius;
  const unit = new THREE.IcosahedronGeometry(r * grow, 0); // non-indexed
  const pos = [];
  const nor = [];
  const p = unit.attributes.position;
  const n = unit.attributes.normal;
  const nm = new THREE.Matrix3();
  for (let i = 0; i < im.count; i += stride) {
    im.getMatrixAt(i, tmp);
    nm.getNormalMatrix(tmp);
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k).applyMatrix4(tmp);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, k).applyMatrix3(nm).normalize();
      nor.push(v.x, v.y, v.z);
    }
  }
  unit.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

// Split a treat into parts: [{ geometry, material, locals: [Matrix4] }]
const partsCache = new Map();
export function treatParts(id) {
  if (partsCache.has(id)) return partsCache.get(id);
  const proto = Kit.treat(id);
  proto.updateMatrixWorld(true);
  const byKey = new Map();
  proto.traverse((o) => {
    if (!o.isMesh) return;
    let geometry = o.geometry;
    let local = o.matrixWorld.clone();
    let key = `${o.geometry.uuid}|${o.material.uuid}`;
    if (o.isInstancedMesh) {
      geometry = bakeInstanced(o);
      key = `baked|${o.uuid}`;
    }
    if (!byKey.has(key))
      byKey.set(key, { geometry, material: o.material, locals: [] });
    byKey.get(key).locals.push(local);
  });
  const parts = [...byKey.values()];
  partsCache.set(id, parts);
  return parts;
}

export class TreatInstances {
  constructor(stage, max = 100, { shadows = false } = {}) {
    this.stage = stage;
    this.max = max;
    this.shadows = shadows;
    this.group = new THREE.Group();
    this.items = Array.from({ length: max }, () => ({
      x: 0,
      y: 0,
      z: 0,
      s: 0,
      ry: 0,
      rz: 0,
      rx: 0,
    }));
    this._count = 0;
    this.meshes = [];
    this.id = null;
  }

  setTreat(id) {
    if (id === this.id) return;
    this.id = id;
    for (const m of this.meshes) {
      this.group.remove(m);
      m.dispose();
    }
    this.meshes = treatParts(id).map((part) => {
      const m = new THREE.InstancedMesh(
        part.geometry,
        part.material,
        this.max * part.locals.length,
      );
      m.userData.locals = part.locals;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; // instances move around; bounds would go stale
      m.castShadow = this.shadows;
      m.count = 0;
      m.raycast = () => {};
      this.group.add(m);
      return m;
    });
    this.flush();
  }

  // Update item i (any of x y z s rx ry rz). Call flush() after a batch.
  set(i, props) {
    Object.assign(this.items[i], props);
  }
  get count() {
    return this._count;
  }
  set count(n) {
    this._count = Math.max(0, Math.min(this.max, n));
  }

  flush() {
    const n = this._count;
    for (const m of this.meshes) {
      const locals = m.userData.locals;
      let k = 0;
      for (let i = 0; i < n; i++) {
        const it = this.items[i];
        e.set(it.rx || 0, it.ry || 0, it.rz || 0);
        q.setFromEuler(e);
        const s = Math.max(1e-4, it.s);
        item.compose(v.set(it.x, it.y, it.z), q, sc.set(s, s, s));
        for (const local of locals)
          m.setMatrixAt(k++, tmp.multiplyMatrices(item, local));
      }
      m.count = k;
      m.instanceMatrix.needsUpdate = true;
    }
  }
}
