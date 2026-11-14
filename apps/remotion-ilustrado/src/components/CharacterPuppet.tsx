import type React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { smooth } from "../easing";
import type { ClipAnimacion } from "../engine/animation/types";

export type VisemaCode = "reposo" | "A" | "E" | "O" | "MBP" | "FV" | "L";

/** Lo que CharacterPuppet ya sabe por frame (animar/frame) y que cualquier parte
 * puede querer usar para animarse por su cuenta (Fase 4, docs/PROJECT_ROADMAP.md
 * — antes Lucía llamaba a useCurrentFrame() por su cuenta dentro de su propio
 * cuerpo.render(), funcionaba pero no era un canal "oficial"; esto lo es). Un
 * `render` que no lo necesita simplemente no declara el parámetro — una función
 * `() => X` sigue siendo válida donde se espera `(ctx) => X`, no rompe a los
 * personajes existentes. */
export interface ContextoAnimacion {
  animar: boolean;
  frame: number;
  /** Clips activos (Fase 5/7, docs/PROJECT_ROADMAP.md) que un `render` puede
   * elegir aplicar — cada personaje decide QUÉ hueso usa cada clip (p.ej.
   * lucia.tsx despacha por `categoria`: "gesto" al brazo derecho, "locomocion" a
   * ambas piernas); `CharacterPuppet`/`ContextoAnimacion` solo los transporta, no
   * sabe de huesos. Un `render` que no los necesita simplemente no los lee —
   * mismo criterio de opcionalidad que el resto de este contrato. */
  clips?: ClipAnimacion[];
  /** Frame LOCAL del/de los clip(s) activos — independiente de `frame` (que sigue
   * siendo el reloj real de breathing/blink/look). Permite que un gesto empiece a
   * mitad de una toma (`inicioFrame` del spec) sin desincronizar el resto del
   * personaje. Si no se pasa, quien evalúa el clip cae a `frame`. */
  clipFrame?: number;
}

export interface ParteVisual {
  /** PNG con fondo transparente, ruta relativa a `public/` del app Remotion (se
   * resuelve con `staticFile()`, no es una URL directa — ver Placeholder más abajo).
   * Camino viejo (Stability), sin uso para assets nuevos — ver `render`. */
  src?: string;
  /** Forma vectorial dibujada por código (biblioteca en `library/`, mismo patrón
   * que `CapaFondo.render` en catalog/types.ts) — el camino real para assets
   * nuevos: sin llamadas a IA de imagen, consistente por construcción. */
  render?: (ctx: ContextoAnimacion) => React.ReactNode;
}

export interface Pivote {
  x: number;
  y: number;
}

export interface Segmento {
  tipo: VisemaCode;
  inicio_frame: number;
  fin_frame: number;
}

export interface CharacterPuppetProps {
  /** Punto de pivote del personaje completo, en coordenadas del mundo (ya detrás de
   * la ParallaxLayer de su profundidad) — normalmente los pies. */
  x: number;
  y: number;
  escala?: number;
  colorPlaceholder?: string;

  cuerpo?: ParteVisual;
  cabeza?: ParteVisual;
  ojosAbiertos?: ParteVisual;
  ojosCerrados?: ParteVisual;
  cejas?: ParteVisual;
  bocas?: Partial<Record<VisemaCode, ParteVisual>>;
  prop?: ParteVisual;
  /** Apéndice que se balancea (cola, antena, lo que aplique) — si no se define,
   * cae al círculo genérico de siempre (no rompe a Tito ni a nada ya aprobado). */
  apendice?: ParteVisual;

  /** Pivotes relativos al origen (pies, 0,0) — valores por defecto pensados para un
   * puppet de ~240 unidades de alto; ajustar cuando lleguen las partes reales con
   * sus propios pivotes (Fase A4, `generar_partes.py`). */
  cabezaPivot?: Pivote;
  propPivot?: Pivote;
  apendicePivot?: Pivote;

