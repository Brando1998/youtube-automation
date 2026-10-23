"""Fase A4: genera la hoja de referencia de un personaje 2D vía Stability AI (Bedrock),
usando el style_guide del proyecto para mantener consistencia visual.

Este es el primer paso del flujo de personajes 2D (docs/PLAN.md, sección "Extensión:
estilo ilustrado 2.5D"): imagen de referencia -> hoja de personaje -> (aprobación) ->
partes por separado. Este script hace solo la hoja; las partes son un paso aparte
(generar_partes.py) que solo debe correr después de que el usuario apruebe la hoja.

Uso:
  python3 generar_hoja.py --id lucia --sujeto "..." --out assets/2d/personajes/lucia
"""
import argparse
import base64
import json
import os
import random
from datetime import datetime, timezone

import boto3

STYLE_GUIDE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "style_guide.json")
STABILITY_REGION = "us-west-2"  # Stability AI en Bedrock solo existe en us-west-2 (ver docs/EC2_SETUP.md)
MODEL_ID = "stability.stable-image-core-v1:1"


def cargar_style_guide():
    with open(STYLE_GUIDE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def construir_prompt(style_guide, sujeto):
    paleta_dominante = ", ".join(style_guide["paleta"]["calido_luz"][:2])
    prompt = style_guide["prompt_template"].format(
        linea_color=style_guide["linea"]["color"],
        paleta_dominante=paleta_dominante,
        sujeto=sujeto,
    )
    return prompt, style_guide["negative_prompt"]


def generar_hoja(personaje_id, sujeto, out_dir, aspect_ratio="2:3", seed=None):
    style_guide = cargar_style_guide()
    prompt, negative_prompt = construir_prompt(style_guide, sujeto)
    seed = seed if seed is not None else random.randint(0, 4294967295)

    client = boto3.client("bedrock-runtime", region_name=STABILITY_REGION)
    body = json.dumps({
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "mode": "text-to-image",
        "aspect_ratio": aspect_ratio,
        "seed": seed,
        "output_format": "png",
    })
    resp = client.invoke_model(modelId=MODEL_ID, body=body)
    out = json.loads(resp["body"].read())
    image_bytes = base64.b64decode(out["images"][0])

    os.makedirs(out_dir, exist_ok=True)
    hoja_path = os.path.join(out_dir, "hoja.png")
    with open(hoja_path, "wb") as f:
        f.write(image_bytes)

    meta = {
        "personaje_id": personaje_id,
        "sujeto": sujeto,
        "prompt_completo": prompt,
        "negative_prompt": negative_prompt,
        "modelo": MODEL_ID,
        "region": STABILITY_REGION,
        "seed": seed,
        "aspect_ratio": aspect_ratio,
        "style_guide_version": style_guide["version"],
        "generado_en": datetime.now(timezone.utc).isoformat(),
        "aprobado": False,
    }
    meta_path = os.path.join(out_dir, "hoja.meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return hoja_path, meta_path, len(image_bytes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True, help="id del personaje, p.ej. 'lucia'")
    parser.add_argument("--sujeto", required=True, help="descripción del personaje para el prompt")
    parser.add_argument("--out", required=True, help="carpeta de salida")
    parser.add_argument("--aspect-ratio", default="2:3")
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    hoja_path, meta_path, nbytes = generar_hoja(args.id, args.sujeto, args.out, args.aspect_ratio, args.seed)
    print(f"Hoja generada: {hoja_path} ({nbytes} bytes)")
    print(f"Metadatos: {meta_path}")
