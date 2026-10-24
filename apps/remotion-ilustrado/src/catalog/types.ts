import type React from "react";
import type { LuzDef } from "../components/FlickerLight";
import type { Pivote } from "../components/CharacterPuppet";

/** Una capa de un fondo (cielo/lejano/medio/suelo/primer_plano) — hoy renderiza un
 * placeholder SVG; en producción (Fase A5) `render` devolverá un <image> con el PNG
 * generado, misma interfaz, sin tocar el resto del renderer. */
export interface CapaFondo {
  id: string;
  depth: number;
  render: () => React.ReactNode;
}

/** Definición de un fondo del catálogo (assets/2d/fondos/<id>/fondo.json en
 * producción) — capas en profundidad, puntos de luz, y origen de humo si aplica. */
export interface FondoDef {
  id: string;
  capas: CapaFondo[];
  luces?: LuzDef[];
  humoOrigen?: { x: number; y: number; depth: number };
}

/** Definición de un personaje del catálogo (assets/2d/personajes/<id>/puppet.json en
 * producción) — por ahora solo pivotes + color placeholder; las partes reales
 * (src de cada PNG) se agregan sin cambiar esta forma cuando exista el arte (Fase A4). */
export interface PersonajeDef {
  id: string;
  colorPlaceholder: string;
  cabezaPivot?: Pivote;
  propPivot?: Pivote;
  apendicePivot?: Pivote;
}
