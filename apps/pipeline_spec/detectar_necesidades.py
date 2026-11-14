"""Detecta qué entidades visuales (personajes/objetos/fondos) hace falta un guion
de texto, vía un LLM en Bedrock — paso previo a `generar_episode_spec.py`. NO
decide asset_ref ni genera geometría nueva: solo describe qué hace falta (tipo,
descripción, tags) para que el backend (apps/web/app/pipeline_runner.py) lo
compare contra la biblioteca real (`library/registry.json`) y reporte qué ya
existe y qué falta construir — ver docs/PROJECT_ROADMAP.md ("fábrica de assets").
Mismo motivo que el plan documenta: nada de IA escribiendo SVG/geometría por
escena sin revisión (REGLAS.md), la biblioteca crece a mano, con el mismo rigor
que los personajes existentes.

Mismo patrón de proveedor/validación/reintento que `generar_episode_spec.py`
(duplicado a propósito — ver el comentario de ese archivo sobre por qué los
scripts de apps/pipeline_* no se importan entre sí).

Uso:
  python3 detectar_necesidades.py --guion guion.txt --out necesidades.json \
      [--modelo amazon.nova-lite-v1:0] [--dry-run]
"""
import argparse
import json
import os
import re

REPO_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
SCHEMA_PATH = os.path.join(REPO_ROOT, "episode_spec", "necesidades_schema.json")
BEDROCK_REGION = "us-east-1"
MODEL_ID_DEFAULT = "amazon.nova-lite-v1:0"
ANTHROPIC_VERSION = "bedrock-2023-05-31"

# Duplicado a propósito de apps/web/app/costos.py — ver la nota ahí sobre por qué
# es un placeholder plano por intento, no un precio por token real verificado.
COSTO_PLACEHOLDER_TEXTO_USD = 0.05


def cargar_schema():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def construir_system_prompt(schema):
    return "\n\n".join([
        "Eres un asistente que analiza guiones para un pipeline de animación "
        "automatizado. Tu tarea es listar QUÉ entidades visuales (personajes, "
        "objetos/props, fondos) hacen falta para representar el guion — NO "
        "decidís cómo se ven ni inventás un identificador de biblioteca, solo "
        "describís qué hace falta con tags simples en español. Tu única salida "
        "debe ser un documento JSON que cumpla EXACTAMENTE con el siguiente JSON "
        "Schema (draft-07). No agregues texto antes ni después del JSON, ni uses "
        "bloques de código markdown (```); responde solo con el JSON crudo.",
        "Pensá en términos genéricos y reutilizables: si el guion menciona 'una "
        "persona' sin más detalle, la necesidad es tipo 'personaje' con tags como "
        "['persona', 'generico'] — no inventes un nombre propio. Un fondo o un "
        "objeto que se repite en varias escenas es UNA sola necesidad, no una por "
        "escena.",
        "JSON Schema:",
        json.dumps(schema, ensure_ascii=False),
    ])


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


def detectar_necesidades(guion_texto, model_id, max_tokens, max_reintentos, dry_run=False):
    import jsonschema

    schema = cargar_schema()
    system_prompt = construir_system_prompt(schema)
    user_prompt = f"Guion:\n\n{guion_texto}\n\nListá las necesidades visuales de este guion."

    if dry_run:
        print(f"[dry-run] modelo={model_id}, region={BEDROCK_REGION}, max_tokens={max_tokens}")
        print(f"[dry-run] system prompt: {len(system_prompt)} caracteres (incluye el schema completo)")
        print(f"[dry-run] guion: {len(guion_texto)} caracteres")
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
            resultado_texto = extraer_json(texto)
            resultado = json.loads(resultado_texto)
            jsonschema.validate(resultado, schema)
            print("USO_REAL: " + json.dumps([{
                "servicio": "bedrock-nova" if "nova" in model_id else "bedrock-anthropic",
                "operacion": model_id, "cantidad": tokens_totales, "unidad": "tokens",
                "costo_estimado_usd": round(COSTO_PLACEHOLDER_TEXTO_USD * intento, 4),
            }]))
            return resultado
        except (ValueError, json.JSONDecodeError, jsonschema.ValidationError) as e:
            ultimo_error = e
            messages.append({"role": "assistant", "content": texto})
            messages.append({
                "role": "user",
                "content": (
                    f"Ese JSON no es válido: {e}. Corregilo y devolveme solo el JSON "
                    "arreglado, sin texto adicional ni bloques de código."
                ),
            })

    raise RuntimeError(f"No se obtuvo un resultado válido tras {max_reintentos} intentos: {ultimo_error}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--guion", required=True, help="archivo de texto con el guion")
    parser.add_argument("--out", required=True)
    parser.add_argument("--modelo", default=MODEL_ID_DEFAULT)
    parser.add_argument("--max-tokens", type=int, default=4000)
    parser.add_argument("--max-reintentos", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(args.guion, "r", encoding="utf-8") as f:
        guion_texto = f.read()

    resultado = detectar_necesidades(
        guion_texto, args.modelo, args.max_tokens, args.max_reintentos, dry_run=args.dry_run,
    )
    if resultado is None:
        raise SystemExit(0)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    print(f"necesidades detectadas y validadas: {args.out}")
