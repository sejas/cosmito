// Run: node --test games/clock/js/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const L = require("./time.js");

// Deterministic PRNG so failures are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const T = (h, m) => L.make(h, m);

test("make / hourOf / minuteOf / digital", () => {
  assert.strictEqual(T(3, 30), 210);
  assert.strictEqual(T(12, 0), 0);
  assert.strictEqual(T(0, 0), 0);
  assert.strictEqual(L.hourOf(0), 12);
  assert.strictEqual(L.hourOf(T(12, 45)), 12);
  assert.strictEqual(L.hourOf(T(1, 0)), 1);
  assert.strictEqual(L.minuteOf(T(4, 45)), 45);
  assert.strictEqual(L.digital(T(4, 5)), "4:05");
  assert.strictEqual(L.digital(0), "12:00");
  assert.strictEqual(L.norm(-15), 705);
  assert.strictEqual(L.norm(720 + 61), 61);
});

test("hand angles", () => {
  assert.strictEqual(L.minuteAngle(T(3, 0)), 0);
  assert.strictEqual(L.minuteAngle(T(3, 15)), 90);
  assert.strictEqual(L.minuteAngle(T(3, 30)), 180);
  assert.strictEqual(L.minuteAngle(T(3, 45)), 270);
  assert.strictEqual(L.hourAngle(T(3, 0)), 90);
  assert.strictEqual(L.hourAngle(T(3, 30)), 105); // halfway to 4
  assert.strictEqual(L.hourAngle(T(12, 0)), 0);
  assert.strictEqual(L.hourAngle(T(6, 0)), 180);
  assert.strictEqual(L.hourAngle(T(11, 45)), 352.5);
});

test("pointAngle: screen coordinates, clockwise from 12", () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  close(L.pointAngle(0, -10), 0); // up
  close(L.pointAngle(10, 0), 90); // right
  close(L.pointAngle(0, 10), 180); // down
  close(L.pointAngle(-10, 0), 270); // left
  close(L.pointAngle(10, -10), 45);
});

test("angleDiff is the shortest signed turn", () => {
  assert.strictEqual(L.angleDiff(350, 10), 20);
  assert.strictEqual(L.angleDiff(10, 350), -20);
  assert.strictEqual(L.angleDiff(0, 180), 180);
  assert.strictEqual(L.angleDiff(90, 90), 0);
});

test("snap to steps", () => {
  assert.strictEqual(L.snap(T(3, 7), 5), T(3, 5));
  assert.strictEqual(L.snap(T(3, 8), 5), T(3, 10));
  assert.strictEqual(L.snap(T(3, 40), 60), T(4, 0));
  assert.strictEqual(L.snap(T(3, 20), 60), T(3, 0));
  assert.strictEqual(L.snap(T(3, 20), 30), T(3, 30));
  assert.strictEqual(L.snap(T(3, 52), 15), T(3, 45));
  assert.strictEqual(L.snap(T(11, 53), 15), T(12, 0)); // wraps round the dial
});

test("minuteFromAngle snaps to the level step", () => {
  assert.strictEqual(L.minuteFromAngle(90), 15);
  assert.strictEqual(L.minuteFromAngle(93, 5), 15);
  assert.strictEqual(L.minuteFromAngle(100, 5), 15);
  assert.strictEqual(L.minuteFromAngle(104, 5), 15);
  assert.strictEqual(L.minuteFromAngle(106, 5), 20);
  assert.strictEqual(L.minuteFromAngle(357, 5), 0);
  assert.strictEqual(L.minuteFromAngle(200, 30), 30);
  assert.strictEqual(L.minuteFromAngle(-90), 45);
});

test("every 5-minute time round-trips through its hand angles", () => {
  for (let t = 0; t < 720; t += 5) {
    const back = L.dragHour(
      L.dragMinute(0, L.minuteAngle(t), 5),
      L.hourAngle(t),
    );
    assert.strictEqual(back, t, L.digital(t));
  }
});

test("dragging the minute hand past 12 carries the hour", () => {
  assert.strictEqual(L.dragMinute(T(3, 55), 0, 5), T(4, 0)); // forwards
  assert.strictEqual(L.dragMinute(T(4, 0), 330, 5), T(3, 55)); // backwards
  assert.strictEqual(L.dragMinute(T(12, 55), 30, 5), T(1, 5));
  assert.strictEqual(L.dragMinute(T(3, 10), 90, 5), T(3, 15)); // no carry
  // A full turn in small steps moves exactly one hour.
  let t = T(5, 0);
  for (let a = 6; a <= 360; a += 6) t = L.dragMinute(t, a, 1);
  assert.strictEqual(t, T(6, 0));
});

