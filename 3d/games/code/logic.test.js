import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  cellToWorld,
  turn,
  boardArea,
  frameInRect,
  stoneLayout,
  islandLayout,
  hintPath,
  nextLevel,
  worldStars,
  hopRoute,
  seeded,
  stepMs,
  FACING,
  fitPoints,
  boxPoints,
  ellipsePoints,
} from "./logic.js";

const require = createRequire(import.meta.url);
const E = require("../../../games/code/js/engine.js");
const {
  CODE_WORLDS,
  CODE_LEVELS,
} = require("../../../games/code/js/levels.js");

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("cells map to a board centred on the origin, up = away from the camera", () => {
  assert.deepEqual(cellToWorld(0, 0, 1, 1), [0, 0]);
  const [x0, z0] = cellToWorld(0, 0, 4, 3);
  const [x1, z1] = cellToWorld(3, 2, 4, 3);
  assert.ok(near(x0, -x1) && near(z0, -z1), "symmetric");
  assert.ok(z0 < z1, "row 0 is further back (smaller z)");
});

test("facing: moving down faces the camera; turns take the short way", () => {
  assert.equal(FACING.D, 0);
  assert.ok(
    near(turn(FACING.L, FACING.U), -Math.PI / 2) ||
      near(Math.abs(turn(FACING.L, FACING.U)), Math.PI / 2),
  );
  assert.ok(Math.abs(turn(3, -3)) < Math.PI);
  assert.ok(near(turn(0, Math.PI / 2), Math.PI / 2));
});

test("board area grows with the board and flattens with a lower camera", () => {
  const a = boardArea(4, 3, 55);
  const b = boardArea(7, 5, 55);
  assert.ok(b.width > a.width && b.height > a.height);
  assert.ok(boardArea(4, 3, 30).height < boardArea(4, 3, 70).height);
});

test("frameInRect: no insets = centred; insets shift the view towards the free area", () => {
  const base = {
    center: [0, 0, 0],
    width: 3,
    height: 5,
    fov: 40,
    viewW: 400,
    viewH: 800,
  };
  const plain = frameInRect(base);
  assert.ok(near(plain.target[0], 0) && near(plain.target[2], 0));
  // a dock at the bottom: the board must move up on screen, i.e. the camera looks lower
  const dock = frameInRect({
    ...base,
    rect: { left: 0, top: 0, right: 0, bottom: 400 },
  });
  assert.ok(
    dock.distance > plain.distance,
    "smaller free area -> camera further away",
  );
  assert.ok(
    dock.target[1] < 0 || dock.target[2] > 0,
    "camera aims below/in front of the board",
  );
  // a panel on the right: the board moves left, i.e. the camera moves right
  const side = frameInRect({
    ...base,
    viewW: 1280,
    viewH: 800,
    rect: { left: 0, top: 0, right: 500, bottom: 0 },
  });
  assert.ok(side.position[0] > 0 && side.target[0] > 0);
});

test("stone layout: level order runs left->right (wide) or front->back (tall)", () => {
  for (const n of [6, 8]) {
    const w = stoneLayout(n, true);
    const t = stoneLayout(n, false);
    assert.equal(w.stones.length, n);
    for (let i = 1; i < n; i++) {
      assert.ok(w.stones[i].x > w.stones[i - 1].x);
      assert.ok(t.stones[i].z < t.stones[i - 1].z);
    }
    for (const s of w.stones)
      assert.ok(Math.abs(s.x) < w.rx && Math.abs(s.z) < w.rz);
    for (const s of t.stones)
      assert.ok(Math.abs(s.x) < t.rx && Math.abs(s.z) < t.rz);
    // stones never overlap (radius ~0.42)
    for (const L of [w, t])
      for (let i = 1; i < n; i++)
        assert.ok(
          Math.hypot(
            L.stones[i].x - L.stones[i - 1].x,
            L.stones[i].z - L.stones[i - 1].z,
          ) > 0.9,
        );
  }
});

test("islands never overlap", () => {
  const spans = [4, 4, 3.5, 3.5];
  for (const wide of [true, false]) {
    const l = islandLayout(4, wide, spans);
    for (let i = 1; i < 4; i++) {
      const d = wide ? l[i].x - l[i - 1].x : l[i - 1].z - l[i].z;
      assert.ok(d > spans[i] + spans[i - 1], `gap between ${i - 1} and ${i}`);
    }
  }
});

test("hint path follows every level's reference solution to the treat", () => {
  for (const L of CODE_LEVELS) {
    const world = E.parseLevel(L);
    const cells = hintPath(E, world, E.fromCompact(L.solution));
    assert.deepEqual(cells[0], world.start, L.id);
    assert.deepEqual(cells.at(-1), world.treat, L.id);
  }
});

