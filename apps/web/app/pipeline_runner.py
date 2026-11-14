"""Conecta los endpoints de la API con los scripts del pipeline (apps/pipeline_2d,
apps/pipeline_audio, apps/pipeline_spec) — corre cada uno como subproceso con el
mismo intérprete de la app web (requirements.txt ya incluye boto3/Pillow/jsonschema,
las dependencias de los tres pipelines) y guarda el resultado en GenerationJob.

Por defecto cada job corre con --dry-run (campo `simular` en JobCreate, default
True) — pausa de costos AWS del usuario, ver docs/PROGRESS.md. Solo gasta de verdad
si el cliente de la API pide `simular: false` explícitamente.

Sin cola de tareas (Celery/RQ): cada job corre en un hilo de fondo simple
(BackgroundTasks de FastAPI + threading), razonable para el volumen de esta primera
etapa — una cola completa sería una abstracción de más por ahora.
"""
import json
import shutil
import subprocess
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import costos, models
from .config import settings

REPO_ROOT = Path(__file__).resolve().parents[3]
PIPELINE_2D = REPO_ROOT / "apps" / "pipeline_2d"
PIPELINE_AUDIO = REPO_ROOT / "apps" / "pipeline_audio"
PIPELINE_SPEC = REPO_ROOT / "apps" / "pipeline_spec"
REMOTION_APP_DIR = REPO_ROOT / "apps" / "remotion-ilustrado"
REMOTION_PUBLIC_DIR = REMOTION_APP_DIR / "public"

TIMEOUT_SEGUNDOS = 600
TIMEOUT_RENDER_SEGUNDOS = 3600  # un episodio de varios minutos puede tardar bastante más que un job de generación


def _tenant_dir(tenant_id: uuid.UUID) -> Path:
    return Path(settings.data_dir) / str(tenant_id)


def _now():
    return datetime.now(timezone.utc)


class JobError(Exception):
    """Error de validación antes de correr el job (falta un campo, entidad no
    encontrada, etc.) — distinto de un fallo del subproceso, que se guarda en el job."""


def _requiere(job: models.GenerationJob, campo: str):
    valor = getattr(job, campo)
    if valor is None:
        raise JobError(f"el job de tipo '{job.tipo}' requiere {campo}")
    return valor


def costo_acumulado_episodio(db: Session, episodio_id: uuid.UUID) -> float:
    """Suma de UsageLog.costo_estimado_usd de todos los jobs de este episodio — lo
    que cuenta para el presupuesto (ver models.Episodio.presupuesto_usd)."""
    total = (
        db.query(func.coalesce(func.sum(models.UsageLog.costo_estimado_usd), 0))
        .join(models.GenerationJob, models.UsageLog.job_id == models.GenerationJob.id)
        .filter(models.GenerationJob.episodio_id == episodio_id)
        .scalar()
    )
    return float(total)


def _verificar_presupuesto(db: Session, job: models.GenerationJob, params: dict):
    """Antes de gastar de verdad: si el job es atribuible a un episodio con
    presupuesto_usd fijado, calcula el costo estimado y bloquea si lo excedería —
    salvo que el cliente pida explícitamente `forzar: true` (JobCreate.forzar)."""
    if job.episodio_id is None:
        return
    estimado = costos.estimar_costo_job(job.tipo, params)
    if estimado is None:
        return
    episodio = db.get(models.Episodio, job.episodio_id)
    if episodio is None or episodio.presupuesto_usd is None:
        return
    acumulado = costo_acumulado_episodio(db, job.episodio_id)
    restante = float(episodio.presupuesto_usd) - acumulado
    if estimado > restante and not params.get("_forzar"):
        raise JobError(
            f"excedería el presupuesto del episodio: estimado ${estimado:.4f}, "
            f"disponible ${restante:.4f} (ya gastado ${acumulado:.4f} de "
            f"${float(episodio.presupuesto_usd):.2f}). Repetí el job con forzar=true "
            "para gastar igual."
        )


def _copiar_a_public(origen: Path, subcarpeta: str, nombre_archivo: str) -> str:
    """Copia un archivo generado al public/ del app Remotion — requisito de Remotion,
    no puede leer rutas absolutas del filesystem (ver docs/PROGRESS.md, Fase A6) —
    y devuelve la ruta relativa a public/ para usar con staticFile()."""
    if not origen.exists():
        raise JobError(f"falta el archivo esperado: {origen}")
    destino_dir = REMOTION_PUBLIC_DIR / subcarpeta
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / nombre_archivo
    shutil.copyfile(origen, destino)
    return f"{subcarpeta}/{nombre_archivo}"


