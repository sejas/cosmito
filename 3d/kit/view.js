// Camera framing maths. Pure (no three.js) so it is unit-tested.

const rad = (d) => (d * Math.PI) / 180;

// Distance a camera must be from a width×height rectangle (facing it) so the
// whole rectangle fits, for a vertical field of view (degrees) and aspect.
export function fitDistance(width, height, fovDeg, aspect) {
  const tv = Math.tan(rad(fovDeg) / 2);
  const th = tv * aspect;
  return Math.max(height / 2 / tv, width / 2 / th);
}

// Camera position looking at `center` ([x,y,z]) from `distance`, raised by
// `elevationDeg` and turned by `azimuthDeg` (0 = from +z, the front).
export function orbitPosition(
  center,
  distance,
  elevationDeg = 20,
  azimuthDeg = 0,
) {
  const e = rad(elevationDeg);
  const a = rad(azimuthDeg);
  return [
    center[0] + distance * Math.cos(e) * Math.sin(a),
    center[1] + distance * Math.sin(e),
    center[2] + distance * Math.cos(e) * Math.cos(a),
  ];
}

// Convenience: frame a width×height area around `center` for a viewport.
// Returns { position, target, distance }. `margin` adds breathing room (1.1 = 10 %).
export function frame({
  center = [0, 0, 0],
  width = 10,
  height = 6,
  fov = 40,
  aspect = 1,
  elevation = 20,
  azimuth = 0,
  margin = 1.1,
}) {
  const distance = fitDistance(width * margin, height * margin, fov, aspect);
  return {
    position: orbitPosition(center, distance, elevation, azimuth),
    target: [...center],
    distance,
  };
}

// ---- exact point-based framing -------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Frame a set of world points ([x, y, z]) so their perspective projection fits
// the free part of the viewport, centred in it. Exact for perspective (near
// rows look bigger), unlike `frame`, which treats the area as a flat card.
//   insets: CSS px kept free at each edge (HUD panels), { left, top, right, bottom }
//   margin: breathing room (1.04 = 4 %); minFree: never frame into less than
//   this fraction of the viewport, however big the insets.
// Returns { position, target, distance } for stage.setView.
export function fitPoints({
  points,
  elevation = 55,
  azimuth = 0,
  fov = 40,
  viewW,
  viewH,
  insets,
  rect, // old name for `insets`
  margin = 1.04,
  minFree = 0.3,
}) {
  const r = { left: 0, top: 0, right: 0, bottom: 0, ...(insets || rect) };
  const e = rad(elevation);
  const a = rad(azimuth);
  const back = [
    Math.cos(e) * Math.sin(a),
    Math.sin(e),
    Math.cos(e) * Math.cos(a),
  ];
  const fwd = scale(back, -1);
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const aspect = viewW / viewH;
  const tanV = Math.tan(rad(fov) / 2);
  const tanH = tanV * aspect;
  const freeW = Math.max(viewW * minFree, viewW - r.left - r.right);
  const freeH = Math.max(viewH * minFree, viewH - r.top - r.bottom);
  // free rect in NDC, shrunk by the margin
  const cx = ((r.left + freeW / 2) / viewW) * 2 - 1;
  const cy = 1 - ((r.top + freeH / 2) / viewH) * 2;
  const hw = freeW / viewW / margin;
  const hh = freeH / viewH / margin;
  // start: centroid, distance from a flat fit; then iterate on the projection
  const c = [0, 0, 0];
  for (const p of points)
    for (let i = 0; i < 3; i++) c[i] += p[i] / points.length;
  let span = 0;
  for (const p of points)
    span = Math.max(span, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
  let target = c;
  let d = Math.max(0.5, span / Math.min(tanV * hh, tanH * hw));
  for (let it = 0; it < 40; it++) {
    const pos = add(target, scale(back, d));
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      const v = sub(p, pos);
      const z = Math.max(0.05, dot(v, fwd));
      const x = dot(v, right) / (z * tanH);
      const y = dot(v, up) / (z * tanV);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const s = Math.max((x1 - x0) / 2 / hw, (y1 - y0) / 2 / hh);
    // shift so the projected box centre lands on the free rect centre
    const mx = (x0 + x1) / 2 - cx;
    const my = (y0 + y1) / 2 - cy;
    target = add(
      target,
      add(scale(right, mx * tanH * d), scale(up, my * tanV * d)),
    );
    const nd = d * (1 + (s - 1) * 0.8);
    if (Math.abs(nd - d) < 1e-5 && Math.abs(mx) < 1e-5 && Math.abs(my) < 1e-5)
      break;
    d = nd;
  }
  return { position: add(target, scale(back, d)), target, distance: d };
}

// The 8 corners of an axis-aligned box: min/max as [x, y, z].
export function boxPoints(min, max) {
  const out = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
}

// Points around an ellipse (centre [x,y,z], radii rx, rz) at heights ys
// (relative to the centre): islands, round boards, arenas.
export function ellipsePoints(center, rx, rz, ys = [0], n = 16) {
  const out = [];
  for (const y of ys)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([
        center[0] + Math.cos(a) * rx,
        center[1] + y,
        center[2] + Math.sin(a) * rz,
      ]);
    }
  return out;
}
