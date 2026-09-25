// The music highway: a holographic road floating in the sky, one glowing rail
// per note of the scale (Boomwhacker colours), note pills gliding towards the
// "sing gate", and the player's voice as a comet at the gate with a trail.
// Time runs along -z (the future is far away), pitch is height.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { laneY, colorOf, noteName, pc, PC_COLORS } from "./logic.js";

export const LEN = 20; // highway length ahead of the gate (world units)
export const BOTTOM = 0.8; // height of the lowest lane
export const TOP = 4.5; // height of the highest lane
const R = 0.23; // note pill radius
const MAX = 96; // notes per song (the longest song has ~48)
const TRAIL = 56; // voice trail beads
const TRAIL_S = 1.0; // seconds of voice history shown
const INK = "#26315c";

// The road surface: soft lavender glass with beat lines scrolling to the gate.
function roadMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uScroll: { value: 0 },
      uBeat: { value: 1.6 },
      uLen: { value: LEN },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uScroll, uBeat, uLen, uTime; varying vec2 vP;
      void main(){
        float d = vP.y;                 // distance ahead of the gate
        float x = abs(vP.x);
        vec3 c = mix(vec3(0.97,0.93,1.0), vec3(0.84,0.80,1.0), smoothstep(0.0, uLen, d));
        float beat = fract((d + uScroll) / uBeat);
        float line = smoothstep(0.06, 0.0, min(beat, 1.0 - beat) * uBeat);
        float edge = smoothstep(1.25, 1.55, x);
        vec3 rainbow = 0.6 + 0.4 * cos(6.2831 * (d * 0.04 - uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
        c = mix(c, vec3(1.0), line * 0.8);
        c = mix(c, rainbow, edge * 0.8);
        float a = 0.42 + line * 0.35 + edge * 0.45;
        a *= smoothstep(uLen + 1.0, uLen - 5.0, d) * smoothstep(-1.6, 0.0, d);
        a *= smoothstep(1.62, 1.5, x);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
  return m;
}

// Rounded-rectangle frame (extruded ring): the gate the notes fly through.
function frameGeometry(w, h, r, thick) {
  const rr = (s, W, H, R, hole = false) => {
    const x = -W / 2;
    const y = -H / 2;
    const p = hole ? new THREE.Path() : s;
    p.moveTo(x + R, y);
    p.lineTo(x + W - R, y);
    p.quadraticCurveTo(x + W, y, x + W, y + R);
    p.lineTo(x + W, y + H - R);
    p.quadraticCurveTo(x + W, y + H, x + W - R, y + H);
    p.lineTo(x + R, y + H);
    p.quadraticCurveTo(x, y + H, x, y + H - R);
    p.lineTo(x, y + R);
    p.quadraticCurveTo(x, y, x + R, y);
    return p;
  };
  const shape = new THREE.Shape();
  rr(shape, w + thick * 2, h + thick * 2, r + thick);
  shape.holes.push(rr(null, w, h, r, true));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.translate(0, 0, -0.08);
  return g;
}

export function createHighway(stage) {
  const root = new THREE.Group();
  const still = stage.reducedMotion;
  let tl = null;
  let names = "sol";
  let speed = 2.4; // world units per second
  const lanes = []; // { midi, y, color, flash }

  // --- road ---------------------------------------------------------------
  const roadGeo = new THREE.PlaneGeometry(3.3, LEN + 3, 1, 1);
  roadGeo.translate(0, (LEN + 3) / 2 - 1.8, 0);
  const road = new THREE.Mesh(roadGeo, roadMaterial());
  road.rotation.x = -Math.PI / 2;
  road.position.y = BOTTOM - 0.55;
  road.renderOrder = -2;
  road.raycast = () => {};
  root.add(road);

  // --- gate ---------------------------------------------------------------
  const gateW = 1.9;
  const gateH = TOP - BOTTOM + 1.1;
  const gate = new THREE.Group();
  gate.position.set(0, (TOP + BOTTOM) / 2, 0);
  const frame = new THREE.Mesh(
    frameGeometry(gateW, gateH, 0.5, 0.09),
    Kit.toon("#ffc9e3", { rim: 0.9, rimColor: "#ffffff" }),
  );
  frame.castShadow = true;
  const film = new THREE.Mesh(
    new THREE.PlaneGeometry(gateW * 1.15, gateH * 1.05),
    Kit.holo("#b197fc", { opacity: 0.2, swirl: 0.35 }),
  );
  film.renderOrder = 2;
  film.raycast = () => {};
  // little bulbs on the frame, like a stage marquee
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    18,
  );
  {
    const m = new THREE.Matrix4();
    const cols = Object.values(PC_COLORS);
    for (let i = 0; i < 18; i++) {
      const k = i / 17;
      // along the top edge and down both sides
      let x;
      let y;
      if (k < 0.25) {
        x = -gateW / 2 - 0.2;
        y = -gateH / 2 + (k / 0.25) * gateH;
      } else if (k < 0.75) {
        x = -gateW / 2 - 0.2 + ((k - 0.25) / 0.5) * (gateW + 0.4);
        y = gateH / 2 + 0.2;
      } else {
        x = gateW / 2 + 0.2;
        y = gateH / 2 - ((k - 0.75) / 0.25) * gateH;
      }
      bulbs.setMatrixAt(i, m.makeTranslation(x, y, 0.2));
      bulbs.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
  }
  gate.add(frame, film, bulbs);
  root.add(gate);

  // --- rails + lane beads at the gate (instanced: one draw call each) ------------------
  const railMat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const rails = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    railMat,
    24,
  );
  rails.raycast = () => {};
  const beads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.075, 12, 10),
    new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    24,
  );
  beads.raycast = () => {};
  root.add(rails, beads);
  const laneLabels = new THREE.Group();
  root.add(laneLabels);

  // --- notes: pill = body cylinder + 2 caps --------------------------------
  const bodyGeo = new THREE.CylinderGeometry(R, R, 1, 20, 1, true);
  bodyGeo.rotateX(Math.PI / 2);
  const noteMat = Kit.toon("#ffffff", { rim: 0.55 });
  const bodies = new THREE.InstancedMesh(bodyGeo, noteMat, MAX);
  const caps = new THREE.InstancedMesh(
    new THREE.SphereGeometry(R, 16, 12),
    noteMat,
    MAX * 2,
  );
  for (const im of [bodies, caps]) {
    im.frustumCulled = false;
    im.raycast = () => {};
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.setColorAt(0, new THREE.Color("#fff"));
    im.castShadow = false;
  }
  root.add(bodies, caps);

  // note names floating over each pill (pooled sprites sharing per-name textures)
  let nameMats = {};
  const namePool = [];
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite();
    s.visible = false;
    s.raycast = () => {};
    namePool.push(s);
    root.add(s);
  }
  function buildNames() {
    Object.values(nameMats).forEach((m) => {
      m.material.map.dispose();
      m.material.dispose();
    });
    nameMats = {};
    for (let p = 0; p < 12; p++) {
      nameMats[p] = Kit.label(noteName(p, names), {
        size: 0.3,
        color: "#ffffff",
        outline: INK,
        weight: 700,
      });
    }
  }

  // --- voice comet ----------------------------------------------------------
  const comet = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 20, 14),
    new THREE.MeshBasicMaterial({ color: "#ffffff" }),
  );
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: Kit.softDot(),
      color: "#ffffff",
      depthWrite: false,
      transparent: true,
      opacity: 0.75,
    }),
  );
  halo.scale.setScalar(0.9);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.035, 8, 32),
    new THREE.MeshBasicMaterial({ color: "#ffffff" }),
  );
  comet.add(halo, head, ring);
  comet.position.z = 0.02;
  comet.visible = false;
  root.add(comet);
  const trail = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    TRAIL,
  );
  trail.frustumCulled = false;
  trail.raycast = () => {};
  trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trail.setColorAt(0, new THREE.Color("#fff"));
  root.add(trail);
  const samples = []; // { t, y, on }

  const ON = new THREE.Color("#38d9a9");
  const OFF = new THREE.Color("#9775fa");
  const WHITE = new THREE.Color("#ffffff");
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  const yOf = (midi) => laneY(midi, tl.minM, tl.maxM, BOTTOM, TOP);

  function setSong(timeline, opts = {}) {
    tl = timeline;
    names = opts.names || names;
    speed = 1.6 / tl.spb; // 1.6 world units per beat
    road.material.uniforms.uBeat.value = 1.6;
    samples.length = 0;
    // lanes: every natural note in range (the coloured ones)
    lanes.length = 0;
    for (let m = tl.minM; m <= tl.maxM; m++) {
      if (!(pc(m) in PC_COLORS)) continue;
      lanes.push({
        midi: m,
        y: yOf(m),
        color: new THREE.Color(colorOf(m)),
        flash: 0,
      });
    }
    rails.count = beads.count = lanes.length;
    lanes.forEach((l, i) => {
      rails.setMatrixAt(
        i,
        m4.compose(
          v.set(0, l.y, -LEN / 2 + 0.2),
          q.identity(),
          sc.set(0.035, 0.035, LEN),
        ),
      );
      rails.setColorAt(i, l.color);
      beads.setMatrixAt(i, m4.makeTranslation(0, l.y, 0.02));
      beads.setColorAt(i, l.color);
    });
    rails.instanceMatrix.needsUpdate = beads.instanceMatrix.needsUpdate = true;
    rails.instanceColor.needsUpdate = beads.instanceColor.needsUpdate = true;
    buildNames();
    buildLaneLabels();
  }

  function buildLaneLabels() {
    laneLabels.children.forEach((s) => {
      s.material.map.dispose();
      s.material.dispose();
    });
    laneLabels.clear();
    lanes.forEach((l) => {
      const s = Kit.label(noteName(l.midi, names), {
        size: 0.27,
        color: `#${l.color.getHexString()}`,
        outline: "#ffffff",
      });
      // Fa and Do sit a semitone above Mi and Si: nudge them aside so they don't overlap
      const nudge = pc(l.midi) === 5 || pc(l.midi) === 0 ? 0.36 : 0;
      s.position.set(-gateW / 2 - 0.5 - nudge, l.y, 0.1);
      laneLabels.add(s);
    });
  }

  function setNames(n) {
    names = n;
    if (!tl) return;
    buildNames();
    buildLaneLabels();
  }

  // Per frame: t = song time (s), sess = scoring session (logic.js).
  let sparkT = 0;
  function update(t, sess, dt = 1 / 60) {
    if (!tl) return;
    road.material.uniforms.uScroll.value = t * speed;
    road.material.uniforms.uTime.value = stage.time;
    const pulse = still ? 0 : Math.sin(stage.time * 10) * 0.06;

    // notes
    let bi = 0;
    let ci = 0;
    let ni = 0;
    for (const n of tl.notes) {
      if (n.done) continue;
      const zFront = Math.min(0, -(n.start - t) * speed) - 0.06;
      const zBack = -(n.end - t) * speed + 0.06;
      if (-zFront > LEN + 0.5) break; // notes are in time order
      const len = zFront - zBack;
      if (len <= 0.001) continue;
      const y = yOf(n.midi);
      const active = sess?.active === n;
      // grow in at the far end of the road
      const grow = Math.min(1, (LEN + 0.5 + zFront) / 2.5);
      const k = (active ? 1.2 + pulse : 1) * grow;
      col.set(colorOf(n.midi));
      if (active) {
        const glow = sess.on ? 0.55 : 0.25;
        col.lerp(WHITE, glow);
        col.multiplyScalar(1.15);
      }
      bodies.setMatrixAt(
        bi,
        m4.compose(
          v.set(0, y, (zFront + zBack) / 2),
          q.identity(),
          sc.set(k, k, len),
        ),
      );
      bodies.setColorAt(bi++, col);
      caps.setMatrixAt(ci, m4.compose(v.set(0, y, zFront), q, sc.set(k, k, k)));
      caps.setColorAt(ci++, col);
      caps.setMatrixAt(ci, m4.compose(v.set(0, y, zBack), q, sc.set(k, k, k)));
      caps.setColorAt(ci++, col);
      // name tag over the front of the pill
      if (ni < namePool.length && grow > 0.6 && zFront > -9) {
        const s = namePool[ni++];
        const src = nameMats[pc(n.midi)];
        s.material = src.material;
        s.scale.copy(src.scale).multiplyScalar(active ? 1.25 : 1);
        s.position.set(
          0,
          y + R * k + 0.2,
          Math.max(zBack + 0.2, zFront - 0.25),
        );
        s.visible = true;
      }
    }
    bodies.count = bi;
    caps.count = ci;
    for (let i = ni; i < namePool.length; i++) namePool[i].visible = false;
    bodies.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (caps.instanceColor) caps.instanceColor.needsUpdate = true;

    // lane flashes
    let dirty = false;
    lanes.forEach((l, i) => {
      const target = sess?.active?.midi === l.midi ? 0.35 : 0;
      const f = Math.max(target, l.flash);
      l.flash = Math.max(0, l.flash - dt * 1.6);
      if (f === l.shown) return;
      l.shown = f;
      dirty = true;
      col.copy(l.color).lerp(WHITE, f);
      rails.setColorAt(i, col);
      beads.setColorAt(i, col);
      const s = 1 + f * 1.4;
      rails.setMatrixAt(
        i,
        m4.compose(
          v.set(0, l.y, -LEN / 2 + 0.2),
          q.identity(),
          sc.set(0.035 * s, 0.035 * s, LEN),
        ),
      );
      beads.setMatrixAt(
        i,
        m4.compose(v.set(0, l.y, 0.02), q, sc.set(1 + f * 1.5, 1 + f * 1.5, 1 + f * 1.5)),
      );
    });
    if (dirty) {
      rails.instanceColor.needsUpdate = beads.instanceColor.needsUpdate = true;
      rails.instanceMatrix.needsUpdate =
        beads.instanceMatrix.needsUpdate = true;
    }

    // voice comet
    const voice = sess?.voice ?? null;
    if (voice !== null) {
      const y = THREE.MathUtils.clamp(yOf(voice), BOTTOM - 0.45, TOP + 0.45);
      comet.position.y =
        comet.visible && comet.userData.y != null
          ? Kit.damp(comet.position.y, y, 30, dt)
          : y;
      comet.userData.y = y;
      comet.visible = true;
      const c = sess.on ? ON : OFF;
      head.material.color.copy(c);
      halo.material.color.copy(sess.on ? ON : col.set("#d0bfff"));
      halo.scale.setScalar(sess.on ? 1.2 + pulse * 2 : 0.8);
      ring.material.color.copy(c);
      ring.scale.setScalar(sess.on ? 1.15 + pulse * 2 : 0.9);
      ring.rotation.z += dt * 3;
      samples.push({ t, y: comet.position.y, on: sess.on });
      sparkT += dt;
      if (sess.on && sparkT > 0.14) {
        sparkT = 0;
        const wp = root.localToWorld(v.set(0, comet.position.y, 0.1));
        stage.burst(wp.clone(), {
          shape: "dot",
          count: 3,
          speed: 1.6,
          up: 0.6,
          life: 0.6,
          colors: [colorOf(sess.active?.midi ?? 60), "#ffffff"],
        });
      }
    } else {
      comet.visible = false;
      comet.userData.y = null;
      samples.push({ t, gap: true });
    }
    while (samples.length && samples[0].t < t - TRAIL_S) samples.shift();
    let k = 0;
    for (let i = samples.length - 1; i >= 0 && k < TRAIL; i--) {
      const s = samples[i];
      if (s.gap) continue;
      const age = t - s.t;
      if (age < 0.02) continue;
      const z = age * speed;
      const size = (1 - age / TRAIL_S) * 0.85;
      trail.setMatrixAt(
        k,
        m4.compose(v.set(0, s.y, z), q, sc.set(size, size, size)),
      );
      trail.setColorAt(k++, s.on ? ON : col.set("#b197fc"));
      i -= 1; // every other sample keeps the trail cheap at 60 fps
    }
    trail.count = k;
    trail.instanceMatrix.needsUpdate = true;
    if (trail.instanceColor) trail.instanceColor.needsUpdate = true;
  }

  // A sung note pops at the gate: stars in its colour and a flashing lane.
  function pop(note, good) {
    const y = yOf(note.midi);
    const p = root.localToWorld(new THREE.Vector3(0, y, 0.1));
    if (good) {
      stage.burst(p, {
        shape: "star",
        count: 16,
        speed: 3.2,
        up: 1.6,
        colors: [colorOf(note.midi), "#ffd43b", "#ffffff"],
      });
      const lane = lanes.find((l) => l.midi === note.midi);
      if (lane) lane.flash = 1;
    } else {
      stage.burst(p, {
        shape: "dot",
        count: 5,
        speed: 1,
        up: 0.3,
        life: 0.5,
        colors: ["#c5cbe3", "#ffffff"],
      });
    }
  }

  function clear() {
    bodies.count = caps.count = trail.count = 0;
    namePool.forEach((s) => (s.visible = false));
    comet.visible = false;
    samples.length = 0;
  }

  return {
    root,
    gate,
    setSong,
    setNames,
    update,
    pop,
    clear,
    yOf: (m) => (tl ? yOf(m) : (BOTTOM + TOP) / 2),
    get lanes() {
      return lanes;
    },
    // world position where an upcoming note is right now (for the buddy's eyes)
    notePos(n, t, out = new THREE.Vector3()) {
      const z = Math.min(0, -(n.start - t) * speed);
      return root.localToWorld(out.set(0, yOf(n.midi), z));
    },
  };
}