test("dragging the hour hand keeps the minutes", () => {
  assert.strictEqual(L.dragHour(T(3, 30), L.hourAngle(T(7, 30))), T(7, 30));
  assert.strictEqual(L.dragHour(T(3, 0), 95), T(3, 0)); // nearest hour
  assert.strictEqual(L.dragHour(T(3, 0), 110), T(4, 0));
  assert.strictEqual(L.dragHour(T(3, 45), 0), T(11, 45)); // 11:45 is nearest 12 o'clock
  assert.strictEqual(L.dragHour(T(1, 0), 355), T(12, 0));
});

test("nudge: +/- buttons step and carry", () => {
  assert.strictEqual(L.nudge(T(3, 45), "m", 1, 15), T(4, 0));
  assert.strictEqual(L.nudge(T(4, 0), "m", -1, 15), T(3, 45));
  assert.strictEqual(L.nudge(T(3, 7), "m", 1, 5), T(3, 10));
  assert.strictEqual(L.nudge(T(3, 7), "m", -1, 5), T(3, 5));
  assert.strictEqual(L.nudge(T(12, 0), "m", -1, 30), T(11, 30));
  assert.strictEqual(L.nudge(T(12, 30), "h", 1), T(1, 30));
  assert.strictEqual(L.nudge(T(1, 30), "h", -1), T(12, 30));
  assert.strictEqual(L.nudge(T(11, 59), "m", 1, 1), T(12, 0));
});

test("pickHand: the right hand is always grabbable", () => {
  assert.strictEqual(L.pickHand(T(3, 0), 88, 45), "h");
  assert.strictEqual(L.pickHand(T(3, 0), 5, 45), "m");
  assert.strictEqual(L.pickHand(T(3, 0), 5, 80), "m");
  // Overlapping hands (3:15): inside the hour hand's reach you get the hour
  // hand, further out the minute hand.
  assert.strictEqual(L.pickHand(T(3, 15), 90, 45), "h");
  assert.strictEqual(L.pickHand(T(3, 15), 90, 80), "m");
  // Near-overlap (11:55): the hour hand is still reachable.
  assert.strictEqual(L.pickHand(T(11, 55), L.hourAngle(T(11, 55)), 48), "h");
  // Outer ring is always the minute hand, even far from it.
  assert.strictEqual(L.pickHand(T(6, 0), 90, 90), "m");
});

// ---------- phrasing ----------
test("English phrasing: spot checks", () => {
  const en = (h, m) => L.say(T(h, m), "en");
  assert.strictEqual(en(3, 30), "half past three");
  assert.strictEqual(en(4, 45), "quarter to five");
  assert.strictEqual(en(1, 0), "one o'clock");
  assert.strictEqual(en(1, 30), "half past one");
  assert.strictEqual(en(12, 15), "quarter past twelve");
  assert.strictEqual(en(2, 10), "ten past two");
  assert.strictEqual(en(5, 50), "ten to six");
  assert.strictEqual(en(12, 0), "twelve o'clock");
  assert.strictEqual(en(12, 45), "quarter to one");
  assert.strictEqual(en(11, 45), "quarter to twelve");
  assert.strictEqual(en(11, 55), "five to twelve");
  assert.strictEqual(en(7, 25), "twenty-five past seven");
  assert.strictEqual(en(7, 35), "twenty-five to eight");
  assert.strictEqual(en(9, 20), "twenty past nine");
  assert.strictEqual(en(9, 40), "twenty to ten");
  assert.strictEqual(en(6, 5), "five past six");
  assert.strictEqual(en(6, 55), "five to seven");
});

test("Spanish phrasing: spot checks (la una vs las)", () => {
  const es = (h, m) => L.say(T(h, m), "es");
  assert.strictEqual(es(3, 30), "las tres y media");
  assert.strictEqual(es(4, 45), "las cinco menos cuarto");
  assert.strictEqual(es(1, 0), "la una en punto");
  assert.strictEqual(es(1, 30), "la una y media");
  assert.strictEqual(es(12, 15), "las doce y cuarto");
  assert.strictEqual(es(2, 10), "las dos y diez");
  assert.strictEqual(es(5, 50), "las seis menos diez");
  assert.strictEqual(es(12, 45), "la una menos cuarto");
  assert.strictEqual(es(12, 35), "la una menos veinticinco");
  assert.strictEqual(es(1, 45), "las dos menos cuarto");
  assert.strictEqual(es(12, 0), "las doce en punto");
  assert.strictEqual(es(7, 25), "las siete y veinticinco");
  assert.strictEqual(es(9, 40), "las diez menos veinte");
  assert.strictEqual(es(11, 55), "las doce menos cinco");
  assert.strictEqual(es(1, 5), "la una y cinco");
});

