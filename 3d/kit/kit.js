// Pipo & Friends 3D kit — one import for everything a 3D game needs.
//   import * as Kit from "../../kit/kit.js";
// See 3d/README.md for the guide and 3d/kit/demo.html for a live reference.
export { createStage, hasWebGL, reducedMotion, stages } from "./stage.js";
export {
  mascot,
  buddyMascot,
  Mascot3D,
  register3D,
  buildModel,
} from "./mascots3d.js";
export { treat, corn, pepper, star3D, registerTreat } from "./treats.js";
export {
  toon,
  flat,
  candy,
  holo,
  label,
  blobShadow,
  softDot,
} from "./materials.js";
export { createSky, createClouds, createSparkles, SKY } from "./sky.js";
export { COLORS } from "./particles.js";
export { ease, clamp, lerp, damp, Spring, Tweens } from "./motion.js";
export {
  fitDistance,
  orbitPosition,
  frame,
  fitPoints,
  boxPoints,
  ellipsePoints,
} from "./view.js";
export { clampPin, isShown } from "./screen.js";
export { TreatInstances, treatParts } from "./instanced.js";
export { LEVELS, settingsFor } from "./quality.js";
export { KIT_DICT, kt } from "./i18n.js";
export * as ui from "./ui.js";
export { I18N, AUDIO, STORE, FX, MASCOTS } from "./shared.js";
