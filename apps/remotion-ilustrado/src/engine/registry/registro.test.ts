// Pruebas contra el registro REAL (library/registry.ts generado, con los
// personajes/fondos que de verdad existen hoy: tito/rocco/lucia + bosque) — no un
// índice de prueba aparte, para que esto falle de verdad si alguien borra
// metadatos o cambia un tag sin querer.
import { describe, expect, it } from "vitest";
import { buscarPorAssetRef, buscarPorCapacidad, buscarPorId, buscarPorTag, buscarPorTipo, todosLosActivos } from "./registro";

describe("registro de activos", () => {
  it("indexa los 4 activos con metadatos que existen hoy (3 personajes + 1 fondo)", () => {
    expect(todosLosActivos().length).toBe(4);
  });

  it("buscarPorTipo separa personajes de fondos", () => {
    expect(buscarPorTipo("personaje").length).toBe(3);
    expect(buscarPorTipo("fondo").length).toBe(1);
    expect(buscarPorTipo("objeto").length).toBe(0); // todavía no hay objetos reales
  });

  it("buscarPorId encuentra a Lucía por su id estable", () => {
    const encontrado = buscarPorId("character_human_lucia_001");
    expect(encontrado?.assetRef).toBe("2d/personajes/lucia");
    expect(encontrado?.tipo).toBe("personaje");
  });

  it("buscarPorId devuelve undefined para un id que no existe (no lanza, no inventa)", () => {
    expect(buscarPorId("esto_no_existe")).toBeUndefined();
  });

  it("buscarPorAssetRef encuentra el fondo del bosque", () => {
    const encontrado = buscarPorAssetRef("2d/fondos/bosque");
    expect(encontrado?.metadatos.id).toBe("environment_forest_001");
  });

  it("buscarPorTag('biped') encuentra solo a Lucía", () => {
    const resultado = buscarPorTag("biped");
    expect(resultado.map((e) => e.assetRef)).toEqual(["2d/personajes/lucia"]);
  });

  it("buscarPorTag('animal') encuentra a Tito y Rocco, no a Lucía", () => {
    const resultado = buscarPorTag("animal").map((e) => e.assetRef);
    expect(resultado).toContain("2d/personajes/tito");
    expect(resultado).toContain("2d/personajes/rocco");
    expect(resultado).not.toContain("2d/personajes/lucia");
  });

  it("buscarPorCapacidad('tail-wag') encuentra solo a Rocco", () => {
    const resultado = buscarPorCapacidad("tail-wag");
    expect(resultado.map((e) => e.assetRef)).toEqual(["2d/personajes/rocco"]);
  });

  it("buscarPorTag con un tag que nadie tiene devuelve lista vacía, no error", () => {
    expect(buscarPorTag("robot")).toEqual([]);
  });
});
