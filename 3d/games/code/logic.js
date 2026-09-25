// Pure helpers for the 3D coding game: board/map layout, camera framing inside
// the free part of the screen, hint paths and progress summaries.
// No three.js, no DOM: unit-tested in logic.test.js. The game rules themselves
// (interpreter, stars, hints, unlocking) come from the 2D CodeEngine.
import { frame } from "../../kit/view.js";

export const TILE = 1; // world units per board cell

// Which way the buddy faces for each move (rotation.y; 0 = towards the camera).
export const FACING = { D: 0, R: Math.PI / 2, U: Math.PI, L: -Math.PI / 2 };

// Board cell (x right, y down, as in the level maps) -> world [x, z].
// The board is centred on the origin; "up" on the map is away from the camera.
export function cellToWorld(x, y, w, h, size = TILE) {
  return [(x - (w - 1) / 2) * size, (y - (h - 1) / 2) * size];
}

// Shortest signed turn from angle a to angle b (radians), in -PI..PI.
export function turn(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// The area a camera must see to show a w×h board from `elevation` degrees:
// the board's depth is foreshortened, props and the buddy stick up.
export function boardArea(
  w,
  h,
  elevation = 55,
  { size = TILE, rim = 0.8, tall = 1.1 } = {},
) {
  const e = (elevation * Math.PI) / 180;
  return {
    width: w * size + rim,
    height: (h * size + rim) * Math.sin(e) + tall * Math.cos(e),
  };
}

// Frame an area so it sits centred inside a sub-rectangle of the viewport
// (the space the HUD leaves free). `rect` is in CSS px: { left, top, right, bottom }
// insets from the viewport edges. Returns { position, target } for stage.setView.
export function frameInRect({
  center = [0, 0, 0],
  width,
  height,
  elevation = 55,
  azimuth = 0,
  fov = 40,
  viewW,
  viewH,
  rect = { left: 0, top: 0, right: 0, bottom: 0 },
  margin = 1.08,
  minFree = 0.3,
}) {
  const freeW = Math.max(viewW * minFree, viewW - rect.left - rect.right);
  const freeH = Math.max(viewH * minFree, viewH - rect.top - rect.bottom);
  const fx = freeW / viewW;
  const fy = freeH / viewH;
  const f = frame({
    center,
    width: width / fx,
    height: height / fy,
    fov,
    aspect: viewW / viewH,
    elevation,
    azimuth,
    margin,
  });
  // Where the free rect's centre is, in NDC (-1..1, y up).
  const cx = ((rect.left + freeW / 2) / viewW) * 2 - 1;
  const cy = 1 - ((rect.top + freeH / 2) / viewH) * 2;
  const halfH = f.distance * Math.tan((fov * Math.PI) / 360);
  const halfW = halfH * (viewW / viewH);
  // Camera basis.
  const fwd = norm(sub(f.target, f.position));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const shift = add(scale(right, -cx * halfW), scale(up, -cy * halfH));
  return {
    position: add(f.position, shift),
    target: add(f.target, shift),
    distance: f.distance,
  };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Level stones on a world island: a zigzag path, level 1 first.
// wide: the path runs left -> right; tall: front -> back (away from the camera).
// Returns { stones: [{x, z}], rx, rz } (island half-size along x and z).
export function stoneLayout(n, wide) {
  const pitch = wide ? 1.25 : 0.95;
  const sway = wide ? 0.8 : 0.95;
  const len = (n - 1) * pitch;
  const stones = [];
  for (let i = 0; i < n; i++) {
    const along = -len / 2 + i * pitch;
    const cross = (i % 2 ? 1 : -1) * sway;
    stones.push(wide ? { x: along, z: cross } : { x: cross, z: -along });
  }
  const rAlong = len / 2 + 1.6;
  const rCross = sway + 1.55;
  return {
    stones,
    rx: wide ? rAlong : rCross,
    rz: wide ? rCross : rAlong,
  };
}

// Islands of the world map in a chain: wide = side by side, tall = going back
// and up (each further world floats a little higher).
export function islandLayout(count, wide, spans) {
  const out = [];
  let along = 0;
  for (let i = 0; i < count; i++) {
    if (i > 0) along += spans[i - 1] + spans[i] + 2.6;
    out.push(
      wide
        ? { x: along, y: i * 0.4, z: -i * 0.6 }
        : { x: i % 2 ? 0.6 : -0.6, y: i * 1.2, z: -along },
    );
  }
  return out;
}

// Cells the reference solution walks through, starting cell included, for
// the glowing hint path. Stops where the solution stops.
export function hintPath(E, world, solution) {
  const res = E.run(world, solution);
  const cells = [{ x: world.start.x, y: world.start.y }];
  for (const s of res.trace) {
    if (s.kind !== "move" || s.bump) continue;
    cells.push({ x: s.x, y: s.y });
  }
  return cells;
}

// The level to suggest: the first open level without stars, else the last open.
export function nextLevel(E, levels, best) {
  let lastOpen = 0;
  for (let i = 0; i < levels.length; i++) {
    if (!E.unlocked(levels, best, i)) break;
    lastOpen = i;
    if (!best[levels[i].id]) return i;
  }
  return lastOpen;
}

// Stars in one world: { got, max, open, done }.
export function worldStars(E, levels, best, wi) {
  const idx = levels
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.world === wi);
  const got = idx.reduce((s, { l }) => s + Math.min(3, best[l.id] || 0), 0);
  return {
    got,
    max: idx.length * 3,
    open: E.unlocked(levels, best, idx[0].i),
    done: idx.every(({ l }) => best[l.id] > 0),
  };
}

// Stones the buddy hops over to go from one level to another on the same island.
export function hopRoute(from, to) {
  const out = [];
  const step = to > from ? 1 : -1;
  for (let i = from; i !== to; i += step) out.push(i + step);
  return out;
}

// Deterministic pseudo-random numbers (decorations must not change between visits).
export function seeded(seed = 1) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Duration (ms) of each animated trace step at a given base speed.
export function stepMs(step, base) {
  if (step.kind === "loop") return base * 0.4;
  if (step.kind === "check") return base * 0.55;
  if (step.bump) return Math.max(base, 500);
  if (step.splash) return base + Math.max(base, 600);
  return base;
}

// Exact point-based framing now lives in the kit (Kit.fitPoints, stage.fitPoints).
export { fitPoints, boxPoints, ellipsePoints } from "../../kit/view.js";
