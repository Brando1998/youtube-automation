// Primeras pruebas reales de geometría (Fase 1, Hito 1b de docs/PROJECT_ROADMAP.md).
// No comprueban "que no truene" — comprueban la propiedad geométrica real (los
// puntos están sobre el círculo que dicen, la línea es tangente de verdad), para
// no repetir el error de hoy: una función que "compila" pero produce geometría
// rota en casos borde (ver docs/PROGRESS.md, sesión 2026-11-07/08/09).
import { describe, expect, it } from "vitest";
import {
  anguloParaX,
  arcoCorto,
  construirTorso,
  construirTorsoYBrazos,
  FormaAhusada,
  puntoEnCirculo,
  tangentesExternas,
  validarAnclaje,
  validarAnclajeConMascara,
  validarOrdenAngularHombro,
  type Circulo,
  type MedidasTorso,
  type MedidasTorsoHumanoide,
} from "./primitives";

function distancia(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

describe("puntoEnCirculo", () => {
  const c: Circulo = { x: 10, y: 20, r: 5 };

  it("devuelve el punto correcto en los 4 ángulos cardinales", () => {
    expect(puntoEnCirculo(c, 0)).toEqual({ x: 15, y: 20 });
    const p90 = puntoEnCirculo(c, 90);
    expect(p90.x).toBeCloseTo(10, 10);
    expect(p90.y).toBeCloseTo(25, 10);
    const p180 = puntoEnCirculo(c, 180);
    expect(p180.x).toBeCloseTo(5, 10);
    expect(p180.y).toBeCloseTo(20, 10);
  });

  it("el punto siempre está a distancia r del centro, para cualquier ángulo", () => {
    for (const grados of [13, 47, 91, 200, 333]) {
      const p = puntoEnCirculo(c, grados);
      expect(distancia(p, c)).toBeCloseTo(c.r, 10);
    }
  });
});

describe("tangentesExternas", () => {
  it("caso normal: los 4 puntos están sobre SU círculo y las líneas son tangentes de verdad", () => {
    const a: Circulo = { x: 0, y: 0, r: 20 };
    const b: Circulo = { x: 80, y: 30, r: 8 };
    const { aP1, aP2, bP1, bP2 } = tangentesExternas(a, b);

    // los puntos caen exactamente sobre su propio círculo
    expect(distancia(aP1, a)).toBeCloseTo(a.r, 8);
    expect(distancia(aP2, a)).toBeCloseTo(a.r, 8);
    expect(distancia(bP1, b)).toBeCloseTo(b.r, 8);
    expect(distancia(bP2, b)).toBeCloseTo(b.r, 8);

    // propiedad de tangencia real: el segmento aP1->bP1 es perpendicular al radio
    // a->aP1 (si no fuera tangente, el producto punto no sería ~0).
    const radioA1 = { x: aP1.x - a.x, y: aP1.y - a.y };
    const lineaA1B1 = { x: bP1.x - aP1.x, y: bP1.y - aP1.y };
    const dot1 = radioA1.x * lineaA1B1.x + radioA1.y * lineaA1B1.y;
    expect(dot1).toBeCloseTo(0, 6);

    const radioA2 = { x: aP2.x - a.x, y: aP2.y - a.y };
    const lineaA2B2 = { x: bP2.x - aP2.x, y: bP2.y - aP2.y };
    const dot2 = radioA2.x * lineaA2B2.x + radioA2.y * lineaA2B2.y;
    expect(dot2).toBeCloseTo(0, 6);
  });

  it("radios iguales: alpha=0, las tangentes quedan perpendiculares a la línea de centros", () => {
    const a: Circulo = { x: 0, y: 0, r: 15 };
    const b: Circulo = { x: 100, y: 0, r: 15 };
    const { aP1, bP1 } = tangentesExternas(a, b);
    // con radios iguales la tangente es paralela a la línea de centros (y=0) ->
    // aP1 y bP1 deben tener la misma y.
    expect(aP1.y).toBeCloseTo(bP1.y, 8);
  });

  it("lanza error descriptivo cuando un círculo contiene al otro (|dr| >= d) en vez de devolver geometría inválida silenciosa", () => {
    const a: Circulo = { x: 0, y: 0, r: 50 };
    const b: Circulo = { x: 10, y: 0, r: 5 }; // b está adentro de a, |50-5|=45 >= d=10
    expect(() => tangentesExternas(a, b)).toThrow(/geometría inválida/);
  });

  it("lanza error cuando los círculos comparten el mismo centro", () => {
    const a: Circulo = { x: 5, y: 5, r: 10 };
    const b: Circulo = { x: 5, y: 5, r: 3 };
    expect(() => tangentesExternas(a, b)).toThrow();
  });
});

describe("FormaAhusada", () => {
  it("no truena con medidas válidas y produce un path con 'd' no vacío", () => {
    const el = FormaAhusada({ baseX: 0, baseY: 0, baseR: 20, puntaX: 60, puntaY: -40, puntaR: 6, color: "#000" });
    expect(el.props.d).toBeTruthy();
    expect(el.props.d.length).toBeGreaterThan(10);
  });

  it("lanza error con medidas inválidas en vez de dibujar una forma rota", () => {
    expect(() => FormaAhusada({ baseX: 0, baseY: 0, baseR: 50, puntaX: 1, puntaY: 0, puntaR: 5, color: "#000" })).toThrow();
  });

  it("propiedad geométrica real: los 2 lados rectos del path son tangentes de verdad (perpendiculares al radio), no solo 'no truena'", () => {
    // Mismo chequeo que tangentesExternas (dot product ~0) pero extrayendo los
    // puntos reales del 'd' que arma FormaAhusada (M<baseP1> L<puntaP1> ... L<baseP2>)
    // — confirma que la geometría INTERNA usada para construir el path (no
    // expuesta como función aparte, a diferencia de tangentesExternas) también
    // tiene la propiedad real de tangencia, con una diferencia de radios grande
    // (el caso que tenía el bug de signo original).
    const baseX = 0, baseY = 0, baseR = 30, puntaX = 90, puntaY = 10, puntaR = 6;
    const el = FormaAhusada({ baseX, baseY, baseR, puntaX, puntaY, puntaR, color: "#000" });
    const numeros = el.props.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // d = `M${baseP1.x} ${baseP1.y}` `L${puntaP1.x} ${puntaP1.y}` `A... ` `L${baseP2.x} ${baseP2.y}` `A...`
    const baseP1 = { x: numeros[0], y: numeros[1] };
    const puntaP1 = { x: numeros[2], y: numeros[3] };
    const radioBase1 = { x: baseP1.x - baseX, y: baseP1.y - baseY };
    const ladoRecto1 = { x: puntaP1.x - baseP1.x, y: puntaP1.y - baseP1.y };
    const dot = radioBase1.x * ladoRecto1.x + radioBase1.y * ladoRecto1.y;
    expect(dot).toBeCloseTo(0, 6);
    expect(distancia(baseP1, { x: baseX, y: baseY })).toBeCloseTo(baseR, 8);
    expect(distancia(puntaP1, { x: puntaX, y: puntaY })).toBeCloseTo(puntaR, 8);
  });
});

describe("anguloParaX", () => {
  const c: Circulo = { x: 10, y: 20, r: 5 };

  it("caso normal: el ángulo devuelto, aplicado a puntoEnCirculo, reproduce targetX", () => {
    const angulo = anguloParaX(c, 13, true);
    expect(puntoEnCirculo(c, angulo).x).toBeCloseTo(13, 8);
  });

  it("ladoInferior=true da Y mayor (hacia abajo), ladoInferior=false da Y menor (hacia arriba), para el mismo targetX", () => {
    const abajo = puntoEnCirculo(c, anguloParaX(c, 12, true));
    const arriba = puntoEnCirculo(c, anguloParaX(c, 12, false));
    expect(abajo.y).toBeGreaterThan(c.y);
    expect(arriba.y).toBeLessThan(c.y);
  });

  it("casos borde exactos (targetX = c.x - r y c.x + r) no truenan", () => {
    expect(() => anguloParaX(c, c.x - c.r, true)).not.toThrow();
    expect(() => anguloParaX(c, c.x + c.r, true)).not.toThrow();
  });

  it("lanza error descriptivo cuando targetX queda fuera del alcance del círculo", () => {
    expect(() => anguloParaX(c, c.x + c.r + 1, true)).toThrow(/fuera del alcance/);
    expect(() => anguloParaX(c, c.x - c.r - 1, true)).toThrow(/fuera del alcance/);
  });
});

describe("validarAnclaje", () => {
  it("ok=true cuando el ancla está bien metida dentro del padre", () => {
    const r = validarAnclaje({ x: 5, y: 0, r: 10 }, { cx: 0, cy: 0, r: 50 });
    expect(r.ok).toBe(true);
  });

  it("ok=false cuando el ancla está flotando afuera del padre", () => {
    const r = validarAnclaje({ x: 100, y: 0, r: 10 }, { cx: 0, cy: 0, r: 50 });
    expect(r.ok).toBe(false);
  });

  it("caso borde: profundidad justo igual a minimaRequerida da ok=true (>=, no >)", () => {
    // padre.r=50, ancla.r=10, minFraccion=0.5 -> minimaRequerida=5. Si el centro del
    // ancla está a distancia 45 del centro del padre, profundidad = 50-45 = 5.
    const r = validarAnclaje({ x: 45, y: 0, r: 10 }, { cx: 0, cy: 0, r: 50 });
    expect(r.profundidad).toBeCloseTo(5, 8);
    expect(r.minimaRequerida).toBeCloseTo(5, 8);
    expect(r.ok).toBe(true);
  });
});

describe("validarAnclajeConMascara", () => {
  it("ok=true cuando el ancla queda cerca del borde del padre (elipse)", () => {
    // padre elíptico rx=40,ry=60 centrado en 0,0 — un punto sobre el borde real
    // (ángulo 30°) normaliza a distancia ~1 por construcción.
    const rad = (30 * Math.PI) / 180;
    const x = 40 * Math.cos(rad);
    const y = 60 * Math.sin(rad);
    const r = validarAnclajeConMascara({ x, y, r: 8 }, { cx: 0, cy: 0, rx: 40, ry: 60 });
    expect(r.ok).toBe(true);
  });

  it("ok=false cuando el ancla está muy adentro (la máscara se comería casi toda la pieza)", () => {
    const r = validarAnclajeConMascara({ x: 0, y: 0, r: 8 }, { cx: 0, cy: 0, rx: 40, ry: 60 });
    expect(r.ok).toBe(false);
  });

  it("ok=false cuando el ancla está muy afuera (se vería flotando)", () => {
    const r = validarAnclajeConMascara({ x: 200, y: 0, r: 8 }, { cx: 0, cy: 0, rx: 40, ry: 60 });
    expect(r.ok).toBe(false);
  });
});

describe("arcoCorto", () => {
  const c: Circulo = { x: 0, y: 0, r: 10 };

  it("sweep=1 cuando el ángulo final es mayor (sentido positivo)", () => {
    const destino = puntoEnCirculo(c, 90);
    const comando = arcoCorto(c, 0, 90, destino);
    expect(comando).toMatch(/^A10 10 0 0 1 /);
  });

  it("sweep=0 cuando el ángulo final es menor (sentido negativo)", () => {
    const destino = puntoEnCirculo(c, 0);
    const comando = arcoCorto(c, 90, 0, destino);
    expect(comando).toMatch(/^A10 10 0 0 0 /);
  });

  it("normaliza correctamente el cruce por 0°/360°", () => {
    const destino = puntoEnCirculo(c, 10);
    const comando = arcoCorto(c, 350, 10, destino); // 350 -> 10 es +20 grados (corto), cruzando 360/0
    expect(comando).toMatch(/^A10 10 0 0 1 /);
  });

  it("largo=true fuerza el large-arc-flag en 1 (usado por construirTorsoYBrazos para el arco de la mano)", () => {
    const destino = puntoEnCirculo(c, 90);
    const comando = arcoCorto(c, 0, 90, destino, true);
    expect(comando).toMatch(/^A10 10 0 1 1 /);
  });
});

describe("validarOrdenAngularHombro", () => {
  it("no lanza error cuando los 2 arcos (torso->manga, manga->cuello) no se cruzan", () => {
    expect(() => validarOrdenAngularHombro(150, 190, 230, 260)).not.toThrow();
  });

  it("lanza error cuando el arco cuello->manga invade el arco torso->manga", () => {
    // 45° cae adentro del arco corto 0°->90° a propósito, para un caso
    // inequívoco (no depende de adivinar qué medida real lo produce).
    expect(() => validarOrdenAngularHombro(0, 90, 45, 200)).toThrow(/autointersecar/);
  });
});

describe("construirTorsoYBrazos", () => {
  const medidasValidas: MedidasTorsoHumanoide = {
    caderaY: -95,
    anchoCaderaMitad: 38,
    anchoTorsoSuperiorMitad: 49.6,
    anchoCuelloMitad: 22,
    hombro: { x: 34, y: -180, r: 18 },
    mano: { x: 57, y: -99, r: 11 },
  };

  it("produce un path cerrado (empieza con M, termina con Z) para medidas válidas", () => {
    const d = construirTorsoYBrazos(medidasValidas);
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("3 proporciones muy distintas (delgado/medio/robusto) no lanzan error — el generador generaliza", () => {
    const base = medidasValidas;
    const delgado: MedidasTorsoHumanoide = {
      caderaY: -95,
      anchoCaderaMitad: 24,
      anchoTorsoSuperiorMitad: 30,
      anchoCuelloMitad: 14,
      hombro: { x: 24, y: -178, r: 12 },
      mano: { x: 48, y: -95, r: 8 },
    };
    const robusto: MedidasTorsoHumanoide = {
      caderaY: -95,
      anchoCaderaMitad: 58,
      anchoTorsoSuperiorMitad: 72,
      anchoCuelloMitad: 26,
      hombro: { x: 48, y: -182, r: 30 },
      mano: { x: 78, y: -100, r: 16 },
    };
    for (const m of [delgado, base, robusto]) {
      expect(() => construirTorsoYBrazos(m)).not.toThrow();
    }
  });

  it("brazo demasiado corto (mano casi pegada al hombro) lanza error en vez de geometría autointersecada silenciosa", () => {
    // Nota: el bug visual original de Lucía (docs/PROJECT_ROADMAP.md Fase 3 —
    // "manos" apareciendo junto al cuello) resultó ser una silueta FEA pero
    // geométricamente válida (sin cruce real), no uno de los casos que este
    // chequeo detecta — se corrigió separando anchoCaderaMitad de
    // anchoTorsoSuperiorMitad, verificado a ojo (render + validar_silueta.mjs),
    // no por este chequeo. Este caso de abajo sí es un cruce real verificado
    // (brazo tan corto que las tangentes del hombro se superponen con las del
    // torso/cuello) — encontrado probando medidas, no adivinado.
    const medidasRotas: MedidasTorsoHumanoide = {
      caderaY: -95,
      anchoCaderaMitad: 20,
      anchoTorsoSuperiorMitad: 20,
      anchoCuelloMitad: 19,
      hombro: { x: 30, y: -170, r: 20 },
      mano: { x: 45, y: -160, r: 5 },
    };
    expect(() => construirTorsoYBrazos(medidasRotas)).toThrow();
  });
});

describe("construirTorso (sin brazos, Fase 4 — brazos como huesos aparte)", () => {
  it("produce un path cerrado para medidas válidas", () => {
    const m: MedidasTorso = {
      caderaY: -95,
      anchoCaderaMitad: 38,
      anchoTorsoSuperiorMitad: 49.6,
      anchoCuelloMitad: 22,
      hombro: { x: 34, y: -180, r: 18 },
    };
    const d = construirTorso(m);
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("no lanza error para las mismas 3 proporciones (delgado/medio/robusto) de la prueba de genericidad", () => {
    const medidas: MedidasTorso[] = [
      { caderaY: -95, anchoCaderaMitad: 24, anchoTorsoSuperiorMitad: 30, anchoCuelloMitad: 14, hombro: { x: 24, y: -178, r: 12 } },
      { caderaY: -95, anchoCaderaMitad: 38, anchoTorsoSuperiorMitad: 49.6, anchoCuelloMitad: 22, hombro: { x: 34, y: -180, r: 18 } },
      { caderaY: -95, anchoCaderaMitad: 58, anchoTorsoSuperiorMitad: 72, anchoCuelloMitad: 26, hombro: { x: 48, y: -182, r: 30 } },
    ];
    for (const m of medidas) {
      expect(() => construirTorso(m)).not.toThrow();
    }
  });
});
