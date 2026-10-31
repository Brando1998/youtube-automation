import type React from "react";
import type { LuzDef } from "../components/FlickerLight";
import type { ParteVisual, Pivote, Segmento, VisemaCode } from "../components/CharacterPuppet";

export type { ParteVisual };

/** Una capa de un fondo (cielo/lejano/medio/suelo/primer_plano). Dos formas posibles:
 * `render()` (closure, usado por los catálogos mock de desarrollo/Prueba*, no
 * serializable) o `src` (ruta relativa a public/, usado por el catálogo real
 * sincronizado desde los Asset aprobados — Fase A5/render_episodio, serializable
 * vía --props de `remotion render`). TomaIlustrada usa `src` si está, si no cae a
 * `render()`. */
export interface CapaFondo {
  id: string;
  depth: number;
  render?: () => React.ReactNode;
  src?: string;
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
 * producción). Los mocks de desarrollo solo traen colorPlaceholder/pivotes (sin
 * partes reales, CharacterPuppet cae a placeholders); el catálogo real sincronizado
 * desde los Asset aprobados agrega cuerpo/cabeza/.../bocas/prop con `src` real. */
export interface PersonajeDef {
  id: string;
  colorPlaceholder?: string;
  cabezaPivot?: Pivote;
  propPivot?: Pivote;
  apendicePivot?: Pivote;
  cuerpo?: ParteVisual;
  cabeza?: ParteVisual;
  ojosAbiertos?: ParteVisual;
  ojosCerrados?: ParteVisual;
  cejas?: ParteVisual;
  bocas?: Partial<Record<VisemaCode, ParteVisual>>;
  prop?: ParteVisual;
}

/** Catálogo real completo, tal como lo escribe
 * apps/web/app/pipeline_runner.py::preparar_catalogo_remotion() antes de invocar
 * `remotion render` — ver EpisodioCompleto.tsx. */
export interface CatalogoReal {
  fondos: Record<string, FondoDef>;
  personajes: Record<string, PersonajeDef>;
  lineasAudio: Record<string, { palabras: unknown[]; visemas: Segmento[]; archivo?: string; fuente?: string }>;
}
