"""Hash de contraseña (bcrypt) + cookie de sesión firmada (itsdangerous) — sin
dependencias externas nuevas (Redis, etc.), consistente con mantener la
infraestructura simple mientras el proyecto es chico."""
from datetime import datetime, timedelta, timezone

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import settings

_serializer = URLSafeTimedSerializer(settings.session_secret, salt="session")

SESSION_COOKIE_NAME = "session"
MAX_INTENTOS_FALLIDOS = 5
BLOQUEO_MINUTOS = 15


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def crear_token_sesion(usuario_id: str, tenant_id: str) -> str:
    return _serializer.dumps({"usuario_id": usuario_id, "tenant_id": tenant_id})


def leer_token_sesion(token: str) -> dict | None:
    try:
        return _serializer.loads(token, max_age=settings.session_max_age_seconds)
    except (BadSignature, SignatureExpired):
        return None


def cuenta_bloqueada(bloqueado_hasta: datetime | None) -> bool:
    if bloqueado_hasta is None:
        return False
    return bloqueado_hasta > datetime.now(timezone.utc)


def calcular_bloqueo(intentos_fallidos: int) -> datetime | None:
    if intentos_fallidos >= MAX_INTENTOS_FALLIDOS:
        return datetime.now(timezone.utc) + timedelta(minutes=BLOQUEO_MINUTOS)
    return None
