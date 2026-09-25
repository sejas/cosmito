// Table picker: ten bouncy number planets, each with a ring where its three
// stars orbit (gold = earned). The selected planet grows and glows.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { label } from "./world.js";
import { colorOf } from "./logic.js";

const GOLD = "#ffc93c";
const EMPTY = "#e3e6ff";
const gold = new THREE.Color();

export function createPlanets(stage, { count = 10, label: ariaLabel, onPick }) {
  const group = new THREE.Group();
  // Every planet part is instanced (4 draw calls for all ten planets); each
  // planet keeps a light Object3D skeleton (tap target, bob, tilt) that the
  // instances follow every frame.
  const inst = (geo, mat, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    m.raycast = () => {};
    group.add(m);
    return m;
  };
  const bodies = inst(new THREE.SphereGeometry(0.56, 36, 24), Kit.toon("#ffffff", { rim: 0.55, rimColor: "#ffffff" }), count);
  // a soft band so they read as planets, not balls
  const bands = inst(
    new THREE.SphereGeometry(0.565, 36, 6, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.12),
    Kit.toon("#ffffff", { rim: 0.3 }),
    count,
  );
  const rings = inst(new THREE.TorusGeometry(0.76, 0.04, 8, 64), Kit.toon("#ffffff", { rim: 0.6 }), count);
  const starMesh = inst(Kit.star3D().geometry, Kit.candy("#ffffff", "#1a1400"), count * 3);
  bodies.castShadow = true;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.98, 48), Kit.holo("#fff3bf", { opacity: 0.9, swirl: 1.2 }));
  halo.raycast = () => {};
  const planets = [];
  const white = new THREE.Color("#ffffff");

  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const color = new THREE.Color(colorOf(n));
    const pastel = color.clone().lerp(white, 0.55);
    bodies.setColorAt(i, color);
    bands.setColorAt(i, pastel);
    rings.setColorAt(i, pastel);
    const root = new THREE.Group(); // tap target (the stage squishes it)
    const inner = new THREE.Group(); // bob + selection scale
    root.add(inner);
    const tilt = new THREE.Object3D();
    tilt.rotation.set(1.22, 0, i % 2 ? 0.28 : -0.28);
    // stars orbit along the ring but always face the camera (never edge-on)
    const stars = [0, 1, 2].map(() => {
      const s = new THREE.Object3D();
      inner.add(s);
      return s;
    });
    const num = label(`×${n}`, { size: 0.62, color: "#ffffff", outline: "#26315c" });
    num.position.set(0, 0.02, 0.62);
    num.renderOrder = 4;
    const crown = label("👑", { size: 0.5 });
    crown.position.set(0, 0.78, 0.2);
    crown.visible = false;
    inner.add(tilt, num, crown);
    group.add(root);
    const planet = { n, root, inner, tilt, stars, crown, earned: 0, phase: i * 1.37, sel: 0, selTarget: 0 };
    planet.tap = stage.tap(root, {
      label: () => ariaLabel(n, planet.earned),
      onTap: () => onPick(n),
      hitRadius: 0.95,
    });
    planets.push(planet);
  }
  const inv = new THREE.Matrix4();
  const m = new THREE.Matrix4();

  stage.onFrame((dt, t) => {
    if (!group.visible) return;
    const still = stage.reducedMotion;
    for (const p of planets) {
      p.sel = Kit.damp(p.sel, p.selTarget, 9, dt);
      const bob = still ? 0 : Math.sin(t * 1.3 + p.phase) * 0.07;
      p.inner.position.y = bob + p.sel * 0.12;
      p.inner.scale.setScalar(1 + p.sel * 0.2);
      p.inner.rotation.y = still ? 0 : Math.sin(t * 0.7 + p.phase) * 0.18;
      const speed = 0.5 + p.sel * 1.2;
      p.stars.forEach((s, k) => {
        const a = (still ? 0 : t * speed) + p.phase + (k * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.76, Math.sin(a) * 0.76, 0).applyEuler(p.tilt.rotation);
        s.rotation.set(0, 0, still ? 0 : Math.sin(t * 2 + k) * 0.4);
        s.scale.setScalar(k < p.earned ? 0.5 : 0.36);
      });
    }
    group.updateMatrixWorld(true);
    inv.copy(group.matrixWorld).invert();
    planets.forEach((p, i) => {
      m.multiplyMatrices(inv, p.inner.matrixWorld);
      bodies.setMatrixAt(i, m);
      bands.setMatrixAt(i, m);
      rings.setMatrixAt(i, m.multiplyMatrices(inv, p.tilt.matrixWorld));
      p.stars.forEach((s, k) => starMesh.setMatrixAt(i * 3 + k, m.multiplyMatrices(inv, s.matrixWorld)));
    });
    for (const x of [bodies, bands, rings, starMesh]) x.instanceMatrix.needsUpdate = true;
    if (halo.parent) halo.rotation.z = t * 0.4;
  });

  return {
    group,
    planets,
    layout(positions) {
      planets.forEach((p, i) => {
        const q = positions[i];
        p.root.position.set(q.x, q.y, q.z);
        p.tap.setBase();
      });
    },
    // best: { [n]: stars }
    setStars(best) {
      for (const p of planets) {
        const s = Math.min(3, best[p.n] || 0);
        p.stars.forEach((_, k) => starMesh.setColorAt(p.n * 3 - 3 + k, gold.set(k < s ? GOLD : EMPTY)));
        p.crown.visible = s === 3;
        p.earned = s;
        p.tap.refreshLabel();
      }
      starMesh.instanceColor.needsUpdate = true;
    },
    select(n) {
      for (const p of planets) p.selTarget = p.n === n ? 1 : 0;
      const p = planets[n - 1];
      halo.position.set(0, 0, -0.35);
      p.inner.add(halo);
      pop(stage, halo, { ms: 450 });
    },
    // Joyful spin of one planet (on select).
    wiggle(n) {
      const p = planets[n - 1];
      const r0 = p.tilt.rotation.z;
      stage.tween({
        ms: stage.reducedMotion ? 1 : 700,
        ease: "outCubic",
        onUpdate: (k) =>
          (p.tilt.rotation.z = r0 + Math.sin(k * Math.PI * 3) * 0.3 * (1 - k)),
      });
      stage.burst(p.root.getWorldPosition(new THREE.Vector3()), {
        shape: "star",
        count: 12,
        speed: 3,
        up: 1,
        colors: [colorOf(n), "#ffffff", GOLD],
      });
    },
    enable(on) {
      for (const p of planets) p.tap.enabled = on;
    },
  };
}

function pop(stage, obj, { ms = 450 } = {}) {
  obj.scale.setScalar(0.01);
  stage.tween({
    ms: stage.reducedMotion ? 1 : ms,
    ease: "outBack",
    onUpdate: (s) => obj.scale.setScalar(Math.max(0.01, s)),
  });
}
