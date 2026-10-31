/**
 * Formas vectoriales reutilizables para la biblioteca (apps/remotion-ilustrado/src/
 * library/). Generaliza lo que antes estaba hardcodeado una sola vez — el fallback
 * de CharacterPuppet.tsx (círculo/rect/óvalos de boca) y las formas de referencia de
 * docs/reference/cabana-lucia.html — en funciones parametrizables por personaje/
 * fondo nuevo. No se inventa un vocabulario nuevo, se extiende el que ya se aprobó
 * visualmente.
 *
 * Todas devuelven un fragmento SVG (sin <svg> propio) — se componen dentro del <g>
 * que ya abre el llamador (CharacterPuppet o una capa de fondo), igual que ya hace
 * CapaFondo.render en los mocks de catalog/fondos.tsx.
 */
import type { VisemaCode } from "../components/CharacterPuppet";
import { contorno, PALETA, TRAZO } from "./styleTokens";

// ---- personaje ----

export function CuerpoBlob({
  x = 0,
  y = 0,
  w,
  h,
  color,
  rx = 30,
}: {
  x?: number;
  y?: number;
  w: number;
  h: number;
  color: string;
  rx?: number;
}) {
  return <rect x={x - w / 2} y={y - h} width={w} height={h} rx={rx} fill={color} {...contorno()} />;
}

export function CabezaRedonda({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return <circle cx={cx} cy={cy} r={r} fill={color} {...contorno()} />;
}

export function OjoAlmendra({ cx, cy, r = 7, color = PALETA.contorno }: { cx: number; cy: number; r?: number; color?: string }) {
  return <circle cx={cx} cy={cy} r={r} fill={color} />;
}

export function OjoCerrado({ cx, cy, w = 14 }: { cx: number; cy: number; w?: number }) {
  return <path d={`M${cx - w / 2} ${cy} Q${cx} ${cy + 5} ${cx + w / 2} ${cy}`} fill="none" {...contorno(TRAZO.fino)} />;
}

export function Ceja({ cx, cy, w = 20, inclinacion = 0 }: { cx: number; cy: number; w?: number; inclinacion?: number }) {
  const dy = (w / 2) * Math.tan((inclinacion * Math.PI) / 180);
  return <path d={`M${cx - w / 2} ${cy + dy} L${cx + w / 2} ${cy - dy}`} {...contorno(TRAZO.medio)} strokeLinecap="round" />;
}

export function Miembro({
  x1,
  y1,
  x2,
  y2,
  grosor = 14,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  grosor?: number;
  color: string;
}) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={grosor} strokeLinecap="round" />;
}

/** Tabla de las 7 formas de boca por visema (misma tabla que BocaPlaceholder en
 * CharacterPuppet.tsx), parametrizada por posición/color en vez de hardcodeada por
 * personaje — así un personaje nuevo saca su set completo de bocas con una sola
 * llamada. */
export function bocasDesdeForma(cx: number, cy: number, color: string = PALETA.boca) {
  const forma: Record<VisemaCode, { w: number; ry: number }> = {
    reposo: { w: 20, ry: 3 },
    A: { w: 22, ry: 11 },
    E: { w: 30, ry: 4 },
    O: { w: 18, ry: 9 },
    MBP: { w: 24, ry: 1.5 },
    FV: { w: 26, ry: 2 },
    L: { w: 16, ry: 8 },
  };
  const bocas: Partial<Record<VisemaCode, { render: () => React.ReactNode }>> = {};
  for (const codigo of Object.keys(forma) as VisemaCode[]) {
    const f = forma[codigo];
    bocas[codigo] = {
      render: () => <ellipse cx={cx} cy={cy} rx={f.w / 2} ry={f.ry} fill={color} {...contorno(TRAZO.fino)} />,
    };
  }
  return bocas;
}

// ---- fondo / escenario ----

export function Techo({ x, y, w, h, color = PALETA.madera.sombra }: { x: number; y: number; w: number; h: number; color?: string }) {
  return <path d={`M${x - w / 2} ${y} L${x} ${y - h} L${x + w / 2} ${y}Z`} fill={color} {...contorno(TRAZO.grueso)} />;
}

export function Ventana({ x, y, w, h, encendida = true }: { x: number; y: number; w: number; h: number; encendida?: boolean }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill={encendida ? PALETA.acento.calido : "#1a1510"} {...contorno()} />
      <line x1={x} y1={y - h / 2} x2={x} y2={y + h / 2} {...contorno(TRAZO.fino)} />
    </g>
  );
}

/** Silueta de árbol simple: tronco + copa redondeada, mismo espíritu que las
 * "tufts" de cabana-lucia.html pero generalizado por posición/tamaño/tono. */
export function Arbol({ x, y, alto, ancho, tono = PALETA.follaje.medio }: { x: number; y: number; alto: number; ancho: number; tono?: string }) {
  const troncoAlto = alto * 0.25;
  return (
    <g>
      <rect x={x - ancho * 0.08} y={y - troncoAlto} width={ancho * 0.16} height={troncoAlto} fill={PALETA.madera.tronco} {...contorno(TRAZO.fino)} />
      <path
        d={`M${x} ${y - alto} Q${x - ancho / 2} ${y - alto * 0.55} ${x - ancho * 0.3} ${y - troncoAlto} Q${x} ${y - troncoAlto * 1.4} ${x + ancho * 0.3} ${y - troncoAlto} Q${x + ancho / 2} ${y - alto * 0.55} ${x} ${y - alto}Z`}
        fill={tono}
        {...contorno(TRAZO.medio)}
      />
    </g>
  );
}

/** Silueta de montaña/colina lejana — una sola curva suave, pensada para la capa
 * más al fondo (depth bajo). */
export function Colina({ y, amplitud, tono }: { y: number; amplitud: number; tono: string }) {
  return (
    <path
      d={`M-80 ${y + amplitud} Q140 ${y - amplitud} 300 ${y} T620 ${y + amplitud * 0.6} L620 960 L-80 960Z`}
      fill={tono}
      {...contorno(TRAZO.medio)}
    />
  );
}
