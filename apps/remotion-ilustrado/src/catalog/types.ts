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
  /** Metadatos de registro (Fase 6) — mismo campo que PersonajeDef, ver
   * MetadatosActivo. Opcional, mismo criterio: no retroactivo a la fuerza. */
  metadatos?: MetadatosActivo;
  capas: CapaFondo[];
  luces?: LuzDef[];
  humoOrigen?: { x: number; y: number; depth: number };
}

/**
 * Metadatos de catálogo (equivalente a `AssetDefinition` de
 * docs/PROJECT_ROADMAP.md Fase 1, sección 4.2 del plan maestro) — primera semilla
 * del registro de activos real. Opcional a propósito: los 3 personajes existentes
 * (tito/rocco/lucia) no lo tenían y deben seguir compilando/renderizando igual;
 * se puebla hacia adelante, no retroactivamente a la fuerza.
 */
export interface MetadatosActivo {
  /** Identificador único y estable del activo, ej. "character_human_lucia_001" —
   * distinto del `id` de instancia en escena (ese se repite por instancia; este no). */
  id: string;
  version: number;
  tags: string[];
  /** Qué puede hacer este activo (qué animaciones/slots soporta) — hoy es
   * descriptivo únicamente, todavía no hay un validador que lo cruce contra la
   * biblioteca de animaciones (eso llega en la Fase 5/6 del roadmap). */
  capabilities: string[];
  descripcion?: string;
}

/** Definición de un personaje del catálogo (assets/2d/personajes/<id>/puppet.json en
 * producción). Los mocks de desarrollo solo traen colorPlaceholder/pivotes (sin
 * partes reales, CharacterPuppet cae a placeholders); el catálogo real sincronizado
 * desde los Asset aprobados agrega cuerpo/cabeza/.../bocas/prop con `src` real. */
export interface PersonajeDef {
  id: string;
  /** Metadatos de registro (Fase 1) — opcional por ahora, ver MetadatosActivo. */
  metadatos?: MetadatosActivo;
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
  apendice?: ParteVisual;
}

/** Definición de un objeto/prop reutilizable del catálogo (library/objetos/) —
 * mismo patrón que FondoDef/PersonajeDef. A diferencia de esos dos, un objeto es
 * una sola `ParteVisual` (sin partes compuestas) — ver PreviewObjeto.tsx, que ya
 * renderiza `def.render?.(ctx)` directo. `metadatos` es lo que faltaba para que
 * engine/registry pueda indexar objetos por tag/capacidad (antes OBJETOS_VECTOR
 * era `Record<string, ParteVisual>` puro, sin ningún lugar donde guardar tags). */
export interface ObjetoDef extends ParteVisual {
  id: string;
  metadatos?: MetadatosActivo;
}

/** Describe UN parámetro que acepta una familia paramétrica (Fase C, docs/
 * PROJECT_ROADMAP.md) — lo que el dashboard necesita para dibujar el formulario
 * de creación sin hardcodear nada por familia nueva que se agregue. */
export interface ParametroSchema {
  tipo: "enum" | "color" | "texto";
  /** Solo para tipo "enum" — opciones válidas, en el orden en que se muestran. */
  opciones?: string[];
  etiqueta: string;
  porDefecto: string;
}

export type ParametrosSchema = Record<string, ParametroSchema>;

/** Catálogo real completo, tal como lo escribe
 * apps/web/app/pipeline_runner.py::preparar_catalogo_remotion() antes de invocar
 * `remotion render` — ver EpisodioCompleto.tsx. */
export interface CatalogoReal {
  fondos: Record<string, FondoDef>;
  personajes: Record<string, PersonajeDef>;
  lineasAudio: Record<string, { palabras: unknown[]; visemas: Segmento[]; archivo?: string; fuente?: string }>;
}
