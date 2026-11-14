// GENERADO por scripts/generar_registry.mjs — no editar a mano.
// Resuelve los assets vectoriales de la biblioteca (library/) por su asset_ref,
// para que EpisodeRenderer/EpisodioCompleto los usen aunque --props no los traiga
// (remotion render necesita JSON puro, un componente de React no se serializa).
import type { FondoDef, ObjetoDef, PersonajeDef } from "../catalog/types";

import { ASSET_REF as REF_0, LUCIA as DEF_0 } from "./personajes/lucia";
import { ASSET_REF as REF_1, PERSONA_GENERICA as DEF_1 } from "./personajes/persona-generica";
import { ASSET_REF as REF_2, ROCCO as DEF_2 } from "./personajes/rocco";
import { ASSET_REF as REF_3, TITO as DEF_3 } from "./personajes/tito";
import { ASSET_REF as REF_4, BOSQUE as DEF_4 } from "./fondos/bosque";
import { ASSET_REF as REF_5, CEREBRO as DEF_5 } from "./objetos/cerebro";
import { ASSET_REF as REF_6, CORAZON as DEF_6 } from "./objetos/corazon";

export const PERSONAJES_VECTOR: Record<string, Omit<PersonajeDef, "id">> = {
  [REF_0]: DEF_0,
  [REF_1]: DEF_1,
  [REF_2]: DEF_2,
  [REF_3]: DEF_3,
};

export const FONDOS_VECTOR: Record<string, Omit<FondoDef, "id">> = {
  [REF_4]: DEF_4,
};

export const OBJETOS_VECTOR: Record<string, Omit<ObjetoDef, "id">> = {
  [REF_5]: DEF_5,
  [REF_6]: DEF_6,
};
