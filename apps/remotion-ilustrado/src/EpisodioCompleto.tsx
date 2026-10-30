import { Series } from "remotion";
import { TomaIlustrada, type AudioLinea, type EpisodeSpec } from "./EpisodeRenderer";
import type { FondoDef, PersonajeDef } from "./catalog/types";

export type EpisodioCompletoProps = {
  spec: EpisodeSpec;
  fondos: Record<string, FondoDef>;
  personajesCatalogo: Record<string, PersonajeDef>;
  lineasAudio: Record<string, AudioLinea>;
} & Record<string, unknown>;

/**
 * Encadena TODAS las tomas de TODAS las escenas del spec, una tras otra, con
 * <Series> de Remotion — a diferencia de TomaIlustrada (una toma sola, usado por
 * las composiciones Prueba*), esta es la que de verdad genera el mp4 de un
 * episodio completo (render_episodio). `lineasAudio` es el mapa completo del
 * episodio (todas las líneas, de todas las tomas) — cada TomaIlustrada busca ahí
 * solo los ids de línea que le tocan, ids de línea deben ser únicos en todo el
 * episodio (asunción del spec, no solo de esta composición).
 */
export function EpisodioCompleto({ spec, fondos, personajesCatalogo, lineasAudio }: EpisodioCompletoProps) {
  return (
    <Series>
      {spec.escenas.flatMap((escena) =>
        escena.tomas.map((toma) => (
          <Series.Sequence key={toma.id} durationInFrames={toma.duracion_frames}>
            <TomaIlustrada
              spec={spec}
              escena={escena}
              toma={toma}
              fondos={fondos}
              personajesCatalogo={personajesCatalogo}
              lineasAudio={lineasAudio}
            />
          </Series.Sequence>
        )),
      )}
    </Series>
  );
}

/** Suma las duraciones de todas las tomas — usado por Root.tsx (calculateMetadata)
 * para que la duración de la composición salga del spec real pasado por --props,
 * no de un valor fijo a mano. */
export function duracionTotalFrames(spec: EpisodeSpec): number {
  return spec.escenas.flatMap((e) => e.tomas).reduce((acc, t) => acc + t.duracion_frames, 0);
}
