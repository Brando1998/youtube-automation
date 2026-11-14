/**
 * Registro de activos consultable (Fase 6, docs/PROJECT_ROADMAP.md) — capa de
 * búsqueda sobre `library/registry.ts` (que ya resuelve assetRef -> componente,
 * generado por scripts/generar_registry.mjs; eso NO se toca/reemplaza). Esta capa
 * agrega: buscar por id estable, por tipo, por tag, por capacidad — lo que pide la
 * sección 4.2 del plan maestro ("registrar, buscar por ID, por categoría, por
 * etiquetas, consultar capacidades").
 */
import { FONDOS_VECTOR, OBJETOS_VECTOR, PERSONAJES_VECTOR } from "../../library/registry";
import type { EntradaRegistro, TipoActivo } from "./types";

function construirIndice(): EntradaRegistro[] {
  const entradas: EntradaRegistro[] = [];
  for (const [assetRef, def] of Object.entries(PERSONAJES_VECTOR)) {
    if (def.metadatos) entradas.push({ assetRef, tipo: "personaje", metadatos: def.metadatos });
  }
  for (const [assetRef, def] of Object.entries(FONDOS_VECTOR)) {
    if (def.metadatos) entradas.push({ assetRef, tipo: "fondo", metadatos: def.metadatos });
  }
  for (const [assetRef, def] of Object.entries(OBJETOS_VECTOR)) {
    if (def.metadatos) entradas.push({ assetRef, tipo: "objeto", metadatos: def.metadatos });
  }
  return entradas;
}

export function todosLosActivos(): EntradaRegistro[] {
  return construirIndice();
}

export function buscarPorId(id: string): EntradaRegistro | undefined {
  return construirIndice().find((e) => e.metadatos.id === id);
}

export function buscarPorAssetRef(assetRef: string): EntradaRegistro | undefined {
  return construirIndice().find((e) => e.assetRef === assetRef);
}

export function buscarPorTipo(tipo: TipoActivo): EntradaRegistro[] {
  return construirIndice().filter((e) => e.tipo === tipo);
}

export function buscarPorTag(tag: string): EntradaRegistro[] {
  return construirIndice().filter((e) => e.metadatos.tags.includes(tag));
}

export function buscarPorCapacidad(capacidad: string): EntradaRegistro[] {
  return construirIndice().filter((e) => e.metadatos.capabilities.includes(capacidad));
}
