// Run: node --test games/colors/js/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const C = require("./palette.js");
const P = require("./pictures.js");

// Deterministic rng for generation tests.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const permutations = (arr) =>
  arr.length <= 1
    ? [arr]
    : arr.flatMap((x, i) =>
        permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [
          x,
          ...p,
        ]),
      );

test("every colour has en + es names, a valid hex and a unique symbol", () => {
  assert.strictEqual(C.COLORS.length, 11);
  const symbols = new Set();
  for (const c of C.COLORS) {
    assert.ok(c.en && typeof c.en === "string", `${c.id} en`);
    assert.ok(c.es && typeof c.es === "string", `${c.id} es`);
    assert.match(c.hex, /^#[0-9a-f]{6}$/, `${c.id} hex`);
    assert.ok(c.symbol, `${c.id} symbol`);
    symbols.add(c.symbol);
  }
  assert.strictEqual(symbols.size, C.COLORS.length, "symbols are unique");
  assert.strictEqual(C.nameOf("purple", "es"), "morado");
  assert.strictEqual(C.nameOf("brown", "es"), "marrón");
});

test("named colours look different enough from each other", () => {
  for (const a of C.COLORS)
    for (const b of C.COLORS)
      if (a !== b)
        assert.ok(C.distance(a.hex, b.hex) > 60, `${a.id} vs ${b.id}`);
});

test("named mixes give the expected colour, in any order", () => {
  const cases = [
    [["red", "yellow"], "orange"],
    [["blue", "yellow"], "green"],
    [["red", "blue"], "purple"],
    [["red", "white"], "pink"],
    [["red", "yellow", "blue"], "brown"],
    [["white", "black"], "grey"],
    [["blue", "white"], "light-blue"],
    [["blue", "black"], "dark-blue"],
    [["yellow", "blue", "white"], "light-green"],
    [["red", "black"], "dark-red"],
  ];
  for (const [parts, want] of cases)
    for (const order of permutations(parts))
      assert.strictEqual(C.mix(order).id, want, order.join("+"));
});

test("every recipe makes its colour, and the colour is exactly the named one", () => {
  for (const [id, recipe] of Object.entries(C.RECIPES)) {
    assert.strictEqual(C.mix(recipe).id, id);
  }
  // The named paints the lab can make match their pots exactly.
  for (const id of ["orange", "green", "purple", "pink", "grey", "brown"])
    assert.strictEqual(C.mix(C.RECIPES[id]).hex, C.BY_ID[id].hex, id);
});

test("blue + yellow is green, not grey (not naive RGB averaging)", () => {
  const [r, g, b] = C.hexToRgb(C.mix(["blue", "yellow"]).hex);
  assert.ok(g > r + 60 && g > b + 60, "green channel dominates");
});

test("single pots mix to themselves", () => {
  for (const id of C.LAB_POTS) {
    assert.strictEqual(C.mix([id]).id, id);
    assert.strictEqual(C.mix([id]).hex, C.BY_ID[id].hex);
    assert.strictEqual(C.mix([id, id]).id, id, `${id} twice`);
  }
  assert.strictEqual(C.mix([]), null);
});

test("ratios change the colour but keep the family name", () => {
  const redder = C.mix(["red", "red", "yellow"]);
  assert.strictEqual(redder.id, "orange");
  assert.notStrictEqual(redder.hex, C.BY_ID.orange.hex);
  assert.ok(
    C.distance(redder.hex, C.BY_ID.red.hex) <
      C.distance(C.BY_ID.orange.hex, C.BY_ID.red.hex),
  );
});

test("tints and shades stay distinct from the base and go the right way", () => {
  const lum = (hex) => C.hexToRgb(hex).reduce((a, b) => a + b, 0);
  for (const base of [
    "red",
    "yellow",
    "blue",
    "orange",
    "green",
    "purple",
    "brown",
  ]) {
    const recipe = C.RECIPES[base] || [base];
    const plain = C.mix(recipe);
    const light = C.mix([...recipe, "white"]);
    const dark = C.mix([...recipe, "black"]);
    assert.strictEqual(light.id, base === "red" ? "pink" : `light-${base}`);
    assert.strictEqual(dark.id, `dark-${base}`);
    assert.ok(C.distance(light.hex, plain.hex) > 40, `light ${base} distinct`);
    assert.ok(C.distance(dark.hex, plain.hex) > 30, `dark ${base} distinct`);
    assert.ok(lum(dark.hex) < lum(plain.hex) * 0.85, `dark ${base} clearly darker`);
    assert.ok(lum(light.hex) > lum(plain.hex), `light ${base} is lighter`);
    assert.ok(lum(dark.hex) < lum(plain.hex), `dark ${base} is darker`);
    // More white is lighter still.
    assert.ok(lum(C.mix([...recipe, "white", "white"]).hex) > lum(light.hex));
  }
});

test("light/dark names exist in both languages", () => {
  assert.strictEqual(C.nameOf("light-blue", "en"), "light blue");
  assert.strictEqual(C.nameOf("light-blue", "es"), "azul claro");
  assert.strictEqual(C.nameOf("dark-green", "es"), "verde oscuro");
  for (const id of [...C.DISCOVERIES, ...Object.keys(C.RECIPES)]) {
    assert.ok(!C.nameOf(id, "en").includes("-"), id);
    assert.ok(!C.nameOf(id, "es").includes("-"), id);
    assert.match(C.hexOf(id), /^#[0-9a-f]{6}$/);
  }
});

test("every discovery and challenge is solvable with the lab pots", () => {
  const all = [...C.DISCOVERIES, ...C.CHALLENGE_SETS.flatMap((s) => s.pool)];
  for (const id of all) {
    assert.ok(C.RECIPES[id], `${id} has a recipe`);
    assert.ok(
      C.RECIPES[id].every((p) => C.LAB_POTS.includes(p)),
      `${id} uses lab pots`,
    );
    assert.ok(C.RECIPES[id].length <= C.MAX_PARTS);
    const found = C.solve(id);
    assert.ok(found, `${id} is solvable`);
    assert.strictEqual(
      found.length,
      C.RECIPES[id].length,
      `${id} recipe is the shortest`,
    );
  }
});

test("challenge rounds pick distinct solvable targets", () => {
  for (const set of C.CHALLENGE_SETS)
    for (let seed = 1; seed < 30; seed++) {
      const round = C.challengeRound(set.id, seeded(seed));
      assert.strictEqual(round.length, C.CHALLENGES_PER_ROUND);
      assert.strictEqual(
        new Set(round.map((c) => c.target)).size,
        round.length,
      );
      for (const c of round) assert.strictEqual(C.mix(c.recipe).id, c.target);
    }
});

test("quiz rounds: answer is always an option, options are distinct, no repeats in a row", () => {
  for (const q of C.QUIZZES)
    for (let seed = 1; seed < 40; seed++) {
      const round = C.quizRound(q.id, seeded(seed));
      assert.strictEqual(round.length, C.QUESTIONS);
      round.forEach((item, i) => {
        assert.ok(item.options.includes(item.answer));
        assert.strictEqual(new Set(item.options).size, item.options.length);
        assert.strictEqual(item.options.length, i < 3 ? 3 : 4);
        item.options.forEach((o) => assert.ok(C.BY_ID[o], o));
        if (i)
          assert.notStrictEqual(
            item.answer,
            round[i - 1].answer,
            `seed ${seed} q${i}`,
          );
        if (q.id === "things")
          assert.ok(
            C.THINGS.some(
              (t) => t.icon === item.thing && t.color === item.answer,
            ),
          );
      });
    }
});

test("things cover every colour", () => {
  for (const c of C.COLORS)
    assert.ok(
      C.THINGS.some((t) => t.color === c.id),
      c.id,
    );
});

test("stars: never zero for finishing, fewer mistakes is better", () => {
  assert.strictEqual(C.starsFor(0), 3);
  assert.strictEqual(C.starsFor(1), 3);
  assert.strictEqual(C.starsFor(3), 2);
  assert.strictEqual(C.starsFor(10), 1);
  assert.strictEqual(C.labStars([]), 0);
  assert.strictEqual(C.labStars(C.DISCOVERIES.slice(0, 3)), 1);
  assert.strictEqual(C.labStars(C.DISCOVERIES.slice(0, 6)), 2);
  assert.strictEqual(C.labStars([...C.DISCOVERIES, "red"]), 3);
  assert.strictEqual(C.totalStars({ a: 3, b: 2, c: 9 }), 8);
});

test("nearest named colour", () => {
  assert.strictEqual(C.nearest("#ffd23f"), "yellow"); // Pipo
  assert.strictEqual(C.nearest("#a8652f"), "brown"); // Bollo
  for (const c of C.COLORS) assert.strictEqual(C.nearest(c.hex), c.id);
});

// ---------- pictures ----------
test("every picture has at least 4 fillable regions with valid targets", () => {
  assert.ok(P.PICTURES.length >= 5);
  for (const pic of P.PICTURES) {
    assert.ok(pic.regions.length >= 4, pic.id);
    const ids = new Set();
    for (const r of pic.regions) {
      assert.ok(!ids.has(r.id), `${pic.id}/${r.id} unique`);
      ids.add(r.id);
      assert.ok(
        typeof r.d === "string" && /^M/.test(r.d),
        `${pic.id}/${r.id} path`,
      );
      assert.doesNotMatch(r.d, /NaN|undefined/);
      assert.ok(
        r.target === "buddy" || C.BY_ID[r.target],
        `${pic.id}/${r.id} target`,
      );
      assert.ok(
        r.at[0] >= 0 && r.at[0] <= 200 && r.at[1] >= 0 && r.at[1] <= 200,
      );
    }
  }
});

test("the buddy picture uses the buddy's colour and nothing else clashes", () => {
  const friend = P.PICTURES.find((p) =>
    p.regions.some((r) => r.target === "buddy"),
  );
  assert.ok(friend, "there is a buddy picture");
  for (const color of C.COLORS.map((c) => c.id)) {
    const targets = friend.regions.map((r) => [
      r,
      P.targetOf(friend, r, color),
    ]);
    for (const [r, t] of targets) {
      assert.ok(C.BY_ID[t], t);
      if (r.target === "buddy") assert.strictEqual(t, color);
      else assert.notStrictEqual(t, color, `${r.id} with a ${color} buddy`);
    }
  }
  // Other pictures are unaffected by the buddy.
  const house = P.PICTURES.find((p) => p.id === "house");
  const win = house.regions.find((r) => r.id === "window");
  assert.strictEqual(P.targetOf(house, win, "yellow"), "yellow");
});

test("colorsOf lists each needed colour once, in palette order", () => {
  const order = C.COLORS.map((c) => c.id);
  for (const pic of P.PICTURES) {
    const cols = P.colorsOf(pic, "yellow", order);
    assert.strictEqual(new Set(cols).size, cols.length);
    assert.deepStrictEqual(
      cols,
      order.filter((id) => cols.includes(id)),
    );
    for (const r of pic.regions)
      assert.ok(cols.includes(P.targetOf(pic, r, "yellow")));
  }
});
