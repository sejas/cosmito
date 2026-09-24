// Pure logic for the coding game: level parsing, program model, interpreter,
// stars and hints. No DOM here, so node can test it (engine.test.js).
//
// Program = array of blocks:
//   { t: "move", d: "U"|"D"|"L"|"R" }
//   { t: "repeat", n: 2..6, body: [...] }   body: moves and ifs
//   { t: "if", c: "y"|"p", body: [...] }     runs body when standing on that pad; body: moves
// A block's path is its index, nested with dots: "2" or "2.0".
const CodeEngine = (() => {
  "use strict";
  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const WALLS = "#^";
  const PADS = "yp";
  const REPEAT_MIN = 2;
  const REPEAT_MAX = 6;
  const MAX_BLOCKS = 20;
  const MAX_MOVES = 200;

  // Map rows: S start, T treat, . grass, # rock, ^ tree, ~ water, * gem, y/p coloured pads.
  function parseLevel(level) {
    const rows = level.map;
    const h = rows.length;
    const w = rows[0].length;
    const tiles = [];
    const gems = [];
    let start = null;
    let treat = null;
    rows.forEach((row, y) => {
      if (row.length !== w) throw new Error(`Ragged map row ${y}`);
      tiles.push(
        [...row].map((ch, x) => {
          if (ch === "S") start = { x, y };
          if (ch === "T") treat = { x, y };
          if (ch === "*") gems.push({ x, y });
          return "ST*".includes(ch) ? "." : ch;
        }),
      );
    });
    if (!start || !treat) throw new Error("Map needs S and T");
    return { w, h, tiles, start, treat, gems };
  }

  const tileAt = (world, x, y) =>
    x < 0 || y < 0 || x >= world.w || y >= world.h ? null : world.tiles[y][x];

  // Compact level-file notation → blocks: "R", { repeat: 3, body: [...] }, { if: "y", body: [...] }.
  function fromCompact(list) {
    return list.map((b) => {
      if (typeof b === "string") return { t: "move", d: b };
      if (b.repeat)
        return { t: "repeat", n: b.repeat, body: fromCompact(b.body) };
      return { t: "if", c: b.if, body: fromCompact(b.body) };
    });
  }

  function toCompact(prog) {
    return prog.map((b) =>
      b.t === "move"
        ? b.d
        : b.t === "repeat"
          ? { repeat: b.n, body: toCompact(b.body) }
          : { if: b.c, body: toCompact(b.body) },
    );
  }

  // Every block counts once, containers included.
  const count = (prog) =>
    prog.reduce((n, b) => n + 1 + (b.body ? count(b.body) : 0), 0);

  // 3★ at or under the optimal block count, 2★ up to two extra, else 1★.
  function stars(blocks, optimal) {
    if (blocks <= optimal) return 3;
    if (blocks <= optimal + 2) return 2;
    return 1;
  }

  // Run a program. Returns { result, reason, failPath, trace, gems }.
  // result: "win" | "fail"; reason: "bump" | "splash" | "end" | "gems" | "empty".
  // trace: steps to animate, in order:
  //   { kind: "move", path, d, x, y, from: {x,y}, gem?: index, bump?, splash?, win? }
  //   { kind: "loop", path, iter, n }   start of a repeat iteration
  //   { kind: "check", path, pass }      an if looked at the tile
  function run(level, prog) {
    const world = level.tiles ? level : parseLevel(level);
    const trace = [];
    let x = world.start.x;
    let y = world.start.y;
    const got = new Set();
    let stop = null;
    let moves = 0;
    let lastPath = null;

    function walk(list, prefix) {
      for (let i = 0; i < list.length && !stop; i++) {
        const b = list[i];
        const path = prefix === "" ? String(i) : `${prefix}.${i}`;
        if (b.t === "move") {
          lastPath = path;
          if (++moves > MAX_MOVES) {
            stop = { reason: "end", path };
            return;
          }
          const [dx, dy] = DIRS[b.d];
          const nx = x + dx;
          const ny = y + dy;
          const tile = tileAt(world, nx, ny);
          const step = {
            kind: "move",
            path,
            d: b.d,
            from: { x, y },
            x: nx,
            y: ny,
          };
          if (tile === null || WALLS.includes(tile)) {
            step.x = x;
            step.y = y;
            step.bump = true;
            trace.push(step);
            stop = { reason: "bump", path };
            return;
          }
          x = nx;
          y = ny;
          if (tile === "~") {
            step.splash = true;
            trace.push(step);
            stop = { reason: "splash", path };
            return;
          }
          const gi = world.gems.findIndex((g) => g.x === x && g.y === y);
          if (gi >= 0 && !got.has(gi)) {
            got.add(gi);
            step.gem = gi;
          }
          if (
            x === world.treat.x &&
            y === world.treat.y &&
            got.size === world.gems.length
          ) {
            step.win = true;
            trace.push(step);
            stop = { reason: "win", path };
            return;
          }
          trace.push(step);
        } else if (b.t === "repeat") {
          for (let k = 0; k < b.n && !stop; k++) {
            trace.push({ kind: "loop", path, iter: k + 1, n: b.n });
            walk(b.body, path);
          }
        } else if (b.t === "if") {
          const pass = tileAt(world, x, y) === b.c;
          trace.push({ kind: "check", path, pass });
          if (pass) walk(b.body, path);
        }
      }
    }

    if (!prog.length) {
      return {
        result: "fail",
        reason: "empty",
        failPath: null,
        trace,
        gems: 0,
      };
    }
    walk(prog, "");
    if (!stop) {
      const onTreat = x === world.treat.x && y === world.treat.y;
      stop = { reason: onTreat ? "gems" : "end", path: lastPath };
    }
    return {
      result: stop.reason === "win" ? "win" : "fail",
      reason: stop.reason,
      failPath: stop.reason === "win" ? null : stop.path,
      trace,
      gems: got.size,
    };
  }

  // ---------- editing (immutable: every op returns a new program) ----------
  const clone = (prog) => JSON.parse(JSON.stringify(prog));
  const splitPath = (path) => (path === "" ? [] : path.split(".").map(Number));

  // The list that holds children of `parent` ("" = the program itself).
  function listAt(prog, parent) {
    let list = prog;
    for (const i of splitPath(parent)) list = list[i].body;
    return list;
  }

  function blockAt(prog, path) {
    const parts = splitPath(path);
    const last = parts.pop();
    return listAt(prog, parts.join("."))[last];
  }

  const parentOf = (path) => path.split(".").slice(0, -1).join(".");
  const indexOf = (path) => Number(path.split(".").pop());

  // Which blocks may go inside which container.
  function allowed(prog, parent, block) {
    if (parent === "") return true;
    const box = blockAt(prog, parent);
    if (box.t === "repeat") return block.t !== "repeat";
    return block.t === "move";
  }

  // Insert at cursor { parent, index }. If the block can't live there, it goes
  // right after the enclosing container instead. Returns { prog, cursor }.
  function insert(prog, cursor, block) {
    const next = clone(prog);
    let { parent, index } = cursor;
    while (!allowed(next, parent, block)) {
      index = indexOf(parent) + 1;
      parent = parentOf(parent);
    }
    if (count(next) + 1 > MAX_BLOCKS) return { prog, cursor, full: true };
    const list = listAt(next, parent);
    index = Math.min(index, list.length);
    const b = clone(block);
    if (b.t !== "move" && !b.body) b.body = [];
    list.splice(index, 0, b);
    const path = parent === "" ? String(index) : `${parent}.${index}`;
    // New containers are "open": the next block goes inside.
    const nextCursor =
      b.t === "move"
        ? { parent, index: index + 1 }
        : { parent: path, index: 0 };
    return { prog: next, cursor: nextCursor, path };
  }

  // Remove a block (and its children); the cursor takes its place.
  function remove(prog, path) {
    const next = clone(prog);
    const parent = parentOf(path);
    const index = indexOf(path);
    listAt(next, parent).splice(index, 1);
    return { prog: next, cursor: { parent, index } };
  }

  // Cycle a repeat's count 2 → 6 → 2.
  function cycleRepeat(prog, path) {
    const next = clone(prog);
    const b = blockAt(next, path);
    b.n = b.n >= REPEAT_MAX ? REPEAT_MIN : b.n + 1;
    return next;
  }

  // Keep the cursor pointing at something that exists after edits.
  function fixCursor(prog, cursor) {
    let { parent, index } = cursor;
    while (parent !== "") {
      const parts = splitPath(parent);
      let list = prog;
      let ok = true;
      for (const i of parts) {
        if (!list[i] || !list[i].body) {
          ok = false;
          break;
        }
        list = list[i].body;
      }
      if (ok) break;
      index = Infinity;
      parent = parentOf(parent);
    }
    return { parent, index: Math.min(index, listAt(prog, parent).length) };
  }

  // ---------- hints ----------
  const same = (a, b) =>
    a.t === b.t &&
    (a.t === "move" ? a.d === b.d : a.t === "if" ? a.c === b.c : true);

  // Compare the kid's program with a reference solution; return the first fix:
  //   { type: "add", parent, index, block }   the next block to add (container heads have empty bodies)
  //   { type: "remove", path }                 a block that doesn't belong
  //   { type: "count", path, n }               a repeat with the wrong count
  //   null                                     programs match
  function hint(prog, solution, parent = "") {
    for (let i = 0; i < solution.length; i++) {
      const path = parent === "" ? String(i) : `${parent}.${i}`;
      const want = solution[i];
      const have = prog[i];
      if (!have) {
        const block = want.t === "move" ? { ...want } : { ...want, body: [] };
        return { type: "add", parent, index: i, block };
      }
      if (!same(have, want)) return { type: "remove", path };
      if (want.t === "repeat" && have.n !== want.n)
        return { type: "count", path, n: want.n };
      if (want.body) {
        const inner = hint(have.body, want.body, path);
        if (inner) return inner;
      }
    }
    if (prog.length > solution.length) {
      return {
        type: "remove",
        path:
          parent === ""
            ? String(solution.length)
            : `${parent}.${solution.length}`,
      };
    }
    return null;
  }

  // ---------- progress ----------
  // Levels unlock in order; `best` maps level id → stars.
  function unlocked(levels, best, index) {
    return index === 0 || (best[levels[index - 1].id] || 0) > 0;
  }

  const totalStars = (best) =>
    Object.values(best).reduce((s, n) => s + Math.min(3, n || 0), 0);

  return {
    DIRS,
    REPEAT_MIN,
    REPEAT_MAX,
    MAX_BLOCKS,
    parseLevel,
    tileAt,
    fromCompact,
    toCompact,
    count,
    stars,
    run,
    clone,
    listAt,
    blockAt,
    insert,
    remove,
    cycleRepeat,
    fixCursor,
    hint,
    unlocked,
    totalStars,
  };
})();

if (typeof module !== "undefined") module.exports = CodeEngine;
