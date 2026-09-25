// Results: a tiered toy podium for the buddy, three big stars that fly in
// (gold = earned), or a big floating score for Lightning Rush.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";

const GOLD = "#ffc93c";
const EMPTY = "#dde2f7";

export function createPodium(stage) {
  const group = new THREE.Group();
  const tiers = [
    [1.55, 0.38, "#ffc9de"],
    [1.28, 0.36, "#d8ccff"],
    [1.0, 0.34, "#bfe3ff"],
  ];
  let y = 0;
  for (const [r, h, c] of tiers) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.04, h, 48),
      Kit.toon(c, { rim: 0.5 }),
    );
    m.position.y = y + h / 2;
    m.castShadow = m.receiveShadow = true;
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.035, 8, 64),
      Kit.flat("#ffffff", { opacity: 0.9 }),
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = y + h;
    group.add(m, lip);
    y += h;
  }
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(0.92, 48),
    Kit.holo("#ffe066", { opacity: 0.6, swirl: 0.8 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = y + 0.005;
  group.add(top);
  const shadow = Kit.blobShadow(2);
  group.add(shadow);

  const starGroup = new THREE.Group();
  group.add(starGroup);
  const stars = [0, 1, 2].map(() => {
    const s = Kit.star3D(EMPTY);
    s.visible = false;
    starGroup.add(s);
    return s;
  });
  const score = Kit.label("⭐ 0", {
    size: 1.05,
    color: "#26315c",
    bg: "rgba(255,255,255,0.9)",
  });
  score.visible = false;
  score.renderOrder = 5;
  group.add(score);
  group.traverse((o) => (o.raycast = () => {}));

  let spin = [0, 0, 0];
  stage.onFrame((dt, t) => {
    if (!group.visible) return;
    stars.forEach((s, i) => {
      if (!s.visible || s.userData.flying) return;
      s.rotation.y = stage.reducedMotion
        ? 0
        : Math.sin(t * 1.4 + i) * 0.35 + spin[i];
      spin[i] *= 0.92;
      s.position.y =
        s.userData.y + (stage.reducedMotion ? 0 : Math.sin(t * 1.8 + i) * 0.08);
    });
    if (score.visible && !stage.reducedMotion)
      score.position.y = score.userData.y + Math.sin(t * 1.6) * 0.08;
  });

  return {
    group,
    top: y,
    // Stars fly in one by one; onStar(i, earned) for sound/effects.
    showStars(positions, earned, { onStar } = {}) {
      score.visible = false;
      stars.forEach((s, i) => {
        const p = positions[i];
        const got = i < earned;
        s.material = Kit.candy(got ? GOLD : EMPTY, got ? "#3a2600" : "#000000");
        s.visible = false;
        s.userData.y = p.y;
        const size = got ? (i === 1 ? 1.75 : 1.5) : 1.15;
        const from = new THREE.Vector3(p.x * 4 + (i - 1) * 3, p.y + 6, p.z + 3);
        const to = new THREE.Vector3(p.x, p.y, p.z);
        const delay = 450 + i * 450;
        s.userData.flying = true;
        stage.tween({
          ms: stage.reducedMotion ? 1 : 650,
          delay: stage.reducedMotion ? 0 : delay,
          ease: "outBack",
          onUpdate: (v, k) => {
            s.visible = true;
            s.position.lerpVectors(from, to, Math.min(1, v));
            s.scale.setScalar(size * (0.3 + 0.7 * Math.min(1, k * 1.4)));
            s.rotation.set(0, (1 - k) * 8, (1 - k) * 2);
          },
          onDone: () => {
            s.userData.flying = false;
            spin[i] = got ? 6 : 0;
            if (got)
              stage.burst(to, {
                shape: "star",
                count: 18,
                speed: 3.5,
                colors: [GOLD, "#ffffff", "#ffe066"],
              });
            onStar?.(i, got);
          },
        });
      });
    },
    showScore(text, pos) {
      stars.forEach((s) => (s.visible = false));
      score.userData.setText(text);
      score.position.set(pos.x, pos.y, pos.z);
      score.userData.y = pos.y;
      score.visible = true;
      const base = score.scale.clone();
      stage.tween({
        ms: stage.reducedMotion ? 1 : 700,
        delay: stage.reducedMotion ? 0 : 350,
        ease: "outElastic",
        onUpdate: (k) =>
          score.scale.set(
            base.x * Math.max(0.01, k),
            base.y * Math.max(0.01, k),
            1,
          ),
      });
      score.scale.set(0.01, 0.01, 1);
    },
  };
}