test("next level and world stars read the shared 2D progress", () => {
  assert.equal(nextLevel(E, CODE_LEVELS, {}), 0);
  assert.equal(nextLevel(E, CODE_LEVELS, { "1-1": 3, "1-2": 1 }), 2);
  const all = Object.fromEntries(CODE_LEVELS.map((l) => [l.id, 3]));
  assert.equal(nextLevel(E, CODE_LEVELS, all), CODE_LEVELS.length - 1);
  const s = worldStars(E, CODE_LEVELS, { "1-1": 3, "1-2": 2 }, 0);
  assert.deepEqual(s, {
    got: 5,
    max: CODE_WORLDS[0].levels.length * 3,
    open: true,
    done: false,
  });
  assert.equal(worldStars(E, CODE_LEVELS, {}, 1).open, false);
});

test("hop routes and seeded randoms", () => {
  assert.deepEqual(hopRoute(2, 5), [3, 4, 5]);
  assert.deepEqual(hopRoute(4, 1), [3, 2, 1]);
  assert.deepEqual(hopRoute(3, 3), []);
  const a = seeded(7);
  const b = seeded(7);
  for (let i = 0; i < 5; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v > 0 && v < 1);
  }
});

test("step timing: bumps and splashes linger so kids can see them", () => {
  assert.ok(stepMs({ kind: "move", bump: true }, 300) >= 500);
  assert.ok(stepMs({ kind: "move", splash: true }, 680) > 680);
  assert.ok(stepMs({ kind: "loop" }, 680) < 680);
});

// project like a perspective camera looking from position to target
function project(p, view, fov, aspect) {
  const f = [0, 1, 2].map((i) => view.target[i] - view.position[i]);
  const fl = Math.hypot(...f);
  const fw = f.map((x) => x / fl);
  let r = [fw[1] * 0 - fw[2] * 1, fw[2] * 0 - fw[0] * 0, fw[0] * 1 - fw[1] * 0];
  const rl = Math.hypot(...r);
  r = r.map((x) => x / rl);
  const u = [r[1] * fw[2] - r[2] * fw[1], r[2] * fw[0] - r[0] * fw[2], r[0] * fw[1] - r[1] * fw[0]];
  const v = [0, 1, 2].map((i) => p[i] - view.position[i]);
  const z = v[0] * fw[0] + v[1] * fw[1] + v[2] * fw[2];
  const tv = Math.tan((fov * Math.PI) / 360);
  return [(v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * tv * aspect), (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (z * tv)];
}

test("fitPoints: every point lands inside the free rect, which it fills", () => {
  const pts = boxPoints([-3.5, -0.2, -1.5], [3.5, 1, 1.5]);
  for (const [W, H, rect] of [
    [390, 844, { left: 8, top: 130, right: 8, bottom: 260 }],
    [1280, 800, { left: 8, top: 120, right: 420, bottom: 8 }],
    [768, 1024, { left: 0, top: 0, right: 0, bottom: 0 }],
  ]) {
    const v = fitPoints({ points: pts, fov: 38, viewW: W, viewH: H, rect, elevation: 55, margin: 1.05 });
    const ndc = pts.map((p) => project(p, v, 38, W / H));
    const px = ndc.map(([x, y]) => [((x + 1) / 2) * W, ((1 - y) / 2) * H]);
    const xs = px.map((p) => p[0]);
    const ys = px.map((p) => p[1]);
    assert.ok(Math.min(...xs) >= rect.left - 0.5 && Math.max(...xs) <= W - rect.right + 0.5, `x fits ${W}`);
    assert.ok(Math.min(...ys) >= rect.top - 0.5 && Math.max(...ys) <= H - rect.bottom + 0.5, `y fits ${W}`);
    const fillX = (Math.max(...xs) - Math.min(...xs)) / (W - rect.left - rect.right);
    const fillY = (Math.max(...ys) - Math.min(...ys)) / (H - rect.top - rect.bottom);
    assert.ok(Math.max(fillX, fillY) > 0.9, `fills the free space (${fillX.toFixed(2)}, ${fillY.toFixed(2)})`);
  }
});

test("ellipse points", () => {
  const pts = ellipsePoints([1, 0, 2], 3, 1, [0, 1], 8);
  assert.equal(pts.length, 16);
  assert.ok(pts.every((p) => Math.abs(((p[0] - 1) / 3) ** 2 + (p[2] - 2) ** 2 - 1) < 1e-9));
});
