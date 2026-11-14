import { AbsoluteFill } from "remotion";
import { OBJETOS_VECTOR } from "../library/registry";

export type PreviewObjetoProps = {
  asset_ref: string;
} & Record<string, unknown>;

/**
 * Vista previa fija de un objeto de la biblioteca (prop reutilizable) — centrado,
 * sin animación, para revisar/aprobar.
 */
export function PreviewObjeto({ asset_ref }: PreviewObjetoProps) {
  const def = OBJETOS_VECTOR[asset_ref];

  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      {!def ? (
        <div style={{ color: "#A33", fontSize: 24, padding: 24, fontFamily: "sans-serif" }}>
          No se encontró "{asset_ref}" en library/registry.ts — ¿corriste generar_registry.mjs?
        </div>
      ) : (
        <svg viewBox="0 0 540 960" width="100%" height="100%">
          <g transform="translate(270 480) scale(4)">{def.render?.({ animar: false, frame: 0 })}</g>
        </svg>
      )}
    </AbsoluteFill>
  );
}
