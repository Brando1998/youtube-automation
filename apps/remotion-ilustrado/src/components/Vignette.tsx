import { useCallback } from "react";
import { FxCanvas } from "./FxCanvas";

/** Porta el degradado radial oscuro de cabana-lucia.html (no se mueve con la cámara,
 * queda fijo a la pantalla como un vignette real de cámara). */
export function Vignette({ intensidad = 0.72 }: { intensidad?: number }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const v = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.22, w / 2, h * 0.46, h * 0.78);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, `rgba(0,0,0,${intensidad})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
    [intensidad]
  );

  return <FxCanvas draw={draw} blendMode="normal" />;
}
