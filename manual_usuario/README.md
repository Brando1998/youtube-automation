# Manual de usuario (MkDocs Material)

Documenta el proceso real de construir un episodio en la app, de punta a punta
— ver `docs/index.md` para empezar a leer.

## Servir en local

```bash
cd manual_usuario
uv venv .venv  # o python3 -m venv .venv
uv pip install -r requirements.txt --python .venv/bin/python3
.venv/bin/mkdocs serve
```

Abre en `http://127.0.0.1:8000`.

## Build estático

```bash
.venv/bin/mkdocs build --strict
```

Genera `site/` (gitignored, no se commitea).
