import type { MetadatosActivo } from "../../catalog/types";

export type TipoActivo = "personaje" | "fondo" | "objeto";

/** Una fila del índice — une el `assetRef` real (la clave que usan
 * PERSONAJES_VECTOR/FONDOS_VECTOR/OBJETOS_VECTOR, library/registry.ts) con sus
 * metadatos de catálogo. Solo existen entradas para activos que SÍ declaran
 * `metadatos` — no es retroactivo (ver MetadatosActivo en catalog/types.ts). */
export interface EntradaRegistro {
  assetRef: string;
  tipo: TipoActivo;
  metadatos: MetadatosActivo;
}
