// Adaptive quality. Pure logic (no three.js, no DOM) so it is unit-tested.
//
// Levels:  2 = high   DPR ≤ 2, soft shadows, full particles
//          1 = medium DPR ≤ 1.5, no shadows
//          0 = low    DPR 1, no shadows, fewer particles, no glass blur
//
// The governor watches frame times in windows of `windowS` seconds. A slow
// window (average fps < `lowFps`) drops one level; `upAfterS` seconds of
// smooth frames (> `highFps`) climbs one level — but only once after a drop,
// so it never ping-pongs. At level 0, `slowWindows` slow windows in a row
// mark the device as struggling (the stage then offers the classic 2D game).

export const LEVELS = [
  {
    level: 0,
    name: "low",
    dpr: 1,
    shadows: false,
    particles: 0.4,
    blur: false,
  },
  {
    level: 1,
    name: "medium",
    dpr: 1.5,
    shadows: false,
    particles: 0.75,
    blur: true,
  },
  { level: 2, name: "high", dpr: 2, shadows: true, particles: 1, blur: true },
];

export function settingsFor(level, deviceDpr = 1) {
  const s = LEVELS[Math.max(0, Math.min(2, level))];
  return { ...s, dpr: Math.min(s.dpr, Math.max(1, deviceDpr)) };
}

// Guess a starting level from device hints (all optional).
export function initialLevel({
  cores = 8,
  memory = 8,
  coarse = false,
  saveData = false,
  minSide = 1000,
} = {}) {
  if (saveData) return 0;
  if (cores <= 2 || memory <= 2) return 0;
  if (cores <= 4 || memory <= 4 || (coarse && minSide < 900)) return 1;
  return 2;
}

export class QualityGovernor {
  constructor({
    level = 2,
    lowFps = 45,
    highFps = 57,
    windowS = 2,
    upAfterS = 8,
    slowWindows = 3,
    struggleFps = 22,
    onChange = () => {},
    onStruggle = () => {},
  } = {}) {
    Object.assign(this, {
      level,
      lowFps,
      highFps,
      windowS,
      upAfterS,
      slowWindows,
      struggleFps,
    });
    this.onChange = onChange;
    this.onStruggle = onStruggle;
    this.frames = 0;
    this.time = 0;
    this.goodTime = 0;
    this.drops = 0;
    this.raisedAfterDrop = false;
    this.slowCount = 0;
    this.struggling = false;
    this.fps = 60;
  }

  // Feed one frame's duration in seconds. Ignores huge gaps (tab switches).
  frame(dt) {
    if (!(dt > 0) || dt > 0.5) return;
    this.frames++;
    this.time += dt;
    if (this.time < this.windowS) return;
    const fps = this.frames / this.time;
    this.fps = fps;
    this.frames = 0;
    this.time = 0;
    if (fps < this.lowFps) {
      this.goodTime = 0;
      if (this.level > 0) {
        this.set(this.level - 1);
        this.drops++;
      }
      if (this.level === 0 && fps < this.struggleFps) {
        this.slowCount++;
        if (this.slowCount >= this.slowWindows && !this.struggling) {
          this.struggling = true;
          this.onStruggle(fps);
        }
      } else this.slowCount = 0;
    } else {
      this.slowCount = 0;
      if (fps > this.highFps) {
        this.goodTime += this.windowS;
        const mayRaise = this.drops === 0 || !this.raisedAfterDrop;
        if (this.goodTime >= this.upAfterS && this.level < 2 && mayRaise) {
          if (this.drops > 0) this.raisedAfterDrop = true;
          this.goodTime = 0;
          this.set(this.level + 1);
        }
      } else this.goodTime = 0;
    }
  }

  set(level) {
    const l = Math.max(0, Math.min(2, level));
    if (l === this.level) return;
    this.level = l;
    this.onChange(l);
  }
}
