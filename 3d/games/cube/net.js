// The flat "net" view: the cube unfolded (top above front; left, front, right
// and back in a row; bottom below). Used when the device can't show 3D
// (no WebGL2) — same API as the 3D view, so the whole game still works:
// tap a side to pick it, turn it with the arrow buttons, follow the guide.
/* global CubeEngine */
import { STICKER, BLANK } from "./palette.js";

const E = CubeEngine;
// grid spots (column, row) of each face U R F D L B
const SPOT = [
  [2, 1],
  [3, 2],
  [2, 2],
  [2, 3],
  [1, 2],
  [4, 2],
];

export function createNetView(container, handlers = {}) {
  const net = document.createElement("div");
  net.className = "net";
  container.appendChild(net);
  let n = 3;
  let cells = [];
  let faces = [];
  let busy = 0;
  let enabled = true;
  let selected = -1;
  let current = null;
  const badge = document.createElement("div");
  badge.className = "net-badge";
  badge.hidden = true;

  function build(size) {
    n = size;
    net.textContent = "";
    net.style.setProperty("--n", n);
    cells = [];
    faces = [];
    for (let f = 0; f < 6; f++) {
      const face = document.createElement("div");
      face.className = "net-face";
      face.style.gridColumn = SPOT[f][0];
      face.style.gridRow = SPOT[f][1];
      face.dataset.face = f;
      for (let k = 0; k < n * n; k++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "net-cell";
        b.tabIndex = -1;
        const i = f * n * n + k;
        b.dataset.i = i;
        b.addEventListener("click", () => {
          if (!enabled) return;
          handlers.onStickerTap?.(i);
          select(f);
          handlers.onFaceSelect?.(f);
        });
        face.appendChild(b);
        cells[i] = b;
      }
      const arrow = document.createElement("div");
      arrow.className = "net-arrow";
      arrow.setAttribute("aria-hidden", "true");
      face.appendChild(arrow);
      net.appendChild(face);
      faces.push(face);
    }
    net.appendChild(badge);
    if (current && current.length === 6 * n * n) setState(current);
  }
  function setState(s) {
    current = s.slice();
    s.forEach((c, i) => {
      if (cells[i])
        cells[i].style.background = c >= 0 && c < 6 ? STICKER[c] : BLANK;
    });
  }
  function select(f) {
    selected = f;
    faces.forEach((el, k) => el.classList.toggle("selected", k === f));
  }
  function turn(move, { ms = 250, after = null } = {}) {
    const info = E.moveInfo(move, n);
    const f = "URFDLB".indexOf(info.letter);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = f >= 0 ? faces[f] : net;
    const dur = reduced ? 0 : Math.max(60, ms);
    busy++;
    el.style.setProperty("--spin-ms", `${dur}ms`);
    el.classList.add(
      info.turns === 3 ? "spin-ccw" : info.turns === 2 ? "spin-2" : "spin-cw",
    );
    return new Promise((resolve) =>
      setTimeout(() => {
        el.classList.remove("spin-cw", "spin-ccw", "spin-2");
        if (after) setState(after);
        busy--;
        resolve();
      }, dur),
    );
  }
  function arrow(move) {
    faces.forEach((el) => (el.querySelector(".net-arrow").textContent = ""));
    badge.hidden = true;
    if (!move) return;
    const info = E.moveInfo(move, n);
    const f = "URFDLB".indexOf(info.letter);
    // seen from outside each face (as the net shows it): turns 1 = clockwise
    const glyph = info.turns === 1 ? "↻" : info.turns === 3 ? "↺" : "↻²";
    if (f >= 0) faces[f].querySelector(".net-arrow").textContent = glyph;
    else {
      badge.textContent = handlers.badgeText?.(move) || move;
      badge.hidden = false;
    }
  }
  function glow(indices, { error = false } = {}) {
    cells.forEach((c) => c.classList.remove("glow", "err"));
    for (const i of indices || [])
      cells[i]?.classList.add(error ? "err" : "glow");
  }
  build(3);
  return {
    el: net,
    get n() {
      return n;
    },
    get busy() {
      return busy > 0;
    },
    get selected() {
      return selected;
    },
    set enabled(v) {
      enabled = v;
    },
    build,
    setState,
    turn,
    arrow,
    glow,
    select,
    present: (face) => select(face ?? -1),
  };
}
