// The buddy as a little walker: hops tile to tile, turns to face where it goes,
// bumps into things with a squish, splashes into water and springs back home.
//   walker.root   (move/reparent this)  -> squash group -> buddy.object
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { FACING, turn } from "./logic.js";

export function createWalker(stage, buddy) {
  const root = new THREE.Group();
  const squash = new THREE.Group();
  root.add(squash);
  squash.add(buddy.object);
  const spring = new Kit.Spring(1, { stiffness: 320, damping: 11 });
  let yaw = 0;
  let yawTarget = 0;
  let homeTimer = 0;
  const reduced = stage.reducedMotion;

  // Loop pulse: a ring that expands around the feet when a loop starts again.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.035, 8, 40).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#ffb703", transparent: true, depthWrite: false }),
  );
  ring.visible = false;
  ring.position.y = 0.05;
  root.add(ring);
  let ringT = -1;

  stage.onFrame((dt) => {
    const s = spring.step(dt);
    squash.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    yaw += turn(yaw, yawTarget) * Math.min(1, dt * 12);
    buddy.object.rotation.y = yaw;
    if (ringT >= 0) {
      ringT += dt;
      const k = ringT / 0.6;
      ring.scale.setScalar(0.6 + k * 0.9);
      ring.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        ringT = -1;
        ring.visible = false;
      }
    }
  });

  const tween = (ms, onUpdate, ease = "linear") =>
    stage.tween({ ms: reduced ? 1 : ms, ease, onUpdate: (v, k) => onUpdate(k) })
      .done;

  // Face a direction ("U"|"D"|"L"|"R"), or the camera (null) after a while.
  function face(d) {
    clearTimeout(homeTimer);
    yawTarget = d ? FACING[d] : 0;
  }
  function faceCameraSoon(ms = 900) {
    clearTimeout(homeTimer);
    homeTimer = setTimeout(() => (yawTarget = 0), ms);
  }

  return {
    root,
    buddy,
    face,
    faceCameraSoon,
    place(p) {
      root.position.copy(p);
      squash.position.set(0, 0, 0);
      buddy.object.position.set(0, 0, 0);
    },
    setScale(s) {
      root.scale.setScalar(s);
    },
    // Hop to a world point in `ms`, with anticipation, stretch and a landing squash.
    async hop(to, ms, height = 0.32) {
      const from = root.position.clone();
      spring.value = 0.86; // crouch
      await tween(ms, (k) => {
        root.position.lerpVectors(from, to, k);
        root.position.y =
          from.y + (to.y - from.y) * k + Math.sin(Math.PI * k) * height;
        spring.target = 1 + Math.sin(Math.PI * k) * 0.1;
      });
      root.position.copy(to);
      spring.target = 1;
      spring.value = 0.8;
      spring.kick(-1.5);
    },
    // Walk into something: lean in, squish flat against it, bounce back.
    async bump(d, ms) {
      const [dx, dz] = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[d];
      const from = root.position.clone();
      const hit = from.clone().add(new THREE.Vector3(dx * 0.34, 0, dz * 0.34));
      await tween(
        ms * 0.35,
        (k) => {
          root.position.lerpVectors(from, hit, k);
          root.position.y = from.y + Math.sin(Math.PI * k) * 0.12;
        },
        "inQuad",
      );
      spring.value = 0.62;
      spring.kick(3);
      stage.burst(
        hit.clone().add(new THREE.Vector3(dx * 0.2, 0.55, dz * 0.2)),
        {
          shape: "star",
          count: 8,
          speed: 1.8,
          up: 1.2,
          colors: ["#ffd43b", "#ffffff"],
        },
      );
      await tween(
        ms * 0.45,
        (k) => {
          root.position.lerpVectors(hit, from, k);
          root.position.y = from.y + Math.sin(Math.PI * k) * 0.08;
        },
        "outBack",
      );
      buddy.shake();
    },
    // Fall into the water: sink a little and bob, looking surprised.
    async splash(ms) {
      const from = root.position.clone();
      spring.value = 1.25;
      spring.kick(-2);
      await tween(
        ms * 0.5,
        (k) => {
          root.position.y = from.y - k * 0.55;
        },
        "outQuad",
      );
    },
    // Spring back to a point (after a failure), in a big friendly arc.
    async home(to, ms = 650) {
      const from = root.position.clone();
      face(null);
      await tween(
        ms,
        (k) => {
          root.position.lerpVectors(from, to, k);
          root.position.y =
            from.y + (to.y - from.y) * k + Math.sin(Math.PI * k) * 0.9;
        },
        "inOutQuad",
      );
      root.position.copy(to);
      spring.value = 0.75;
      spring.kick(-1);
    },
    pulse(color = "#ffb703") {
      ring.material.color.set(color);
      ring.visible = true;
      ringT = 0;
    },
    squish(v = 0.8) {
      spring.value = v;
      spring.kick(-1);
    },
  };
}
