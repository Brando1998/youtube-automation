/**
 * Registro de clips por id (Fase 7/8, docs/PROJECT_ROADMAP.md) — resuelve el
 * string que puede venir en un episode_spec (`toma.render.ilustrado
 * .personajes_en_escena[].gesto.clip_id`, ver episode_spec/schema.json) a un
 * `ClipAnimacion` real. Vive aparte de cada archivo de clip individual para que
 * agregar un clip nuevo sea "crear el archivo + agregarlo aquí", no tocar el
 * motor de escenas.
 */
import { CLIP_CAMINAR } from "./caminar";
import { CLIP_SALUDAR } from "./saludar";
import { CLIP_SENALAR } from "./senalar";
import type { ClipAnimacion } from "../types";

const CLIPS: ClipAnimacion[] = [CLIP_SALUDAR, CLIP_CAMINAR, CLIP_SENALAR];

const POR_ID: Record<string, ClipAnimacion> = Object.fromEntries(CLIPS.map((c) => [c.id, c]));

export function buscarClip(id: string): ClipAnimacion | undefined {
  return POR_ID[id];
}

export function todosLosClips(): ClipAnimacion[] {
  return CLIPS;
}
