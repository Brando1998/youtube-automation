import { describe, expect, it } from "vitest";
import { combinarClips, evaluarClip } from "./evaluator";
import type { ClipAnimacion } from "./types";

const clipSimple: ClipAnimacion = {
  id: "prueba",
  categoria: "gesto",
  duracionFrames: 10,
  loop: false,
  pistas: [
    {
      huesoId: "brazo",
      claves: [
        { frame: 0, angulo: 0 },
        { frame: 10, angulo: 100 },
      ],
    },
  ],
};

describe("evaluarClip", () => {
  it("interpola linealmente entre 2 claves", () => {
    expect(evaluarClip(clipSimple, 0).brazo).toBeCloseTo(0, 6);
    expect(evaluarClip(clipSimple, 5).brazo).toBeCloseTo(50, 6);
    expect(evaluarClip(clipSimple, 10).brazo).toBeCloseTo(100, 6);
  });

  it("clip sin loop se queda en el último frame (no se reinicia de golpe)", () => {
    expect(evaluarClip(clipSimple, 15).brazo).toBeCloseTo(100, 6);
    expect(evaluarClip(clipSimple, 1000).brazo).toBeCloseTo(100, 6);
  });

  it("clip sin loop antes de frame 0 se queda en la primera clave", () => {
    expect(evaluarClip(clipSimple, -5).brazo).toBeCloseTo(0, 6);
  });

  it("clip con loop envuelve con módulo (incluyendo frames negativos)", () => {
    const loopClip: ClipAnimacion = { ...clipSimple, loop: true, duracionFrames: 10 };
    expect(evaluarClip(loopClip, 10).brazo).toBeCloseTo(0, 6); // vuelve a empezar
    expect(evaluarClip(loopClip, 25).brazo).toBeCloseTo(50, 6); // 25 % 10 = 5
    expect(evaluarClip(loopClip, -5).brazo).toBeCloseTo(50, 6); // -5 mod 10 = 5
  });

  it("varias pistas (huesos distintos) se evalúan todas", () => {
    const clip: ClipAnimacion = {
      id: "multi",
      categoria: "locomocion",
      duracionFrames: 10,
      loop: true,
      pistas: [
        { huesoId: "muslo", claves: [{ frame: 0, angulo: 80 }, { frame: 10, angulo: 100 }] },
        { huesoId: "pantorrilla", claves: [{ frame: 0, angulo: -10 }, { frame: 10, angulo: 10 }] },
      ],
    };
    const r = evaluarClip(clip, 5);
    expect(r.muslo).toBeCloseTo(90, 6);
    expect(r.pantorrilla).toBeCloseTo(0, 6);
  });

  it("lanza error si una pista tiene menos de 2 claves", () => {
    const clip: ClipAnimacion = { ...clipSimple, pistas: [{ huesoId: "brazo", claves: [{ frame: 0, angulo: 0 }] }] };
    expect(() => evaluarClip(clip, 0)).toThrow(/al menos 2/);
  });

  it("lanza error si las claves no están en orden creciente de frame", () => {
    const clip: ClipAnimacion = {
      ...clipSimple,
      pistas: [{ huesoId: "brazo", claves: [{ frame: 5, angulo: 0 }, { frame: 2, angulo: 10 }] }],
    };
    expect(() => evaluarClip(clip, 0)).toThrow(/orden estrictamente creciente/);
  });

  it("lanza error si duracionFrames no es positivo", () => {
    expect(() => evaluarClip({ ...clipSimple, duracionFrames: 0 }, 0)).toThrow(/duracionFrames/);
  });
});

describe("combinarClips", () => {
  it("huesos distintos de clips distintos conviven sin pisarse", () => {
    const r = combinarClips({ muslo: 10 }, { brazo: 20 });
    expect(r).toEqual({ muslo: 10, brazo: 20 });
  });

  it("si 2 evaluaciones tocan el mismo hueso, gana la última (mayor prioridad)", () => {
    const r = combinarClips({ brazo: 10 }, { brazo: 99 });
    expect(r.brazo).toBe(99);
  });
});
