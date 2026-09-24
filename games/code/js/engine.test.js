// Run: node --test games/code/js/
const test = require("node:test");
const assert = require("node:assert");
const E = require("./engine.js");
const { CODE_LEVELS } = require("./levels.js");

const P = E.fromCompact;

// ---------- exhaustive search for the shortest program ----------
// Programs are built block by block at the top level; after each block the
// program is run, and prefixes that already crash (bump/splash) are dropped,
// since adding blocks after a crash can't help.
function shortest(level, maxSize) {
  const world = E.parseLevel(level);
  const moves = level.palette.filter((b) => E.DIRS[b]);
  const hasRepeat = level.palette.includes("repeat");
  const ifs = level.palette
    .filter((b) => b.startsWith("if-"))
    .map((b) => b.slice(3));

  // All bodies of exactly `size` blocks inside a container of kind `ctx`.
  const memo = {};
  function bodies(size, ctx) {
    const key = size + ctx;
    if (memo[key]) return memo[key];
    const out = [];
    if (size === 0) out.push([]);
    for (let k = 1; k <= size; k++) {
      for (const item of items(k, ctx))
        for (const rest of bodies(size - k, ctx)) out.push([item, ...rest]);
    }
    return (memo[key] = out);
  }
  function items(size, ctx) {
    const out = [];
    if (size === 1) moves.forEach((d) => out.push({ t: "move", d }));
    if (size >= 2 && ctx === "top" && hasRepeat) {
      for (let n = E.REPEAT_MIN; n <= E.REPEAT_MAX; n++) {
        for (const body of bodies(size - 1, "repeat"))
          out.push({ t: "repeat", n, body });
      }
    }
    if (size >= 2 && ctx !== "if") {
      for (const c of ifs)
        for (const body of bodies(size - 1, "if"))
          out.push({ t: "if", c, body });
    }
    return out;
  }

  let best = null;
  function dfs(prog, used) {
    for (let k = 1; used + k <= maxSize; k++) {
      for (const item of items(k, "top")) {
        const next = [...prog, item];
        const size = used + k;
        if (best && size >= E.count(best)) continue;
        const r = E.run(world, next);
        if (r.result === "win") best = next;
        else if (r.reason !== "bump" && r.reason !== "splash") dfs(next, size);
      }
    }
  }
  dfs([], 0);
  return best;
}

