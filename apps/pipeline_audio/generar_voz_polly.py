"""Fase A6 (camino "narrador"/voces sintéticas): genera audio real (mp3) + el bloque
`audio` del episode spec (palabras y visemas con tiempos, convertidos a frame) para una
línea de diálogo, vía Amazon Polly — camino paralelo a
apps/pipeline_audio/generar_audio_local.py (que parte de audio YA GRABADO con
Whisper+Rhubarb). Mismo formato de salida en ambos, para que el renderer
(EpisodeRenderer.tsx) no necesite saber cuál de los dos se usó.

Dos llamadas a Polly por línea (la API no devuelve audio + marcas en una sola
llamada):
  1. SpeechMarkTypes=["word","viseme"], OutputFormat="json" -> tiempos.
  2. OutputFormat="mp3" -> el audio real (a diferencia del camino Whisper/Rhubarb, acá
     no queda pendiente agregar el audio al render — Polly ya lo da).

Mapeo de visemas de Polly (p/t/S/T/f/k/i/l/r/s/u/@/a/e/E/o/O/sil — confirmado contra
la tabla oficial de fonemas/visemas de Polly para en-US, no adivinado) a nuestros 7
VisemaCode (reposo/A/E/O/MBP/FV/L, los mismos que ya usa el camino Rhubarb) por
similitud articulatoria — ver PROMPT_POR_VISEMA en generar_partes.py para el mismo
criterio aplicado del lado de la generación de bocas.

Uso:
  python3 generar_voz_polly.py --texto "¡Ahí hay una! ¡Ven a jugar!" --linea-id l2 \
      --out l2.audio.json --audio-out l2.mp3 [--voz Lucia --engine neural --fps 30] [--dry-run]
"""
import argparse
import json
import os

# A diferencia de Stability (solo us-west-2), Polly corre en la misma región que la
# instancia (us-east-1) — no hace falta cruzar de región como en pipeline_2d.
POLLY_REGION_DEFAULT = "us-east-1"

# Polly siempre termina las marcas de visema con un "sil" final que marca el silencio de
# cola — se mapea a "reposo" igual que cualquier silencio intermedio.
POLLY_VISEMA_A_CODIGO = {
    "sil": "reposo",
    "p": "MBP",    # b/m/p — labios cerrados, igual criterio que Rhubarb "A"
    "f": "FV",     # f/v — dientes sobre labio, igual que Rhubarb "G"
    "l": "L",      # l — lengua visible, igual que Rhubarb "H"
    "T": "L",      # ð/θ ("th") — lengua entre dientes, visualmente cerca de "L"
    "t": "E",      # d/n/t — alveolar, boca entreabierta (igual que Rhubarb B incluye T)
    "k": "E",      # g/h/k/ŋ — velar, boca entreabierta (igual que Rhubarb B incluye K)
    "s": "E",      # s/z — fricativa estrecha, sonrisa leve
    "i": "E",      # j, vocales cerradas frontales (ɪ) — sonrisa leve/estrecha
    "@": "E",      # ə/ɚ (schwa) — vocal neutra, boca entreabierta
    "e": "E",      # eɪ ("face") — vocal media
    "E": "E",      # ɛ/ɝ/ʌ ("dress"/"nurse"/"strut") — vocal media abierta
    "a": "A",      # æ/aɪ/aʊ/ɑ ("trap"/"price"/"mouth"/"father") — boca bien abierta
    "S": "O",      # dʒ/ʃ/ʒ/tʃ ("sh"/"ch"/"j") — labios ligeramente redondeados/proyectados
    "r": "O",      # ɹ ("red") — redondeo leve de labios en inglés/español
    "u": "O",      # w, u/ʊ ("goose"/"foot") — labios redondeados
    "o": "O",      # oʊ ("goat") — vocal redondeada
    "O": "O",      # ɔ/ɔɪ ("thought"/"choice") — vocal redondeada-abierta
}

PAD_FRAMES_FINAL = 5  # frames de cola para la última palabra/visema (no hay marca siguiente de la que inferir el fin)

# Duplicado a propósito de apps/web/app/costos.py (ver nota ahí) — USD por carácter,
# confirmado en https://aws.amazon.com/polly/pricing/.
PRECIO_POR_CARACTER = {
    "standard": 4.00 / 1_000_000,
    "neural": 16.00 / 1_000_000,
    "long-form": 100.00 / 1_000_000,
    "generative": 30.00 / 1_000_000,
}


def frame(ms, fps):
    return round((ms / 1000.0) * fps)


def leer_marcas(audio_stream_bytes):
    marcas = []
    for linea in audio_stream_bytes.decode("utf-8").splitlines():
        linea = linea.strip()
        if linea:
            marcas.append(json.loads(linea))
    return marcas


