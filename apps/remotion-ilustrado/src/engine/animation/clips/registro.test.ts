import { describe, expect, it } from "vitest";
import { buscarClip, todosLosClips } from "./registro";

describe("registro de clips", () => {
  it("encuentra los 3 clips reales por su id", () => {
    expect(buscarClip("saludar")?.categoria).toBe("gesto");
    expect(buscarClip("caminar")?.categoria).toBe("locomocion");
    expect(buscarClip("senalar")?.categoria).toBe("gesto");
  });

  it("devuelve undefined para un id que no existe, no lanza ni inventa", () => {
    expect(buscarClip("bailar")).toBeUndefined();
  });

  it("todosLosClips devuelve los 3 clips reales", () => {
    expect(todosLosClips().map((c) => c.id).sort()).toEqual(["caminar", "saludar", "senalar"]);
  });
});
