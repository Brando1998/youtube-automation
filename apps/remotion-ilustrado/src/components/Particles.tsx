import { useCallback, useMemo } from "react";
import { blit, stdSprites, type Sprite } from "../fx/sprites";
import { mulberry32, rangeFn } from "../fx/rng";
import { withCamera } from "../fx/canvasCamera";
import { FxCanvas } from "./FxCanvas";
import type { Camera2DState } from "./Camera2D";

export type ParticlePreset = "luciernagas" | "brasas" | "nieve" | "polvo";

interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface ParticleSeed {
  x: number;
  y: number;
  sp: number;
  ph: number;
  ph2: number;
  r: number;
}

const PRESET_SPRITE: Record<ParticlePreset, "warm" | "white" | "cool" | "fly"> = {
  luciernagas: "fly",
  brasas: "warm",
  nieve: "white",
  polvo: "cool",
};

function genSeeds(cantidad: number, area: Area, seed: number, rRange: [number, number]): ParticleSeed[] {
  const rnd = mulberry32(seed);
  const rr = rangeFn(rnd);
  return Array.from({ length: cantidad }, () => ({
    x: rr(area.x0, area.x1),
    y: rr(area.y0, area.y1),
    sp: rr(0.6, 1.4),
    ph: rr(0, 6.28),
    ph2: rr(0, 6.28),
    r: rr(rRange[0], rRange[1]),
  }));
}

/** Posición/alpha de una partícula en el frame `f`, según el preset — porta el drift +
 * parpadeo de FLIES en cabana-lucia.html para "luciernagas"; los demás presets son
 * variaciones del mismo patrón (caída para nieve, ascenso para brasas, deriva suave
 * y tenue para polvo). */
function updateParticle(preset: ParticlePreset, p: ParticleSeed, f: number, area: Area) {
  switch (preset) {
    case "luciernagas": {
      const x = p.x + 22 * Math.sin(f * 0.02 * p.sp + p.ph);
      const y = p.y + 14 * Math.sin(f * 0.027 * p.sp + p.ph2) - 6 * Math.sin(f * 0.011 + p.ph);
      const b = Math.pow(0.5 + 0.5 * Math.sin(f * 0.12 * p.sp + p.ph), 2.5);
      return { x, y, radio: p.r * (0.7 + 0.5 * b), alpha: 0.15 + 0.85 * b };
    }
    case "brasas": {
      const alturaTotal = area.y1 - area.y0;
      const ciclo = 220 / p.sp;
      const t = ((f + p.ph * 35) % ciclo) / ciclo;
      const x = p.x + 18 * Math.sin(f * 0.03 * p.sp + p.ph);
      const y = area.y1 - alturaTotal * t;
      const b = 0.5 + 0.4 * Math.sin(f * 0.3 * p.sp + p.ph2);
      return { x, y, radio: p.r * (1 - 0.3 * t), alpha: (1 - t) * (0.4 + 0.5 * b) };
    }
    case "nieve": {
      const alturaTotal = area.y1 - area.y0;
      const ciclo = 260 / p.sp;
      const t = ((f + p.ph * 40) % ciclo) / ciclo;
      const x = p.x + 16 * Math.sin(f * 0.02 * p.sp + p.ph);
      const y = area.y0 + alturaTotal * t;
      return { x, y, radio: p.r, alpha: 0.5 + 0.3 * Math.sin(f * 0.05 + p.ph2) };
    }
    case "polvo": {
      const x = p.x + 10 * Math.sin(f * 0.008 * p.sp + p.ph);
      const y = p.y + 6 * Math.sin(f * 0.006 * p.sp + p.ph2);
      return { x, y, radio: p.r, alpha: 0.12 + 0.08 * Math.sin(f * 0.05 + p.ph) };
    }
  }
}

export function Particles({
  preset,
  cantidad = 30,
  area,
  depth,
  seed = 1,
  radio = [6, 12],
  camera,
}: {
  preset: ParticlePreset;
  cantidad?: number;
  area: Area;
  depth: number;
  seed?: number;
  radio?: [number, number];
  camera: Camera2DState;
}) {
  const seeds = useMemo(() => genSeeds(cantidad, area, seed, radio), [cantidad, area, seed, radio]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const sprites = stdSprites();
      const sprite: Sprite = sprites[PRESET_SPRITE[preset]];
      withCamera(ctx, camera, depth, () => {
        for (const p of seeds) {
          const { x, y, radio: r, alpha } = updateParticle(preset, p, frame, area);
          blit(ctx, sprite, x, y, r, alpha);
        }
      });
    },
    [seeds, preset, area, depth, camera]
  );

  return <FxCanvas draw={draw} blendMode="screen" />;
}
