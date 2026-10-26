"""Modelo de datos multitenant: todas las tablas de negocio llevan `tenant_id` —
esquema compartido, no base de datos por cliente (decisión en docs/PROGRESS.md).
Cada query de negocio debe filtrar por tenant_id (ver app/deps.py)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.now(timezone.utc)


class Tenant(Base):
    """Una organización/cliente. En esta primera etapa habrá un solo tenant (el del
    usuario), pero el modelo ya soporta más — es la base para vender la app."""
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    nombre: Mapped[str] = mapped_column(String(200))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="tenant")


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    nombre: Mapped[str] = mapped_column(String(200))
    rol: Mapped[str] = mapped_column(String(20), default="admin")  # admin|miembro

    intentos_fallidos: Mapped[int] = mapped_column(default=0)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tenant: Mapped["Tenant"] = relationship(back_populates="usuarios")


class Episodio(Base):
    __tablename__ = "episodios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    titulo: Mapped[str] = mapped_column(String(300))
    estilo: Mapped[str] = mapped_column(String(20))  # 3d|ilustrado
    modo_voz: Mapped[str] = mapped_column(String(20))  # narrador|dialogos|mixto
    estado: Mapped[str] = mapped_column(String(30), default="borrador")
    # borrador -> generando_spec -> revision -> generando_assets -> listo -> publicado

    guion_texto: Mapped[str | None] = mapped_column(Text, nullable=True)
    spec_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # episode_spec/schema.json

    creado_por: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Personaje(Base):
    __tablename__ = "personajes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(200))
    asset_ref: Mapped[str] = mapped_column(String(300))  # p.ej. "2d/personajes/lucia"
    color_subtitulo: Mapped[str | None] = mapped_column(String(10), nullable=True)
    estado: Mapped[str] = mapped_column(String(30), default="borrador")  # borrador|aprobado
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Fondo(Base):
    __tablename__ = "fondos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(200))
    asset_ref: Mapped[str] = mapped_column(String(300))  # p.ej. "2d/fondos/cabana-bosque-noche"
    estado: Mapped[str] = mapped_column(String(30), default="borrador")
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Asset(Base):
    """Un archivo generado (hoja de personaje, parte individual, capa de fondo, audio,
    render final, ...) — siempre bajo revisión humana antes de `aprobado=True`."""
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(40))  # hoja_personaje|parte_personaje|capa_fondo|audio|render
    ruta_archivo: Mapped[str] = mapped_column(String(500))  # relativa a data_dir/<tenant_id>/

    personaje_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("personajes.id"), nullable=True)
    fondo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fondos.id"), nullable=True)
    episodio_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("episodios.id"), nullable=True)

    metadatos: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # prompt, seed, modelo, etc.
    aprobado: Mapped[bool] = mapped_column(Boolean, default=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class GenerationJob(Base):
    """Una corrida del pipeline (generar hoja, partes, fondo, voz, o render de un
    episodio) — permite mostrar progreso en vivo en el dashboard y diagnosticar fallos."""
    __tablename__ = "generation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(40))
    # hoja_personaje|partes_personaje|fondo|voz_polly|voz_local|render_episodio|episode_spec
    estado: Mapped[str] = mapped_column(String(20), default="pendiente")
    # pendiente|corriendo|completado|fallido

    episodio_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("episodios.id"), nullable=True)
    personaje_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("personajes.id"), nullable=True)
    fondo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fondos.id"), nullable=True)

    parametros: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    resultado: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    creado_por: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    iniciado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    terminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UsageLog(Base):
    """Registro de uso de servicios pagos (Bedrock/Polly) por tenant — base para
    facturar más adelante si la app se vende. Barato de tener ahora, caro de
    reconstruir en retrospectiva."""
    __tablename__ = "usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("generation_jobs.id"), nullable=True)

    servicio: Mapped[str] = mapped_column(String(40))  # bedrock-stability|bedrock-anthropic|polly
    operacion: Mapped[str] = mapped_column(String(60))  # p.ej. "stable-image-core-v1:1"
    cantidad: Mapped[float] = mapped_column(Numeric(12, 4))  # imágenes, caracteres, segundos...
    unidad: Mapped[str] = mapped_column(String(20))  # "imagenes"|"caracteres"|"segundos"
    costo_estimado_usd: Mapped[float] = mapped_column(Numeric(10, 4))

    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
