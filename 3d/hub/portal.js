// A glowing portal for one game: pedestal, ring, swirling holo disc, the game's
// emoji floating inside, and orbiting sparks. `ready` = a 3D version exists.
import * as THREE from "three";
import * as Kit from "../kit/kit.js";

export function createPortal(stage, game) {
  const root = new THREE.Group();
  const color = new THREE.Color(game.color);
  const pastel = color.clone().lerp(new THREE.Color("#ffffff"), 0.35);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.95, 0.28, 40),
    Kit.toon("#ffffff", { rim: 0.4, rimColor: `#${pastel.getHexString()}` }),
  );
  pedestal.position.y = 0.44;
  pedestal.castShadow = pedestal.receiveShadow = true;
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.035, 8, 48),
    Kit.flat(`#${pastel.getHexString()}`),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 0.58;

  const spin = new THREE.Group(); // ring + disc, gently bobbing
  spin.position.y = 1.65;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.11, 16, 56),
    Kit.toon(game.color, { rim: 0.7 }),
  );
  ring.castShadow = true;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.76, 48),
    Kit.holo(game.color, { opacity: 0.85, swirl: 0.6 }),
  );
  const icon = Kit.label(game.emoji, { size: 0.78 });
  icon.position.z = 0.12;
  spin.add(ring, disc, icon);

  const sparks = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      Kit.flat("#ffffff"),
    );
    s.userData.phase = (i / 3) * Math.PI * 2;
    sparks.add(s);
  }
  spin.add(sparks);
  root.add(pedestal, glow, spin);

  let hover = 0;
  let hoverTarget = 0;
  const phase = Math.random() * 6;
  stage.onFrame((dt, t) => {
    hover = Kit.damp(hover, hoverTarget, 10, dt);
    const still = stage.reducedMotion;
    spin.position.y =
      1.65 + (still ? 0 : Math.sin(t * 1.4 + phase) * 0.08) + hover * 0.12;
    icon.position.y = still ? 0 : Math.sin(t * 2.2 + phase) * 0.05;
    disc.material.uniforms.uGlow.value = 1 + hover * 0.35;
    sparks.children.forEach((s) => {
      const a = s.userData.phase + t * (1.2 + hover * 2);
      s.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.1);
    });
  });

  return {
    root,
    center: () => spin.getWorldPosition(new THREE.Vector3()),
    set hover(v) {
      hoverTarget = v ? 1 : 0;
    },
    setReady(ready) {
      disc.material.uniforms.uSwirl.value = ready ? 1.2 : 0.5;
      disc.material.uniforms.uOpacity.value = ready ? 0.95 : 0.75;
    },
  };
}
