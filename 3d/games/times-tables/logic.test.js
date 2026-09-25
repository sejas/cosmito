import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  planetLayout,
  arrayCells,
  learnLayout,
  playLayout,
  resultsLayout,
  keypadKeys,
  padInput,
  jarSlot,
  rushBonusDue,
  beadsLeft,
  PracticeRound,
  colorOf,
  JAR_CAPACITY,
  MAX_BONUSES,
} from "./logic.js";

const L = createRequire(import.meta.url)(
  "../../../games/times-tables/js/questions.js",
);

// Deterministic random for repeatable rounds.
const seeded =
  (s = 7) =>
  () =>
    (s = (s * 16807) % 2147483647) / 2147483647;
const inside = (p, box, pad = 0) =>
  Math.abs(p.x - box.center[0]) <= box.width / 2 - pad &&
  Math.abs(p.y - box.center[1]) <= box.height / 2 - pad;

for (const [name, aspect] of [
  ["phone", 390 / 844],
  ["tablet", 768 / 1024],
  ["laptop", 1280 / 800],
]) {
  test(`planets (${name}): 10, apart, framed`, () => {
    const l = planetLayout(10, aspect);
    assert.equal(l.planets.length, 10);
    assert.equal(l.wide, aspect >= 1.05);
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++) {
        const a = l.planets[i];
        const b = l.planets[j];
        assert.ok(
          Math.hypot(a.x - b.x, a.y - b.y) >= 1.45,
          `${i + 1}/${j + 1} overlap`,
        );
      }
    for (const p of l.planets)
      assert.ok(inside(p, l.box, 0.5), "planet in view box");
    assert.ok(inside(l.buddy, l.box) && inside(l.jar, l.box));
    // buddy and jar don't sit on a planet
    for (const p of l.planets)
      for (const o of [l.buddy, l.jar])
        assert.ok(Math.hypot(p.x - o.x, p.y - (o.y + 1)) > 1.2);
  });

  test(`play layout (${name}): bubbles apart and framed, keypad framed`, () => {
    for (const mode of ["practice", "pro", "rush"]) {
      const l = playLayout(mode, aspect);
      assert.equal(l.bubbles.length, 4);
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++)
          assert.ok(
            Math.hypot(
              l.bubbles[i].x - l.bubbles[j].x,
              l.bubbles[i].y - l.bubbles[j].y,
            ) >= 1.75,
          );
      if (mode !== "pro")
        for (const b of l.bubbles) assert.ok(inside(b, l.box, 0.7));
      if (mode === "pro")
        for (const k of keypadKeys())
          assert.ok(
            inside({ x: l.keypad.x + k.x, y: l.keypad.y + k.y }, l.box, 0.4),
            `key ${k.key}`,
          );
      assert.ok(inside(l.buddy, l.box) && inside(l.jar, l.box));
    }
  });

  test(`learn layout (${name}): the full 10-row board fits for every table`, () => {
    for (let n = 1; n <= 10; n++) {
      const l = learnLayout(n, aspect);
      const a = arrayCells(n, 10);
      for (const c of [a.cells[0], a.cells.at(-1), a.labels.at(-1)])
        assert.ok(
          inside({ x: l.board.x + c.x, y: l.board.y + c.y }, l.box, 0.3),
          `table ${n}`,
        );
      assert.ok(inside(l.buddy, l.box));
    }
  });

  test(`results layout (${name}): stars above the buddy`, () => {
    const l = resultsLayout(aspect);
    assert.equal(l.stars.length, 3);
    for (const s of l.stars)
      assert.ok(s.y > l.buddy.y + 2.2 && inside(s, l.box, 0.4));
  });
}

test("arrayCells: rows × per cells, skip-count labels", () => {
  const a = arrayCells(7, 3);
  assert.equal(a.cells.length, 21);
  assert.deepEqual(
    a.labels.map((l) => l.value),
    [7, 14, 21],
  );
  assert.equal(a.cells[0].y, 0);
  assert.ok(a.cells.at(-1).y < 0, "rows go down");
  assert.ok(Math.abs(a.cells[0].x + a.cells[6].x) < 1e-9, "centred");
  assert.ok(a.labels[0].x > a.cells[6].x, "labels right of the row");
});

test("keypad: 12 keys, phone-pad order", () => {
  const k = keypadKeys();
  assert.deepEqual(k.map((x) => x.key).join(""), "123456789⌫0✓");
  assert.ok(k[0].y > k[9].y && k[0].x < k[2].x);
});

