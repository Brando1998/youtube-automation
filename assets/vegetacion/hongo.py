"""Asset: hongo estilizado detallado (migrado al contrato de assets del proyecto).

crear_hongo(seed, escala, inclinacion, tono) construye un hongo completo
(sombrero con borde curvado, láminas debajo, manchas en relieve, tallo con
anillo y base ensanchada) y lo devuelve en su propia collection, marcada como
asset de Blender con los metadatos del contrato (tipo, seed, version, bbox).

Vista previa + validación:
  blender -b -P hongo.py -- --out hongo.png [--turntable hongo.mp4] [--fast] [--blend hongo.blend]
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))

import bbox as bboxmod
from geo import finish, interp, lathe_bm, to_obj
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
    MATS[tono] = dict(
        cap=ramp_mat(f"sombrero_{tono}", stops(f"hongo_{tono}"), rough=0.42, coat=0.12, sss=0.1,
                     noise_amt=0.12, bump=0.08, bump_scale=18),
        spot=ramp_mat("mancha", stops("hongo_mancha"), rough=0.6, noise_amt=0.3, bump=0.15, bump_scale=40),
        gill=ramp_mat("laminas", stops("hongo_laminas"), coord="Generated", axis="Z", rough=0.8, noise_amt=0.1),
        stem=ramp_mat("tallo", stops("hongo_tallo"), rough=0.7, sss=0.2, noise_amt=0.06, bump=0.12,
                      bump_scale=14, stretch=(1, 1, 0.12)),
    )
    return MATS[tono]


# ---------- el asset ----------
def crear_hongo(nombre="hongo", seed=1, escala=1.0, inclinacion=0.0, tono="rojo", contorno=True, parent_col=None):
    rnd = random.Random(seed)
    M = mats(tono)
    col = bpy.data.collections.new(nombre)
    (parent_col or bpy.context.scene.collection).children.link(col)
    ol = 0.012 if contorno else 0.0

    hs = 1.0 * rnd.uniform(0.9, 1.15)          # altura del tallo
    rs = 0.16 * rnd.uniform(0.9, 1.1)          # radio del tallo
    Rc = 0.62 * rnd.uniform(0.92, 1.08)        # radio del sombrero
    Hc = 0.5 * rnd.uniform(0.85, 1.1)          # altura del sombrero
    bend = inclinacion                         # desplazamiento lateral de la punta del tallo

    def bend_at(z):  # curva suave del tallo
        t = max(0.0, min(1.0, z / hs))
        return bend * t * t

    # Tallo: base ensanchada, ligera panza abajo y afinado arriba
    prof = [(0, 0), (1.35, 0.0), (1.38, 0.03), (1.2, 0.09), (1.04, 0.22), (0.98, 0.42), (0.92, 0.66),
            (0.88, 0.86), (0.86, 1.0), (0, 1.0)]
    bm = lathe_bm([(r * rs, z * hs) for r, z in prof], 48)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        v.co.x += bend_at(v.co.z)
        v.co.xy *= 1 + 0.04 * math.sin(5 * a + seed) * (1 - v.co.z / hs)  # base irregular
    stem = to_obj(nombre + "_tallo", bm, col, M["stem"])
    finish(stem, 2, ol)

    # Anillo (faldita) bajo el sombrero, con borde ondulado
    zr = 0.8 * hs
    ring = [(0.86 * rs, zr + 0.03), (1.15 * rs, zr), (1.5 * rs, zr - 0.06), (1.7 * rs, zr - 0.13), (1.66 * rs, zr - 0.16)]
    bm = lathe_bm(ring, 64)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        r = v.co.xy.length
        k = max(0.0, (r - 1.2 * rs) / (0.5 * rs))
        v.co.z += 0.025 * math.sin(7 * a + seed) * k
        v.co.x += bend_at(zr)
    rg = to_obj(nombre + "_anillo", bm, col, M["stem"])
    sol = rg.modifiers.new("grosor", "SOLIDIFY")
    sol.thickness = 0.012
    finish(rg, 2, 0)

    # Sombrero: domo con borde que se curva hacia adentro
    top = [(0.0, 1.0), (0.3, 0.97), (0.58, 0.87), (0.8, 0.7), (0.94, 0.5), (1.0, 0.34), (0.99, 0.25)]
    under = [(0.94, 0.22), (0.78, 0.25), (0.5, 0.3), (0.2, 0.34), (0.0, 0.35)]
    prof = [(r * Rc, z * Hc) for r, z in top + under]
    bm = lathe_bm(prof, 72)
    cap_z = hs - 0.3 * Hc
    tilt = Matrix.Rotation(math.atan2(bend, hs) * 0.9, 4, "Y")
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        r = v.co.xy.length / Rc
        v.co.xy *= 1 + 0.035 * noise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, seed)))
        v.co.z += 0.02 * Hc * math.sin(5 * a + seed) * r * r
    bvh_src = bm.copy()
    xf = Matrix.Translation((bend_at(hs), 0, cap_z)) @ tilt
    cap = to_obj(nombre + "_sombrero", bm, col, M["cap"])
    cap.matrix_world = xf
    finish(cap, 2, ol)

    # Láminas: aletas radiales finas bajo el sombrero, siguiendo su curva
    und = sorted([(r * Rc, z * Hc) for r, z in under])
    bm = bmesh.new()
    n = 64
    for k in range(n):
        a = k / n * math.tau + rnd.uniform(-0.02, 0.02)
        r0 = (0.17 if k % 2 == 0 else 0.45) * Rc
        r1 = 0.93 * Rc
        ca, sa = math.cos(a), math.sin(a)
        steps = 8
        topv, botv = [], []
        for i in range(steps + 1):
            r = r0 + (r1 - r0) * i / steps
            z = interp(und, r) + 0.004
            depth = 0.09 * Hc * math.sin(math.pi * min(1, (r - r0) / (r1 - r0) * 1.05)) ** 0.7
            topv.append(bm.verts.new((r * ca, r * sa, z)))
            botv.append(bm.verts.new((r * ca, r * sa, z - depth - 0.002)))
        for i in range(steps):
            bm.faces.new((topv[i], topv[i + 1], botv[i + 1], botv[i]))
    gills = to_obj(nombre + "_laminas", bm, col, M["gill"])
    gills.matrix_world = xf
    for p in gills.data.polygons:
        p.use_smooth = True

    # Manchas: gotas planas e irregulares pegadas a la superficie del sombrero
    bvh = BVHTree.FromBMesh(bvh_src)
    bvh_src.free()
    bm = bmesh.new()
    placed = []
    tries = 0
    target = rnd.randint(11, 16)
    while len(placed) < target and tries < 600:
        tries += 1
        a = rnd.uniform(0, math.tau)
        rr = math.sqrt(rnd.uniform(0, 0.78)) * Rc
        hit = bvh.ray_cast(Vector((rr * math.cos(a), rr * math.sin(a), 5)), Vector((0, 0, -1)))
        if hit[0] is None or hit[1].z < 0.35:
            continue
        loc, nor = hit[0], hit[1]
        size = (0.16 - 0.08 * rr / Rc) * Rc * rnd.uniform(0.7, 1.25)
        if any((loc - p).length < (s + size) * 1.05 for p, s in placed):
            continue
        placed.append((loc, size))
        rot = nor.to_track_quat("Z", "Y").to_matrix().to_4x4() @ Matrix.Rotation(rnd.uniform(0, 6), 4, "Z")
        sc = Matrix.Diagonal((size * rnd.uniform(0.85, 1.2), size * rnd.uniform(0.7, 1.0), size * 0.3, 1))
        res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0,
                                          matrix=Matrix.Translation(loc - nor * 0.004) @ rot @ sc)
        for v in res["verts"]:
            v.co += nor * 0.012 * noise.noise(v.co * 25)
    spots = to_obj(nombre + "_manchas", bm, col, M["spot"])
    spots.matrix_world = xf
    finish(spots, 1, 0)

    # Escala
    for o in col.objects:
        o.matrix_world = Matrix.Scale(escala, 4) @ o.matrix_world

    # Marca de asset + metadatos del contrato
    col.asset_mark()
    col["tipo"] = "vegetacion/hongo"
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
    OUT = arg("--out", "/tmp/hongo.png")
    TURNTABLE = arg("--turntable")
    BLEND = arg("--blend")

    bpy.ops.wm.read_factory_settings(use_empty=True)

    col = crear_hongo("hongo", seed=3, escala=1.0, inclinacion=0.06, tono="rojo")

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
