"""Assets del zorrito: personaje base y accesorios por separado.

crear_zorrito()  -> personaje en pose A, sin accesorios, con anclas "ancla_cuello" y "ancla_espalda"
crear_bufanda()  -> bufanda tejida con nudo y flecos (origen = centro del cuello)
crear_mochila()  -> mochila con bolsillos, solapa, manta enrollada y correas (origen = centro de la espalda)
vestir(raiz_accesorio, ancla) -> coloca un accesorio en el ancla del personaje

Vista previa:
  python3 zorrito.py --modo hoja    --out hoja.png     (personaje + accesorios separados)
  python3 zorrito.py --modo vestido --out vestido.png  (personaje con accesorios puestos)
  [--fast] [--blend zorrito.blend]
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hongo import lin, principled, ramp_mat, finish, lathe_bm, to_obj, arg

# ---------- utilidades de construcción ----------
def new_col(name, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col

def empty(col, name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None); col.objects.link(e)
    e.location = loc; e.empty_display_size = 0.15
    if parent: e.parent = parent
    return e

def ell(col, parent, name, loc, scale, m, rot=(0, 0, 0), ol=0.0, sub=1, seg=32):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg//2, radius=1.0)
    o = to_obj(name, bm, col, m)
    o.location = loc; o.scale = scale; o.rotation_euler = rot; o.parent = parent
    finish(o, sub, ol); return o

def cone(col, parent, name, loc, r1, r2, depth, m, rot=(0, 0, 0), scale=(1, 1, 1), ol=0.0, seg=24):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth)
    o = to_obj(name, bm, col, m)
    o.location = loc; o.rotation_euler = rot; o.scale = scale; o.parent = parent
    finish(o, 1, ol); return o

def rbox(col, parent, name, loc, half, m, rot=(0, 0, 0), bevel=0.06, ol=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=2.0)
    o = to_obj(name, bm, col, m)
    o.location = loc; o.scale = half; o.rotation_euler = rot; o.parent = parent
    b = o.modifiers.new("bisel", "BEVEL"); b.width = bevel; b.segments = 4
    b.affect = "EDGES"; o.modifiers.new("escala_bisel", "WEIGHTED_NORMAL") if False else None
    # aplicar la escala antes del bisel para que el redondeo sea uniforme
    o.data.transform(Matrix.Diagonal((*half, 1))); o.scale = (1, 1, 1)
    finish(o, 1, ol); return o

def relink(o, col):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)

def tube(col, parent, name, pts, r, m, ol=0.0):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = r; cu.bevel_resolution = 4; cu.resolution_u = 16
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts)-1)
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu); col.objects.link(o); cu.materials.append(m)
    to_mesh(o); o = bpy.context.view_layer.objects.active
    o.parent = parent
    for p in o.data.polygons: p.use_smooth = True
    if ol: finish(o, 0, ol)
    return o

def to_mesh(o):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")

def metaball_obj(col, name, elems, m, ol=0.0):
    """elems: lista de (tipo, co, radio_visible, extra). Devuelve malla fundida."""
    K = 0.67
    mb = bpy.data.metaballs.new(name); mb.resolution = 0.025; mb.render_resolution = 0.025; mb.threshold = 0.6
    for kind, co, r, extra in elems:
        e = mb.elements.new(type=kind); e.radius = r/K; e.stiffness = 2.0
        if kind == "CAPSULE":
            p1, p2 = Vector(co), Vector(extra); v = p2-p1
            e.co = (p1+p2)/2; e.size_x = v.length/2
            e.rotation = Vector((1, 0, 0)).rotation_difference(v.normalized())
        else:
            e.co = co
            if kind == "ELLIPSOID": e.size_x, e.size_y, e.size_z = extra
    o = bpy.data.objects.new(name, mb); col.objects.link(o); mb.materials.append(m)
    to_mesh(o); o = bpy.context.view_layer.objects.active
    for p in o.data.polygons: p.use_smooth = True
    if ol: finish(o, 0, ol)
    return o

def face(d):
    return Vector(d).normalized().to_track_quat("Z", "Y").to_euler()

# ---------- materiales ----------
def mat_zorro():
    return dict(
        fur=ramp_mat("pelaje", [(0.0, "#C9561C"), (0.55, "#E8742A"), (1.0, "#F08A3A")], coord="Object", axis="Z",
                     rough=0.7, noise_amt=0.12, noise_scale=5, bump=0.06, bump_scale=60),
        cream=ramp_mat("crema", [(0.0, "#F3E3CC"), (1.0, "#FFF6E9")], coord="Object", axis="Z", rough=0.75,
                       noise_amt=0.2, bump=0.05, bump_scale=60),
        dark=ramp_mat("calcetin", [(0.0, "#3A2219"), (1.0, "#5E3A28")], coord="Object", axis="Z", rough=0.75,
                      noise_amt=0.15, bump=0.05, bump_scale=60),
        ear=principled("oreja_int", "#F2A894", 0.7, sss=0.3),
        eye=principled("ojo", "#15101A", 0.08, coat=1.0),
        shine=None, nose=principled("nariz", "#241717", 0.15, coat=1.0),
        blush=principled("rubor", "#FF8F8F", 0.6),
    )

def shine_mat():
    m = bpy.data.materials.get("brillo")
    if m: return m
    m = principled("brillo", "#FFFFFF", 0.1)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Emission Color"].default_value = (1, 1, 1, 1); b.inputs["Emission Strength"].default_value = 4
    return m

# ---------- personaje base ----------
def crear_zorrito(nombre="zorrito"):
    M = mat_zorro(); SH = shine_mat()
    col = new_col(nombre)
    root = empty(col, nombre+"_raiz")
    H = Vector((0, 0, 1.78)); R = 0.6

    # Pelaje: torso, cabeza, mejillas, extremidades (pose A) y cola en una sola superficie
    fur = [("ELLIPSOID", (0, 0, 0.95), 0.62, (0.76, 0.68, 0.92)), ("BALL", H, R, None)]
    for sx in (-1, 1):
        fur += [("ELLIPSOID", H+Vector((sx*0.42, -0.06, -0.2)), 0.26, (1.35, 0.8, 0.7)),
                ("CAPSULE", (sx*0.2, 0, 0.62), 0.12, (sx*0.23, -0.03, 0.2)),
                ("CAPSULE", (sx*0.3, 0, 1.24), 0.09, (sx*0.48, -0.04, 1.0)),
                ("CAPSULE", (sx*0.48, -0.04, 1.0), 0.082, (sx*0.58, -0.08, 0.8)),
                ("BALL", (sx*0.6, -0.09, 0.74), 0.1, None)]
    tail = []
    for i in range(16):
        t = i/15
        a, b, c = Vector((0.08, 0.3, 0.55)), Vector((0.95, 0.75, 0.85)), Vector((0.9, 0.62, 1.7))
        p = a.lerp(b, t)*(1-t) + b.lerp(c, t)*t
        r = 0.1 + 0.2*math.sin(math.pi*min(1, t*1.15))**0.8 + 0.06*t
        fur.append(("BALL", p, r, None)); tail.append((p, r))
    body = metaball_obj(col, "pelaje", fur, M["fur"], ol=0.02); body.parent = root

    # Máscara clara: hocico + mejillas + pecho esponjoso, fundidos entre sí
    cream = [("ELLIPSOID", H+Vector((0, -0.52, -0.14)), 0.3, (0.92, 1.15, 0.7))]
    for sx in (-1, 1):
        cream += [("ELLIPSOID", H+Vector((sx*0.3, -0.44, -0.22)), 0.2, (1.2, 1.0, 0.8))]
    cream += [("ELLIPSOID", (0, -0.28, 1.0), 0.34, (0.9, 0.5, 0.95)),
              ("ELLIPSOID", (0, -0.3, 1.24), 0.26, (1.1, 0.55, 0.6))]
    mask = metaball_obj(col, "crema", cream, M["cream"], ol=0.012); mask.parent = root
    (pa, _), (pb, rb) = tail[-3], tail[-1]
    ell(col, root, "cola_punta", pb+(pb-pa).normalized()*0.02, (rb*1.12, rb*1.12, rb*1.5), M["cream"], rot=face(pb-pa), ol=0.012)

    # Calcetines y guantes oscuros (ligeramente más grandes que el pelaje que cubren)
    dark = []
    for sx in (-1, 1):
        dark += [("CAPSULE", (sx*0.215, -0.02, 0.4), 0.13, (sx*0.23, -0.03, 0.18)),
                 ("ELLIPSOID", (sx*0.24, -0.1, 0.1), 0.16, (1.0, 1.5, 0.65)),
                 ("CAPSULE", (sx*0.555, -0.07, 0.86), 0.09, (sx*0.6, -0.09, 0.74)),
                 ("BALL", (sx*0.605, -0.095, 0.72), 0.112, None)]
    socks = metaball_obj(col, "oscuro", dark, M["dark"], ol=0.016); socks.parent = root

    # Orejas con interior rosado y mechón claro
    for sx in (-1, 1):
        base = H + Vector((sx*0.34, 0.04, 0.5)); rot = (math.radians(-8), math.radians(sx*22), 0)
        cone(col, root, "oreja", base, 0.3, 0.0, 0.78, M["fur"], rot=rot, scale=(1, 0.55, 1), ol=0.016)
        cone(col, root, "oreja_int", base+Vector((0, -0.1, -0.02)), 0.19, 0.0, 0.52, M["ear"], rot=rot, scale=(1, 0.4, 1))
        cone(col, root, "mechon", base+Vector((sx*-0.03, -0.14, -0.12)), 0.08, 0.0, 0.26, M["cream"],
             rot=(math.radians(-15), math.radians(sx*35), 0), scale=(1, 0.5, 1))

    # Cara
    for sx in (-1, 1):
        d = Vector((sx*0.38, -0.86, 0.2)).normalized(); p = H + d*R*0.96
        ell(col, root, "ojo", p, (0.085, 0.12, 0.05), M["eye"], rot=face(d))
        ell(col, root, "reflejo", p+d*0.04+Vector((0.02, 0, 0.045)), (0.026, 0.03, 0.01), SH, rot=face(d))
        db = Vector((sx*0.36, -0.78, 0.55)).normalized()
        ell(col, root, "ceja", H+db*R*0.99, (0.08, 0.025, 0.022), M["dark"], rot=(0, math.radians(sx*12), 0))
        ell(col, root, "rubor", H+Vector((sx*0.37, -0.5, -0.11)), (0.065, 0.03, 0.04), M["blush"], rot=face((sx*0.6, -1, 0)))
    ell(col, root, "nariz", H+Vector((0, -0.87, -0.06)), (0.09, 0.065, 0.07), M["nose"])
    ell(col, root, "nariz_brillo", H+Vector((-0.02, -0.925, -0.03)), (0.022, 0.01, 0.013), SH)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.08, minor_radius=0.017, location=H+Vector((0, -0.775, -0.2)))
    sm = bpy.context.object; relink(sm, col)
    bm = bmesh.new(); bm.from_mesh(sm.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0], context="VERTS"); bm.to_mesh(sm.data); bm.free()
    sm.rotation_euler = (math.radians(80), 0, 0); sm.scale = (1.3, 0.6, 1); sm.data.materials.append(M["nose"]); sm.parent = root

    # Anclas para accesorios (luego serán huesos del rig)
    empty(col, "ancla_cuello", (0, 0, 1.34), root)
    empty(col, "ancla_espalda", (0, 0.36, 1.02), root)
    col.asset_mark(); col["tipo"] = "personaje/zorrito"; col["anclas"] = "cuello,espalda"
    return col, root

# ---------- accesorio: bufanda ----------
def crear_bufanda(nombre="bufanda", color_a="#2F8F86", color_b="#F2C14E"):
    col = new_col(nombre); root = empty(col, nombre+"_raiz")
    knit = bpy.data.materials.new("tejido_"+nombre); knit.use_nodes = True
    nt = knit.node_tree; bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "Z"
    wave.wave_profile = "SAW"; wave.inputs["Scale"].default_value = 2.2
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp; cr.interpolation = "CONSTANT"
    cr.elements[0].color = (*lin(color_a), 1); cr.elements[1].position = 0.72; cr.elements[1].color = (*lin(color_b), 1)
    knitn = nt.nodes.new("ShaderNodeTexWave"); knitn.wave_type = "BANDS"; knitn.bands_direction = "X"
    knitn.inputs["Scale"].default_value = 45; knitn.inputs["Distortion"].default_value = 3
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"]); nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tc.outputs["Object"], knitn.inputs["Vector"]); nt.links.new(knitn.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.9; bsdf.inputs["Sheen Weight"].default_value = 0.5

    bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.12, major_segments=64, minor_segments=24)
    ring = bpy.context.object; relink(ring, col); ring.name = "anillo"
    ring.scale = (1, 0.95, 0.85); ring.data.materials.append(knit); ring.parent = root; finish(ring, 1, 0.016)
    ell(col, root, "nudo", (0.16, -0.36, -0.04), (0.12, 0.1, 0.11), knit, ol=0.012)
    for name, loc, half, rot in [("punta1", (0.17, -0.41, -0.26), (0.09, 0.035, 0.2), (math.radians(8), 0, math.radians(-10))),
                                 ("punta2", (0.29, -0.37, -0.22), (0.08, 0.03, 0.16), (math.radians(4), math.radians(-8), math.radians(-28)))]:
        t = rbox(col, root, name, loc, half, knit, rot=rot, bevel=0.03, ol=0.012)
        mw = Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4()
        bm = bmesh.new()
        for k in range(5):
            fx = -half[0]*0.8 + k*half[0]*0.4
            p = mw @ Vector((fx, 0, -half[2]-0.035))
            bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.012, radius2=0.008, depth=0.07,
                                  matrix=Matrix.Translation(p) @ Euler(rot).to_matrix().to_4x4())
        fr = to_obj(name+"_flecos", bm, col, knit); fr.parent = root; finish(fr, 1, 0)
    col.asset_mark(); col["tipo"] = "accesorio/cuello"; col["ancla"] = "cuello"
    return col, root

# ---------- accesorio: mochila ----------
def crear_mochila(nombre="mochila"):
    col = new_col(nombre); root = empty(col, nombre+"_raiz")
    canvas = ramp_mat("lona", [(0.0, "#9C6237"), (1.0, "#B57745")], coord="Object", axis="Z", rough=0.85,
                      noise_amt=0.3, noise_scale=8, bump=0.15, bump_scale=120)
    leather = ramp_mat("cuero", [(0.0, "#5E3820"), (1.0, "#774A2B")], coord="Object", axis="X", rough=0.5,
                       noise_amt=0.3, noise_scale=10, bump=0.05, bump_scale=40)
    brass = principled("laton", "#E2B44C", 0.3); brass.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.9
    blanket = ramp_mat("manta", [(0.0, "#B93A33"), (0.5, "#D9574E"), (1.0, "#B93A33")], coord="Object", axis="X",
                       rough=0.9, noise_amt=0.05, bump=0.2, bump_scale=80)

    rbox(col, root, "cuerpo", (0, 0.14, 0), (0.34, 0.17, 0.36), canvas, bevel=0.1, ol=0.016)
    rbox(col, root, "bolsillo", (0, 0.31, -0.13), (0.24, 0.05, 0.15), canvas, bevel=0.05, ol=0.01)
    rbox(col, root, "tapa", (0, 0.15, 0.35), (0.35, 0.185, 0.045), leather, bevel=0.04, ol=0.012)
    rbox(col, root, "solapa", (0, 0.325, 0.2), (0.29, 0.022, 0.15), leather, bevel=0.04, ol=0.01)
    rbox(col, root, "hebilla", (0, 0.35, 0.08), (0.05, 0.012, 0.035), brass, bevel=0.012)
    for sx in (-1, 1):
        rbox(col, root, "bolsillo_lateral", (sx*0.36, 0.14, -0.12), (0.05, 0.12, 0.14), canvas, bevel=0.04, ol=0.01)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=0.8, vertices=32, rotation=(0, math.radians(90), 0))
    roll = bpy.context.object; relink(roll, col); roll.name = "manta"; roll.location = (0, 0.16, 0.51)
    roll.data.materials.append(blanket); roll.parent = root; finish(roll, 1, 0.014)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.137, minor_radius=0.014, major_segments=40, minor_segments=8,
                                         rotation=(0, math.radians(90), 0))
        s = bpy.context.object; relink(s, col); s.location = (sx*0.24, 0.16, 0.51)
        s.data.materials.append(leather); s.parent = root; finish(s, 1, 0)
    for sx in (-1, 1):  # correas de hombro (se cierran sobre el pecho del personaje)
        pts = [(sx*0.2, 0.0, 0.3), (sx*0.22, -0.28, 0.46), (sx*0.24, -0.6, 0.33), (sx*0.255, -0.77, 0.05),
               (sx*0.25, -0.68, -0.14)]
        tube(col, root, "correa", pts, 0.026, leather, ol=0.008)
    col.asset_mark(); col["tipo"] = "accesorio/espalda"; col["ancla"] = "espalda"
    return col, root

def vestir(acc_root, ancla):
    acc_root.parent = ancla; acc_root.location = (0, 0, 0); acc_root.rotation_euler = (0, 0, 0)

# ---------- vista previa ----------
def estudio(sc, cam_loc, target, lens, res, fast):
    floor = principled("piso", "#E7DCCB", 0.9)
    bm = bmesh.new()  # fondo infinito: piso que se curva hacia una pared
    prof = [(-8, 0)] + [(3 + 2.5*math.sin(t), 2.5 - 2.5*math.cos(t)) for t in [i/12*math.pi/2 for i in range(13)]] + [(5.5, 10)]
    for x in (-12, 12):
        pass
    vs = []
    for x in (-12, 12):
        vs.append([bm.verts.new((x, y, z)) for y, z in prof])
    for i in range(len(prof)-1):
        bm.faces.new((vs[0][i], vs[1][i], vs[1][i+1], vs[0][i+1]))
    fl = to_obj("fondo", bm, sc.collection, floor)
    for p in fl.data.polygons: p.use_smooth = True
    world = bpy.data.worlds.new("estudio"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*lin("#EFE6D8"), 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    def area(loc, energy, size, color, tgt):
        bpy.ops.object.light_add(type="AREA", location=loc); L = bpy.context.object
        L.data.energy = energy; L.data.size = size; L.data.color = color
        L.rotation_euler = (Vector(tgt)-Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    area((4, -4.5, 5), 1800, 4, (1.0, 0.92, 0.82), target)
    area((-5, -3, 2.5), 500, 5, (0.8, 0.88, 1.0), target)
    area((-1, 4, 4), 900, 3, (1.0, 0.96, 0.9), target)
    bpy.ops.object.camera_add(location=cam_loc); cam = bpy.context.object; sc.camera = cam
    cam.data.lens = lens; cam.rotation_euler = (Vector(target)-Vector(cam_loc)).to_track_quat("-Z", "Y").to_euler()
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"
    sc.cycles.samples = 16 if fast else 48; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 12
    sc.render.resolution_x, sc.render.resolution_y = (res[0]//2, res[1]//2) if fast else res
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy"
    sc.render.image_settings.file_format = "PNG"

if __name__ == "__main__":
    FAST = "--fast" in sys.argv; MODO = arg("--modo", "hoja"); OUT = arg("--out", "/tmp/zorrito.png")
    bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
    zc, zroot = crear_zorrito()
    bc, broot = crear_bufanda()
    mc, mroot = crear_mochila()
    if MODO == "vestido":
        vestir(broot, bpy.data.objects["ancla_cuello"]); vestir(mroot, bpy.data.objects["ancla_espalda"])
        zroot.rotation_euler = (0, 0, math.radians(-36))
        estudio(sc, (2.3, -4.9, 1.55), (0.15, 0, 1.12), 45, (1200, 1200), FAST)
    else:
        mat_ped = principled("pedestal", "#D9CCB8", 0.6)
        # bufanda en un soporte de cuello
        bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=0.08, location=(-1.75, 0.3, 0.04)); o = bpy.context.object; o.data.materials.append(mat_ped); finish(o, 0)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=1.0, location=(-1.75, 0.3, 0.55)); o = bpy.context.object; o.data.materials.append(mat_ped); finish(o, 0)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.27, depth=0.5, location=(-1.75, 0.3, 1.2)); o = bpy.context.object; o.data.materials.append(mat_ped); finish(o, 0)
        broot.location = (-1.75, 0.3, 1.2); broot.rotation_euler = (0, 0, math.radians(15))
        # mochila en un pedestal, de frente a la cámara
        bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.5, location=(1.85, 0.4, 0.25)); o = bpy.context.object; o.data.materials.append(mat_ped); finish(o, 0)
        mroot.location = (1.85, 0.25, 0.5+0.36+0.01); mroot.rotation_euler = (0, 0, math.radians(180-18))
        zroot.rotation_euler = (0, 0, math.radians(-10))
        estudio(sc, (0, -7.6, 1.55), (0, 0, 1.1), 42, (1600, 900), FAST)
    if arg("--blend"):
        bpy.ops.wm.save_as_mainfile(filepath=arg("--blend"))
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
