/**
 * Familia "persona" (Fase C, docs/PROJECT_ROADMAP.md — opción 1 de "crear desde
 * la app") — misma geometría exacta que `library/personajes/persona-generica.tsx`
 * (Fase B), pero como FACTORY que recibe parámetros en vez de una definición fija.
 * Esto permite crear variantes nuevas (otro tono de piel, otro color de ropa)
 * desde el dashboard sin que cada una necesite su propio archivo de código
 * desplegado — el código (esta factory) es fijo y ya está probado; lo que varía
 * por instancia son valores simples (colores), no geometría nueva.
 *
 * `persona-generica.tsx` (Fase B) NO se reemplaza ni se borra — sigue siendo un
 * asset fijo válido de la biblioteca, esta familia es un camino aparte.
 */
import type { ParametrosSchema, PersonajeDef } from "../../catalog/types";
import { Ceja, construirTorso, FormaAhusada, OjoAlmendra, OjoCerrado, bocasDesdeForma, type MedidasTorso } from "../primitives";
import { contorno, PALETA, TRAZO } from "../styleTokens";

/** Id de familia — cumple el mismo rol que ASSET_REF en un asset fijo (lo busca
 * scripts/generar_registry.mjs con la misma regex), pero identifica una FACTORY,
 * no una definición ya armada. */
export const ASSET_REF = "familia/persona";
/** Para que scripts/generar_registry.mjs sepa en qué diccionario registrar esta
 * familia (FAMILIAS_PERSONAJE_VECTOR vs FAMILIAS_OBJETO_VECTOR) — ambos tipos de
 * familia conviven en el mismo directorio library/familias/. */
export const TIPO_FAMILIA = "personaje";

export interface ParametrosPersona {
  piel: "clara" | "media" | "oscura";
  ropa: string; // hex
}

// porDefecto de "ropa" es el valor literal de PALETA.acento.frio ("#3a4049") —
// no una referencia a PALETA: scripts/generar_registry.mjs extrae este objeto
// como texto y lo evalúa aislado (mismo mecanismo que ya usa para `metadatos`),
// solo puede contener literales puros, no imports.
export const PARAMETROS_SCHEMA: ParametrosSchema = {
  piel: { tipo: "enum", opciones: ["clara", "media", "oscura"], etiqueta: "Tono de piel", porDefecto: "clara" },
  ropa: { tipo: "color", etiqueta: "Color de ropa", porDefecto: "#3a4049" },
};

const TONOS_PIEL: Record<ParametrosPersona["piel"], string> = {
  clara: PALETA.piel.clara,
  media: PALETA.piel.media,
  oscura: PALETA.piel.sombra,
};

const CONTORNO = PALETA.contorno;
const PELO = "#4A3B35";
const PANTALON = PALETA.terreno.medio;
const ZAPATO = PALETA.contorno;

const CABEZA_X = 0;
const CABEZA_Y = -225;
const CABEZA_R = 48;

export function crearPersona(params: ParametrosPersona): Omit<PersonajeDef, "id"> {
  const piel = TONOS_PIEL[params.piel] ?? TONOS_PIEL.clara;
  const ropa = params.ropa || PALETA.acento.frio;

  const medidasTorso: MedidasTorso = {
    caderaY: -95,
    anchoCaderaMitad: 34,
    anchoTorsoSuperiorMitad: 44,
    anchoCuelloMitad: 19,
    hombro: { x: 32, y: -175, r: 15 },
  };

  function Brazo({ signo }: { signo: 1 | -1 }) {
    const base = { x: signo * medidasTorso.hombro.x, y: medidasTorso.hombro.y, r: medidasTorso.hombro.r };
    const punta = { x: signo * (medidasTorso.hombro.x + 6), y: -100, r: 9 };
    return (
      <g>
        <FormaAhusada baseX={base.x} baseY={base.y} baseR={base.r} puntaX={punta.x} puntaY={punta.y} puntaR={punta.r} color={ropa} />
        <circle cx={punta.x} cy={punta.y + 4} r={9} fill={piel} stroke={CONTORNO} strokeWidth={2.5} />
        <circle cx={base.x} cy={base.y} r={base.r} fill={ropa} stroke={CONTORNO} strokeWidth={3} />
      </g>
    );
  }

  function Pierna({ signo }: { signo: 1 | -1 }) {
    const base = { x: signo * 18, y: medidasTorso.caderaY, r: 17 };
    const punta = { x: signo * 20, y: -10, r: 12 };
    return (
      <g>
        <FormaAhusada baseX={base.x} baseY={base.y} baseR={base.r} puntaX={punta.x} puntaY={punta.y} puntaR={punta.r} color={PANTALON} />
        <ellipse cx={punta.x} cy={punta.y + 6} rx={15} ry={8} fill={ZAPATO} />
      </g>
    );
  }

  function Torso() {
    const d = construirTorso(medidasTorso);
    return <path d={d} fill={ropa} {...contorno(TRAZO.grueso)} />;
  }

  function Cuello() {
    return <rect x={-14} y={-185} width={28} height={13} rx={4} fill={piel} stroke={CONTORNO} strokeWidth={2.5} />;
  }

  function Pelo() {
    return (
      <path
        d={`M${-CABEZA_R} ${CABEZA_Y - 4} A${CABEZA_R} ${CABEZA_R} 0 0 1 ${CABEZA_R} ${CABEZA_Y - 4} L${CABEZA_R} ${CABEZA_Y - 18} A${CABEZA_R} ${CABEZA_R * 0.6} 0 0 0 ${-CABEZA_R} ${CABEZA_Y - 18} Z`}
        fill={PELO}
        stroke={CONTORNO}
        strokeWidth={2.5}
      />
    );
  }

  return {
    colorPlaceholder: ropa,
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
          <circle cx={CABEZA_X} cy={CABEZA_Y} r={CABEZA_R} fill={piel} stroke={CONTORNO} strokeWidth={3} />
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
}
