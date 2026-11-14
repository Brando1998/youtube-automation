/**
 * Cerebro — ícono simple de la biblioteca de objetos (Fase B del plan de
 * "detectar necesidades"). A propósito MUY simple (R4 del plan maestro: menos
 * detalle sintético, nada de piezas decorativas ambiguas) — un óvalo + línea
 * central + un par de trazos cortos sugiriendo circunvoluciones, nada de
 * intentar anatomía realista.
 */
import type { ObjetoDef } from "../../catalog/types";
import { contorno, TRAZO } from "../styleTokens";

export const ASSET_REF = "2d/objetos/cerebro";

const COLOR = "#E8A9C0";
const LINEA = "#B06E8A";

export const CEREBRO: Omit<ObjetoDef, "id"> = {
  metadatos: {
    id: "object_brain_001",
    version: 1,
    tags: ["objeto", "cerebro", "mente", "pensamiento", "ideas", "estres"],
    capabilities: [],
    descripcion: "Cerebro simple — ícono genérico para temas de mente/pensamiento en videos explicativos.",
  },
  render: () => (
    <g>
      <ellipse cx={0} cy={0} rx={30} ry={22} fill={COLOR} {...contorno(TRAZO.medio)} />
      <path d="M0,-20 Q-4,0 0,20" fill="none" stroke={LINEA} strokeWidth={2} strokeLinecap="round" />
      <path d="M-18,-10 Q-10,-4 -16,4" fill="none" stroke={LINEA} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M16,-10 Q10,-2 18,6" fill="none" stroke={LINEA} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  ),
};
