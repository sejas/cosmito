// Texts owned by the kit itself (fallback screens, chips, toasts). Games keep
// their own dictionaries; see 3d/README.md. Uses the shared KidsI18n.
import { I18N } from "./shared.js";
export const KIT_DICT = {
  en: {
    noWebglTitle: "Oops! No 3D here",
    noWebglBody:
      "This device or browser can't show the 3D world. The classic games work everywhere!",
    playClassic: "▶ Play the classic version",
    slowTitle: "Running a bit slow?",
    slowBody: "The classic version is lighter and just as fun.",
    tryClassic: "Try classic",
    close: "Close",
    soundOn: "🔊 Sound",
    soundOff: "🔇 Muted",
    soundLabel: "Sound on or off",
    langLabel: "Change language",
    buddyLabel: "Change buddy",
    classic: "Classic 2D",
    classicLabel: "Open the classic 2D version",
    home: "Home",
    homeLabel: "Back to the 3D island",
  },
  es: {
    noWebglTitle: "¡Vaya! Aquí no hay 3D",
    noWebglBody:
      "Este dispositivo o navegador no puede mostrar el mundo 3D. ¡Los juegos clásicos funcionan en todas partes!",
    playClassic: "▶ Jugar a la versión clásica",
    slowTitle: "¿Va un poco lento?",
    slowBody: "La versión clásica es más ligera e igual de divertida.",
    tryClassic: "Probar la clásica",
    close: "Cerrar",
    soundOn: "🔊 Sonido",
    soundOff: "🔇 Silencio",
    soundLabel: "Activar o quitar el sonido",
    langLabel: "Cambiar idioma",
    buddyLabel: "Cambiar de amigo",
    classic: "Clásico 2D",
    classicLabel: "Abrir la versión clásica en 2D",
    home: "Inicio",
    homeLabel: "Volver a la isla 3D",
  },
};

export const kt = (key, ...args) => I18N().t(KIT_DICT, key, ...args);
