import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_tenant_id

router = APIRouter(prefix="/personajes", tags=["personajes"])


@router.post("", response_model=schemas.PersonajeOut, status_code=status.HTTP_201_CREATED)
def crear_personaje(
    datos: schemas.PersonajeCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    campos = datos.model_dump()
    personaje = models.Personaje(tenant_id=tenant_id, **campos)
    if datos.familia_ref:
        # asset_ref de un personaje de familia (Fase C) se sintetiza acá, nunca
        # lo manda el cliente — sirve de id estable para el spec (ver
        # pipeline_runner.preparar_catalogo_remotion), necesita el id real, por
        # eso el flush antes de fijarlo.
        db.add(personaje)
        db.flush()
        personaje.asset_ref = f"familia/{datos.familia_ref.rsplit('/', 1)[-1]}/{personaje.id}"
    else:
        db.add(personaje)
    db.commit()
    db.refresh(personaje)
    return personaje


@router.get("", response_model=list[schemas.PersonajeOut])
def listar_personajes(tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    return (
        db.query(models.Personaje)
        .filter(models.Personaje.tenant_id == tenant_id)
        .order_by(models.Personaje.creado_en.desc())
        .all()
    )


@router.get("/{personaje_id}", response_model=schemas.PersonajeOut)
def obtener_personaje(personaje_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    personaje = db.get(models.Personaje, personaje_id)
    if personaje is None or personaje.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personaje no encontrado")
    return personaje