  /** Timeline de visemas de la línea de audio activa (episode_spec: audio.visemas),
   * ya traducida a nuestros 7 códigos — esa traducción (Polly/Rhubarb -> VisemaCode)
   * vive en el pipeline de audio, no aquí. */
  visemas?: Segmento[];
  /** Frame en el que el personaje gira a mirar algo (p.ej. un evento "en_palabra"). */
  mirarEnFrame?: number;
  /** Frame de un parpadeo adicional disparado por un evento (sorpresa), aparte del
   * ciclo de parpadeo idle. */
  parpadeoEnFrame?: number;
  /** false = pose estática, sin breathing/blink/swing (equivalente a desactivar
   * "Personaje animado" en la demo). */
  animar?: boolean;
  /** Clips activos para este personaje en este momento (Fase 7, ver
   * ContextoAnimacion) — resueltos por el llamador (EpisodeRenderer) desde el
   * `gesto`/`locomocion` del spec, no por CharacterPuppet. */
  clips?: ClipAnimacion[];
  /** Frame en el que empezó el gesto activo (spec: `gesto.inicioFrame`) — se resta
   * de `frame` para dar `ctx.clipFrame`, así un gesto que empieza a mitad de la
   * toma reproduce su propio clip desde su frame 0, no desde el frame de la toma. */
  clipsInicioFrame?: number;
}

const BLINK_CURVE = [0.5, 0.12, 0.12, 0.5];
const BLINK_CICLO = 96;

function visemaActivo(visemas: Segmento[] | undefined, frame: number): VisemaCode {
  if (!visemas) return "reposo";
  for (const seg of visemas) {
    if (frame >= seg.inicio_frame && frame < seg.fin_frame) return seg.tipo;
  }
  return "reposo";
}

function Placeholder({ parte, fallback, ctx }: { parte?: ParteVisual; fallback: React.ReactNode; ctx: ContextoAnimacion }) {
  if (parte?.src) {
    return <image href={staticFile(parte.src)} />;
  }
  if (parte?.render) {
    return <>{parte.render(ctx)}</>;
  }
  return <>{fallback}</>;
}

/**
 * Personaje 2D animado por partes — generaliza las fórmulas de render(f) en
 * cabana-lucia.html (breathing, parpadeo, balanceo de la linterna, mirada, cejas) a
 * cualquier personaje del catálogo, con placeholders dibujados cuando todavía no hay
 * arte real para una parte.
 */
