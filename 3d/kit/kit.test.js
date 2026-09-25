// Tests for the kit's pure logic. Run: node --test "3d/**/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";
import { ease, clamp, damp, Spring, Tweens } from "./motion.js";
import { QualityGovernor, settingsFor, initialLevel } from "./quality.js";
import {
  fitDistance,
  orbitPosition,
  frame,
  fitPoints,
  boxPoints,
  ellipsePoints,
} from "./view.js";
import { clampPin, isShown } from "./screen.js";

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

// Project like a perspective camera looking from view.position to view.target.
function project(p, view, fov, aspect) {
  const f = [0, 1, 2].map((i) => view.target[i] - view.position[i]);
  const fl = Math.hypot(...f);
  const fw = f.map((x) => x / fl);
  let r = [-fw[2], 0, fw[0]];
  const rl = Math.hypot(...r);
  r = r.map((x) => x / rl);
  const u = [
    r[1] * fw[2] - r[2] * fw[1],
    r[2] * fw[0] - r[0] * fw[2],
    r[0] * fw[1] - r[1] * fw[0],
  ];
  const v = [0, 1, 2].map((i) => p[i] - view.position[i]);
  const z = v[0] * fw[0] + v[1] * fw[1] + v[2] * fw[2];
  const tv = Math.tan((fov * Math.PI) / 360);
  return [
    (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * tv * aspect),
    (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (z * tv),
  ];
}

test("fitPoints: every point lands inside the free rect, which it fills", () => {
  const pts = boxPoints([-3.5, -0.2, -1.5], [3.5, 1, 1.5]);
  for (const [W, H, insets, elevation] of [
    [390, 844, { left: 8, top: 130, right: 8, bottom: 260 }, 55],
    [1280, 800, { left: 8, top: 120, right: 420, bottom: 8 }, 55],
    [768, 1024, {}, 55],
    [390, 844, { top: 100, bottom: 100 }, 20],
  ]) {
    const v = fitPoints({ points: pts, fov: 38, viewW: W, viewH: H, insets, elevation, margin: 1.05 });
    const r = { left: 0, top: 0, right: 0, bottom: 0, ...insets };
    const px = pts
      .map((p) => project(p, v, 38, W / H))
      .map(([x, y]) => [((x + 1) / 2) * W, ((1 - y) / 2) * H]);
    const xs = px.map((p) => p[0]);
    const ys = px.map((p) => p[1]);
    assert.ok(Math.min(...xs) >= r.left - 0.5 && Math.max(...xs) <= W - r.right + 0.5, `x fits ${W}`);
    assert.ok(Math.min(...ys) >= r.top - 0.5 && Math.max(...ys) <= H - r.bottom + 0.5, `y fits ${W}`);
    const fillX = (Math.max(...xs) - Math.min(...xs)) / (W - r.left - r.right);
    const fillY = (Math.max(...ys) - Math.min(...ys)) / (H - r.top - r.bottom);
    assert.ok(Math.max(fillX, fillY) > 0.9, `fills the free space (${fillX.toFixed(2)}, ${fillY.toFixed(2)})`);
  }
});

test("fitPoints keeps the near row in view where a flat frame clips it", () => {
  // A deep board seen from 55°: the near edge is much closer to the camera.
  const pts = boxPoints([-3, 0, -6], [3, 0.5, 6]);
  const W = 1280;
  const H = 800;
  const flat = frame({ center: [0, 0.25, 0], width: 6, height: 12 * Math.sin((55 * Math.PI) / 180), fov: 40, aspect: W / H, elevation: 55, margin: 1 });
  const flatY = pts.map((p) => project(p, flat, 40, W / H)[1]);
  assert.ok(Math.min(...flatY) < -1, "the flat frame clips the near row (the bug)");
  const exact = fitPoints({ points: pts, fov: 40, viewW: W, viewH: H, elevation: 55, margin: 1 });
  const ndc = pts.map((p) => project(p, exact, 40, W / H));
  assert.ok(ndc.every(([x, y]) => Math.abs(x) <= 1 + 1e-3 && Math.abs(y) <= 1 + 1e-3));
});

test("fitPoints accepts the old `rect` name for insets", () => {
  const pts = boxPoints([-1, 0, -1], [1, 1, 1]);
  const a = fitPoints({ points: pts, viewW: 800, viewH: 600, insets: { top: 100 } });
  const b = fitPoints({ points: pts, viewW: 800, viewH: 600, rect: { top: 100 } });
  assert.deepEqual(a, b);
});

test("ellipse points", () => {
  const pts = ellipsePoints([1, 0, 2], 3, 1, [0, 1], 8);
  assert.equal(pts.length, 16);
  assert.ok(pts.every((p) => Math.abs(((p[0] - 1) / 3) ** 2 + (p[2] - 2) ** 2 - 1) < 1e-9));
  assert.equal(boxPoints([0, 0, 0], [1, 1, 1]).length, 8);
});

test("clampPin keeps a bubble inside the viewport and its tail on the anchor", () => {
  const vp = { width: 390, height: 844, margin: 10 };
  // centred, room to spare: untouched
  let r = clampPin({ ...vp, x: 195, y: 400, w: 200, h: 60, align: "bottom" });
  assert.deepEqual(r, { left: 95, top: 340, tail: 0 });
  // anchor near the left edge: pushed right, tail points back left
  r = clampPin({ ...vp, x: 40, y: 400, w: 200, h: 60, align: "bottom" });
  assert.equal(r.left, 10);
  assert.equal(r.tail, 40 - 110);
  // near the right edge
  r = clampPin({ ...vp, x: 385, y: 400, w: 200, h: 60, align: "bottom" });
  assert.equal(r.left + 200, 380);
  assert.ok(r.tail > 0 && r.tail <= 100 - 22, "tail clamped to the bubble body");
  // anchor off-screen: tail stays on the body
  r = clampPin({ ...vp, x: -300, y: 400, w: 200, h: 60 });
  assert.equal(r.left, 10);
  assert.equal(r.tail, -(100 - 22));
  // above the top edge: pushed down
  r = clampPin({ ...vp, x: 195, y: 20, w: 200, h: 60, align: "bottom" });
  assert.equal(r.top, 10);
  // top align: element below the point
  r = clampPin({ ...vp, x: 195, y: 830, w: 100, h: 40, align: "top" });
  assert.equal(r.top, 844 - 10 - 40);
  // wider than the viewport: centred
  r = clampPin({ ...vp, x: 100, y: 400, w: 500, h: 60 });
  assert.equal(r.left, (390 - 500) / 2);
});

test("isShown needs every ancestor visible", () => {
  const root = { visible: true, parent: null };
  const group = { visible: true, parent: root };
  const mesh = { visible: true, parent: group };
  assert.equal(isShown(mesh), true);
  group.visible = false;
  assert.equal(isShown(mesh), false, "hidden parent hides the child");
  group.visible = true;
  mesh.visible = false;
  assert.equal(isShown(mesh), false);
});
