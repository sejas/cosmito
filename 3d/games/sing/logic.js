// Pure logic for Sing 3D (no three.js, no DOM) so it runs in node:test.
// Same rules as the 2D game (games/sing/js/app.js): octave-agnostic matching
// within ±1 semitone, a note earns its star when ≥ 40 % of it is on pitch.

export const TOLERANCE = 1.0; // semitones — generous for kids
export const GOOD_RATIO = 0.4; // share of a note that must be on pitch
export const SLOW = 0.75; // tempo factor of the 🐢 speed
export const RANK_AT = [0, 3, 6, 10, 15];

// Boomwhacker colours per pitch class (same as 2D).
export const PC_COLORS = {
  0: "#ff6b6b",
  2: "#ffa94d",
  4: "#ffd43b",
  5: "#51cf66",
  7: "#4dabf7",
  9: "#9775fa",
  11: "#f783ac",
};
export const NAMES = {
  sol: [
    "Do",
    "Do#",
    "Re",
    "Re#",
    "Mi",
    "Fa",
    "Fa#",
    "Sol",
    "Sol#",
    "La",
    "La#",
    "Si",
  ],
  abc: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
};

export const pc = (midi) => ((Math.round(midi) % 12) + 12) % 12;
export const colorOf = (midi) => PC_COLORS[pc(midi)] || "#cfd6ee";
export const noteName = (midi, names = "sol") =>
  (NAMES[names] || NAMES.sol)[pc(midi)];

// Wrap a semitone difference into [-6, 6) so any octave counts.
export const wrap = (d) => ((((d + 6) % 12) + 12) % 12) - 6;

export function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}

export const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A song (from games/sing/js/songs.js) timed for a speed: seconds per beat,
// notes with start/end in seconds, and a pitch range at least an octave tall.
export function timeline(song, speed = "normal") {
  const spb = 60 / (song.bpm * (speed === "slow" ? SLOW : 1));
  const notes = song.notes.map((n, i) => ({
    ...n,
    i,
    start: n.startBeat * spb,
    end: (n.startBeat + n.beats) * spb,
    dur: n.beats * spb,
    hit: 0,
    done: false,
    good: false,
  }));
  const midis = notes.map((n) => n.midi);
  let minM = Math.min(...midis) - 2;
  let maxM = Math.max(...midis) + 2;
  while (maxM - minM < 11) {
    minM--;
    maxM++;
  }
  return {
    song,
    spb,
    notes,
    minM,
    maxM,
    duration: song.totalBeats * spb,
  };
}

// Stars for a finished song: 0–3, and singing at all earns at least one.
export function starsFor(score, total, anyVoice) {
  const pct = total ? score / total : 0;
  let stars = pct >= 0.75 ? 3 : pct >= 0.5 ? 2 : pct >= 0.2 ? 1 : 0;
  if (anyVoice) stars = Math.max(1, stars);
  return stars;
}

export const totalStars = (best, songs) =>
  songs.reduce((sum, s) => sum + (best[s.id] || 0), 0);

// Rank index (RANK_AT thresholds) and stars to the next rank.
export function rankOf(have) {
  let rank = 0;
  RANK_AT.forEach((at, i) => {
    if (have >= at) rank = i;
  });
  const last = rank === RANK_AT.length - 1;
  return { rank, last, toNext: last ? 0 : RANK_AT[rank + 1] - have };
}

// Height (world units) of a pitch on the highway: minM at `bottom`, maxM at `top`.
export const laneY = (midi, minM, maxM, bottom, top) =>
  bottom + ((midi - minM) / Math.max(1, maxM - minM)) * (top - bottom);

// Countdown shown before the song: 3, 2, 1 (beats before t = 0), 0 = "sing!"
// for the first 0.6 s, null otherwise. Values above 3 are shown as nothing.
export function countdownAt(t, spb) {
  if (t < 0) return Math.ceil(-t / spb);
  return t < 0.6 ? 0 : null;
}

// ?fake=1: a simulated child singing an octave up, with small wobbles, short
// breaths and the odd note too high so the buddy gets to coach. Returns MIDI or null.
export function fakeSinger(notes, t) {
  const n = notes.find((x) => t >= x.start + 0.06 && t < x.end - 0.04);
  if (!n) return null;
  if (Math.sin(t * 1.7) > 0.93) return null;
  let m = n.midi + 12 + 0.3 * Math.sin(t * 11);
  if (n.i % 9 === 5) m += 2.4;
  return m;
}

