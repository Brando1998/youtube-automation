"""Saneamiento de SVG generado por IA (Fase D, docs/PROJECT_ROADMAP.md — "crear y
revisar objetos desde la app", opción 2: solo cuando no hay familia paramétrica
que sirva). Usa `xml.etree.ElementTree` (stdlib, sin dependencia nueva — ver
requirements.txt, el proyecto prefiere resolver con lo que ya tiene antes de
sumar una librería) con una lista blanca explícita: cualquier tag o atributo
fuera de la lista se ELIMINA (no se intenta "arreglar" ni escapar).

Esto es la primera capa de defensa, no la única: el asset sigue necesitando
aprobación humana antes de usarse en un episodio real (mismo R3/R4 de REGLAS.md
aplicado a contenido escrito por IA en vez de por un personaje de la
biblioteca) y el lado de TypeScript vuelve a sanear antes de inyectar
(SvgGenerado.tsx, D4) — defensa en profundidad, no confiar en una sola capa.

Nota de alcance: `xml.etree.ElementTree` no expande entidades externas por
defecto en las versiones de Python que usa este proyecto (no hace falta
`defusedxml` para este caso), pero como igual se asume que el contenido no es
de plena confianza, cualquier `<!DOCTYPE>`/entidad declarada se descarta junto
con todo lo demás que no esté en la lista blanca.
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
    """ElementTree antepone el namespace entre llaves si el XML declaraba xmlns
    (p.ej. "{http://www.w3.org/2000/svg}path") — lo sacamos para comparar contra
    la lista blanca, que solo conoce nombres simples."""
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
    """Devuelve el SVG saneado (string) o lanza SvgInvalido con un mensaje claro
    si el XML está mal formado o si no queda ningún elemento dibujable después
    de sanear (p.ej. el modelo devolvió solo <script>, nada real)."""
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
