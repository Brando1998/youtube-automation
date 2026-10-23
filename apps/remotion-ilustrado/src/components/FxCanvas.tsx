import { useEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Base compartida para efectos dibujados a mano en canvas (luces, partículas, humo,
 * niebla, lluvia, rayos). Limpia el canvas cada frame y llama a `draw(ctx, frame)`.
 * `blendMode` imita los dos canvas de la demo (fxN normal, fxL con mix-blend-mode:
 * screen para luces/partículas que deben aclarar lo que está debajo).
 */
export function FxCanvas({
  draw,
  blendMode = "normal",
}: {
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void;
  blendMode?: "normal" | "screen";
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    draw(ctx, frame);
  }, [frame, draw, width, height]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: blendMode,
      }}
    />
  );
}
