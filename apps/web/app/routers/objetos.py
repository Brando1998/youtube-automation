import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_tenant_id

router = APIRouter(prefix="/objetos", tags=["objetos"])


@router.post("", response_model=schemas.ObjetoOut, status_code=status.HTTP_201_CREATED)
def crear_objeto(
    datos: schemas.ObjetoCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    campos = datos.model_dump()
    if datos.familia_ref:
        # Mismo criterio que crear_personaje (Fase C) — ver ese comentario (el
        # id hay que generarlo ACÁ, asset_ref es NOT NULL desde el INSERT).
        nuevo_id = uuid.uuid4()
        campos["asset_ref"] = f"familia/{datos.familia_ref.rsplit('/', 1)[-1]}/{nuevo_id}"
        objeto = models.Objeto(id=nuevo_id, tenant_id=tenant_id, **campos)
    else:
        objeto = models.Objeto(tenant_id=tenant_id, **campos)
    db.add(objeto)
    db.commit()
    db.refresh(objeto)
    return objeto


@router.get("", response_model=list[schemas.ObjetoOut])
def listar_objetos(tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    return (
        db.query(models.Objeto)
        .filter(models.Objeto.tenant_id == tenant_id)
        .order_by(models.Objeto.creado_en.desc())
        .all()
    )


@router.get("/{objeto_id}", response_model=schemas.ObjetoOut)
def obtener_objeto(objeto_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    objeto = db.get(models.Objeto, objeto_id)
    if objeto is None or objeto.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objeto no encontrado")
    return objeto