// ---------- levels ----------
test("level data is well formed", () => {
  const ids = new Set();
  for (const l of CODE_LEVELS) {
    assert.ok(!ids.has(l.id), `duplicate id ${l.id}`);
    ids.add(l.id);
    const w = E.parseLevel(l);
    assert.ok(w.w <= 7 && w.h <= 6, `${l.id} too big for a phone`);
    for (const row of l.map)
      assert.match(row, /^[ST.#^~*yp]+$/, `${l.id} bad tile`);
    assert.strictEqual(
      l.map.join("").split("S").length - 1,
      1,
      `${l.id} needs one S`,
    );
    assert.strictEqual(
      l.map.join("").split("T").length - 1,
      1,
      `${l.id} needs one T`,
    );
  }
  assert.ok(CODE_LEVELS.length >= 24);
});

test("every level is solved by its reference solution with exactly `optimal` blocks", () => {
  for (const l of CODE_LEVELS) {
    const prog = P(l.solution);
    assert.strictEqual(E.count(prog), l.optimal, `${l.id} solution size`);
    assert.strictEqual(
      E.run(l, prog).result,
      "win",
      `${l.id} solution must win`,
    );
    // Only blocks from the palette are used.
    const walk = (list) =>
      list.forEach((b) => {
        const tok =
          b.t === "move" ? b.d : b.t === "repeat" ? "repeat" : `if-${b.c}`;
        assert.ok(
          l.palette.includes(tok),
          `${l.id} uses ${tok} outside palette`,
        );
        if (b.body) walk(b.body);
      });
    walk(prog);
  }
});

test("optimal counts are truly optimal (no shorter program exists)", () => {
  for (const l of CODE_LEVELS) {
    const found = shortest(l, l.optimal - 1);
    assert.strictEqual(
      found,
      null,
      `${l.id} has a shorter solution: ${JSON.stringify(found && E.toCompact(found))}`,
    );
  }
});

test("debugging levels start with a buggy program that fails", () => {
  const debug = CODE_LEVELS.filter((l) => l.start);
  assert.ok(debug.length >= 5);
  for (const l of debug) {
    const r = E.run(l, P(l.start));
    assert.strictEqual(r.result, "fail", `${l.id} start program should fail`);
    assert.ok(E.hint(P(l.start), P(l.solution)), `${l.id} hint exists`);
  }
});

test("following hints from an empty (or buggy) program always reaches the solution", () => {
  for (const l of CODE_LEVELS) {
    const sol = P(l.solution);
    let prog = P(l.start || []);
    for (let i = 0; i < 60; i++) {
      const h = E.hint(prog, sol);
      if (!h) break;
      if (h.type === "add")
        prog = E.insert(
          prog,
          { parent: h.parent, index: h.index },
          h.block,
        ).prog;
      else if (h.type === "remove") prog = E.remove(prog, h.path).prog;
      else {
        while (E.blockAt(prog, h.path).n !== h.n)
          prog = E.cycleRepeat(prog, h.path);
      }
    }
    assert.deepStrictEqual(prog, sol, `${l.id} hints converge`);
    assert.strictEqual(E.run(l, prog).result, "win");
  }
});

// ---------- interpreter ----------
const line = { map: ["S..T"] };

test("run: win, bump, splash, end, gems, empty", () => {
  assert.strictEqual(E.run(line, P(["R", "R", "R"])).result, "win");
  const bump = E.run(line, P(["U"]));
  assert.deepStrictEqual([bump.reason, bump.failPath], ["bump", "0"]);
  const rock = E.run({ map: ["S#T"] }, P(["R"]));
  assert.strictEqual(rock.reason, "bump");
  const splash = E.run({ map: ["S~T"] }, P(["R", "R"]));
  assert.deepStrictEqual([splash.reason, splash.failPath], ["splash", "0"]);
  const end = E.run(line, P(["R", "R"]));
  assert.deepStrictEqual([end.reason, end.failPath], ["end", "1"]);
  const gems = E.run({ map: ["*S.T"] }, P(["R", "R"]));
  assert.strictEqual(gems.reason, "gems");
  assert.strictEqual(
    E.run({ map: ["*S.T"] }, P(["L", "R", "R", "R"])).result,
    "win",
  );
  assert.strictEqual(E.run(line, []).reason, "empty");
});

test("run stops at the treat: extra blocks after winning are ignored", () => {
  assert.strictEqual(E.run(line, P(["R", "R", "R", "U", "U"])).result, "win");
});

test("run: trace records loops, checks and the failing nested path", () => {
  const r = E.run(
    { map: ["S.y.", "^^.T"] },
    P([{ repeat: 2, body: ["R", { if: "y", body: ["D"] }] }]),
  );
  assert.strictEqual(r.result, "fail");
  assert.strictEqual(r.reason, "end");
  const kinds = r.trace.map((s) => s.kind);
  assert.deepStrictEqual(kinds.slice(0, 3), ["loop", "move", "check"]);
  assert.ok(r.trace.some((s) => s.kind === "check" && s.pass));
  const fail = E.run({ map: ["S.~T"] }, P([{ repeat: 3, body: ["R"] }]));
  assert.deepStrictEqual([fail.reason, fail.failPath], ["splash", "0.0"]);
});

test("stars: 3 at optimal, 2 within +2, else 1", () => {
  assert.strictEqual(E.stars(3, 3), 3);
  assert.strictEqual(E.stars(2, 3), 3);
  assert.strictEqual(E.stars(5, 3), 2);
  assert.strictEqual(E.stars(6, 3), 1);
});

// ---------- editing ----------
test("insert: moves go at the cursor, containers open for their children", () => {
  let r = E.insert([], { parent: "", index: 0 }, { t: "move", d: "R" });
  assert.deepStrictEqual(r.cursor, { parent: "", index: 1 });
  r = E.insert(r.prog, r.cursor, { t: "repeat", n: 2 });
  assert.deepStrictEqual(r.cursor, { parent: "1", index: 0 });
  r = E.insert(r.prog, r.cursor, { t: "move", d: "D" });
  assert.deepStrictEqual(E.toCompact(r.prog), [
    "R",
    { repeat: 2, body: ["D"] },
  ]);
  // A repeat can't go inside a repeat: it lands after it.
  r = E.insert(r.prog, r.cursor, { t: "repeat", n: 3 });
  assert.deepStrictEqual(E.toCompact(r.prog), [
    "R",
    { repeat: 2, body: ["D"] },
    { repeat: 3, body: [] },
  ]);
  // An if can go in a repeat, but only moves in an if.
  r = E.insert(r.prog, { parent: "1", index: 1 }, { t: "if", c: "y" });
  assert.deepStrictEqual(r.cursor, { parent: "1.1", index: 0 });
  r = E.insert(r.prog, r.cursor, { t: "if", c: "p" });
  assert.deepStrictEqual(E.toCompact(r.prog)[1], {
    repeat: 2,
    body: ["D", { if: "y", body: [] }, { if: "p", body: [] }],
  });
});

test("insert in the middle, remove leaves the cursor in the gap", () => {
  const prog = P(["R", "R", "D"]);
  const r = E.remove(prog, "1");
  assert.deepStrictEqual(E.toCompact(r.prog), ["R", "D"]);
  assert.deepStrictEqual(r.cursor, { parent: "", index: 1 });
  const s = E.insert(r.prog, r.cursor, { t: "move", d: "U" });
  assert.deepStrictEqual(E.toCompact(s.prog), ["R", "U", "D"]);
  assert.deepStrictEqual(
    E.toCompact(prog),
    ["R", "R", "D"],
    "original untouched",
  );
});

test("insert refuses to grow past MAX_BLOCKS", () => {
  const prog = P(Array(E.MAX_BLOCKS).fill("R"));
  const r = E.insert(
    prog,
    { parent: "", index: prog.length },
    { t: "move", d: "R" },
  );
  assert.ok(r.full);
  assert.strictEqual(r.prog.length, E.MAX_BLOCKS);
});

test("cycleRepeat wraps 2..6 and fixCursor survives removed containers", () => {
  let prog = P([{ repeat: 5, body: ["R"] }]);
  prog = E.cycleRepeat(prog, "0");
  assert.strictEqual(prog[0].n, 6);
  prog = E.cycleRepeat(prog, "0");
  assert.strictEqual(prog[0].n, 2);
  const removed = E.remove(prog, "0").prog;
  assert.deepStrictEqual(E.fixCursor(removed, { parent: "0", index: 1 }), {
    parent: "",
    index: 0,
  });
});

test("hint: next block, wrong block, wrong count, extra block, done", () => {
  const sol = P([{ repeat: 3, body: ["R", "D"] }]);
  assert.deepStrictEqual(E.hint([], sol), {
    type: "add",
    parent: "",
    index: 0,
    block: { t: "repeat", n: 3, body: [] },
  });
  assert.deepStrictEqual(E.hint(P([{ repeat: 3, body: ["R"] }]), sol), {
    type: "add",
    parent: "0",
    index: 1,
    block: { t: "move", d: "D" },
  });
  assert.deepStrictEqual(E.hint(P([{ repeat: 2, body: ["R", "D"] }]), sol), {
    type: "count",
    path: "0",
    n: 3,
  });
  assert.deepStrictEqual(E.hint(P([{ repeat: 3, body: ["D", "D"] }]), sol), {
    type: "remove",
    path: "0.0",
  });
  assert.deepStrictEqual(
    E.hint(P([{ repeat: 3, body: ["R", "D"] }, "U"]), sol),
    { type: "remove", path: "1" },
  );
  assert.strictEqual(E.hint(sol, sol), null);
});

test("unlock order and star totals", () => {
  const levels = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.ok(E.unlocked(levels, {}, 0));
  assert.ok(!E.unlocked(levels, {}, 1));
  assert.ok(E.unlocked(levels, { a: 1 }, 1));
  assert.strictEqual(E.totalStars({ a: 3, b: 2, c: 9 }), 8);
});
