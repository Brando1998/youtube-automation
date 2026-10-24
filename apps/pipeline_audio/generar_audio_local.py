"""Fase A6 (camino "audio grabado"): a partir de un archivo de audio YA GRABADO (no
TTS), produce el bloque `audio` del episode spec (episode_spec/schema.json) —
palabras con tiempos (Whisper) + visemas con tiempos (Rhubarb Lip Sync), ambos
convertidos a número de frame. 100% local, no toca AWS.

El otro camino (TTS vía Polly, Fase A6 "narrador"/voces sintéticas) sigue bloqueado
por AWS Marketplace — este script no lo reemplaza, es la otra mitad ya planeada
("Audio grabado: Whisper...Rhubarb Lip Sync", docs/PLAN.md).

Uso:
  python3 generar_audio_local.py --audio linea.wav --texto "..." --linea-id l2 \
      --out linea.audio.json [--fps 30] [--modelo-whisper small] [--idioma es]
"""
import argparse
import json
import math
import os
import subprocess
import tempfile

_TOOLS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools")
RHUBARB_BIN = os.path.join(_TOOLS, "rhubarb", "rhubarb")

# Whisper llama a `ffmpeg` por nombre en PATH; usamos el ffmpeg local del proyecto
# (tools/ffmpeg) en vez de depender de que esté instalado a nivel de sistema.
os.environ["PATH"] = os.path.join(_TOOLS, "ffmpeg") + os.pathsep + os.environ.get("PATH", "")

# Mapeo Rhubarb (A-H, X) -> VisemaCode del proyecto (CharacterPuppet.tsx), basado en
# los fonemas que representa cada forma según la documentación oficial de Rhubarb:
#   A = P/B/M (cerrada)              -> MBP
#   B = K/S/T/EE (entreabierta)      -> E   (la EE cae mejor en nuestra "E" que en MBP)
#   C = EH/AE (abierta)              -> E
#   D = AA (bien abierta)            -> A
#   E = AO/ER (redondeada)           -> O
#   F = UW/OW/W (fruncida)           -> O   (no tenemos una "U" separada, se pliega a O)
#   G = F/V (dientes en labio)       -> FV
#   H = L (lengua arriba)            -> L
#   X = silencio/reposo              -> reposo
RHUBARB_A_VISEMA = {
    "A": "MBP",
    "B": "E",
    "C": "E",
    "D": "A",
    "E": "O",
    "F": "O",
    "G": "FV",
    "H": "L",
    "X": "reposo",
}


def frame(segundos, fps):
    return round(segundos * fps)


def transcribir_whisper(audio_path, modelo, idioma, fps):
    import whisper

    model = whisper.load_model(modelo)
    resultado = model.transcribe(audio_path, word_timestamps=True, language=idioma, fp16=False)

    palabras = []
    for seg in resultado["segments"]:
        for w in seg.get("words", []):
            palabras.append({
                "texto": w["word"].strip(),
                "inicio_frame": frame(w["start"], fps),
                "fin_frame": frame(w["end"], fps),
            })
    return palabras, resultado["text"].strip()


def generar_visemas_rhubarb(audio_path, dialog_text, fps):
    with tempfile.TemporaryDirectory() as tmp:
        # Rhubarb solo acepta .wav/.ogg — convertimos siempre, así el script acepta
        # cualquier formato de entrada (mp3, m4a, ...) sin pedirle el formato al usuario.
        wav_path = os.path.join(tmp, "audio.wav")
        subprocess.run(
            [os.path.join(_TOOLS, "ffmpeg", "ffmpeg"), "-y", "-i", audio_path, "-ar", "44100", "-ac", "1", wav_path],
            check=True, capture_output=True,
        )

        out_json = os.path.join(tmp, "rhubarb_out.json")
        cmd = [RHUBARB_BIN, "-f", "json", "-o", out_json]
        dialog_file = None
        if dialog_text:
            dialog_file = os.path.join(tmp, "dialog.txt")
            with open(dialog_file, "w", encoding="utf-8") as f:
                f.write(dialog_text)
            cmd += ["--dialogFile", dialog_file]
        cmd.append(wav_path)
        try:
            subprocess.run(cmd, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Rhubarb falló: {e.stderr.decode('utf-8', errors='replace')}") from e

        with open(out_json, "r", encoding="utf-8") as f:
            data = json.load(f)

    visemas = []
    for cue in data["mouthCues"]:
        tipo = RHUBARB_A_VISEMA.get(cue["value"], "reposo")
        visemas.append({
            "tipo": tipo,
            "inicio_frame": frame(cue["start"], fps),
            "fin_frame": frame(cue["end"], fps),
        })
    return visemas


def generar_audio_linea(audio_path, texto, fps, modelo_whisper, idioma):
    palabras, transcripcion = transcribir_whisper(audio_path, modelo_whisper, idioma, fps)
    visemas = generar_visemas_rhubarb(audio_path, texto, fps)
    return {
        "fuente": "grabado",
        "archivo": os.path.abspath(audio_path),
        "palabras": palabras,
        "visemas": visemas,
        "_transcripcion_whisper": transcripcion,  # para comparar contra el texto del spec, no es parte del schema
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True, help="archivo de audio grabado (wav/mp3/...)")
    parser.add_argument("--texto", default=None, help="texto de la línea (mejora la precisión de Rhubarb)")
    parser.add_argument("--linea-id", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--modelo-whisper", default="small", help="tiny/base/small/medium/large")
    parser.add_argument("--idioma", default="es")
    args = parser.parse_args()

    resultado = generar_audio_linea(args.audio, args.texto, args.fps, args.modelo_whisper, args.idioma)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({args.linea_id: {"palabras": resultado["palabras"], "visemas": resultado["visemas"]}}, f,
                   ensure_ascii=False, indent=2)

    print(f"Transcripción Whisper: {resultado['_transcripcion_whisper']!r}")
    print(f"Palabras: {len(resultado['palabras'])}, visemas: {len(resultado['visemas'])}")
    print(f"Guardado: {args.out}")
