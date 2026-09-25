// The concert set: a round holographic stage floating in a pastel sky, soft
// coloured spotlights that follow the buddy, a little mic stand, the buddy's
// holo pad, clouds, sparkles and music notes drifting up.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";

// A soft volumetric light cone (additive, fades towards the floor and edges).
function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float face = pow(abs(dot(vN, vV)), 2.0);
        float a = 0.2 * uK * face * smoothstep(0.0, 0.55, vUv.y) * (0.4 + 0.6 * vUv.y);
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
  });
}

export function createSet(stage) {
  const { scene } = stage;
  const still = stage.reducedMotion;

  // floating round stage
  const platform = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 6.4, 0.7, 72),
    Kit.toon("#ffffff", { rim: 0.5, rimColor: "#d0bfff" }),
  );
  base.position.y = -0.35;
  base.receiveShadow = true;
  const under = new THREE.Mesh(
    new THREE.ConeGeometry(6.35, 2.6, 48, 1, true),
    Kit.toon("#e5dbff", { rim: 0.5, rimColor: "#ffc9e3" }),
  );
  under.rotation.x = Math.PI;
  under.position.y = -2.0;
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(6.9, 72),
    Kit.holo("#b197fc", { opacity: 0.7, swirl: 0.25 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.012;
  top.raycast = () => {};
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(7.2, 0.09, 10, 96),
    Kit.flat("#ff9ad5"),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  platform.add(base, under, top, rim);
  scene.add(platform);

  // the buddy's pad: a small pedestal with a holo top (moves with the buddy)
  const pad = new THREE.Group();
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.05, 0.24, 40),
    Kit.toon("#ffffff", { rim: 0.6, rimColor: "#ff9ad5" }),
  );
  ped.position.y = 0.12;
  ped.castShadow = ped.receiveShadow = true;
  const padTop = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 40),
    Kit.holo("#ff8fb8", { opacity: 0.8, swirl: 0.8 }),
  );
  padTop.rotation.x = -Math.PI / 2;
  padTop.position.y = 0.245;
  padTop.raycast = () => {};
  const padGlow = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.04, 8, 48),
    Kit.flat("#ffffff"),
  );
  padGlow.rotation.x = Math.PI / 2;
  padGlow.position.y = 0.25;
  pad.add(ped, padTop, padGlow);
  scene.add(pad);

  // mic on a stand, next to the buddy
  const mic = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.55, 12),
    Kit.toon("#26315c", { rim: 0.4, rimColor: "#b197fc" }),
  );
  pole.position.y = 0.78;
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.06, 24),
    Kit.toon("#26315c", { rim: 0.4, rimColor: "#b197fc" }),
  );
  foot.position.y = 0.03;
  const micHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 20, 14),
    Kit.toon("#e9ecef", { rim: 0.8, rimColor: "#ffffff" }),
  );
  micHead.position.set(0, 1.62, 0);
  const micBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.155, 0.03, 8, 24),
    Kit.toon("#ff5c9a", { rim: 0.5 }),
  );
  micBand.rotation.x = Math.PI / 2;
  micBand.position.set(0, 1.58, 0);
  mic.add(pole, foot, micHead, micBand);
  mic.rotation.z = -0.12;
  scene.add(mic);

  // spotlights hanging in the sky, aimed at the buddy
  const beams = ["#ff9ad5", "#74c0fc", "#ffd43b"].map((c, i) => {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 10, 32, 1, true),
      beamMaterial(c),
    );
    cone.geometry.translate(0, -5, 0); // apex at the group origin
    cone.rotation.x = -Math.PI / 2; // point along +z (group.lookAt aims +z)
    cone.raycast = () => {};
    cone.renderOrder = 3;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 12),
      Kit.flat(c),
    );
    g.add(cone, lamp);
    g.position.set((i - 1) * 5.5, 8.5, -2.5 + Math.abs(i - 1) * 1.5);
    g.userData.phase = i * 2.1;
    scene.add(g);
    return g;
  });

  Kit.createClouds(scene, { count: 7, center: [0, 3, -34], area: [80, 8, 16] });
  Kit.createSparkles(scene, {
    count: 60,
    center: [0, 5, -8],
    area: [30, 10, 20],
  });

  // music notes drifting up around the stage
  const notes = [];
  const glyphs = ["♪", "♫", "♪", "♬", "♩", "♫"];
  const colors = [
    "#ff6b6b",
    "#4dabf7",
    "#9775fa",
    "#51cf66",
    "#ffa94d",
    "#f783ac",
  ];
  glyphs.forEach((g, i) => {
    const s = Kit.label(g, {
      size: 0.55,
      color: colors[i],
      outline: "#ffffff",
    });
    s.userData = {
      x: (i % 2 ? 1 : -1) * (6.5 + (i % 3)),
      z: -2 - (i % 3) * 2.5,
      phase: i / glyphs.length,
    };
    s.raycast = () => {};
    notes.push(s);
    scene.add(s);
  });

  const target = new THREE.Vector3(0, 1, 0);
  const aim = new THREE.Vector3();
  let energy = 0; // 0..1, beams brighten when the kid sings on pitch
  stage.onFrame((dt, t) => {
    const lowfx = stage.quality.level === 0; // soft light cones cost fill rate
    beams.forEach((b) => {
      b.children[0].visible = !lowfx;
      const ph = b.userData.phase;
      aim.copy(target);
      if (!still) {
        aim.x += Math.sin(t * 0.7 + ph) * 0.8;
        aim.z += Math.cos(t * 0.5 + ph) * 0.6;
      }
      b.lookAt(aim);
      b.children[0].material.uniforms.uK.value = 1 + energy * 1.3;
    });
    notes.forEach((s) => {
      const u = s.userData;
      const k = (t * 0.07 + u.phase) % 1;
      s.position.set(
        u.x + (still ? 0 : Math.sin(t + u.phase * 6) * 0.3),
        0.5 + k * 7,
        u.z,
      );
      s.material.opacity = Math.sin(k * Math.PI);
    });
  });

  return {
    pad,
    mic,
    platform,
    // spotlights follow this point (the buddy)
    aimAt(x, y, z) {
      target.set(x, y, z);
    },
    set energy(v) {
      energy = v;
    },
    get energy() {
      return energy;
    },
  };
}
