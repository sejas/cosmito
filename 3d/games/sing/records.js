// Song picker: each song is a floating vinyl record with a coloured label,
// the song's emoji, and up to three little stars orbiting it (best result).
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";

const INK = "#2b2f55";

export function createRecord(stage, song) {
  const root = new THREE.Group(); // positioned by the layout
  const float = new THREE.Group(); // bobs and lifts on hover
  root.add(float);

  const disc = new THREE.Group(); // spins
  const vinyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 0.07, 48),
    Kit.toon(INK, { rim: 0.9, rimColor: song.color }),
  );
  vinyl.rotation.x = Math.PI / 2;
  vinyl.castShadow = true;
  const grooves = new THREE.Group();
  [0.72, 0.6, 0.5].forEach((r) => {
    const g = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.008, 4, 48),
      Kit.flat("#4b5190"),
    );
    g.position.z = 0.037;
    grooves.add(g);
  });
  const lbl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.08, 36),
    Kit.toon(song.color, { rim: 0.4 }),
  );
  lbl.rotation.x = Math.PI / 2;
  // shine: a soft white arc sweeping across the vinyl
  const shine = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.78, 32, 1, 0.3, 0.9),
    Kit.flat("#ffffff", { opacity: 0.16, depthWrite: false }),
  );
  shine.position.z = 0.04;
  disc.add(vinyl, grooves, lbl);
  float.add(disc, shine);

  const emoji = Kit.label(song.emoji, { size: 0.62 });
  emoji.position.z = 0.25;
  float.add(emoji);

  // three stars in a small arc above the record: gold = earned, glass = not yet
  const stars = [];
  for (let i = 0; i < 3; i++) {
    const s = Kit.star3D("#ffc93c");
    s.scale.setScalar(0.38);
    s.position.set((i - 1) * 0.42, 1.0 + (i === 1 ? 0.1 : 0), 0.1);
    s.rotation.z = (1 - i) * 0.25;
    s.userData.ghost = new THREE.Mesh(
      s.geometry,
      Kit.toon("#ffffff", { transparent: true, opacity: 0.45, rim: 0.8 }),
    );
    s.userData.ghost.scale.copy(s.scale);
    s.userData.ghost.position.copy(s.position);
    s.userData.ghost.rotation.copy(s.rotation);
    float.add(s, s.userData.ghost);
    stars.push(s);
  }

  // glow disc behind the record when hovered
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 40),
    Kit.holo(song.color, { opacity: 0.6, swirl: 1 }),
  );
  glow.position.z = -0.08;
  glow.raycast = () => {};
  float.add(glow);

  let hover = 0;
  let hoverTarget = 0;
  let shown = 1;
  let shownTarget = 1;
  const phase = Math.random() * 6;
  const still = stage.reducedMotion;
  stage.onFrame((dt, t) => {
    hover = Kit.damp(hover, hoverTarget, 10, dt);
    shown = Kit.damp(shown, shownTarget, 9, dt);
    root.visible = shown > 0.01;
    if (!root.visible) return;
    float.scale.setScalar(shown * (1 + hover * 0.1));
    float.position.y =
      (still ? 0 : Math.sin(t * 1.3 + phase) * 0.08) + hover * 0.15;
    disc.rotation.z -= dt * (still ? 0 : 0.6 + hover * 3);
    shine.rotation.z = still ? 0 : Math.sin(t * 0.6 + phase) * 0.3;
    glow.material.uniforms.uOpacity.value = 0.25 + hover * 0.6;
    stars.forEach((s, i) => {
      if (!still) s.rotation.y = Math.sin(t * 2 + i + phase) * 0.5;
    });
  });

  return {
    root,
    song,
    center: () => float.getWorldPosition(new THREE.Vector3()),
    set hover(v) {
      hoverTarget = v ? 1 : 0;
    },
    set shown(v) {
      shownTarget = v ? 1 : 0;
    },
    setStars(n) {
      stars.forEach((s, i) => {
        s.visible = i < n;
        s.userData.ghost.visible = i >= n;
      });
    },
  };
}
