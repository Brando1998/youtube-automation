/**
 * Segunda capa de saneo de SVG generado por IA (Fase D, docs/PROJECT_ROADMAP.md)
 * — defensa en profundidad, NO la capa principal. La capa principal (que hace el
 * trabajo real, con un parser XML real y lista blanca de tags/atributos) es
 * `apps/web/app/svg_seguro.py`, del lado del servidor, antes de guardar el SVG
 * aprobado. Esta capa vuelve a limpiar lo mismo justo antes de inyectarlo con
 * `dangerouslySetInnerHTML` (SvgGenerado.tsx) — por si algo entre la aprobación
 * y el render llegó a cambiar.
 *
 * A propósito NO usa DOMParser (no existe en el entorno de pruebas de Vitest,
 * configurado "node" — ver vitest.config.ts; si existiera dependencia de DOM
 * acá, esto no se podría probar sin un navegador real). Es un scrubber por
 * texto/regex, más simple que un parser XML real — suficiente para una SEGUNDA
 * capa que solo necesita atrapar lo obviamente peligroso, no validar la
 * estructura completa (eso ya lo hizo la capa principal).
 */

const PATRONES_PELIGROSOS: RegExp[] = [
  /<script[\s>][\s\S]*?(<\/script>|$)/gi,
  /<foreignObject[\s>][\s\S]*?(<\/foreignObject>|$)/gi,
  /<image\b[^>]*>/gi,
  /<use\b[^>]*>/gi,
  /\son\w+\s*=\s*"[^"]*"/gi,
  /\son\w+\s*=\s*'[^']*'/gi,
  /javascript:/gi,
];

export function sanearSvgCliente(svg: string): string {
  let limpio = svg;
  for (const patron of PATRONES_PELIGROSOS) {
    limpio = limpio.replace(patron, "");
  }
  return limpio;
}

/**
 * El SVG guardado (salida de apps/web/app/svg_seguro.py) es un documento
 * completo (`<svg viewBox="...">...</svg>`) — pero SvgGenerado.tsx lo inyecta
 * DENTRO de un `<g>` que ya vive en el `<svg>` de la composición que lo usa
 * (p.ej. PreviewObjeto, mismo patrón que cualquier ParteVisual). Un `<svg>`
 * anidado sin su propio width/height no tiene tamaño por defecto — queda
 * invisible aunque el contenido esté bien (encontrado renderizando de verdad,
 * no en una revisión de código: el primer PreviewSvgGenerado salió en blanco).
 * Por eso esta función saca SOLO el contenido de adentro, descartando el tag
 * `<svg>` exterior — el viewBox original no se pierde en los hechos porque el
 * prompt de generar_objeto_ia.py siempre fija el mismo viewBox fijo
 * ("-30 -30 60 60"), y quien monta `<SvgGenerado>` ya asume esa convención.
 */
export function extraerContenidoInterno(svg: string): string {
  return svg.trim().replace(/^<svg\b[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
}
