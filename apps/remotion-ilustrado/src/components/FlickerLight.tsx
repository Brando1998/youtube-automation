import { useCallback } from "react";
import { blit, flicker, stdSprites } from "../fx/sprites";
import { withCamera } from "../fx/canvasCamera";
import { FxCanvas } from "./FxCanvas";
import type { Camera2DState } from "./Camera2D";

export interface LuzDef {
  x: number;
  y: number;
  depth: number;
  radio: number;
  /** Color del halo. "warm" = linterna/ventana, "cool" = luna/luz fría. */
  sprite?: "warm" | "white" | "cool";
  /** Alpha base del halo (0-1). */
  intensidad?: number;
  /** Si parpadea (linterna/vela) o queda fija (luna). Default: true. */
  parpadeo?: boolean;
  /** Semilla de parpadeo — cada luz titila distinto. */
  seed?: number;
  /** Si dibuja 3 capas superpuestas (halo grande + medio + núcleo brillante), como una
   * linterna o vela de cerca, en vez de un solo halo plano (p.ej. una ventana a lo lejos). */
  capas?: boolean;
}

/**
 * Luces dinámicas (linternas, ventanas, luna) — porta el bloque `if(on.luz)` de
 * cabana-lucia.html, generalizado: en vez de posiciones fijas de la escena de
 * referencia, recibe una lista de luces configurables desde el spec de la toma.
 */
export function FlickerLight({ luces, camera }: { luces: LuzDef[]; camera: Camera2DState }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const sprites = stdSprites();
      for (const luz of luces) {
        const k = luz.parpadeo === false ? 1 : flicker(frame, luz.seed ?? 0);
        const sprite = sprites[luz.sprite ?? "warm"];
        const intensidad = luz.intensidad ?? 0.4;
        withCamera(ctx, camera, luz.depth, () => {
          if (luz.capas) {
            blit(ctx, sprite, luz.x, luz.y, luz.radio * k, intensidad * 0.38);
            blit(ctx, sprite, luz.x, luz.y, luz.radio * 0.37 * k, intensidad * 1.0);
            blit(ctx, sprites.white, luz.x, luz.y, luz.radio * 0.09 * k, Math.min(1, intensidad * 1.2));
          } else {
            blit(ctx, sprite, luz.x, luz.y, luz.radio * k, intensidad);
          }
        });
      }
    },
    [luces, camera]
  );

  return <FxCanvas draw={draw} blendMode="screen" />;
}
