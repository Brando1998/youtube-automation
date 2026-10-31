/**
 * Equivalente vectorial de style_guide.json — paleta/trazo/radios compartidos por
 * toda la biblioteca (apps/remotion-ilustrado/src/library/), para que un personaje
 * nuevo y un fondo nuevo compuestos por distintas sesiones/pedidos se vean
 * consistentes entre sí sin copiar valores sueltos. El contorno #05070A es el mismo
 * que ya usa todo el proyecto (docs/reference/cabana-lucia.html, el fallback de
 * CharacterPuppet.tsx).
 */

export const PALETA = {
  contorno: "#05070A",

  piel: { clara: "#E8B08B", media: "#C98E6C", sombra: "#8a5a3d" },

  cielo: { noche: "#16213A", atardecer: "#3a4049", luna: "#F1E6C3" },

  follaje: { oscuro: "#17261E", medio: "#253423", claro: "#2b3b24" },

  madera: { tronco: "#5b3a25", sombra: "#2a1a10", tabla: "#4a2c1c" },

  terreno: { lejano: "#1A2235", medio: "#262b36", suelo: "#3a3326" },

  acento: { calido: "#E4AA2F", calidoOscuro: "#A9771A", frio: "#3a4049" },

  boca: "#7A2E2E",
} as const;

export const TRAZO = {
  grueso: 4,
  medio: 3,
  fino: 1.8,
} as const;

export const RADIOS = {
  cuerpoRx: 30,
  ojoR: 7,
} as const;

/** Props de stroke listas para pasar a cualquier elemento SVG — mismo criterio de
 * contorno en toda la biblioteca, nunca un hex suelto hardcodeado por asset. */
export function contorno(width: number = TRAZO.medio) {
  return {
    stroke: PALETA.contorno,
    strokeWidth: width,
    strokeLinejoin: "round" as const,
  };
}
