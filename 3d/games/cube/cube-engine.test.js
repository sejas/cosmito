// node --test "3d/**/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const E = createRequire(import.meta.url)("./cube-engine.js");
const SOLVES = 2000;
const same = (a, b) => a.join() === b.join();
const LETTERS = { 2: "URFDLBxyz", 3: "URFDLBMESxyz" };

for (const n of [2, 3]) {
  test(`${n}x${n}: every move has order 4 and its inverse undoes it`, () => {
    const s = E.solved(n);
    for (const L of LETTERS[n]) {
      assert.ok(same(E.apply(s, [L, L, L, L]), s), `${L}4`);
      assert.ok(same(E.apply(s, [L, `${L}'`]), s), `${L} ${L}'`);
      assert.ok(same(E.apply(s, [`${L}2`, `${L}2`]), s), `${L}2 ${L}2`);
      assert.ok(
        same(E.apply(s, [L, L]), E.apply(s, [`${L}2`])),
        `${L}${L} = ${L}2`,
      );
      assert.ok(!same(E.apply(s, [L]), s), `${L} moves something`);
    }
  });

  test(`${n}x${n}: a sequence then its inverse is the identity`, () => {
    const rand = E.rng(11 + n);
    for (let k = 0; k < 50; k++) {
      const seq = E.scramble(n, rand, 30);
      const start = E.randomState(n, rand);
      assert.ok(same(E.apply(E.apply(start, seq), E.invert(seq)), start));
    }
  });
}

test("face turns go the right way (seen from each face)", () => {
  const s = E.solved(3);
  const at = (st, f, idx) => idx.map((i) => st[f * 9 + i]);
  // U: the front's top row goes to the left face
  assert.deepEqual(at(E.apply(s, "U"), 4, [0, 1, 2]), [2, 2, 2]);
  // R: the front's right column goes up
  assert.deepEqual(at(E.apply(s, "R"), 0, [2, 5, 8]), [2, 2, 2]);
  // F: the top's front row goes to the right face
  assert.deepEqual(at(E.apply(s, "F"), 1, [0, 3, 6]), [0, 0, 0]);
  // D: the front's bottom row goes to the right face
  assert.deepEqual(at(E.apply(s, "D"), 1, [6, 7, 8]), [2, 2, 2]);
  // L: the front's left column goes down
  assert.deepEqual(at(E.apply(s, "L"), 3, [0, 3, 6]), [2, 2, 2]);
  // x follows R, y follows U, z follows F (whole cube)
  assert.equal(E.apply(s, "x")[0 * 9 + 4], 2, "x: green comes on top");
  assert.equal(E.apply(s, "y")[2 * 9 + 4], 1, "y: red comes to the front");
  assert.equal(E.apply(s, "z")[0 * 9 + 4], 4, "z: orange comes on top");
  // famous orders
  const order = (alg) => {
    let t = E.apply(s, alg);
    let k = 1;
    while (!same(t, s)) ((t = E.apply(t, alg)), k++);
    return k;
  };
  assert.equal(order("R U R' U'"), 6);
  assert.equal(order("R' D' R D"), 6);
  assert.equal(order("R U"), 105);
  // M E S are the middles: R L' x' = M... check M = x' R L'
  assert.ok(same(E.apply(s, "M"), E.apply(s, "x' R L'")));
  assert.ok(same(E.apply(s, "E"), E.apply(s, "y' U D'")));
  assert.ok(same(E.apply(s, "S"), E.apply(s, "z B F'")));
});

test("notation parsing", () => {
  assert.deepEqual(E.parse("R U R' U'"), ["R", "U", "R'", "U'"]);
  assert.deepEqual(E.parse("  R2  U2' F’ x y' "), [
    "R2",
    "U2",
    "F'",
    "x",
    "y'",
  ]);
  assert.deepEqual(E.parse(["L", "D2"]), ["L", "D2"]);
  assert.deepEqual(E.parse(""), []);
  for (const bad of ["Q", "R3", "RR", "u", "R''"])
    assert.throws(() => E.parse(bad), /Bad move/, bad);
  assert.deepEqual(E.invert("R U2 F'"), ["F", "U2", "R'"]);
  assert.deepEqual(E.simplify("U U R R' y y y D2 D2"), ["U2", "y'"]);
  assert.equal(E.isValidMove("M", 3), true);
  assert.equal(E.isValidMove("M", 2), false);
});

