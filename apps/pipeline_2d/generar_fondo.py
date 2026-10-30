"""Fase A5: genera un fondo en capas (cielo, lejano, medio, suelo, primer plano, ...)
vía Stability (Bedrock), siguiendo el mismo style guide del proyecto que `generar_hoja.py`
— ver docs/PLAN.md, sección "Assets del estilo ilustrado".

A diferencia de los personajes (una hoja -> se recorta en partes), cada capa de un
fondo se genera directamente, aislada sobre un fondo plano simple, y después se le
quita ese fondo plano con Remove Background — no hay nada que recortar porque cada
capa es su propia composición (un cielo, una silueta de cerros, una cabaña, etc.),
no una región de una imagen más grande.

El contenido de cada capa (qué dibujar, en qué profundidad, qué luces/humo tiene) se
describe a mano en un archivo --spec (ver `fondo_spec.ejemplo.json`) — este script no
inventa la composición del fondo, solo la genera y la limpia.

Uso:
  python3 generar_fondo.py --spec fondo_spec.json --out assets/2d/fondos/cabana-bosque-noche [--dry-run]
"""
import argparse
import base64
import json
import os
import random
from datetime import datetime, timezone

STYLE_GUIDE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "style_guide.json")
STABILITY_REGION = "us-west-2"
MODEL_CORE = "stability.stable-image-core-v1:1"  # in-region en us-west-2, igual que generar_hoja.py
# Remove Background no tiene endpoint in-region en us-west-2 (a diferencia de Stable
# Image Core) — necesita el id con prefijo "us." para enrutamiento Geo, confirmado
# contra la doc oficial de AWS (mismo hallazgo que en generar_partes.py).
MODEL_REMOVE_BG = "us.stability.stable-image-remove-background-v1:0"

# Duplicados a propósito de apps/web/app/costos.py (ver nota ahí).
PRECIO_STABLE_IMAGE_CORE_USD = 0.03
PRECIO_EDICION_USD = 0.07

AISLAMIENTO_EXTRA = (
    ", isolated on a plain flat white background, no other scene elements, no horizon, no gradient sky"
)
NEGATIVE_EXTRA = ", additional scenic background, full landscape, gradient background, vignette, border, frame"

LUZ_CAMPOS_REQUERIDOS = ["x", "y", "depth", "radio"]


