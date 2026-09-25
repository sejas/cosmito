// Pure game logic for "Words with Pipo": no DOM, testable with node.
// Words are referenced by id; the text shown/spoken depends on the target
// language ("en" or "es"), which is the other language than the UI one, or
// the UI language itself when a child wants to practise reading at home.
(function (root) {
  "use strict";

  const LANGS = ["en", "es"];
  const MODES = ["listen", "picture", "spell", "memory"];
  // Questions per round (memory: pairs on the board).
  const ROUND = { listen: 8, picture: 8, spell: 5, memory: 6 };
  // Options shown per question.
  const OPTIONS = { listen: 4, picture: 3 };
  // Longest word (letters to tap) used in Spell mode.
  const MAX_SPELL = 8;
  // Mistakes allowed for 3 and 2 stars; anything more is still 1 star.
  const STAR_RULES = {
    listen: [1, 3],
    picture: [1, 3],
    spell: [2, 5],
    memory: [4, 9],
  };
  const ALPHABET = {
    en: "abcdefghijklmnopqrstuvwxyz",
    es: "abcdefghijklmnñopqrstuvwxyz",
  };
  // Spanish articles shown before a noun but not spelled.
  const ARTICLES = { es: ["el", "la", "los", "las"], en: [] };
  // Characters that are part of a word but never a tile (ice cream, T-shirt…).
  const FIXED = /[\s\-'’.]/;

  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sample(arr, n, rnd = Math.random) {
    return shuffle(arr, rnd).slice(0, Math.min(n, arr.length));
  }

  const other = (lang) => (lang === "es" ? "en" : "es");

  // mode "other": learn the other language; "home": practise the UI language.
  function targetLang(uiLang, mode) {
    const ui = LANGS.includes(uiLang) ? uiLang : "en";
    return mode === "home" ? ui : other(ui);
  }

  // "el perro" → { article: "el", word: "perro" }; "red" → { article: "", word: "red" }.
  function splitArticle(text, lang) {
    const m = /^(\S+)\s+(.+)$/.exec(text);
    if (m && (ARTICLES[lang] || []).includes(m[1].toLowerCase())) {
      return { article: m[1], word: m[2] };
    }
    return { article: "", word: text };
  }

  // Letters of a word, NFC-normalised and lower-case, with spaces/hyphens
  // marked fixed (shown in place, never tapped).
  function lettersOf(word) {
    return Array.from(word.normalize("NFC").toLowerCase()).map((ch) => ({
      ch,
      fixed: FIXED.test(ch),
    }));
  }

  // Letter without its accent/tilde: "á" → "a", "ü" → "u", "ñ" → "n".
  function baseLetter(ch) {
    return ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // Tapped "a" where "á" goes (or "n" for "ñ") is "close": a gentle accent
  // hint, not a mistake.
  function checkLetter(expected, tapped) {
    const e = expected.normalize("NFC").toLowerCase();
    const t = tapped.normalize("NFC").toLowerCase();
    if (e === t) return "right";
    if (baseLetter(e) === baseLetter(t)) return "close";
    return "wrong";
  }

  // Number of letters to tap (ignores spaces/hyphens).
  function spellLength(word) {
    return lettersOf(word).filter((l) => !l.fixed).length;
  }

  function spellable(text, lang) {
    const n = spellLength(splitArticle(text, lang).word);
    return n >= 2 && n <= MAX_SPELL;
  }

  // Tiles for Spell mode: every letter still to place (after the `given`
  // first letters, which are pre-filled) plus a few distractor letters whose
  // base differs from every letter in the word (so no "a" next to "á").
  // Each tile: { id, ch }. Shuffled.
  function spellTiles(word, lang, opts = {}, rnd = Math.random) {
    const given = opts.given ?? 1;
    const letters = lettersOf(word).filter((l) => !l.fixed);
    const need = letters.slice(given).map((l) => l.ch);
    const extra = opts.extra ?? (need.length <= 3 ? 2 : 3);
    const bases = new Set(letters.map((l) => baseLetter(l.ch)));
    const pool = Array.from(ALPHABET[lang] || ALPHABET.en).filter(
      (ch) => !bases.has(baseLetter(ch)),
    );
    const distract = sample(pool, extra, rnd);
    return shuffle(
      [...need, ...distract].map((ch, i) => ({ id: i, ch })),
      rnd,
    );
  }

  // True if the tiles contain every letter still needed (multiset check).
  function canForm(tiles, word, given = 1) {
    const counts = {};
    for (const t of tiles) counts[t.ch] = (counts[t.ch] || 0) + 1;
    const need = lettersOf(word)
      .filter((l) => !l.fixed)
      .slice(given);
    for (const l of need) {
      if (!counts[l.ch]) return false;
      counts[l.ch]--;
    }
    return true;
  }

  // Text of a word in a language, and the part a child spells.
  const textOf = (w, lang) => w[lang] ?? w.en;
  const spellWord = (w, lang) => splitArticle(textOf(w, lang), lang).word;

  // `n` options for a question: the answer plus distractors from the pool with
  // a different id, picture and text (so no two options look or read alike).
  function options(answer, pool, n, lang, rnd = Math.random) {
    const out = [answer];
    const seen = (w) =>
      out.some(
        (o) =>
          o.id === w.id ||
          o.emoji === w.emoji ||
          textOf(o, lang) === textOf(w, lang),
      );
    for (const w of shuffle(pool, rnd)) {
      if (out.length >= n) break;
      if (!seen(w)) out.push(w);
    }
    return shuffle(out, rnd);
  }

  // Word ids for a new round in `mode`, drawn from a pack's words.
  function makeRound(mode, words, lang, rnd = Math.random) {
    const n = ROUND[mode] || 8;
    const pool =
      mode === "spell"
        ? words.filter((w) => spellable(textOf(w, lang), lang))
        : words;
    return sample(pool, n, rnd).map((w) => w.id);
  }

  // Memory: one picture card and one word card per id, shuffled.
  function memoryDeck(ids, rnd = Math.random) {
    const cards = [];
    for (const id of ids) {
      cards.push({ key: `${id}:pic`, id, face: "pic" });
      cards.push({ key: `${id}:word`, id, face: "word" });
    }
    return shuffle(cards, rnd);
  }

  // Put a missed question back a couple of turns later (never lost).
  function requeue(queue, item, gap = 2) {
    const q = queue.slice();
    q.splice(Math.min(q.length, gap), 0, item);
    return q;
  }

  function starsFor(mode, mistakes) {
    const [three, two] = STAR_RULES[mode] || STAR_RULES.listen;
    if (mistakes <= three) return 3;
    if (mistakes <= two) return 2;
    return 1;
  }

  const maxStars = (packs) => packs.length * MODES.length * 3;

  // best: { [packId]: { [mode]: stars } }
  function packStars(best, packId) {
    const b = (best && best[packId]) || {};
    return MODES.reduce((s, m) => s + Math.min(3, b[m] || 0), 0);
  }

  function totalStars(best, packs) {
    return packs.reduce((s, p) => s + packStars(best, p.id), 0);
  }

  const api = {
    LANGS,
    MODES,
    ROUND,
    OPTIONS,
    MAX_SPELL,
    STAR_RULES,
    ALPHABET,
    shuffle,
    sample,
    other,
    targetLang,
    splitArticle,
    lettersOf,
    baseLetter,
    checkLetter,
    spellLength,
    spellable,
    spellTiles,
    canForm,
    textOf,
    spellWord,
    options,
    makeRound,
    memoryDeck,
    requeue,
    starsFor,
    maxStars,
    packStars,
    totalStars,
  };
  root.WordsLogic = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
