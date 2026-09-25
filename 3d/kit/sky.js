// Environment: a soft gradient sky dome, puffy instanced clouds and twinkling
// sparkles. All generated in shaders/geometry: no textures to download.
import * as THREE from "three";
import { toon, softDot, timed } from "./materials.js";

// Friendly daytime palette (matches the 2D sky in shared/base.css).
export const SKY = { top: "#6fb8ff", middle: "#bfe6ff", bottom: "#ffe3f1" };

export function createSky(
  scene,
  {
    top = SKY.top,
    middle = SKY.middle,
    bottom = SKY.bottom,
    radius = 300,
    fog = true,
  } = {},
) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uMid: { value: new THREE.Color(middle) },
      uBot: { value: new THREE.Color(bottom) },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 uTop, uMid, uBot; uniform float uTime; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.6, h)) : mix(uMid, uBot, smoothstep(0.0, -0.35, h));
        // a faint aurora band for the "future" feel, very soft
        float band = exp(-pow((h - 0.18 - 0.03 * sin(vDir.x * 3.0 + uTime * 0.2)) * 9.0, 2.0));
        c += vec3(0.95, 0.75, 1.0) * band * 0.12;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  timed.add(mat);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.raycast = () => {};
  scene.add(dome);
  if (fog)
    scene.fog = new THREE.Fog(
      new THREE.Color(middle).lerp(new THREE.Color(bottom), 0.35),
      radius * 0.12,
      radius * 0.6,
    );
  return dome;
}

// Puffy clouds, all in one draw call. Returns { mesh, update(dt) }.
export function createClouds(
  scene,
  {
    count = 8,
    area = [60, 8, 30],
    center = [0, 6, -25],
    speed = 0.4,
    seed = 7,
  } = {},
) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const puffsPer = 5;
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const mesh = new THREE.InstancedMesh(
    geo,
    toon("#ffffff", { rim: 0.5, rimColor: "#ffe3f1" }),
    count * puffsPer,
  );
  mesh.raycast = () => {};
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const c = {
      x: center[0] + (rnd() - 0.5) * area[0],
      y: center[1] + (rnd() - 0.5) * area[1],
      z: center[2] + (rnd() - 0.5) * area[2],
      scale: 0.8 + rnd() * 1.2,
      puffs: [],
    };
    for (let p = 0; p < puffsPer; p++) {
      const t = p / (puffsPer - 1) - 0.5;
      c.puffs.push({
        dx: t * 3.2,
        dy: (1 - Math.abs(t) * 2) * 0.6 + rnd() * 0.3,
        dz: (rnd() - 0.5) * 0.8,
        r: 0.9 + (1 - Math.abs(t) * 2) * 0.6,
      });
    }
    clouds.push(c);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const half = area[0] / 2 + 6;
  const write = () => {
    let k = 0;
    for (const c of clouds) {
      for (const p of c.puffs) {
        v.set(c.x + p.dx * c.scale, c.y + p.dy * c.scale, c.z + p.dz * c.scale);
        sc.set(p.r * c.scale, p.r * c.scale * 0.8, p.r * c.scale);
        mesh.setMatrixAt(k++, m.compose(v, q, sc));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  write();
  scene.add(mesh);
  return {
    mesh,
    update(dt) {
      if (!speed) return;
      for (const c of clouds) {
        c.x += speed * dt * (0.6 + c.scale * 0.3);
        if (c.x > center[0] + half) c.x = center[0] - half;
      }
      write();
    },
  };
}

// Twinkling sparkles floating in the air. Returns the Points object.
export function createSparkles(
  scene,
  {
    count = 80,
    area = [40, 16, 30],
    center = [0, 6, -6],
    color = "#ffffff",
    size = 0.35,
  } = {},
) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (Math.random() - 0.5) * area[0];
    pos[i * 3 + 1] = center[1] + (Math.random() - 0.5) * area[1];
    pos[i * 3 + 2] = center[2] + (Math.random() - 0.5) * area[2];
    phase[i] = Math.random() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: softDot() },
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size },
      uScale: { value: 600 },
    },
    vertexShader: `
      attribute float phase; uniform float uTime, uSize, uScale; varying float vA;
      void main(){
        vec3 p = position; p.y += sin(uTime * 0.5 + phase) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.0 + phase * 3.0), 3.0);
        gl_PointSize = uSize * uScale / -mv.z * (0.6 + vA * 0.6);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
      void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vA);
        #include <colorspace_fragment>
      }`,
  });
  timed.add(mat);
  const pts = new THREE.Points(geo, mat);
  pts.raycast = () => {};
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
