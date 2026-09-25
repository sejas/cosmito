// Motion helpers: easings, tweens and springs. Pure JS (no three.js, no DOM),
// so it runs in Node tests. The stage owns one Tweens instance and steps it
// every frame; games normally use `stage.tween(...)` / `Kit.spring(...)`.

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  // Overshoots a little then settles: the default "toy" feel.
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) =>
    t === 0 || t === 1
      ? t
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) +
        1,
  outBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Frame-rate independent smoothing: move `current` towards `target`, losing
// `1 - e^(-rate*dt)` of the gap each step (rate ≈ 1/seconds-to-settle * 4).
export const damp = (current, target, rate, dt) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

// A critically-ish damped spring. `value` chases `target` with a little bounce.
//   const s = new Spring(1, { stiffness: 300, damping: 18 }); s.target = 1.2;
//   every frame: s.step(dt); mesh.scale.setScalar(s.value);
export class Spring {
  constructor(value = 0, { stiffness = 260, damping = 16, mass = 1 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
  }
  step(dt) {
    // Sub-step so long frames (tab switch, slow tablet) never explode.
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = Math.min(dt, 0.25) / n;
    for (let i = 0; i < n; i++) {
      const force =
        -this.stiffness * (this.value - this.target) -
        this.damping * this.velocity;
      this.velocity += (force / this.mass) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
  // Give it a kick (e.g. a tap): adds velocity without moving the target.
  kick(v) {
    this.velocity += v;
    return this;
  }
  get settled() {
    return (
      Math.abs(this.value - this.target) < 1e-3 &&
      Math.abs(this.velocity) < 1e-3
    );
  }
}

// A list of running tweens, stepped by the owner (the stage) with `update(dt)`.
//   tweens.add({ from: 0, to: 1, ms: 600, ease: "outBack", onUpdate: (v) => …, onDone })
// Returns a handle with `cancel()` and a `done` Promise.
export class Tweens {
  constructor() {
    this.list = [];
  }
  add({
    from = 0,
    to = 1,
    ms = 400,
    delay = 0,
    ease: e = "outCubic",
    onUpdate,
    onDone,
  } = {}) {
    const fn = typeof e === "function" ? e : ease[e] || ease.outCubic;
    let resolve;
    const done = new Promise((r) => (resolve = r));
    const tw = {
      t: -delay / 1000,
      dur: Math.max(ms, 1) / 1000,
      from,
      to,
      fn,
      onUpdate,
      onDone,
      resolve,
      cancelled: false,
    };
    this.list.push(tw);
    return {
      done,
      cancel: () => {
        tw.cancelled = true;
      },
    };
  }
  update(dt) {
    if (!this.list.length) return;
    const keep = [];
    for (const tw of this.list) {
      if (tw.cancelled) {
        tw.resolve(false);
        continue;
      }
      tw.t += dt;
      if (tw.t < 0) {
        keep.push(tw);
        continue;
      }
      const k = clamp(tw.t / tw.dur);
      const v = lerp(tw.from, tw.to, tw.fn(k));
      tw.onUpdate?.(v, k);
      if (k >= 1) {
        tw.onDone?.();
        tw.resolve(true);
      } else keep.push(tw);
    }
    this.list = keep;
  }
  get size() {
    return this.list.length;
  }
  clear() {
    this.list.forEach((tw) => tw.resolve(false));
    this.list = [];
  }
}
