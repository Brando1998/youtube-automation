import React from "react";
import type { Camera2DState } from "./Camera2D";

/**
 * Una capa a cierta profundidad `depth` (0 = fondo lejano/sin paralaje, 1 = primer
 * plano, se mueve casi 1:1 con la cámara). Misma fórmula que camFor(d) de la demo:
 * s = 1 + (Z-1)*(.35 + depth*.8); tx = cx - s*cx + PX*(.2+depth); ty análogo.
 */
export function ParallaxLayer({
  depth,
  camera,
  children,
}: {
  depth: number;
  camera: Camera2DState;
  children: React.ReactNode;
}) {
  const { Z, PX, PY, cx, cy } = camera;
  const s = 1 + (Z - 1) * (0.35 + depth * 0.8);
  const tx = cx - s * cx + PX * (0.2 + depth);
  const ty = cy - s * cy + PY * (0.2 + depth);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `matrix(${s},0,0,${s},${tx},${ty})`,
        transformOrigin: "0 0",
      }}
    >
      {children}
    </div>
  );
}
