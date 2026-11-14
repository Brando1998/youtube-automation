/**
 * Persona genérica — primer personaje "sin nombre" de la biblioteca (Fase B del
 * plan de "detectar necesidades", docs/PROJECT_ROADMAP.md): para cuando un guion
 * dice simplemente "una persona" sin más detalle (video explicativo, no un
 * personaje recurrente con nombre propio como Lucía). A propósito MÁS SIMPLE que
 * Lucía: sin rig articulado (brazos/piernas estáticos, misma técnica de geometría
 * exacta pero sin huesos/clips) — un fondo genérico no necesita posarse, y agregar
 * rig sin un caso real que lo pida sería adelantarse de más.
 *
 * Reusa primitives.tsx al máximo (OjoAlmendra/OjoCerrado/Ceja/bocasDesdeForma, las
 * mismas piezas genéricas que ya usa Tito) en vez de inventar cara nueva.
 */
import type { PersonajeDef } from "../../catalog/types";
import { Ceja, construirTorso, FormaAhusada, OjoAlmendra, OjoCerrado, bocasDesdeForma, type MedidasTorso } from "../primitives";
import { contorno, PALETA, TRAZO } from "../styleTokens";

export const ASSET_REF = "2d/personajes/persona-generica";

const PIEL = PALETA.piel.clara;
const PELO = "#4A3B35";
const CAMISA = PALETA.acento.frio;
const PANTALON = PALETA.terreno.medio;
const ZAPATO = PALETA.contorno;
const CONTORNO = PALETA.contorno;

const CABEZA_X = 0;
const CABEZA_Y = -225;
const CABEZA_R = 48;

const MEDIDAS_TORSO: MedidasTorso = {
  caderaY: -95,
  anchoCaderaMitad: 34,
  anchoTorsoSuperiorMitad: 44,
  anchoCuelloMitad: 19,
  hombro: { x: 32, y: -175, r: 15 },
};

/** Brazo/pierna ESTÁTICOS (sin rig/FK a propósito, ver comentario de arriba) —
 * misma técnica de geometría exacta (FormaAhusada, R1 de REGLAS.md) que el resto
 * de la biblioteca, con un cap circular en el hombro para tapar la unión con el
 * torso (mismo criterio de la Fase 4: cap CON contorno en articulación terminal
 * visible contra el torso). */
function Brazo({ signo }: { signo: 1 | -1 }) {
  const base = { x: signo * MEDIDAS_TORSO.hombro.x, y: MEDIDAS_TORSO.hombro.y, r: MEDIDAS_TORSO.hombro.r };
  const punta = { x: signo * (MEDIDAS_TORSO.hombro.x + 6), y: -100, r: 9 };
  return (
    <g>
      <FormaAhusada baseX={base.x} baseY={base.y} baseR={base.r} puntaX={punta.x} puntaY={punta.y} puntaR={punta.r} color={CAMISA} />
      <circle cx={punta.x} cy={punta.y + 4} r={9} fill={PIEL} stroke={CONTORNO} strokeWidth={2.5} />
      <circle cx={base.x} cy={base.y} r={base.r} fill={CAMISA} stroke={CONTORNO} strokeWidth={3} />
    </g>
  );
}

function Pierna({ signo }: { signo: 1 | -1 }) {
  const base = { x: signo * 18, y: MEDIDAS_TORSO.caderaY, r: 17 };
  const punta = { x: signo * 20, y: -10, r: 12 };
  return (
    <g>
      <FormaAhusada baseX={base.x} baseY={base.y} baseR={base.r} puntaX={punta.x} puntaY={punta.y} puntaR={punta.r} color={PANTALON} />
      <ellipse cx={punta.x} cy={punta.y + 6} rx={15} ry={8} fill={ZAPATO} />
    </g>
  );
}

function Torso() {
  const d = construirTorso(MEDIDAS_TORSO);
  return <path d={d} fill={CAMISA} {...contorno(TRAZO.grueso)} />;
}

function Cuello() {
  return <rect x={-14} y={-185} width={28} height={13} rx={4} fill={PIEL} stroke={CONTORNO} strokeWidth={2.5} />;
}

function Pelo() {
  return <path d={`M${-CABEZA_R} ${CABEZA_Y - 4} A${CABEZA_R} ${CABEZA_R} 0 0 1 ${CABEZA_R} ${CABEZA_Y - 4} L${CABEZA_R} ${CABEZA_Y - 18} A${CABEZA_R} ${CABEZA_R * 0.6} 0 0 0 ${-CABEZA_R} ${CABEZA_Y - 18} Z`} fill={PELO} stroke={CONTORNO} strokeWidth={2.5} />;
}

export const PERSONA_GENERICA: Omit<PersonajeDef, "id"> = {
  metadatos: {
    id: "character_human_generic_001",
    version: 1,
    tags: ["personaje", "humano", "biped", "persona", "generico"],
    capabilities: ["idle", "blink"],
    descripcion: "Persona genérica sin nombre — para guiones que mencionan 'una persona' sin más detalle (videos explicativos), sin rig articulado.",
  },
  colorPlaceholder: CAMISA,
  cabezaPivot: { x: CABEZA_X, y: CABEZA_Y },
  apendice: { render: () => null },
  prop: { render: () => null },

  cuerpo: {
    render: () => (
      <g>
        <Pierna signo={-1} />
        <Pierna signo={1} />
        <Torso />
        <Brazo signo={-1} />
        <Brazo signo={1} />
        <Cuello />
      </g>
    ),
  },

  cabeza: {
    render: () => (
      <g>
        <Pelo />
        <circle cx={CABEZA_X} cy={CABEZA_Y} r={CABEZA_R} fill={PIEL} stroke={CONTORNO} strokeWidth={3} />
      </g>
    ),
  },

  ojosAbiertos: {
    render: () => (
      <g>
        <OjoAlmendra cx={-16} cy={CABEZA_Y} />
        <OjoAlmendra cx={16} cy={CABEZA_Y} />
      </g>
    ),
  },
  ojosCerrados: {
    render: () => (
      <g>
        <OjoCerrado cx={-16} cy={CABEZA_Y} />
        <OjoCerrado cx={16} cy={CABEZA_Y} />
      </g>
    ),
  },

  cejas: {
    render: () => (
      <g>
        <Ceja cx={-16} cy={CABEZA_Y - 14} />
        <Ceja cx={16} cy={CABEZA_Y - 14} />
      </g>
    ),
  },

  bocas: bocasDesdeForma(CABEZA_X, CABEZA_Y + 22),
};
