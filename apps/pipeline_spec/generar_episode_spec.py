"""Genera episode_spec/<id>.json real a partir de un guion de texto, vía un LLM en
Bedrock (InvokeModel, no la API directa de cada proveedor). Hasta ahora el único spec
que existía (ejemplo_15s.json) estaba escrito a mano; este script es la pieza que lo
generaría de verdad a partir de lo que escriba el usuario.

Soporta dos proveedores (detectado por el prefijo del modelId, ver `invocar_modelo`):
- **Amazon Nova** (`amazon.nova-*`) — proveedor por defecto, decisión explícita de
  costo del usuario: no pasa por AWS Marketplace (a diferencia de Anthropic/Stability,
  que sí y ya nos dieron dolores de cabeza de permisos/facturación — ver
  docs/PROGRESS.md), corre in-region en us-east-1 sin inference profile, y es
  órdenes de magnitud más barato que Claude para esta tarea (convertir texto a JSON
  que cumple un schema no necesita el modelo más caro). Formato de request/response
  (`schemaVersion`, `inferenceConfig`, `output.message.content[0].text`) verificado
  contra la documentación oficial de AWS, no adivinado.
- **Claude** (`anthropic.*` / `us.anthropic.*`) — se mantiene como opción si un guion
  complejo necesita más calidad; formato `anthropic_version: "bedrock-2023-05-31"`
  verificado igual contra la documentación oficial. El id plano "anthropic.claude-
  sonnet-5" no tiene endpoint in-region en us-east-1 (como ya pasaba con Stability en
  generar_partes.py/generar_fondo.py) — hace falta el inference profile
  `us.anthropic.claude-sonnet-5`.

Como Bedrock no da la misma garantía de structured outputs para todos los modelos,
no se apuesta a eso: se le pide al modelo que devuelva SOLO JSON y se valida el
resultado contra episode_spec/schema.json (mismo patrón de validación que ya usa el
proyecto, ver docs/PROGRESS.md Fase A1) — si falla, se reintenta pasándole el error
de vuelta, hasta --max-reintentos veces. Mismo mecanismo para ambos proveedores.

Uso:
  python3 generar_episode_spec.py --guion guion.txt --episodio-id ej1 \
      --out episode_spec/ej1.json --estilo ilustrado --modo-voz mixto \
      [--modelo amazon.nova-lite-v1:0] [--dry-run]
"""
import argparse
import json
import os
import re

REPO_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
SCHEMA_PATH = os.path.join(REPO_ROOT, "episode_spec", "schema.json")
BEDROCK_REGION = "us-east-1"  # tanto amazon.* como anthropic.* viven acá, a diferencia de stability.* (us-west-2)
MODEL_ID_DEFAULT = "amazon.nova-lite-v1:0"  # in-region, sin inference profile — ver docstring
ANTHROPIC_VERSION = "bedrock-2023-05-31"

# Duplicado a propósito de apps/web/app/costos.py (ver nota ahí sobre por qué este
# es un placeholder plano por intento, no un precio por token — no se pudo verificar
# con confianza el precio por token de Nova/Claude en Bedrock en esta sesión).
COSTO_PLACEHOLDER_TEXTO_USD = 0.05

# Catálogo de clips de animación reales (Fase 7, docs/PROJECT_ROADMAP.md) —
# apps/remotion-ilustrado/src/engine/animation/clips/registro.ts es la fuente de
# verdad (TypeScript, no importable desde Python); duplicado a mano aquí a
# propósito, igual que el comentario de arriba sobre COSTO_PLACEHOLDER_TEXTO_USD —
# con solo 3 clips no se justifica un paso de build que genere este catálogo
# (como sí hace scripts/generar_registry.mjs para assets); si la biblioteca crece
# bastante, generar esto desde el mismo registro de TypeScript en vez de
# mantenerlo a mano en 2 lugares.
CLIPS_DISPONIBLES = [
    {"clip_id": "saludar", "categoria": "gesto", "descripcion": "agita un brazo en señal de saludo"},
    {"clip_id": "senalar", "categoria": "gesto", "descripcion": "levanta y extiende un brazo para señalar algo"},
    {"clip_id": "caminar", "categoria": "locomocion", "descripcion": "ciclo de caminata (ambas piernas alternadas)"},
]


