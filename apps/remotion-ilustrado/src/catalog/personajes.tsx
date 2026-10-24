import type { PersonajeDef } from "./types";

/**
 * Catálogo de personajes — "lucia" mock (mismo id que `asset_ref` en
 * episode_spec/ejemplo_15s.json), con placeholders del puppet (sin partes reales
 * todavía, Fase A4 bloqueada). Cuando existan los PNG de cada parte, se agregan a
 * esta entrada sin cambiar el renderer.
 */
export const PERSONAJES: Record<string, PersonajeDef> = {
  "2d/personajes/lucia": {
    id: "2d/personajes/lucia",
    colorPlaceholder: "#E4AA2F",
  },
};
