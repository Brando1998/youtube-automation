import type { Camera2DState } from "../components/Camera2D";

/** Aplica la misma transformación que ParallaxLayer pero directo sobre un canvas 2D
 * context, para efectos dibujados a mano (partículas, humo, niebla, lluvia, rayos) que
 * también deben moverse con la profundidad de la cámara. Porta withCam() de la demo. */
export function withCamera(
  ctx: CanvasRenderingContext2D,
  camera: Camera2DState,
  depth: number,
  draw: () => void
) {
  const { Z, PX, PY, cx, cy } = camera;
  const s = 1 + (Z - 1) * (0.35 + depth * 0.8);
  const tx = cx - s * cx + PX * (0.2 + depth);
  const ty = cy - s * cy + PY * (0.2 + depth);
  ctx.setTransform(s, 0, 0, s, tx, ty);
  draw();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
