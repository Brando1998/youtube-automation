import { describe, expect, it } from "vitest";
import { extraerContenidoInterno, sanearSvgCliente } from "./svgSeguro";

describe("extraerContenidoInterno", () => {
  it("saca el <svg> exterior y deja solo el contenido", () => {
    const completo = '<svg viewBox="-30 -30 60 60"><circle cx="0" cy="0" r="20" fill="red" /></svg>';
    expect(extraerContenidoInterno(completo)).toBe('<circle cx="0" cy="0" r="20" fill="red" />');
  });

  it("no rompe si ya viene sin el wrapper (defensivo)", () => {
    const sinWrapper = '<circle cx="0" cy="0" r="20" fill="red" />';
    expect(extraerContenidoInterno(sinWrapper)).toBe(sinWrapper);
  });
});

describe("sanearSvgCliente (segunda capa, defensa en profundidad)", () => {
  it("elimina <script>", () => {
    const sucio = '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="20" fill="red"/><script>alert(1)</script></svg>';
    const limpio = sanearSvgCliente(sucio);
    expect(limpio).not.toContain("<script");
    expect(limpio).toContain("<circle");
  });

  it("elimina atributos onload/onclick", () => {
    const sucio = '<svg onload="alert(1)"><circle cx="30" cy="30" r="20" onclick="alert(2)" fill="red"/></svg>';
    const limpio = sanearSvgCliente(sucio);
    expect(limpio).not.toMatch(/on\w+\s*=/);
    expect(limpio).toContain("<circle");
  });

  it("elimina <image> y <use>", () => {
    const sucio = '<svg><image href="http://evil.test/x.png"/><use href="#x"/><rect x="0" y="0" width="10" height="10"/></svg>';
    const limpio = sanearSvgCliente(sucio);
    expect(limpio).not.toContain("<image");
    expect(limpio).not.toContain("<use");
    expect(limpio).toContain("<rect");
  });

  it("elimina javascript: de cualquier atributo", () => {
    const sucio = '<svg><a href="javascript:alert(1)"><circle cx="30" cy="30" r="20" fill="green"/></a></svg>';
    const limpio = sanearSvgCliente(sucio);
    expect(limpio).not.toContain("javascript:");
  });

  it("deja intacto un SVG simple sin nada peligroso", () => {
    const limpio_input = '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="20" fill="#D94B4B" stroke="#000" stroke-width="2"/></svg>';
    expect(sanearSvgCliente(limpio_input)).toBe(limpio_input);
  });
});