test("every 5-minute time is phrased in both languages, all distinct", () => {
  const EN_MIN = { 5: "five", 10: "ten", 20: "twenty", 25: "twenty-five" };
  const ES_MIN = { 5: "cinco", 10: "diez", 20: "veinte", 25: "veinticinco" };
  const EN_H = [
    "",
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
  ];
  const ES_H = [
    "",
    "la una",
    "las dos",
    "las tres",
    "las cuatro",
    "las cinco",
    "las seis",
    "las siete",
    "las ocho",
    "las nueve",
    "las diez",
    "las once",
    "las doce",
  ];
  const seenEn = new Set();
  const seenEs = new Set();
  for (let h = 1; h <= 12; h++) {
    const nx = (h % 12) + 1;
    for (let m = 0; m < 60; m += 5) {
      let en, es;
      if (m === 0) [en, es] = [`${EN_H[h]} o'clock`, `${ES_H[h]} en punto`];
      else if (m === 15)
        [en, es] = [`quarter past ${EN_H[h]}`, `${ES_H[h]} y cuarto`];
      else if (m === 30)
        [en, es] = [`half past ${EN_H[h]}`, `${ES_H[h]} y media`];
      else if (m === 45)
        [en, es] = [`quarter to ${EN_H[nx]}`, `${ES_H[nx]} menos cuarto`];
      else if (m < 30)
        [en, es] = [
          `${EN_MIN[m]} past ${EN_H[h]}`,
          `${ES_H[h]} y ${ES_MIN[m]}`,
        ];
      else
        [en, es] = [
          `${EN_MIN[60 - m]} to ${EN_H[nx]}`,
          `${ES_H[nx]} menos ${ES_MIN[60 - m]}`,
        ];
      assert.strictEqual(L.say(T(h, m), "en"), en, `${h}:${m} en`);
      assert.strictEqual(L.say(T(h, m), "es"), es, `${h}:${m} es`);
      seenEn.add(en);
      seenEs.add(es);
    }
  }
  assert.strictEqual(seenEn.size, 144);
  assert.strictEqual(seenEs.size, 144);
});

test("any minute: minutes past / to, 'un minuto'", () => {
  assert.strictEqual(L.say(T(3, 7), "en"), "seven minutes past three");
  assert.strictEqual(L.say(T(3, 1), "en"), "one minute past three");
  assert.strictEqual(L.say(T(3, 59), "en"), "one minute to four");
  assert.strictEqual(L.say(T(3, 37), "en"), "twenty-three minutes to four");
  assert.strictEqual(L.say(T(3, 22), "en"), "twenty-two minutes past three");
  assert.strictEqual(L.say(T(3, 7), "es"), "las tres y siete");
  assert.strictEqual(L.say(T(3, 1), "es"), "las tres y un minuto");
  assert.strictEqual(L.say(T(12, 59), "es"), "la una menos un minuto");
  assert.strictEqual(L.say(T(3, 37), "es"), "las cuatro menos veintitrés");
  assert.strictEqual(L.say(T(1, 22), "es"), "la una y veintidós");
  assert.strictEqual(L.say(T(4, 44), "es"), "las cinco menos dieciséis");
  // All 720 minutes have a distinct phrase in both languages.
  for (const lang of ["en", "es"]) {
    const all = new Set();
    for (let t = 0; t < 720; t++) all.add(L.say(t, lang));
    assert.strictEqual(all.size, 720, lang);
  }
});

