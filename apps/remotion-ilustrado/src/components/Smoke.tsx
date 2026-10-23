import { useCallback } from "react";
import { blit, stdSprites } from "../fx/sprites";
import { withCamera } from "../fx/canvasCamera";
import { FxCanvas } from "./FxCanvas";
import type { Camera2DState } from "./Camera2D";

/**
 * Humo saliendo de un punto (chimenea, fogata) — porta el bloque `if(on.humo)` de
 * cabana-lucia.html: bocanadas con edad cíclica que suben, se expanden y se desvanecen.
 */
export function Smoke({
  origen,
  depth,
  camera,
  cantidad = 26,
  ciclo = 150,
  altura = 170,
  deriva = 34,
  radioMax = 42,
}: {
  origen: { x: number; y: number };
  depth: number;
  camera: Camera2DState;
  cantidad?: number;
  ciclo?: number;
  altura?: number;
  deriva?: number;
  radioMax?: number;
}) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const sprites = stdSprites();
      withCamera(ctx, camera, depth, () => {
        for (let i = 0; i < cantidad; i++) {
          const age = (frame + (i * ciclo) / cantidad) % ciclo;
          const t = age / ciclo;
          const x = origen.x + deriva * t + 10 * Math.sin(age * 0.05 + i);
          const y = origen.y - altura * t;
          const r = 8 + radioMax * t;
          const alpha = 0.5 * (1 - t) * Math.min(1, t * 6);
          blit(ctx, sprites.smoke, x, y, r, alpha);
        }
      });
    },
    [origen, depth, camera, cantidad, ciclo, altura, deriva, radioMax]
  );

  return <FxCanvas draw={draw} blendMode="normal" />;
}
