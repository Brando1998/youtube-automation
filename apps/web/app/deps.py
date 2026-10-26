import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from . import models
from .auth import SESSION_COOKIE_NAME, leer_token_sesion
from .database import get_db


def get_current_usuario(request: Request, db: Session = Depends(get_db)) -> models.Usuario:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    datos = leer_token_sesion(token) if token else None
    if not datos:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")

    usuario = db.get(models.Usuario, uuid.UUID(datos["usuario_id"]))
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    return usuario


def get_tenant_id(usuario: models.Usuario = Depends(get_current_usuario)) -> uuid.UUID:
    """Todo endpoint de negocio depende de esto (no de get_current_usuario directo) para
    dejar explícito, en cada router, que la consulta debe filtrar por tenant_id."""
    return usuario.tenant_id
