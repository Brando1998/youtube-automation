from fastapi import FastAPI

from .routers import auth, episodios, fondos, jobs, personajes

app = FastAPI(title="youtube-automation API")

app.include_router(auth.router)
app.include_router(episodios.router)
app.include_router(personajes.router)
app.include_router(fondos.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
