import { AbsoluteFill } from "remotion";
import { useCamera2D } from "../components/Camera2D";
import { ParallaxLayer } from "../components/ParallaxLayer";
import { FONDOS_VECTOR } from "../library/registry";

export type PreviewFondoProps = {
  asset_ref: string;
} & Record<string, unknown>;

const W = 540;
const H = 960;

/**
 * Vista previa fija de un fondo de la biblioteca — todas sus capas juntas, sin
 * cámara en movimiento, para revisar/aprobar antes de usarlo en un episodio real.
 */
export function PreviewFondo({ asset_ref }: PreviewFondoProps) {
  const def = FONDOS_VECTOR[asset_ref];
  const camera = useCamera2D({ cx: W / 2, cy: H * 0.667, zoomInicial: 1, zoomFinal: 1, golpeZoomFrames: [] });

  if (!def) {
    return (
      <AbsoluteFill style={{ background: "#EDE6D8", color: "#A33", fontSize: 24, padding: 24, fontFamily: "sans-serif" }}>
        No se encontró "{asset_ref}" en library/registry.ts — ¿corriste generar_registry.mjs?
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {def.capas.map((capa) => (
        <ParallaxLayer key={capa.id} depth={capa.depth} camera={camera}>
          {capa.render?.()}
        </ParallaxLayer>
      ))}
    </AbsoluteFill>
  );
}
