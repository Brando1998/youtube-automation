import { useCallback, useMemo } from "react";
import { mulberry32, rangeFn } from "../fx/rng";
import { withCamera } from "../fx/canvasCamera";
import { FxCanvas } from "./FxCanvas";
import type { Camera2DState } from "./Camera2D";

type Punto = [number, number];

/** Porta BOLT/BRANCH de cabana-lucia.html: un rayo principal jagged + una rama corta
 * que sale a la mitad, generados una sola vez con seed (deterministas). */
function genRayo(seed: number, cx: number): { bolt: Punto[]; branch: Punto[] } {
  const rnd = mulberry32(seed);
  const rr = rangeFn(rnd);

  const bolt: Punto[] = [[cx, -20]];
  let x = cx;
  let y = -20;
  for (let i = 0; i < 9; i++) {
    y += rr(32, 46);
    x += rr(-30, 30);
    bolt.push([x, y]);
  }

  const [bx0, by0] = bolt[4];
  let bx = bx0;
  let by = by0;
  const branch: Punto[] = [[bx, by]];
  for (let i = 0; i < 4; i++) {
    by += rr(25, 35);
    bx += rr(10, 35);
    branch.push([bx, by]);
  }

  return { bolt, branch };
}

/**
 * Relámpago disparado por evento (p.ej. en la palabra "noche" del spec) — porta el
 * bloque `if(on.lluvia){ ...LIGHT... }` de la demo: un destello de pantalla completa
 * (con doble pico de decaimiento exponencial) más el trazo del rayo con resplandor,
 * visible unos 8 frames. El golpe de zoom de cámara asociado se maneja aparte, via
 * `golpeZoomFrames` en Camera2D con los mismos frames que aquí.
 */
export function Lightning({
  camera,
  frames,
  seed = 3,
  cx = 150,
}: {
  camera: Camera2DState;
  frames: number[];
  seed?: number;
  cx?: number;
}) {
  const { bolt, branch } = useMemo(() => genRayo(seed, cx), [seed, cx]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      let destello = 0;
      for (const L of frames) {
        const a = frame - L;
        if (a >= 0) {
          destello += Math.exp(-a / 3) * (a < 2 ? 1 : 0.55);
          if (a >= 5) destello += 0.5 * Math.exp(-(a - 5) / 2);
        }
      }
      if (destello > 0.01) {
        ctx.fillStyle = `rgba(185,205,255,${Math.min(0.7, destello * 0.55)})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }

      for (const L of frames) {
        const a = frame - L;
        if (a >= 0 && a < 8) {
          const alpha = a < 2 ? 1 : 0.7 * (1 - a / 8);
          withCamera(ctx, camera, 0, () => {
            ctx.save();
            ctx.strokeStyle = `rgba(235,242,255,${alpha})`;
            ctx.lineJoin = "round";
            ctx.shadowColor = "#9fc3ff";
            ctx.shadowBlur = 22;
            [bolt, branch].forEach((pts, j) => {
              ctx.lineWidth = j ? 1.8 : 3.2;
              ctx.beginPath();
              pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
              ctx.stroke();
            });
            ctx.restore();
          });
        }
      }
    },
    [bolt, branch, frames, camera]
  );

  return <FxCanvas draw={draw} blendMode="screen" />;
}
