import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_tenant_id

router = APIRouter(prefix="/fondos", tags=["fondos"])


@router.post("", response_model=schemas.FondoOut, status_code=status.HTTP_201_CREATED)
def crear_fondo(
    datos: schemas.FondoCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    fondo = models.Fondo(tenant_id=tenant_id, **datos.model_dump())
    db.add(fondo)
    db.commit()
    db.refresh(fondo)
    return fondo


@router.get("", response_model=list[schemas.FondoOut])
def listar_fondos(tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    return (
        db.query(models.Fondo)
        .filter(models.Fondo.tenant_id == tenant_id)
        .order_by(models.Fondo.creado_en.desc())
        .all()
    )


@router.get("/{fondo_id}", response_model=schemas.FondoOut)
def obtener_fondo(fondo_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    fondo = db.get(models.Fondo, fondo_id)
    if fondo is None or fondo.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fondo no encontrado")
    return fondo
