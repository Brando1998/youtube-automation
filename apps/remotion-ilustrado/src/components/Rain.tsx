import { useCallback, useMemo } from "react";
import { mulberry32, rangeFn } from "../fx/rng";
import { withCamera } from "../fx/canvasCamera";
import { FxCanvas } from "./FxCanvas";
import type { Camera2DState } from "./Camera2D";

interface Gota {
  x: number;
  y: number;
  sp: number;
  len: number;
  a: number;
  w: number;
}

/** Porta el array DROPS + el bloque de lluvia de cabana-lucia.html: gotas inclinadas
 * (el desplazamiento horizontal depende de la altura, simulando viento) que caen en
 * bucle vertical. */
function genGotas(cantidad: number, seed: number, width: number, height: number): Gota[] {
  const rnd = mulberry32(seed);
  const rr = rangeFn(rnd);
  return Array.from({ length: cantidad }, () => ({
    x: rr(0, width + 120),
    y: rr(0, height + 80),
    sp: rr(24, 36),
    len: rr(16, 30),
    a: rr(0.18, 0.45),
    w: rr(0.8, 1.6),
  }));
}

export function Rain({
  camera,
  cantidad = 150,
  seed = 2,
  width = 540,
  height = 960,
  depth = 0,
}: {
  camera: Camera2DState;
  cantidad?: number;
  seed?: number;
  width?: number;
  height?: number;
  depth?: number;
}) {
  const gotas = useMemo(() => genGotas(cantidad, seed, width, height), [cantidad, seed, width, height]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      withCamera(ctx, camera, depth, () => {
        ctx.strokeStyle = "rgb(185,205,235)";
        ctx.lineCap = "round";
        for (const d of gotas) {
          const y = ((d.y + frame * d.sp) % (height + 80)) - 40;
          let x = d.x - (y + 40) * 0.22;
          x = (((x % (width + 120)) + width + 120) % (width + 120)) - 60;
          ctx.globalAlpha = d.a;
          ctx.lineWidth = d.w;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + d.len * 0.22, y - d.len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
    },
    [gotas, camera, width, height, depth]
  );

  return <FxCanvas draw={draw} blendMode="normal" />;
}
