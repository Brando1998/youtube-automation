"""Revisión y aprobación de assets generados (hoja/partes/fondo/audio/render) — antes
de este router no existía ninguna forma de marcar algo como aprobado desde la app, lo
que dejaba el pipeline real sin salida posible (render_episodio exige assets
aprobados, ver pipeline_runner.preparar_catalogo_remotion)."""
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_tenant_id
from ..pipeline_runner import _tenant_dir

router = APIRouter(prefix="/assets", tags=["assets"])


def _obtener(db: Session, tenant_id: uuid.UUID, asset_id: uuid.UUID) -> models.Asset:
    asset = db.get(models.Asset, asset_id)
    if asset is None or asset.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset no encontrado")
    return asset


def _archivo_con_aprobado(tenant_dir: Path, asset: models.Asset) -> Path | None:
    """Ruta al JSON que, además del registro en la DB, trae su propio campo
    `aprobado` que leen los scripts del pipeline directamente del disco (p.ej.
    generar_partes.py exige hoja.meta.json: aprobado=true) — None si este tipo no
    tiene uno."""
    ruta = tenant_dir / asset.ruta_archivo
    if asset.tipo == "hoja_personaje":
        return ruta.parent / "hoja.meta.json"
    if asset.tipo in ("parte_personaje", "capa_fondo"):
        return ruta  # puppet.json / fondo.json son justamente ese archivo
    return None


@router.get("", response_model=list[schemas.AssetOut])
def listar_assets(
    episodio_id: uuid.UUID | None = None,
    personaje_id: uuid.UUID | None = None,
    fondo_id: uuid.UUID | None = None,
    objeto_id: uuid.UUID | None = None,
    tipo: str | None = None,
    pendientes: bool = False,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    q = db.query(models.Asset).filter(models.Asset.tenant_id == tenant_id)
    if episodio_id is not None:
        q = q.filter(models.Asset.episodio_id == episodio_id)
    if personaje_id is not None:
        q = q.filter(models.Asset.personaje_id == personaje_id)
    if fondo_id is not None:
        q = q.filter(models.Asset.fondo_id == fondo_id)
    if objeto_id is not None:
        q = q.filter(models.Asset.objeto_id == objeto_id)
    if tipo is not None:
        q = q.filter(models.Asset.tipo == tipo)
    if pendientes:
        q = q.filter(models.Asset.aprobado.is_(False))
    return q.order_by(models.Asset.creado_en.desc()).all()


@router.patch("/{asset_id}/aprobar", response_model=schemas.AssetOut)
def aprobar_asset(asset_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    asset = _obtener(db, tenant_id, asset_id)
    tenant_dir = _tenant_dir(tenant_id)
    archivo = _archivo_con_aprobado(tenant_dir, asset)
    if archivo is not None and archivo.exists():
        datos = json.loads(archivo.read_text(encoding="utf-8"))
        datos["aprobado"] = True
        archivo.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
        if asset.tipo in ("parte_personaje", "capa_fondo"):
            asset.metadatos = datos  # mantener la copia en la DB en sync con el archivo
    asset.aprobado = True
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}/archivo")
def ver_archivo(
    asset_id: uuid.UUID,
    nombre: str | None = None,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    """Sirve la imagen (o mp4) para previsualizar antes de aprobar. hoja_personaje y
    render tienen un único archivo; parte_personaje/capa_fondo tienen varios (una
    parte o capa por `nombre`, ver AssetOut.metadatos para la lista de nombres
    disponibles) — `nombre` selecciona cuál."""
    asset = _obtener(db, tenant_id, asset_id)
    tenant_dir = _tenant_dir(tenant_id)
    base = tenant_dir / asset.ruta_archivo

    if asset.tipo in ("hoja_personaje", "render", "audio"):
        ruta = base
    elif asset.tipo in ("vector_personaje", "vector_fondo", "vector_objeto"):
        # ruta_archivo acá es la ruta al .tsx en el repo, no relativa a tenant_dir —
        # el preview (lo único que hay para mostrar) sí vive bajo tenant_dir.
        preview = (asset.metadatos or {}).get("preview_png")
        if not preview:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "este asset no tiene preview generado")
        ruta = tenant_dir / preview
    elif asset.tipo == "parte_personaje":
        if not nombre:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "falta ?nombre= (una clave de metadatos.partes)")
        partes = (asset.metadatos or {}).get("partes", {})
        # `nombre` puede ser una parte simple ("cuerpo", "cabeza", ...) o un código
        # de visema para una boca ("A", "E", "reposo", ...) — se busca en ambos,
        # no hay colisión de claves entre los dos diccionarios.
        rel = (partes.get("bocas") or {}).get(nombre) or partes.get(nombre)
        if not rel:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"no hay una parte '{nombre}'")
        ruta = base.parent / rel
    elif asset.tipo == "capa_fondo":
        if not nombre:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "falta ?nombre= (un id de metadatos.capas)")
        capa = next((c for c in (asset.metadatos or {}).get("capas", []) if c["id"] == nombre), None)
        if capa is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"no hay una capa '{nombre}'")
        ruta = base.parent / capa["archivo"]
    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sin preview para este tipo de asset")

    if not ruta.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "el archivo no existe en disco")
    # Mismo endpoint sirve tanto el <video> de preview en el panel de revisión como
    # el botón de descarga del episodio — el botón fuerza la descarga con el
    # atributo HTML `download` del lado del cliente, no hace falta Content-Disposition
    # especial acá (si lo forzáramos, el <video> de preview dejaría de reproducir inline).
    return FileResponse(ruta)
