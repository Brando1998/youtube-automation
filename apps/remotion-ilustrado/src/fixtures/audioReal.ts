import l1 from "./l1.audio.real.json";
import l2 from "./l2.audio.real.json";
import type { AudioLinea } from "../EpisodeRenderer";

/**
 * Salida REAL (no mock) de apps/pipeline_audio/generar_audio_local.py, corrida sobre
 * audio de prueba (gTTS, solo para tener un .mp3 con el que probar Whisper+Rhubarb
 * localmente — no es la voz de producción, esa es Polly vía Fase A6/Bedrock, todavía
 * bloqueada). Prueba que el camino "audio grabado" (Whisper -> palabras, Rhubarb ->
 * visemas) funciona de punta a punta sin tocar AWS para nada.
 */
export const AUDIO_REAL: Record<string, AudioLinea> = {
  ...l1,
  ...l2,
} as Record<string, AudioLinea>;
