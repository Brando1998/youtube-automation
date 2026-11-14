import { AbsoluteFill } from "remotion";
import { CharacterPuppet } from "../components/CharacterPuppet";
import { FAMILIAS_OBJETO_VECTOR, FAMILIAS_PERSONAJE_VECTOR } from "../library/registry";

export type PreviewFamiliaProps = {
  familia: string;
  tipo: "personaje" | "objeto";
  parametros: Record<string, unknown>;
} & Record<string, unknown>;

const W = 540;
const H = 960;

/**
 * Vista previa fija de UNA INSTANCIA de una familia paramétrica (Fase C,
 * docs/PROJECT_ROADMAP.md) — llama a la factory con los parámetros dados y
 * renderiza el resultado, mismo criterio visual que PreviewPersonaje/
 * PreviewObjeto (pose estática, fondo neutro, para revisar/aprobar). Usada por
 * el job vector_personaje/vector_objeto cuando la entidad tiene `familia_ref`
 * en vez de `asset_ref` de biblioteca fija.
 */
function NoEncontrada({ familia, tipo }: { familia: string; tipo: string }) {
  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      <div style={{ color: "#A33", fontSize: 24, padding: 24, fontFamily: "sans-serif" }}>
        No se encontró la familia "{familia}" (tipo {tipo}) en library/registry.ts — ¿corriste generar_registry.mjs?
      </div>
    </AbsoluteFill>
  );
}

export function PreviewFamilia({ familia, tipo, parametros }: PreviewFamiliaProps) {
  // Ramas separadas por tipo (en vez de resolver `factory` una sola vez) para que
  // TypeScript pueda angostar el tipo de retorno de cada factory por separado —
  // unificar antes perdía esa información (ver CharacterPuppet/`def.render` abajo).
  if (tipo === "personaje") {
    const factory = FAMILIAS_PERSONAJE_VECTOR[familia];
    if (!factory) return <NoEncontrada familia={familia} tipo={tipo} />;
    const def = factory(parametros ?? {});
    return (
      <AbsoluteFill style={{ background: "#EDE6D8" }}>
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
            apendice={def.apendice}
            cabezaPivot={def.cabezaPivot}
            propPivot={def.propPivot}
            apendicePivot={def.apendicePivot}
          />
        </svg>
      </AbsoluteFill>
    );
  }

  const factory = FAMILIAS_OBJETO_VECTOR[familia];
  if (!factory) return <NoEncontrada familia={familia} tipo={tipo} />;
  const def = factory(parametros ?? {});
  return (
    <AbsoluteFill style={{ background: "#EDE6D8" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        <g transform={`translate(${W / 2} ${H / 2}) scale(4)`}>{def.render?.({ animar: false, frame: 0 })}</g>
      </svg>
    </AbsoluteFill>
  );
}
