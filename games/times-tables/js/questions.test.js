// Run: node --test games/times-tables/js/
const test = require("node:test");
const assert = require("node:assert");
const L = require("./questions.js");

// Deterministic PRNG so failures are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("practice round: 10 unique facts covering ×1..×10", () => {
  for (const n of L.TABLES) {
    const round = L.practiceRound(n, seeded(n));
    assert.strictEqual(round.length, 10);
    const bs = round.map((q) => q.b).sort((x, y) => x - y);
    assert.deepStrictEqual(bs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const q of round) {
      assert.strictEqual(q.a, n);
      assert.strictEqual(q.answer, n * q.b);
    }
  }
});

test("practice round is shuffled (not always in order)", () => {
  const rnd = seeded(42);
  const inOrder = Array.from({ length: 20 }, () =>
    L.practiceRound(5, rnd),
  ).filter((r) => r.every((q, i) => q.b === i + 1)).length;
  assert.ok(inOrder < 20);
});

test("distractors: 3 distinct positive integers, never the answer", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const rnd = seeded(seed);
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const d = L.distractors(a, b, rnd);
        assert.strictEqual(d.length, 3, `${a}x${b}`);
        assert.strictEqual(new Set(d).size, 3, `${a}x${b} distinct`);
        for (const v of d) {
          assert.ok(Number.isInteger(v) && v > 0, `${a}x${b} positive: ${v}`);
          assert.notStrictEqual(v, a * b, `${a}x${b} excludes answer`);
        }
      }
    }
  }
});

test("distractors are plausible (close to the answer)", () => {
  const d = L.distractors(7, 8, seeded(3));
  for (const v of d) assert.ok(Math.abs(v - 56) <= 10, `${v} near 56`);
});

test("choices: 4 distinct options including the answer", () => {
  const rnd = seeded(9);
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      const c = L.choices(a, b, rnd);
      assert.strictEqual(c.length, 4);
      assert.strictEqual(new Set(c).size, 4);
      assert.ok(c.includes(a * b));
    }
  }
});

test("stars thresholds", () => {
  assert.strictEqual(L.starsFor(10), 3);
  assert.strictEqual(L.starsFor(9), 3);
  assert.strictEqual(L.starsFor(8), 2);
  assert.strictEqual(L.starsFor(7), 2);
  assert.strictEqual(L.starsFor(6), 1);
  assert.strictEqual(L.starsFor(0), 1);
});

test("rush questions come from chosen tables and never repeat back-to-back", () => {
  const rnd = seeded(7);
  let prev = null;
  for (let i = 0; i < 500; i++) {
    const q = L.rushQuestion([3, 7], prev, rnd);
    assert.ok([3, 7].includes(q.a));
    assert.ok(q.b >= 1 && q.b <= 10);
    assert.strictEqual(q.answer, q.a * q.b);
    if (prev) assert.ok(prev.a !== q.a || prev.b !== q.b);
    prev = q;
  }
});

test("rush with no tables uses all 1–10", () => {
  const rnd = seeded(11);
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(L.rushQuestion([], null, rnd).a);
  assert.strictEqual(seen.size, 10);
});

test("rush never repeats even with an always-same random source", () => {
  const prev = { a: 4, b: 1, answer: 4 };
  const q = L.rushQuestion([4], prev, () => 0);
  assert.ok(q.a !== prev.a || q.b !== prev.b);
});

test("skip counting and totals", () => {
  assert.deepStrictEqual(L.skipCount(3, 4), [3, 6, 9, 12]);
  assert.strictEqual(L.skipCount(10).length, 10);
  assert.strictEqual(L.totalStars({ 1: 3, 2: 2, 5: 1 }), 6);
  assert.strictEqual(L.totalStars({}), 0);
  assert.strictEqual(L.MAX_STARS, 30);
  assert.strictEqual(L.rankIndex(0), 0);
  assert.strictEqual(L.rankIndex(3), 1);
  assert.strictEqual(L.rankIndex(30), L.RANK_AT.length - 1);
});
