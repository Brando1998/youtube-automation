import { TomaIlustrada, type EpisodeSpec } from "../EpisodeRenderer";
import { FONDOS } from "../catalog/fondos";
import { PERSONAJES } from "../catalog/personajes";
import { AUDIO_REAL } from "../fixtures/audioReal";
import ejemplo15s from "../fixtures/ejemplo15s.json";

/**
 * Igual que PruebaEpisodeSpec pero con audio.palabras/visemas REALES, generados por
 * apps/pipeline_audio/generar_audio_local.py (Whisper + Rhubarb Lip Sync) a partir de
 * un audio de prueba — no el mock a mano. Prueba el camino "audio grabado" completo:
 * voz -> texto con tiempos -> formas de boca -> personaje animado, 100% local.
 */
export function PruebaAudioReal() {
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
      lineasAudio={AUDIO_REAL}
    />
  );
}
