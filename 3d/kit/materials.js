// Materials and generated textures. No image files: everything is built from
// tiny canvases, data textures or shaders so pages stay light.
import * as THREE from "three";

// Shader materials whose `uTime` uniform the stage advances every frame.
export const timed = new Set();

// 4-step toon ramp: soft cel shading that still reads as "rounded toy".
let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(
    new Uint8Array([150, 200, 236, 255]),
    4,
    1,
    THREE.RedFormat,
  );
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

// Toon material with a soft fresnel rim light (the "glow at the edges" that
// makes objects feel like polished toys floating in light).
//   toon("#ffd23f")                      solid colour
//   toon("#fff", { vertexColors: true }) colours painted on the geometry
//   toon(c, { rim: 0.5, rimColor: "#fff", emissive: "#222" })
//   toon(c, { unique: true })            a material of your own (see below)
//
// CACHING: toon(), flat() and candy() return one SHARED material per set of
// options, so reuse is free. Never change a shared material (opacity, colour,
// visible…): every object using it changes too. To animate a material, ask for
// `{ unique: true }`: a fresh, uncached material only you hold.
const toonCache = new Map();
export function toon(
  color = "#ffffff",
  {
    rim = 0.35,
    rimColor = "#ffffff",
    emissive = "#000000",
    vertexColors = false,
    transparent = false,
    opacity = 1,
    unique = false,
  } = {},
) {
  const key = [
    color,
    rim,
    rimColor,
    emissive,
    vertexColors,
    transparent,
    opacity,
  ].join("|");
  if (!unique && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
    emissive,
    vertexColors,
    transparent,
    opacity,
  });
  addRim(m, rim, rimColor);
  if (!unique) toonCache.set(key, m);
  return m;
}

function addRim(material, strength, color) {
  const uniforms = {
    kitRimColor: { value: new THREE.Color(color) },
    kitRimStrength: { value: strength },
  };
  material.userData.rim = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader =
      "uniform vec3 kitRimColor;\nuniform float kitRimStrength;\n" +
      shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `float kitRim = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
       outgoingLight += kitRimColor * pow(kitRim, 2.6) * kitRimStrength;
       #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "kit-toon-rim";
}

// Unlit colour (eyes, cheeks, glowing bits): never shaded, always crisp.
// Shared like toon(); pass { unique: true } for one you can animate.
const flatCache = new Map();
export function flat(
  color,
  { opacity = 1, additive = false, depthWrite = true, unique = false } = {},
) {
  const key = [color, opacity, additive, depthWrite].join("|");
  if (!unique && flatCache.has(key)) return flatCache.get(key);
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1 || additive,
    opacity,
    depthWrite: depthWrite && !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  if (!unique) flatCache.set(key, m);
  return m;
}

// Glossy candy material (treats, stars): toon + strong rim + a hint of emissive.
// Shared like toon(); candy(c, e, { unique: true }) for one of your own.
export const candy = (color, emissive = "#000000", { unique = false } = {}) =>
  toon(color, { rim: 0.6, emissive, unique });

// Holographic surface: fresnel glow, drifting scan lines and a swirl. Animated
// by the stage, which advances `uTime` on every material in `timed`.
export function holo(
  color = "#6cc4ff",
  { opacity = 0.9, swirl = 1, additive = false } = {},
) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSwirl: { value: swirl },
      uGlow: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uOpacity, uSwirl, uGlow; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float swirl = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 2.2 * uSwirl);
        float rings = 0.5 + 0.5 * sin(r * 16.0 - uTime * 3.0);
        float fres = pow(1.0 - abs(dot(vN, vV)), 2.0);
        vec3 c = mix(vec3(1.0), uColor, smoothstep(0.0, 0.95, r));
        c += uColor * swirl * 0.35 + vec3(1.0) * rings * 0.08 * (1.0 - r);
        c += vec3(1.0) * fres * 0.4;
        float alpha = uOpacity * (0.55 + 0.45 * swirl) * smoothstep(1.02, 0.85, r);
        gl_FragColor = vec4(c * uGlow, alpha);
        #include <colorspace_fragment>
      }`,
  });
  timed.add(m);
  return m;
}

// Soft round sprite (sparkles, particles, glows): white radial falloff.
let dot = null;
export function softDot() {
  if (dot) return dot;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  dot.colorSpace = THREE.SRGBColorSpace;
  return dot;
}

// Blob shadow texture (cheap contact shadow under characters and props).
let blob = null;
export function blobTexture() {
  if (blob) return blob;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(38,49,92,0.42)");
  grad.addColorStop(0.55, "rgba(38,49,92,0.18)");
  grad.addColorStop(1, "rgba(38,49,92,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  blob = new THREE.CanvasTexture(c);
  return blob;
}

// A flat soft shadow disc to put under things standing on the ground.
export function blobShadow(radius = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: blobTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  m.renderOrder = -1;
  m.raycast = () => {};
  return m;
}

// Text or emoji rendered to a sprite that always faces the camera.
//   label("7 × 8", { size: 0.6, color: "#26315c", bg: "rgba(255,255,255,.8)" })
//   label("🎤", { size: 1 })
// `size` is the world height of the sprite. Call sprite.userData.setText(t)
// to change it later (re-draws the canvas). It also re-draws itself once the
// web font has loaded. Whenever the canvas changes size the GPU texture is
// replaced (WebGL can't grow a texture in place), so re-texting is always safe.
export function label(
  text,
  {
    size = 0.5,
    color = "#26315c",
    bg = null,
    weight = 700,
    font = "Fredoka, system-ui, sans-serif",
    padding = 0.25,
    outline = null,
  } = {},
) {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  const makeTexture = () => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const mat = new THREE.SpriteMaterial({
    map: makeTexture(),
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const px = 96;
  const draw = (t) => {
    g.font = `${weight} ${px}px ${font}`;
    const w = Math.ceil(g.measureText(t).width + px * padding * 2);
    const h = Math.ceil(px * (1.25 + padding));
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
      // Same-size uploads reuse the GPU texture; a new size needs a new one
      // (else Chrome: "glCopySubTextureCHROMIUM: Offset overflows texture").
      if (mat.map.version > 0) {
        mat.map.dispose();
        mat.map = makeTexture();
      }
    } else g.clearRect(0, 0, w, h);
    g.font = `${weight} ${px}px ${font}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (bg) {
      g.fillStyle = bg;
      const r = h / 2;
      g.beginPath();
      g.roundRect(0, 0, w, h, r);
      g.fill();
    }
    if (outline) {
      g.lineWidth = px * 0.14;
      g.lineJoin = "round";
      g.strokeStyle = outline;
      g.strokeText(t, w / 2, h / 2 + px * 0.04);
    }
    g.fillStyle = color;
    g.fillText(t, w / 2, h / 2 + px * 0.04);
    mat.map.needsUpdate = true;
    sprite.scale.set((size * w) / h, size, 1);
  };
  let current = String(text);
  draw(current);
  // Redraw once the web font arrives (first paint may use the fallback font).
  document.fonts?.ready.then(() => draw(current));
  sprite.userData.setText = (t) => draw((current = String(t)));
  return sprite;
}