test("padInput mirrors the 2D pad", () => {
  assert.deepEqual(padInput("", "5"), { typed: "5", submit: false });
  assert.deepEqual(padInput("0", "7"), { typed: "7", submit: false });
  assert.deepEqual(padInput("123", "4"), { typed: "123", submit: false });
  assert.deepEqual(padInput("12", "⌫"), { typed: "1", submit: false });
  assert.deepEqual(padInput("", "✓"), { typed: "", submit: false });
  assert.deepEqual(padInput("56", "✓"), { typed: "56", submit: true });
  assert.deepEqual(padInput("5", "x"), { typed: "5", submit: false });
});

test("jar slots: distinct, inside the jar, stacking up", () => {
  const seen = new Set();
  for (let i = 0; i < JAR_CAPACITY; i++) {
    const s = jarSlot(i);
    assert.ok(Math.hypot(s.x, s.z) <= 0.32, "inside radius");
    assert.ok(s.y > 0 && s.y < 1.7, "inside height");
    seen.add(`${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)}`);
  }
  assert.equal(seen.size, JAR_CAPACITY);
  assert.ok(jarSlot(29).y > jarSlot(0).y);
});

test("rush: bonus every 5 in a row, capped; beads per second", () => {
  assert.ok(!rushBonusDue(0, 0));
  assert.ok(!rushBonusDue(4, 0));
  assert.ok(rushBonusDue(5, 0));
  assert.ok(rushBonusDue(10, MAX_BONUSES - 1));
  assert.ok(!rushBonusDue(10, MAX_BONUSES));
  assert.equal(beadsLeft(60000), 60);
  assert.equal(beadsLeft(63000), 60);
  assert.equal(beadsLeft(59001), 60);
  assert.equal(beadsLeft(58999), 59);
  assert.equal(beadsLeft(1), 1);
  assert.equal(beadsLeft(-5), 0);
});

test("colours cycle over the 10 tables", () => {
  assert.equal(colorOf(1), colorOf(11));
  assert.notEqual(colorOf(1), colorOf(2));
});

test("practice: all right on first try -> 3 stars, 10 questions", () => {
  const r = new PracticeRound(L, 7, seeded());
  let asked = 0;
  while (!r.done) {
    const q = r.next();
    asked++;
    assert.equal(q.a, 7);
    assert.ok(r.answer(q.answer).right);
  }
  assert.equal(asked, 10);
  assert.equal(r.firstTry, 10);
  assert.equal(r.stars, 3);
  assert.equal(r.solved, 10);
});

test("practice: a wrong answer is asked again two questions later", () => {
  const r = new PracticeRound(L, 3, seeded(3));
  const first = r.next();
  const res = r.answer(first.answer + 1);
  assert.deepEqual(res, { right: false, retry: true });
  assert.equal(first.state, "retry");
  const a = r.next();
  r.answer(a.answer);
  const b = r.next();
  r.answer(b.answer);
  assert.equal(r.next(), first, "comes back third");
  assert.ok(r.answer(first.answer).right);
  assert.equal(first.state, "fixed", "fixed, not first-try");
});

test("practice: after 3 misses a fact is not asked again", () => {
  const r = new PracticeRound(L, 2, seeded(5));
  const target = r.facts[0];
  let asked = 0;
  while (!r.done) {
    const q = r.next();
    if (q === target) asked++;
    r.answer(q === target ? -1 : q.answer);
  }
  assert.equal(asked, 3, "asked once + 2 retries");
  assert.equal(target.state, "fixed");
  assert.equal(r.firstTry, 9);
  assert.equal(r.stars, 3, "9 first-try → 3 stars");
});

test("practice: stars thresholds (≥9 → 3, ≥7 → 2, else 1)", () => {
  for (const [wrong, stars] of [
    [1, 3],
    [2, 2],
    [3, 2],
    [4, 1],
  ]) {
    const r = new PracticeRound(L, 4, seeded(wrong));
    let misses = wrong;
    const missed = new Set();
    while (!r.done) {
      const q = r.next();
      if (misses > 0 && !missed.has(q)) {
        missed.add(q);
        misses--;
        r.answer(-1);
      } else r.answer(q.answer);
    }
    assert.equal(r.firstTry, 10 - wrong);
    assert.equal(r.stars, stars);
  }
});
