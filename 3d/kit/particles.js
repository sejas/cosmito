// 3D particle bursts and confetti. One pooled InstancedMesh per shape, so a
// celebration costs one draw call no matter how many bits fly.
import * as THREE from "three";

export const COLORS = [
  "#ff6b6b",
  "#ffa94d",
  "#ffd43b",
  "#51cf66",
  "#4dabf7",
  "#9775fa",
  "#f783ac",
];

export function starGeometry(r = 0.12) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: r * 0.35,
    bevelEnabled: true,
    bevelSize: r * 0.12,
    bevelThickness: r * 0.12,
    bevelSegments: 1,
  });
  g.center();
  return g;
}

const SHAPES = {
  confetti: () => new THREE.PlaneGeometry(0.16, 0.09),
  star: () => starGeometry(0.13),
  dot: () => new THREE.SphereGeometry(0.07, 8, 6),
};

export class Particles {
  constructor(scene, { max = 360 } = {}) {
    this.scene = scene;
    this.max = max;
    this.pools = {};
    this.scale = 1; // quality multiplier for counts
    this.gravity = -9;
  }

  pool(shape) {
    if (this.pools[shape]) return this.pools[shape];
    const geo = (SHAPES[shape] || SHAPES.confetti)();
    const mat =
      shape === "confetti"
        ? new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
        : new THREE.MeshToonMaterial({ emissive: "#333333" });
    const mesh = new THREE.InstancedMesh(geo, mat, this.max);
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) {
      mesh.setMatrixAt(i, zero);
      mesh.setColorAt(i, new THREE.Color("#fff"));
    }
    this.scene.add(mesh);
    const p = { mesh, bits: [], next: 0 };
    this.pools[shape] = p;
    return p;
  }

  // Burst at a world position. opts: count, colors, speed, up, spread, shape, life, size.
  burst(
    position,
    {
      count = 26,
      colors = COLORS,
      speed = 4.5,
      up = 3,
      spread = 1,
      shape = "star",
      life = 1.3,
      size = 1,
      gravity,
    } = {},
  ) {
    const p = this.pool(shape);
    const n = Math.max(3, Math.round(count * this.scale));
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const idx = p.next;
      p.next = (p.next + 1) % this.max;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.45 + Math.random() * 0.55);
      const bit = {
        idx,
        pos: new THREE.Vector3().copy(position),
        vel: new THREE.Vector3(
          Math.sin(ph) * Math.cos(th) * sp * spread,
          Math.abs(Math.cos(ph)) * sp * 0.6 + up,
          Math.sin(ph) * Math.sin(th) * sp * spread,
        ),
        rot: new THREE.Euler(
          Math.random() * 6,
          Math.random() * 6,
          Math.random() * 6,
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
        ),
        age: 0,
        life: life * (0.7 + Math.random() * 0.5),
        size: size * (0.7 + Math.random() * 0.6),
        gravity: gravity ?? this.gravity,
        drag: shape === "confetti" ? 1.8 : 0.6,
      };
      p.bits = p.bits.filter((b) => b.idx !== idx);
      p.bits.push(bit);
      p.mesh.setColorAt(idx, col.set(colors[i % colors.length]));
    }
    p.mesh.instanceColor.needsUpdate = true;
  }

  // Confetti raining over an area centred on `center` (world units).
  confetti(center, { width = 10, height = 6, count = 140, life = 3.2 } = {}) {
    const p = this.pool("confetti");
    const n = Math.round(count * this.scale);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const idx = p.next;
      p.next = (p.next + 1) % this.max;
      p.bits = p.bits.filter((b) => b.idx !== idx);
      p.bits.push({
        idx,
        pos: new THREE.Vector3(
          center.x + (Math.random() - 0.5) * width,
          center.y + height / 2 + Math.random() * height * 0.6,
          center.z + (Math.random() - 0.5) * 3,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          -1 - Math.random() * 1.5,
          0,
        ),
        rot: new THREE.Euler(
          Math.random() * 6,
          Math.random() * 6,
          Math.random() * 6,
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
        ),
        age: -Math.random() * 0.8,
        life: life * (0.7 + Math.random() * 0.5),
        size: 1.3 + Math.random() * 0.6,
        gravity: -1.2,
        drag: 0.4,
      });
      p.mesh.setColorAt(idx, col.set(COLORS[i % COLORS.length]));
    }
    p.mesh.instanceColor.needsUpdate = true;
  }

  // Drop every live bit at once (screen changes, restarts).
  clear() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const p of Object.values(this.pools)) {
      for (const b of p.bits) p.mesh.setMatrixAt(b.idx, zero);
      p.bits = [];
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(dt) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (const p of Object.values(this.pools)) {
      if (!p.bits.length) continue;
      const alive = [];
      for (const b of p.bits) {
        b.age += dt;
        if (b.age < 0) {
          m.makeScale(0, 0, 0);
          p.mesh.setMatrixAt(b.idx, m);
          alive.push(b);
          continue;
        }
        if (b.age >= b.life) {
          p.mesh.setMatrixAt(b.idx, m.makeScale(0, 0, 0));
          continue;
        }
        b.vel.y += b.gravity * dt;
        b.vel.multiplyScalar(Math.exp(-b.drag * dt));
        b.pos.addScaledVector(b.vel, dt);
        b.rot.x += b.spin.x * dt;
        b.rot.y += b.spin.y * dt;
        b.rot.z += b.spin.z * dt;
        const k = b.age / b.life;
        // pop in, then shrink away at the end
        const sc =
          b.size *
          Math.min(1, b.age * 12) *
          (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        q.setFromEuler(b.rot);
        s.setScalar(Math.max(sc, 0.0001));
        p.mesh.setMatrixAt(b.idx, m.compose(b.pos, q, s));
        alive.push(b);
      }
      p.bits = alive;
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