def cargar_style_guide():
    with open(STYLE_GUIDE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def cargar_spec(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validar_spec(spec):
    if "id" not in spec:
        raise ValueError("El spec necesita 'id' (p.ej. '2d/fondos/cabana-bosque-noche')")
    if not spec.get("capas"):
        raise ValueError("El spec necesita al menos una capa en 'capas'")
    for i, capa in enumerate(spec["capas"]):
        for campo in ("id", "depth", "sujeto"):
            if campo not in capa:
                raise ValueError(f"Capa #{i}: falta el campo '{campo}'")
        if not (0 <= capa["depth"] <= 1):
            raise ValueError(f"Capa '{capa['id']}': depth debe estar entre 0 y 1 (es {capa['depth']})")
    for i, luz in enumerate(spec.get("luces", [])):
        faltantes = [c for c in LUZ_CAMPOS_REQUERIDOS if c not in luz]
        if faltantes:
            raise ValueError(f"Luz #{i}: faltan campos {faltantes}")
    humo = spec.get("humo_origen")
    if humo is not None:
        for campo in ("x", "y", "depth"):
            if campo not in humo:
                raise ValueError(f"humo_origen: falta el campo '{campo}'")


def construir_prompt(style_guide, sujeto_capa):
    paleta_dominante = ", ".join(style_guide["paleta"]["calido_luz"][:2])
    prompt = style_guide["prompt_template"].format(
        linea_color=style_guide["linea"]["color"],
        paleta_dominante=paleta_dominante,
        sujeto=sujeto_capa + AISLAMIENTO_EXTRA,
    )
    negative_prompt = style_guide["negative_prompt"] + NEGATIVE_EXTRA
    return prompt, negative_prompt


def generar_capa_raw(client, prompt, negative_prompt, aspect_ratio, seed):
    body = json.dumps({
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "mode": "text-to-image",
        "aspect_ratio": aspect_ratio,
        "seed": seed,
        "output_format": "png",
    })
    resp = client.invoke_model(modelId=MODEL_CORE, body=body)
    out = json.loads(resp["body"].read())
    return base64.b64decode(out["images"][0])


def quitar_fondo(client, image_bytes):
    body = json.dumps({"image": base64.b64encode(image_bytes).decode("utf-8"), "output_format": "png"})
    resp = client.invoke_model(modelId=MODEL_REMOVE_BG, body=body)
    out = json.loads(resp["body"].read())
    return base64.b64decode(out["images"][0])


def generar_fondo(spec_path, out_dir, aspect_ratio="9:16", seed_base=None, dry_run=False):
    style_guide = cargar_style_guide()
    spec = cargar_spec(spec_path)
    validar_spec(spec)

    plan = []
    for capa in spec["capas"]:
        prompt, negative_prompt = construir_prompt(style_guide, capa["sujeto"])
        plan.append((capa["id"], capa["depth"], prompt, negative_prompt))

    if dry_run:
        print(f"[dry-run] fondo: {spec['id']}, {len(plan)} capas, aspect_ratio={aspect_ratio}")
        for capa_id, depth, prompt, _ in plan:
            print(f"[dry-run] capa '{capa_id}' (depth={depth}): text-to-image -> remove_bg")
            print(f"           prompt: {prompt[:140]}...")
        if spec.get("luces"):
            print(f"[dry-run] {len(spec['luces'])} luces definidas (sin llamadas a Bedrock)")
        if spec.get("humo_origen"):
            print("[dry-run] humo_origen definido (sin llamadas a Bedrock)")
        print(f"[dry-run] {len(plan) * 2} llamadas a Bedrock se harían (0 ejecutadas). "
              "Ninguna conexión de red fue realizada.")
        return None

    import boto3
    client = boto3.client("bedrock-runtime", region_name=STABILITY_REGION)

    capas_dir = os.path.join(out_dir, "capas")
    os.makedirs(capas_dir, exist_ok=True)

    capas_meta = []
    for i, (capa_id, depth, prompt, negative_prompt) in enumerate(plan):
        seed = (seed_base + i) if seed_base is not None else random.randint(0, 4294967295)
        raw_bytes = generar_capa_raw(client, prompt, negative_prompt, aspect_ratio, seed)
        final_bytes = quitar_fondo(client, raw_bytes)
        ruta = os.path.join(capas_dir, f"{capa_id}.png")
        with open(ruta, "wb") as f:
            f.write(final_bytes)
        capas_meta.append({
            "id": capa_id,
            "depth": depth,
            "archivo": os.path.relpath(ruta, out_dir),
            "prompt_completo": prompt,
            "seed": seed,
        })

    fondo_meta = {
        "fondo_id": spec["id"],
        "capas": capas_meta,
        "luces": spec.get("luces", []),
        "humo_origen": spec.get("humo_origen"),
        "modelo_core": MODEL_CORE,
        "modelo_remove_background": MODEL_REMOVE_BG,
        "region": STABILITY_REGION,
        "aspect_ratio": aspect_ratio,
        "style_guide_version": style_guide["version"],
        "generado_en": datetime.now(timezone.utc).isoformat(),
        "aprobado": False,
    }
    os.makedirs(out_dir, exist_ok=True)
    meta_path = os.path.join(out_dir, "fondo.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(fondo_meta, f, ensure_ascii=False, indent=2)

    print("USO_REAL: " + json.dumps([
        {"servicio": "bedrock-stability", "operacion": MODEL_CORE,
         "cantidad": len(plan), "unidad": "imagenes", "costo_estimado_usd": round(len(plan) * PRECIO_STABLE_IMAGE_CORE_USD, 4)},
        {"servicio": "bedrock-stability", "operacion": MODEL_REMOVE_BG,
         "cantidad": len(plan), "unidad": "llamadas", "costo_estimado_usd": round(len(plan) * PRECIO_EDICION_USD, 4)},
    ]))

    return meta_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True, help="JSON con las capas/luces/humo del fondo")
    parser.add_argument("--out", required=True, help="carpeta de salida, p.ej. assets/2d/fondos/cabana-bosque-noche")
    parser.add_argument("--aspect-ratio", default="9:16")
    parser.add_argument("--seed-base", type=int, default=None, help="si se da, cada capa usa seed_base + índice")
    parser.add_argument("--dry-run", action="store_true", help="valida y muestra el plan sin llamar a Bedrock")
    args = parser.parse_args()

    resultado = generar_fondo(args.spec, args.out, args.aspect_ratio, args.seed_base, dry_run=args.dry_run)
    if resultado:
        print(f"fondo.json generado: {resultado}")
