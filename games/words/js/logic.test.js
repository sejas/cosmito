// Run: node --test games/words/js/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const L = require("./logic.js");
const PACKS = require("./words.js");

// Deterministic PRNG so failures are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ALL = PACKS.flatMap((p) => p.words);

test("every pack has an id, emoji, colour, en+es name and 10–12 words", () => {
  const ids = new Set();
  for (const p of PACKS) {
    assert.ok(p.id && !ids.has(p.id), `unique pack id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.emoji, `${p.id} emoji`);
    assert.match(p.color, /^#[0-9a-f]{6}$/i, `${p.id} color`);
    assert.ok(p.name.en && p.name.es, `${p.id} name`);
    assert.ok(
      p.words.length >= 10 && p.words.length <= 12,
      `${p.id} size ${p.words.length}`,
    );
  }
});

test("every word has id, emoji, en and es text", () => {
  for (const w of ALL) {
    assert.ok(w.id, "id");
    assert.ok(typeof w.emoji === "string" && w.emoji.trim(), `${w.id} emoji`);
    for (const lang of L.LANGS) {
      assert.ok(
        typeof w[lang] === "string" && w[lang].trim(),
        `${w.id} ${lang}`,
      );
      assert.strictEqual(w[lang], w[lang].trim(), `${w.id} ${lang} trimmed`);
      assert.strictEqual(
        w[lang],
        w[lang].normalize("NFC"),
        `${w.id} ${lang} NFC`,
      );
    }
    if (w.swatch) assert.match(w.swatch, /^#[0-9a-f]{6}$/i, `${w.id} swatch`);
  }
});

test("word ids are unique across all packs", () => {
  const ids = ALL.map((w) => w.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test("no duplicate pictures or words inside a pack", () => {
  for (const p of PACKS) {
    for (const key of ["emoji", "en", "es"]) {
      const vals = p.words.map((w) => w[key]);
      assert.strictEqual(new Set(vals).size, vals.length, `${p.id} ${key}`);
    }
  }
});

test("Spanish nouns carry an article; English words don't", () => {
  for (const p of PACKS) {
    for (const w of p.words) {
      const es = L.splitArticle(w.es, "es");
      if (p.id === "colours")
        assert.strictEqual(es.article, "", `${w.id} colour adjective`);
      else assert.ok(es.article, `${w.id}: "${w.es}" needs el/la/los/las`);
      assert.ok(
        !/^(the|a|an) /i.test(w.en),
        `${w.id}: "${w.en}" without article`,
      );
    }
  }
});

test("splitArticle", () => {
  assert.deepStrictEqual(L.splitArticle("el perro", "es"), {
    article: "el",
    word: "perro",
  });
  assert.deepStrictEqual(L.splitArticle("las uvas", "es"), {
    article: "las",
    word: "uvas",
  });
  assert.deepStrictEqual(L.splitArticle("rojo", "es"), {
    article: "",
    word: "rojo",
  });
  assert.deepStrictEqual(L.splitArticle("ice cream", "en"), {
    article: "",
    word: "ice cream",
  });
});

test("targetLang: the other language, or home to practise", () => {
  assert.strictEqual(L.targetLang("en", "other"), "es");
  assert.strictEqual(L.targetLang("es", "other"), "en");
  assert.strictEqual(L.targetLang("es", "home"), "es");
  assert.strictEqual(L.targetLang("xx", "home"), "en");
});

test("letters: accents and ñ", () => {
  assert.strictEqual(L.baseLetter("á"), "a");
  assert.strictEqual(L.baseLetter("ñ"), "n");
  assert.strictEqual(L.checkLetter("á", "á"), "right");
  assert.strictEqual(L.checkLetter("á", "a"), "close");
  assert.strictEqual(L.checkLetter("ñ", "n"), "close");
  assert.strictEqual(L.checkLetter("a", "e"), "wrong");
  // Decomposed input still matches.
  assert.strictEqual(L.checkLetter("ó", "ó"), "right");
  const ls = L.lettersOf("ice cream");
  assert.strictEqual(ls.length, 9);
  assert.ok(ls[3].fixed);
  assert.strictEqual(L.spellLength("ice cream"), 8);
});

test("spelling tiles can always form the word (every word, both languages)", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const rnd = seeded(seed);
    for (const w of ALL) {
      for (const lang of L.LANGS) {
        const word = L.spellWord(w, lang);
        for (const given of [0, 1]) {
          const tiles = L.spellTiles(word, lang, { given }, rnd);
          assert.ok(
            L.canForm(tiles, word, given),
            `${lang} ${word} given ${given}`,
          );
          const need = L.spellLength(word) - given;
          const extra = tiles.length - need;
          assert.ok(extra >= 2 && extra <= 3, `${word} extra ${extra}`);
          // Distractors never share a base letter with the word (no a/á, n/ñ traps).
          const bases = new Set(
            L.lettersOf(word).map((l) => L.baseLetter(l.ch)),
          );
          const counts = {};
          for (const l of L.lettersOf(word)
            .filter((x) => !x.fixed)
            .slice(given))
            counts[l.ch] = (counts[l.ch] || 0) + 1;
          for (const t of tiles) {
            if (counts[t.ch]) counts[t.ch]--;
            else
              assert.ok(
                !bases.has(L.baseLetter(t.ch)),
                `${word} distractor ${t.ch}`,
              );
          }
          assert.strictEqual(
            new Set(tiles.map((t) => t.id)).size,
            tiles.length,
            "tile ids",
          );
        }
      }
    }
  }
});

test("canForm detects missing letters", () => {
  const tiles = [
    { id: 0, ch: "e" },
    { id: 1, ch: "r" },
  ];
  assert.ok(!L.canForm(tiles, "perro", 1));
  assert.ok(
    L.canForm([...tiles, { id: 2, ch: "r" }, { id: 3, ch: "o" }], "perro", 1),
  );
});

test("every pack has enough spellable words in both languages", () => {
  for (const p of PACKS) {
    for (const lang of L.LANGS) {
      const n = p.words.filter((w) => L.spellable(w[lang], lang)).length;
      assert.ok(n >= L.ROUND.spell, `${p.id} ${lang}: ${n} spellable`);
    }
  }
});

test("options: distinct ids, pictures and texts, answer included", () => {
  for (let seed = 1; seed <= 4; seed++) {
    const rnd = seeded(seed);
    for (const p of PACKS) {
      for (const lang of L.LANGS) {
        for (const w of p.words) {
          for (const n of [3, 4]) {
            const opts = L.options(w, p.words, n, lang, rnd);
            assert.strictEqual(opts.length, n, `${p.id} ${w.id}`);
            assert.ok(opts.includes(w), "answer included");
            for (const key of ["id", "emoji"])
              assert.strictEqual(
                new Set(opts.map((o) => o[key])).size,
                n,
                `${key} distinct`,
              );
            assert.strictEqual(
              new Set(opts.map((o) => L.textOf(o, lang))).size,
              n,
              "text distinct",
            );
          }
        }
      }
    }
  }
});

test("options are shuffled (answer not always first)", () => {
  const rnd = seeded(7);
  const words = PACKS[0].words;
  const first = Array.from(
    { length: 30 },
    () => L.options(words[0], words, 4, "es", rnd)[0],
  );
  assert.ok(first.some((o) => o !== words[0]));
});

test("rounds: right size, unique ids from the pack", () => {
  const rnd = seeded(3);
  for (const p of PACKS) {
    for (const mode of L.MODES) {
      for (const lang of L.LANGS) {
        const ids = L.makeRound(mode, p.words, lang, rnd);
        assert.strictEqual(ids.length, L.ROUND[mode], `${p.id} ${mode}`);
        assert.strictEqual(new Set(ids).size, ids.length);
        for (const id of ids) {
          const w = p.words.find((x) => x.id === id);
          assert.ok(w, `${id} in ${p.id}`);
          if (mode === "spell") assert.ok(L.spellable(w[lang], lang));
        }
      }
    }
  }
});

test("memory deck: a picture and a word card per id", () => {
  const deck = L.memoryDeck(["a", "b", "c"], seeded(1));
  assert.strictEqual(deck.length, 6);
  assert.strictEqual(new Set(deck.map((c) => c.key)).size, 6);
  for (const id of ["a", "b", "c"]) {
    const faces = deck
      .filter((c) => c.id === id)
      .map((c) => c.face)
      .sort();
    assert.deepStrictEqual(faces, ["pic", "word"]);
  }
});

test("requeue puts a missed item back a little later", () => {
  assert.deepStrictEqual(L.requeue([1, 2, 3], "x"), [1, 2, "x", 3]);
  assert.deepStrictEqual(L.requeue([1], "x"), [1, "x"]);
  assert.deepStrictEqual(L.requeue([], "x"), ["x"]);
});

test("star thresholds", () => {
  assert.strictEqual(L.starsFor("listen", 0), 3);
  assert.strictEqual(L.starsFor("listen", 1), 3);
  assert.strictEqual(L.starsFor("listen", 2), 2);
  assert.strictEqual(L.starsFor("listen", 3), 2);
  assert.strictEqual(L.starsFor("listen", 4), 1);
  assert.strictEqual(L.starsFor("picture", 9), 1);
  assert.strictEqual(L.starsFor("spell", 2), 3);
  assert.strictEqual(L.starsFor("spell", 5), 2);
  assert.strictEqual(L.starsFor("spell", 6), 1);
  assert.strictEqual(L.starsFor("memory", 4), 3);
  assert.strictEqual(L.starsFor("memory", 9), 2);
  assert.strictEqual(L.starsFor("memory", 30), 1);
  for (const mode of L.MODES)
    for (let m = 0; m < 20; m++) {
      const s = L.starsFor(mode, m);
      assert.ok(s >= 1 && s <= 3);
      assert.ok(
        L.starsFor(mode, m + 1) <= s,
        "never more stars for more mistakes",
      );
    }
});

test("star totals", () => {
  assert.strictEqual(L.maxStars(PACKS), PACKS.length * 4 * 3);
  const best = { animals: { listen: 3, spell: 2 }, food: { memory: 5 } };
  assert.strictEqual(L.packStars(best, "animals"), 5);
  assert.strictEqual(L.packStars(best, "food"), 3, "capped at 3 per mode");
  assert.strictEqual(L.packStars(best, "nope"), 0);
  assert.strictEqual(L.totalStars(best, PACKS), 8);
  assert.strictEqual(L.totalStars(null, PACKS), 0);
});
