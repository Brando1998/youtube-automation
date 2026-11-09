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

export interface Circulo {
  x: number;
  y: number;
  r: number;
}

/**
 * Los 4 puntos de tangente externa entre 2 círculos — la misma matemática que usa
 * FormaAhusada, expuesta como datos (no como <path> ya armado) para poder encadenar
 * varios círculos en un solo path propio (ver TorsoYBrazos en lucia.tsx: evita el
 * problema de "piezas separadas que hay que solapar/alinear" construyendo todo el
 * torso+brazos como UNA sola curva, igual que haría un ilustrador a mano — ver
 * REGLAS.md R1/R2 e investigación sobre Open Peeps/Avataaars en docs/PROGRESS.md).
 */
export function tangentesExternas(a: Circulo, b: Circulo) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx);
  const alpha = Math.asin(Math.min(0.999, Math.max(-0.999, (a.r - b.r) / d)));
  const a1 = theta + Math.PI / 2 + alpha;
  const a2 = theta - Math.PI / 2 - alpha;
  return {
    aP1: { x: a.x + a.r * Math.cos(a1), y: a.y + a.r * Math.sin(a1) },
    aP2: { x: a.x + a.r * Math.cos(a2), y: a.y + a.r * Math.sin(a2) },
    bP1: { x: b.x + b.r * Math.cos(a1), y: b.y + b.r * Math.sin(a1) },
    bP2: { x: b.x + b.r * Math.cos(a2), y: b.y + b.r * Math.sin(a2) },
    // ángulos (grados) de cada punto sobre SU circulo — para armar el comando "A"
    // correcto con arcoCorto() en vez de adivinar los flags de large-arc/sweep.
    anguloA1: (a1 * 180) / Math.PI,
    anguloA2: (a2 * 180) / Math.PI,
  };
}

/**
 * Comando SVG "A" entre 2 puntos del MISMO círculo, dados por su ángulo (grados) —
 * calcula large-arc-flag y sweep-flag desde la diferencia angular real, en vez de
 * adivinarlos. Pasar solo radio+flags sin fijar el centro es ambiguo: para un mismo
 * par de puntos y radio hay 2 centros posibles (el real y su espejo), y un flag
 * equivocado dibuja el arco alrededor del centro equivocado — eso es lo que abrió
 * el hueco en el hombro de Lucía. `largo=true` fuerza el arco mayor (>180°) en vez
 * del corto (por defecto).
 */
export function arcoCorto(c: Circulo, anguloInicioGrados: number, anguloFinGrados: number, destino: { x: number; y: number }, largo = false) {
  let delta = anguloFinGrados - anguloInicioGrados;
  delta = ((delta + 180) % 360) - 180; // normaliza a (-180, 180]
  if (delta <= -180) delta += 360;
  const sweep = delta >= 0 ? 1 : 0;
  const largeArcFlag = largo ? 1 : 0;
  return `A${c.r} ${c.r} 0 ${largeArcFlag} ${sweep} ${destino.x} ${destino.y}`;
}

/** Punto sobre el borde de un círculo en un ángulo dado (grados). */
export function puntoEnCirculo(c: Circulo, grados: number) {
  const rad = (grados * Math.PI) / 180;
  return { x: c.x + c.r * Math.cos(rad), y: c.y + c.r * Math.sin(rad) };
}

/**
 * Forma ahusada construida geométricamente a partir de 2 círculos (base ancha +
 * punta angosta) y sus tangentes exactas — el equivalente 2D del criterio de
 * metaballs que ya usa el pipeline 3D (assets/common/geo.py: fundir superponiendo,
 * no solo tocar en un punto). Sirve para colas/orejas/cuernos/ramas: cualquier
 * apéndice que sale de un cuerpo y se afina hacia una punta.
 *
 * Para que se vea pegado al cuerpo (no flotando), el círculo base debe quedar
 * BIEN DENTRO de la silueta del cuerpo que lo lleva (no solo tocando el borde) —
 * misma lección que el fix de assets/vegetacion/arbusto.py en docs/PROGRESS.md.
 */
