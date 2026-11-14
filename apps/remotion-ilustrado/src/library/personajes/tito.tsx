/**
 * Tito, el erizo — primer personaje real de la biblioteca vectorial. Reemplaza el
 * intento con Stability (docs/PROGRESS.md, Fase F): mismo personaje, dibujado por
 * código en vez de generado como imagen.
 */
import type { PersonajeDef } from "../../catalog/types";
import { Ceja, CuerpoBlob, OjoAlmendra, OjoCerrado, bocasDesdeForma } from "../primitives";
import { contorno, PALETA, TRAZO } from "../styleTokens";

export const ASSET_REF = "2d/personajes/tito";

const PIEL = "#D9A872"; // tono cálido de cuerpo/cabeza
const PANZA = "#F1E3C6"; // tono claro de la panza/cara

const CABEZA_X = 0;
const CABEZA_Y = -190;
const CABEZA_R = 58;

/** Púas simples: triángulos fijos alrededor de la cabeza — determinista (sin
 * random), consistente con que Remotion puede renderizar frames fuera de orden. */
function Puas() {
  const angulos = [-150, -125, -100, -75, -50, -20, 10, 35, 60, 85, 110, 135, 160, -170];
  return (
    <>
      {angulos.map((grados, i) => {
        const rad = (grados * Math.PI) / 180;
        const r1 = CABEZA_R * 0.78;
        const r2 = CABEZA_R * 1.35;
        const x1 = CABEZA_X + r1 * Math.cos(rad);
        const y1 = CABEZA_Y + r1 * Math.sin(rad) - 8;
        const x2 = CABEZA_X + r2 * Math.cos(rad - 0.12);
        const y2 = CABEZA_Y + r2 * Math.sin(rad - 0.12) - 8;
        const x3 = CABEZA_X + r2 * Math.cos(rad + 0.12);
        const y3 = CABEZA_Y + r2 * Math.sin(rad + 0.12) - 8;
        const tono = i % 2 === 0 ? PALETA.madera.tronco : "#8a6238";
        return <path key={grados} d={`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3}Z`} fill={tono} {...contorno(TRAZO.fino)} />;
      })}
    </>
  );
}

function Hocico() {
  return (
    <g>
      <ellipse cx={CABEZA_X} cy={CABEZA_Y + 22} rx={34} ry={26} fill={PANZA} {...contorno(TRAZO.medio)} />
      <circle cx={CABEZA_X} cy={CABEZA_Y + 32} r={7} fill={PALETA.contorno} />
    </g>
  );
}

export const TITO: Omit<PersonajeDef, "id"> = {
  metadatos: {
    id: "character_hedgehog_tito_001",
    version: 1,
    tags: ["personaje", "animal", "erizo", "blob"],
    capabilities: ["idle", "blink", "talk", "look"],
    descripcion: "Erizo compacto tipo blob — primer personaje de la biblioteca vectorial.",
  },
  colorPlaceholder: PIEL,
  cabezaPivot: { x: CABEZA_X, y: CABEZA_Y },
  propPivot: { x: 55, y: -150 },
  apendicePivot: { x: -25, y: -210 },

  cuerpo: {
    render: () => (
      <g>
        <CuerpoBlob x={0} y={-10} w={150} h={160} color={PIEL} rx={60} />
        <ellipse cx={0} cy={-55} rx={46} ry={55} fill={PANZA} {...contorno(TRAZO.medio)} />
      </g>
    ),
  },

  cabeza: {
    render: () => (
      <g>
        <Puas />
        <circle cx={CABEZA_X} cy={CABEZA_Y} r={CABEZA_R} fill={PIEL} {...contorno()} />
        <Hocico />
      </g>
    ),
  },

  ojosAbiertos: {
    render: () => (
      <g>
        <OjoAlmendra cx={CABEZA_X - 20} cy={CABEZA_Y - 2} r={7} />
        <OjoAlmendra cx={CABEZA_X + 20} cy={CABEZA_Y - 2} r={7} />
      </g>
    ),
  },
  ojosCerrados: {
    render: () => (
      <g>
        <OjoCerrado cx={CABEZA_X - 20} cy={CABEZA_Y - 2} />
        <OjoCerrado cx={CABEZA_X + 20} cy={CABEZA_Y - 2} />
      </g>
    ),
  },

  cejas: {
    render: () => (
      <g>
        <Ceja cx={CABEZA_X - 20} cy={CABEZA_Y - 20} w={18} inclinacion={-10} />
        <Ceja cx={CABEZA_X + 20} cy={CABEZA_Y - 20} w={18} inclinacion={10} />
      </g>
    ),
  },

  bocas: bocasDesdeForma(CABEZA_X, CABEZA_Y + 36, "#7A3E2E"),

  prop: {
    render: () => (
      <g>
        <ellipse cx={0} cy={0} rx={13} ry={16} fill="#B5792E" {...contorno(TRAZO.fino)} />
        <path d="M-13 -6 Q0 -18 13 -6 Q0 -10 -13 -6Z" fill={PALETA.madera.sombra} {...contorno(TRAZO.fino)} />
      </g>
    ),
  },
};
