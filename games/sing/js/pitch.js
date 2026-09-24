// Pitch detection (YIN) — robust against octave errors, cheap enough for 60 fps.
const Pitch = (() => {
  const MIN_HZ = 75;
  const MAX_HZ = 1100;
  const THRESHOLD = 0.15;
  const SILENCE_RMS = 0.01;

  let d = null;

  function detect(buf, sampleRate) {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    if (rms < SILENCE_RMS) return { hz: 0, rms };

    const maxTau = Math.min(Math.floor(sampleRate / MIN_HZ), buf.length >> 1);
    const minTau = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    const win = buf.length - maxTau;
    if (!d || d.length !== maxTau + 1) d = new Float32Array(maxTau + 1);

    // Difference function, then cumulative mean normalised in place.
    d[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < win; i++) {
        const x = buf[i] - buf[i + tau];
        sum += x * x;
      }
      running += sum;
      d[tau] = running ? (sum * tau) / running : 1;
    }

    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (d[t] < THRESHOLD) {
        while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) return { hz: 0, rms };

    const x0 = d[tau - 1];
    const x1 = d[tau];
    const x2 = tau + 1 <= maxTau ? d[tau + 1] : x1;
    const denom = x0 + x2 - 2 * x1;
    const shift = denom ? (x0 - x2) / (2 * denom) : 0;
    return { hz: sampleRate / (tau + shift), rms };
  }

  const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  return { detect, hzToMidi, midiToHz };
})();
