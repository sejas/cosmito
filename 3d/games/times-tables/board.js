// A glass board with a real 3D array of treats: `rows` groups of `per`,
// popping in row by row, with the skip-count number floating after each row.
// Used by Learn (big, all 10 rows framed) and as the hint after a wrong answer.
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { arrayCells, colorOf } from "./logic.js";

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createBoard(
  stage,
  { maxRows = 10, maxPer = 10, ghosts = true } = {},
) {
  const group = new THREE.Group(); // position = top-row centre
  const content = new THREE.Group(); // scaled to fit
  group.add(content);
  const plateMat = Kit.flat("#ffffff", { opacity: 0.42, depthWrite: false });
  const edgeMat = Kit.flat("#ffffff", { opacity: 0.9 });
  let plate = null;
  let edge = null;
  const treats = new Kit.TreatInstances(stage, maxRows * maxPer, {
    shadows: false,
  });
  content.add(treats.group);
  const ghost = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.13, 16),
    Kit.flat("#ffffff", { opacity: 0.7, depthWrite: false }),
    maxRows * maxPer,
  );
  ghost.count = 0;
  ghost.raycast = () => {};
  content.add(ghost);
  const labels = Array.from({ length: maxRows }, (_, r) => {
    const l = Kit.label(String(r + 1), {
      size: 0.5,
      color: "#26315c",
      bg: "rgba(255,255,255,0.92)",
    });
    l.visible = false;
    l.renderOrder = 5;
    content.add(l);
    return l;
  });
  group.traverse((o) => (o.raycast = () => {}));

  const SCALE = 0.8;
  let anim = []; // { i, start, cell }
  let rowCalls = []; // { at, row, value, fired }
  let clock = 0;
  let current = { per: 0, rows: 0 };

  function buildPlate(per, frameRows, color) {
    content.remove(plate, edge);
    plate?.geometry.dispose();
    edge?.geometry.dispose();
    const a = arrayCells(per, frameRows);
    const w = a.width + 0.6;
    const h = frameRows + 0.5;
    plate = new THREE.Mesh(
      new THREE.ShapeGeometry(roundedRect(w, h, 0.45), 12),
      plateMat,
    );
    edge = new THREE.Mesh(
      new THREE.ShapeGeometry(roundedRect(w + 0.16, h + 0.16, 0.52), 12),
      Kit.flat(color, { opacity: 0.55, depthWrite: false }),
    );
    const cx = (a.labels[0].x + 0.4 + a.cells[0].x - 0.5) / 2;
    const cy = -(frameRows - 1) / 2;
    plate.position.set(cx, cy, -0.5);
    edge.position.set(cx, cy, -0.52);
    plate.renderOrder = -2;
    edge.renderOrder = -3;
    plate.raycast = edge.raycast = () => {};
    content.add(edge, plate);
    return { w: w + 0.16, h: h + 0.16, cx, cy };
  }

  stage.onFrame((dt) => {
    clock += dt;
    let dirty = false;
    if (anim.length) {
      for (let k = anim.length - 1; k >= 0; k--) {
        const a = anim[k];
        const u = (clock - a.start) / 0.38;
        if (u < 0) continue;
        const e = Kit.ease.outBack(Math.min(1, u));
        treats.set(a.i, {
          s: SCALE * e,
          y: a.cell.y + (1 - Math.min(1, u)) * 0.6,
        });
        dirty = true;
        if (u >= 1) anim.splice(k, 1);
      }
    }
    for (const r of rowCalls) {
      if (r.fired || clock < r.at) continue;
      r.fired = true;
      const l = labels[r.row];
      l.visible = true;
      l.scale.multiplyScalar(0.01);
      const base = l.userData.base;
      stage.tween({
        ms: stage.reducedMotion ? 1 : 420,
        ease: "outBack",
        onUpdate: (s) => l.scale.set(base.x * s, base.y * s, 1),
      });
      r.onRow?.(r.row, r.value);
    }
    if (dirty) treats.flush();
  });

  return {
    group,
    setTreat(id) {
      treats.setTreat(id);
      treats.flush();
    },
    // Show `rows` groups of `per`. Rows before `animateFrom` appear at once;
    // the rest pop in one after another (onRow(row, skipCountValue) per row).
    // frameRows: rows the glass board is sized for (10 in Learn).
    show(
      per,
      rows,
      {
        animateFrom = 0,
        frameRows = rows,
        fit = null,
        onRow = null,
        rowMs = 420,
        colMs = 55,
      } = {},
    ) {
      const color = colorOf(per);
      const size = buildPlate(per, frameRows, color);
      const a = arrayCells(per, rows);
      const all = arrayCells(per, frameRows);
      current = { per, rows };
      anim = [];
      rowCalls = [];
      clock = 0;
      treats.count = a.cells.length;
      const still = stage.reducedMotion;
      a.cells.forEach((cell, i) => {
        const animated = cell.row >= animateFrom && !still;
        treats.set(i, {
          x: cell.x,
          y: cell.y,
          z: 0,
          s: animated ? 0 : SCALE,
          ry: 0.35,
          rz: 0,
          rx: 0,
        });
        if (animated) {
          const k = cell.row - animateFrom;
          anim.push({
            i,
            cell,
            start: (k * rowMs) / 1000 + (cell.col * colMs) / 1000,
          });
        }
      });
      treats.flush();
      // ghost slots for the whole frame (where the next rows will go)
      const m = new THREE.Matrix4();
      ghost.visible = ghosts;
      ghost.count = ghosts ? all.cells.length : 0;
      all.cells.forEach((c, i) =>
        ghost.setMatrixAt(i, m.makeTranslation(c.x, c.y, -0.3)),
      );
      ghost.instanceMatrix.needsUpdate = true;
      labels.forEach((l, r) => {
        const lab = a.labels[r];
        l.visible = !!lab && (r < animateFrom || still);
        if (!lab) return;
        l.userData.setText(String(lab.value));
        l.userData.base = l.scale.clone();
        l.position.set(lab.x + 0.15, lab.y, 0.1);
        if (r >= animateFrom && !still) {
          rowCalls.push({
            row: r,
            value: lab.value,
            at:
              ((r - animateFrom) * rowMs) / 1000 +
              ((per - 1) * colMs) / 1000 +
              0.12,
            fired: false,
            onRow,
          });
        } else if (still && r >= animateFrom) onRow?.(r, lab.value);
      });
      // Without `fit` the top row's centre is the group origin (Learn). With
      // `fit: { w, h }` the board shrinks to fit and is centred (hints).
      let s = 1;
      if (fit) s = Math.min(1, fit.w / size.w, fit.h / size.h);
      content.scale.setScalar(s);
      if (fit) content.position.set(-size.cx * s, -size.cy * s, 0);
      else content.position.set(0, 0, 0);
      return size;
    },
    get current() {
      return current;
    },
  };
}
