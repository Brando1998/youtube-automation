import type { ClipAnimacion } from "../types";

/**
 * "Señalar" (point) — gesto de un solo brazo (sección 8.1 del plan maestro).
 * Huesos genéricos "brazo"/"antebrazo" (ver engine/rig), misma convención de
 * ángulos "lado derecho" que CLIP_SALUDAR (reflejar con 180-angulo para el lado
 * izquierdo). A diferencia de CLIP_SALUDAR (antebrazo se agita), aquí el
 * antebrazo se queda RECTO durante todo el gesto — es lo que distingue "señalar"
 * de "saludar": el brazo se levanta y se mantiene extendido, sin agitar.
 *
 * No hace loop: sube y extiende, mantiene, vuelve a reposo.
 */
export const CLIP_SENALAR: ClipAnimacion = {
  id: "senalar",
  categoria: "gesto",
  duracionFrames: 40,
  loop: false,
  pistas: [
    {
      huesoId: "brazo",
      claves: [
        { frame: 0, angulo: 80 },
        { frame: 10, angulo: -20 },
        { frame: 30, angulo: -20 },
        { frame: 40, angulo: 80 },
      ],
    },
    {
      huesoId: "antebrazo",
      claves: [
        { frame: 0, angulo: 0 },
        { frame: 40, angulo: 0 },
      ],
    },
  ],
};
