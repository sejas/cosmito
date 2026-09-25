// Pure logic for "Tell the Time": no DOM, testable with node.
//
// A time on the clock face is `t`: minutes after twelve o'clock on a 12-hour
// dial (0..719). 3:30 is 210. Times of day (for "My day") are `t24`: minutes
// after midnight (0..1439).
(function (root) {
  "use strict";

  const DIAL = 720;
  const DAY = 1440;

  // Difficulty levels. `step` is the snapping step (minutes) of the hands and
  // of every question in the level; `fresh` are the minutes the level
  // introduces (asked more often).
  const LEVELS = [
    { id: "oclock", step: 60, emoji: "🕐", fresh: [0] },
    { id: "half", step: 30, emoji: "🕧", fresh: [30] },
    { id: "quarter", step: 15, emoji: "🕒", fresh: [15, 45] },
    {
      id: "five",
      step: 5,
      emoji: "🕔",
      fresh: [5, 10, 20, 25, 35, 40, 50, 55],
    },
    { id: "minute", step: 1, emoji: "⏱️", fresh: null }, // null: any non-multiple of 5
  ];
  const MODES = ["read", "set", "digital", "day"];
  const ROUND = 8; // questions per round (read, set, digital)
  const MAX_STARS = MODES.length * LEVELS.length * 3;

  // ---------- basics ----------
  const mod = (n, m) => ((n % m) + m) % m;
  const norm = (t) => mod(Math.round(t), DIAL);
  const hourOf = (t) => Math.floor(norm(t) / 60) || 12; // 1..12
  const minuteOf = (t) => norm(t) % 60;
  // make(3, 30) → 210. Any integer hour works (0 and 12 are both twelve).
  const make = (h, m) => norm(mod(h, 12) * 60 + m);
  const nextHour = (h) => (h % 12) + 1;
  const pad2 = (n) => String(n).padStart(2, "0");
  const digital = (t) => `${hourOf(t)}:${pad2(minuteOf(t))}`;

  // ---------- angles (degrees clockwise from 12) ----------
  const minuteAngle = (t) => minuteOf(t) * 6;
  const hourAngle = (t) => norm(t) * 0.5;

  // Angle of a point relative to the clock centre (screen coords: y down).
  function pointAngle(dx, dy) {
    const a = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return mod(a, 360);
  }

  // Shortest signed turn from angle a to angle b, in (-180, 180].
  function angleDiff(a, b) {
    const d = mod(b - a, 360);
    return d > 180 ? d - 360 : d;
  }

  // Round to the nearest multiple of `step` minutes.
  const snap = (t, step = 1) => norm(Math.round(t / step) * step);

  // Minute (0..59) the minute hand points at, snapped to `step`.
  const minuteFromAngle = (angle, step = 1) =>
    mod(Math.round(mod(angle, 360) / 6 / step) * step, 60);

  // Drag the minute hand to `angle`: the hour follows when it crosses 12,
  // like a real clock (going past 12 clockwise moves to the next hour).
  function dragMinute(t, angle, step = 1) {
    const m = minuteFromAngle(angle, step);
    let d = m - minuteOf(t);
    if (d > 30) d -= 60;
    if (d <= -30) d += 60;
    return norm(t + d);
  }

  // Drag the hour hand to `angle`: picks the hour whose hand position (which
  // includes the minutes' offset) is closest, keeping the minutes.
  function dragHour(t, angle) {
    const m = minuteOf(t);
    const h = mod(Math.round((mod(angle, 360) - m * 0.5) / 30), 12);
    return make(h, m);
  }

  // +/- buttons. part "h" moves one hour; part "m" moves to the next/previous
  // multiple of `step` (3:07 +5 → 3:10), carrying into the hour.
  function nudge(t, part, dir, step = 1) {
    if (part === "h") return norm(t + dir * 60);
    const base =
      dir > 0
        ? Math.floor(t / step) * step + step
        : Math.ceil(t / step) * step - step;
    return norm(base);
  }

  // Which hand a touch grabs. `r` is the distance from the centre in face
  // units (the rim is 100). Only the minute hand reaches the outer ring;
  // inside it the hour hand wins unless the minute hand is clearly closer,
  // so overlapping hands never make the short one impossible to grab.
  const HOUR_REACH = 66;
  function pickHand(t, angle, r = 0) {
    if (r > HOUR_REACH) return "m";
    const dm = Math.abs(angleDiff(minuteAngle(t), angle));
    const dh = Math.abs(angleDiff(hourAngle(t), angle));
    return dh <= dm + 20 ? "h" : "m";
  }

  // ---------- phrasing ----------
  const EN = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "twenty-one",
    "twenty-two",
    "twenty-three",
    "twenty-four",
    "twenty-five",
    "twenty-six",
    "twenty-seven",
    "twenty-eight",
    "twenty-nine",
  ];
  const ES = [
    "cero",
    "una",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
    "veinte",
    "veintiuno",
    "veintidós",
    "veintitrés",
    "veinticuatro",
    "veinticinco",
    "veintiséis",
    "veintisiete",
    "veintiocho",
    "veintinueve",
  ];

  // Part of the day for a time of day (t24). Used for "in the morning",
  // "de la tarde"… Each language splits the day its own way.
  function periodOf(t24, lang = "en") {
    const x = mod(t24, DAY);
    if (lang === "es") {
      if (x === 0) return "midnight";
      if (x === 720) return "noon";
      if (x >= 60 && x < 360) return "dawn"; // de la madrugada
      if (x >= 360 && x < 720) return "morning";
      if (x >= 720 && x < 840) return "noon"; // del mediodía (12:00–13:59)
      if (x >= 840 && x < 1260) return "afternoon"; // de la tarde (14:00–20:59)
      return "night";
    }
    if (x === 0) return "midnight";
    if (x === 720) return "noon";
    if (x >= 300 && x < 720) return "morning";
    if (x >= 720 && x < 1080) return "afternoon";
    if (x >= 1080 && x < 1260) return "evening";
    return "night";
  }

  const EN_PERIOD = {
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night",
    dawn: "at night",
  };
  const ES_PERIOD = {
    dawn: "de la madrugada",
    morning: "de la mañana",
    noon: "del mediodía",
    afternoon: "de la tarde",
    night: "de la noche",
    midnight: "de la noche",
  };

  function enMinutes(n) {
    if (n % 5 === 0) return EN[n];
    return n === 1 ? "one minute" : `${EN[n]} minutes`;
  }

  // "half past three", "quarter to five", "ten past two", "twelve o'clock".
  // With a time of day: "seven o'clock in the morning", "twelve noon".
  function sayEn(t, t24) {
    const h = hourOf(t);
    const m = minuteOf(t);
    const nx = nextHour(h);
    const period = t24 == null ? null : periodOf(t24, "en");
    if (period === "noon") return "twelve noon";
    if (period === "midnight") return "twelve midnight";
    let s;
    if (m === 0) s = `${EN[h]} o'clock`;
    else if (m === 15) s = `quarter past ${EN[h]}`;
    else if (m === 30) s = `half past ${EN[h]}`;
    else if (m === 45) s = `quarter to ${EN[nx]}`;
    else if (m < 30) s = `${enMinutes(m)} past ${EN[h]}`;
    else s = `${enMinutes(60 - m)} to ${EN[nx]}`;
    return period ? `${s} ${EN_PERIOD[period]}` : s;
  }

  const esHour = (h) => `${h === 1 ? "la" : "las"} ${ES[h]}`;
  const esMinutes = (n) => (n === 1 ? "un minuto" : ES[n]);

  // "las tres y media", "las cinco menos cuarto", "la una en punto".
  // With a time of day: "las siete de la mañana", "las doce del mediodía".
  function sayEs(t, t24) {
    const h = hourOf(t);
    const m = minuteOf(t);
    const nx = nextHour(h);
    const period = t24 == null ? null : periodOf(t24, "es");
    let s;
    if (m === 0) s = period ? esHour(h) : `${esHour(h)} en punto`;
    else if (m === 15) s = `${esHour(h)} y cuarto`;
    else if (m === 30) s = `${esHour(h)} y media`;
    else if (m === 45) s = `${esHour(nx)} menos cuarto`;
    else if (m < 30) s = `${esHour(h)} y ${esMinutes(m)}`;
    else s = `${esHour(nx)} menos ${esMinutes(60 - m)}`;
    return period ? `${s} ${ES_PERIOD[period]}` : s;
  }

  // The time in words, lowercase (callers capitalise when it starts a line).
  // Pass t24 to add the part of the day.
  function say(t, lang = "en", t24 = null) {
    return lang === "es" ? sayEs(t, t24) : sayEn(t, t24);
  }

  // A full sentence: "It's half past three." / "Son las tres y media." /
  // "Es la una y cuarto."
  function sentence(t, lang = "en", t24 = null) {
    const p = say(t, lang, t24);
    if (lang === "es") return `${p.startsWith("la ") ? "Es" : "Son"} ${p}.`;
    return `It's ${p}.`;
  }

  // ---------- questions ----------
  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const levelAt = (i) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];

  // Minutes (0..59) that can appear in a level.
  function minutePool(li) {
    const { step } = levelAt(li);
    return Array.from({ length: 60 / step }, (_, i) => i * step);
  }
  const inLevel = (t, li) => minuteOf(t) % levelAt(li).step === 0;

  function freshMinutes(li) {
    const lv = levelAt(li);
    return lv.fresh || minutePool(li).filter((m) => m % 5 !== 0);
  }

  // A random time for the level: 70% use the minutes the level introduces.
  function randomTime(li, rnd = Math.random) {
    const pool = rnd() < 0.7 ? freshMinutes(li) : minutePool(li);
    const m = pool[Math.floor(rnd() * pool.length)];
    const h = 1 + Math.floor(rnd() * 12);
    return make(h, m);
  }

  // `n` distinct times; consecutive questions never share the hour.
  function round(li, n = ROUND, rnd = Math.random) {
    const out = [];
    for (let tries = 0; out.length < n && tries < 500; tries++) {
      const t = randomTime(li, rnd);
      const prev = out[out.length - 1];
      if (out.includes(t)) continue;
      if (prev != null && hourOf(prev) === hourOf(t) && tries < 400) continue;
      out.push(t);
    }
    return out;
  }

  // Wrong answers a child could really give, all valid for the level:
  // hour off by one (the classic "quarter to" slip), past/to mixed up,
  // hands swapped, left-right mirror, a neighbouring step.
  function distractors(t, li, n = 3, rnd = Math.random) {
    const h = hourOf(t);
    const m = minuteOf(t);
    const { step } = levelAt(li);
    // Most likely slips first: hour off by one, "past" and "to" swapped.
    const likely = [make(h + 1, m), make(h - 1, m)];
    if (m !== 0 && m !== 30)
      likely.push(m < 30 ? make(h - 1, 60 - m) : make(h + 1, 60 - m));
    const other = [];
    if (m !== 0 && m !== 30) other.push(make(h, 60 - m));
    if (m % 5 === 0 && m !== 0) other.push(make(m / 5, (h % 12) * 5)); // hands swapped
    other.push(make(12 - h, m)); // mirror: 3 ↔ 9
    if (step < 60) other.push(make(h, m + step), make(h, m - step));
    const weak = [
      make(h + 2, m),
      make(h - 2, m),
      make(h + 6, m),
      make(h, m + 2 * step),
    ];
    const ok = (v, list) => v !== t && inLevel(v, li) && !list.includes(v);
    const out = [];
    const [first, ...rest] = shuffle(likely, rnd);
    if (ok(first, out)) out.push(first);
    for (const v of shuffle(rest.concat(other), rnd))
      if (out.length < n && ok(v, out)) out.push(v);
    for (const v of weak) if (out.length < n && ok(v, out)) out.push(v);
    for (let k = 0; out.length < n && k < 1000; k++) {
      const v = randomTime(li, rnd);
      if (ok(v, out)) out.push(v);
    }
    return out;
  }

  // Answer options (3 on the first two levels, 4 afterwards), shuffled.
  const optionCount = (li) => (li < 2 ? 3 : 4);
  function choices(t, li, rnd = Math.random) {
    return shuffle([t, ...distractors(t, li, optionCount(li) - 1, rnd)], rnd);
  }

  // Stars from first-try answers: at most one slip → 3, three → 2, else 1.
  function starsFor(firstTry, total = ROUND) {
    const misses = total - firstTry;
    if (misses <= 1) return 3;
    if (misses <= 3) return 2;
    return 1;
  }

  const starKey = (mode, li) => `${mode}-${li}`;
  function totalStars(best) {
    let s = 0;
    for (const mode of MODES)
      for (let li = 0; li < LEVELS.length; li++)
        s += Math.min(3, (best && best[starKey(mode, li)]) || 0);
    return s;
  }

  // ---------- My day ----------
  // The buddy's routine. `at` holds the time of day for each level, in order,
  // so every scene is valid for its level and the day moves forward.
  const hm = (h, m) => h * 60 + m;
  const DAY_SCENES = [
    {
      id: "wake",
      emoji: "⏰",
      at: [hm(7, 0), hm(7, 30), hm(7, 15), hm(7, 5), hm(7, 12)],
    },
    {
      id: "breakfast",
      emoji: "🥣",
      at: [hm(8, 0), hm(8, 0), hm(7, 45), hm(7, 40), hm(7, 38)],
    },
    {
      id: "school",
      emoji: "🏫",
      at: [hm(9, 0), hm(8, 30), hm(8, 45), hm(8, 55), hm(8, 53)],
    },
    {
      id: "lunch",
      emoji: "🍝",
      at: [hm(13, 0), hm(12, 30), hm(13, 15), hm(13, 20), hm(13, 17)],
    },
    {
      id: "park",
      emoji: "🛝",
      at: [hm(16, 0), hm(16, 30), hm(16, 45), hm(16, 35), hm(16, 41)],
    },
    {
      id: "bath",
      emoji: "🛁",
      at: [hm(18, 0), hm(18, 30), hm(18, 45), hm(18, 50), hm(18, 48)],
    },
    {
      id: "bed",
      emoji: "🌙",
      at: [hm(20, 0), hm(20, 30), hm(20, 15), hm(20, 25), hm(20, 34)],
    },
  ];

  function dayRound(li) {
    const i = Math.max(0, Math.min(LEVELS.length - 1, li));
    return DAY_SCENES.map((s) => ({
      id: s.id,
      emoji: s.emoji,
      t24: s.at[i],
      t: norm(s.at[i]),
    }));
  }

  // The time of day a 12-hour dial reading means, picking the half of the
  // day closest to `ref24` (so moving the hands at bath time stays evening).
  function nearest24(t, ref24) {
    const a = norm(t);
    const b = a + DIAL;
    const dist = (x) => {
      const d = mod(x - ref24, DAY);
      return Math.min(d, DAY - d);
    };
    return dist(a) <= dist(b) ? a : b;
  }

  // Sky for a time of day: phase and where the sun/moon sits on its arc
  // (0 = rising on the left, 1 = setting on the right).
  function skyAt(t24) {
    const x = mod(t24, DAY);
    let phase;
    if (x < hm(6, 0) || x >= hm(20, 0)) phase = "night";
    else if (x < hm(8, 0)) phase = "dawn";
    else if (x < hm(18, 0)) phase = "day";
    else phase = "dusk";
    let arc;
    if (x >= hm(6, 0) && x < hm(20, 0))
      arc = (x - hm(6, 0)) / (hm(20, 0) - hm(6, 0));
    else arc = mod(x - hm(20, 0), DAY) / (DAY - (hm(20, 0) - hm(6, 0)));
    return { phase, arc, sun: phase !== "night" };
  }

  const api = {
    DIAL,
    LEVELS,
    MODES,
    ROUND,
    MAX_STARS,
    DAY_SCENES,
    norm,
    hourOf,
    minuteOf,
    make,
    digital,
    minuteAngle,
    hourAngle,
    pointAngle,
    angleDiff,
    snap,
    minuteFromAngle,
    dragMinute,
    dragHour,
    nudge,
    pickHand,
    periodOf,
    say,
    sentence,
    shuffle,
    minutePool,
    inLevel,
    randomTime,
    round,
    distractors,
    optionCount,
    choices,
    starsFor,
    starKey,
    totalStars,
    dayRound,
    nearest24,
    skyAt,
  };
  root.ClockLogic = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
