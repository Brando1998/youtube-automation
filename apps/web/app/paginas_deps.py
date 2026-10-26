"""Mismo chequeo de sesión que app/deps.py, pero para rutas de páginas HTML: en vez
de un 401 JSON, redirige a /login — deps.py sigue siendo lo que usan los routers de
la API JSON (episodios/personajes/fondos/jobs), sin tocarlo."""
import uuid

from fastapi import Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from . import models
from .auth import SESSION_COOKIE_NAME, leer_token_sesion


def usuario_o_redirect(request: Request, db: Session) -> models.Usuario | RedirectResponse:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    datos = leer_token_sesion(token) if token else None
    if not datos:
        return RedirectResponse(url="/login", status_code=303)
    usuario = db.get(models.Usuario, uuid.UUID(datos["usuario_id"]))
    if usuario is None:
        return RedirectResponse(url="/login", status_code=303)
    return usuario
