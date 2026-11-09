/**
 * Rocco, el perro — segundo personaje de la biblioteca vectorial. Mismo contrato
 * que tito.tsx (primitives.tsx + styleTokens.ts), para confirmar que el patrón
 * generaliza a un animal distinto antes de crecer la biblioteca en serio.
 */
import type { PersonajeDef } from "../../catalog/types";
import { Ceja, CuerpoBlob, FormaAhusada, OjoAlmendra, OjoCerrado, bocasDesdeForma } from "../primitives";
import { contorno, PALETA, TRAZO } from "../styleTokens";

export const ASSET_REF = "2d/personajes/rocco";

const PELAJE = "#B5742E"; // tono cálido de cuerpo/cabeza
const PANZA = "#F1E3C6"; // tono claro de panza/hocico, mismo valor que PANZA de Tito

const CABEZA_X = 0;
const CABEZA_Y = -170;
const CABEZA_R = 52;

/** Orejas caídas — una curva simple por lado, consistente con "menos detalle
 * sintético" (sin piezas decorativas ambiguas). */
function Orejas() {
  const lado = (signo: 1 | -1) => {
    const x0 = CABEZA_X + signo * CABEZA_R * 0.75;
    const y0 = CABEZA_Y - CABEZA_R * 0.35;
    return (
      <path
        d={`M${x0} ${y0} Q${x0 + signo * 28} ${y0 + 10} ${x0 + signo * 18} ${y0 + 55} Q${x0 + signo * 4} ${y0 + 58} ${x0 - signo * 4} ${y0 + 20}Z`}
        fill={PALETA.madera.tronco}
        {...contorno(TRAZO.medio)}
      />
    );
  };
  return (
    <>
      {lado(-1)}
      {lado(1)}
    </>
  );
}

function Hocico() {
  return (
    <g>
      <ellipse cx={CABEZA_X} cy={CABEZA_Y + 24} rx={30} ry={22} fill={PANZA} {...contorno(TRAZO.medio)} />
      <ellipse cx={CABEZA_X} cy={CABEZA_Y + 16} rx={10} ry={7} fill={PALETA.contorno} />
    </g>
  );
}

// El cuerpo (CuerpoBlob, rx=55) es casi una "pastilla": sus esquinas redondeadas
// ocupan casi todo el borde izquierdo/derecho, dejando muy poco borde recto. Usar
// el rectángulo exacto (con esquina) como máscara metía el círculo de la cola justo
// en la curva de la esquina, dando un recorte irregular. En vez de pelear con esa
// geometría, la máscara aproxima el cuerpo como una elipse (sin esquinas, borde
// siempre suave) y el centro del círculo base se pone EXACTO sobre esa elipse — así
// la mitad que se oculta y la que sobresale son siempre una curva limpia, sin
// importar el ángulo.
const CUERPO_ELIPSE = { cx: 0, cy: -76, rx: 75, ry: 60 };
const COLA_ANGULO = 160 * (Math.PI / 180); // abajo-izquierda
const COLA_BASE = {
  x: CUERPO_ELIPSE.cx + CUERPO_ELIPSE.rx * Math.cos(COLA_ANGULO),
  y: CUERPO_ELIPSE.cy + CUERPO_ELIPSE.ry * Math.sin(COLA_ANGULO),
  r: 26,
};
const COLA_PUNTA = { x: -138, y: -36, r: 9 };

export const ROCCO: Omit<PersonajeDef, "id"> = {
  colorPlaceholder: PELAJE,
  cabezaPivot: { x: CABEZA_X, y: CABEZA_Y },
  propPivot: { x: 50, y: -140 },
  apendicePivot: { x: COLA_BASE.x, y: COLA_BASE.y },

  // Sin patas sueltas — igual que Tito, el cuerpo-blob redondeado (rx=55) ya toca
  // el suelo con su propio borde, sin piezas desconectadas.
  cuerpo: {
    render: () => (
      <g>
        <CuerpoBlob x={0} y={-16} w={150} h={120} color={PELAJE} rx={55} />
        <ellipse cx={0} cy={-55} rx={40} ry={45} fill={PANZA} {...contorno(TRAZO.medio)} />
      </g>
    ),
  },

  // CharacterPuppet dibuja apendice DESPUÉS de cuerpo (encima) — sin recorte, el
  // arco de la base (adentro a propósito, ver COLA_BASE) se vería como una línea
  // suelta cruzando la panza. La máscara oculta justo la parte de la cola que cae
  // dentro de la silueta de CuerpoBlob, dejando solo lo que sobresale — la cola se
  // ve emerger del cuerpo en vez de flotar separada o cortar por encima.
  apendice: {
    render: () => (
      <>
        <defs>
          <mask id="rocco-cola-mask">
            <rect x={-400} y={-400} width={800} height={800} fill="white" />
            <ellipse cx={CUERPO_ELIPSE.cx} cy={CUERPO_ELIPSE.cy} rx={CUERPO_ELIPSE.rx} ry={CUERPO_ELIPSE.ry} fill="black" />
          </mask>
        </defs>
        <g mask="url(#rocco-cola-mask)">
          <FormaAhusada
            baseX={COLA_BASE.x}
            baseY={COLA_BASE.y}
            baseR={COLA_BASE.r}
            puntaX={COLA_PUNTA.x}
            puntaY={COLA_PUNTA.y}
            puntaR={COLA_PUNTA.r}
            color={PELAJE}
          />
        </g>
      </>
    ),
  },

  cabeza: {
    render: () => (
      <g>
        <Orejas />
        <circle cx={CABEZA_X} cy={CABEZA_Y} r={CABEZA_R} fill={PELAJE} {...contorno()} />
        <Hocico />
      </g>
    ),
  },

  ojosAbiertos: {
    render: () => (
      <g>
        <OjoAlmendra cx={CABEZA_X - 18} cy={CABEZA_Y - 4} r={6} />
        <OjoAlmendra cx={CABEZA_X + 18} cy={CABEZA_Y - 4} r={6} />
      </g>
    ),
  },
  ojosCerrados: {
    render: () => (
      <g>
        <OjoCerrado cx={CABEZA_X - 18} cy={CABEZA_Y - 4} w={12} />
        <OjoCerrado cx={CABEZA_X + 18} cy={CABEZA_Y - 4} w={12} />
      </g>
    ),
  },

  cejas: {
    render: () => (
      <g>
        <Ceja cx={CABEZA_X - 18} cy={CABEZA_Y - 22} w={14} inclinacion={-5} />
        <Ceja cx={CABEZA_X + 18} cy={CABEZA_Y - 22} w={14} inclinacion={5} />
      </g>
    ),
  },

  bocas: bocasDesdeForma(CABEZA_X, CABEZA_Y + 36, "#6E3420"),

  // Hueso tirado en el suelo junto a Rocco, claramente fuera del cuerpo (que termina
  // en x=75) — sin tocar ninguna otra pieza.
  prop: {
    render: () => (
      <g transform="translate(100 4)">
        <rect x={-13} y={-4} width={26} height={8} rx={4} fill={PANZA} {...contorno(TRAZO.fino)} />
        <circle cx={-13} cy={-5} r={5} fill={PANZA} {...contorno(TRAZO.fino)} />
        <circle cx={-13} cy={5} r={5} fill={PANZA} {...contorno(TRAZO.fino)} />
        <circle cx={13} cy={-5} r={5} fill={PANZA} {...contorno(TRAZO.fino)} />
        <circle cx={13} cy={5} r={5} fill={PANZA} {...contorno(TRAZO.fino)} />
      </g>
    ),
  },
};
