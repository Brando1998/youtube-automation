import { useCallback, useMemo } from "react";
import { blit, stdSprites } from "../fx/sprites";
import { mulberry32, rangeFn } from "../fx/rng";
import { withCamera } from "../fx/canvasCamera";
import { FxCanvas } from "./FxCanvas";
import type { Camera2DState } from "./Camera2D";

interface Banco {
  x: number;
  y: number;
  depth: number;
  v: number;
  rw: number;
  rh: number;
  a: number;
}

/** Porta el array FOGS + el bloque `if(on.niebla)` de cabana-lucia.html: bancos de
 * niebla que cruzan el cuadro en bucle horizontal, en dos franjas de profundidad
 * (suelo cercano y suelo lejano). */
function genBancos(cantidad: number, seed: number, width: number): Banco[] {
  const rnd = mulberry32(seed);
  const rr = rangeFn(rnd);
  return Array.from({ length: cantidad }, (_, i) => ({
    x: rr(0, width + 500),
    y: i < cantidad * 0.55 ? rr(690, 760) : rr(830, 920),
    depth: i < cantidad * 0.55 ? 0.5 : 0.95,
    v: rr(0.3, 0.7),
    rw: rr(170, 260),
    rh: rr(40, 70),
    a: rr(0.16, 0.28),
  }));
}

export function Fog({
  camera,
  cantidad = 9,
  seed = 1,
  width = 540,
}: {
  camera: Camera2DState;
  cantidad?: number;
  seed?: number;
  width?: number;
}) {
  const bancos = useMemo(() => genBancos(cantidad, seed, width), [cantidad, seed, width]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const sprites = stdSprites();
      for (const o of bancos) {
        withCamera(ctx, camera, o.depth, () => {
          const x = ((o.x + frame * o.v) % (width + 500)) - 250;
          blit(ctx, sprites.fog, x, o.y, o.rw, o.a, o.rh);
        });
      }
    },
    [bancos, camera, width]
  );

  return <FxCanvas draw={draw} blendMode="normal" />;
}
