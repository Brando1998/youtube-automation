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

TIMEOUT_SEGUNDOS = 600


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
        cmd = [
            sys.executable, str(PIPELINE_SPEC / "generar_episode_spec.py"),
            "--guion", str(guion_path),
            "--episodio-id", str(episodio_id),
            "--out", str(spec_path),
            "--estilo", episodio.estilo,
            "--modo-voz", episodio.modo_voz,
        ]
        if "modelo" in params:
            cmd += ["--modelo", params["modelo"]]
        if "max_tokens" in params:
            cmd += ["--max-tokens", str(params["max_tokens"])]
        if simular:
            cmd.append("--dry-run")
        return cmd, out_dir, {"spec_path": spec_path, "episodio_id": episodio_id}

    if job.tipo == "hoja_personaje":
        personaje_id = _requiere(job, "personaje_id")
        personaje = db.get(models.Personaje, personaje_id)
        if personaje is None:
            raise JobError("personaje no encontrado")
        sujeto = params.get("sujeto")
        if not sujeto:
            raise JobError("parametros.sujeto es requerido para hoja_personaje")
        out_dir = tenant_dir / "personajes" / str(personaje_id)
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
        return cmd, out_dir, {"personaje_id": personaje_id}

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
        return cmd, out_dir, {"personaje_id": personaje_id}

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
        return cmd, out_dir, {"fondo_id": fondo_id}

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
        return cmd, out_dir, {"episodio_id": episodio_id, "linea_id": linea_id, "json_path": json_path, "mp3_path": mp3_path}

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
                aprobado=False,
            ))

    elif job.tipo == "voz_polly":
        mp3_path: Path = contexto["mp3_path"]
        if mp3_path.exists():
            db.add(models.Asset(
                tenant_id=job.tenant_id,
                tipo="audio",
                ruta_archivo=str(mp3_path.relative_to(_tenant_dir(job.tenant_id))),
                episodio_id=contexto["episodio_id"],
                metadatos={"linea_id": contexto["linea_id"]},
                aprobado=False,
            ))


def _ejecutar(db: Session, job: models.GenerationJob):
    job.estado = "corriendo"
    job.iniciado_en = _now()
    db.commit()

    params = job.parametros or {}
    simular = bool(params.get("_simular", True))

    try:
        cmd, _cwd, contexto = _construir_comando(db, job)
    except JobError as e:
        job.estado = "fallido"
        job.error = str(e)
        job.terminado_en = _now()
        db.commit()
        return

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_SEGUNDOS)
    except subprocess.TimeoutExpired:
        job.estado = "fallido"
        job.error = f"timeout tras {TIMEOUT_SEGUNDOS}s"
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
        job.estado = "fallido"
        job.error = f"job corrió pero falló al actualizar el resto del modelo: {e}"
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
