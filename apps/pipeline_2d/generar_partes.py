"""Fase A4 (paso 2): separa una hoja de personaje YA APROBADA en las partes del
puppet (docs/PLAN.md, sección "Assets del estilo ilustrado"): cuerpo, cabeza, ojos
abiertos/cerrados, cejas, bocas por visema (reposo/A/E/O/MBP/FV/L — mismos códigos que
CharacterPuppet.tsx), y props con pivote — cada una como su propia llamada de
image-to-image/inpaint sobre la hoja + remove-background (primitiva "erase" de
Stability), tal como está documentado en el plan.

Requiere dos cosas que NO genera este script:
  1. La hoja (`generar_hoja.py`) ya revisada y con `aprobado: true` en su .meta.json.
  2. Un archivo de regiones (ver --regiones) con las cajas de recorte en píxeles de
     la hoja, escrito a mano después de mirar la hoja — este script no adivina dónde
     está cada parte en la imagen. Ver `regiones.ejemplo.json` en esta carpeta.

Uso:
  python3 generar_partes.py --id lucia --regiones regiones.json \
      --out assets/2d/personajes/lucia [--dry-run]

--dry-run valida las regiones contra el tamaño real de la hoja e imprime las llamadas
que se harían, sin tocar Bedrock ni gastar nada — pensado para probar el script sin
costo mientras no se aprueban más llamadas reales (ver docs/PROGRESS.md).
"""
import argparse
import base64
import json
import os
from datetime import datetime, timezone

from PIL import Image

STYLE_GUIDE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "style_guide.json")
STABILITY_REGION = "us-west-2"
# Remove Background y Search and Replace no tienen endpoint "in-region" en us-west-2
# (a diferencia de Stable Image Core) — solo enrutamiento Geo, que exige el id con
# prefijo "us." (confirmado en la doc oficial de cada modelo, no adivinado).
MODEL_REMOVE_BG = "us.stability.stable-image-remove-background-v1:0"
MODEL_SEARCH_REPLACE = "us.stability.stable-image-search-replace-v1:0"

# Duplicado a propósito de apps/web/app/costos.py (ver nota ahí) — remove-background
# y search-and-replace cuestan igual, confirmado en https://aws.amazon.com/bedrock/pricing/.
PRECIO_EDICION_USD = 0.07


def contar_llamadas_reales(regiones):
    """El `len(plan)` de más abajo cuenta "search_replace+remove_bg" como UNA entrada
    del plan, pero son 2 llamadas reales a Bedrock cada una — este conteo es el que
    de verdad importa para costo (y para loguear uso real tras una corrida)."""
    llamadas = len(PARTES_SIMPLES) + 1 + (len(VISEMAS_NO_REPOSO) * 2)
    if "prop" in regiones:
        llamadas += 1
    return llamadas

VISEMAS_NO_REPOSO = ["A", "E", "O", "MBP", "FV", "L"]

# Qué pedirle a Search and Replace para cada visema, a partir del recorte de la boca en
# reposo — mismo "search_prompt" siempre (busca la boca), cambia el "prompt" (la forma
# deseada). Basado en el mapeo Rhubarb -> VisemaCode ya usado en
# apps/pipeline_audio/generar_audio_local.py (A=P/B/M, D=AA, etc.), no inventado de cero.
PROMPT_POR_VISEMA = {
    "A": "mouth wide open in an AH shape, a bit of the upper teeth showing",
    "E": "mouth open in a wide EH smile shape",
    "O": "mouth rounded and pursed in an OH shape",
    "MBP": "mouth fully closed, pressed together in a flat line",
    "FV": "mouth with the upper teeth gently touching the lower lip",
    "L": "mouth slightly open with the tongue tip visible near the upper teeth",
}

PARTES_SIMPLES = ["cuerpo", "cabeza", "ojos_abiertos", "ojos_cerrados", "cejas"]


