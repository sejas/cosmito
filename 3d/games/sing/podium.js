// Results podium: three pedestals behind the buddy; stars drop onto them one
// by one with a bounce (gold when earned, see-through glass when not).
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";

const HEIGHTS = [0.9, 1.35, 0.9];
const COLORS = ["#ff9ad5", "#ffd43b", "#74c0fc"];

export function createPodium(stage) {
  const root = new THREE.Group();
  const still = stage.reducedMotion;
  const slots = HEIGHTS.map((h, i) => {
    const x = (i - 1) * 1.55;
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.7, h, 36),
      Kit.toon("#ffffff", { rim: 0.7, rimColor: COLORS[i] }),
    );
    ped.position.set(x, h / 2, 0);
    ped.castShadow = ped.receiveShadow = true;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.705, 0.705, 0.12, 36),
      Kit.toon(COLORS[i], { rim: 0.4 }),
    );
    band.position.set(x, h - 0.16, 0);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 36),
      Kit.holo(COLORS[i], { opacity: 0.8, swirl: 1 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, h + 0.005, 0);
    disc.raycast = () => {};
    root.add(ped, band, disc);

    const gold = Kit.star3D("#ffc93c");
    const ghost = new THREE.Mesh(
      gold.geometry,
      Kit.toon("#e5dbff", {
        transparent: true,
        opacity: 0.6,
        rim: 0.9,
        rimColor: "#b197fc",
      }),
    );
    for (const s of [gold, ghost]) {
      s.scale.setScalar(1.35);
      s.visible = false;
      root.add(s);
    }
    return { x, h, gold, ghost, y: 0, vy: 0, falling: false, star: null };
  });

  function reset() {
    slots.forEach((s) => {
      s.gold.visible = s.ghost.visible = false;
      s.falling = false;
      s.star = null;
    });
  }

  // Drop star i (earned or not). Resolves when it lands.
  function drop(i, earned) {
    const s = slots[i];
    s.star = earned ? s.gold : s.ghost;
    s.star.visible = true;
    s.rest = s.h + 0.82;
    s.y = s.rest + (still ? 0 : 4.5);
    s.vy = 0;
    s.falling = !still;
    s.star.position.set(s.x, s.y, 0);
    return new Promise((res) => (s.onLand = res));
  }

  stage.onFrame((dt, t) => {
    for (const s of slots) {
      if (!s.star) continue;
      if (s.falling) {
        s.vy -= 26 * dt;
        s.y += s.vy * dt;
        if (s.y <= s.rest) {
          s.y = s.rest;
          if (Math.abs(s.vy) > 3) s.vy = -s.vy * 0.35;
          else {
            s.vy = 0;
            s.falling = false;
          }
          if (s.onLand) {
            const cb = s.onLand;
            s.onLand = null;
            cb(root.localToWorld(new THREE.Vector3(s.x, s.rest, 0)));
          }
        }
      } else if (s.onLand) {
        const cb = s.onLand;
        s.onLand = null;
        cb(root.localToWorld(new THREE.Vector3(s.x, s.rest, 0)));
      }
      s.star.position.y =
        s.y + (still || s.falling ? 0 : Math.sin(t * 2 + s.x) * 0.06);
      s.star.rotation.y = still ? 0 : t * (s.star === s.gold ? 1.6 : 0.5) + s.x;
    }
  });

  return { root, reset, drop };
}