def _regenerar_registry():
    """Corre generar_registry.mjs — para que preparar_catalogo_remotion nunca confíe
    en un registry desactualizado si alguien editó un .tsx de la biblioteca sin
    correr el script a mano. El script en sí ya valida que cada archivo de library/
    tenga exactamente un ASSET_REF + una definición (si no, falla con su propio
    error, que acá se propaga como JobError)."""
    try:
        subprocess.run(
            ["node", "scripts/generar_registry.mjs"],
            cwd=REMOTION_APP_DIR, check=True, capture_output=True, text=True, timeout=60,
        )
    except subprocess.CalledProcessError as e:
        raise JobError(f"generar_registry.mjs falló: {(e.stderr or e.stdout or '').strip()}")


def _verificar_asset_ref(archivo: str, asset_ref: str):
    """Confirma que el .tsx declara el ASSET_REF esperado — directo contra el
    archivo fuente, no contra registry.ts (ahí solo queda un import por alias, el
    valor del string nunca aparece como texto literal en ese archivo generado)."""
    ruta = REMOTION_APP_DIR / archivo
    if not ruta.exists():
        raise JobError(f"no existe {archivo} (ruta esperada: {ruta})")
    texto = ruta.read_text(encoding="utf-8")
    if f'ASSET_REF = "{asset_ref}"' not in texto:
        raise JobError(
            f"{archivo} no exporta ASSET_REF = \"{asset_ref}\" — revisá que coincida "
            "exacto con el asset_ref de la entidad en la DB"
        )


