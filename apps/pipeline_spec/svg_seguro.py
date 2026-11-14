"""Saneamiento de SVG generado por IA (Fase D, docs/PROJECT_ROADMAP.md). Copia
deliberada de apps/web/app/svg_seguro.py — mismo criterio que ya usa el resto de
este directorio (COSTO_PLACEHOLDER_TEXTO_USD, CLIPS_DISPONIBLES en
generar_episode_spec.py): los scripts de apps/pipeline_* no importan código de
apps/web para poder seguir corriendo standalone con un venv mínimo (boto3 +
jsonschema), sin arrastrar pydantic-settings/DATABASE_URL/etc. Si esta lógica
cambia, actualizar las 2 copias.

Usa `xml.etree.ElementTree` (stdlib, sin dependencia nueva) con una lista
blanca explícita: cualquier tag o atributo fuera de la lista se ELIMINA (no se
intenta "arreglar" ni escapar). Primera capa de defensa, no la única — el asset
sigue necesitando aprobación humana antes de usarse en un episodio real, y el
lado de TypeScript vuelve a sanear antes de inyectar (SvgGenerado.tsx, D4).
"""
import xml.etree.ElementTree as ET

TAGS_PERMITIDOS = {
    "svg", "g", "path", "circle", "ellipse", "rect", "line", "polygon", "polyline",
    "defs", "linearGradient", "radialGradient", "stop",
}

ATRIBUTOS_PERMITIDOS = {
    "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
    "width", "height", "points", "fill", "stroke", "stroke-width",
    "stroke-linecap", "stroke-linejoin", "transform", "opacity", "offset",
    "stop-color", "viewBox", "id",
}


class SvgInvalido(ValueError):
    pass


def _nombre_local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _valor_sospechoso(valor: str) -> bool:
    v = valor.strip().lower()
    return "javascript:" in v or "data:text/html" in v


def _sanear_atributos(el: ET.Element) -> None:
    for attr in list(el.attrib):
        nombre = _nombre_local(attr)
        valor = el.attrib[attr]
        if nombre not in ATRIBUTOS_PERMITIDOS or nombre.lower().startswith("on") or _valor_sospechoso(valor):
            del el.attrib[attr]


def _sanear_hijos(el: ET.Element) -> None:
    for hijo in list(el):
        nombre = _nombre_local(hijo.tag)
        if nombre not in TAGS_PERMITIDOS:
            el.remove(hijo)
            continue
        _sanear_atributos(hijo)
        _sanear_hijos(hijo)


def sanear_svg(svg_texto: str) -> str:
    try:
        raiz = ET.fromstring(svg_texto)
    except ET.ParseError as e:
        raise SvgInvalido(f"SVG mal formado: {e}") from e

    if _nombre_local(raiz.tag) != "svg":
        raise SvgInvalido(f"la raíz debe ser <svg>, se encontró <{_nombre_local(raiz.tag)}>")

    _sanear_atributos(raiz)
    _sanear_hijos(raiz)

    if len(raiz) == 0:
        raise SvgInvalido("no quedó ningún elemento dibujable después de sanear — ¿el modelo devolvió algo real?")

    return ET.tostring(raiz, encoding="unicode")
