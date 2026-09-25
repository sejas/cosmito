// The world map: a chain of floating islands, one per world, with a zigzag of
// level stones the buddy hops along. Stones show their number (HTML badge) and
// stars (instanced 3D stars); locked ones are grey with a padlock.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { stoneLayout, islandLayout, seeded } from "./logic.js";

const TOP = 0.3; // island grass height
const STONE_H = 0.24;
export const STONE_TOP = TOP + STONE_H + 0.02;
const TREE_COLS = [
  ["#69db7c", "#8ce99a", "#ffc9e3", "#b2f2bb"], // meadow
  ["#63e6be", "#96f2d7", "#a5d8ff", "#8ce99a"], // river
  ["#b197fc", "#d0bfff", "#8ce99a", "#e599f7"], // bug woods
  ["#ffc9e3", "#ffe066", "#fcc2d7", "#b2f2bb"], // magic pads
];

function islandShape(radius, depth, tint) {
  const grp = new THREE.Group();
  const top = [new THREE.Vector2(0, TOP)];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    top.push(
      new THREE.Vector2(
        radius - 0.5 + Math.sin(a) * 0.5,
        -0.1 + Math.cos(a) * 0.4,
      ),
    );
  }
  top.push(new THREE.Vector2(radius - 0.05, -0.35));
  const grassGeo = new THREE.LatheGeometry(top.reverse(), 64);
  const gp = grassGeo.attributes.position;
  const gc = new Float32Array(gp.count * 3);
  const mid = new THREE.Color("#b8f5a0");
  const edge = new THREE.Color("#72d67a").lerp(new THREE.Color(tint), 0.25);
  const lip = new THREE.Color(tint).lerp(new THREE.Color("#40c057"), 0.35);
  const c = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const r = Math.hypot(gp.getX(i), gp.getZ(i)) / radius;
    const y = gp.getY(i);
    c.copy(mid).lerp(edge, Math.min(1, Math.max(0, (r - 0.45) / 0.5)));
    if (y < 0.25) c.lerp(lip, Math.min(1, (0.25 - y) / 0.4));
    c.toArray(gc, i * 3);
  }
  grassGeo.setAttribute("color", new THREE.BufferAttribute(gc, 3));
  const grass = new THREE.Mesh(
    grassGeo,
    Kit.toon("#ffffff", { vertexColors: true, rim: 0.25, rimColor: "#e6fcf5" }),
  );
  grass.receiveShadow = true;
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push(
      new THREE.Vector2(
        Math.max(
          0.01,
          (radius - 0.1) * Math.pow(1 - t, 0.8) * (1 - 0.08 * Math.sin(t * 9)),
        ),
        -0.1 - t * depth,
      ),
    );
  }
  const cliffGeo = new THREE.LatheGeometry(prof.reverse(), 40);
  const p = cliffGeo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const stops = [
    new THREE.Color("#ffd8a8"),
    new THREE.Color("#ffb3c6"),
    new THREE.Color(tint).lerp(new THREE.Color("#b197fc"), 0.6),
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const t = -v.y / depth;
    const bump =
      1 + 0.07 * Math.sin(a * 7 + t * 5) + 0.05 * Math.sin(a * 13 - t * 3);
    if (t > 0.02) p.setXYZ(i, v.x * bump, v.y, v.z * bump);
    const k = Math.min(1, t * 1.6);
    if (k < 0.5) c.copy(stops[0]).lerp(stops[1], k * 2);
    else c.copy(stops[1]).lerp(stops[2], (k - 0.5) * 2);
    c.toArray(cols, i * 3);
  }
  cliffGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  cliffGeo.computeVertexNormals();
  grp.add(
    grass,
    new THREE.Mesh(
      cliffGeo,
      Kit.toon("#ffffff", {
        vertexColors: true,
        rim: 0.5,
        rimColor: "#fff0f6",
      }),
    ),
  );
  return grp;
}