test("move matching for the guide", () => {
  assert.equal(E.matchMove("R", "R").status, "done");
  assert.equal(E.matchMove("R", "R'").status, "wrong");
  assert.equal(E.matchMove("R", "U").status, "wrong");
  assert.deepEqual(E.matchMove("U2", "U'"), { status: "partial", rest: "U'" });
  assert.deepEqual(E.matchMove("y2", "y"), { status: "partial", rest: "y" });
  assert.equal(E.matchMove("U2", "U2").status, "done");
});

test("drag turns map to the right moves (both sizes, every layer and way)", () => {
  for (const n of [2, 3])
    for (const L of LETTERS[n])
      for (const suf of ["", "'"]) {
        const tok = L + suf;
        const info = E.moveInfo(tok, n);
        const coord = info.rotation ? "all" : info.layers[0];
        const back = E.moveFromTurn(n, info.axis, coord, Math.sign(info.angle));
        assert.equal(back, tok, `${n}: ${tok}`);
      }
});

test("stickers <-> pieces round trip", () => {
  for (const n of [2, 3]) {
    const rand = E.rng(21 + n);
    for (let k = 0; k < 200; k++) {
      const s = E.randomState(n, rand);
      const v = E.validate(s);
      assert.ok(v.ok, `random ${n}x${n} state is valid`);
      assert.ok(
        same(E.fromPieces(n, v.pieces), s),
        "fromPieces(validate(s).pieces) = s",
      );
    }
    // a state reached by moves is valid too (3x3 incl. slices and rotations)
    const seq =
      n === 3 ? "R M' U E2 S x F y' z2 B L' D" : "R U x F' y z2 B L D";
    assert.ok(E.validate(E.apply(E.solved(n), seq)).ok);
  }
});

test("validation explains what is wrong", () => {
  const s3 = E.apply(E.solved(3), "R U F' L2 D B'");
  assert.equal(E.validate(s3).ok, true);
  const g = E.geometry(3);
  const code = (s) => E.validate(s).code;
  // blank sticker
  const blank = s3.slice();
  blank[10] = -1;
  assert.equal(code(blank), "unpainted");
  // wrong colour count: one sticker painted with the wrong colour
  const count = s3.slice();
  count[0] = (count[0] + 1) % 6;
  assert.equal(code(count), "count");
  assert.deepEqual(E.validate(count).over, [count[0]]);
  // swap two stickers of different pieces with different colours: impossible piece
  const imp = E.solved(3);
  [imp[g.corners[0][1]], imp[g.corners[0][2]]] = [
    imp[g.corners[0][2]],
    imp[g.corners[0][1]],
  ];
  assert.equal(code(imp), "corner", "mirrored corner");
  const impE = E.solved(3);
  [impE[g.edges[0][0]], impE[g.edges[5][0]]] = [
    impE[g.edges[5][0]],
    impE[g.edges[0][0]],
  ];
  assert.ok(["edge", "count"].includes(code(impE)));
  const impE2 = E.solved(3);
  // white+yellow edge: colours of opposite faces on one piece
  const [a, b] = g.edges[0];
  const [c] = g.edges.find((e) => e.some((i) => g.stickers[i].face === 3));
  [impE2[b], impE2[c]] = [impE2[c], impE2[b]];
  assert.equal(code(impE2), "edge");
  // one twisted corner
  const tw = E.solved(3);
  const cp = g.corners[3];
  [tw[cp[0]], tw[cp[1]], tw[cp[2]]] = [tw[cp[2]], tw[cp[0]], tw[cp[1]]];
  assert.equal(code(tw), "twist");
  // one flipped edge
  const fl = s3.slice();
  const ep = g.edges[7];
  [fl[ep[0]], fl[ep[1]]] = [fl[ep[1]], fl[ep[0]]];
  assert.equal(code(fl), "flip");
  // two edges swapped (odd permutation)
  const v = E.validate(E.solved(3)).pieces;
  const odd = { ...v, ep: v.ep.slice() };
  [odd.ep[0], odd.ep[1]] = [odd.ep[1], odd.ep[0]];
  assert.equal(code(E.fromPieces(3, odd)), "parity");
  // centres: two the same / mirrored
  const cen = E.solved(3);
  cen[4] = 3;
  cen[31] = 0;
  assert.ok(["centers"].includes(code(cen)));
  const mir = E.apply(E.solved(3), "x");
  [mir[13], mir[40]] = [mir[40], mir[13]]; // swap R and L centres
  assert.equal(code(mir), "centers");
  // 2x2: counts, impossible corner, twist
  const s2 = E.apply(E.solved(2), "R U F'");
  assert.ok(E.validate(s2).ok);
  const g2 = E.geometry(2);
  const t2 = s2.slice();
  const k2 = g2.corners[2];
  [t2[k2[0]], t2[k2[1]], t2[k2[2]]] = [t2[k2[1]], t2[k2[2]], t2[k2[0]]];
  assert.equal(code(t2), "twist");
  const m2 = E.solved(2);
  [m2[g2.corners[5][1]], m2[g2.corners[5][2]]] = [
    m2[g2.corners[5][2]],
    m2[g2.corners[5][1]],
  ];
  assert.equal(code(m2), "corner");
  const c2 = E.solved(2);
  c2[0] = 1;
  assert.equal(code(c2), "count");
  // the reported stickers point at the problem
  assert.deepEqual(
    E.validate(m2).stickers.sort(),
    g2.corners[5].slice().sort(),
  );
});

