// Little isometric cube drawings (SVG strings) for the stage bar, the lesson
// cards and the "how to hold it" diagrams. No three.js: they also work in the
// flat fallback.
/* global CubeEngine */
import { STICKER } from "./palette.js";

const E = CubeEngine;
const GREY = "#9aa3c2";
const FACE_U = 0;
const FACE_R = 1;
const FACE_F = 2;
const project = ([x, y, z]) => [(x - z) * 0.866, (x + z) * 0.5 - y];

// colorAt(face, row, col) -> css colour or null (grey). Draws U, F, R.
export function isoCube(
  n,
  colorAt,
  { size = 40, stroke = "#26315c", label = "" } = {},
) {
  const h = n / 2;
  const polys = [];
  const quad = (face, r, c) => {
    // sticker corners in 3D, inset a little
    const inset = 0.09;
    const u0 = c + inset;
    const u1 = c + 1 - inset;
    const v0 = r + inset;
    const v1 = r + 1 - inset;
    const pt = (u, v) => {
      if (face === FACE_U) return [-h + u, h, -h + v];
      if (face === FACE_F) return [-h + u, h - v, h];
      return [h, h - v, h - u]; // R
    };
    return [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)].map(project);
  };
  const faceOutline = (face) => {
    const pt = (u, v) => {
      if (face === FACE_U) return [-h + u, h, -h + v];
      if (face === FACE_F) return [-h + u, h - v, h];
      return [h, h - v, h - u];
    };
    return [pt(0, 0), pt(n, 0), pt(n, n), pt(0, n)].map(project);
  };
  for (const f of [FACE_U, FACE_F, FACE_R]) {
    polys.push(
      `<polygon points="${faceOutline(f)
        .map((p) => p.map((v) => v.toFixed(2)).join(","))
        .join(
          " ",
        )}" fill="${stroke}" stroke="${stroke}" stroke-width="0.16" stroke-linejoin="round"/>`,
    );
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const col = colorAt(f, r, c) || GREY;
        polys.push(
          `<polygon points="${quad(f, r, c)
            .map((p) => p.map((v) => v.toFixed(2)).join(","))
            .join(" ")}" fill="${col}"/>`,
        );
      }
  }
  const w = n * 0.866 * 2 + 0.4;
  const top = -n - 0.2;
  const hgt = n * 2 + 0.4;
  return `<svg viewBox="${(-w / 2).toFixed(2)} ${top.toFixed(2)} ${w.toFixed(2)} ${hgt.toFixed(2)}" width="${size}" height="${size}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${polys.join("")}</svg>`;
}

// The stage icons: what the cube looks like once each stage is done (white
// on top for the first stages, yellow on top for the rest).
export function stageIcon(n, stage, opts) {
  const ids = E.STAGES[n];
  const id = ids[stage];
  const yellowTop = n === 3 ? stage >= 2 : stage >= 1;
  const s = yellowTop ? E.apply(E.solved(n), ["z2"]) : E.solved(n);
  const later = (x) => ids.indexOf(x) <= stage; // is stage x done in this picture?
  const top = (r, c) => {
    const centre = n === 3 && r === 1 && c === 1;
    const edge = n === 3 && !centre && (r === 1 || c === 1);
    if (!yellowTop) return id === "cross" ? edge || centre : true;
    if (later("ytwist")) return true;
    return centre || (edge && later("ycross"));
  };
  const side = (r, c) => {
    const edge = n === 3 && c === 1;
    if (!yellowTop) return r === 0 && (id === "cross" ? edge : true);
    if (r > 0) return true; // the first layers, now at the bottom
    if (later("yplace")) return true;
    return edge && later("yedges");
  };
  return isoCube(
    n,
    (f, r, c) => {
      const i = f * n * n + r * n + c;
      const on = f === 0 ? top(r, c) : side(r, c);
      return on ? STICKER[s[i]] : null;
    },
    opts,
  );
}

// A cube with each visible face in one colour (hold diagrams). faces = [U, F, R]
// colour ids (or -1 for grey); `hi` = which of them to outline in pink.
export function holdIcon(n, [u, f, r], opts) {
  return isoCube(
    n,
    (face) => {
      const c = face === 0 ? u : face === 2 ? f : r;
      return c >= 0 ? STICKER[c] : null;
    },
    opts,
  );
}
