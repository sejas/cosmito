// Pure logic for Times Tables 3D: layouts, the practice round, rush timing and
// keypad input. No three.js, no DOM, so it runs in node tests. The maths of
// the game itself (facts, choices, stars) is the 2D game's TTLogic, passed in.

export const RUSH_MS = 60000;
export const BONUS_MS = 3000;
export const MAX_BONUSES = 5; // at most +15 s per rush
export const JAR_CAPACITY = 30; // treats visible in the jar
export const TABLE_COLORS = [
  "#ff9fb8",
  "#ffb570",
  "#ffd84d",
  "#9be58a",
  "#6ee0c0",
  "#82c8ff",
  "#9fb0ff",
  "#c3a6ff",
  "#f7a1d0",
  "#ff9a8a",
];
export const colorOf = (n) => TABLE_COLORS[(n - 1) % TABLE_COLORS.length];

// Wide screens put things side by side; tall ones stack them.
export const isWide = (aspect) => aspect >= 1.05;

// ---------------------------------------------------------------- home
// Ten table planets + the buddy and its jar. Positions are world units on a
// vertical "wall" facing the camera (z is a little depth for parallax).
export function planetLayout(count = 10, aspect = 1) {
  const planets = [];
  if (isWide(aspect)) {
    const per = Math.ceil(count / 2);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / per);
      const col = i % per;
      planets.push({
        x: 1.55 + (col - (per - 1) / 2) * 1.8 + (row ? 0.35 : -0.35),
        y: row ? 1.25 : 3.05,
        z: row ? 0.35 : 0,
      });
    }
    return {
      wide: true,
      planets,
      buddy: { x: -5.0, y: 0, z: 0.3 },
      jar: { x: -3.3, y: 0, z: 0.6 },
      box: { center: [0.2, 1.95, 0], width: 14, height: 4.6 },
    };
  }
  // honeycomb 3 · 4 · 3 (any count: rows alternate 3 and 4)
  const rows = [];
  for (let left = count, k = 0; left > 0; k++) {
    const n = Math.min(left, k % 2 ? 4 : 3);
    rows.push(n);
    left -= n;
  }
  let i = 0;
  rows.forEach((n, r) => {
    for (let c = 0; c < n; c++, i++) {
      planets.push({
        x: (c - (n - 1) / 2) * 1.62,
        y: 3.45 + (rows.length - 1 - r) * 1.5,
        z: r % 2 ? 0.3 : 0,
      });
    }
  });
  const top = 3.45 + (rows.length - 1) * 1.5 + 0.9;
  return {
    wide: false,
    planets,
    buddy: { x: -1.25, y: 0, z: 0.9 },
    jar: { x: 1.3, y: 0, z: 1.1 },
    box: { center: [0, (top - 0.25) / 2, 0], width: 6.6, height: top + 0.25 },
  };
}

// ---------------------------------------------------------------- arrays
// Cells of a `rows` × `per` treat array (row 0 on top), centred on x, with
// `spacing` between treats. Also where each row's skip-count label goes.
export function arrayCells(per, rows, spacing = 1) {
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < per; c++)
      cells.push({
        row: r,
        col: c,
        x: (c - (per - 1) / 2) * spacing,
        y: r ? -r * spacing : 0,
      });
  const labels = Array.from({ length: rows }, (_, r) => ({
    row: r,
    value: per * (r + 1),
    x: (per / 2) * spacing + 0.75 * spacing,
    y: -r * spacing,
  }));
  return {
    cells,
    labels,
    width: per * spacing + 1.5 * spacing,
    height: rows * spacing,
  };
}

// Learn screen: the board always frames all 10 rows of the table so it grows
// downwards without the camera jumping; the buddy stands beside/below it.
export function learnLayout(per, aspect = 1) {
  const w = Math.max(per, 3) + 1.6; // + skip-count labels
  const board = { x: -0.8, y: 9.9, z: 0 }; // top row centre
  if (isWide(aspect)) {
    const left = board.x - w / 2 + 0.8;
    return {
      wide: true,
      board,
      buddy: { x: left - 1.9, y: 0.2, z: 1.2, s: 1.45 },
      box: { center: [board.x - 1.2, 5.1, 0], width: w + 4.6, height: 10.8 },
    };
  }
  return {
    wide: false,
    board,
    buddy: { x: board.x - w / 2 + 1.6, y: -2.85, z: 1.3, s: 1.15 },
    box: {
      center: [board.x + 0.35, 3.8, 0],
      width: Math.max(w + 0.4, 6.2),
      height: 13.4,
    },
  };
}