// ---------------------------------------------------------------- solver
function checkSolve(n, start, stats) {
  const sol = E.solve(start);
  const ids = E.STAGES[n];
  assert.equal(sol.stages.length, ids.length);
  let s = start;
  sol.stages.forEach((st, i) => {
    for (const step of st.steps) {
      assert.ok(step.moves.length > 0);
      for (const m of step.moves) assert.ok(E.isValidMove(m, n), m);
      s = E.apply(s, step.moves);
    }
    // this stage's goal holds at its end, and no earlier goal was undone
    for (let j = 0; j <= i; j++)
      assert.ok(E.stageDone(s, ids[j]), `after ${st.id}: ${ids[j]} holds`);
    const len = st.steps.reduce((a, x) => a + x.moves.length, 0);
    stats.stage[i] = (stats.stage[i] || 0) + len;
  });
  assert.ok(E.isSolved(s), "solved at the end");
  assert.ok(same(E.apply(start, sol.moves), s));
  const turns = sol.moves.filter((m) => !"xyz".includes(m[0])).length;
  stats.total += sol.moves.length;
  stats.turns += turns;
  stats.max = Math.max(stats.max, sol.moves.length);
  stats.count++;
  return sol;
}
const report = (name, st, ids) =>
  console.log(
    `  ${name}: ${st.count} solves, avg ${(st.total / st.count).toFixed(1)} moves ` +
      `(${(st.turns / st.count).toFixed(1)} layer turns + ${((st.total - st.turns) / st.count).toFixed(1)} whole-cube turns), ` +
      `max ${st.max}; per stage: ` +
      ids.map((id, i) => `${id} ${(st.stage[i] / st.count).toFixed(1)}`).join(", "),
  );

for (const n of [3, 2]) {
  const LIMIT = n === 3 ? 260 : 150;
  test(`${n}x${n}: solves ${SOLVES} random states stage by stage`, () => {
    const rand = E.rng(2026 + n);
    const stats = { total: 0, turns: 0, max: 0, count: 0, stage: [] };
    for (let k = 0; k < SOLVES; k++)
      checkSolve(n, E.randomState(n, rand), stats);
    report(`${n}x${n} random states`, stats, E.STAGES[n]);
    assert.ok(stats.max <= LIMIT, `max ${stats.max} <= ${LIMIT}`);
  });

  test(`${n}x${n}: solves from any orientation, from scrambles and when already solved`, () => {
    const rand = E.rng(77 + n);
    const stats = { total: 0, turns: 0, max: 0, count: 0, stage: [] };
    const rots = [
      "",
      "x",
      "x'",
      "z",
      "z'",
      "z2",
      "y",
      "y2",
      "x y",
      "x' y'",
      "z y2",
      "x2 y'",
    ];
    for (let k = 0; k < 200; k++) {
      const start = E.apply(E.randomState(n, rand), rots[k % rots.length]);
      checkSolve(n, start, stats);
      checkSolve(n, E.apply(E.solved(n), E.scramble(n, rand)), stats);
    }
    for (const r of rots) {
      const sol = E.solve(E.apply(E.solved(n), r));
      assert.equal(
        sol.moves.filter((m) => !"xyz".includes(m[0])).length,
        0,
        `solved (${r}) needs no turns`,
      );
    }
  });
}

