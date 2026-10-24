import { TomaIlustrada, type EpisodeSpec } from "../EpisodeRenderer";
import { FONDOS } from "../catalog/fondos";
import { PERSONAJES } from "../catalog/personajes";
import { AUDIO_MOCK } from "../fixtures/audioMock";
import ejemplo15s from "../fixtures/ejemplo15s.json";

/**
 * Primer render de punta a punta del estilo ilustrado usando el episode_spec REAL
 * (copia de episode_spec/ejemplo_15s.json), no una escena armada a mano — reemplaza
 * PruebaEfectos como prueba del patrón. `lineasAudio` es el mock de A6 (Fase A6/Polly
 * sigue bloqueada); el resto (fondo, personaje, efectos, eventos) sale del spec tal
 * cual lo generaría Claude a partir del guion.
 */
export function PruebaEpisodeSpec() {
  const spec = ejemplo15s as unknown as EpisodeSpec;
  const escena = spec.escenas[0];
  const toma = escena.tomas[0];

  return (
    <TomaIlustrada
      spec={spec}
      escena={escena}
      toma={toma}
      fondos={FONDOS}
      personajesCatalogo={PERSONAJES}
      lineasAudio={AUDIO_MOCK}
    />
  );
}
