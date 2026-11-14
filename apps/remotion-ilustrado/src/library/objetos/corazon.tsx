/**
 * Corazón — ícono simple de la biblioteca de objetos (Fase B del plan de
 * "detectar necesidades", docs/PROJECT_ROADMAP.md). Construido con 2 círculos
 * reales (los lóbulos superiores) + 2 líneas rectas hacia la punta — misma
 * preferencia por geometría exacta que el resto de la biblioteca (nunca una
 * curva Bézier adivinada a ojo), aunque esta regla (R1 de REGLAS.md) nació para
 * piezas que deben fundirse con un cuerpo — un ícono suelto no tiene esa
 * restricción, pero la geometría exacta sigue siendo más simple de verificar
 * que ajustar puntos de control a mano.
 */
import type { ObjetoDef } from "../../catalog/types";
import { contorno, TRAZO } from "../styleTokens";

export const ASSET_REF = "2d/objetos/corazon";

const COLOR = "#D94B4B";

export const CORAZON: Omit<ObjetoDef, "id"> = {
  metadatos: {
    id: "object_heart_001",
    version: 1,
    tags: ["objeto", "corazon", "salud", "emocion", "amor", "latido"],
    capabilities: [],
    descripcion: "Corazón simple — ícono genérico para temas de salud/emoción en videos explicativos.",
  },
  render: () => (
    <path
      d="M-30,-5 A15,15 0 1 1 0,-5 A15,15 0 1 1 30,-5 L0,35 Z"
      fill={COLOR}
      {...contorno(TRAZO.medio)}
    />
  ),
};