export function CharacterPuppet({
  x,
  y,
  escala = 1,
  colorPlaceholder = "#E4AA2F",
  cuerpo,
  cabeza,
  ojosAbiertos,
  ojosCerrados,
  cejas,
  bocas,
  prop,
  apendice,
  cabezaPivot = { x: 0, y: -190 },
  propPivot = { x: 55, y: -150 },
  apendicePivot = { x: -25, y: -210 },
  visemas,
  mirarEnFrame,
  parpadeoEnFrame,
  animar = true,
  clips,
  clipsInicioFrame,
}: CharacterPuppetProps) {
  const frame = useCurrentFrame();

  const breath = animar ? -5 * Math.sin(frame * 0.1) : 0;
  const swing = animar ? 10 * Math.sin(frame * 0.12) : 0;
  const sway = animar ? 6 * Math.sin(frame * 0.09 + 1) : 0;
  const look = animar && mirarEnFrame !== undefined ? smooth(mirarEnFrame, mirarEnFrame + 10, frame) : 0;
  const browUp = animar && mirarEnFrame !== undefined ? 3 * smooth(mirarEnFrame, mirarEnFrame + 6, frame) : 0;

  let blink = 1;
  if (animar) {
    const ciclo = frame % BLINK_CICLO;
    if (ciclo < 4) blink = BLINK_CURVE[ciclo];
    if (parpadeoEnFrame !== undefined) {
      const extra = frame - parpadeoEnFrame;
      if (extra >= 0 && extra < 4) blink = BLINK_CURVE[extra];
    }
  }

  const viseme = visemaActivo(visemas, frame);
  const boca = bocas?.[viseme];
  const ctx: ContextoAnimacion = { animar, frame, clips, clipFrame: clipsInicioFrame !== undefined ? frame - clipsInicioFrame : undefined };

  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <g transform={`translate(0 ${breath})`}>
        <Placeholder
          parte={cuerpo}
          ctx={ctx}
          fallback={<rect x={-45} y={-160} width={90} height={160} rx={30} fill={colorPlaceholder} stroke="#05070A" strokeWidth={4} />}
        />

        <g transform={`rotate(${sway} ${apendicePivot.x} ${apendicePivot.y})`}>
          <Placeholder
            parte={apendice}
            ctx={ctx}
            fallback={<circle cx={apendicePivot.x} cy={apendicePivot.y} r={14} fill="#7a4a2a" stroke="#05070A" strokeWidth={3} />}
          />
        </g>

        <g transform={`rotate(${look * 5} ${cabezaPivot.x} ${cabezaPivot.y})`}>
          <Placeholder
            parte={cabeza}
            ctx={ctx}
            fallback={<circle cx={cabezaPivot.x} cy={cabezaPivot.y} r={55} fill="#E8B08B" stroke="#05070A" strokeWidth={4} />}
          />

          <g transform={`translate(0 ${-browUp})`}>
            <Placeholder
              parte={cejas}
              ctx={ctx}
              fallback={
                <>
                  <rect x={cabezaPivot.x - 32} y={cabezaPivot.y - 20} width={20} height={6} rx={3} fill="#05070A" />
                  <rect x={cabezaPivot.x + 12} y={cabezaPivot.y - 20} width={20} height={6} rx={3} fill="#05070A" />
                </>
              }
            />
          </g>

          <g
            transform={`translate(${look * 4} ${-look}) translate(${cabezaPivot.x} ${cabezaPivot.y}) scale(1 ${blink}) translate(${-cabezaPivot.x} ${-cabezaPivot.y})`}
          >
            <Placeholder
              parte={blink < 0.3 ? ojosCerrados : ojosAbiertos}
              ctx={ctx}
              fallback={
                <>
                  <circle cx={cabezaPivot.x - 20} cy={cabezaPivot.y} r={7} fill="#05070A" />
                  <circle cx={cabezaPivot.x + 20} cy={cabezaPivot.y} r={7} fill="#05070A" />
                </>
              }
            />
          </g>

          <Placeholder parte={boca} ctx={ctx} fallback={<BocaPlaceholder cx={cabezaPivot.x} cy={cabezaPivot.y + 26} viseme={viseme} />} />
        </g>

        <g transform={`rotate(${swing} ${propPivot.x} ${propPivot.y})`}>
          <Placeholder
            parte={prop}
            ctx={ctx}
            fallback={<circle cx={propPivot.x} cy={propPivot.y} r={16} fill="#FFC45E" stroke="#05070A" strokeWidth={3} />}
          />
        </g>
      </g>
    </g>
  );
}

/** Forma de boca de respaldo por visema, solo para poder distinguir visualmente los
 * 7 estados sin arte real todavía: reposo, A, E, O, M/B/P, F/V, L. */
function BocaPlaceholder({ cx, cy, viseme }: { cx: number; cy: number; viseme: VisemaCode }) {
  const forma: Record<VisemaCode, { w: number; h: number; ry: number }> = {
    reposo: { w: 20, h: 6, ry: 3 },
    A: { w: 22, h: 26, ry: 11 },
    E: { w: 30, h: 10, ry: 4 },
    O: { w: 18, h: 18, ry: 9 },
    MBP: { w: 24, h: 3, ry: 1.5 },
    FV: { w: 26, h: 6, ry: 2 },
    L: { w: 16, h: 20, ry: 8 },
  };
  const f = forma[viseme];
  return <ellipse cx={cx} cy={cy} rx={f.w / 2} ry={f.ry} fill="#7A2E2E" stroke="#05070A" strokeWidth={2.5} />;
}
