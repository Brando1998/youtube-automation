import { useCurrentFrame } from "remotion";
import { easeOutBack } from "../easing";

export interface Palabra {
  texto: string;
  inicio_frame: number;
  fin_frame: number;
  clave?: boolean;
}

/**
 * Subtítulos palabra por palabra con resaltado de palabras clave — porta caption(f)
 * de docs/reference/cabana-lucia.html: entra con un pequeño "pop" (easeOutBack) y
 * las palabras clave quedan más grandes, en el color de acento, con leve rotación.
 */
export function Captions({
  palabras,
  posicionYPct = 40,
  colorBase = "#fff",
  colorClave = "#F2B33D",
}: {
  palabras: Palabra[];
  posicionYPct?: number;
  colorBase?: string;
  colorClave?: string;
}) {
  const frame = useCurrentFrame();
  const actual = [...palabras].reverse().find((w) => frame >= w.inicio_frame);
  if (!actual) return null;

  const t = Math.min(1, (frame - actual.inicio_frame) / 5);
  const s = 0.6 + 0.4 * easeOutBack(t);
  const scale = s * (actual.clave ? 1.12 : 1);
  const rotate = actual.clave ? -3 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: `${posicionYPct}%`,
        transform: `translate(-50%,-50%) scale(${scale}) rotate(${rotate}deg)`,
        fontFamily: '"Anton", Impact, "Arial Narrow", sans-serif',
        fontSize: 46,
        color: actual.clave ? colorClave : colorBase,
        WebkitTextStroke: "0.07em #000",
        paintOrder: "stroke fill",
        textShadow: "0 0.06em 0 #000, 0 0 0.35em rgba(0,0,0,.65)",
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
        pointerEvents: "none",
      }}
    >
      {actual.texto.toUpperCase()}
    </div>
  );
}
