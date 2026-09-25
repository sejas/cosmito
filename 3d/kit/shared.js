// Bridge to the classic-script shared layer (shared/*.js). Those files declare
// top-level `const`s, which live in the global scope but are NOT properties of
// `window`, so modules must reach them by bare name. These getters return null
// when a page didn't load the script (e.g. a unit test), so callers can use `?.`.
/* global KidsI18n, KidsAudio, KidsStore, KidsFx, Mascots */
export const I18N = () => (typeof KidsI18n !== "undefined" ? KidsI18n : null);
export const AUDIO = () =>
  typeof KidsAudio !== "undefined" ? KidsAudio : null;
export const STORE = () =>
  typeof KidsStore !== "undefined" ? KidsStore : null;
export const FX = () => (typeof KidsFx !== "undefined" ? KidsFx : null);
export const MASCOTS = () => (typeof Mascots !== "undefined" ? Mascots : null);
