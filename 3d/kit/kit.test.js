// Tests for the kit's pure logic. Run: node --test "3d/**/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";
import { ease, clamp, damp, Spring, Tweens } from "./motion.js";
import { QualityGovernor, settingsFor, initialLevel } from "./quality.js";
import { fitDistance, orbitPosition, frame } from "./view.js";

test("fitDistance fits the limiting side", () => {
  // Square view, fov 90°: half-height 1 at distance 1.
  assert.ok(Math.abs(fitDistance(2, 2, 90, 1) - 1) < 1e-9);
  // Portrait (aspect 0.5): width limits.
  assert.ok(Math.abs(fitDistance(2, 2, 90, 0.5) - 2) < 1e-9);
  // Wide (aspect 2): height limits.
  assert.ok(Math.abs(fitDistance(2, 2, 90, 2) - 1) < 1e-9);
});

test("orbitPosition places the camera above and in front", () => {
  const [x, y, z] = orbitPosition([0, 1, 0], 10, 30, 0);
  assert.ok(Math.abs(x) < 1e-9);
  assert.ok(Math.abs(y - 6) < 1e-9);
  assert.ok(z > 8);
  const f = frame({
    width: 4,
    height: 4,
    fov: 90,
    aspect: 1,
    elevation: 0,
    margin: 1,
  });
  assert.deepEqual(f.target, [0, 0, 0]);
  assert.ok(Math.abs(f.position[2] - 2) < 1e-9);
});

test("easings start at 0 and end at 1", () => {
  for (const [name, fn] of Object.entries(ease)) {
    assert.ok(Math.abs(fn(0)) < 1e-9, `${name}(0)`);
    assert.ok(Math.abs(fn(1) - 1) < 1e-9, `${name}(1)`);
  }
  assert.ok(ease.outBack(0.7) > 1, "outBack overshoots");
});

test("clamp and damp", () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-1), 0);
  let v = 0;
  for (let i = 0; i < 120; i++) v = damp(v, 10, 8, 1 / 60);
  assert.ok(Math.abs(v - 10) < 0.01);
  // Frame-rate independent: 30 fps reaches the same place as 60 fps.
  let a = 0;
  let b = 0;
  for (let i = 0; i < 60; i++) a = damp(a, 1, 3, 1 / 60);
  for (let i = 0; i < 30; i++) b = damp(b, 1, 3, 1 / 30);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("spring settles on its target, overshooting on the way", () => {
  const s = new Spring(0, { stiffness: 300, damping: 14 });
  s.target = 1;
  let max = 0;
  for (let i = 0; i < 240; i++) max = Math.max(max, s.step(1 / 60));
  assert.ok(max > 1, "bouncy");
  assert.ok(s.settled, "settled");
});

test("spring survives a huge frame without exploding", () => {
  const s = new Spring(0);
  s.target = 1;
  s.step(3);
  assert.ok(Number.isFinite(s.value) && Math.abs(s.value) < 3);
});

test("tweens run, report progress and resolve", async () => {
  const tw = new Tweens();
  const seen = [];
  const h = tw.add({
    from: 0,
    to: 10,
    ms: 100,
    ease: "linear",
    onUpdate: (v) => seen.push(v),
  });
  for (let i = 0; i < 12; i++) tw.update(0.01);
  assert.equal(await h.done, true);
  assert.equal(seen.at(-1), 10);
  assert.equal(tw.size, 0);
});

test("tween delay and cancel", async () => {
  const tw = new Tweens();
  let calls = 0;
  const h = tw.add({ ms: 100, delay: 50, onUpdate: () => calls++ });
  tw.update(0.04);
  assert.equal(calls, 0);
  h.cancel();
  tw.update(0.04);
  assert.equal(await h.done, false);
  assert.equal(tw.size, 0);
});

test("quality settings cap DPR by level and device", () => {
  assert.equal(settingsFor(2, 3).dpr, 2);
  assert.equal(settingsFor(1, 3).dpr, 1.5);
  assert.equal(settingsFor(2, 1).dpr, 1);
  assert.equal(settingsFor(0, 2).shadows, false);
  assert.equal(settingsFor(9, 2).level, 2);
});

test("initial level from device hints", () => {
  assert.equal(initialLevel({ cores: 8, memory: 8 }), 2);
  assert.equal(initialLevel({ cores: 4, memory: 8 }), 1);
  assert.equal(
    initialLevel({ cores: 8, memory: 8, coarse: true, minSide: 768 }),
    1,
  );
  assert.equal(initialLevel({ cores: 2 }), 0);
  assert.equal(initialLevel({ saveData: true }), 0);
});

const run = (g, fps, seconds) => {
  for (let i = 0; i < fps * seconds; i++) g.frame(1 / fps);
};

test("governor drops a level on slow frames and climbs back once", () => {
  const changes = [];
  const g = new QualityGovernor({ level: 2, onChange: (l) => changes.push(l) });
  run(g, 30, 2.1);
  assert.equal(g.level, 1);
  run(g, 60, 10);
  assert.equal(g.level, 2, "raised after sustained smooth frames");
  run(g, 30, 2.1);
  assert.equal(g.level, 1);
  run(g, 60, 30);
  assert.equal(g.level, 1, "no ping-pong: only one raise after a drop");
  assert.deepEqual(changes, [1, 2, 1]);
});

test("governor flags a struggling device at the lowest level", () => {
  let struggled = 0;
  const g = new QualityGovernor({ level: 0, onStruggle: () => struggled++ });
  run(g, 15, 5);
  assert.equal(struggled, 0);
  run(g, 15, 3);
  assert.equal(struggled, 1);
  run(g, 15, 10);
  assert.equal(struggled, 1, "only once");
});

test("governor ignores tab-switch gaps", () => {
  const g = new QualityGovernor({ level: 2 });
  g.frame(5);
  run(g, 60, 3);
  assert.equal(g.level, 2);
});
