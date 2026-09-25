import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutHub, rankFor } from "./logic.js";

test("wide layout: symmetric arc behind the buddy", () => {
  const l = layoutHub(6, 16 / 9);
  assert.equal(l.portals.length, 6);
  assert.ok(l.wide);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(l.portals[i].x + l.portals[5 - i].x) < 1e-9, "mirrored");
    assert.ok(l.portals[i].z < l.buddy.z, "behind the buddy");
  }
  assert.ok(
    l.portals[0].x < l.portals[5].x,
    "left to right in catalogue order",
  );
});

test("tall layout: columns, rows going back, short rows centred", () => {
  const l = layoutHub(5, 390 / 844);
  assert.ok(!l.wide);
  assert.equal(l.portals[4].x, 0, "phone: two columns, odd one centred");
  const tab = layoutHub(5, 0.75).portals;
  assert.equal(tab[3].x, -tab[4].x, "tablet: three columns, short last row centred");
  assert.equal(layoutHub(3, 0.5).portals[2].x, 0);
  assert.ok(l.portals[3].z < l.portals[0].z);
  const xs = l.portals.map((p) => Math.abs(p.x));
  assert.ok(Math.max(...xs) <= l.view.width / 2, "fits the framed width");
});

test("portals never overlap", () => {
  for (const aspect of [0.46, 0.75, 1.6, 2.2]) {
    for (let n = 1; n <= 8; n++) {
      const p = layoutHub(n, aspect).portals;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          assert.ok(
            Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z) > 1.8,
            `n=${n} aspect=${aspect} ${i}/${j}`,
          );
    }
  }
});

test("rankFor matches the 2D hub maths", () => {
  assert.deepEqual(rankFor(0, 100, 5), { rank: 0, toNext: 25, last: false });
  assert.deepEqual(rankFor(30, 100, 5), { rank: 1, toNext: 20, last: false });
  assert.deepEqual(rankFor(100, 100, 5), { rank: 4, toNext: 0, last: true });
  assert.equal(rankFor(0, 0, 5).last, true);
});