def construir_palabras(marcas, fps):
    palabras_marcas = [m for m in marcas if m["type"] == "word"]
    palabras = []
    for i, m in enumerate(palabras_marcas):
        inicio = frame(m["time"], fps)
        if i + 1 < len(palabras_marcas):
            fin = frame(palabras_marcas[i + 1]["time"], fps)
        else:
            fin = inicio + PAD_FRAMES_FINAL
        palabras.append({"texto": m["value"], "inicio_frame": inicio, "fin_frame": fin})
    return palabras


def construir_visemas(marcas, fps):
    visema_marcas = [m for m in marcas if m["type"] == "viseme"]
    visemas = []
    for i, m in enumerate(visema_marcas):
        codigo = POLLY_VISEMA_A_CODIGO.get(m["value"], "reposo")
        inicio = frame(m["time"], fps)
        if i + 1 < len(visema_marcas):
            fin = frame(visema_marcas[i + 1]["time"], fps)
        else:
            fin = inicio + PAD_FRAMES_FINAL
        if fin <= inicio:
            fin = inicio + 1
        visemas.append({"tipo": codigo, "inicio_frame": inicio, "fin_frame": fin})
    return visemas


def generar_voz(texto, linea_id, fps, voz, engine, idioma, region, audio_out=None, dry_run=False):
    if not texto.strip():
        raise ValueError("--texto no puede estar vacío")

    if dry_run:
        print(f"[dry-run] línea '{linea_id}': {len(texto)} caracteres, voz={voz}, engine={engine}, idioma={idioma}, region={region}")
        print("[dry-run] llamada 1: synthesize_speech(OutputFormat='json', SpeechMarkTypes=['word','viseme'])")
        print("[dry-run] llamada 2: synthesize_speech(OutputFormat='mp3')")
        print("[dry-run] 2 llamadas a Polly se harían (0 ejecutadas). Ninguna conexión de red fue realizada.")
        return None, None

    import boto3
    client = boto3.client("polly", region_name=region)

    resp_marcas = client.synthesize_speech(
        Text=texto,
        OutputFormat="json",
        SpeechMarkTypes=["word", "viseme"],
        VoiceId=voz,
        Engine=engine,
        LanguageCode=idioma,
    )
    marcas = leer_marcas(resp_marcas["AudioStream"].read())

    resp_audio = client.synthesize_speech(
        Text=texto,
        OutputFormat="mp3",
        VoiceId=voz,
        Engine=engine,
        LanguageCode=idioma,
    )
    audio_bytes = resp_audio["AudioStream"].read()

    palabras = construir_palabras(marcas, fps)
    visemas = construir_visemas(marcas, fps)
    return {linea_id: {
        "fuente": "polly",
        "archivo": os.path.abspath(audio_out),
        "palabras": palabras,
        "visemas": visemas,
    }}, audio_bytes


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--texto", required=True)
    parser.add_argument("--linea-id", required=True)
    parser.add_argument("--out", required=True, help="dónde guardar el JSON de palabras/visemas")
    parser.add_argument("--audio-out", default=None, help="dónde guardar el mp3 (opcional en --dry-run)")
    parser.add_argument("--voz", default="Lucia", help="VoiceId de Polly, p.ej. Lucia (es-ES), Mia (es-MX), Lupe (es-US)")
    parser.add_argument("--engine", default="neural", choices=["standard", "neural", "generative"])
    parser.add_argument("--idioma", default="es-ES")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--region", default=POLLY_REGION_DEFAULT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.dry_run and not args.audio_out:
        parser.error("--audio-out es requerido salvo en --dry-run")

    resultado, audio_bytes = generar_voz(
        args.texto, args.linea_id, args.fps, args.voz, args.engine, args.idioma, args.region,
        audio_out=args.audio_out, dry_run=args.dry_run
    )
    if resultado is None:
        raise SystemExit(0)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    with open(args.audio_out, "wb") as f:
        f.write(audio_bytes)

    linea = resultado[args.linea_id]
    print(f"Palabras: {len(linea['palabras'])}, visemas: {len(linea['visemas'])}")
    print(f"Guardado: {args.out}")
    print(f"Audio: {args.audio_out} ({len(audio_bytes)} bytes)")

    precio = PRECIO_POR_CARACTER.get(args.engine, PRECIO_POR_CARACTER["neural"])
    # 2 llamadas a Polly (marcas + mp3), ambas sintetizan el texto completo.
    caracteres = len(args.texto) * 2
    print("USO_REAL: " + json.dumps([{
        "servicio": "polly", "operacion": f"{args.engine}/{args.voz}",
        "cantidad": caracteres, "unidad": "caracteres", "costo_estimado_usd": round(caracteres * precio, 4),
    }]))
