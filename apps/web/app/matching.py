"""Emparejamiento de necesidades visuales (ver apps/pipeline_spec/
detectar_necesidades.py) contra la biblioteca real de assets vectoriales —
Python puro, determinístico, SIN IA: un conteo de intersección de tags alcanza
para esta escala (unas pocas decenas de assets), nada de embeddings. Si una
necesidad no tiene ningún tag en común con nada de su mismo tipo, se reporta
como "sin_match" — nunca se inventa un asset_ref.

Lee `apps/remotion-ilustrado/src/library/registry.json`, generado por
scripts/generar_registry.mjs (misma fuente que ya usa EpisodeRenderer.tsx del
lado de TypeScript — esto NO es un catálogo paralelo, es la vista JSON de lo
mismo para que el backend Python no necesite invocar Node)."""
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
REGISTRY_JSON_PATH = REPO_ROOT / "apps" / "remotion-ilustrado" / "src" / "library" / "registry.json"


def cargar_registro() -> list[dict]:
    if not REGISTRY_JSON_PATH.exists():
        raise FileNotFoundError(
            f"no existe {REGISTRY_JSON_PATH} — correr "
            "'node scripts/generar_registry.mjs' en apps/remotion-ilustrado primero"
        )
    with open(REGISTRY_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _score(tags_necesidad: set[str], tags_candidato: set[str]) -> int:
    return len(tags_necesidad & tags_candidato)


def emparejar_necesidades(necesidades: list[dict], registro: list[dict] | None = None) -> list[dict]:
    """Devuelve una copia de `necesidades` con un campo `match` agregado a cada
    una: `{"asset_ref": ..., "tags_coincidentes": N}` si se encontró algo del
    mismo `tipo` con al menos 1 tag en común (se queda con el de mayor
    intersección), o `None` si no hay nada parecido todavía."""
    if registro is None:
        registro = cargar_registro()

    resultado = []
    for necesidad in necesidades:
        tipo = necesidad.get("tipo")
        tags_necesidad = {t.lower() for t in necesidad.get("tags", [])}
        candidatos = [r for r in registro if r.get("tipo") == tipo]

        mejor = None
        mejor_score = 0
        for candidato in candidatos:
            tags_candidato = {t.lower() for t in candidato.get("metadatos", {}).get("tags", [])}
            score = _score(tags_necesidad, tags_candidato)
            if score > mejor_score:
                mejor_score = score
                mejor = candidato

        match = {"asset_ref": mejor["assetRef"], "tags_coincidentes": mejor_score} if mejor else None
        resultado.append({**necesidad, "match": match})
    return resultado
