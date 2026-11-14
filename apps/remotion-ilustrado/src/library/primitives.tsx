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
  if (d === 0) {
    throw new Error(`tangentesExternas: los círculos están en el mismo centro (${a.x},${a.y}) — no hay tangente externa definida.`);
  }
  if (Math.abs(a.r - b.r) >= d) {
    throw new Error(
      `tangentesExternas: geometría inválida — |a.r - b.r| (${Math.abs(a.r - b.r)}) debe ser menor que la distancia entre centros (${d}). ` +
        `Un círculo contiene (o casi contiene) al otro, no hay tangente externa real. Círculos: a=(${a.x},${a.y},r=${a.r}) b=(${b.x},${b.y},r=${b.r}).`
    );
  }
  const theta = Math.atan2(dy, dx);
  // Derivación correcta (verificada con producto punto radio·tangente = 0, ver
  // primitives.test.ts): de cos(θ1-theta) = (a.r-b.r)/d se sigue θ1 = theta ±
  // (90° - alpha), es decir signo MENOS en alpha — no "+alpha" como estaba antes.
  // Con +alpha el error era pequeño para diferencias de radio chicas (por eso no
  // se notó a simple vista en Rocco/Lucía) pero crece con la diferencia de radios.
  const alpha = Math.asin((a.r - b.r) / d);
  const a1 = theta + Math.PI / 2 - alpha;
  const a2 = theta - Math.PI / 2 + alpha;
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

/** ¿`angulo` cae dentro del arco CORTO (el que arcoCorto dibuja por defecto, sin
 * `largo=true`) que va de `inicio` a `fin`? Mismo cálculo de `delta` que arcoCorto,
 * para que esto y el arco que realmente se dibuja usen siempre la misma noción de
 * "corto" — si se calcularan distinto, esta comprobación podría aprobar geometría
 * que arcoCorto en realidad dibuja distinto. */
function anguloDentroDeArcoCorto(angulo: number, inicio: number, fin: number): boolean {
  let delta = fin - inicio;
  delta = ((delta + 180) % 360) - 180;
  if (delta <= -180) delta += 360;
  let offset = angulo - inicio;
  offset = ((offset + 180) % 360) - 180;
  if (offset <= -180) offset += 360;
  return delta >= 0 ? offset > 0 && offset < delta : offset < 0 && offset > delta;
}

/**
 * Confirma que los 2 arcos cortos que se van a dibujar sobre el círculo del hombro
 * (torso->manga-ida y manga-vuelta->cuello) NO se pisan entre sí — si un ángulo del
 * otro par cae adentro del arco, la curva resultante se autointerseca (así se
 * encontró el bug real de Lucía en la Fase 3, docs/PROJECT_ROADMAP.md: "manos"
 * apareciendo junto al cuello en vez de en la muñeca). Antes solo se detectaba
 * mirando el render; ahora falla con un error ANTES de construir el path.
 */
