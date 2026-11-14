import { AbsoluteFill } from "remotion";
import { evaluarFK } from "../engine/rig/fk";
import type { Articulacion } from "../engine/rig/types";
import { FormaAhusada } from "../library/primitives";
import { PALETA } from "../library/styleTokens";

/**
 * Prueba de la Fase 4 (rigging, docs/PROJECT_ROADMAP.md): un hombro de verdad
 * rotable (FK, no una pose fija horneada en una sola curva como el torso de
 * Lucía) con la técnica de "cap" circular en la articulación — el estándar de
 * rigs 2D reales (Spine2D/DragonBones) para que la unión se vea limpia sin
 * importar el ángulo, en vez de intentar mantener una curva fundida única
 * mientras se mueve (lo que exigiría recalcular tangentes válidas en cada cuadro
 * y arriesga los mismos bugs de auto-intersección de la Fase 3, ahora en movimiento).
 *
 * 3 ángulos distintos lado a lado — si el "cap" funciona, la unión hombro/brazo
 * se ve igual de limpia en los 3, no solo en el ángulo de reposo.
 */
const HOMBRO: Articulacion = { id: "hombro", longitud: 84.2, anguloReposo: 74.14, radioProximal: 18, radioDistal: 11 };
const COLOR = PALETA.acento.calido;

function BrazoConCap({ anguloLocal }: { anguloLocal: number }) {
  const pose = evaluarFK([HOMBRO], { x: 0, y: 0, anguloMundo: 0 }, { hombro: anguloLocal });
  const { proximal, distal } = pose.hombro;
  return (
    <g>
      {/* "torso" de contexto — solo para ver dónde se ancla el hombro */}
      <circle cx={0} cy={0} r={40} fill={PALETA.terreno.suelo} stroke={PALETA.contorno} strokeWidth={3} />
      <FormaAhusada baseX={proximal.x} baseY={proximal.y} baseR={HOMBRO.radioProximal} puntaX={distal.x} puntaY={distal.y} puntaR={HOMBRO.radioDistal} color={COLOR} />
      {/* mano */}
      <circle cx={distal.x} cy={distal.y + 2} r={10} fill="#F0C39C" stroke={PALETA.contorno} strokeWidth={2.5} />
      {/* cap de la articulación — tapa la unión con el "torso", mismo color y
          radio suficiente para cubrir el extremo proximal del hueso en cualquier
          ángulo. Se dibuja ENCIMA de ambos. */}
      <circle cx={proximal.x} cy={proximal.y} r={HOMBRO.radioProximal} fill={COLOR} stroke={PALETA.contorno} strokeWidth={3} />
    </g>
  );
}

export function PruebaHombroFK() {
  const angulos = [-45, 0, 45];
  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      <svg viewBox="0 0 540 960" width="100%" height="100%">
        {angulos.map((a, i) => (
          <g key={a} transform={`translate(${100 + i * 170} 450)`}>
            <BrazoConCap anguloLocal={a} />
            <text x={0} y={120} textAnchor="middle" fontSize={16} fill={PALETA.contorno} fontFamily="sans-serif">
              {a}°
            </text>
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
}
