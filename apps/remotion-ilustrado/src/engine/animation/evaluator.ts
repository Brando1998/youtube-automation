/**
 * Evaluador de clips (Fase 5) — determinista: mismo clip + mismo frame, mismo
 * resultado siempre (sin estado acumulado), igual que evaluarFK. Interpolación
 * lineal entre claves por ahora (REGLAS.md/Fase 2: nada de curvas adivinadas —
 * lineal es la única interpolación sin parámetros que "ajustar a ojo"; easing más
 * elaborado es una extensión futura explícita, no una sorpresa implícita).
 */
import type { ClaveAngular, ClipAnimacion } from "./types";

function validarClaves(claves: ClaveAngular[], huesoId: string, clipId: string) {
  if (claves.length < 2) {
    throw new Error(`evaluarClip: la pista de "${huesoId}" en el clip "${clipId}" tiene ${claves.length} clave(s) — hacen falta al menos 2 para interpolar.`);
  }
  for (let i = 1; i < claves.length; i++) {
    if (claves[i].frame <= claves[i - 1].frame) {
      throw new Error(
        `evaluarClip: las claves de "${huesoId}" en el clip "${clipId}" deben estar en orden estrictamente creciente de frame — ` +
          `"${claves[i - 1].frame}" seguido de "${claves[i].frame}".`
      );
    }
  }
}

function interpolarPista(claves: ClaveAngular[], frame: number): number {
  if (frame <= claves[0].frame) return claves[0].angulo;
  const ultima = claves[claves.length - 1];
  if (frame >= ultima.frame) return ultima.angulo;
  for (let i = 1; i < claves.length; i++) {
    const a = claves[i - 1];
    const b = claves[i];
    if (frame <= b.frame) {
      const t = (frame - a.frame) / (b.frame - a.frame);
      return a.angulo + (b.angulo - a.angulo) * t;
    }
  }
  return ultima.angulo; // inalcanzable si validarClaves pasó, defensivo igual
}

/**
 * Ángulo de cada hueso (`huesoId -> grados`) que el clip produce en `frameGlobal`.
 * Si `clip.loop`, `frameGlobal` se envuelve con módulo; si no, se recorta al
 * último frame (el clip "se queda" en su pose final, no se reinicia de golpe).
 */
export function evaluarClip(clip: ClipAnimacion, frameGlobal: number): Record<string, number> {
  if (clip.duracionFrames <= 0) {
    throw new Error(`evaluarClip: "${clip.id}" tiene duracionFrames=${clip.duracionFrames} — debe ser mayor que 0.`);
  }
  const frameLocal = clip.loop ? ((frameGlobal % clip.duracionFrames) + clip.duracionFrames) % clip.duracionFrames : Math.min(Math.max(frameGlobal, 0), clip.duracionFrames);
  const angulos: Record<string, number> = {};
  for (const pista of clip.pistas) {
    validarClaves(pista.claves, pista.huesoId, clip.id);
    angulos[pista.huesoId] = interpolarPista(pista.claves, frameLocal);
  }
  return angulos;
}

/**
 * Combina varias evaluaciones (de distintos clips/capas) en un solo mapa de
 * ángulos — por ahora "el último gana" por hueso (sección 8.3 del plan maestro:
 * capas simples), no una mezcla ponderada. Sirve para componer, p.ej., un clip de
 * "hablar" (afecta cabeza/boca) sobre un clip de "caminar" (afecta piernas) sin que
 * se pisen, porque animan huesos distintos — si DOS clips tocan el MISMO hueso, el
 * que está más a la derecha en la lista gana (mayor prioridad).
 */
export function combinarClips(...evaluaciones: Record<string, number>[]): Record<string, number> {
  return Object.assign({}, ...evaluaciones);
}
