/**
 * Clips de animación (Fase 5, docs/PROJECT_ROADMAP.md) — movimientos como DATOS,
 * independientes de cualquier personaje. Un clip de "caminar" no conoce las
 * coordenadas de Lucía: solo dice "el hueso con este ID va a este ángulo en este
 * frame" — cualquier biped cuyos huesos usen los mismos IDs (p.ej. "muslo"/
 * "pantorrilla", ver engine/rig) puede reproducirlo.
 */

/** Un punto de control: en el frame `frame` (dentro de la duración del clip,
 * 0-based), el hueso debe estar en `angulo` grados (locales, mismo significado que
 * `anguloReposo`/`angulosLocales` de engine/rig/fk.ts). */
export interface ClaveAngular {
  frame: number;
  angulo: number;
}

/** Una pista anima UN hueso (por su id) a lo largo del clip completo. */
export interface PistaAngular {
  huesoId: string;
  /** al menos 2 claves, ordenadas por `frame` ascendente — se valida al evaluar,
   * no se asume. */
  claves: ClaveAngular[];
}

export interface ClipAnimacion {
  id: string;
  categoria: "locomocion" | "gesto" | "expresion" | "objeto";
  duracionFrames: number;
  /** true = se repite indefinidamente (idle, walk); false = se reproduce una vez
   * y se queda en el último frame (wave, sit). */
  loop: boolean;
  pistas: PistaAngular[];
}