def cargar_style_guide():
    with open(STYLE_GUIDE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def cargar_regiones(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validar_region(nombre, region, ancho_hoja, alto_hoja):
    for campo in ("x", "y", "w", "h"):
        if campo not in region:
            raise ValueError(f"Región '{nombre}': falta el campo '{campo}'")
    x, y, w, h = region["x"], region["y"], region["w"], region["h"]
    if w <= 0 or h <= 0:
        raise ValueError(f"Región '{nombre}': w y h deben ser positivos (w={w}, h={h})")
    if x < 0 or y < 0 or x + w > ancho_hoja or y + h > alto_hoja:
        raise ValueError(
            f"Región '{nombre}' ({x},{y},{w}x{h}) se sale de la hoja ({ancho_hoja}x{alto_hoja})"
        )


def recortar(hoja_img, region):
    x, y, w, h = region["x"], region["y"], region["w"], region["h"]
    recorte = hoja_img.crop((x, y, x + w, y + h))
    buf_path = None
    import io
    buf = io.BytesIO()
    recorte.save(buf, format="PNG")
    return buf.getvalue()


def image_to_b64(image_bytes):
    return base64.b64encode(image_bytes).decode("utf-8")


def quitar_fondo(client, image_bytes):
    body = json.dumps({"image": image_to_b64(image_bytes), "output_format": "png"})
    resp = client.invoke_model(modelId=MODEL_REMOVE_BG, body=body)
    out = json.loads(resp["body"].read())
    return base64.b64decode(out["images"][0])


def reemplazar_boca(client, image_bytes, prompt_forma, negative_prompt):
    body = json.dumps({
        "image": image_to_b64(image_bytes),
        "prompt": prompt_forma,
        "search_prompt": "mouth",
        "negative_prompt": negative_prompt,
        "output_format": "png",
    })
    resp = client.invoke_model(modelId=MODEL_SEARCH_REPLACE, body=body)
    out = json.loads(resp["body"].read())
    return base64.b64decode(out["images"][0])


def generar_partes(personaje_id, regiones_path, out_dir, dry_run=False):
    personaje_dir = out_dir
    hoja_path = os.path.join(personaje_dir, "hoja.png")
    meta_path = os.path.join(personaje_dir, "hoja.meta.json")

    if not os.path.exists(hoja_path) or not os.path.exists(meta_path):
        raise FileNotFoundError(
            f"No se encontró hoja.png/hoja.meta.json en {personaje_dir} — corré generar_hoja.py primero"
        )
    with open(meta_path, "r", encoding="utf-8") as f:
        hoja_meta = json.load(f)
    if not hoja_meta.get("aprobado"):
        raise RuntimeError(
            "La hoja todavía no está aprobada (hoja.meta.json: \"aprobado\": false) — "
            "revisala visualmente contra el style guide antes de generar las partes (docs/PLAN.md, Fase A4)."
        )

    style_guide = cargar_style_guide()
    negative_prompt = style_guide["negative_prompt"]
    regiones = cargar_regiones(regiones_path)

    hoja_img = Image.open(hoja_path).convert("RGB")
    ancho_hoja, alto_hoja = hoja_img.size

    requeridas = PARTES_SIMPLES + ["boca_reposo"]
    faltantes = [r for r in requeridas if r not in regiones]
    if faltantes:
        raise ValueError(f"Faltan regiones requeridas en {regiones_path}: {faltantes}")
    for nombre, region in regiones.items():
        if nombre in ("cabeza_pivot", "prop_pivot", "apendice_pivot"):
            continue
        validar_region(nombre, region, ancho_hoja, alto_hoja)

    tiene_prop = "prop" in regiones

    plan = []
    for nombre in PARTES_SIMPLES:
        plan.append(("remove_bg", nombre, regiones[nombre]))
    plan.append(("remove_bg", "boca_reposo", regiones["boca_reposo"]))
    for visema in VISEMAS_NO_REPOSO:
        plan.append(("search_replace+remove_bg", f"boca_{visema}", regiones["boca_reposo"]))
    if tiene_prop:
        plan.append(("remove_bg", "prop", regiones["prop"]))

    if dry_run:
        print(f"[dry-run] hoja: {hoja_path} ({ancho_hoja}x{alto_hoja}px), aprobada: {hoja_meta['aprobado']}")
        for accion, nombre, region in plan:
            print(f"[dry-run] {nombre}: recorte {region} -> {accion}")
        llamadas_reales = contar_llamadas_reales(regiones)
        print(f"[dry-run] {llamadas_reales} llamadas reales a Bedrock se harían "
              f"({len(plan)} pasos del plan, los de boca son 2 llamadas c/u: "
              "search_replace + remove_bg) — 0 ejecutadas. Ninguna conexión de red fue realizada.")
        return None

    import boto3
    client = boto3.client("bedrock-runtime", region_name=STABILITY_REGION)

    partes_dir = os.path.join(personaje_dir, "partes")
    os.makedirs(partes_dir, exist_ok=True)

    rutas = {}
    for nombre in PARTES_SIMPLES:
        recorte_bytes = recortar(hoja_img, regiones[nombre])
        final_bytes = quitar_fondo(client, recorte_bytes)
        ruta = os.path.join(partes_dir, f"{nombre}.png")
        with open(ruta, "wb") as f:
            f.write(final_bytes)
        rutas[nombre] = os.path.relpath(ruta, personaje_dir)

    boca_reposo_bytes = recortar(hoja_img, regiones["boca_reposo"])
    bocas = {}
    final_reposo = quitar_fondo(client, boca_reposo_bytes)
    ruta_reposo = os.path.join(partes_dir, "boca_reposo.png")
    with open(ruta_reposo, "wb") as f:
        f.write(final_reposo)
    bocas["reposo"] = os.path.relpath(ruta_reposo, personaje_dir)

    for visema in VISEMAS_NO_REPOSO:
        editada = reemplazar_boca(client, boca_reposo_bytes, PROMPT_POR_VISEMA[visema], negative_prompt)
        final_bytes = quitar_fondo(client, editada)
        ruta = os.path.join(partes_dir, f"boca_{visema}.png")
        with open(ruta, "wb") as f:
            f.write(final_bytes)
        bocas[visema] = os.path.relpath(ruta, personaje_dir)

    if tiene_prop:
        recorte_bytes = recortar(hoja_img, regiones["prop"])
        final_bytes = quitar_fondo(client, recorte_bytes)
        ruta = os.path.join(partes_dir, "prop.png")
        with open(ruta, "wb") as f:
            f.write(final_bytes)
        rutas["prop"] = os.path.relpath(ruta, personaje_dir)

    pivotes = {}
    if "cabeza_pivot" in regiones:
        pivotes["cabeza"] = regiones["cabeza_pivot"]
    if tiene_prop and "prop_pivot" in regiones:
        pivotes["prop"] = regiones["prop_pivot"]
    if "apendice_pivot" in regiones:
        pivotes["apendice"] = regiones["apendice_pivot"]

    puppet = {
        "personaje_id": personaje_id,
        "partes": {
            "cuerpo": rutas["cuerpo"],
            "cabeza": rutas["cabeza"],
            "ojos_abiertos": rutas["ojos_abiertos"],
            "ojos_cerrados": rutas["ojos_cerrados"],
            "cejas": rutas["cejas"],
            "bocas": bocas,
            **({"prop": rutas["prop"]} if tiene_prop else {}),
        },
        "pivotes": pivotes,
        "modelo_remove_background": MODEL_REMOVE_BG,
        "modelo_search_replace": MODEL_SEARCH_REPLACE,
        "region": STABILITY_REGION,
        "hoja_seed": hoja_meta.get("seed"),
        "style_guide_version": style_guide["version"],
        "generado_en": datetime.now(timezone.utc).isoformat(),
        "aprobado": False,
    }
    puppet_path = os.path.join(personaje_dir, "puppet.json")
    with open(puppet_path, "w", encoding="utf-8") as f:
        json.dump(puppet, f, ensure_ascii=False, indent=2)

    llamadas_reales = contar_llamadas_reales(regiones)
    print("USO_REAL: " + json.dumps([{
        "servicio": "bedrock-stability", "operacion": f"{MODEL_REMOVE_BG}+{MODEL_SEARCH_REPLACE}",
        "cantidad": llamadas_reales, "unidad": "llamadas",
        "costo_estimado_usd": round(llamadas_reales * PRECIO_EDICION_USD, 4),
    }]))

    return puppet_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True, help="id del personaje, p.ej. 'lucia'")
    parser.add_argument("--regiones", required=True, help="JSON con las cajas de recorte sobre la hoja")
    parser.add_argument("--out", required=True, help="carpeta del personaje (misma que --out de generar_hoja.py)")
    parser.add_argument("--dry-run", action="store_true", help="valida y muestra el plan sin llamar a Bedrock")
    args = parser.parse_args()

    resultado = generar_partes(args.id, args.regiones, args.out, dry_run=args.dry_run)
    if resultado:
        print(f"puppet.json generado: {resultado}")
