"""Genera un ícono SVG simple con IA para un objeto que no tiene equivalente ni
en la biblioteca de código ni en ninguna familia paramétrica (Fase D,
docs/PROJECT_ROADMAP.md — "crear y revisar objetos desde la app", opción 2:
solo cuando la opción 1, familias, no alcanza). Alcance explícito: solo
OBJETOS simples sin rig (ver nota en PROJECT_ROADMAP.md sobre por qué
personajes articulados generados por IA quedan fuera de esta fase).

El SVG que devuelve el modelo se sanea (apps/web/app/svg_seguro.py, lista
blanca de tags/atributos — ver ese módulo) antes de guardarse, y de todas
formas necesita aprobación humana antes de usarse en un episodio real (mismo
criterio de revisión que cualquier otro asset de la biblioteca).

Mismo patrón de proveedor/validación/reintento que generar_episode_spec.py/
detectar_necesidades.py (duplicado a propósito, ver la nota en esos archivos
sobre por qué los scripts de apps/pipeline_* no se importan entre sí).

Uso:
  python3 generar_objeto_ia.py --descripcion "un corazón latiendo" \
      --tags corazon,salud --out objeto.json [--modelo amazon.nova-lite-v1:0] [--dry-run]
"""
import argparse
import json
import os
import re

from svg_seguro import SvgInvalido, sanear_svg

REPO_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
BEDROCK_REGION = "us-east-1"
MODEL_ID_DEFAULT = "amazon.nova-lite-v1:0"
ANTHROPIC_VERSION = "bedrock-2023-05-31"

COSTO_PLACEHOLDER_TEXTO_USD = 0.05  # ver la misma nota en detectar_necesidades.py

TAGS_SVG_PERMITIDOS = "svg, g, path, circle, ellipse, rect, line, polygon, polyline"
ATRIBUTOS_SVG_PERMITIDOS = "d, cx, cy, r, rx, ry, x, y, x1, y1, x2, y2, width, height, points, fill, stroke, stroke-width, viewBox"


def construir_system_prompt():
    return (
        "Eres un asistente que dibuja íconos SVG simples para un video "
        "explicativo infantil. Tu única salida debe ser un documento JSON con "
        "la forma exacta {\"svg\": \"<svg ...>...</svg>\"} — no agregues texto "
        "antes ni después, ni bloques de código markdown.\n\n"
        f"El SVG debe usar viewBox=\"-30 -30 60 60\" (el dibujo centrado en el "
        f"origen, dentro de ese cuadro de 60x60), y solo estos elementos: "
        f"{TAGS_SVG_PERMITIDOS}. Solo estos atributos: {ATRIBUTOS_SVG_PERMITIDOS}. "
        "Nada de <script>, <image>, <foreignObject>, ni atributos que empiecen "
        "con 'on'. Contorno color #05070A. Forma simple, reconocible, sin "
        "detalle sintético de más — pensado para niños, nunca inquietante."
    )


def extraer_json(texto):
    texto = texto.strip()
    if texto.startswith("```"):
        texto = re.sub(r"^```(?:json)?\s*", "", texto)
        texto = re.sub(r"\s*```$", "", texto)
    inicio = texto.find("{")
    fin = texto.rfind("}")
    if inicio == -1 or fin == -1:
        raise ValueError("La respuesta no contiene un objeto JSON reconocible")
    return texto[inicio:fin + 1]


def _invocar_claude(client, model_id, system_prompt, messages, max_tokens):
    body = json.dumps({
        "anthropic_version": ANTHROPIC_VERSION,
        "system": system_prompt,
        "messages": messages,
        "max_tokens": max_tokens,
    })
    resp = client.invoke_model(modelId=model_id, body=body)
    out = json.loads(resp["body"].read())
    uso = out.get("usage", {})
    tokens = uso.get("input_tokens", 0) + uso.get("output_tokens", 0)
    return out["content"][0]["text"], tokens


def _invocar_nova(client, model_id, system_prompt, messages, max_tokens):
    nova_messages = [{"role": m["role"], "content": [{"text": m["content"]}]} for m in messages]
    body = json.dumps({
        "schemaVersion": "messages-v1",
        "system": [{"text": system_prompt}],
        "messages": nova_messages,
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0},
    })
    resp = client.invoke_model(modelId=model_id, body=body)
    out = json.loads(resp["body"].read())
    tokens = out.get("usage", {}).get("totalTokens", 0)
    return out["output"]["message"]["content"][0]["text"], tokens


def invocar_modelo(client, model_id, system_prompt, messages, max_tokens):
    if "nova" in model_id:
        return _invocar_nova(client, model_id, system_prompt, messages, max_tokens)
    return _invocar_claude(client, model_id, system_prompt, messages, max_tokens)


def generar_objeto_ia(descripcion, tags, model_id, max_tokens, max_reintentos, dry_run=False):
    system_prompt = construir_system_prompt()
    user_prompt = f"Descripción: {descripcion}\nTags: {', '.join(tags)}\n\nDibujá este ícono."

    if dry_run:
        print(f"[dry-run] descripcion={descripcion!r}, tags={tags}")
        print(f"[dry-run] modelo={model_id}, region={BEDROCK_REGION}, max_tokens={max_tokens}")
        print(f"[dry-run] system prompt: {len(system_prompt)} caracteres")
        print("[dry-run] 1 llamada a Bedrock se haría (0 ejecutadas). Ninguna conexión de red fue realizada.")
        return None

    import boto3
    client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

    messages = [{"role": "user", "content": user_prompt}]
    ultimo_error = None
    tokens_totales = 0
    for intento in range(1, max_reintentos + 1):
        texto, tokens = invocar_modelo(client, model_id, system_prompt, messages, max_tokens)
        tokens_totales += tokens
        try:
            respuesta = json.loads(extraer_json(texto))
            svg_crudo = respuesta.get("svg")
            if not isinstance(svg_crudo, str):
                raise ValueError("falta el campo 'svg' (string) en la respuesta")
            svg_saneado = sanear_svg(svg_crudo)
            print("USO_REAL: " + json.dumps([{
                "servicio": "bedrock-nova" if "nova" in model_id else "bedrock-anthropic",
                "operacion": model_id, "cantidad": tokens_totales, "unidad": "tokens",
                "costo_estimado_usd": round(COSTO_PLACEHOLDER_TEXTO_USD * intento, 4),
            }]))
            return {"svg": svg_saneado, "descripcion": descripcion, "tags": tags}
        except (ValueError, json.JSONDecodeError, SvgInvalido) as e:
            ultimo_error = e
            messages.append({"role": "assistant", "content": texto})
            messages.append({
                "role": "user",
                "content": f"Eso no sirvió: {e}. Corregilo y devolveme solo el JSON {{\"svg\": \"...\"}} arreglado.",
            })

    raise RuntimeError(f"No se obtuvo un SVG válido tras {max_reintentos} intentos: {ultimo_error}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--descripcion", required=True)
    parser.add_argument("--tags", required=True, help="separados por coma, p.ej. corazon,salud")
    parser.add_argument("--out", required=True)
    parser.add_argument("--modelo", default=MODEL_ID_DEFAULT)
    parser.add_argument("--max-tokens", type=int, default=2000)
    parser.add_argument("--max-reintentos", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    resultado = generar_objeto_ia(
        args.descripcion, tags, args.modelo, args.max_tokens, args.max_reintentos, dry_run=args.dry_run,
    )
    if resultado is None:
        raise SystemExit(0)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    print(f"objeto generado y saneado: {args.out}")
