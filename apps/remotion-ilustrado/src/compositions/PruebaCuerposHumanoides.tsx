import { AbsoluteFill } from "remotion";
import { construirTorsoYBrazos, type MedidasTorsoHumanoide } from "../library/primitives";
import { PALETA } from "../library/styleTokens";

/**
 * Prueba de genericidad del generador paramétrico (Fase 3, docs/PROJECT_ROADMAP.md):
 * 3 cuerpos de proporciones MUY distintas (delgado/medio/robusto) con la misma
 * función `construirTorsoYBrazos` — si alguno se autointerseca o deja huecos, es un
 * bug del generador, no de un personaje puntual. "medio" usa las medidas reales de
 * Lucía (library/personajes/lucia.tsx) para confirmar que coinciden.
 */
const PROTOTIPOS: { nombre: string; color: string; medidas: MedidasTorsoHumanoide }[] = [
  {
    nombre: "delgado",
    color: "#6A9FB5",
    medidas: {
      caderaY: -95,
      anchoCaderaMitad: 24,
      anchoTorsoSuperiorMitad: 30,
      anchoCuelloMitad: 14,
      hombro: { x: 24, y: -178, r: 12 },
      mano: { x: 48, y: -95, r: 8 },
    },
  },
  {
    nombre: "medio (Lucía)",
    color: PALETA.acento.calido,
    medidas: {
      caderaY: -95,
      anchoCaderaMitad: 38,
      anchoTorsoSuperiorMitad: 49.6,
      anchoCuelloMitad: 22,
      hombro: { x: 34, y: -180, r: 18 },
      mano: { x: 57, y: -99, r: 11 },
    },
  },
  {
    nombre: "robusto",
    color: "#B5703A",
    medidas: {
      caderaY: -95,
      anchoCaderaMitad: 58,
      anchoTorsoSuperiorMitad: 72,
      anchoCuelloMitad: 26,
      hombro: { x: 48, y: -182, r: 30 },
      mano: { x: 78, y: -100, r: 16 },
    },
  },
];

export function PruebaCuerposHumanoides() {
  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      <svg viewBox="0 0 540 960" width="100%" height="100%">
        {PROTOTIPOS.map((p, i) => {
          const d = construirTorsoYBrazos(p.medidas);
          const cx = 90 + i * 180;
          return (
            <g key={p.nombre} transform={`translate(${cx} 700)`}>
              <path d={d} fill={p.color} stroke={PALETA.contorno} strokeWidth={3} strokeLinejoin="round" />
              <text x={0} y={60} textAnchor="middle" fontSize={16} fill={PALETA.contorno} fontFamily="sans-serif">
                {p.nombre}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
