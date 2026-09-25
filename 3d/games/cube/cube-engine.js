// Cube engine: a twisty puzzle cube (2x2 and 3x3) as plain data, plus a
// beginner layer-by-layer solver that works from ANY valid state.
// Classic script (global `CubeEngine`) + module.exports, so it runs in the
// browser (3D view and the flat fallback) and in node:test.
//
// STATE: an array of 6·n² colour ids, one per sticker ("facelet"), as the cube
// is HELD right now. Faces in order U R F D L B, each face row-major as seen
// from outside (U: back row first; D: front row first; side faces: top row
// first, B seen from behind). Colour ids = the face they belong to when
// solved in the standard scheme: 0 white (U), 1 red (R), 2 green (F),
// 3 yellow (D), 4 orange (L), 5 blue (B). -1 = not painted yet.
//
// MOVES: U D R L F B (outer layers), M E S (3x3 middle slices), x y z (the
// whole cube). Suffix ' = counter-clockwise, 2 = half turn. Clockwise is as
// seen looking at that face; x follows R, y follows U, z follows F.
/* eslint-disable no-var */
var CubeEngine = (() => {
  const FACES = "URFDLB";
  const COLORS = ["white", "red", "green", "yellow", "orange", "blue"];
  const WHITE = 0;
  const YELLOW = 3;
  const OPP = (c) => (c + 3) % 6;
  const NORMALS = [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 1],
    [0, -1, 0],
    [-1, 0, 0],
    [0, 0, -1],
  ];
  const faceOfNormal = (v) =>
    NORMALS.findIndex((n) => n[0] === v[0] && n[1] === v[1] && n[2] === v[2]);

  // ---------------------------------------------------------------- geometry
  // Every sticker: its face, row, col, the cubie it sits on (coordinates
  // centred on 0, one unit per cubie) and its outward normal.
  const geoCache = {};
  function geometry(n) {
    if (geoCache[n]) return geoCache[n];
    const h = (n - 1) / 2;
    const stickers = [];
    for (let f = 0; f < 6; f++)
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          let p;
          if (f === 0) p = [c - h, h, r - h];
          else if (f === 1) p = [h, h - r, h - c];
          else if (f === 2) p = [c - h, h - r, h];
          else if (f === 3) p = [c - h, -h, h - r];
          else if (f === 4) p = [-h, h - r, c - h];
          else p = [h - c, h - r, -h];
          stickers.push({
            face: f,
            row: r,
            col: c,
            pos: p,
            normal: NORMALS[f],
          });
        }
    const key = (p, f) => `${p[0]},${p[1]},${p[2]}|${f}`;
    const index = new Map(stickers.map((s, i) => [key(s.pos, s.face), i]));
    // cubies: stickers grouped by position
    const byPos = new Map();
    stickers.forEach((s, i) => {
      const k = s.pos.join(",");
      if (!byPos.has(k)) byPos.set(k, { pos: s.pos, stickers: [] });
      byPos.get(k).stickers.push(i);
    });
    const cubies = [...byPos.values()];
    const det = (a, b, c) =>
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
    // Corners: U/D sticker first, then the other two in one fixed handedness
    // (the same as U, R, F at the up-right-front corner).
    const corners = cubies
      .filter((c) => c.stickers.length === 3)
      .map((c) => {
        const ud = c.stickers.find((i) => stickers[i].face % 3 === 0);
        const [a, b] = c.stickers.filter((i) => i !== ud);
        const N = (i) => stickers[i].normal;
        return det(N(ud), N(a), N(b)) === -1 ? [ud, a, b] : [ud, b, a];
      });
    // Edges: U/D sticker first, else the F/B one.
    const edges = cubies
      .filter((c) => c.stickers.length === 2)
      .map((c) => {
        const [a, b] = c.stickers;
        const rank = (i) =>
          stickers[i].face % 3 === 0 ? 0 : stickers[i].face % 3 === 2 ? 1 : 2;
        return rank(a) <= rank(b) ? [a, b] : [b, a];
      });
    geoCache[n] = { n, h, stickers, index, key, cubies, corners, edges };
    return geoCache[n];
  }

  // ------------------------------------------------------------------ moves
  // Axis 0 = x, 1 = y, 2 = z. q = quarter turns, positive = counter-clockwise
  // looking from +axis (right-hand rule). layer(coord, h) picks the cubies.
  const MOVE_DEFS = {
    U: { axis: 1, q: -1, layer: (v, h) => v === h },
    D: { axis: 1, q: 1, layer: (v, h) => v === -h },
    E: { axis: 1, q: 1, layer: (v) => v === 0 },
    R: { axis: 0, q: -1, layer: (v, h) => v === h },
    L: { axis: 0, q: 1, layer: (v, h) => v === -h },
    M: { axis: 0, q: 1, layer: (v) => v === 0 },
    F: { axis: 2, q: -1, layer: (v, h) => v === h },
    B: { axis: 2, q: 1, layer: (v, h) => v === -h },
    S: { axis: 2, q: -1, layer: (v) => v === 0 },
    x: { axis: 0, q: -1, layer: () => true },
    y: { axis: 1, q: -1, layer: () => true },
    z: { axis: 2, q: -1, layer: () => true },
  };
  const ROTATIONS = "xyz";
  const TOKEN = /^([URFDLBMESxyz])(2'?|'2?|)$/;

  function rot90(v, axis) {
    const [x, y, z] = v;
    if (axis === 0) return [x, -z, y];
    if (axis === 1) return [z, y, -x];
    return [-y, x, z];
  }
  const fix = (v) => v.map((a) => (Object.is(a, -0) ? 0 : a));

  // "R'" -> { letter: "R", turns: 3 } (turns = clockwise quarter turns 1..3)
  function parseToken(tok) {
    const m = TOKEN.exec(tok);
    if (!m) return null;
    const turns = m[2].includes("2") ? 2 : m[2] === "'" ? 3 : 1;
    return { letter: m[1], turns };
  }
  const tokenOf = (letter, turns) =>
    turns % 4 === 0
      ? ""
      : letter + (turns % 4 === 1 ? "" : turns % 4 === 2 ? "2" : "'");

  // "R U R' U'" or ["R","U"] -> ["R","U"]; throws on bad notation.
  function parse(moves) {
    if (Array.isArray(moves)) return moves.slice();
    const list = String(moves)
      .replace(/[’´`]/g, "'")
      .split(/\s+/)
      .filter(Boolean);
    for (const t of list) if (!parseToken(t)) throw new Error(`Bad move: ${t}`);
    return list.map((t) => {
      const p = parseToken(t);
      return tokenOf(p.letter, p.turns);
    });
  }

  function isValidMove(tok, n) {
    const p = parseToken(tok);
    if (!p) return false;
    return n === 3 || !"MES".includes(p.letter);
  }

  const permCache = {};
  // perm[i] = where the sticker at i goes.
  function perm(n, tok) {
    const key = `${n}:${tok}`;
    if (permCache[key]) return permCache[key];
    const p = parseToken(tok);
    if (!p || !isValidMove(tok, n)) throw new Error(`Bad move: ${tok}`);
    const g = geometry(n);
    const def = MOVE_DEFS[p.letter];
    // clockwise quarter turns -> counter-clockwise quarter turns about +axis
    const ccw = (((def.q * p.turns) % 4) + 4) % 4;
    const out = new Int16Array(g.stickers.length);
    g.stickers.forEach((s, i) => {
      if (!def.layer(s.pos[def.axis], g.h)) return void (out[i] = i);
      let pos = s.pos;
      let nor = s.normal;
      for (let k = 0; k < ccw; k++) {
        pos = rot90(pos, def.axis);
        nor = rot90(nor, def.axis);
      }
      out[i] = g.index.get(g.key(fix(pos), faceOfNormal(fix(nor))));
    });
    return (permCache[key] = out);
  }

  const sizeOf = (state) => Math.round(Math.sqrt(state.length / 6));

  function applyOne(state, tok, n = sizeOf(state)) {
    const p = perm(n, tok);
    const out = new Array(state.length);
    for (let i = 0; i < state.length; i++) out[p[i]] = state[i];
    return out;
  }
  function apply(state, moves, n = sizeOf(state)) {
    let s = state.slice();
    for (const m of parse(moves)) s = applyOne(s, m, n);
    return s;
  }
  const invertMove = (tok) => {
    const p = parseToken(tok);
    return tokenOf(p.letter, 4 - p.turns);
  };
  const invert = (moves) => parse(moves).reverse().map(invertMove);

  // Merge neighbours on the same layer: U U -> U2, y y' -> nothing.
  function simplify(moves) {
    const out = [];
    for (const tok of parse(moves)) {
      const p = parseToken(tok);
      const last = out.length && parseToken(out[out.length - 1]);
      if (last && last.letter === p.letter) {
        out.pop();
        const t = tokenOf(p.letter, last.turns + p.turns);
        if (t) out.push(t);
      } else out.push(tok);
    }
    return out;
  }

  // What a move does, for views: axis, which layers, signed quarter turns
  // about +axis (counter-clockwise positive), whole-cube or not.
  function moveInfo(tok, n = 3) {
    const p = parseToken(tok);
    const def = MOVE_DEFS[p.letter];
    const g = geometry(n);
    const ccw = def.q * (p.turns === 3 ? -1 : p.turns);
    const layers = [];
    for (let k = 0; k < n; k++)
      if (def.layer(k - g.h, g.h)) layers.push(k - g.h);
    return {
      letter: p.letter,
      turns: p.turns,
      axis: def.axis,
      angle: (ccw * Math.PI) / 2,
      layers,
      rotation: ROTATIONS.includes(p.letter),
    };
  }

  // The move a drag produces: turning the layers at `coord` about +axis by
  // `sign` (+1 = counter-clockwise looking from +axis). Null when none.
  function moveFromTurn(n, axis, coord, sign) {
    const h = (n - 1) / 2;
    const all = coord === "all";
    for (const letter of Object.keys(MOVE_DEFS)) {
      const d = MOVE_DEFS[letter];
      if (d.axis !== axis) continue;
      if (all ? !ROTATIONS.includes(letter) : ROTATIONS.includes(letter))
        continue;
      if (!all && !d.layer(coord, h)) continue;
      if (!all && n === 2 && "MES".includes(letter)) continue;
      return tokenOf(letter, d.q === sign ? 1 : 3);
    }
    return null;
  }

  // Does a move the player made count for the one expected?
  //   { status: "done" } | { status: "partial", rest } | { status: "wrong" }
  // A half turn can be done as two quarter turns either way.
  function matchMove(expected, done) {
    const e = parseToken(expected);
    const d = parseToken(done);
    if (!e || !d || e.letter !== d.letter) return { status: "wrong" };
    if (e.turns === d.turns) return { status: "done" };
    if (e.turns === 2) return { status: "partial", rest: done };
    return { status: "wrong" };
  }

  // ----------------------------------------------------------------- states
  function solved(n = 3) {
    const out = [];
    for (let f = 0; f < 6; f++) for (let i = 0; i < n * n; i++) out.push(f);
    return out;
  }
  function isSolved(state) {
    const n = sizeOf(state);
    for (let f = 0; f < 6; f++)
      for (let i = 1; i < n * n; i++)
        if (state[f * n * n + i] !== state[f * n * n]) return false;
    return true;
  }
  // Seeded random numbers (mulberry32), for repeatable scrambles and tests.
  function rng(seed = 1) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A random move sequence with no wasted moves (no same face twice in a row).
  function scramble(n = 3, rand = Math.random, length = n === 2 ? 12 : 25) {
    const faces = "URFDLB";
    const out = [];
    let last = -1;
    let beforeLast = -1;
    while (out.length < length) {
      const f = Math.floor(rand() * 6);
      if (f === last) continue;
      // U D U is wasteful too
      if (f === beforeLast && f % 3 === last % 3) continue;
      out.push(faces[f] + ["", "'", "2"][Math.floor(rand() * 3)]);
      beforeLast = last;
      last = f;
    }
    return out;
  }
  const parity = (p) => {
    let odd = 0;
    const seen = new Array(p.length).fill(false);
    for (let i = 0; i < p.length; i++) {
      if (seen[i]) continue;
      let len = 0;
      for (let j = i; !seen[j]; j = p[j]) ((seen[j] = true), len++);
      odd ^= (len - 1) & 1;
    }
    return odd;
  };
  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  // Build stickers from pieces: cp[i] = which piece sits at position i,
  // co[i] = its twist (0..2), ep/eo the same for edges (3x3 only).
  function fromPieces(n, { cp, co, ep, eo }) {
    const g = geometry(n);
    const home = solved(n);
    const s = home.slice();
    g.corners.forEach((pos, i) => {
      const piece = g.corners[cp[i]];
      for (let k = 0; k < 3; k++) s[pos[(k + co[i]) % 3]] = home[piece[k]];
    });
    if (n === 3)
      g.edges.forEach((pos, i) => {
        const piece = g.edges[ep[i]];
        for (let k = 0; k < 2; k++) s[pos[(k + eo[i]) % 2]] = home[piece[k]];
      });
    return s;
  }
  // A uniformly random reachable state (standard orientation).
  function randomState(n = 3, rand = Math.random) {
    const cp = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rand);
    const co = cp.map(() => Math.floor(rand() * 3));
    co[7] = (3 - (co.slice(0, 7).reduce((a, b) => a + b, 0) % 3)) % 3;
    if (n === 2) return fromPieces(2, { cp, co });
    const ep = shuffle([...Array(12).keys()], rand);
    if (parity(ep) !== parity(cp)) [ep[0], ep[1]] = [ep[1], ep[0]];
    const eo = ep.map(() => Math.floor(rand() * 2));
    eo[11] = eo.slice(0, 11).reduce((a, b) => a + b, 0) % 2;
    return fromPieces(3, { cp, co, ep, eo });
  }

  // ------------------------------------------------------------- validation
  // Checks stickers painted from a real cube. Returns { ok: true, pieces }
  // or { ok: false, code, stickers: [indices to highlight], colors: [...] }:
  //   unpainted | count | centers | corner | edge | twist | flip | parity
  function validate(state) {
    const n = sizeOf(state);
    const g = geometry(n);
    const bad = (code, stickers = [], colors = []) => ({
      ok: false,
      code,
      stickers,
      colors,
    });
    const blank = state
      .map((c, i) => (c >= 0 && c <= 5 ? -1 : i))
      .filter((i) => i >= 0);
    if (blank.length) return bad("unpainted", blank);
    const counts = [0, 0, 0, 0, 0, 0];
    state.forEach((c) => counts[c]++);
    const over = [];
    const under = [];
    counts.forEach((k, c) =>
      k > n * n ? over.push(c) : k < n * n ? under.push(c) : 0,
    );
    if (over.length || under.length) {
      const stickers = state
        .map((c, i) => (over.includes(c) ? i : -1))
        .filter((i) => i >= 0);
      return { ...bad("count", stickers, over), over, under, counts };
    }
    // the frame: centre colours (3x3) or the standard scheme (2x2)
    let centre = [0, 1, 2, 3, 4, 5];
    if (n === 3) {
      centre = [0, 1, 2, 3, 4, 5].map((f) => state[f * 9 + 4]);
      const idx = [0, 1, 2, 3, 4, 5].map((f) => f * 9 + 4);
      const distinct = new Set(centre).size === 6;
      const opposite = [0, 1, 2].every((f) => centre[f + 3] === OPP(centre[f]));
      if (!distinct || !opposite) return bad("centers", idx, centre);
      // mirrored centres: the U-R-F centre triple must be a real corner
      const std = solved(3);
      const triple = [centre[0], centre[1], centre[2]];
      const real = g.corners.some((pos) => {
        const cs = pos.map((i) => std[i]);
        return [0, 1, 2].some((r) =>
          [0, 1, 2].every((k) => cs[(k + r) % 3] === triple[k]),
        );
      });
      if (!real) return bad("centers", idx, centre);
    }
    const faceOf = (i) => g.stickers[i].face;
    const ud = [centre[0], centre[3]];
    const fb = [centre[2], centre[5]];
    const cRef = g.corners.map((pos) => pos.map((i) => centre[faceOf(i)]));
    const cp = [];
    const co = [];
    for (let i = 0; i < 8; i++) {
      const pos = g.corners[i];
      const cols = pos.map((k) => state[k]);
      const o = cols.findIndex((c) => ud.includes(c));
      const canon = o < 0 ? null : [0, 1, 2].map((k) => cols[(k + o) % 3]);
      const j = canon
        ? cRef.findIndex((r) => r.every((c, k) => c === canon[k]))
        : -1;
      if (j < 0 || cp.includes(j)) return bad("corner", pos.slice(), cols);
      cp.push(j);
      co.push(o);
    }
    if (co.reduce((a, b) => a + b, 0) % 3)
      return bad("twist", g.corners.flat());
    if (n === 2) return { ok: true, pieces: { cp, co } };
    const eRef = g.edges.map((pos) => pos.map((i) => centre[faceOf(i)]));
    const ep = [];
    const eo = [];
    for (let i = 0; i < 12; i++) {
      const pos = g.edges[i];
      const cols = pos.map((k) => state[k]);
      const prim = (c) =>
        ud.includes(c) ||
        (!ud.includes(cols[0]) && !ud.includes(cols[1]) && fb.includes(c));
      const o = prim(cols[0]) ? 0 : prim(cols[1]) ? 1 : -1;
      const canon = o < 0 ? null : [cols[o], cols[1 - o]];
      const j = canon
        ? eRef.findIndex((r) => r[0] === canon[0] && r[1] === canon[1])
        : -1;
      if (j < 0 || ep.includes(j)) return bad("edge", pos.slice(), cols);
      ep.push(j);
      eo.push(o);
    }
    if (eo.reduce((a, b) => a + b, 0) % 2) return bad("flip", g.edges.flat());
    if (parity(cp) !== parity(ep)) return bad("parity", []);
    return { ok: true, pieces: { cp, co, ep, eo } };
  }

  // ================================================================ SOLVER
  // Beginner layer-by-layer. Works on a 3x3 sticker array; a 2x2 is solved as
  // the corners of a 3x3 whose centres are a "virtual frame" (see solve2).
  const G3 = geometry(3);
  const CORN = G3.corners;
  const EDGE = G3.edges;
  const faceOf = (i) => Math.floor(i / 9);
  const centreOf = (s, f) => s[f * 9 + 4];
  const faceWith = (s, c) =>
    [0, 1, 2, 3, 4, 5].find((f) => centreOf(s, f) === c);
  const home = (s, i) => centreOf(s, faceOf(i));
  const pieceOk = (s, pos) => pos.every((i) => s[i] === home(s, i));
  const touches = (pos, f) => pos.some((i) => faceOf(i) === f);
  const sameSet = (a, b) =>
    a.length === b.length && a.every((c) => b.includes(c));
  const colorsAt = (s, pos) => pos.map((i) => s[i]);
  const findCorner = (s, set) =>
    CORN.findIndex((pos) => sameSet(colorsAt(s, pos), set));
  const findEdge = (s, set) =>
    EDGE.findIndex((pos) => sameSet(colorsAt(s, pos), set));
  // positions (by facelets on U/F/R…) used by the algorithms
  const cornerAt = (fs) =>
    CORN.findIndex((pos) => sameSet(pos.map(faceOf), fs));
  const edgeAt = (fs) => EDGE.findIndex((pos) => sameSet(pos.map(faceOf), fs));
  const [U, R, F, D, L, B] = [0, 1, 2, 3, 4, 5];
  const URF = cornerAt([U, R, F]);
  const DFR = cornerAt([D, F, R]);
  const UF = edgeAt([U, F]);
  const FR = edgeAt([F, R]);

  const A = {
    magic: ["R'", "D'", "R", "D"],
    right: parse("U R U' R' U' F' U F"),
    left: parse("U' L' U L U F U' F'"),
    ycross: parse("F R U R' U' F'"),
    sune: parse("R U R' U R U2 R'"),
    corners: parse("U R U' L' U R' U' L"),
  };
  const Y_TRIES = [[], ["y"], ["y'"], ["y2"]];
  const U_TRIES = [[], ["U"], ["U'"], ["U2"]];
  const D_TRIES = [[], ["D"], ["D'"], ["D2"]];

  // ---- stage goals (independent of how the cube is held) ----
  const cornerSet = (s, pos) =>
    sameSet(
      colorsAt(s, pos),
      pos.map((i) => home(s, i)),
    );
  const G = {
    cross(s) {
      const w = faceWith(s, WHITE);
      return EDGE.every((pos) => !touches(pos, w) || pieceOk(s, pos));
    },
    corners(s) {
      const w = faceWith(s, WHITE);
      return (
        G.cross(s) && CORN.every((pos) => !touches(pos, w) || pieceOk(s, pos))
      );
    },
    middle(s) {
      const w = faceWith(s, WHITE);
      const y = OPP(w);
      return (
        G.corners(s) &&
        EDGE.every(
          (pos) => touches(pos, w) || touches(pos, y) || pieceOk(s, pos),
        )
      );
    },
    ycross(s) {
      const y = faceWith(s, YELLOW);
      return (
        G.middle(s) &&
        EDGE.every(
          (pos) =>
            !touches(pos, y) ||
            pos.every((i) => faceOf(i) !== y || s[i] === YELLOW),
        )
      );
    },
    yedges(s) {
      const y = faceWith(s, YELLOW);
      return (
        G.ycross(s) && EDGE.every((pos) => !touches(pos, y) || pieceOk(s, pos))
      );
    },
    yplace(s) {
      const y = faceWith(s, YELLOW);
      return (
        G.yedges(s) &&
        CORN.every((pos) => !touches(pos, y) || cornerSet(s, pos))
      );
    },
    ytwist: (s) =>
      CORN.every((pos) => pieceOk(s, pos)) &&
      EDGE.every((pos) => pieceOk(s, pos)),
  };
  // 2x2 goals on the embedded cube (corners only, frame = virtual centres)
  const G2 = {
    layer(s) {
      const w = faceWith(s, WHITE);
      return CORN.every((pos) => !touches(pos, w) || pieceOk(s, pos));
    },
    yplace(s) {
      const y = faceWith(s, YELLOW);
      return (
        G2.layer(s) &&
        CORN.every((pos) => !touches(pos, y) || cornerSet(s, pos))
      );
    },
    ytwist: (s) => CORN.every((pos) => pieceOk(s, pos)),
  };

  const STAGES = {
    3: ["cross", "corners", "middle", "ycross", "yedges", "yplace", "ytwist"],
    2: ["layer", "yplace", "ytwist"],
  };

  // A working cube that records the moves applied to it.
  class Work {
    constructor(s) {
      this.s = s.slice();
      this.moves = [];
    }
    do(moves) {
      for (const m of moves) {
        this.s = applyOne(this.s, m, 3);
        this.moves.push(m);
      }
      return this;
    }
    // Try each option (in order); keep the first that makes pred true.
    tryEach(options, pred) {
      for (const o of options) {
        const t = apply(this.s, o, 3);
        if (pred(t)) return (this.do(o), true);
      }
      return false;
    }
    // Moves are kept as done (not merged across chunks), so every trick
    // keeps its shape: "R' D' R D" then "D" stays readable for a child.
    take() {
      const m = this.moves;
      this.moves = [];
      return m;
    }
  }

  // Whole-cube turns that put colour c on top.
  function toTop(s, c) {
    return [[], ["z2"], ["x"], ["x'"], ["z'"], ["z"]][
      [U, D, F, B, R, L].indexOf(faceWith(s, c))
    ];
  }

  // ---- stage 1: white cross (white on top), one edge at a time ----
  // Exact distance tables over where the tracked edges' white stickers are,
  // one per set of target spots, built on first use (moves: no B turns).
  const CROSS_MOVES = [
    "U",
    "U'",
    "U2",
    "R",
    "R'",
    "R2",
    "F",
    "F'",
    "F2",
    "L",
    "L'",
    "L2",
    "D",
    "D'",
    "D2",
  ];
  const EDGE_STICKERS = EDGE.flat();
  const slotOf = new Map(EDGE_STICKERS.map((i, k) => [i, k]));
  let crossPerm = null;
  const crossTables = new Map();
  function crossTable(homes) {
    const key = homes.join(",");
    if (crossTables.has(key)) return crossTables.get(key);
    if (!crossPerm)
      crossPerm = CROSS_MOVES.map((m) => {
        const p = perm(3, m);
        return EDGE_STICKERS.map((i) => slotOf.get(p[i]));
      });
    const k = homes.length;
    const size = 24 ** k;
    const dist = new Uint8Array(size).fill(255);
    const queue = new Int32Array(size);
    const enc = (sl) => sl.reduce((a, v, i) => a + v * 24 ** i, 0);
    const start = enc(homes.map((h) => slotOf.get(h)));
    dist[start] = 0;
    queue[0] = start;
    let head = 0;
    let tail = 1;
    const sl = new Array(k);
    while (head < tail) {
      const code = queue[head++];
      let c = code;
      for (let i = 0; i < k; i++) ((sl[i] = c % 24), (c = Math.floor(c / 24)));
      for (const p of crossPerm) {
        let nc = 0;
        for (let i = 0; i < k; i++) nc += p[sl[i]] * 24 ** i;
        if (dist[nc] === 255) {
          dist[nc] = dist[code] + 1;
          queue[tail++] = nc;
        }
      }
    }
    const t = { homes, dist, enc };
    crossTables.set(key, t);
    return t;
  }
  function stageCross(w) {
    const steps = [];
    const hold = toTop(w.s, WHITE);
    if (hold.length)
      steps.push({
        kind: "hold",
        color: WHITE,
        pieces: [],
        moves: w.do(hold).take(),
      });
    const s0 = w.s;
    // the white-edge pieces and their target white-sticker spots on U
    const pieces = [R, F, L, B].map((f) => {
      const c = centreOf(s0, f);
      const spot = EDGE[edgeAt([U, f])].find((i) => faceOf(i) === U);
      return { c, spot };
    });
    const whiteSticker = (s, c) =>
      EDGE[findEdge(s, [WHITE, c])].find((i) => s[i] === WHITE);
    const placed = [];
    for (;;) {
      const todo = pieces.filter((p) => !placed.includes(p));
      if (!todo.length) break;
      let best = null;
      for (const p of todo) {
        const set = [...placed, p].sort((a, b) => a.spot - b.spot); // one table per set of spots
        const t = crossTable(set.map((q) => q.spot));
        const d =
          t.dist[t.enc(set.map((q) => slotOf.get(whiteSticker(w.s, q.c))))];
        if (!best || d < best.d) best = { p, d, t, set };
      }
      let sl = best.set.map((q) => slotOf.get(whiteSticker(w.s, q.c)));
      for (let d = best.d; d > 0; d--) {
        const mi = crossPerm.findIndex(
          (p) => best.t.dist[best.t.enc(sl.map((v) => p[v]))] === d - 1,
        );
        w.do([CROSS_MOVES[mi]]);
        sl = sl.map((v) => crossPerm[mi][v]);
      }
      placed.push(best.p);
      const moves = w.take();
      if (moves.length)
        steps.push({ kind: "cross", pieces: [[WHITE, best.p.c]], moves });
    }
    return steps;
  }

  // ---- stage 2: white corners (white on top), the magic move R' D' R D ----
  function insertCorner(s, set) {
    const w = new Work(s);
    const at = () => findCorner(w.s, set);
    const target = (t) =>
      cornerSet(t, CORN[URF]) && sameSet(colorsAt(t, CORN[URF]), set);
    const isTarget = (t) =>
      sameSet(
        CORN[URF].map((i) => home(t, i)),
        set,
      );
    const ok = (t) => pieceOk(t, CORN[findCorner(t, set)]);
    const w0 = faceWith(w.s, WHITE);
    if (touches(CORN[at()], w0) && !(at() === URF && isTarget(w.s))) {
      // in the top layer but wrong: hold it at front-right-top…
      w.tryEach(Y_TRIES, (t) => findCorner(t, set) === URF);
      // …and pop it out with one magic move (unless it's just twisted in its own spot)
      if (!isTarget(w.s)) w.do(A.magic);
    }
    if (!(at() === URF && isTarget(w.s))) {
      w.tryEach(Y_TRIES, isTarget);
      w.tryEach(D_TRIES, (t) => findCorner(t, set) === DFR);
    }
    for (let k = 0; k < 6 && !ok(w.s); k++) w.do(A.magic);
    if (!ok(w.s) || !target(w.s)) throw new Error("corner insert failed");
    return w;
  }
  function stageCorners(w, colour = WHITE) {
    const steps = [];
    const hold = toTop(w.s, colour);
    if (hold.length)
      steps.push({
        kind: "hold",
        color: colour,
        pieces: [],
        moves: w.do(hold).take(),
      });
    for (;;) {
      const top = faceWith(w.s, colour);
      const todo = CORN.filter(
        (pos) => touches(pos, top) && !pieceOk(w.s, pos),
      ).map((pos) => pos.map((i) => home(w.s, i)));
      if (!todo.length) break;
      let best = null;
      for (const set of todo) {
        const r = insertCorner(w.s, set);
        if (!best || r.moves.length < best.r.moves.length) best = { r, set };
      }
      w.do(best.r.moves);
      steps.push({ kind: "corner", pieces: [best.set], moves: w.take() });
    }
    return steps;
  }

  // ---- stage 3: middle-layer edges (yellow on top) ----
  function insertEdge(s, set) {
    const w = new Work(s);
    const side = (t) => EDGE[findEdge(t, set)].find((i) => faceOf(i) !== U);
    // make a "T": turn the top until the edge's side colour matches its centre
    w.tryEach(U_TRIES, (t) => t[side(t)] === home(t, side(t)));
    // turn the whole cube so it faces you
    w.tryEach(Y_TRIES, (t) => findEdge(t, set) === UF);
    const top = w.s[EDGE[UF].find((i) => faceOf(i) === U)];
    w.do(top === centreOf(w.s, R) ? A.right : A.left);
    if (!pieceOk(w.s, EDGE[findEdge(w.s, set)]))
      throw new Error("edge insert failed");
    return w;
  }
  function stageMiddle(w) {
    const steps = [];
    const hold = toTop(w.s, YELLOW);
    if (hold.length)
      steps.push({
        kind: "flip",
        color: YELLOW,
        pieces: [],
        moves: w.do(hold).take(),
      });
    for (let guard = 0; guard < 12; guard++) {
      const mids = EDGE.filter(
        (pos) => !colorsAt(w.s, pos).some((c) => c === WHITE || c === YELLOW),
      );
      const todo = mids.filter((pos) => !pieceOk(w.s, pos));
      if (!todo.length) break;
      const onTop = todo.filter((pos) => touches(pos, U));
      if (onTop.length) {
        let best = null;
        for (const pos of onTop) {
          const set = colorsAt(w.s, pos);
          const r = insertEdge(w.s, set);
          if (!best || r.moves.length < best.r.moves.length) best = { r, set };
        }
        w.do(best.r.moves);
        steps.push({ kind: "middle", pieces: [best.set], moves: w.take() });
      } else {
        // stuck in the wrong slot (or flipped): pop it out to the top
        const set = colorsAt(w.s, todo[0]);
        w.tryEach(Y_TRIES, (t) => findEdge(t, set) === FR);
        w.do(A.right);
        steps.push({ kind: "pop", pieces: [set], moves: w.take() });
      }
    }
    return steps;
  }

  // Shortest chain of "setup + algorithm" (then an optional final setup)
  // that reaches a goal: the case tables of the beginner method, found by
  // trying them instead of hard-coding them, so every state is covered.
  function macroSearch(
    s,
    { setups, alg, goal, finals = [[]], maxDepth = 3, kind, pieces },
  ) {
    let best = null;
    const walk = (t, chain, depth) => {
      for (const f of finals) {
        const e = apply(t, f, 3);
        if (goal(e)) {
          const len = chain.flat().length + f.length;
          if (
            !best ||
            chain.length < best.chain.length ||
            (chain.length === best.chain.length && len < best.len)
          )
            best = { chain: f.length ? [...chain, f] : chain, len, final: f };
        }
      }
      if (depth === maxDepth || (best && best.chain.length <= chain.length))
        return;
      for (const su of setups)
        walk(
          apply(t, [...su, ...alg], 3),
          [...chain, [...su, ...alg]],
          depth + 1,
        );
    };
    walk(s, [], 0);
    if (!best) throw new Error(`${kind}: no solution`);
    return best.chain.map((moves) => ({ kind, pieces, moves }));
  }
  const topPieces = (s, list) => {
    const y = faceWith(s, YELLOW);
    return list
      .filter((pos) => touches(pos, y))
      .map((pos) => pos.map((i) => home(s, i)));
  };

  // ---- stages 4-7: the last layer (yellow on top) ----
  // Every last-layer stage starts by making sure yellow is on top.
  function holdYellow(w) {
    const hold = toTop(w.s, YELLOW);
    return hold.length ? [{ kind: "flip", color: YELLOW, pieces: [], moves: w.do(hold).take() }] : [];
  }
  function stageYCross(w) {
    const pre = holdYellow(w);
    const steps = macroSearch(w.s, {
      setups: U_TRIES,
      alg: A.ycross,
      goal: G.ycross,
      kind: "ycross",
      pieces: topPieces(w.s, EDGE),
    });
    steps.forEach((st) => w.do(st.moves));
    w.take();
    return [...pre, ...steps];
  }
  function stageYEdges(w) {
    const pre = holdYellow(w);
    const steps = macroSearch(w.s, {
      setups: U_TRIES,
      alg: A.sune,
      goal: G.yedges,
      finals: U_TRIES,
      kind: "yedges",
      pieces: topPieces(w.s, EDGE),
    });
    steps.forEach((st) => w.do(st.moves));
    w.take();
    return [...pre, ...fixAlign(steps, "yedges")];
  }
  // a final lone "turn the top" step gets its own kind (the buddy says "line them up")
  function fixAlign(steps, kind) {
    return steps.map((st) =>
      st.moves.length === 1 && st.moves[0][0] === "U"
        ? { ...st, kind: "align" }
        : { ...st, kind },
    );
  }
  function stageYPlace(w, two) {
    const setups = two ? [...Y_TRIES, ...U_TRIES.slice(1)] : Y_TRIES;
    const goal = two ? G2.yplace : G.yplace;
    const hold = toTop(w.s, YELLOW);
    const steps = [];
    if (hold.length)
      steps.push({
        kind: "flip",
        color: YELLOW,
        pieces: [],
        moves: w.do(hold).take(),
      });
    if (goal(w.s)) return steps;
    let found = macroSearch(w.s, {
      setups,
      alg: A.corners,
      goal,
      finals: two ? U_TRIES : [[]],
      kind: "yplace",
      pieces: topPieces(w.s, CORN),
    });
    found = fixAlign(found, "yplace");
    found.forEach((st) => w.do(st.moves));
    w.take();
    return [...steps, ...found];
  }
  function stageYTwist(w, two) {
    const steps = holdYellow(w);
    const bad = (t) => t[CORN[URF][0]] !== YELLOW;
    const topBad = (t) =>
      CORN.some(
        (pos) =>
          touches(pos, faceWith(t, YELLOW)) &&
          !pos.some((i) => faceOf(i) === U && t[i] === YELLOW),
      );
    const align = () => {
      w.tryEach(U_TRIES, two ? G2.ytwist : G.ytwist);
      const m = w.take();
      if (m.length) steps.push({ kind: "align", pieces: [], moves: m });
    };
    if (!topBad(w.s)) return (align(), steps);
    // hold a twisted corner at front-right-top (turn the whole cube)
    w.tryEach(Y_TRIES, bad);
    const hold = w.take();
    if (hold.length)
      steps.push({ kind: "hold-corner", pieces: [], moves: hold });
    for (let guard = 0; guard < 4 && topBad(w.s); guard++) {
      const set = colorsAt(w.s, CORN[URF]);
      for (let k = 0; k < 6 && bad(w.s); k++) w.do(A.magic);
      steps.push({ kind: "ytwist", pieces: [set], moves: w.take() });
      if (!topBad(w.s)) break;
      // turn ONLY the top to bring the next twisted corner to the front-right
      w.tryEach(U_TRIES.slice(1), bad);
      steps.push({ kind: "next-corner", pieces: [], moves: w.take() });
    }
    align();
    return steps;
  }

  // ---- 2x2 <-> embedded 3x3 ----
  const G2x2 = geometry(2);
  const EMBED = G2x2.stickers.map(
    (s) => s.face * 9 + s.row * 2 * 3 + s.col * 2,
  );
  function embed(s2, centres) {
    const s = new Array(54).fill(-1);
    EMBED.forEach((j, i) => (s[j] = s2[i]));
    centres.forEach((c, f) => (s[f * 9 + 4] = c));
    return s;
  }
  const unembed = (s) => EMBED.map((j) => s[j]);
  // Virtual centres from a finished white layer (or null).
  function frameOf2(s2) {
    const s = embed(s2, [0, 1, 2, 3, 4, 5]);
    for (let f = 0; f < 6; f++) {
      const cs = CORN.filter((pos) => touches(pos, f));
      if (
        !cs.every((pos) => pos.some((i) => faceOf(i) === f && s[i] === WHITE))
      )
        continue;
      const centres = new Array(6).fill(-1);
      centres[f] = WHITE;
      centres[OPP(f)] = YELLOW;
      let ok = true;
      for (const g of [0, 1, 2, 3, 4, 5].filter((g) => g % 3 !== f % 3)) {
        const cols = cs.flatMap((pos) =>
          pos.filter((i) => faceOf(i) === g).map((i) => s[i]),
        );
        if (cols.length !== 2 || cols[0] !== cols[1]) ok = false;
        centres[g] = cols[0];
        centres[OPP(g)] = OPP(cols[0]);
      }
      if (ok) return centres;
    }
    return null;
  }
  const frames2 = () =>
    Y_TRIES.map((r) => apply(solved(3), r, 3)).map((s) =>
      [0, 1, 2, 3, 4, 5].map((f) => centreOf(s, f)),
    );

  // Goals on a real sticker array of either size, stage by stage.
  function stageDone(state, stageId) {
    const n = sizeOf(state);
    if (n === 3) return G[stageId](state);
    const fr = frameOf2(state);
    if (!fr) return false;
    return G2[stageId](embed(state, fr));
  }
  function currentStage(state) {
    const n = sizeOf(state);
    const i = STAGES[n].findIndex((id) => !stageDone(state, id));
    return i < 0 ? STAGES[n].length : i;
  }

  // THE SOLVER. Returns { n, stages: [{ id, steps: [{ kind, pieces, moves }] }],
  // moves } where pieces are colour sets of the pieces a step works on.
  // opts.from = first stage to plan (earlier ones must be done); opts.to = last.
  function solve(state, { from = 0, to = 99 } = {}) {
    const n = sizeOf(state);
    const ids = STAGES[n];
    let w;
    const stages = ids.map((id) => ({ id, steps: [] }));
    if (n === 3) {
      w = new Work(state);
      const run = [
        stageCross,
        stageCorners,
        stageMiddle,
        stageYCross,
        stageYEdges,
        (x) => stageYPlace(x, false),
        (x) => stageYTwist(x, false),
      ];
      for (let i = from; i < ids.length && i <= to; i++) {
        stages[i].steps = run[i](w);
        if (!G[ids[i]](w.s)) throw new Error(`stage ${ids[i]} not reached`);
      }
    } else {
      let fr = frameOf2(state);
      if (from === 0 && !fr) {
        // choose the frame (which colour ends up in front) with the shortest first layer
        let best = null;
        for (const centres of frames2()) {
          const t = new Work(embed(state, centres));
          const steps = stageCorners(t);
          const len = steps.reduce((a, st) => a + st.moves.length, 0);
          if (!best || len < best.len) best = { len, steps, t };
        }
        stages[0].steps = best.steps;
        w = best.t;
      } else {
        if (!fr) throw new Error("first layer not done");
        w = new Work(embed(state, fr));
      }
      const run = [
        null,
        (x) => stageYPlace(x, true),
        (x) => stageYTwist(x, true),
      ];
      for (let i = Math.max(from, 1); i < ids.length && i <= to; i++) {
        stages[i].steps = run[i](w);
        if (!G2[ids[i]](w.s)) throw new Error(`stage ${ids[i]} not reached`);
      }
    }
    for (const st of stages) st.steps = st.steps.filter((x) => x.moves.length);
    const moves = stages.flatMap((st) => st.steps.flatMap((x) => x.moves));
    return { n, stages, moves };
  }

  // ------------------------------------------------------------- lessons
  // Practice positions for each stage: the stages before it are done, this
  // one isn't. Built from the solved cube with moves that keep the earlier
  // stages (so a lesson practises exactly one trick), with a fixed seed.
  // two corners twisted opposite ways (u = which: side by side or across)
  const twistPair = (u) => [...A.magic, ...A.magic, u, ...A.magic, ...A.magic, ...A.magic, ...A.magic, invertMove(u)];
  function lessonPosition(n, stage, k) {
    const ids = STAGES[n];
    const id = ids[stage];
    const rand = rng(1000 * n + 97 * stage + k * 7 + 1);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    const earlier = [];
    for (let j = 0; j < k; j++) earlier.push(lessonPosition(n, stage, j));
    const yellowTop = ["z2"];
    for (let attempt = 0; attempt < 200; attempt++) {
      let moves = [];
      const top = stage >= (n === 3 ? 2 : 1) ? yellowTop : [];
      if (stage === 0 && n === 3) {
        moves = scramble(n, rand, n === 3 ? 4 + (k % 2) : 3 + (k % 2)).map(
          (m) => (m[0] === "B" ? "R" + m.slice(1) : m),
        );
        moves = simplify(moves);
      } else if (id === "corners" || id === "layer") {
        for (let i = 0; i < 1 + (k > 0 ? 1 : 0); i++)
          moves.push(...pick(Y_TRIES), ...pick(D_TRIES), ...A.magic);
      } else if (id === "middle") {
        for (let i = 0; i < 1 + (k > 1 ? 1 : 0); i++)
          moves.push(
            ...pick(Y_TRIES),
            ...pick(U_TRIES),
            ...invert(pick([A.right, A.left])),
          );
      } else if (id === "ycross") {
        for (let i = 0; i < 2; i++)
          moves.push(
            ...pick(U_TRIES),
            ...invert(pick([A.ycross, A.ycross, A.sune])),
          );
      } else if (id === "yedges") {
        for (let i = 0; i < 2; i++)
          moves.push(...pick(U_TRIES), ...invert(pick([A.sune, A.corners])));
      } else if (id === "yplace") {
        moves.push(...pick(Y_TRIES), ...invert(A.corners));
        if (n === 2) moves.push(...pick(U_TRIES.slice(1)));
        if (k === 2) moves.push(...pick(Y_TRIES), ...invert(A.corners));
      } else if (id === "ytwist") {
        // two corners twisted opposite ways: side by side, or across
        moves.push(...pick(Y_TRIES), ...twistPair(k === 1 ? "U2" : pick(["U", "U'"])));
      }
      let s = apply(solved(3), [...top, ...moves], 3);
      if (n === 2) s = unembed(s);
      const before = ids.slice(0, stage).every((b) => stageDone(s, b));
      if (!before || stageDone(s, id)) continue;
      // each practice position of a lesson is a different one
      const len = solve(s, { from: stage, to: stage }).moves.length;
      if (len < 4 || len > 36) continue;
      const key = s.join();
      if (earlier.some((e) => e.join() === key)) continue;
      return s;
    }
    throw new Error(`no lesson position for ${n}x${n} ${id}`);
  }
  const LESSON_POSITIONS = 3;
  // 3 stars: every move done yourself; 2: watched some; 1: skipped ahead.
  const lessonStars = ({ watched = false, skipped = false } = {}) =>
    skipped ? 1 : watched ? 2 : 3;
  const MAX_STARS = (STAGES[2].length + STAGES[3].length) * 3;

  return {
    FACES,
    COLORS,
    WHITE,
    YELLOW,
    OPP,
    STAGES,
    ALGS: A,
    MAX_STARS,
    LESSON_POSITIONS,
    geometry,
    parse,
    parseToken,
    isValidMove,
    perm,
    apply,
    applyOne,
    invert,
    invertMove,
    simplify,
    moveInfo,
    moveFromTurn,
    matchMove,
    solved,
    isSolved,
    sizeOf,
    rng,
    scramble,
    randomState,
    fromPieces,
    validate,
    solve,
    stageDone,
    currentStage,
    lessonPosition,
    lessonStars,
    frameOf2,
  };
})();

if (typeof module !== "undefined") module.exports = CubeEngine;
