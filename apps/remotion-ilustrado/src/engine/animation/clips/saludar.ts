import type { ClipAnimacion } from "../types";

/**
 * "Saludar" (wave) — gesto de un solo brazo (sección 8.1 del plan maestro).
 * Huesos genéricos "brazo"/"antebrazo" (ver engine/rig) — cualquier biped con esos
 * IDs puede reproducirlo, no es específico de Lucía. Ángulos pensados para un
 * brazo cuyo reposo cuelga hacia abajo (~70-90°, convención "lado derecho" —
 * quien lo aplique a un lado izquierdo debe reflejar el ángulo, mismo criterio que
 * `anguloReposo` en lucia.tsx: `180 - angulo`).
 *
 * No hace loop: sube, agita el antebrazo 3 veces, vuelve a reposo.
 */
export const CLIP_SALUDAR: ClipAnimacion = {
  id: "saludar",
  categoria: "gesto",
  duracionFrames: 45,
  loop: false,
  pistas: [
    {
      huesoId: "brazo",
      claves: [
        { frame: 0, angulo: 80 },
        { frame: 10, angulo: -70 },
        { frame: 40, angulo: -70 },
        { frame: 45, angulo: 80 },
      ],
    },
    {
      huesoId: "antebrazo",
      claves: [
        { frame: 0, angulo: 0 },
        { frame: 10, angulo: -40 },
        { frame: 15, angulo: 10 },
        { frame: 20, angulo: -40 },
        { frame: 25, angulo: 10 },
        { frame: 30, angulo: -40 },
        { frame: 35, angulo: 0 },
        { frame: 45, angulo: 0 },
      ],
    },
  ],
};