def cargar_schema():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def construir_system_prompt(schema, estilo, modo_voz, personajes_catalogo, fondos_catalogo=None):
    partes = [
        "Eres un asistente que convierte guiones en specs de episodio para un "
        "pipeline de animación automatizado. Tu única salida debe ser un documento "
        "JSON que cumpla EXACTAMENTE con el siguiente JSON Schema (draft-07). "
        "No agregues texto antes ni después del JSON, ni uses bloques de código "
        "markdown (```); responde solo con el JSON crudo.",
        f"estilo del episodio: \"{estilo}\" (todas las tomas deben traer el bloque "
        f"render.{'3d' if estilo == '3d' else 'ilustrado'} correspondiente).",
        f"modo_voz del episodio: \"{modo_voz}\".",
        "JSON Schema:",
        json.dumps(schema, ensure_ascii=False),
    ]
    if personajes_catalogo:
        partes.append(
            "Catálogo de personajes ya existentes (usa estos ids/asset_ref tal cual, "
            "no inventes otros para los mismos personajes): "
            + json.dumps(personajes_catalogo, ensure_ascii=False)
        )
    if fondos_catalogo:
        partes.append(
            "Catálogo de fondos ya existentes (usa estos asset_ref tal cual en "
            "escenas[].fondo — no inventes otros, un fondo inexistente rompe el "
            "render más adelante): "
            + json.dumps(fondos_catalogo, ensure_ascii=False)
        )
    if estilo == "ilustrado":
        partes.append(
            "Clips de animación REALES disponibles para el campo "
            "render.ilustrado.personajes_en_escena[].gesto.clip_id (un clip_id que "
            "no esté en esta lista se ignora en el render — el personaje queda en "
            "reposo, no es un error, pero tampoco logra el efecto pedido; preferí "
            "usar solo los de esta lista). Solo tiene efecto en personajes con rig "
            "de huesos reales (hoy: humanos bípedos como 'lucia'): "
            + json.dumps(CLIPS_DISPONIBLES, ensure_ascii=False)
        )
    return "\n\n".join(partes)


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


def generar_episode_spec(guion_texto, episodio_id, estilo, modo_voz, personajes_catalogo,
                          model_id, max_tokens, max_reintentos, dry_run=False, fondos_catalogo=None):
    import jsonschema

    schema = cargar_schema()
    system_prompt = construir_system_prompt(schema, estilo, modo_voz, personajes_catalogo, fondos_catalogo)
    user_prompt = (
        f"Guion (id de episodio: {episodio_id}):\n\n{guion_texto}\n\n"
        "Convertí este guion en el episode_spec JSON correspondiente."
    )

    if dry_run:
        print(f"[dry-run] episodio_id={episodio_id}, estilo={estilo}, modo_voz={modo_voz}")
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
            spec_texto = extraer_json(texto)
            spec = json.loads(spec_texto)
            jsonschema.validate(spec, schema)
            print("USO_REAL: " + json.dumps([{
                "servicio": "bedrock-nova" if "nova" in model_id else "bedrock-anthropic",
                "operacion": model_id, "cantidad": tokens_totales, "unidad": "tokens",
                "costo_estimado_usd": round(COSTO_PLACEHOLDER_TEXTO_USD * intento, 4),
            }]))
            return spec
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

    raise RuntimeError(f"No se obtuvo un spec válido tras {max_reintentos} intentos: {ultimo_error}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--guion", required=True, help="archivo de texto con el guion")
    parser.add_argument("--episodio-id", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--estilo", required=True, choices=["ilustrado", "3d"])
    parser.add_argument("--modo-voz", required=True, choices=["narrador", "dialogos", "mixto"])
    parser.add_argument("--personajes", default=None, help="JSON con el catálogo de personajes existentes (opcional)")
    parser.add_argument("--fondos", default=None, help="JSON con el catálogo de fondos existentes (opcional)")
    parser.add_argument("--modelo", default=MODEL_ID_DEFAULT)
    parser.add_argument("--max-tokens", type=int, default=8000)
    parser.add_argument("--max-reintentos", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(args.guion, "r", encoding="utf-8") as f:
        guion_texto = f.read()

    personajes_catalogo = None
    if args.personajes:
        with open(args.personajes, "r", encoding="utf-8") as f:
            personajes_catalogo = json.load(f)

    fondos_catalogo = None
    if args.fondos:
        with open(args.fondos, "r", encoding="utf-8") as f:
            fondos_catalogo = json.load(f)

    spec = generar_episode_spec(
        guion_texto, args.episodio_id, args.estilo, args.modo_voz, personajes_catalogo,
        args.modelo, args.max_tokens, args.max_reintentos, dry_run=args.dry_run,
        fondos_catalogo=fondos_catalogo,
    )
    if spec is None:
        raise SystemExit(0)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)
    print(f"episode_spec generado y validado: {args.out}")
