import { AbsoluteFill } from "remotion";
import { CharacterPuppet } from "../components/CharacterPuppet";
import { PERSONAJES_VECTOR } from "../library/registry";

export type PreviewPersonajeProps = {
  asset_ref: string;
} & Record<string, unknown>;

const W = 540;
const H = 960;

/**
 * Vista previa fija de un personaje de la biblioteca — pose estática (animar=false,
 * sin respiración/parpadeo) sobre fondo neutro, para revisar/aprobar el diseño
 * antes de usarlo en un episodio real. Renderizada vía `npx remotion still`
 * (apps/web/app/pipeline_runner.py, tipo de job vector_personaje).
 */
export function PreviewPersonaje({ asset_ref }: PreviewPersonajeProps) {
  const def = PERSONAJES_VECTOR[asset_ref];

  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      {!def ? (
        <div style={{ color: "#A33", fontSize: 24, padding: 24, fontFamily: "sans-serif" }}>
          No se encontró "{asset_ref}" en library/registry.ts — ¿corriste generar_registry.mjs?
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
          <CharacterPuppet
            x={W / 2}
            y={H * 0.72}
            escala={1.3}
            animar={false}
            cuerpo={def.cuerpo}
            cabeza={def.cabeza}
            ojosAbiertos={def.ojosAbiertos}
            ojosCerrados={def.ojosCerrados}
            cejas={def.cejas}
            bocas={def.bocas}
            prop={def.prop}
            cabezaPivot={def.cabezaPivot}
            propPivot={def.propPivot}
            apendicePivot={def.apendicePivot}
          />
        </svg>
      )}
    </AbsoluteFill>
  );
}
