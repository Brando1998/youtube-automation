import type { Palabra } from "../components/Captions";
import type { Segmento } from "../components/CharacterPuppet";

/**
 * Mock de lo que Polly (speech marks de palabra + visema) o Whisper/Rhubarb
 * devolverían para cada línea de `fixtures/ejemplo15s.json` — Fase A6 (TTS real)
 * todavía no corre. Timing aproximado a mano, solo para probar que el renderer
 * conecta correctamente audio.palabras -> Captions y audio.visemas -> lip sync.
 */
export const AUDIO_MOCK: Record<string, { palabras: Palabra[]; visemas: Segmento[] }> = {
  l1: {
    palabras: [
      { texto: "Cada", inicio_frame: 10, fin_frame: 25 },
      { texto: "noche", inicio_frame: 25, fin_frame: 40 },
      { texto: "Lucía", inicio_frame: 40, fin_frame: 58 },
      { texto: "salía", inicio_frame: 58, fin_frame: 73 },
      { texto: "con", inicio_frame: 73, fin_frame: 82 },
      { texto: "su", inicio_frame: 82, fin_frame: 90 },
      { texto: "linterna", inicio_frame: 90, fin_frame: 112 },
      { texto: "a", inicio_frame: 112, fin_frame: 118 },
      { texto: "buscar", inicio_frame: 118, fin_frame: 136 },
      { texto: "luciérnagas", inicio_frame: 136, fin_frame: 165 },
    ],
    visemas: [],
  },
  l2: {
    palabras: [
      { texto: "Ahí", inicio_frame: 200, fin_frame: 215, clave: true },
      { texto: "hay", inicio_frame: 215, fin_frame: 227 },
      { texto: "una", inicio_frame: 227, fin_frame: 242 },
      { texto: "Ven", inicio_frame: 260, fin_frame: 273 },
      { texto: "a", inicio_frame: 273, fin_frame: 279 },
      { texto: "jugar", inicio_frame: 279, fin_frame: 300 },
    ],
    visemas: [
      { tipo: "A", inicio_frame: 200, fin_frame: 208 },
      { tipo: "reposo", inicio_frame: 208, fin_frame: 215 },
      { tipo: "FV", inicio_frame: 215, fin_frame: 222 },
      { tipo: "A", inicio_frame: 222, fin_frame: 227 },
      { tipo: "O", inicio_frame: 227, fin_frame: 238 },
      { tipo: "reposo", inicio_frame: 238, fin_frame: 260 },
      { tipo: "MBP", inicio_frame: 260, fin_frame: 267 },
      { tipo: "E", inicio_frame: 267, fin_frame: 273 },
      { tipo: "reposo", inicio_frame: 273, fin_frame: 279 },
      { tipo: "L", inicio_frame: 279, fin_frame: 285 },
      { tipo: "A", inicio_frame: 285, fin_frame: 295 },
      { tipo: "reposo", inicio_frame: 295, fin_frame: 300 },
    ],
  },
};