export function FormaAhusada({
  baseX,
  baseY,
  baseR,
  puntaX,
  puntaY,
  puntaR,
  color,
  trazo = TRAZO.medio,
}: {
  baseX: number;
  baseY: number;
  baseR: number;
  puntaX: number;
  puntaY: number;
  puntaR: number;
  color: string;
  trazo?: number;
}) {
  const dx = puntaX - baseX;
  const dy = puntaY - baseY;
  const d = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx);
  // Ángulo de las tangentes externas entre los 2 círculos — fórmula estándar
  // (asin válido porque siempre forzamos baseR > puntaR y d > baseR - puntaR).
  const alpha = Math.asin(Math.min(0.999, Math.max(-0.999, (baseR - puntaR) / d)));
  const a1 = theta + Math.PI / 2 + alpha;
  const a2 = theta - Math.PI / 2 - alpha;

  const baseP1 = { x: baseX + baseR * Math.cos(a1), y: baseY + baseR * Math.sin(a1) };
  const baseP2 = { x: baseX + baseR * Math.cos(a2), y: baseY + baseR * Math.sin(a2) };
  const puntaP1 = { x: puntaX + puntaR * Math.cos(a1), y: puntaY + puntaR * Math.sin(a1) };
  const puntaP2 = { x: puntaX + puntaR * Math.cos(a2), y: puntaY + puntaR * Math.sin(a2) };

  const d_path = [
    `M${baseP1.x} ${baseP1.y}`,
    `L${puntaP1.x} ${puntaP1.y}`,
    `A${puntaR} ${puntaR} 0 1 1 ${puntaP2.x} ${puntaP2.y}`,
    `L${baseP2.x} ${baseP2.y}`,
    `A${baseR} ${baseR} 0 0 0 ${baseP1.x} ${baseP1.y}`,
    "Z",
  ].join(" ");

  return <path d={d_path} fill={color} {...contorno(trazo)} />;
}

/**
 * Chequeo geométrico de anclaje para FUSIÓN SÓLIDA (sin máscara) — misma convención
 * que los puntos de attachment en rigs 3D estándar: el centro del anclaje debe
 * quedar metido al menos la mitad de su propio radio dentro de la silueta padre,
 * igual que la lección de assets/vegetacion/arbusto.py (fundir metaballs
 * superponiendo, no solo tocando). Úsalo cuando la pieza hija se pinta ENCIMA del
 * padre sin recortarla — su color debe fundirse visualmente por el solape mismo.
 *
 * NO uses esta regla si vas a recortar la pieza con una máscara (ver
 * validarAnclajeConMascara) — ahí un solape profundo ocultaría más de la cuenta.
 * No es lo mismo que "tocarse": un componente conectado por 1 píxel (ver
 * validar_silueta.mjs, caso rocco_v4 con la cola dibujada a mano) pasa la prueba de
 * conectividad de píxeles mientras falla esta, que es la que de verdad predice si
 * se va a VER pegado o flotando.
 */
export function validarAnclaje(
  ancla: { x: number; y: number; r: number },
  padre: { cx: number; cy: number; r: number },
  minFraccion = 0.5
): { ok: boolean; profundidad: number; minimaRequerida: number } {
  const d = Math.hypot(ancla.x - padre.cx, ancla.y - padre.cy);
  const profundidad = padre.r - d; // cuánto del centro del ancla queda dentro del padre
  const minimaRequerida = minFraccion * ancla.r;
  return { ok: profundidad >= minimaRequerida, profundidad, minimaRequerida };
}

/**
 * Chequeo geométrico de anclaje para RECORTE CON MÁSCARA (técnica de rocco.tsx: la
 * mitad que cae dentro del padre se oculta con <mask>, no se funde por color). Acá
 * lo correcto es que el centro del ancla quede CERCA DEL BORDE del padre (ni muy
 * afuera → se ve flotando y sin ocultar nada; ni muy adentro → la máscara se come
 * casi toda la pieza), no profundamente embebido. El padre se aproxima como elipse
 * porque CuerpoBlob (rx grande) casi nunca es un círculo real.
 */
export function validarAnclajeConMascara(
  ancla: { x: number; y: number; r: number },
  padre: { cx: number; cy: number; rx: number; ry: number },
  toleranciaFraccion = 0.6
): { ok: boolean; distanciaNormalizada: number; tolerancia: number } {
  const distanciaNormalizada = Math.hypot((ancla.x - padre.cx) / padre.rx, (ancla.y - padre.cy) / padre.ry);
  // escala local aprox. del radio del ancla a unidades normalizadas de la elipse
  const escalaLocal = (padre.rx + padre.ry) / 2;
  const tolerancia = (toleranciaFraccion * ancla.r) / escalaLocal;
  return { ok: Math.abs(distanciaNormalizada - 1) <= tolerancia, distanciaNormalizada, tolerancia };
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
