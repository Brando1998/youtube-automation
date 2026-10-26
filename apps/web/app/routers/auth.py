from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    SESSION_COOKIE_NAME,
    calcular_bloqueo,
    crear_token_sesion,
    cuenta_bloqueada,
    hash_password,
    verificar_password,
)
from ..config import settings
from ..database import get_db
from ..deps import get_current_usuario

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_KWARGS = dict(httponly=True, secure=True, samesite="lax", max_age=settings.session_max_age_seconds)


@router.post("/signup", response_model=schemas.UsuarioOut, status_code=status.HTTP_201_CREATED)
def signup(datos: schemas.SignupRequest, response: Response, db: Session = Depends(get_db)):
    """Crea un tenant nuevo + su primer usuario (admin). Pensado para cuando la app
    se venda a otros clientes; el primer tenant/usuario real se crea por script
    (ver apps/web/scripts/crear_tenant.py), no por este endpoint."""
    existe = db.query(models.Usuario).filter(models.Usuario.email == datos.email).first()
    if existe:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese email ya está registrado")

    tenant = models.Tenant(nombre=datos.tenant_nombre)
    db.add(tenant)
    db.flush()

    usuario = models.Usuario(
        tenant_id=tenant.id,
        email=datos.email,
        password_hash=hash_password(datos.password),
        nombre=datos.nombre,
        rol="admin",
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    token = crear_token_sesion(str(usuario.id), str(usuario.tenant_id))
    response.set_cookie(SESSION_COOKIE_NAME, token, **_COOKIE_KWARGS)
    return usuario


@router.post("/login", response_model=schemas.UsuarioOut)
def login(datos: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == datos.email).first()

    # Mensaje genérico siempre (no revelar si el email existe o no) — evita
    # enumeración de cuentas.
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos"
    )

    if usuario is None:
        raise credenciales_invalidas

    if cuenta_bloqueada(usuario.bloqueado_hasta):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Cuenta bloqueada temporalmente por intentos fallidos — probá de nuevo en unos minutos",
        )

    if not verificar_password(datos.password, usuario.password_hash):
        usuario.intentos_fallidos += 1
        usuario.bloqueado_hasta = calcular_bloqueo(usuario.intentos_fallidos)
        db.commit()
        raise credenciales_invalidas

    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None
    db.commit()

    token = crear_token_sesion(str(usuario.id), str(usuario.tenant_id))
    response.set_cookie(SESSION_COOKIE_NAME, token, **_COOKIE_KWARGS)
    return usuario


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME)


@router.get("/me", response_model=schemas.UsuarioOut)
def me(usuario: models.Usuario = Depends(get_current_usuario)):
    return usuario
