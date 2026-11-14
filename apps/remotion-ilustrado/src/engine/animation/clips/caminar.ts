import type { ClipAnimacion } from "../types";

/**
 * "Caminar" (walk) — ciclo de UNA pierna (sección 8.1). Huesos genéricos
 * "muslo"/"pantorrilla" (ver engine/rig). Hace loop. Para la pierna contraria,
 * aplicar el mismo clip con un desfase de medio ciclo (duracionFrames/2) — el
 * caminar real alterna las piernas, eso lo decide quien use el clip, no el clip
 * mismo (section 8.2 del plan maestro: un clip no conoce cuántas piernas hay).
 */
export const CLIP_CAMINAR: ClipAnimacion = {
  id: "caminar",
  categoria: "locomocion",
  duracionFrames: 24,
  loop: true,
  pistas: [
    {
      huesoId: "muslo",
      claves: [
        { frame: 0, angulo: 70 },
        { frame: 12, angulo: 110 },
        { frame: 24, angulo: 70 },
      ],
    },
    {
      huesoId: "pantorrilla",
      claves: [
        { frame: 0, angulo: 0 },
        { frame: 6, angulo: -50 },
        { frame: 12, angulo: 0 },
        { frame: 18, angulo: -20 },
        { frame: 24, angulo: 0 },
      ],
    },
  ],
};
