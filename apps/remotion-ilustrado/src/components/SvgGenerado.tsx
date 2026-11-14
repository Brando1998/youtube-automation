import { extraerContenidoInterno, sanearSvgCliente } from "../engine/svgSeguro";

/**
 * Renderiza un SVG generado por IA y ya aprobado (Fase D, docs/PROJECT_ROADMAP.md
 * — objetos sin equivalente en la biblioteca de código ni en ninguna familia
 * paramétrica). El SVG ya pasó por el saneador principal del lado del servidor
 * (apps/web/app/svg_seguro.py) antes de guardarse — esto vuelve a limpiarlo
 * (defensa en profundidad, ver engine/svgSeguro.ts) antes de inyectarlo.
 *
 * `dangerouslySetInnerHTML` es seguro de usar acá porque Remotion renderiza
 * sobre un Chromium real (no SSR sin DOM) — mismo motivo por el que esta
 * técnica nunca se intentó para contenido de usuario en un contexto de servidor
 * puro.
 *
 * Pendiente, fuera de alcance de esta fase (documentado en
 * docs/PROJECT_ROADMAP.md): todavía no existe ningún mecanismo para colocar un
 * objeto — de este origen o de cualquier otro, biblioteca fija o familia — DENTRO
 * de una escena real (el episode_spec no tiene ese concepto para objetos
 * todavía). Este componente queda listo para cuando se construya eso.
 */
export function SvgGenerado({ svg }: { svg: string }) {
  const seguro = sanearSvgCliente(extraerContenidoInterno(svg));
  return <g dangerouslySetInnerHTML={{ __html: seguro }} />;
}
