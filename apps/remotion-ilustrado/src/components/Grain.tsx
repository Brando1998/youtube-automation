import { useCallback, useMemo } from "react";
import { mulberry32 } from "../fx/rng";
import { FxCanvas } from "./FxCanvas";

/** Porta el array GRAIN de cabana-lucia.html: 4 tiles de ruido blanco de 160x160 con
 * alpha bajo (26/255), pre-generados una sola vez (no por frame). */
function makeGrainTile(seed: number): HTMLCanvasElement {
  const rnd = mulberry32(seed);
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d")!;
  const im = g.createImageData(160, 160);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = rnd() * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 26;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/** Grano de película — el tile rota entre 4 variantes y se desplaza cada frame
 * (porta `gN.translate((f*37)%160-160,(f*53)%160-160)`), para que no se sienta como
 * una textura estática pegada a la pantalla. */
export function Grain({ seed = 1 }: { seed?: number }) {
  const tiles = useMemo(() => Array.from({ length: 4 }, (_, i) => makeGrainTile(seed * 97 + i)), [seed]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      ctx.save();
      ctx.translate((frame * 37) % 160 - 160, (frame * 53) % 160 - 160);
      const pattern = ctx.createPattern(tiles[frame % 4], "repeat");
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w + 320, h + 320);
      }
      ctx.restore();
    },
    [tiles]
  );

  return <FxCanvas draw={draw} blendMode="normal" />;
}
