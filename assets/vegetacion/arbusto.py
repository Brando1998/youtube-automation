"""Asset: arbusto estilizado.

crear_arbusto(seed, escala, tono) construye una masa de hojas fundida (metaballs,
regla 1) baja y ancha, apoyada directo en el suelo — sin tronco, a diferencia del
árbol. El centro de la nube se hunde un poco bajo Z=0 (regla 5) para que las hojas
de abajo queden claramente ancladas al piso y no "flotando sobre un punto".

Vista previa + validación:
  blender -b -P arbusto.py -- --out arbusto.png [--turntable arbusto.mp4] [--fast] [--blend arbusto.blend]
"""
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))

import bbox as bboxmod
from geo import metaball_obj
from materials import ramp_mat
from palette import stops
from validate import validate_asset

VERSION = 1


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


# ---------- materiales compartidos (desde la paleta del proyecto) ----------
MATS = {}


def mats(tono):
    if tono in MATS:
        return MATS[tono]
    copa_key = "arbol_copa_otono" if tono == "otono" else "arbol_copa_verde"
    MATS[tono] = dict(
        hoja=ramp_mat("arbusto_hoja_" + tono, stops(copa_key), coord="Object", axis="Z", rough=0.78,
                      noise_amt=0.22, noise_scale=5.5, bump=0.12, bump_scale=45),
    )
    return MATS[tono]


# ---------- el asset ----------
def crear_arbusto(nombre="arbusto", seed=1, escala=1.0, tono="verde", contorno=True, parent_col=None):
    rnd = random.Random(seed)
    M = mats(tono)
    col = bpy.data.collections.new(nombre)
    (parent_col or bpy.context.scene.collection).children.link(col)
    ol = 0.012 if contorno else 0.0

    # Masa de hojas: nube de bolas metaball baja y ancha, centrada apenas bajo el
    # suelo para que las hojas inferiores queden ancladas (regla 5), no apoyadas
    # sobre un solo punto de contacto.
    radio = 0.65 * rnd.uniform(0.85, 1.2)
    altura = radio * rnd.uniform(0.5, 0.65)  # notablemente más ancho que alto
    n_lobes = rnd.randint(8, 12)
    elems = []
    for i in range(n_lobes):
        # distribución tipo domo: solo hacia arriba y hacia los lados, nunca muy
        # abajo — el centro de cada bola queda cerca de su propio radio sobre el
        # suelo, así el fondo de la masa se apoya sin hundirse de más
        # f (qué tan lejos del centro) se mantiene moderado a propósito: lóbulos
        # empujados muy hacia afuera quedan unidos por un "cuello" delgado al resto,
        # y ahí el contorno se auto-intersecta (costura oscura) sin importar su grosor
        u, v_ = rnd.uniform(-1, 1), rnd.uniform(-1, 1)
        w = rnd.uniform(0.0, 1.0)
        d = (u * u + v_ * v_) ** 0.5 or 1.0
        f = rnd.uniform(0.2, 0.62)
        r = radio * rnd.uniform(0.48, 0.65)
        cz = r * rnd.uniform(0.75, 1.0) + w * altura * 0.55
        p = Vector((u / d * f * radio, v_ / d * f * radio, cz))
        elems.append(("BALL", p, r, None))
    masa = metaball_obj(col, nombre + "_masa", elems, M["hoja"], ol=ol)

    # Escala
    for o in col.objects:
        o.matrix_world = Matrix.Scale(escala, 4) @ o.matrix_world

    # Marca de asset + metadatos del contrato
    col.asset_mark()
    col["tipo"] = "vegetacion/arbusto"
    col["seed"] = seed
    col["tono"] = tono
    col["version"] = VERSION
    dims = bboxmod.size(col)
    col["bbox"] = tuple(round(x, 4) for x in dims) if dims else (0, 0, 0)
    return col


def mover(col, loc, rot_z=0.0):
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, "Z")
    for o in col.objects:
        o.matrix_world = m @ o.matrix_world


# ---------- vista previa + validación ----------
if __name__ == "__main__":
    from preview import render_preview

    FAST = "--fast" in sys.argv
    OUT = arg("--out", "/tmp/arbusto.png")
    TURNTABLE = arg("--turntable")
    BLEND = arg("--blend")

    bpy.ops.wm.read_factory_settings(use_empty=True)

    col = crear_arbusto("arbusto", seed=7, escala=1.0, tono="verde")

    problems = validate_asset(col)
    if problems:
        print("VALIDACION: problemas encontrados:")
        for p in problems:
            print(" -", p)
    else:
        print("VALIDACION: OK —", dict(col.items()))

    if BLEND:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)

    render_preview(col, OUT, out_turntable=TURNTABLE, fast=FAST)
