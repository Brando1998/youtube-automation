/**
 * Fondo "bosque" — primer fondo real de la biblioteca vectorial. Reemplaza el fondo
 * mock de catalog/fondos.tsx (desarrollo) con uno pensado para producción, mismo
 * criterio de capas/profundidad.
 */
import type { FondoDef } from "../../catalog/types";
import { Arbol, Colina, Techo, Ventana } from "../primitives";
import { contorno, PALETA, TRAZO } from "../styleTokens";

export const ASSET_REF = "2d/fondos/bosque";

const svgProps = {
  viewBox: "0 0 540 960",
  width: "100%",
  height: "100%",
  preserveAspectRatio: "xMidYMid slice" as const,
};

export const BOSQUE: Omit<FondoDef, "id"> = {
  capas: [
    {
      id: "cielo",
      depth: 0,
      render: () => (
        <svg {...svgProps}>
          <rect x={-80} y={-80} width={700} height={820} fill={PALETA.cielo.noche} />
          <circle cx={420} cy={170} r={44} fill={PALETA.cielo.luna} />
        </svg>
      ),
    },
    {
      id: "lejano",
      depth: 0.15,
      render: () => (
        <svg {...svgProps}>
          <Colina y={640} amplitud={60} tono={PALETA.terreno.lejano} />
        </svg>
      ),
    },
    {
      id: "medio",
      depth: 0.3,
      render: () => (
        <svg {...svgProps}>
          <Arbol x={80} y={760} alto={160} ancho={110} tono={PALETA.follaje.oscuro} />
          <Arbol x={450} y={780} alto={190} ancho={130} tono={PALETA.follaje.medio} />
          <Arbol x={260} y={740} alto={130} ancho={90} tono={PALETA.follaje.oscuro} />
        </svg>
      ),
    },
    {
      id: "cabana",
      depth: 0.5,
      render: () => (
        <svg {...svgProps}>
          <rect x={-80} y={780} width={700} height={260} fill={PALETA.terreno.suelo} />
          <rect x={395} y={670} width={95} height={110} fill={PALETA.madera.tabla} {...contorno(TRAZO.grueso)} />
          <Techo x={442} y={670} w={115} h={55} />
          <Ventana x={442} y={715} w={30} h={30} encendida />
        </svg>
      ),
    },
  ],
  luces: [
    { x: 420, y: 170, depth: 0, radio: 70, sprite: "cool", intensidad: 0.35, parpadeo: false },
    { x: 442, y: 715, depth: 0.5, radio: 55, sprite: "warm", intensidad: 0.4, parpadeo: true, seed: 2 },
  ],
  humoOrigen: { x: 457, y: 670, depth: 0.5 },
};
