// Pruebas contra el registro REAL (library/registry.ts generado, con los
// personajes/fondos/objetos que de verdad existen hoy: tito/rocco/lucia/
// persona-generica + bosque + corazon/cerebro) — no un índice de prueba aparte,
// para que esto falle de verdad si alguien borra metadatos o cambia un tag sin
// querer.
import { describe, expect, it } from "vitest";
import { buscarPorAssetRef, buscarPorCapacidad, buscarPorId, buscarPorTag, buscarPorTipo, todosLosActivos } from "./registro";

describe("registro de activos", () => {
  it("indexa los 7 activos con metadatos que existen hoy (4 personajes + 1 fondo + 2 objetos)", () => {
    expect(todosLosActivos().length).toBe(7);
  });

  it("buscarPorTipo separa personajes, fondos y objetos", () => {
    expect(buscarPorTipo("personaje").length).toBe(4);
    expect(buscarPorTipo("fondo").length).toBe(1);
    expect(buscarPorTipo("objeto").length).toBe(2);
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

  it("buscarPorTag('biped') encuentra a Lucía y a la persona genérica, no a los animales", () => {
    const resultado = buscarPorTag("biped").map((e) => e.assetRef);
    expect(resultado).toContain("2d/personajes/lucia");
    expect(resultado).toContain("2d/personajes/persona-generica");
    expect(resultado).not.toContain("2d/personajes/tito");
    expect(resultado).not.toContain("2d/personajes/rocco");
  });

  it("buscarPorTag('corazon') encuentra el objeto corazón", () => {
    const resultado = buscarPorTag("corazon");
    expect(resultado.map((e) => e.assetRef)).toEqual(["2d/objetos/corazon"]);
    expect(resultado[0].tipo).toBe("objeto");
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