// ---------------------------------------------------------------- play
// mode: "practice" | "pro" | "rush". Pro uses the keypad, others 4 bubbles.
export function playLayout(mode, aspect = 1) {
  const pad = mode === "pro";
  if (isWide(aspect)) {
    const cx = 2.1;
    return {
      wide: true,
      s: 1,
      buddy: { x: -4.6, y: 0, z: 0.4 },
      jar: { x: -2.45, y: 0, z: 0.8 },
      bubbles: [0, 1, 2, 3].map((i) => ({
        x: cx + (i - 1.5) * 2.05,
        y: 1.75,
        z: 0,
      })),
      keypad: { x: cx, y: 1.75, z: 0 },
      hint: { x: cx, y: 1.8, z: 0.2, w: 7.4, h: 4.2 },
      ring: { x: -4.6, y: 1.15, z: -0.3 },
      box: {
        center: [-0.2, pad ? 1.75 : 1.7, 0],
        width: 12.8,
        height: pad ? 5 : 4.4,
      },
    };
  }
  // tall: buddy + jar on top (with headroom for the speech bubble), answers below
  const s = 0.85;
  const by = pad ? 3.55 : 2.75;
  return {
    wide: false,
    s,
    buddy: { x: -1.15, y: by, z: 0.4 },
    jar: { x: 1.15, y: by, z: 0.7 },
    bubbles: [0, 1, 2, 3].map((i) => ({
      x: (i % 2 ? 1 : -1) * 1.0,
      y: i < 2 ? 1.25 : -0.6,
      z: 0,
    })),
    keypad: { x: 0, y: 1.0, z: 0 },
    hint: pad
      ? { x: 0, y: 1.0, z: 0.2, w: 4.4, h: 4.0 }
      : { x: 0, y: 0.32, z: 0.2, w: 4.4, h: 3.4 },
    ring: { x: -1.15, y: by + 0.95, z: -0.3 },
    box: pad
      ? { center: [0, 2.55, 0], width: 4.6, height: 7.4 }
      : { center: [0, 2.02, 0], width: 4.6, height: 6.95 },
  };
}

// Results: a podium with the buddy on top, stars above, the jar beside it.
export function resultsLayout(aspect = 1) {
  const wide = isWide(aspect);
  return {
    wide,
    podium: { x: 0, y: 0, z: 0 },
    buddy: { x: 0, y: 1.05, z: 0 },
    jar: { x: 2.3, y: 0, z: 0.6 },
    stars: [-1, 0, 1].map((k) => ({
      x: k * 1.35,
      y: 5.05 + (k === 0 ? 0.35 : 0),
      z: 0.2,
    })),
    box: { center: [0.3, 2.95, 0], width: wide ? 7.5 : 5.8, height: 6.5 },
  };
}

// ---------------------------------------------------------------- keypad
export const KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "⌫",
  "0",
  "✓",
];
export function keypadKeys(spacing = 1.08) {
  return KEYS.map((k, i) => ({
    key: k,
    x: ((i % 3) - 1) * spacing,
    y: (1.5 - Math.floor(i / 3)) * spacing,
  }));
}
// Same rules as the 2D pad: up to 3 digits, no leading zero, ⌫ deletes,
// ✓ submits when something is typed.
export function padInput(typed, key) {
  if (key === "⌫") return { typed: typed.slice(0, -1), submit: false };
  if (key === "✓") return { typed, submit: typed.length > 0 };
  if (!/^[0-9]$/.test(key) || typed.length >= 3)
    return { typed, submit: false };
  return { typed: (typed === "0" ? "" : typed) + key, submit: false };
}

// ---------------------------------------------------------------- jar
// Where the i-th treat sits inside the jar: rings of 5 around a centre one,
// layer by layer, each with a playful (but deterministic) spin.
export function jarSlot(i) {
  const layer = Math.floor(i / 6);
  const k = i % 6;
  const off = (layer % 2) * 0.6;
  const a = k === 5 ? 0 : (k / 5) * Math.PI * 2 + off;
  const r = k === 5 ? 0 : 0.3;
  return {
    x: Math.cos(a) * r,
    y: 0.26 + layer * 0.27 + (k === 5 ? 0.12 : 0),
    z: Math.sin(a) * r,
    ry: i * 2.39996,
    rz: ((i * 7) % 5) * 0.25 - 0.5,
  };
}

// ---------------------------------------------------------------- rush
export const rushBonusDue = (streak, bonuses) =>
  streak > 0 && streak % 5 === 0 && bonuses < MAX_BONUSES;
// Beads on the timer ring: one per second left, at most 60.
export const beadsLeft = (msLeft, beads = 60) =>
  Math.max(0, Math.min(beads, Math.ceil(msLeft / 1000)));

// ---------------------------------------------------------------- practice
// A practice round with the 2D rules: 10 facts, a wrong answer is asked again
// two questions later (up to 2 retries), stars from first-try answers.
export class PracticeRound {
  constructor(L, n, rnd = Math.random) {
    this.L = L;
    this.n = n;
    this.facts = L.practiceRound(n, rnd).map((f, i) => ({
      ...f,
      dot: i,
      misses: 0,
      state: "",
    }));
    this.queue = this.facts.slice();
    this.q = null;
    this.firstTry = 0;
  }
  next() {
    this.q = this.queue.shift() || null;
    return this.q;
  }
  // -> { right, retry } and updates the fact's state ("good" | "fixed" | "retry")
  answer(v) {
    const q = this.q;
    if (v === q.answer) {
      if (q.misses === 0) {
        q.state = "good";
        this.firstTry++;
      } else q.state = "fixed";
      return { right: true, retry: false };
    }
    q.misses++;
    if (q.misses <= 2) {
      q.state = "retry";
      this.queue.splice(Math.min(this.queue.length, 2), 0, q);
      return { right: false, retry: true };
    }
    q.state = "fixed";
    return { right: false, retry: false };
  }
  get done() {
    return this.queue.length === 0;
  }
  get solved() {
    return this.facts.filter((f) => f.state === "good" || f.state === "fixed")
      .length;
  }
  get stars() {
    return this.L.starsFor(this.firstTry);
  }
}