test("time of day: morning / afternoon / evening / night", () => {
  const d = (h, m, lang) => L.say(L.norm(h * 60 + m), lang, h * 60 + m);
  assert.strictEqual(d(7, 0, "en"), "seven o'clock in the morning");
  assert.strictEqual(d(7, 30, "en"), "half past seven in the morning");
  assert.strictEqual(d(13, 15, "en"), "quarter past one in the afternoon");
  assert.strictEqual(d(18, 45, "en"), "quarter to seven in the evening");
  assert.strictEqual(d(21, 30, "en"), "half past nine at night");
  assert.strictEqual(d(12, 0, "en"), "twelve noon");
  assert.strictEqual(d(0, 0, "en"), "twelve midnight");
  assert.strictEqual(d(7, 0, "es"), "las siete de la mañana");
  assert.strictEqual(d(7, 30, "es"), "las siete y media de la mañana");
  assert.strictEqual(d(12, 0, "es"), "las doce del mediodía");
  assert.strictEqual(d(13, 0, "es"), "la una del mediodía");
  assert.strictEqual(d(16, 30, "es"), "las cuatro y media de la tarde");
  assert.strictEqual(d(18, 45, "es"), "las siete menos cuarto de la tarde");
  assert.strictEqual(d(20, 15, "es"), "las ocho y cuarto de la tarde");
  assert.strictEqual(d(22, 0, "es"), "las diez de la noche");
  assert.strictEqual(d(0, 0, "es"), "las doce de la noche");
  assert.strictEqual(d(3, 0, "es"), "las tres de la madrugada");
});

test("sentences: It's / Son las / Es la", () => {
  assert.strictEqual(L.sentence(T(3, 30), "en"), "It's half past three.");
  assert.strictEqual(L.sentence(T(3, 30), "es"), "Son las tres y media.");
  assert.strictEqual(L.sentence(T(1, 15), "es"), "Es la una y cuarto.");
  assert.strictEqual(L.sentence(T(12, 45), "es"), "Es la una menos cuarto.");
  assert.strictEqual(L.sentence(T(1, 45), "es"), "Son las dos menos cuarto.");
});

// ---------- questions ----------
test("levels: pools and steps", () => {
  assert.deepStrictEqual(L.minutePool(0), [0]);
  assert.deepStrictEqual(L.minutePool(1), [0, 30]);
  assert.deepStrictEqual(L.minutePool(2), [0, 15, 30, 45]);
  assert.strictEqual(L.minutePool(3).length, 12);
  assert.strictEqual(L.minutePool(4).length, 60);
  assert.strictEqual(L.MAX_STARS, 60);
});

test("rounds: distinct times valid for the level, no back-to-back hour", () => {
  for (let li = 0; li < L.LEVELS.length; li++) {
    for (let seed = 1; seed <= 20; seed++) {
      const r = L.round(li, L.ROUND, seeded(seed * 7 + li));
      assert.strictEqual(r.length, L.ROUND);
      assert.strictEqual(new Set(r).size, L.ROUND);
      r.forEach((t, i) => {
        assert.ok(L.inLevel(t, li), `level ${li}: ${L.digital(t)}`);
        if (i) assert.notStrictEqual(L.hourOf(t), L.hourOf(r[i - 1]));
      });
    }
  }
});

test("rounds mostly practise the level's new minutes", () => {
  const rnd = seeded(5);
  let fresh = 0;
  let total = 0;
  for (let i = 0; i < 50; i++)
    for (const t of L.round(2, 8, rnd)) {
      total++;
      if ([15, 45].includes(L.minuteOf(t))) fresh++;
    }
  assert.ok(fresh / total > 0.6, `${fresh}/${total}`);
});

test("distractors: distinct, valid for the level, never the answer", () => {
  for (let li = 0; li < L.LEVELS.length; li++) {
    const rnd = seeded(li + 1);
    for (let t = 0; t < 720; t += L.LEVELS[li].step) {
      const d = L.distractors(t, li, 3, rnd);
      assert.strictEqual(d.length, 3, `${li} ${L.digital(t)}`);
      assert.strictEqual(new Set(d).size, 3);
      for (const v of d) {
        assert.notStrictEqual(v, t);
        assert.ok(L.inLevel(v, li), `${li} ${L.digital(t)} → ${L.digital(v)}`);
      }
    }
  }
});

