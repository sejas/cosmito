// Pure game logic for "Times Tables with Bollo": no DOM, testable with node.
(function (root) {
  "use strict";

  const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ROUND = 10; // facts per practice round
  const MAX_STARS = TABLES.length * 3;
  // Rank thresholds (total stars) — titles live in the i18n dictionary.
  const RANK_AT = [0, 3, 8, 15, 22, 30];

  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fact(a, b) {
    return { a, b, answer: a * b };
  }

  // n×1 … n×10, shuffled.
  function practiceRound(n, rnd = Math.random) {
    return shuffle(
      TABLES.map((b) => fact(n, b)),
      rnd,
    );
  }

  // Three wrong answers a child could plausibly give: neighbours in the table,
  // neighbouring tables, swapped digits, off-by-one. All distinct and positive.
  function distractors(a, b, rnd = Math.random) {
    const ans = a * b;
    const near = [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b];
    if (ans >= 10) {
      const s = String(ans);
      const swapped = Number(s.split("").reverse().join(""));
      if (s[s.length - 1] !== "0") near.push(swapped);
    }
    const far = [
      ans + 1,
      ans - 1,
      ans + 2,
      ans - 2,
      ans + 10,
      ans - 10,
      ans + 3,
    ];
    const ok = (v, list) =>
      Number.isInteger(v) && v > 0 && v !== ans && !list.includes(v);
    const out = [];
    for (const v of shuffle(near, rnd))
      if (out.length < 3 && ok(v, out)) out.push(v);
    for (const v of far) if (out.length < 3 && ok(v, out)) out.push(v);
    for (let k = 4; out.length < 3; k++)
      if (ok(ans + k, out)) out.push(ans + k);
    return out;
  }

  // Four shuffled options including the answer.
  function choices(a, b, rnd = Math.random) {
    return shuffle([a * b, ...distractors(a, b, rnd)], rnd);
  }

  // Stars for a finished practice round, from first-try correct answers.
  function starsFor(firstTry) {
    if (firstTry >= 9) return 3;
    if (firstTry >= 7) return 2;
    return 1;
  }

  // Random fact from the chosen tables, never the same as the previous one.
  function rushQuestion(tables, prev, rnd = Math.random) {
    const pool = tables && tables.length ? tables : TABLES;
    for (let tries = 0; tries < 20; tries++) {
      const a = pool[Math.floor(rnd() * pool.length)];
      const b = 1 + Math.floor(rnd() * 10);
      if (!prev || prev.a !== a || prev.b !== b) return fact(a, b);
    }
    const a = pool[0];
    const b = prev && prev.a === a && prev.b < 10 ? prev.b + 1 : 1;
    return fact(a, b);
  }

  // Skip counting: n, 2n, … upto·n.
  function skipCount(n, upto = 10) {
    return Array.from({ length: upto }, (_, i) => n * (i + 1));
  }

  function totalStars(best) {
    return TABLES.reduce((s, n) => s + Math.min(3, (best && best[n]) || 0), 0);
  }

  // Index into RANK_AT for a star total.
  function rankIndex(stars) {
    let i = 0;
    while (i + 1 < RANK_AT.length && stars >= RANK_AT[i + 1]) i++;
    return i;
  }

  const api = {
    TABLES,
    ROUND,
    MAX_STARS,
    RANK_AT,
    shuffle,
    practiceRound,
    distractors,
    choices,
    starsFor,
    rushQuestion,
    skipCount,
    totalStars,
    rankIndex,
  };
  root.TTLogic = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