export function createMap(stage, { worlds, levels, t, onStone, onIsland }) {
  const root = new THREE.Group();
  stage.scene.add(root);
  const R = 4; // lathe radius; islands are scaled to their layout
  const stoneGeo = new THREE.CylinderGeometry(0.46, 0.5, STONE_H, 32);
  const starGeo = Kit.star3D().geometry;
  const dotGeo = new THREE.CylinderGeometry(0.17, 0.19, 0.07, 18);

  const islands = worlds.map((w, wi) => {
    const group = new THREE.Group();
    const shape = islandShape(R, 3.2, w.color);
    group.add(shape);
    const sign = Kit.label(w.icon, { size: 1.1 });
    group.add(sign);
    const lock = Kit.label("🔒", { size: 0.9 });
    lock.visible = false;
    group.add(lock);
    root.add(group);
    const tap = stage.tap(shape, {
      squish: false,
      label: () => t("goWorld", t(`worlds.${w.id}`)),
      onTap: () => onIsland(wi),
    });
    return {
      w,
      wi,
      group,
      shape,
      sign,
      lock,
      tap,
      rx: 3,
      rz: 3,
      phase: wi * 1.3,
    };
  });

  const stoneLabels = [];
  const stones = levels.map((L, i) => {
    const island = islands[L.world];
    const g = new THREE.Group();
    const top = new THREE.Mesh(stoneGeo, Kit.toon("#ffffff", { rim: 0.4 }));
    top.position.y = TOP + STONE_H / 2;
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    island.group.add(g);
    const badge = document.createElement("span");
    badge.className = "c3-stone";
    badge.setAttribute("aria-hidden", "true");
    const pin = stage.pin(badge, g, { offset: [0, STONE_TOP, 0.3] });
    const tap = stage.tap(g, {
      label: () => stoneLabels[i] || "",
      onTap: () => onStone(i),
      hitRadius: 0.6,
      hitOffset: [0, TOP + 0.2, 0],
    });
    return { L, i, g, top, badge, pin, tap, label: "" };
  });

  // stars in front of every stone: gold = earned, lilac = still to get
  const starsOn = new THREE.InstancedMesh(
    starGeo,
    Kit.candy("#ffc93c", "#3a2600"),
    levels.length * 3,
  );
  const starsOff = new THREE.InstancedMesh(
    starGeo,
    Kit.toon("#e5dbff", { rim: 0.5 }),
    levels.length * 3,
  );
  starsOn.raycast = starsOff.raycast = () => {};
  root.add(starsOn, starsOff);

  // little stepping dots between stones, and cloud bridges between islands
  const dots = new THREE.InstancedMesh(
    dotGeo,
    Kit.toon("#fff9db", { rim: 0.3 }),
    levels.length * 2,
  );
  dots.raycast = () => {};
  root.add(dots);
  const puffs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.4, 14, 10),
    Kit.toon("#ffffff", { rim: 0.5, rimColor: "#ffe3f1" }),
    (worlds.length - 1) * 6,
  );
  puffs.raycast = () => {};
  root.add(puffs);

  // trees around the island rims
  const perIsland = 9;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.6, 8),
    Kit.toon("#c08457"),
    worlds.length * perIsland,
  );
  const canopies = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.5, 2),
    Kit.toon("#ffffff", { rim: 0.45 }),
    worlds.length * perIsland,
  );
  trunks.castShadow = canopies.castShadow = true;
  trunks.raycast = canopies.raycast = () => {};
  root.add(trunks, canopies);

  const perFlowers = 46;
  const flowers = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    Kit.toon("#ffffff", { rim: 0.2 }),
    worlds.length * perFlowers,
  );
  flowers.raycast = () => {};
  root.add(flowers);
  const FLOWER_COLS = ["#ff8fab", "#ffd43b", "#ffffff", "#b197fc", "#74c0fc"];

  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let wide = null;

  function layout(isWide) {
    if (wide === isWide) return;
    wide = isWide;
    const lays = islands.map((isl) =>
      stoneLayout(levels.filter((l) => l.world === isl.wi).length, wide),
    );
    const spans = lays.map((l) => (wide ? l.rx : l.rz));
    const places = islandLayout(islands.length, wide, spans);
    let d = 0;
    let tk = 0;
    islands.forEach((isl, wi) => {
      const lay = lays[wi];
      isl.rx = lay.rx;
      isl.rz = lay.rz;
      isl.place = places[wi];
      isl.group.position.set(places[wi].x, places[wi].y, places[wi].z);
      isl.shape.scale.set(lay.rx / R, 1, lay.rz / R);
      isl.sign.position.set(
        lay.rx * 0.55,
        2.2,
        -lay.rz * 0.55,
      );
      isl.lock.position.set(0, 1.4, 0.4);
      isl.tap.setBase?.();
      const mine = stones.filter((s) => s.L.world === wi);
      mine.forEach((s, k) => {
        s.g.position.set(lay.stones[k].x, 0, lay.stones[k].z);
        s.tap.setBase();
        if (k > 0) {
          const a = lay.stones[k - 1];
          const b = lay.stones[k];
          for (const f of [0.5]) {
            m.makeTranslation(
              places[wi].x + a.x + (b.x - a.x) * f,
              places[wi].y + TOP + 0.03,
              places[wi].z + a.z + (b.z - a.z) * f,
            );
            dots.setMatrixAt(d++, m);
          }
        }
      });
      // trees on the rim, not too close to stones
      const rnd = seeded(wi * 31 + 7);
      const cols = TREE_COLS[wi % TREE_COLS.length];
      let placed = 0;
      for (let tries = 0; placed < perIsland && tries < 80; tries++) {
        const a = rnd() * Math.PI * 2;
        const r = 0.74 + rnd() * 0.14;
        const x = Math.cos(a) * lay.rx * r;
        const z = Math.sin(a) * lay.rz * r;
        if (z > lay.rz * 0.35 && Math.abs(x) < lay.rx * 0.7) continue; // keep the front open
        if (
          mine.some(
            (s) => Math.hypot(s.g.position.x - x, s.g.position.z - z) < 1.05,
          )
        )
          continue;
        const s = 0.7 + rnd() * 0.45;
        const px = places[wi].x + x;
        const pz = places[wi].z + z;
        const py = places[wi].y + TOP;
        m.makeScale(s, s, s).setPosition(px, py + 0.3 * s, pz);
        trunks.setMatrixAt(tk, m);
        m.makeScale(s, s * 1.1, s).setPosition(px, py + 0.85 * s, pz);
        canopies.setMatrixAt(tk, m);
        canopies.setColorAt(tk, col.set(cols[placed % cols.length]));
        tk++;
        placed++;
      }
    });
    let fk = 0;
    islands.forEach((isl, wi) => {
      const rnd = seeded(wi * 53 + 11);
      const mine = stones.filter((s) => s.L.world === wi);
      for (let n = 0, tries = 0; n < perFlowers && tries < 300; tries++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * 0.86;
        const x = Math.cos(a) * isl.rx * r;
        const z = Math.sin(a) * isl.rz * r;
        if (mine.some((s) => Math.hypot(s.g.position.x - x, s.g.position.z - z) < 0.65)) continue;
        m.makeScale(1, 0.6, 1).setPosition(isl.place.x + x, isl.place.y + TOP + 0.03, isl.place.z + z);
        flowers.setMatrixAt(fk, m);
        flowers.setColorAt(fk, col.set(FLOWER_COLS[fk % FLOWER_COLS.length]));
        fk++;
        n++;
      }
    });
    flowers.count = fk;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    dots.count = d;
    trunks.count = canopies.count = tk;
    dots.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate =
      canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    // cloud bridges
    let p = 0;
    for (let wi = 1; wi < islands.length; wi++) {
      const a = islands[wi - 1];
      const b = islands[wi];
      const A = new THREE.Vector3(a.place.x, a.place.y + 0.1, a.place.z);
      const B = new THREE.Vector3(b.place.x, b.place.y + 0.1, b.place.z);
      const ra = wide ? a.rx : a.rz;
      const rb = wide ? b.rx : b.rz;
      const len = A.distanceTo(B);
      for (let k = 0; k < 6; k++) {
        const f = (ra - 0.3 + ((len - ra - rb + 0.6) * (k + 0.5)) / 6) / len;
        const pt = A.clone().lerp(B, f);
        pt.y += Math.sin(f * Math.PI) * 0.5 - 0.2;
        const s = 0.8 + ((k * 37) % 5) * 0.08;
        e.set(0, k, 0);
        q.setFromEuler(e);
        m.compose(pt, q, new THREE.Vector3(s * 1.2, s * 0.7, s));
        puffs.setMatrixAt(p++, m);
      }
    }
    puffs.count = p;
    puffs.instanceMatrix.needsUpdate = true;
    placeStars();
  }

  let lastBest = {};
  function placeStars() {
    root.updateMatrixWorld(true);
    let on = 0;
    let off = 0;
    stones.forEach((s) => {
      const got = Math.min(3, lastBest[s.L.id] || 0);
      const open = s.open;
      const wp = new THREE.Vector3();
      s.g.getWorldPosition(wp);
      if (!open) return;
      for (let k = 0; k < 3; k++) {
        const x = wp.x + (k - 1) * 0.3;
        const y = wp.y + TOP + 0.14 + (k === 1 ? 0.06 : 0);
        const z = wp.z + 0.62;
        e.set(-0.35, 0, (1 - k) * 0.25);
        q.setFromEuler(e);
        m.compose(
          new THREE.Vector3(x, y, z),
          q,
          new THREE.Vector3(0.42, 0.42, 0.42),
        );
        if (k < got) starsOn.setMatrixAt(on++, m);
        else starsOff.setMatrixAt(off++, m);
      }
    });
    starsOn.count = on;
    starsOff.count = off;
    starsOn.instanceMatrix.needsUpdate =
      starsOff.instanceMatrix.needsUpdate = true;
  }

  // Colour stones, badges and labels from progress.
  function render({ best, isOpen, current, standing }) {
    lastBest = best;
    stones.forEach((s) => {
      const got = Math.min(3, best[s.L.id] || 0);
      s.open = isOpen(s.i);
      const color = worlds[s.L.world].color;
      s.top.material = !s.open
        ? Kit.toon("#dde1ee", { rim: 0.3 })
        : got
          ? Kit.toon(color, { rim: 0.55 })
          : Kit.toon("#ffffff", { rim: 0.6, rimColor: color });
      s.badge.textContent = String(s.L.num);
      s.badge.classList.toggle("locked", !s.open);
      s.badge.classList.toggle("current", s.i === current);
      s.badge.style.setProperty("--wc", color);
      stoneLabels[s.i] = s.open ? t("levelAria", s.L.id, got) : t("levelLocked", s.L.id);
      s.tap.refreshLabel();
    });
    islands.forEach((isl) => {
      const open = isOpen(levels.findIndex((l) => l.world === isl.wi));
      isl.lock.visible = !open;
      isl.sign.material.opacity = open ? 1 : 0.55;
      isl.tap.refreshLabel();
    });
    placeStars();
  }

  stage.onFrame((dt, time) => {
    if (!root.visible || stage.reducedMotion) return;
    islands.forEach((isl) => {
      isl.sign.position.y = 2.2 + Math.sin(time * 1.3 + isl.phase) * 0.12;
    });
  });

  return {
    root,
    islands,
    stones,
    layout,
    render,
    get wide() {
      return wide;
    },
    // The area to frame for island wi: { center, width, depth }.
    islandArea(wi) {
      const isl = islands[wi];
      return {
        center: [isl.place.x, isl.place.y + TOP, isl.place.z],
        width: isl.rx * 2,
        depth: isl.rz * 2,
      };
    },
    stoneTop(i) {
      root.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      stones[i].g.getWorldPosition(p);
      p.y += STONE_TOP;
      return p;
    },
    setActive(on) {
      root.visible = on;
      stones.forEach((s) => {
        s.tap.enabled = on;
      });
      islands.forEach((isl) => (isl.tap.enabled = on));
      stones.forEach((s) => s.badge.classList.toggle("off", !on));
    },
    bounce(i) {
      stage.burst(this.stoneTop(i), {
        shape: "dot",
        count: 8,
        speed: 1.5,
        colors: ["#dde1ee", "#ffffff"],
      });
    },
  };
}
