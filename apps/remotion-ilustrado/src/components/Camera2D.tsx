import { useCurrentFrame, useVideoConfig } from "remotion";
import { easeIO } from "../easing";

/**
 * Cámara 2.5D: porta camFor(d)/Z/PX/PY de docs/reference/cabana-lucia.html.
 * Cada ParallaxLayer usa el mismo estado de cámara con su propia profundidad.
 */
export interface Camera2DConfig {
  /** Punto focal (en coordenadas del lienzo, p.ej. 270,640 para un 540x960) hacia el que hace zoom la cámara. */
  cx: number;
  cy: number;
  zoomInicial?: number;
  zoomFinal?: number;
  /** Frames en los que ocurre un golpe de zoom (p.ej. eventos del spec como un relámpago). */
  golpeZoomFrames?: number[];
  panX?: (progreso: number, frame: number) => number;
  panY?: (progreso: number, frame: number) => number;
}

export interface Camera2DState {
  Z: number;
  PX: number;
  PY: number;
  cx: number;
  cy: number;
}

const panXDefault = (e: number, frame: number) =>
  -28 * e + 1.2 * Math.sin(frame * 0.13) + 0.6 * Math.sin(frame * 0.29);
const panYDefault = (e: number, frame: number) => 6 * e + 0.8 * Math.sin(frame * 0.17 + 1);

export function useCamera2D(config: Camera2DConfig): Camera2DState {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const e = easeIO(frame / Math.max(1, durationInFrames - 1));

  const zoomInicial = config.zoomInicial ?? 1;
  const zoomFinal = config.zoomFinal ?? 1;

  let kick = 0;
  for (const gf of config.golpeZoomFrames ?? []) {
    const dt = frame - gf;
    if (dt >= 0) kick += 0.05 * Math.exp(-dt / 6);
  }

  const Z = zoomInicial + (zoomFinal - zoomInicial) * e + kick;
  const PX = (config.panX ?? panXDefault)(e, frame);
  const PY = (config.panY ?? panYDefault)(e, frame);

  return { Z, PX, PY, cx: config.cx, cy: config.cy };
}
