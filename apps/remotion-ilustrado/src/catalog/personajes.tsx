import type { PersonajeDef } from "./types";

/**
 * Catálogo de personajes "escritos a mano" (JSON/datos reales, camino PNG+Stability
 * de la vieja Fase A4 — bloqueada, ver docs/PROGRESS.md "Pausa de costos AWS").
 * Vacío a propósito: la entrada "2d/personajes/lucia" que vivía aquí era un
 * placeholder sin partes reales (solo `colorPlaceholder`) que TAPABA el fallback de
 * EpisodeRenderer.tsx a `PERSONAJES_VECTOR` (biblioteca de código, library/registry.ts
 * — el camino real desde el pivote a assets vectoriales, ver
 * docs/PROJECT_ROADMAP.md) — con la entrada presente, `personajesCatalogo[ref] ??
 * (personajeVector ? ... )` nunca llegaba a usar la Lucía real con rig/clips/cara,
 * aunque ya existiera. Detectado verificando la Fase 7 (conectar clips al spec):
 * PruebaEpisodeSpec/PruebaAudioReal mostraban el placeholder genérico en vez de
 * Lucía real. Si en el futuro vuelve a haber personajes reales por esta vía (PNG),
 * se agregan aquí con sus partes completas, no solo un color.
 */
export const PERSONAJES: Record<string, PersonajeDef> = {};
