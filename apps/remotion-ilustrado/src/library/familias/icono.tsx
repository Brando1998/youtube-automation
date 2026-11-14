/**
 * Familia "icono" (Fase C) — misma geometría exacta que `library/objetos/
 * corazon.tsx` y `cerebro.tsx` (Fase B), como factory parametrizada por forma +
 * color en vez de 2 archivos fijos separados. Los archivos de Fase B NO se
 * borran (siguen siendo assets fijos válidos); esta familia es el camino para
 * crear una variante de color nueva sin escribir código.
 */
import type { ObjetoDef, ParametrosSchema } from "../../catalog/types";
import { contorno, TRAZO } from "../styleTokens";

export const ASSET_REF = "familia/icono";
/** Ver el mismo comentario en familias/persona.tsx. */
export const TIPO_FAMILIA = "objeto";

export interface ParametrosIcono {
  forma: "corazon" | "cerebro";
  color: string; // hex
}

export const PARAMETROS_SCHEMA: ParametrosSchema = {
  forma: { tipo: "enum", opciones: ["corazon", "cerebro"], etiqueta: "Forma", porDefecto: "corazon" },
  color: { tipo: "color", etiqueta: "Color principal", porDefecto: "#D94B4B" },
};

function Corazon({ color }: { color: string }) {
  return <path d="M-30,-5 A15,15 0 1 1 0,-5 A15,15 0 1 1 30,-5 L0,35 Z" fill={color} {...contorno(TRAZO.medio)} />;
}

function Cerebro({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={30} ry={22} fill={color} {...contorno(TRAZO.medio)} />
      <path d="M0,-20 Q-4,0 0,20" fill="none" stroke={contorno().stroke} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      <path d="M-18,-10 Q-10,-4 -16,4" fill="none" stroke={contorno().stroke} strokeWidth={1.8} strokeLinecap="round" opacity={0.5} />
      <path d="M16,-10 Q10,-2 18,6" fill="none" stroke={contorno().stroke} strokeWidth={1.8} strokeLinecap="round" opacity={0.5} />
    </g>
  );
}

export function crearIcono(params: ParametrosIcono): Omit<ObjetoDef, "id"> {
  const color = params.color || "#D94B4B";
  return {
    render: () => (params.forma === "cerebro" ? <Cerebro color={color} /> : <Corazon color={color} />),
  };
}
