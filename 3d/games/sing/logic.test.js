import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  timeline,
  createSession,
  fakeSinger,
  starsFor,
  rankOf,
  wrap,
  laneY,
  countdownAt,
  noteName,
  colorOf,
  pickerLayout,
  totalStars,
  GOOD_RATIO,
} from "./logic.js";

// The real songs from the 2D game (a classic script declaring `const SONGS`).
const src = readFileSync(
  new URL("../../../games/sing/js/songs.js", import.meta.url),
  "utf8",
);
const SONGS = vm.runInNewContext(`${src}; SONGS`, { console });
const song = (id) => SONGS.find((s) => s.id === id);

// Run a whole song at 60 fps with a singer function (t -> midi | null).
function play(tl, singer) {
  const s = createSession(tl);
  const events = [];
  for (let t = -1; !s.finished; t += 1 / 60) {
    for (const e of s.step(t, singer(t))) events.push(e);
  }
  return { s, events };
}

test("timeline: seconds per beat, slow speed, range of at least an octave", () => {
  const tw = song("twinkle");
  const n = timeline(tw, "normal");
  const sl = timeline(tw, "slow");
  assert.equal(n.spb, 60 / 90);
  assert.ok(Math.abs(sl.spb - 60 / (90 * 0.75)) < 1e-9);
  assert.equal(n.notes.length, tw.notes.length);
  assert.equal(n.notes[1].start, n.spb);
  assert.ok(n.maxM - n.minM >= 11);
  assert.ok(n.minM <= Math.min(...tw.notes.map((x) => x.midi)) - 2);
  assert.equal(n.duration, tw.totalBeats * n.spb);
  // fresh scoring state, and the song itself is not mutated
  assert.ok(n.notes.every((x) => x.hit === 0 && !x.done));
  assert.equal(tw.notes[0].hit, undefined);
});

test("wrap: octave-agnostic semitone difference in [-6, 6)", () => {
  assert.equal(wrap(12), 0);
  assert.equal(wrap(-12), 0);
  assert.equal(wrap(13), 1);
  assert.equal(wrap(-1), -1);
  assert.equal(wrap(6), -6);
  assert.equal(wrap(11), -1);
});

test("perfect singer (an octave up) earns every note and 3 stars", () => {
  for (const s of SONGS) {
    const tl = timeline(s);
    const { s: sess } = play(tl, (t) => {
      const n = tl.notes.find((x) => t >= x.start && t < x.end);
      return n ? n.midi + 12 : null;
    });
    assert.equal(sess.score, tl.notes.length, s.id);
    assert.equal(sess.stars(), 3, s.id);
  }
});

test("the ?fake=1 singer does well but sometimes needs a hint", () => {
  const tl = timeline(song("twinkle"));
  const { s, events } = play(tl, (t) => fakeSinger(tl.notes, t));
  assert.ok(s.score >= tl.notes.length * 0.75, `score ${s.score}`);
  assert.ok(s.score < tl.notes.length, "some notes are off on purpose");
  assert.equal(s.stars(), 3);
  assert.ok(
    events.some((e) => e.type === "praise"),
    "streak praise",
  );
  assert.ok(events.some((e) => e.type === "miss"));
});

test("singing a steady wrong note: coached to go higher or lower", () => {
  const tl = timeline(song("warmup"));
  // two semitones below every note
  const { events } = play(tl, (t) => {
    const n = tl.notes.find((x) => t >= x.start && t < x.end);
    return n ? n.midi - 2 : null;
  });
  const hints = events.filter((e) => e.type === "hint");
  assert.ok(hints.length > 0);
  assert.ok(hints.every((e) => e.dir === "higher"));
});

test("silence: 'sing with me', no voice, 0 stars", () => {
  const tl = timeline(song("mary"));
  const { s, events } = play(tl, () => null);
  assert.equal(s.score, 0);
  assert.equal(s.anyVoice, false);
  assert.equal(s.stars(), 0);
  assert.ok(events.some((e) => e.type === "singWithMe"));
  assert.ok(!events.some((e) => e.type === "hint"));
});

test("GOOD_RATIO: a note sung for 30 % misses, 50 % hits", () => {
  const tl = timeline(song("warmup"));
  const first = tl.notes[0];
  const sing = (share) => (t) =>
    t >= first.start && t < first.start + first.dur * share ? first.midi : null;
  const a = play(timeline(song("warmup")), sing(0.3));
  const b = play(timeline(song("warmup")), sing(0.5 + GOOD_RATIO / 4));
  assert.equal(a.s.notes[0].good, false);
  assert.equal(b.s.notes[0].good, true);
});

test("stars: thresholds, and singing at all earns one", () => {
  assert.equal(starsFor(0, 10, false), 0);
  assert.equal(starsFor(0, 10, true), 1);
  assert.equal(starsFor(2, 10, false), 1);
  assert.equal(starsFor(5, 10, false), 2);
  assert.equal(starsFor(8, 10, false), 3);
  assert.equal(totalStars({ twinkle: 3, mary: 1 }, SONGS), 4);
});

test("ranks", () => {
  assert.deepEqual(rankOf(0), { rank: 0, last: false, toNext: 3 });
  assert.deepEqual(rankOf(7), { rank: 2, last: false, toNext: 3 });
  assert.deepEqual(rankOf(15), { rank: 4, last: true, toNext: 0 });
});

test("helpers: lane heights, countdown, names, colours", () => {
  assert.equal(laneY(60, 60, 72, 1, 4), 1);
  assert.equal(laneY(72, 60, 72, 1, 4), 4);
  assert.equal(laneY(66, 60, 72, 1, 4), 2.5);
  assert.equal(countdownAt(-1.5, 0.6), 3);
  assert.equal(countdownAt(-0.1, 0.6), 1);
  assert.equal(countdownAt(0.2, 0.6), 0);
  assert.equal(countdownAt(1, 0.6), null);
  assert.equal(noteName(60), "Do");
  assert.equal(noteName(67, "abc"), "G");
  assert.equal(noteName(72 + 11), "Si");
  assert.equal(colorOf(60), "#ff6b6b");
  assert.equal(colorOf(61), "#cfd6ee");
});

test("picker layout: every record visible, wide and tall", () => {
  for (const aspect of [390 / 844, 768 / 1024, 1280 / 800, 2]) {
    const l = pickerLayout(5, aspect);
    assert.equal(l.records.length, 5);
    const xs = l.records.map((r) => r.x);
    const half = l.view.width / 2;
    const cx = l.view.center[0];
    for (const x of xs) assert.ok(Math.abs(x - cx) < half, `x ${x} in view`);
    // records do not overlap
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        const a = l.records[i];
        const b = l.records[j];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1.6, `${i}/${j} apart`);
      }
  }
});
