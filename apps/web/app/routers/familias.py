"""Lista de familias paramétricas disponibles (Fase C, docs/PROJECT_ROADMAP.md) —
lee library/registry.json (misma fuente que ya usa app/matching.py, generada por
scripts/generar_registry.mjs) y filtra las entradas tipo familia_personaje/
familia_objeto. Sirve para que el dashboard arme el formulario de creación
dinámicamente (qué familias hay, qué parámetros acepta cada una) sin hardcodear
nada del lado del backend por familia nueva que se agregue."""
from fastapi import APIRouter, Query

from ..matching import cargar_registro

router = APIRouter(prefix="/familias", tags=["familias"])

_TIPO_A_REGISTRO = {"personaje": "familia_personaje", "objeto": "familia_objeto"}


@router.get("")
def listar_familias(tipo: str = Query(..., pattern="^(personaje|objeto)$")):
    tipo_registro = _TIPO_A_REGISTRO[tipo]
    return [
        {"assetRef": e["assetRef"], "parametrosSchema": e.get("parametrosSchema", {})}
        for e in cargar_registro()
        if e.get("tipo") == tipo_registro
    ]
