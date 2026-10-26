import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_usuario, get_tenant_id
from ..pipeline_runner import encolar_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _validar_pertenencia(db: Session, tenant_id: uuid.UUID, datos: schemas.JobCreate):
    """Que episodio_id/personaje_id/fondo_id (si vienen) existan y sean del mismo
    tenant — aislamiento multitenant, no confiar en el id que mande el cliente."""
    comprobaciones = (
        (datos.episodio_id, models.Episodio, "Episodio"),
        (datos.personaje_id, models.Personaje, "Personaje"),
        (datos.fondo_id, models.Fondo, "Fondo"),
    )
    for entidad_id, Modelo, nombre in comprobaciones:
        if entidad_id is None:
            continue
        entidad = db.get(Modelo, entidad_id)
        if entidad is None or entidad.tenant_id != tenant_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{nombre} no encontrado")


@router.post("", response_model=schemas.JobOut, status_code=status.HTTP_201_CREATED)
def crear_job(
    datos: schemas.JobCreate,
    background_tasks: BackgroundTasks,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    usuario: models.Usuario = Depends(get_current_usuario),
    db: Session = Depends(get_db),
):
    _validar_pertenencia(db, tenant_id, datos)

    job = models.GenerationJob(
        tenant_id=tenant_id,
        tipo=datos.tipo,
        episodio_id=datos.episodio_id,
        personaje_id=datos.personaje_id,
        fondo_id=datos.fondo_id,
        parametros={**datos.parametros, "_simular": datos.simular},
        creado_por=usuario.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(encolar_job, job.id)
    return job


@router.get("", response_model=list[schemas.JobOut])
def listar_jobs(tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    return (
        db.query(models.GenerationJob)
        .filter(models.GenerationJob.tenant_id == tenant_id)
        .order_by(models.GenerationJob.creado_en.desc())
        .limit(100)
        .all()
    )


@router.get("/{job_id}", response_model=schemas.JobOut)
def obtener_job(job_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_tenant_id), db: Session = Depends(get_db)):
    job = db.get(models.GenerationJob, job_id)
    if job is None or job.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job no encontrado")
    return job
