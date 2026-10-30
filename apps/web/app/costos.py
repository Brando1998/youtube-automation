"""Estimador de costo + guardia de presupuesto por episodio.

Precios verificados contra páginas oficiales de AWS (no adivinados):
- Polly: https://aws.amazon.com/polly/pricing/ (confirmado en esta sesión, 2026-10-30).
- Stability (operaciones de edición — remove-background, search-and-replace):
  https://aws.amazon.com/bedrock/pricing/ (confirmado en esta sesión, 2026-10-30).
- Stability (texto-a-imagen — Stable Image Core/Ultra): la página de pricing de
  Bedrock es dinámica y esta sesión no pudo volver a extraer esas dos cifras del
  HTML; se reusan los valores que una sesión anterior sí verificó y dejó registrados
  en docs/PROGRESS.md ("Ultra ~$0.08/imagen, Core ~$0.03/imagen"). **Revisar de nuevo
  contra https://aws.amazon.com/bedrock/pricing/ antes de la prueba real de la Fase F**,
  marcados como aproximados (~) a propósito.
- Bedrock Nova/Claude (generación de texto, usado por generar_episode_spec.py): esta
  sesión no logró extraer cifras confiables de precio por token (los números que la
  página devolvió eran inconsistentes entre sí). En vez de inventar un precio por
  token, se usa un placeholder plano conservador por intento — el costo real que
  importa (texto, unos pocos miles de tokens) es muy por debajo de lo que domina el
  presupuesto de un video (imágenes/voz), así que un placeholder conservador alcanza
  para la guardia de presupuesto sin fingir precisión que no se pudo verificar.

Los mismos números viven también (duplicados a propósito, mismo criterio que el
resto del proyecto de no cruzar imports entre apps/pipeline_*) como constantes
locales en cada script de apps/pipeline_2d y apps/pipeline_audio, para que puedan
calcular y loguear su uso REAL después de una corrida sin depender de este módulo.
Si se actualiza un precio acá, actualizar también la constante equivalente del lado
del script.
"""
from decimal import Decimal, ROUND_HALF_UP

# ---- Stability AI vía Bedrock ----
PRECIO_STABLE_IMAGE_CORE_USD = Decimal("0.03")   # ~ (ver nota arriba)
PRECIO_STABLE_IMAGE_ULTRA_USD = Decimal("0.08")  # ~ (ver nota arriba)
PRECIO_STABILITY_EDICION_USD = Decimal("0.07")   # remove-background, search-and-replace (confirmado)

# ---- Amazon Polly (USD por carácter) ----
PRECIO_POLLY_POR_CARACTER = {
    "standard": Decimal("4.00") / Decimal("1000000"),
    "neural": Decimal("16.00") / Decimal("1000000"),
    "long-form": Decimal("100.00") / Decimal("1000000"),
    "generative": Decimal("30.00") / Decimal("1000000"),
}

# ---- Generación de texto (Bedrock Nova/Claude) — placeholder conservador ----
COSTO_PLACEHOLDER_TEXTO_USD = Decimal("0.05")  # por intento; ver nota arriba


def _redondear(valor: Decimal) -> float:
    return float(valor.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


def estimar_partes_personaje(regiones: dict) -> float:
    """5 partes simples + boca_reposo + 6 visemas (2 llamadas c/u: search_replace +
    remove_bg) + prop opcional — mismo conteo real de llamadas que generar_partes.py
    (el conteo de `len(plan)` que imprime su --dry-run NO es el número real de
    llamadas: cada visema son 2 llamadas, no 1 — ver generar_partes.py)."""
    llamadas = 5 + 1 + (6 * 2)
    if "prop" in regiones:
        llamadas += 1
    return _redondear(PRECIO_STABILITY_EDICION_USD * llamadas)


def estimar_fondo(spec: dict) -> float:
    """2 llamadas por capa (text-to-image Core + remove_bg)."""
    n_capas = len(spec.get("capas", []))
    return _redondear(n_capas * (PRECIO_STABLE_IMAGE_CORE_USD + PRECIO_STABILITY_EDICION_USD))


def estimar_voz_polly(texto: str, engine: str) -> float:
    """2 llamadas a Polly por línea (marcas + mp3), ambas sintetizan el mismo texto
    completo — se cobra por carácter en cada una."""
    precio = PRECIO_POLLY_POR_CARACTER.get(engine, PRECIO_POLLY_POR_CARACTER["neural"])
    return _redondear(Decimal(len(texto)) * precio * 2)


def estimar_episode_spec(max_reintentos: int) -> float:
    """Caso peor: hasta max_reintentos intentos, cada uno con el placeholder plano."""
    return _redondear(COSTO_PLACEHOLDER_TEXTO_USD * max_reintentos)


def estimar_hoja_personaje() -> float:
    return _redondear(PRECIO_STABLE_IMAGE_CORE_USD)


def estimar_costo_job(tipo: str, params: dict) -> float | None:
    """Estimación pre-vuelo del costo de un job real (no simulado), o None si el
    tipo no tiene costo AWS atribuible (p.ej. render_episodio, que renderiza local)."""
    if tipo == "hoja_personaje":
        return estimar_hoja_personaje()
    if tipo == "partes_personaje":
        return estimar_partes_personaje(params.get("regiones") or {})
    if tipo == "fondo":
        return estimar_fondo(params.get("spec") or {})
    if tipo == "voz_polly":
        return estimar_voz_polly(params.get("texto") or "", params.get("engine") or "neural")
    if tipo == "episode_spec":
        return estimar_episode_spec(int(params.get("max_reintentos", 3)))
    return None
