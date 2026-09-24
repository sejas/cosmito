// Pure logic for Color Lab: the colour list, the paint-mixing model, quiz and
// challenge generation, and stars. No DOM here, so it runs in Node tests too.
//
// Mixing model. Naive RGB averaging turns blue + yellow into grey, so we mix
// like paint instead:
//   1. The chromatic part (red, yellow, blue pots) is mixed in RYB space: the
//      counts are scaled so the largest is 1, then interpolated inside an RYB
//      cube whose corners are our named paints (red, yellow, blue, orange,
//      green, purple, brown). So red + yellow is exactly our orange, and
//      2 red + 1 yellow is a red-orange in between.
//   2. White and black then tint or shade that colour, like pigment: each pot
//      of white or black pulls the colour toward it by its weight.
//   3. The name comes from which pots are in the bowl, not from the pixels, so
//      it is stable and easy to test (one primary → that primary, two → the
//      secondary, all three → brown; more white than black → "light …",
//      more black → "dark …"; red + white is pink).
const ColorLab = (() => {
  // symbol: a shape drawn on every pot so colour is never the only cue.
  const COLORS = [
    { id: "red", hex: "#e21d44", symbol: "heart", en: "red", es: "rojo" },
    {
      id: "yellow",
      hex: "#ffd426",
      symbol: "star",
      en: "yellow",
      es: "amarillo",
    },
    { id: "blue", hex: "#1f6fe0", symbol: "drop", en: "blue", es: "azul" },
    {
      id: "orange",
      hex: "#ff8c1a",
      symbol: "triangle",
      en: "orange",
      es: "naranja",
    },
    { id: "green", hex: "#2db34a", symbol: "leaf", en: "green", es: "verde" },
    {
      id: "purple",
      hex: "#8e44b8",
      symbol: "diamond",
      en: "purple",
      es: "morado",
    },
    { id: "pink", hex: "#f0889d", symbol: "flower", en: "pink", es: "rosa" },
    {
      id: "brown",
      hex: "#8b5a2b",
      symbol: "square",
      en: "brown",
      es: "marrón",
    },
    { id: "black", hex: "#23232b", symbol: "moon", en: "black", es: "negro" },
    { id: "white", hex: "#ffffff", symbol: "cloud", en: "white", es: "blanco" },
    { id: "grey", hex: "#76767b", symbol: "ring", en: "grey", es: "gris" },
  ];
  const BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c]));
  // The pots in the mixing lab.
  const LAB_POTS = ["red", "yellow", "blue", "white", "black"];
  const MAX_PARTS = 4;
  const WHITE_WEIGHT = 0.9;
  const BLACK_WEIGHT = 1.5;

  // ---------- colour maths ----------
  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (rgb) =>
    "#" +
    rgb
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const distance = (a, b) => {
    const [x, y] = [hexToRgb(a), hexToRgb(b)];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // RYB cube corners, keyed "ryb" bits.
  const CORNERS = {
    100: "red",
    "010": "yellow",
    "001": "blue",
    110: "orange",
    "011": "green",
    101: "purple",
    111: "brown",
  };
  function rybToRgb(r, y, b) {
    const corner = (bits) =>
      bits === "000" ? [255, 255, 255] : hexToRgb(BY_ID[CORNERS[bits]].hex);
    const out = [0, 0, 0];
    for (const ri of [0, 1])
      for (const yi of [0, 1])
        for (const bi of [0, 1]) {
          const w = (ri ? r : 1 - r) * (yi ? y : 1 - y) * (bi ? b : 1 - b);
          if (!w) continue;
          const c = corner(`${ri}${yi}${bi}`);
          for (let k = 0; k < 3; k++) out[k] += c[k] * w;
        }
    return out;
  }

  // parts: array of pot ids (["red", "yellow"]) or counts ({red: 1, yellow: 1}).
  function countsOf(parts) {
    const c = { red: 0, yellow: 0, blue: 0, white: 0, black: 0 };
    if (Array.isArray(parts)) parts.forEach((p) => (c[p] += 1));
    else Object.assign(c, parts);
    return c;
  }

  // → { id: "orange" | "light-blue" | "dark-green" | …, hex } or null when empty.
  function mix(parts) {
    const { red: r, yellow: y, blue: b, white: w, black: k } = countsOf(parts);
    const chroma = r + y + b;
    if (!chroma && !w && !k) return null;

    // Name
    let id;
    if (!chroma) {
      if (!k) id = "white";
      else if (!w) id = "black";
      else id = w > k ? "light-grey" : k > w ? "dark-grey" : "grey";
    } else {
      const present = [r, y, b].filter(Boolean).length;
      let base;
      if (present === 3) base = "brown";
      else if (present === 1) base = r ? "red" : y ? "yellow" : "blue";
      else base = !b ? "orange" : !r ? "green" : "purple";
      if (w > k) id = base === "red" ? "pink" : `light-${base}`;
      else if (k > w) id = `dark-${base}`;
      else id = base;
    }

    // Colour
    let rgb;
    const total = chroma + w * WHITE_WEIGHT + k * BLACK_WEIGHT;
    if (chroma) {
      const m = Math.max(r, y, b);
      rgb = rybToRgb(r / m, y / m, b / m);
    } else {
      rgb = [255, 255, 255];
    }
    const black = hexToRgb(BY_ID.black.hex);
    if (chroma) {
      rgb = rgb.map(
        (v, i) =>
          (v * chroma + 255 * w * WHITE_WEIGHT + black[i] * k * BLACK_WEIGHT) /
          total,
      );
    } else if (k) {
      const t = (k * BLACK_WEIGHT) / (w * WHITE_WEIGHT + k * BLACK_WEIGHT);
      rgb = lerp([255, 255, 255], black, t);
    }
    return { id, hex: rgbToHex(rgb) };
  }

  // Display name of any mix id in a language: "light blue" / "azul claro".
  function nameOf(id, lang = "en") {
    const m = /^(light|dark)-(.+)$/.exec(id);
    const base = BY_ID[m ? m[2] : id];
    if (!base) return id;
    const n = base[lang] ?? base.en;
    if (!m) return n;
    if (lang === "es") return `${n} ${m[1] === "light" ? "claro" : "oscuro"}`;
    return `${m[1]} ${n}`;
  }

  // Swatch colour for any mix id (named colours use their own hex).
  function hexOf(id) {
    if (BY_ID[id]) return BY_ID[id].hex;
    const recipe = RECIPES[id];
    return recipe ? mix(recipe).hex : "#cccccc";
  }

  // The closest named colour to a hex (used to paint the buddy picture in the
  // buddy's own colour).
  function nearest(hex) {
    let best = COLORS[0];
    for (const c of COLORS)
      if (distance(c.hex, hex) < distance(best.hex, hex)) best = c;
    return best.id;
  }

  // ---------- discoveries & challenges ----------
  // A simple recipe for every colour kids can discover or be asked for.
  const RECIPES = {
    orange: ["red", "yellow"],
    green: ["yellow", "blue"],
    purple: ["red", "blue"],
    pink: ["red", "white"],
    grey: ["white", "black"],
    brown: ["red", "yellow", "blue"],
    "light-blue": ["blue", "white"],
    "dark-blue": ["blue", "black"],
    "light-green": ["yellow", "blue", "white"],
    "dark-green": ["yellow", "blue", "black"],
    "dark-red": ["red", "black"],
    "light-purple": ["red", "blue", "white"],
    "light-yellow": ["yellow", "white"],
  };
  // The lab's collection shelf, in order.
  const DISCOVERIES = [
    "orange",
    "green",
    "purple",
    "pink",
    "brown",
    "grey",
    "light-blue",
    "dark-blue",
    "light-green",
  ];
  // Challenge sets: "make this colour".
  const CHALLENGE_SETS = [
    {
      id: "mix1",
      icon: "🎯",
      pool: ["orange", "green", "purple", "pink", "grey", "light-blue"],
    },
    {
      id: "mix2",
      icon: "🏆",
      pool: [
        "brown",
        "dark-blue",
        "light-green",
        "dark-green",
        "dark-red",
        "light-purple",
      ],
    },
  ];
  const CHALLENGES_PER_ROUND = 5;

  // Shortest list of lab pots that makes `id` (breadth-first), or null.
  function solve(id, maxParts = MAX_PARTS) {
    let layer = [[]];
    for (let n = 1; n <= maxParts; n++) {
      const next = [];
      for (const parts of layer)
        for (const p of LAB_POTS) {
          // Keep pots in LAB_POTS order so each multiset is tried once.
          if (
            parts.length &&
            LAB_POTS.indexOf(p) < LAB_POTS.indexOf(parts[parts.length - 1])
          )
            continue;
          const cand = [...parts, p];
          if (mix(cand).id === id) return cand;
          next.push(cand);
        }
      layer = next;
    }
    return null;
  }

  // ---------- random helpers (rng injectable for tests) ----------
  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function challengeRound(setId, rng = Math.random) {
    const set = CHALLENGE_SETS.find((s) => s.id === setId);
    return shuffle(set.pool, rng)
      .slice(0, CHALLENGES_PER_ROUND)
      .map((target) => ({ target, recipe: RECIPES[target] }));
  }

  // ---------- colour-name quizzes ----------
  // Things whose colour every child knows (emoji).
  const THINGS = [
    { icon: "🍓", color: "red" },
    { icon: "🍎", color: "red" },
    { icon: "🍌", color: "yellow" },
    { icon: "🐤", color: "yellow" },
    { icon: "🐳", color: "blue" },
    { icon: "🫐", color: "blue" },
    { icon: "🐸", color: "green" },
    { icon: "🥦", color: "green" },
    { icon: "🍊", color: "orange" },
    { icon: "🥕", color: "orange" },
    { icon: "🍇", color: "purple" },
    { icon: "🍆", color: "purple" },
    { icon: "🐷", color: "pink" },
    { icon: "🌸", color: "pink" },
    { icon: "🐻", color: "brown" },
    { icon: "🍫", color: "brown" },
    { icon: "🎱", color: "black" },
    { icon: "🐧", color: "black" },
    { icon: "☁️", color: "white" },
    { icon: "🥚", color: "white" },
    { icon: "🐘", color: "grey" },
    { icon: "🐭", color: "grey" },
  ];
  const QUIZZES = [
    { id: "find", icon: "👂" },
    { id: "things", icon: "🍓" },
    { id: "name", icon: "🔤" },
  ];
  const QUESTIONS = 8;

  // Each question: { answer: colourId, options: [colourIds], thing? }.
  // Early questions have 3 options, later ones 4 (a gentle ramp).
  function quizRound(kind, rng = Math.random, n = QUESTIONS) {
    const ids = COLORS.map((c) => c.id);
    const out = [];
    let bag = [];
    for (let i = 0; i < n; i++) {
      let q;
      if (kind === "things") {
        if (!bag.length) bag = shuffle(THINGS, rng);
        let thing = bag.pop();
        // Avoid the same colour twice in a row.
        if (
          out.length &&
          out[out.length - 1].answer === thing.color &&
          bag.length
        ) {
          bag.unshift(thing);
          thing = bag.pop();
        }
        q = { answer: thing.color, thing: thing.icon };
      } else {
        if (!bag.length) bag = shuffle(ids, rng);
        let answer = bag.pop();
        if (out.length && out[out.length - 1].answer === answer && bag.length) {
          bag.unshift(answer);
          answer = bag.pop();
        }
        q = { answer };
      }
      const count = i < 3 ? 3 : 4;
      const others = shuffle(
        ids.filter((id) => id !== q.answer),
        rng,
      ).slice(0, count - 1);
      q.options = shuffle([q.answer, ...others], rng);
      out.push(q);
    }
    return out;
  }

  // ---------- stars ----------
  // Never zero for finishing: no failure states for little ones.
  function starsFor(mistakes) {
    return mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
  }
  function labStars(found) {
    const n = DISCOVERIES.filter((id) => found.includes(id)).length;
    return n >= DISCOVERIES.length ? 3 : n >= 6 ? 2 : n >= 3 ? 1 : 0;
  }
  function totalStars(best) {
    return Object.values(best).reduce((s, v) => s + Math.min(3, v || 0), 0);
  }

  return {
    COLORS,
    BY_ID,
    LAB_POTS,
    MAX_PARTS,
    RECIPES,
    DISCOVERIES,
    CHALLENGE_SETS,
    CHALLENGES_PER_ROUND,
    THINGS,
    QUIZZES,
    QUESTIONS,
    hexToRgb,
    rgbToHex,
    distance,
    mix,
    nameOf,
    hexOf,
    nearest,
    solve,
    shuffle,
    challengeRound,
    quizRound,
    starsFor,
    labStars,
    totalStars,
  };
})();

if (typeof module !== "undefined") module.exports = ColorLab;