// The scoring session. Feed it one pitch sample per frame:
//   const s = createSession(timeline(song));
//   const ev = s.step(t, midiOrNull);   // t = song time (s), negative before start
// It smooths the pitch (median of 5), scores notes, tracks the streak and
// decides when the buddy should coach. `ev` lists what happened this frame:
//   { type: "good" | "miss", note }, { type: "praise" }, { type: "hint", dir: "higher" | "lower" },
//   { type: "singWithMe" }
// Read s.voice (displayed MIDI or null), s.on, s.onTime, s.active, s.upcoming.
export function createSession(tl, { coach = true } = {}) {
  const s = {
    tl,
    notes: tl.notes,
    score: 0,
    streak: 0,
    anyVoice: false,
    recent: [],
    unvoiced: 99,
    voice: null,
    raw: null,
    on: false,
    onTime: 0,
    offAcc: 0,
    offSign: 0,
    silentAcc: 0,
    lastHint: 0,
    lastT: -99,
    active: null,
    upcoming: tl.notes[0],
    coach,
    get finished() {
      return this.lastT > tl.duration + 1;
    },
    step(t, midi) {
      const events = [];
      const dt = Math.min(0.1, Math.max(0, t - s.lastT));
      s.lastT = t;
      if (midi != null && Number.isFinite(midi)) {
        s.recent.push(midi);
        if (s.recent.length > 5) s.recent.shift();
        s.unvoiced = 0;
      } else if (++s.unvoiced > 4) {
        s.recent = [];
      }
      const raw = s.recent.length >= 2 ? median(s.recent) : null;
      s.raw = raw;

      const active = s.notes.find((n) => t >= n.start && t < n.end) || null;
      const upcoming =
        s.notes.find((n) => n.end > t) || s.notes[s.notes.length - 1];
      const ref = active || upcoming;
      s.active = active;
      s.upcoming = upcoming;

      let display = null;
      let on = false;
      if (raw !== null) {
        const diff = wrap(raw - ref.midi);
        display = ref.midi + diff;
        if (t >= 0) s.anyVoice = true;
        if (active) {
          on = Math.abs(diff) <= TOLERANCE;
          if (on) {
            active.hit += dt;
            s.offAcc = Math.max(0, s.offAcc - dt * 2);
          } else {
            s.offAcc += dt;
            s.offSign += dt * Math.sign(diff);
          }
          s.silentAcc = 0;
        }
      } else if (active) {
        s.silentAcc += dt;
      }
      s.voice = display;
      s.on = on;
      s.onTime = on ? s.onTime + dt : 0;

      for (const n of s.notes) {
        if (n.done || t < n.end) continue;
        n.done = true;
        n.good = n.hit / n.dur >= GOOD_RATIO;
        if (n.good) {
          s.score++;
          s.streak++;
          events.push({ type: "good", note: n, streak: s.streak });
          if ([3, 6, 10, 15, 20, 30].includes(s.streak)) {
            events.push({ type: "praise", streak: s.streak });
            s.lastHint = t;
          }
        } else {
          s.streak = 0;
          events.push({ type: "miss", note: n });
        }
      }

      if (s.coach && t > 0) {
        if (s.offAcc > 1.0 && t - s.lastHint > 2.5) {
          events.push({
            type: "hint",
            dir: s.offSign < 0 ? "higher" : "lower",
          });
          s.lastHint = t;
          s.offAcc = 0;
          s.offSign = 0;
        } else if (s.silentAcc > 3 && t - s.lastHint > 4) {
          events.push({ type: "singWithMe" });
          s.lastHint = t;
          s.silentAcc = 0;
        }
      }
      return events;
    },
    stars() {
      return starsFor(s.score, s.notes.length, s.anyVoice);
    },
  };
  return s;
}

// Where the song records float in the picker, the buddy's spot and the camera
// frame, for n songs and a viewport aspect. Wide: buddy on the left, records
// in a gentle arc on the right. Tall: records in rows above, buddy in front.
export function pickerLayout(n, aspect) {
  if (aspect >= 1.15) {
    const gap = 2.15;
    const first = -3.0;
    const records = Array.from({ length: n }, (_, i) => {
      const k = n <= 1 ? 0 : i / (n - 1) - 0.5; // -0.5 .. 0.5
      return {
        x: first + i * gap,
        y: 2.15 + Math.cos(k * Math.PI) * 0.4,
        z: -Math.abs(k) * 1.4,
      };
    });
    const right = first + (n - 1) * gap + 1.1;
    const left = -6.3;
    return {
      records,
      buddy: { x: -4.7, z: 0.2 },
      view: {
        center: [(left + right) / 2, 1.8, 0],
        width: right - left,
        height: 4.3,
        elevation: 10,
      },
      wide: true,
    };
  }
  // Tall screens: a grid of records, the buddy standing in the last free slot.
  const cols = aspect >= 0.62 ? 3 : 2;
  const rows = Math.ceil((n + 1) / cols);
  const gapX = cols === 3 ? 2.25 : 2.4;
  const gapY = 3.0;
  const slot = (i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n + 1 - row * cols);
    return {
      x: (i % cols - (inRow - 1) / 2) * gapX,
      y: 1.4 + (rows - 1 - row) * gapY,
      z: -0.4,
    };
  };
  const records = Array.from({ length: n }, (_, i) => slot(i));
  const b = slot(n);
  const top = 1.4 + (rows - 1) * gapY + 1.35;
  return {
    records,
    buddy: { x: b.x, z: 0.6 },
    view: {
      center: [0, top / 2 - 0.1, 0],
      width: cols * gapX + 0.2,
      height: top + 0.3,
      elevation: 6,
    },
    wide: false,
  };
}