def preparar_catalogo_remotion(db: Session, episodio: models.Episodio) -> dict:
    """Arma {fondos, personajesCatalogo, lineasAudio} para pasarle a `remotion
    render --props=...` — a partir de los Asset APROBADOS de este tenant (fondo/
    personaje/audio). Los assets raster (capa_fondo/parte_personaje, camino viejo
    Stability) copian sus imágenes al public/ del app Remotion; los vectoriales
    (vector_fondo/vector_personaje, biblioteca de código) no viajan por acá en
    absoluto — EpisodeRenderer los resuelve solo contra library/registry.ts, así
    que acá solo se confirma que están ahí. Si algo que el spec referencia no
    tiene un asset aprobado todavía, falla con un JobError claro (qué falta
    aprobar) en vez de renderizar a medias."""
    tenant_dir = _tenant_dir(episodio.tenant_id)
    spec = episodio.spec_json or {}
    _regenerar_registry()

    fondos_out: dict = {}
    for asset_ref in {esc["fondo"] for esc in spec.get("escenas", []) if esc.get("fondo")}:
        fondo = (
            db.query(models.Fondo)
            .filter(models.Fondo.tenant_id == episodio.tenant_id, models.Fondo.asset_ref == asset_ref)
            .first()
        )
        if fondo is None:
            raise JobError(f"el spec referencia el fondo '{asset_ref}' pero no existe ese Fondo")
        asset = (
            db.query(models.Asset)
            .filter(
                models.Asset.fondo_id == fondo.id,
                models.Asset.tipo.in_(("capa_fondo", "vector_fondo")),
                models.Asset.aprobado.is_(True),
            )
            .order_by(models.Asset.creado_en.desc())
            .first()
        )
        if asset is None:
            raise JobError(f"el fondo '{asset_ref}' todavía no tiene una capa_fondo aprobada")

        if asset.tipo == "vector_fondo":
            _verificar_asset_ref((asset.metadatos or {}).get("archivo", ""), asset_ref)
            continue  # lo resuelve FONDOS_VECTOR del lado de Remotion, no viaja por --props

        fondo_json = asset.metadatos or {}
        fondo_dir = (tenant_dir / asset.ruta_archivo).parent
        capas = [
            {
                "id": capa["id"],
                "depth": capa["depth"],
                "src": _copiar_a_public(fondo_dir / capa["archivo"], f"assets/fondos/{fondo.id}", f"{capa['id']}.png"),
            }
            for capa in fondo_json.get("capas", [])
        ]
        fondos_out[asset_ref] = {
            "id": asset_ref, "capas": capas,
            "luces": fondo_json.get("luces") or None,
            "humoOrigen": fondo_json.get("humo_origen") or None,
        }

    personajes_out: dict = {}
    for p in spec.get("personajes", []):
        asset_ref = p.get("asset_ref")
        if not asset_ref:
            continue
        personaje = (
            db.query(models.Personaje)
            .filter(models.Personaje.tenant_id == episodio.tenant_id, models.Personaje.asset_ref == asset_ref)
            .first()
        )
        if personaje is None:
            raise JobError(f"el spec referencia el personaje '{asset_ref}' pero no existe ese Personaje")
        asset = (
            db.query(models.Asset)
            .filter(
                models.Asset.personaje_id == personaje.id,
                models.Asset.tipo.in_(("parte_personaje", "vector_personaje")),
                models.Asset.aprobado.is_(True),
            )
            .order_by(models.Asset.creado_en.desc())
            .first()
        )
        if asset is None:
            raise JobError(f"el personaje '{asset_ref}' todavía no tiene partes aprobadas")

        if asset.tipo == "vector_personaje":
            metadatos_asset = asset.metadatos or {}
            if "familiaRef" in metadatos_asset:
                # Fase C: instancia de familia paramétrica — a diferencia de un
                # asset de biblioteca fija (que Remotion resuelve solo, no viaja
                # por --props), acá SÍ hace falta mandar familiaRef+parametros
                # (son JSON plano) para que EpisodeRenderer llame a la factory.
                personajes_out[asset_ref] = {"familiaRef": metadatos_asset["familiaRef"], "parametros": metadatos_asset.get("parametros") or {}}
            else:
                _verificar_asset_ref(metadatos_asset.get("archivo", ""), asset_ref)
            continue  # el caso de biblioteca fija lo resuelve PERSONAJES_VECTOR del lado de Remotion, no viaja por --props

        puppet = asset.metadatos or {}
        partes = puppet.get("partes", {})
        personaje_dir = (tenant_dir / asset.ruta_archivo).parent
        subcarpeta = f"assets/personajes/{personaje.id}"

        def _parte(relpath: str) -> dict:
            return {"src": _copiar_a_public(personaje_dir / relpath, subcarpeta, Path(relpath).name)}

        pivotes = puppet.get("pivotes", {})
        personajes_out[asset_ref] = {
            "id": asset_ref,
            "cabezaPivot": pivotes.get("cabeza"),
            "propPivot": pivotes.get("prop"),
            "apendicePivot": pivotes.get("apendice"),
            "cuerpo": _parte(partes["cuerpo"]),
            "cabeza": _parte(partes["cabeza"]),
            "ojosAbiertos": _parte(partes["ojos_abiertos"]),
            "ojosCerrados": _parte(partes["ojos_cerrados"]),
            "cejas": _parte(partes["cejas"]),
            "bocas": {codigo: _parte(rel) for codigo, rel in partes.get("bocas", {}).items()},
            **({"prop": _parte(partes["prop"])} if "prop" in partes else {}),
        }

    ids_linea = {
        l["id"] for esc in spec.get("escenas", []) for t in esc.get("tomas", []) for l in t.get("lineas", [])
    }
    audios_aprobados = (
        db.query(models.Asset)
        .filter(models.Asset.episodio_id == episodio.id, models.Asset.tipo == "audio", models.Asset.aprobado.is_(True))
        .order_by(models.Asset.creado_en.desc())
        .all()
    )
    audio_por_linea = {}
    for a in audios_aprobados:
        lid = (a.metadatos or {}).get("linea_id")
        if lid and lid not in audio_por_linea:  # ya vienen desc por creado_en, nos quedamos con el más nuevo
            audio_por_linea[lid] = a

    lineas_audio_out: dict = {}
    for linea_id in ids_linea:
        asset = audio_por_linea.get(linea_id)
        if asset is None:
            raise JobError(f"la línea '{linea_id}' todavía no tiene audio aprobado")
        meta = dict(asset.metadatos or {})
        meta.pop("linea_id", None)
        meta.pop("archivo", None)
        archivo_fuente = tenant_dir / asset.ruta_archivo
        ext = archivo_fuente.suffix or ".mp3"
        meta["archivo"] = _copiar_a_public(archivo_fuente, "assets/audio", f"{linea_id}{ext}")
        lineas_audio_out[linea_id] = meta

    return {"fondos": fondos_out, "personajesCatalogo": personajes_out, "lineasAudio": lineas_audio_out}


def _comando_familia(tenant_dir: Path, entidad, tipo_familia: str, out_subcarpeta: str) -> tuple[list[str], Path]:
    """Igual que _comando_vector pero para una instancia de familia paramétrica
    (Fase C, docs/PROJECT_ROADMAP.md) — no hay ningún .tsx que verificar (la
    familia ya es código probado), el preview sale de PreviewFamilia.tsx
    llamando a la factory con los parámetros guardados en `entidad`."""
    _regenerar_registry()
    out_dir = tenant_dir / out_subcarpeta / str(entidad.id)
    out_dir.mkdir(parents=True, exist_ok=True)
    props_path = out_dir / "preview_props.json"
    props_path.write_text(
        json.dumps({"familia": entidad.familia_ref, "tipo": tipo_familia, "parametros": entidad.parametros or {}}, ensure_ascii=False),
        encoding="utf-8",
    )
    png_path = out_dir / "preview.png"
    cmd = [
        "npx", "remotion", "still", "src/index.ts", "PreviewFamilia", str(png_path.resolve()),
        f"--props={props_path.resolve()}",
    ]
    return cmd, png_path