test("distractors are plausible slips", () => {
  // Quarter to five: 3:45 (reading the hour hand's last number) or
  // 5:15 (past/to mix-up) are the classic mistakes.
  const seen = new Set();
  for (let s = 1; s <= 30; s++)
    L.distractors(T(4, 45), 2, 3, seeded(s * 7919 + 13)).forEach((v) =>
      seen.add(L.digital(v)),
    );
  assert.ok(seen.has("3:45"));
  assert.ok(seen.has("5:15"));
  assert.ok(seen.has("4:15"));
  // Hands swapped: 3:30 ↔ 6:15.
  const seen2 = new Set();
  for (let s = 1; s <= 30; s++)
    L.distractors(T(3, 30), 3, 3, seeded(s * 7919 + 13)).forEach((v) =>
      seen2.add(L.digital(v)),
    );
  assert.ok(seen2.has("6:15"), [...seen2].join(" "));
  // O'clock: neighbours or mirror, all o'clock.
  for (let s = 1; s <= 10; s++)
    for (const v of L.distractors(T(3, 0), 0, 2, seeded(s)))
      assert.ok(
        ["2:00", "4:00", "9:00", "5:00", "1:00"].includes(L.digital(v)),
        L.digital(v),
      );
});

test("choices: right count, include the answer, all distinct", () => {
  const rnd = seeded(9);
  for (let li = 0; li < L.LEVELS.length; li++) {
    for (let i = 0; i < 100; i++) {
      const t = L.randomTime(li, rnd);
      const c = L.choices(t, li, rnd);
      assert.strictEqual(c.length, L.optionCount(li));
      assert.strictEqual(new Set(c).size, c.length);
      assert.ok(c.includes(t));
      // Phrases are distinct too, so the buttons never look the same.
      assert.strictEqual(new Set(c.map((v) => L.say(v, "es"))).size, c.length);
    }
  }
});

test("stars", () => {
  assert.strictEqual(L.starsFor(8, 8), 3);
  assert.strictEqual(L.starsFor(7, 8), 3);
  assert.strictEqual(L.starsFor(6, 8), 2);
  assert.strictEqual(L.starsFor(5, 8), 2);
  assert.strictEqual(L.starsFor(4, 8), 1);
  assert.strictEqual(L.starsFor(0, 8), 1);
  assert.strictEqual(L.starsFor(6, 7), 3);
  assert.strictEqual(L.totalStars({}), 0);
  assert.strictEqual(
    L.totalStars({ "read-0": 3, "day-4": 2, "set-1": 5, bogus: 3 }),
    8,
  );
});

// ---------- My day ----------
test("My day: every level's routine fits the level and moves forward", () => {
  for (let li = 0; li < L.LEVELS.length; li++) {
    const scenes = L.dayRound(li);
    assert.strictEqual(scenes.length, 7);
    scenes.forEach((s, i) => {
      assert.ok(L.inLevel(s.t, li), `${li} ${s.id}`);
      assert.strictEqual(s.t, L.norm(s.t24));
      if (i)
        assert.ok(
          s.t24 > scenes[i - 1].t24,
          `${li} ${s.id} after ${scenes[i - 1].id}`,
        );
    });
    // The clock starts at the previous scene's time, so it must move.
    scenes.forEach(
      (s, i) =>
        i && assert.notStrictEqual(s.t, scenes[i - 1].t, `${li} ${s.id}`),
    );
  }
  // Level 5 uses at least one minute that is not a multiple of 5.
  assert.ok(L.dayRound(4).some((s) => s.t % 5 !== 0));
});

test("nearest24 keeps the dial in the scene's half of the day", () => {
  assert.strictEqual(L.nearest24(T(7, 0), 19 * 60), 19 * 60);
  assert.strictEqual(L.nearest24(T(3, 0), 19 * 60), 15 * 60);
  assert.strictEqual(L.nearest24(T(7, 0), 7 * 60), 7 * 60);
  assert.strictEqual(L.nearest24(T(12, 30), 13 * 60), 12 * 60 + 30);
  assert.strictEqual(L.nearest24(T(11, 0), 8 * 60), 11 * 60);
});

test("sky phases and arc", () => {
  assert.strictEqual(L.skyAt(7 * 60).phase, "dawn");
  assert.strictEqual(L.skyAt(13 * 60).phase, "day");
  assert.strictEqual(L.skyAt(19 * 60).phase, "dusk");
  assert.strictEqual(L.skyAt(20 * 60 + 15).phase, "night"); // bedtime has the moon
  assert.strictEqual(L.skyAt(22 * 60).phase, "night");
  assert.strictEqual(L.skyAt(2 * 60).phase, "night");
  assert.strictEqual(L.skyAt(6 * 60).arc, 0);
  assert.ok(L.skyAt(13 * 60).arc > 0.4 && L.skyAt(13 * 60).arc < 0.6);
  for (let x = 0; x < 1440; x += 30) {
    const a = L.skyAt(x).arc;
    assert.ok(a >= 0 && a < 1, `${x}: ${a}`);
  }
});
