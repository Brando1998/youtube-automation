import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, model_validator


class SignupRequest(BaseModel):
    tenant_nombre: str = Field(min_length=1, max_length=200)
    nombre: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UsuarioOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: EmailStr
    nombre: str
    rol: str

    model_config = {"from_attributes": True}


class EpisodioCreate(BaseModel):
    titulo: str = Field(min_length=1, max_length=300)
    estilo: str = Field(pattern="^(3d|ilustrado)$")
    modo_voz: str = Field(pattern="^(narrador|dialogos|mixto)$")
    guion_texto: str | None = None
    # Tope de gasto AWS para este episodio (null = sin límite) — ver app/costos.py.
    presupuesto_usd: float | None = Field(default=None, ge=0)


class EpisodioPresupuestoUpdate(BaseModel):
    presupuesto_usd: float | None = Field(ge=0)


class EpisodioOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    titulo: str
    estilo: str
    modo_voz: str
    estado: str
    guion_texto: str | None
    spec_json: dict | None
    necesidades_json: dict | None
    presupuesto_usd: float | None
    # No es una columna — se calcula en el router (suma de UsageLog de los jobs de
    # este episodio) y se adjunta al objeto ORM antes de serializar.
    costo_acumulado_usd: float = 0.0
    creado_en: datetime
    actualizado_en: datetime

    model_config = {"from_attributes": True}


class PersonajeCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    # Uno de los dos (Fase C, docs/PROJECT_ROADMAP.md): asset_ref para un
    # personaje de biblioteca fija, familia_ref+parametros para una instancia de
    # familia paramétrica (library/familias/) — el router sintetiza su propio
    # asset_ref estable en ese caso, por eso acá queda opcional.
    asset_ref: str | None = Field(default=None, max_length=300)
    familia_ref: str | None = Field(default=None, max_length=300)
    parametros: dict[str, Any] | None = None
    color_subtitulo: str | None = None

    @model_validator(mode="after")
    def _uno_de_los_dos(self):
        if bool(self.asset_ref) == bool(self.familia_ref):
            raise ValueError("pasá exactamente uno de asset_ref o familia_ref (no los dos, no ninguno)")
        return self


class PersonajeOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    nombre: str
    asset_ref: str
    familia_ref: str | None
    parametros: dict | None
    color_subtitulo: str | None
    estado: str
    creado_en: datetime

    model_config = {"from_attributes": True}


class FondoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    asset_ref: str = Field(min_length=1, max_length=300)


class FondoOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    nombre: str
    asset_ref: str
    estado: str
    creado_en: datetime

    model_config = {"from_attributes": True}


class ObjetoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    asset_ref: str | None = Field(default=None, max_length=300)
    familia_ref: str | None = Field(default=None, max_length=300)
    parametros: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _uno_de_los_dos(self):
        if bool(self.asset_ref) == bool(self.familia_ref):
            raise ValueError("pasá exactamente uno de asset_ref o familia_ref (no los dos, no ninguno)")
        return self


class ObjetoOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    nombre: str
    asset_ref: str
    familia_ref: str | None
    parametros: dict | None
    estado: str
    creado_en: datetime

    model_config = {"from_attributes": True}


class JobCreate(BaseModel):
    tipo: str = Field(
        pattern="^(episode_spec|detectar_necesidades|hoja_personaje|partes_personaje|fondo|voz_polly|render_episodio"
        "|vector_personaje|vector_fondo|vector_objeto)$"
    )
    episodio_id: uuid.UUID | None = None
    personaje_id: uuid.UUID | None = None
    fondo_id: uuid.UUID | None = None
    objeto_id: uuid.UUID | None = None
    parametros: dict[str, Any] = Field(default_factory=dict)
    # Por defecto siempre simula (--dry-run) — pausa de costos AWS del usuario
    # (ver docs/PROGRESS.md). Un cliente tiene que pedir explícitamente lo
    # contrario para gastar de verdad.
    simular: bool = True
    # Si el job excedería el presupuesto del episodio (app/costos.py), por defecto
    # se bloquea con 'presupuesto_excedido' — forzar=true lo corre igual.
    forzar: bool = False


class AssetOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tipo: str
    ruta_archivo: str
    personaje_id: uuid.UUID | None
    fondo_id: uuid.UUID | None
    objeto_id: uuid.UUID | None
    episodio_id: uuid.UUID | None
    metadatos: dict | None
    aprobado: bool
    creado_en: datetime

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tipo: str
    estado: str
    episodio_id: uuid.UUID | None
    personaje_id: uuid.UUID | None
    fondo_id: uuid.UUID | None
    objeto_id: uuid.UUID | None
    parametros: dict | None
    resultado: dict | None
    error: str | None
    creado_en: datetime
    iniciado_en: datetime | None
    terminado_en: datetime | None

    model_config = {"from_attributes": True}
