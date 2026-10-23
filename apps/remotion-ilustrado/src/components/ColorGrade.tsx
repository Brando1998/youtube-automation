import React from "react";

/** Presets de gradación de color — porta el filtro CSS de `$("art").style.filter` en
 * cabana-lucia.html ("calido"). Los nombres coinciden con `efectos.color_grade` del
 * episode spec (episode_spec/schema.json). */
const PRESETS: Record<string, string> = {
  calido: "contrast(1.14) saturate(.82) sepia(.1) hue-rotate(-6deg) brightness(.97)",
  neutro: "none",
};

/**
 * Envuelve las capas de arte (no los overlays de FX en screen-blend, que deben
 * quedar fuera para no perder su brillo) en un filtro CSS de gradación de color.
 */
export function ColorGrade({
  preset = "calido",
  children,
}: {
  preset?: string;
  children: React.ReactNode;
}) {
  const filter = PRESETS[preset] ?? PRESETS.calido;
  return <div style={{ position: "absolute", inset: 0, filter }}>{children}</div>;
}
