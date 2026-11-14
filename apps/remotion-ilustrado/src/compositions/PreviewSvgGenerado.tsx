import { AbsoluteFill } from "remotion";
import { SvgGenerado } from "../components/SvgGenerado";

export type PreviewSvgGeneradoProps = {
  svg: string;
} & Record<string, unknown>;

const W = 540;
const H = 960;

/**
 * Vista previa fija de un SVG generado por IA (Fase D) — mismo criterio visual
 * que PreviewObjeto, centrado y escalado. Sirve para probar SvgGenerado.tsx
 * con un render real antes de conectarlo a cualquier flujo de aprobación.
 */
export function PreviewSvgGenerado({ svg }: PreviewSvgGeneradoProps) {
  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        <g transform={`translate(${W / 2} ${H / 2}) scale(4)`}>
          <SvgGenerado svg={svg} />
        </g>
      </svg>
    </AbsoluteFill>
  );
}