export function validarOrdenAngularHombro(anguloTorso: number, anguloTorsoLado: number, anguloCuelloLado: number, anguloCuello: number): void {
  const cruceTorso = anguloDentroDeArcoCorto(anguloCuelloLado, anguloTorso, anguloTorsoLado) || anguloDentroDeArcoCorto(anguloCuello, anguloTorso, anguloTorsoLado);
  const cruceCuello = anguloDentroDeArcoCorto(anguloTorso, anguloCuelloLado, anguloCuello) || anguloDentroDeArcoCorto(anguloTorsoLado, anguloCuelloLado, anguloCuello);
  if (cruceTorso || cruceCuello) {
    throw new Error(
      `validarOrdenAngularHombro: geometría inválida — el arco torso->manga (${anguloTorso}°->${anguloTorsoLado}°) y el arco manga->cuello ` +
        `(${anguloCuelloLado}°->${anguloCuello}°) se cruzan sobre el círculo del hombro. La curva resultante se autointersecaría. ` +
        `Causa típica: anchoTorsoSuperiorMitad y anchoCuelloMitad demasiado parecidos, o el radio del hombro demasiado chico para la ` +
        `distancia a la mano. Separa más esas medidas o agranda el radio del hombro.`
    );
  }
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
  if (d === 0 || Math.abs(baseR - puntaR) >= d) {
    throw new Error(
      `FormaAhusada: geometría inválida entre base (${baseX},${baseY},r=${baseR}) y punta (${puntaX},${puntaY},r=${puntaR}) — ` +
        `la distancia entre centros (${d}) debe ser mayor que |baseR - puntaR| (${Math.abs(baseR - puntaR)}).`
    );
  }
  const theta = Math.atan2(dy, dx);
  // Mismo signo corregido que tangentesExternas (ver ese comentario y
  // primitives.test.ts) — antes tenía "+alpha", lo correcto es "-alpha".
  const alpha = Math.asin((baseR - puntaR) / d);
  const a1 = theta + Math.PI / 2 - alpha;
  const a2 = theta - Math.PI / 2 + alpha;

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
 * Ángulo (grados) del punto sobre un círculo cuya coordenada X es `targetX` — para
 * especificar geometría por MEDIDA (un ancho objetivo), no por ángulo adivinado
 * (ver REGLAS.md y Fase 3 de docs/PROJECT_ROADMAP.md: "recibe medidas, no ángulos").
 * `ladoInferior` elige cuál de las 2 soluciones (hay 2 puntos del círculo con esa X):
 * `true` = el de mayor Y (hacia abajo, p.ej. hacia la cadera), `false` = el de menor
 * Y (hacia arriba, p.ej. hacia el cuello).
 */
export function anguloParaX(c: Circulo, targetX: number, ladoInferior: boolean): number {
  const rel = (targetX - c.x) / c.r;
  if (rel < -1 || rel > 1) {
    throw new Error(
      `anguloParaX: el ancho objetivo (x=${targetX}) queda fuera del alcance del círculo (centro=${c.x}, radio=${c.r}, rango válido=[${c.x - c.r},${
        c.x + c.r
      }]). Aumenta el radio del hombro o acerca el ancho objetivo al centro.`
    );
  }
  const baseGrados = (Math.acos(rel) * 180) / Math.PI; // siempre en [0,180]
  return ladoInferior ? baseGrados : -baseGrados;
}

/**
 * Medidas (no ángulos, no círculos con posición final) de un torso+brazos humanoide
 * simétrico, lado derecho (x positivo) — se refleja automáticamente para el lado
 * izquierdo. `hombro`/`mano` sí son `Circulo` (posición+radio), porque esos SON la
 * medida real (dónde está el hombro, qué tan grande/redondeado, dónde cae la mano) —
 * lo que NO se expone nunca son los ángulos de las tangentes, esos los resuelve esta
 * función igual que hace FormaAhusada/tangentesExternas internamente.
 */
export interface MedidasTorsoHumanoide {
  caderaY: number;
  /** ancho de la cadera en su propia línea recta (las 2 esquinas de abajo del
   * torso) — NO es lo mismo que dónde el costado del torso se encuentra con el
   * círculo del hombro (ver anchoTorsoSuperiorMitad): un torso real suele ensanchar
   * un poco hacia el hombro, no sube recto. Conflacionar ambas medidas en una sola
   * (como la primera versión de esta función) puede hacer que el ángulo resuelto
   * quede tan cerca del punto de tangencia del brazo que la curva se autointerseca
   * (ver docs/PROGRESS.md, Fase 3 — así se detectó este bug con Lucía).
   */
  anchoCaderaMitad: number;
  /** mitad del ancho del torso justo donde empieza a curvar hacia el hombro —
   * punto de destino real sobre el círculo del hombro (distinto de anchoCaderaMitad
   * salvo que el torso sea perfectamente recto de cadera a hombro). */
  anchoTorsoSuperiorMitad: number;
  /** mitad del ancho del cuello/escote — dónde termina el hombro y empieza la línea
   * recta que cruza al otro lado. */
  anchoCuelloMitad: number;
  /** centro+radio del "blob" del hombro, lado derecho (x debe ser > 0). */
  hombro: Circulo;
  /** centro+radio de la mano, lado derecho (x debe ser > 0). */
  mano: Circulo;
}

/**
 * Construye el `d` de un torso+brazos humanoide como UNA sola curva cerrada
 * (REGLAS.md R1/R2, investigación Open Peeps/Avataaars en docs/PROGRESS.md) —
 * generalización de `TorsoYBrazos` en `lucia.tsx` (Fase 3 del plan maestro,
 * docs/PROJECT_ROADMAP.md): esa versión tenía las medidas escritas a mano para UN
 * personaje; esta recibe medidas como parámetro, cualquier proporción (delgado,
 * robusto, etc.) usa la misma función. Devuelve el string `d` — no un `<path>` ya
 * armado — para que cada personaje decida su propio relleno (color sólido,
 * degradado, lo que sea), igual de simple de envolver que escribir `<path d={...}
 * fill="..." />`.
 */
export function construirTorsoYBrazos(m: MedidasTorsoHumanoide): string {
  const datosLado = (signo: 1 | -1) => {
    const hombro: Circulo = { x: signo * m.hombro.x, y: m.hombro.y, r: m.hombro.r };
    const mano: Circulo = { x: signo * m.mano.x, y: m.mano.y, r: m.mano.r };
    const anguloTorso = anguloParaX(hombro, signo * m.anchoTorsoSuperiorMitad, true);
    const anguloCuello = anguloParaX(hombro, signo * m.anchoCuelloMitad, false);
    const pTorso = puntoEnCirculo(hombro, anguloTorso);
    const pCuello = puntoEnCirculo(hombro, anguloCuello);
    const tan = tangentesExternas(hombro, mano);
    // mismo razonamiento que la versión específica de Lucía: para signo=-1, aP1
    // (que usa +90° antes de restar alpha) cae del lado "abajo/afuera" (torso);
    // para signo=1 se invierte. Ver tangentesExternas para la derivación del signo.
    const [tangTorsoLado, tangCuelloLado, anguloTorsoLado, anguloCuelloLado] =
      signo === -1 ? [tan.aP1, tan.aP2, tan.anguloA1, tan.anguloA2] : [tan.aP2, tan.aP1, tan.anguloA2, tan.anguloA1];
    const [tangTorsoMano, tangCuelloMano] = signo === -1 ? [tan.bP1, tan.bP2] : [tan.bP2, tan.bP1];
    const [anguloManoTorso, anguloManoCuello] = signo === -1 ? [tan.anguloA1, tan.anguloA2] : [tan.anguloA2, tan.anguloA1];
    validarOrdenAngularHombro(anguloTorso, anguloTorsoLado, anguloCuelloLado, anguloCuello);
    return {
      hombro,
      mano,
      pTorso,
      pCuello,
      anguloTorso,
      anguloCuello,
      tangTorsoLado,
      tangCuelloLado,
      anguloTorsoLado,
      anguloCuelloLado,
      tangTorsoMano,
      tangCuelloMano,
      anguloManoTorso,
      anguloManoCuello,
    };
  };

  const izq = datosLado(-1);
  const der = datosLado(1);

  return [
    `M${-m.anchoCaderaMitad} ${m.caderaY}`,
    `L${izq.pTorso.x} ${izq.pTorso.y}`,
    arcoCorto(izq.hombro, izq.anguloTorso, izq.anguloTorsoLado, izq.tangTorsoLado),
    `L${izq.tangTorsoMano.x} ${izq.tangTorsoMano.y}`,
    arcoCorto(izq.mano, izq.anguloManoTorso, izq.anguloManoCuello, izq.tangCuelloMano, true),
    `L${izq.tangCuelloLado.x} ${izq.tangCuelloLado.y}`,
    arcoCorto(izq.hombro, izq.anguloCuelloLado, izq.anguloCuello, izq.pCuello),
    `L${der.pCuello.x} ${der.pCuello.y}`,
    arcoCorto(der.hombro, der.anguloCuello, der.anguloCuelloLado, der.tangCuelloLado),
    `L${der.tangCuelloMano.x} ${der.tangCuelloMano.y}`,
    arcoCorto(der.mano, der.anguloManoCuello, der.anguloManoTorso, der.tangTorsoMano, true),
    `L${der.tangTorsoLado.x} ${der.tangTorsoLado.y}`,
    arcoCorto(der.hombro, der.anguloTorsoLado, der.anguloTorso, der.pTorso),
    `L${m.anchoCaderaMitad} ${m.caderaY}`,
    "Z",
  ].join(" ");
}

/**
 * Medidas de un torso SOLO (sin brazos) — Fase 4 (rigging, docs/PROJECT_ROADMAP.md):
 * cuando los brazos son huesos independientes (`engine/rig`), el torso ya no
 * necesita fundirse con ellos en una sola curva — es más simple que
 * `MedidasTorsoHumanoide` porque no hay manga que tangentear contra una mano.
 */
export interface MedidasTorso {
  caderaY: number;
  anchoCaderaMitad: number;
  anchoTorsoSuperiorMitad: number;
  anchoCuelloMitad: number;
  /** centro+radio del hombro, lado derecho — mismo círculo que debe usar el hueso
   * del brazo correspondiente (ver engine/rig) para que el "cap" de la
   * articulación quede exactamente donde el torso redondea hacia el hombro. */
  hombro: Circulo;
}

/** Construye el `d` de un torso (sin brazos) como una sola curva cerrada — ver
 * `construirTorsoYBrazos` para el porqué de la técnica. Los brazos se dibujan
 * aparte como huesos (`engine/rig/fk.ts` + `FormaAhusada`), cada uno con un "cap"
 * circular en el hombro que tapa la unión con este torso. */
export function construirTorso(m: MedidasTorso): string {
  const lado = (signo: 1 | -1) => {
    const hombro: Circulo = { x: signo * m.hombro.x, y: m.hombro.y, r: m.hombro.r };
    const anguloTorso = anguloParaX(hombro, signo * m.anchoTorsoSuperiorMitad, true);
    const anguloCuello = anguloParaX(hombro, signo * m.anchoCuelloMitad, false);
    return {
      hombro,
      anguloTorso,
      anguloCuello,
      pTorso: puntoEnCirculo(hombro, anguloTorso),
      pCuello: puntoEnCirculo(hombro, anguloCuello),
    };
  };
  const izq = lado(-1);
  const der = lado(1);
  return [
    `M${-m.anchoCaderaMitad} ${m.caderaY}`,
    `L${izq.pTorso.x} ${izq.pTorso.y}`,
    arcoCorto(izq.hombro, izq.anguloTorso, izq.anguloCuello, izq.pCuello),
    `L${der.pCuello.x} ${der.pCuello.y}`,
    arcoCorto(der.hombro, der.anguloCuello, der.anguloTorso, der.pTorso),
    `L${m.anchoCaderaMitad} ${m.caderaY}`,
    "Z",
  ].join(" ");
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