def _comando_vector(tenant_dir: Path, entidad, composicion: str, out_subcarpeta: str, archivo: str, asset_ref: str) -> tuple[list[str], Path]:
    """Común a vector_personaje/vector_fondo/vector_objeto: regenera
    library/registry.ts (nunca confiar en que ya estaba al día), confirma que el
    asset_ref del .tsx quedó adentro, y arma el `remotion still` que genera el
    preview sobre el que se va a aprobar/rechazar — sin ninguna llamada a AWS."""
    _regenerar_registry()
    _verificar_asset_ref(archivo, asset_ref)

    out_dir = tenant_dir / out_subcarpeta / str(entidad.id)
    out_dir.mkdir(parents=True, exist_ok=True)
    props_path = out_dir / "preview_props.json"
    props_path.write_text(json.dumps({"asset_ref": asset_ref}, ensure_ascii=False), encoding="utf-8")
    png_path = out_dir / "preview.png"
    cmd = [
        "npx", "remotion", "still", "src/index.ts", composicion, str(png_path.resolve()),
        f"--props={props_path.resolve()}",
    ]
    return cmd, png_path


def _construir_comando(db: Session, job: models.GenerationJob) -> tuple[list[str], Path, dict]:
    """Devuelve (comando, cwd_de_salida, contexto) — contexto trae lo que el callback
    post-éxito necesita (p.ej. rutas de archivos esperados) sin volver a tocar la DB."""
    params = job.parametros or {}
    simular = bool(params.get("_simular", True))
    tenant_dir = _tenant_dir(job.tenant_id)

    if not simular:
        _verificar_presupuesto(db, job, params)

    if job.tipo == "episode_spec":
        episodio_id = _requiere(job, "episodio_id")
        episodio = db.get(models.Episodio, episodio_id)
        if episodio is None:
            raise JobError("episodio no encontrado")
        if not episodio.guion_texto:
            raise JobError("el episodio no tiene guion_texto todavía")
        out_dir = tenant_dir / "episodios" / str(episodio_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        guion_path = out_dir / "guion.txt"
        guion_path.write_text(episodio.guion_texto, encoding="utf-8")
        spec_path = out_dir / "spec.json"

        # Catálogo REAL de este tenant — sin esto el modelo no tiene forma de saber
        # qué asset_ref ya existen y puede inventar uno que no coincide con ningún
        # Personaje/Fondo real, rompiendo preparar_catalogo_remotion más adelante
        # (detectado probando el flujo completo de punta a punta, no era un hueco
        # teórico). Mismo criterio que ya usa _construir_comando para otros jobs:
        # consultar la DB del tenant, no asumir nada del lado del script de Bedrock.
        personajes_catalogo = [
            # "id" del spec (usado en hablante/personajes_en_escena) = último
            # segmento del asset_ref (p.ej. "2d/personajes/lucia" -> "lucia") — no
            # hay un slug propio en el modelo, y el nombre para mostrar puede tener
            # tildes/espacios, no sirve como id.
            {"id": p.asset_ref.rsplit("/", 1)[-1], "nombre": p.nombre, "asset_ref": p.asset_ref}
            for p in db.query(models.Personaje).filter(models.Personaje.tenant_id == job.tenant_id).all()
        ]
        fondos_catalogo = [{"asset_ref": f.asset_ref} for f in db.query(models.Fondo).filter(models.Fondo.tenant_id == job.tenant_id).all()]
        personajes_path = out_dir / "personajes_catalogo.json"
        fondos_path = out_dir / "fondos_catalogo.json"
        personajes_path.write_text(json.dumps(personajes_catalogo, ensure_ascii=False), encoding="utf-8")
        fondos_path.write_text(json.dumps(fondos_catalogo, ensure_ascii=False), encoding="utf-8")

        cmd = [
            sys.executable, str(PIPELINE_SPEC / "generar_episode_spec.py"),
            "--guion", str(guion_path),
            "--episodio-id", str(episodio_id),
            "--out", str(spec_path),
            "--estilo", episodio.estilo,
            "--modo-voz", episodio.modo_voz,
        ]
        if personajes_catalogo:
            cmd += ["--personajes", str(personajes_path)]
        if fondos_catalogo:
            cmd += ["--fondos", str(fondos_path)]
        if "modelo" in params:
            cmd += ["--modelo", params["modelo"]]
        if "max_tokens" in params:
            cmd += ["--max-tokens", str(params["max_tokens"])]
        if simular:
            cmd.append("--dry-run")
        return cmd, None, {"spec_path": spec_path, "episodio_id": episodio_id}

    if job.tipo == "detectar_necesidades":
        episodio_id = _requiere(job, "episodio_id")
        episodio = db.get(models.Episodio, episodio_id)
        if episodio is None:
            raise JobError("episodio no encontrado")
        if not episodio.guion_texto:
            raise JobError("el episodio no tiene guion_texto todavía")
        out_dir = tenant_dir / "episodios" / str(episodio_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        guion_path = out_dir / "guion.txt"
        guion_path.write_text(episodio.guion_texto, encoding="utf-8")
        necesidades_path = out_dir / "necesidades.json"

        cmd = [
            sys.executable, str(PIPELINE_SPEC / "detectar_necesidades.py"),
            "--guion", str(guion_path),
            "--out", str(necesidades_path),
        ]
        if "modelo" in params:
            cmd += ["--modelo", params["modelo"]]
        if "max_tokens" in params:
            cmd += ["--max-tokens", str(params["max_tokens"])]
        if simular:
            cmd.append("--dry-run")
        return cmd, None, {"necesidades_path": necesidades_path, "episodio_id": episodio_id}

    if job.tipo == "hoja_personaje":
        personaje_id = _requiere(job, "personaje_id")
        personaje = db.get(models.Personaje, personaje_id)
        if personaje is None:
            raise JobError("personaje no encontrado")
        sujeto = params.get("sujeto")
        if not sujeto:
            raise JobError("parametros.sujeto es requerido para hoja_personaje")
        out_dir = tenant_dir / "personajes" / str(personaje_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        cmd = [
            sys.executable, str(PIPELINE_2D / "generar_hoja.py"),
            "--id", personaje.nombre,
            "--sujeto", sujeto,
            "--out", str(out_dir),
        ]
        if "aspect_ratio" in params:
            cmd += ["--aspect-ratio", params["aspect_ratio"]]
        if "seed" in params:
            cmd += ["--seed", str(params["seed"])]
        if simular:
            cmd.append("--dry-run")
        return cmd, None, {"personaje_id": personaje_id}

    if job.tipo == "partes_personaje":
        personaje_id = _requiere(job, "personaje_id")
        personaje = db.get(models.Personaje, personaje_id)
        if personaje is None:
            raise JobError("personaje no encontrado")
        regiones = params.get("regiones")
        if not regiones:
            raise JobError("parametros.regiones es requerido para partes_personaje")
        out_dir = tenant_dir / "personajes" / str(personaje_id)
        regiones_path = out_dir / "regiones.json"
        out_dir.mkdir(parents=True, exist_ok=True)
        regiones_path.write_text(json.dumps(regiones, ensure_ascii=False), encoding="utf-8")
        cmd = [
            sys.executable, str(PIPELINE_2D / "generar_partes.py"),
            "--id", personaje.nombre,
            "--regiones", str(regiones_path),
            "--out", str(out_dir),
        ]
        if simular:
            cmd.append("--dry-run")
        return cmd, None, {"personaje_id": personaje_id}

    if job.tipo == "fondo":
        fondo_id = _requiere(job, "fondo_id")
        fondo = db.get(models.Fondo, fondo_id)
        if fondo is None:
            raise JobError("fondo no encontrado")
        spec = params.get("spec")
        if not spec:
            raise JobError("parametros.spec es requerido para fondo (capas/luces/humo)")
        out_dir = tenant_dir / "fondos" / str(fondo_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        spec_path = out_dir / "fondo_spec.json"
        spec_path.write_text(json.dumps(spec, ensure_ascii=False), encoding="utf-8")
        cmd = [
            sys.executable, str(PIPELINE_2D / "generar_fondo.py"),
            "--spec", str(spec_path),
            "--out", str(out_dir),
        ]
        if "aspect_ratio" in params:
            cmd += ["--aspect-ratio", params["aspect_ratio"]]
        if simular:
            cmd.append("--dry-run")
        return cmd, None, {"fondo_id": fondo_id}

    if job.tipo == "voz_polly":
        episodio_id = _requiere(job, "episodio_id")
        texto = params.get("texto")
        linea_id = params.get("linea_id")
        if not texto or not linea_id:
            raise JobError("parametros.texto y parametros.linea_id son requeridos para voz_polly")
        out_dir = tenant_dir / "episodios" / str(episodio_id) / "audio"
        out_dir.mkdir(parents=True, exist_ok=True)
        json_path = out_dir / f"{linea_id}.audio.json"
        mp3_path = out_dir / f"{linea_id}.mp3"
        cmd = [
            sys.executable, str(PIPELINE_AUDIO / "generar_voz_polly.py"),
            "--texto", texto,
            "--linea-id", linea_id,
            "--out", str(json_path),
        ]
        if not simular:
            cmd += ["--audio-out", str(mp3_path)]
        for campo, flag in (("voz", "--voz"), ("engine", "--engine"), ("idioma", "--idioma"), ("fps", "--fps")):
            if campo in params:
                cmd += [flag, str(params[campo])]
        if simular:
            cmd.append("--dry-run")
        return cmd, None, {"episodio_id": episodio_id, "linea_id": linea_id, "json_path": json_path, "mp3_path": mp3_path}

    if job.tipo in ("vector_personaje", "vector_fondo", "vector_objeto"):
        config = {
            "vector_personaje": ("personaje_id", models.Personaje, "personaje", "personajes", "PreviewPersonaje"),
            "vector_fondo": ("fondo_id", models.Fondo, "fondo", "fondos", "PreviewFondo"),
            "vector_objeto": ("objeto_id", models.Objeto, "objeto", "objetos", "PreviewObjeto"),
        }[job.tipo]
        campo_id, Modelo, nombre_campo, subcarpeta, composicion = config
        entidad_id = _requiere(job, campo_id)
        entidad = db.get(Modelo, entidad_id)
        if entidad is None:
            raise JobError(f"{nombre_campo} no encontrado")

        # Fase C (docs/PROJECT_ROADMAP.md): esta entidad puede venir de una
        # familia paramétrica en vez de un .tsx fijo de la biblioteca — mismo job
        # (vector_personaje/vector_objeto), comando distinto. vector_fondo no
        # tiene familias todavía (fuera del alcance de la Fase C).
        if getattr(entidad, "familia_ref", None):
            tipo_familia = "personaje" if job.tipo == "vector_personaje" else "objeto"
            cmd, png_path = _comando_familia(tenant_dir, entidad, tipo_familia, subcarpeta)
            return cmd, REMOTION_APP_DIR, {campo_id: entidad_id, "png_path": png_path, "familia_ref": entidad.familia_ref, "parametros": entidad.parametros}

        archivo = params.get("archivo")  # ruta al .tsx, relativa a REMOTION_APP_DIR
        if not archivo:
            raise JobError(f"parametros.archivo (ruta al .tsx en library/) es requerido para {job.tipo}")
        cmd, png_path = _comando_vector(tenant_dir, entidad, composicion, subcarpeta, archivo, entidad.asset_ref)
        return cmd, REMOTION_APP_DIR, {campo_id: entidad_id, "png_path": png_path, "archivo": archivo}

    if job.tipo == "render_episodio":
        episodio_id = _requiere(job, "episodio_id")
        episodio = db.get(models.Episodio, episodio_id)
        if episodio is None:
            raise JobError("episodio no encontrado")
        if not episodio.spec_json:
            raise JobError("el episodio no tiene episode_spec todavía (correr el job 'episode_spec' primero)")

        catalogo = preparar_catalogo_remotion(db, episodio)  # falla con JobError si falta algo por aprobar
        out_dir = tenant_dir / "episodios" / str(episodio_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        props_path = out_dir / "render_props.json"
        props_path.write_text(json.dumps({"spec": episodio.spec_json, **catalogo}, ensure_ascii=False), encoding="utf-8")
        mp4_path = out_dir / "episodio.mp4"
        # El subproceso corre con cwd=REMOTION_APP_DIR (lo necesita `npx remotion`
        # para encontrar src/index.ts y node_modules) — los argumentos tienen que
        # ser absolutos, si no se resolverían relativos a REMOTION_APP_DIR y no a
        # tenant_dir. `.resolve()` se llama ahora, con el cwd real del proceso
        # backend, antes de que el subprocess cambie nada.
        cmd = [
            "npx", "remotion", "render", "src/index.ts", "Episodio", str(mp4_path.resolve()),
            f"--props={props_path.resolve()}",
        ]
        # render_episodio no gasta AWS (todo lo real ya se generó y aprobó antes) —
        # no tiene --dry-run propio ni pasa por _verificar_presupuesto (costos.
        # estimar_costo_job devuelve None para este tipo).
        return cmd, REMOTION_APP_DIR, {"episodio_id": episodio_id, "mp4_path": mp4_path}

    raise JobError(f"tipo de job desconocido: {job.tipo}")


def _loguear_uso_real(db: Session, job: models.GenerationJob):
    """Cada script del pipeline imprime, tras una corrida real, una línea
    `USO_REAL: [...]` con el uso exacto (no estimado) — la parseamos para dejar
    registro en UsageLog, base de costo_acumulado_episodio()."""
    stdout = (job.resultado or {}).get("stdout", "")
    for linea in stdout.splitlines():
        if not linea.startswith("USO_REAL: "):
            continue
        try:
            entradas = json.loads(linea[len("USO_REAL: "):])
        except json.JSONDecodeError:
            continue
        for entrada in entradas:
            db.add(models.UsageLog(
                tenant_id=job.tenant_id,
                job_id=job.id,
                servicio=entrada["servicio"],
                operacion=entrada["operacion"],
                cantidad=entrada["cantidad"],
                unidad=entrada["unidad"],
                costo_estimado_usd=entrada["costo_estimado_usd"],
            ))


def _post_exito(db: Session, job: models.GenerationJob, contexto: dict, simular: bool):
    """Efectos sobre el resto del modelo de datos tras un job exitoso — solo aplica
    cuando no fue simulado (en --dry-run no se generó ningún archivo real)."""
    if simular:
        return

    _loguear_uso_real(db, job)

    if job.tipo == "episode_spec":
        spec_path: Path = contexto["spec_path"]
        if spec_path.exists():
            episodio = db.get(models.Episodio, contexto["episodio_id"])
            episodio.spec_json = json.loads(spec_path.read_text(encoding="utf-8"))
            episodio.estado = "revision"

    elif job.tipo == "detectar_necesidades":
        necesidades_path: Path = contexto["necesidades_path"]
        if necesidades_path.exists():
            from .matching import emparejar_necesidades  # import local: evita cargar esto si no hace falta

            bruto = json.loads(necesidades_path.read_text(encoding="utf-8"))
            episodio = db.get(models.Episodio, contexto["episodio_id"])
            episodio.necesidades_json = {"necesidades": emparejar_necesidades(bruto.get("necesidades", []))}

    elif job.tipo == "hoja_personaje":
        personaje_id = contexto["personaje_id"]
        hoja_path = _tenant_dir(job.tenant_id) / "personajes" / str(personaje_id) / "hoja.png"
        if hoja_path.exists():
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo="hoja_personaje",
                ruta_archivo=str(hoja_path.relative_to(_tenant_dir(job.tenant_id))),
                personaje_id=personaje_id,
                aprobado=False,
            ))

    elif job.tipo == "partes_personaje":
        personaje_id = contexto["personaje_id"]
        puppet_path = _tenant_dir(job.tenant_id) / "personajes" / str(personaje_id) / "puppet.json"
        if puppet_path.exists():
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo="parte_personaje",
                ruta_archivo=str(puppet_path.relative_to(_tenant_dir(job.tenant_id))),
                personaje_id=personaje_id,
                metadatos=json.loads(puppet_path.read_text(encoding="utf-8")),
                aprobado=False,
            ))

    elif job.tipo == "fondo":
        fondo_id = contexto["fondo_id"]
        fondo_json = _tenant_dir(job.tenant_id) / "fondos" / str(fondo_id) / "fondo.json"
        if fondo_json.exists():
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo="capa_fondo",
                ruta_archivo=str(fondo_json.relative_to(_tenant_dir(job.tenant_id))),
                fondo_id=fondo_id,
                metadatos=json.loads(fondo_json.read_text(encoding="utf-8")),
                aprobado=False,
            ))

    elif job.tipo == "voz_polly":
        mp3_path: Path = contexto["mp3_path"]
        json_path: Path = contexto["json_path"]
        if mp3_path.exists() and json_path.exists():
            audio_linea = json.loads(json_path.read_text(encoding="utf-8"))[contexto["linea_id"]]
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo="audio",
                ruta_archivo=str(mp3_path.relative_to(_tenant_dir(job.tenant_id))),
                episodio_id=contexto["episodio_id"],
                metadatos={"linea_id": contexto["linea_id"], **audio_linea},
                aprobado=False,
            ))

    elif job.tipo == "render_episodio":
        mp4_path: Path = contexto["mp4_path"]
        if mp4_path.exists():
            episodio_id = contexto["episodio_id"]
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo="render",
                ruta_archivo=str(mp4_path.relative_to(_tenant_dir(job.tenant_id))),
                episodio_id=episodio_id,
                aprobado=False,
            ))
            episodio = db.get(models.Episodio, episodio_id)
            episodio.estado = "listo"

    elif job.tipo in ("vector_personaje", "vector_fondo", "vector_objeto"):
        png_path: Path = contexto["png_path"]
        if png_path.exists() and "familia_ref" in contexto:
            # Fase C: instancia de familia paramétrica — no hay .tsx propio que
            # referenciar, `ruta_archivo` guarda el id de la familia (no es un
            # path real, pero la columna lo pide; documentado acá).
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo=job.tipo,
                ruta_archivo=f"familia:{contexto['familia_ref']}",
                personaje_id=contexto.get("personaje_id"),
                fondo_id=contexto.get("fondo_id"),
                objeto_id=contexto.get("objeto_id"),
                metadatos={
                    "familiaRef": contexto["familia_ref"],
                    "parametros": contexto["parametros"],
                    "preview_png": str(png_path.relative_to(_tenant_dir(job.tenant_id))),
                },
                aprobado=False,
            ))
        elif png_path.exists():
            archivo: str = contexto["archivo"]
            ruta_tsx_abs = (REMOTION_APP_DIR / archivo).resolve()
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo=job.tipo,
                # Repo-relative, NO relativa a tenant_dir — es código versionado,
                # compartido entre tenants (ver nota en models.Asset.ruta_archivo).
                ruta_archivo=str(ruta_tsx_abs.relative_to(REPO_ROOT)),
                personaje_id=contexto.get("personaje_id"),
                fondo_id=contexto.get("fondo_id"),
                objeto_id=contexto.get("objeto_id"),
                metadatos={"archivo": archivo, "preview_png": str(png_path.relative_to(_tenant_dir(job.tenant_id)))},
                aprobado=False,
            ))


