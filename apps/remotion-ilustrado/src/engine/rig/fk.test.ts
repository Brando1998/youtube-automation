import { describe, expect, it } from "vitest";
import { evaluarFK } from "./fk";
import type { Articulacion } from "./types";

describe("evaluarFK", () => {
  it("un solo hueso, ángulo 0: el extremo distal queda a `longitud` unidades a la derecha", () => {
    const huesos: Articulacion[] = [{ id: "a", longitud: 50, anguloReposo: 0, radioProximal: 10, radioDistal: 6 }];
    const pose = evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 });
    expect(pose.a.proximal).toEqual({ x: 0, y: 0, anguloMundo: 0 });
    expect(pose.a.distal.x).toBeCloseTo(50, 8);
    expect(pose.a.distal.y).toBeCloseTo(0, 8);
  });

  it("un solo hueso rotado 90°: el extremo distal queda `longitud` unidades hacia abajo (convención SVG, y+ = abajo)", () => {
    const huesos: Articulacion[] = [{ id: "a", longitud: 50, anguloReposo: 90, radioProximal: 10, radioDistal: 6 }];
    const pose = evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 });
    expect(pose.a.distal.x).toBeCloseTo(0, 6);
    expect(pose.a.distal.y).toBeCloseTo(50, 6);
  });

  it("cadena de 2 huesos: la rotación del padre arrastra al hijo (igual que un brazo real)", () => {
    const huesos: Articulacion[] = [
      { id: "brazo", longitud: 40, anguloReposo: 0, radioProximal: 12, radioDistal: 8 },
      { id: "antebrazo", padreId: "brazo", longitud: 35, anguloReposo: 0, radioProximal: 8, radioDistal: 5 },
    ];
    // con ambos ángulos en 0, la cadena es una línea recta de 75 de largo
    const recto = evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 });
    expect(recto.antebrazo.distal.x).toBeCloseTo(75, 6);

    // rotar el PADRE 90° debe mover al hijo también (hereda la orientación)
    const rotado = evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 }, { brazo: 90 });
    expect(rotado.brazo.distal.x).toBeCloseTo(0, 6);
    expect(rotado.brazo.distal.y).toBeCloseTo(40, 6);
    // el antebrazo sigue en ángulo local 0 -> continúa en la misma dirección (90°
    // en el mundo) desde donde terminó el brazo
    expect(rotado.antebrazo.distal.x).toBeCloseTo(0, 6);
    expect(rotado.antebrazo.distal.y).toBeCloseTo(75, 6);
  });

  it("el ángulo local del hijo se SUMA al ángulo acumulado del padre, no lo reemplaza", () => {
    const huesos: Articulacion[] = [
      { id: "brazo", longitud: 40, anguloReposo: 0, radioProximal: 12, radioDistal: 8 },
      { id: "antebrazo", padreId: "brazo", longitud: 35, anguloReposo: 0, radioProximal: 8, radioDistal: 5 },
    ];
    const pose = evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 }, { brazo: 90, antebrazo: -90 });
    // -90 local sobre 90 acumulado = 0 en el mundo -> el antebrazo apunta horizontal
    expect(pose.antebrazo.distal.x).toBeCloseTo(35, 6);
    expect(pose.antebrazo.distal.y).toBeCloseTo(40, 6);
  });

  it("lanza error si no hay raíz (todos los huesos tienen padreId)", () => {
    const huesos: Articulacion[] = [{ id: "a", padreId: "b", longitud: 10, anguloReposo: 0, radioProximal: 5, radioDistal: 5 }];
    expect(() => evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 })).toThrow(/raíz/);
  });

  it("lanza error si hay más de una raíz", () => {
    const huesos: Articulacion[] = [
      { id: "a", longitud: 10, anguloReposo: 0, radioProximal: 5, radioDistal: 5 },
      { id: "b", longitud: 10, anguloReposo: 0, radioProximal: 5, radioDistal: 5 },
    ];
    expect(() => evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 })).toThrow(/más de una raíz/);
  });

  it("lanza error si un hueso referencia un padreId inexistente", () => {
    const huesos: Articulacion[] = [
      { id: "a", longitud: 10, anguloReposo: 0, radioProximal: 5, radioDistal: 5 },
      { id: "b", padreId: "fantasma", longitud: 10, anguloReposo: 0, radioProximal: 5, radioDistal: 5 },
    ];
    expect(() => evaluarFK(huesos, { x: 0, y: 0, anguloMundo: 0 })).toThrow(/padreId/);
  });
});