test("3x3: the method uses only the beginner tricks, no back turns", () => {
  const rand = E.rng(5);
  for (let k = 0; k < 300; k++) {
    const sol = E.solve(E.randomState(3, rand));
    for (const m of sol.moves) assert.ok(!/^[BMES]/.test(m), m);
    const [, corners, , ycross, yedges, yplace, ytwist] = sol.stages;
    const has = (steps, alg) =>
      steps.every((st) => st.moves.join(" ").includes(alg.join(" ")));
    assert.ok(has(corners.steps, E.ALGS.magic));
    assert.ok(has(ycross.steps, E.ALGS.ycross));
    assert.ok(
      has(
        yedges.steps.filter((s) => s.kind !== "align"),
        E.ALGS.sune,
      ),
    );
    assert.ok(
      has(
        yplace.steps.filter((s) => s.kind !== "flip"),
        E.ALGS.corners,
      ),
    );
    assert.ok(
      has(
        ytwist.steps.filter((s) => s.kind === "ytwist"),
        E.ALGS.magic,
      ),
    );
    // yellow corners are twisted by turning ONLY the top between corners
    for (const st of ytwist.steps.filter((s) => s.kind === "next-corner"))
      assert.ok(st.moves.every((m) => m[0] === "U"));
    // steps name the piece they work on (so it can glow)
    for (const st of sol.stages.flatMap((x) => x.steps))
      if (["cross", "corner", "middle", "pop", "ytwist"].includes(st.kind))
        assert.ok(st.pieces.length === 1);
  }
});

test("a partial plan continues from the stage you are in", () => {
  const rand = E.rng(99);
  for (const n of [2, 3])
    for (let k = 0; k < 100; k++) {
      let s = E.randomState(n, rand);
      const full = E.solve(s);
      const cut = 1 + (k % (full.stages.length - 1));
      for (let i = 0; i < cut; i++)
        s = E.apply(
          s,
          full.stages[i].steps.flatMap((x) => x.moves),
        );
      assert.ok(E.currentStage(s) >= cut);
      const rest = E.solve(s, { from: E.currentStage(s) });
      assert.ok(E.isSolved(E.apply(s, rest.moves)));
    }
});

test("lessons: practice positions train exactly one stage", () => {
  let lessons = 0;
  for (const n of [2, 3])
    E.STAGES[n].forEach((id, stage) => {
      lessons++;
      const seen = new Set();
      for (let k = 0; k < E.LESSON_POSITIONS; k++) {
        const s = E.lessonPosition(n, stage, k);
        assert.equal(E.sizeOf(s), n);
        assert.ok(E.validate(s).ok);
        for (let j = 0; j < stage; j++)
          assert.ok(
            E.stageDone(s, E.STAGES[n][j]),
            `${id}: ${E.STAGES[n][j]} done`,
          );
        assert.ok(!E.stageDone(s, id), `${id} not done yet`);
        const plan = E.solve(s, { from: stage, to: stage });
        const len = plan.moves.length;
        assert.ok(len > 0 && len <= 45, `${n}x${n} ${id} #${k}: ${len} moves`);
        assert.ok(E.stageDone(E.apply(s, plan.moves), id));
        seen.add(s.join());
        // same position every time (seeded)
        assert.ok(same(E.lessonPosition(n, stage, k), s));
      }
      assert.equal(seen.size, E.LESSON_POSITIONS, `${id}: positions differ`);
    });
  assert.equal(E.MAX_STARS, lessons * 3);
  assert.equal(E.MAX_STARS, 30);
  assert.equal(E.lessonStars({}), 3);
  assert.equal(E.lessonStars({ watched: true }), 2);
  assert.equal(E.lessonStars({ watched: true, skipped: true }), 1);
});

test("the hub catalogue offers the cube with the same max stars", () => {
  const { GAMES } = createRequire(import.meta.url)("../../../hub/games.js");
  const g = GAMES.find((x) => x.id === "cube");
  assert.ok(g, "cube in hub/games.js");
  assert.equal(g.maxStars, E.MAX_STARS);
  assert.equal(g.href, "3d/games/cube/");
});
