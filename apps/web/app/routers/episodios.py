import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_usuario, get_tenant_id
from ..pipeline_runner import costo_acumulado_episodio

router = APIRouter(prefix="/episodios", tags=["episodios"])


def _con_costo(db: Session, episodio: models.Episodio) -> models.Episodio:
    """costo_acumulado_usd no es una columna — se calcula y se adjunta al objeto ORM
    antes de serializar (EpisodioOut lo declara con default 0.0, from_attributes lo
    toma de este atributo ad-hoc)."""
    episodio.costo_acumulado_usd = costo_acumulado_episodio(db, episodio.id)
    return episodio


@router.post("", response_model=schemas.EpisodioOut, status_code=status.HTTP_201_CREATED)
def crear_episodio(
    datos: schemas.EpisodioCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    usuario: models.Usuario = Depends(get_current_usuario),
    db: Session = Depends(get_db),
):
    episodio = models.Episodio(
        tenant_id=tenant_id,
        titulo=datos.titulo,
        estilo=datos.estilo,
        modo_voz=datos.modo_voz,
        guion_texto=datos.guion_texto,
        presupuesto_usd=datos.presupuesto_usd,
        creado_por=usuario.id,
    )
    db.add(episodio)
    db.commit()
    db.refresh(episodio)
    return _con_costo(db, episodio)


@router.get("", response_model=list[schemas.EpisodioOut])
def listar_episodios(tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    episodios = (
        db.query(models.Episodio)
        .filter(models.Episodio.tenant_id == tenant_id)
        .order_by(models.Episodio.creado_en.desc())
        .all()
    )
    return [_con_costo(db, e) for e in episodios]


@router.get("/{episodio_id}", response_model=schemas.EpisodioOut)
def obtener_episodio(episodio_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    episodio = db.get(models.Episodio, episodio_id)
    if episodio is None or episodio.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episodio no encontrado")
    return _con_costo(db, episodio)


@router.patch("/{episodio_id}/presupuesto", response_model=schemas.EpisodioOut)
def actualizar_presupuesto(
    episodio_id: uuid.UUID,
    datos: schemas.EpisodioPresupuestoUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    episodio = db.get(models.Episodio, episodio_id)
    if episodio is None or episodio.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episodio no encontrado")
    episodio.presupuesto_usd = datos.presupuesto_usd
    db.commit()
    db.refresh(episodio)
    return _con_costo(db, episodio)


@router.delete("/{episodio_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_episodio(episodio_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    episodio = db.get(models.Episodio, episodio_id)
    if episodio is None or episodio.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episodio no encontrado")

    # El episodio es dueño de sus jobs/assets (no al revés) — se borran con él.
    # personajes/fondos son entidades independientes, no se tocan aunque se hayan
    # usado en jobs de este episodio.
    db.query(models.GenerationJob).filter(models.GenerationJob.episodio_id == episodio_id).delete()
    db.query(models.Asset).filter(models.Asset.episodio_id == episodio_id).delete()
    db.delete(episodio)
    db.commit()
