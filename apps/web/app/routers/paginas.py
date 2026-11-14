"""Rutas de páginas HTML del dashboard (login + /app/*) — separadas de los routers
de la API JSON (episodios/personajes/fondos/jobs en sus propios archivos), que
siguen siendo la única fuente de verdad para datos; estas vistas solo renderizan
HTML y dejan que el JS del navegador hable con esa API."""
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..paginas_deps import usuario_o_redirect

router = APIRouter(include_in_schema=False)
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[1] / "templates"))


@router.get("/")
def raiz():
    return RedirectResponse(url="/app/episodios")


@router.get("/login")
def pagina_login(request: Request, db: Session = Depends(get_db)):
    usuario = usuario_o_redirect(request, db)
    if not isinstance(usuario, RedirectResponse):
        return RedirectResponse(url="/app/episodios")
    return templates.TemplateResponse(request, "login.html", {"usuario": None})


@router.get("/app/episodios")
def pagina_episodios(request: Request, db: Session = Depends(get_db)):
    usuario = usuario_o_redirect(request, db)
    if isinstance(usuario, RedirectResponse):
        return usuario
    return templates.TemplateResponse(request, "episodios_list.html", {"usuario": usuario})


@router.get("/app/episodios/{episodio_id}")
def pagina_episodio_detalle(episodio_id: uuid.UUID, request: Request, db: Session = Depends(get_db)):
    usuario = usuario_o_redirect(request, db)
    if isinstance(usuario, RedirectResponse):
        return usuario
    episodio = db.get(models.Episodio, episodio_id)
    if episodio is None or episodio.tenant_id != usuario.tenant_id:
        return RedirectResponse(url="/app/episodios")
    spec_json = json.dumps(episodio.spec_json, ensure_ascii=False, indent=2) if episodio.spec_json else None
    return templates.TemplateResponse(
        request, "episodio_detail.html", {"usuario": usuario, "episodio": episodio, "spec_json": spec_json}
    )


@router.get("/app/personajes")
def pagina_personajes(request: Request, db: Session = Depends(get_db)):
    usuario = usuario_o_redirect(request, db)
    if isinstance(usuario, RedirectResponse):
        return usuario
    return templates.TemplateResponse(request, "personajes_list.html", {"usuario": usuario})


@router.get("/app/fondos")
def pagina_fondos(request: Request, db: Session = Depends(get_db)):
    usuario = usuario_o_redirect(request, db)
    if isinstance(usuario, RedirectResponse):
        return usuario
    return templates.TemplateResponse(request, "fondos_list.html", {"usuario": usuario})


@router.get("/app/objetos")
def pagina_objetos(request: Request, db: Session = Depends(get_db)):
    usuario = usuario_o_redirect(request, db)
    if isinstance(usuario, RedirectResponse):
        return usuario
    return templates.TemplateResponse(request, "objetos_list.html", {"usuario": usuario})


@router.get("/app/jobs")
def pagina_jobs(request: Request, db: Session = Depends(get_db)):
    usuario = usuario_o_redirect(request, db)
    if isinstance(usuario, RedirectResponse):
        return usuario
    return templates.TemplateResponse(request, "jobs_list.html", {"usuario": usuario})
