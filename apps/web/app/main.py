from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .routers import assets, auth, episodios, familias, fondos, jobs, objetos, paginas, personajes

app = FastAPI(title="youtube-automation API")

app.mount("/static", StaticFiles(directory=str(Path(__file__).resolve().parent / "static")), name="static")

app.include_router(auth.router)
app.include_router(episodios.router)
app.include_router(personajes.router)
app.include_router(fondos.router)
app.include_router(objetos.router)
app.include_router(familias.router)
app.include_router(jobs.router)
app.include_router(assets.router)
app.include_router(paginas.router)


@app.get("/health")
def health():
    return {"status": "ok"}
