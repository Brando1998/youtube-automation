"""Asset: árbol estilizado.

crear_arbol(seed, escala, inclinacion, tono) construye un árbol con tronco
ahusado de base ensanchada (regla 5: apoyado y no flotando) y una copa
fundida en una sola superficie (metaballs, regla 1 — nubes de hojas
"pegadas" sin costuras entre esferas sueltas).

Vista previa + validación:
  blender -b -P arbol.py -- --out arbol.png [--turntable arbol.mp4] [--fast] [--blend arbol.blend]
"""
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))

import bbox as bboxmod
from geo import finish, lathe_bm, metaball_obj, to_obj
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
        copa=ramp_mat("copa_" + tono, stops(copa_key), coord="Object", axis="Z", rough=0.75,
                      noise_amt=0.18, noise_scale=4.5, bump=0.1, bump_scale=35),
        tronco=ramp_mat("tronco_" + tono, stops("arbol_tronco"), rough=0.85, noise_amt=0.1,
                        bump=0.12, bump_scale=20, stretch=(1, 1, 0.1)),
    )
    return MATS[tono]


# ---------- el asset ----------
def crear_arbol(nombre="arbol", seed=1, escala=1.0, inclinacion=0.0, tono="verde", contorno=True, parent_col=None):
    rnd = random.Random(seed)
    M = mats(tono)
    col = bpy.data.collections.new(nombre)
    (parent_col or bpy.context.scene.collection).children.link(col)
    ol = 0.02 if contorno else 0.0

    ht = 2.3 * rnd.uniform(0.85, 1.2)   # altura del tronco hasta la copa
    rt = 0.11 * rnd.uniform(0.85, 1.15)  # radio del tronco
    bend = inclinacion

    def bend_at(z):
        t = max(0.0, min(1.0, z / ht))
        return bend * t * t

    # Tronco: base ensanchada (raíz) que se hunde ligeramente y se afina hacia arriba
    prof = [(0, -0.03), (1.55, -0.02), (1.5, 0.05), (1.15, 0.18), (1.0, 0.4), (0.9, 0.7),
            (0.82, 1.0), (0.74, 1.0)]
    bm = lathe_bm([(r * rt, z * ht) for r, z in prof], 36)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        v.co.x += bend_at(v.co.z)
        v.co.xy *= 1 + 0.05 * math.sin(4 * a + seed) * (1 - v.co.z / ht)
    trunk = to_obj(nombre + "_tronco", bm, col, M["tronco"])
    finish(trunk, 2, ol)

    # Copa: nube de bolas metaball fundidas en una sola superficie, centrada un poco
    # DENTRO de la punta del tronco (no encima) para garantizar que se fundan entre sí
    # y no quede un hueco — antes el offset en Z era siempre positivo y la copa flotaba
    # por encima del tronco sin tocarlo.
    top = Vector((bend_at(ht), 0, ht))
    n_lobes = rnd.randint(9, 14)
    canopy_r = 0.85 * rnd.uniform(0.88, 1.15)
    centro = top - Vector((0, 0, canopy_r * 0.12))
    elems = []
    for i in range(n_lobes):
        # distribución dentro de una elipsoide achatada (copa más ancha que alta),
        # con sesgo leve hacia arriba pero permitiendo lóbulos bajos que envuelven el tronco
        u, v_, w = rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.75, 0.85)
        d = (u * u + v_ * v_ + w * w) ** 0.5 or 1.0
        f = rnd.uniform(0.35, 0.95)
        p = centro + Vector((u / d * f, v_ / d * f, w / d * f * 0.75)) * canopy_r
        r = canopy_r * rnd.uniform(0.4, 0.58)
        elems.append(("BALL", p, r, None))
    canopy = metaball_obj(col, nombre + "_copa", elems, M["copa"], ol=ol)

    # Escala
    for o in col.objects:
        o.matrix_world = Matrix.Scale(escala, 4) @ o.matrix_world

    # Marca de asset + metadatos del contrato
    col.asset_mark()
    col["tipo"] = "vegetacion/arbol"
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
    OUT = arg("--out", "/tmp/arbol.png")
    TURNTABLE = arg("--turntable")
    BLEND = arg("--blend")

    bpy.ops.wm.read_factory_settings(use_empty=True)

    col = crear_arbol("arbol", seed=5, escala=1.0, inclinacion=0.12, tono="verde")

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
