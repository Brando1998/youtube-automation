"""Crea el primer tenant + usuario admin — pensado para dar de alta la cuenta del
dueño del proyecto sin exponer el endpoint público de signup para esto. Para clientes
futuros (si la app se vende) se usaría /auth/signup desde la propia app.

Uso:
  python3 scripts/crear_tenant.py --tenant "Nombre del canal" --nombre "Brando" \
      --email brando@... --password "..."
"""
import argparse
import secrets
import sys

sys.path.insert(0, ".")

from app import models  # noqa: E402
from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant", required=True)
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", default=None, help="si se omite, se genera una aleatoria")
    args = parser.parse_args()

    password = args.password or secrets.token_urlsafe(16)

    db = SessionLocal()
    try:
        existente = db.query(models.Usuario).filter(models.Usuario.email == args.email).first()
        if existente:
            print(f"Ya existe un usuario con ese email (id={existente.id}, tenant={existente.tenant_id})")
            sys.exit(1)

        tenant = models.Tenant(nombre=args.tenant)
        db.add(tenant)
        db.flush()

        usuario = models.Usuario(
            tenant_id=tenant.id,
            email=args.email,
            password_hash=hash_password(password),
            nombre=args.nombre,
            rol="admin",
        )
        db.add(usuario)
        db.commit()

        print("Tenant y usuario creados:")
        print(f"  tenant_id: {tenant.id}")
        print(f"  usuario_id: {usuario.id}")
        print(f"  email: {usuario.email}")
        if not args.password:
            print(f"  password (generada): {password}")
    finally:
        db.close()
