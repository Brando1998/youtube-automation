/**
 * Tipos del sistema de rig (Fase 4, docs/PROJECT_ROADMAP.md) — jerarquía de
 * articulaciones independiente de la geometría (primitives.tsx) y de cómo se
 * pinta (ParteVisual/CharacterPuppet). Un hueso NO es una forma dibujada: es
 * longitud + radios + relación con su padre. Quien lo dibuja decide el color.
 */

/** Una articulación/hueso dentro de una jerarquía. `padreId` ausente = raíz. */
export interface Articulacion {
  id: string;
  padreId?: string;
  /** distancia del extremo proximal (unido al padre) al distal (donde cuelga el
   * siguiente hueso) */
  longitud: number;
  /** ángulo local de reposo (grados), relativo a la orientación acumulada del
   * padre — 0° = misma dirección que el padre. */
  anguloReposo: number;
  radioProximal: number;
  radioDistal: number;
}

/** Posición + orientación acumulada (grados, mundo) de un extremo de hueso. */
export interface PoseMundo {
  x: number;
  y: number;
  anguloMundo: number;
}

/** Pose resuelta de un hueso: dónde están sus 2 extremos en el mundo. */
export interface PoseHueso {
  proximal: PoseMundo;
  distal: PoseMundo;
}