def _ejecutar(db: Session, job: models.GenerationJob):
    job.estado = "corriendo"
    job.iniciado_en = _now()
    db.commit()

    params = job.parametros or {}
    # render_episodio y los tipos vector_* no tienen modo --dry-run (no existe
    # "simular" un render/still local, no gastan AWS) — siempre se tratan como
    # reales para que _post_exito() sí registre el Asset resultante.
    SIN_SIMULAR = {"render_episodio", "vector_personaje", "vector_fondo", "vector_objeto"}
    simular = bool(params.get("_simular", True)) and job.tipo not in SIN_SIMULAR

    try:
        cmd, cwd, contexto = _construir_comando(db, job)
    except JobError as e:
        job.estado = "fallido"
        job.error = str(e)
        job.terminado_en = _now()
        db.commit()
        return

    timeout = TIMEOUT_RENDER_SEGUNDOS if job.tipo == "render_episodio" else TIMEOUT_SEGUNDOS
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
    except subprocess.TimeoutExpired:
        job.estado = "fallido"
        job.error = f"timeout tras {timeout}s"
        job.terminado_en = _now()
        db.commit()
        return

    job.resultado = {
        "returncode": proc.returncode,
        "stdout": proc.stdout[-4000:],
        "stderr": proc.stderr[-4000:],
    }
    if proc.returncode != 0:
        job.estado = "fallido"
        job.error = proc.stderr[-2000:] or f"returncode {proc.returncode}"
        job.terminado_en = _now()
        db.commit()
        return

    try:
        _post_exito(db, job, contexto, simular)
        job.estado = "completado"
    except Exception as e:  # datos a medio escribir no deben dejar el job colgado en "corriendo"
        db.rollback()
        job.estado = "fallido"
        job.error = f"job corrió pero falló al actualizar el resto del modelo: {e}"
    job.terminado_en = _now()
    try:
        db.commit()
    except Exception as e:
        # Un error que solo aparece al hacer flush/commit (p.ej. un valor que
        # desborda una columna) no se ve en el try de arriba — sin este segundo
        # intento, el job queda colgado en "corriendo" para siempre, silencioso
        # (la excepción mata el hilo de fondo sin que nadie se entere). Pasó de
        # verdad una vez con UsageLog.operacion (varchar(60) desbordado).
        db.rollback()
        job.estado = "fallido"
        job.error = f"job corrió pero falló al guardar el resultado: {e}"
        job.terminado_en = _now()
        db.commit()


def encolar_job(job_id: uuid.UUID):
    """Corre el job en un hilo aparte con su propia sesión de DB — se llama desde un
    BackgroundTask de FastAPI, después de que el request que lo creó ya devolvió
    respuesta (la sesión de ese request ya estaría cerrada)."""
    from .database import SessionLocal

    def _run():
        db = SessionLocal()
        try:
            job = db.get(models.GenerationJob, job_id)
            if job is not None:
                _ejecutar(db, job)
        finally:
            db.close()

    threading.Thread(target=_run, daemon=True).start()
