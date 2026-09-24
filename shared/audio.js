// Tiny Web Audio synth for game sounds. No audio files needed.
// Browsers only allow audio after a user gesture: call `await KidsAudio.ensure()`
// from a click handler before playing.
const KidsAudio = (() => {
  let ctx = null;
  let master = null;
  let muted = KidsStore.load("muted", false);

  async function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }

  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Schedule one note. Returns the oscillator so callers can stop it early.
  function tone(
    midi,
    when = ctx.currentTime,
    dur = 0.15,
    vol = 0.16,
    type = "triangle",
  ) {
    if (!ctx) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = midiToHz(midi);
    const end = when + Math.max(0.08, dur - 0.04);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.03);
    gain.gain.setValueAtTime(vol * 0.8, Math.max(when + 0.03, end - 0.06));
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain).connect(master);
    osc.start(when);
    osc.stop(end + 0.02);
    return osc;
  }

  function seq(midis, step, vol, type) {
    if (!ctx) return;
    const t = ctx.currentTime;
    midis.forEach((m, i) => tone(m, t + i * step, step * 1.2, vol, type));
  }

  // Named sound effects shared by all games.
  const SFX = {
    tap: () => seq([79], 0.06, 0.08, "sine"),
    correct: () => seq([76, 81, 88], 0.08, 0.12, "sine"),
    wrong: () => seq([62, 58], 0.14, 0.1, "triangle"),
    star: () => seq([84, 88, 91, 96], 0.07, 0.1, "sine"),
    fanfare: () => seq([72, 76, 79, 84, 79, 84], 0.12, 0.14, "triangle"),
    chirp: () => seq([84, 88, 91], 0.07, 0.1, "sine"),
    squeak: () => seq([91, 95, 93, 98], 0.05, 0.08, "square"),
    level: () => seq([67, 72, 76, 79, 84], 0.09, 0.12, "triangle"),
  };

  function sfx(name) {
    if (ctx && SFX[name]) SFX[name]();
  }

  function setMuted(v) {
    muted = v;
    KidsStore.save("muted", v);
    if (master) master.gain.value = v ? 0 : 0.9;
  }

  return {
    ensure,
    ctx: () => ctx,
    tone,
    sfx,
    midiToHz,
    isMuted: () => muted,
    setMuted,
  };
})();
