"""Asset: hongo estilizado detallado.

crear_hongo(seed, escala, inclinacion, tono) construye un hongo completo
(sombrero con borde curvado, láminas debajo, manchas en relieve, tallo con
anillo y base ensanchada) y lo devuelve en su propia colección, marcada como
asset de Blender para reutilizarla en las escenas.

Vista previa: python3 hongo.py --out render.png [--fast] [--blend hongo.blend]
"""
import bpy, bmesh, math, random, sys
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

def arg(name, default=None):
    return sys.argv[sys.argv.index(name)+1] if name in sys.argv else default

# ---------- utilidades ----------
def lin(h):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(x/12.92 if x <= 0.04045 else ((x+0.055)/1.055)**2.4 for x in c)

def principled(name, hexcol, rough=0.6, coat=0.0, sss=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*lin(hexcol), 1)
    b.inputs["Roughness"].default_value = rough
    if coat: b.inputs["Coat Weight"].default_value = coat
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (0.4, 0.15, 0.1)
        b.inputs["Subsurface Scale"].default_value = 0.05
    return m

def ramp_mat(name, stops, coord="Generated", axis="Z", rough=0.5, coat=0.0, sss=0.0,
             noise_amt=0.08, noise_scale=6.0, bump=0.0, bump_scale=30.0, stretch=None):
    """Color en degradado a lo largo de un eje, con ruido y relieve opcional."""
    m = principled(name, "#FFFFFF", rough, coat, sss); nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = noise_scale
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = noise_amt
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*lin(stops[0][1]), 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*lin(stops[-1][1]), 1)
    for pos, col in stops[1:-1]:
        e = cr.elements.new(pos); e.color = (*lin(col), 1)
    nt.links.new(tc.outputs[coord], sep.inputs[0]); nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], add.inputs[0]); nt.links.new(sep.outputs[axis], add.inputs[2])
    nt.links.new(add.outputs[0], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    if bump:
        if stretch:  # fibras alargadas (tallo)
            mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = stretch
            nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); src = mp.outputs[0]
        else:
            src = tc.outputs["Object"]
        bn = nt.nodes.new("ShaderNodeTexNoise"); bn.inputs["Scale"].default_value = bump_scale
        bn.inputs["Detail"].default_value = 6
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
        nt.links.new(src, bn.inputs["Vector"]); nt.links.new(bn.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def outline_mat():
    m = bpy.data.materials.get("contorno")
    if m: return m
    m = bpy.data.materials.new("contorno"); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); geo = nt.nodes.new("ShaderNodeNewGeometry")
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*lin("#2B1B14"), 1)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(geo.outputs["Backfacing"], mix.inputs["Fac"])
    nt.links.new(em.outputs[0], mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2])
    lp = nt.nodes.new("ShaderNodeLightPath"); tr2 = nt.nodes.new("ShaderNodeBsdfTransparent")
    cam = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], cam.inputs["Fac"])
    nt.links.new(tr2.outputs[0], cam.inputs[1]); nt.links.new(mix.outputs[0], cam.inputs[2])
    nt.links.new(cam.outputs[0], out.inputs["Surface"])
    return m

def finish(obj, sub=2, outline=0.0):
    for p in obj.data.polygons: p.use_smooth = True
    if sub:
        m = obj.modifiers.new("sub", "SUBSURF"); m.levels = sub; m.render_levels = sub
    if outline:
        obj.data.materials.append(outline_mat())
        s = obj.modifiers.new("contorno", "SOLIDIFY"); s.thickness = outline; s.offset = 1
        s.use_flip_normals = True; s.use_rim = False; s.material_offset = len(obj.data.materials)-1

def lathe_bm(profile, steps=64):
    """Gira un perfil (r, z) alrededor del eje Z y devuelve un bmesh."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in profile]
    es = [bm.edges.new((vs[i], vs[i+1])) for i in range(len(vs)-1)]
    bmesh.ops.spin(bm, geom=vs+es, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def to_obj(name, bm, col, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); col.objects.link(o); me.materials.append(mat)
    return o

def interp(pts, r):
    """z del perfil en el radio r (pts ordenados por r ascendente)."""
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if r0 <= r <= r1:
            t = (r-r0)/(r1-r0+1e-9); return z0+(z1-z0)*t
    return pts[-1][1]

# ---------- materiales compartidos ----------
MATS = {}
def mats(tono):
    key = tono
    if key in MATS: return MATS[key]
    caps = {
        "rojo": [(0.0, "#E8452A"), (0.5, "#C8201C"), (1.0, "#7E0E14")],
        "naranja": [(0.0, "#F7A44A"), (0.45, "#EC7A2C"), (1.0, "#B4471A")],
        "lila": [(0.0, "#C79BE6"), (0.45, "#9A63CF"), (1.0, "#64379A")],
    }
    MATS[key] = dict(
        cap=ramp_mat(f"sombrero_{tono}", caps[tono], rough=0.42, coat=0.12, sss=0.1, noise_amt=0.12,
                     bump=0.08, bump_scale=18),
        spot=ramp_mat("mancha", [(0.0, "#F3EADB"), (1.0, "#FFFDF7")], rough=0.6, noise_amt=0.3, bump=0.15, bump_scale=40),
        gill=ramp_mat("laminas", [(0.0, "#D9C2A6"), (1.0, "#F1E3CF")], coord="Generated", axis="Z", rough=0.8, noise_amt=0.1),
        stem=ramp_mat("tallo", [(0.0, "#D8C7AE"), (0.35, "#F2E7D6"), (1.0, "#FBF5EA")], rough=0.7, sss=0.2,
                      noise_amt=0.06, bump=0.12, bump_scale=14, stretch=(1, 1, 0.12)),
    )
    return MATS[key]

# ---------- el asset ----------
def crear_hongo(nombre="hongo", seed=1, escala=1.0, inclinacion=0.0, tono="rojo", contorno=True, parent_col=None):
    rnd = random.Random(seed)
    M = mats(tono)
    col = bpy.data.collections.new(nombre)
    (parent_col or bpy.context.scene.collection).children.link(col)
    ol = 0.012 if contorno else 0.0

    hs = 1.0*rnd.uniform(0.9, 1.15)          # altura del tallo
    rs = 0.16*rnd.uniform(0.9, 1.1)          # radio del tallo
    Rc = 0.62*rnd.uniform(0.92, 1.08)        # radio del sombrero
    Hc = 0.5*rnd.uniform(0.85, 1.1)          # altura del sombrero
    bend = inclinacion                       # desplazamiento lateral de la punta del tallo

    def bend_at(z):  # curva suave del tallo
        t = max(0.0, min(1.0, z/hs)); return bend*t*t

    # Tallo: base ensanchada, ligera panza abajo y afinado arriba
    prof = [(0, 0), (1.35, 0.0), (1.38, 0.03), (1.2, 0.09), (1.04, 0.22), (0.98, 0.42), (0.92, 0.66),
            (0.88, 0.86), (0.86, 1.0), (0, 1.0)]
    bm = lathe_bm([(r*rs, z*hs) for r, z in prof], 48)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        v.co.x += bend_at(v.co.z)
        v.co.xy *= 1 + 0.04*math.sin(5*a + seed) * (1 - v.co.z/hs)  # base irregular
    stem = to_obj(nombre+"_tallo", bm, col, M["stem"]); finish(stem, 2, ol)

    # Anillo (faldita) bajo el sombrero, con borde ondulado
    zr = 0.8*hs
    ring = [(0.86*rs, zr+0.03), (1.15*rs, zr), (1.5*rs, zr-0.06), (1.7*rs, zr-0.13), (1.66*rs, zr-0.16)]
    bm = lathe_bm(ring, 64)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x); r = v.co.xy.length
        k = max(0.0, (r - 1.2*rs)/(0.5*rs))
        v.co.z += 0.025*math.sin(7*a + seed)*k
        v.co.x += bend_at(zr)
    rg = to_obj(nombre+"_anillo", bm, col, M["stem"])
    sol = rg.modifiers.new("grosor", "SOLIDIFY"); sol.thickness = 0.012
    finish(rg, 2, 0)

    # Sombrero: domo con borde que se curva hacia adentro
    top = [(0.0, 1.0), (0.3, 0.97), (0.58, 0.87), (0.8, 0.7), (0.94, 0.5), (1.0, 0.34), (0.99, 0.25)]
    under = [(0.94, 0.22), (0.78, 0.25), (0.5, 0.3), (0.2, 0.34), (0.0, 0.35)]
    prof = [(r*Rc, z*Hc) for r, z in top + under]
    bm = lathe_bm(prof, 72)
    cap_z = hs - 0.3*Hc
    tilt = Matrix.Rotation(math.atan2(bend, hs)*0.9, 4, "Y")
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x); r = v.co.xy.length/Rc
        v.co.xy *= 1 + 0.035*noise.noise(Vector((math.cos(a)*2, math.sin(a)*2, seed)))  # contorno orgánico
        v.co.z += 0.02*Hc*math.sin(5*a+seed)*r*r
    bvh_src = bm.copy()
    xf = Matrix.Translation((bend_at(hs), 0, cap_z)) @ tilt
    cap = to_obj(nombre+"_sombrero", bm, col, M["cap"]); cap.matrix_world = xf
    finish(cap, 2, ol)

    # Láminas: aletas radiales finas bajo el sombrero, siguiendo su curva
    und = sorted([(r*Rc, z*Hc) for r, z in under])
    bm = bmesh.new(); n = 64
    for k in range(n):
        a = k/n*math.tau + rnd.uniform(-0.02, 0.02)
        r0 = (0.17 if k % 2 == 0 else 0.45)*Rc; r1 = 0.93*Rc
        ca, sa = math.cos(a), math.sin(a)
        steps = 8; topv, botv = [], []
        for i in range(steps+1):
            r = r0 + (r1-r0)*i/steps
            z = interp(und, r) + 0.004
            depth = 0.09*Hc*math.sin(math.pi*min(1, (r-r0)/(r1-r0)*1.05))**0.7
            topv.append(bm.verts.new((r*ca, r*sa, z))); botv.append(bm.verts.new((r*ca, r*sa, z-depth-0.002)))
        for i in range(steps):
            bm.faces.new((topv[i], topv[i+1], botv[i+1], botv[i]))
    gills = to_obj(nombre+"_laminas", bm, col, M["gill"]); gills.matrix_world = xf
    for p in gills.data.polygons: p.use_smooth = True

    # Manchas: gotas planas e irregulares pegadas a la superficie del sombrero
    bvh = BVHTree.FromBMesh(bvh_src); bvh_src.free()
    bm = bmesh.new(); placed = []
    tries = 0
    target = rnd.randint(11, 16)
    while len(placed) < target and tries < 600:
        tries += 1
        a = rnd.uniform(0, math.tau); rr = math.sqrt(rnd.uniform(0, 0.78))*Rc
        hit = bvh.ray_cast(Vector((rr*math.cos(a), rr*math.sin(a), 5)), Vector((0, 0, -1)))
        if hit[0] is None or hit[1].z < 0.35: continue
        loc, nor = hit[0], hit[1]
        size = (0.16 - 0.08*rr/Rc)*Rc*rnd.uniform(0.7, 1.25)
        if any((loc-p).length < (s+size)*1.05 for p, s in placed): continue
        placed.append((loc, size))
        rot = nor.to_track_quat("Z", "Y").to_matrix().to_4x4() @ Matrix.Rotation(rnd.uniform(0, 6), 4, "Z")
        sc = Matrix.Diagonal((size*rnd.uniform(0.85, 1.2), size*rnd.uniform(0.7, 1.0), size*0.3, 1))
        res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=Matrix.Translation(loc-nor*0.004) @ rot @ sc)
        for v in res["verts"]:
            v.co += nor*0.012*noise.noise(v.co*25)
    spots = to_obj(nombre+"_manchas", bm, col, M["spot"]); spots.matrix_world = xf
    finish(spots, 1, 0)

    # Escala y marca de asset
    for o in col.objects:
        o.matrix_world = Matrix.Scale(escala, 4) @ o.matrix_world
    col.asset_mark()
    col["tipo"] = "vegetacion/hongo"; col["seed"] = seed; col["tono"] = tono
    return col

def mover(col, loc, rot_z=0.0):
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, "Z")
    for o in col.objects:
        o.matrix_world = m @ o.matrix_world

# ---------- vista previa tipo diorama ----------
if __name__ == "__main__":
    FAST = "--fast" in sys.argv
    OUT = arg("--out", "/tmp/hongo.png"); BLEND = arg("--blend")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene

    a = crear_hongo("hongo_grande", seed=3, escala=1.0, inclinacion=0.06, tono="rojo")
    b = crear_hongo("hongo_mediano", seed=8, escala=0.68, inclinacion=-0.18, tono="rojo")
    c = crear_hongo("hongo_chico", seed=12, escala=0.42, inclinacion=0.1, tono="rojo")
    mover(a, (0.15, 0.1, 0.0), 0.4); mover(b, (-0.62, -0.18, 0.0), 2.2); mover(c, (0.62, -0.42, 0.0), 1.0)
    if BLEND:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)

    # base de diorama: tierra con capa de musgo, pasto corto y piedritas
    rnd = random.Random(4)
    soil = principled("tierra", "#5B3B28", 0.95)
    moss = ramp_mat("musgo", [(0.0, "#4E8A35"), (0.5, "#6FAA45"), (1.0, "#8DC25A")], coord="Object", axis="X",
                    rough=0.95, noise_amt=0.9, noise_scale=3, bump=0.4, bump_scale=60)
    bm = lathe_bm([(0, -0.03), (1.6, -0.05), (1.62, -0.07), (1.62, -0.38), (1.58, -0.42), (0, -0.42)], 96)
    base = to_obj("base", bm, sc.collection, soil); finish(base, 1, 0)
    bm = lathe_bm([(0, 0.035), (1.58, 0.02), (1.64, -0.03), (1.6, -0.07)], 96)
    for v in bm.verts:
        v.co.z += 0.035*noise.noise(v.co*2.2) + 0.02*noise.noise(v.co*9)
        a2 = math.atan2(v.co.y, v.co.x)
        if v.co.xy.length > 1.5: v.co.z -= 0.04*max(0, math.sin(9*a2))
    mo = to_obj("musgo", bm, sc.collection, moss); finish(mo, 1, 0)
    grass = principled("pasto", "#5E9E3E", 0.8)
    bm = bmesh.new()
    for _ in range(900 if not FAST else 300):
        r = 1.5*math.sqrt(rnd.random()); a2 = rnd.uniform(0, math.tau)
        x, y = r*math.cos(a2), r*math.sin(a2)
        if (x-0.15)**2+(y-0.1)**2 < 0.05: continue
        h = rnd.uniform(0.06, 0.2); w = 0.012; ang = rnd.uniform(0, math.tau)
        px, py = -math.sin(ang)*w, math.cos(ang)*w; z0 = 0.02
        v1 = bm.verts.new((x-px, y-py, z0)); v2 = bm.verts.new((x+px, y+py, z0))
        tip = bm.verts.new((x+math.cos(ang)*h*0.3, y+math.sin(ang)*h*0.3, z0+h))
        bm.faces.new((v1, v2, tip))
    to_obj("pasto", bm, sc.collection, grass)
    peb = ramp_mat("piedrita", [(0.0, "#8A8F96"), (1.0, "#B9BDC2")], coord="Object", rough=0.85, noise_amt=0.8)
    for _ in range(7):
        r = rnd.uniform(0.5, 1.4); a2 = rnd.uniform(0, math.tau); s = rnd.uniform(0.04, 0.09)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=s, location=(r*math.cos(a2), r*math.sin(a2), 0.02))
        o = bpy.context.object; o.scale = (1.2, 1, 0.6); o.data.materials.append(peb); finish(o, 1, 0)

    # mundo, luces y cámara
    world = bpy.data.worlds.new("estudio"); sc.world = world; world.use_nodes = True
    nt = world.node_tree; bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].color = (*lin("#EADBC4"), 1); cr.elements[1].color = (*lin("#EADBC4"), 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0]); nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 1.15

    def area(loc, energy, size, color, target=(0, 0, 0.5)):
        bpy.ops.object.light_add(type="AREA", location=loc); L = bpy.context.object
        L.data.energy = energy; L.data.size = size; L.data.color = color
        L.rotation_euler = (Vector(target)-Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    area((3.2, -3.0, 3.4), 650, 2.5, (1.0, 0.9, 0.78))    # luz principal cálida
    area((-3.4, -1.5, 1.6), 160, 3.0, (0.75, 0.85, 1.0))  # relleno frío
    area((-0.8, 3.2, 2.4), 420, 1.5, (1.0, 0.95, 0.9))    # contraluz para separar el borde

    cam_loc = Vector((1.15, -3.6, 0.62)); target = Vector((0.0, 0.0, 0.6))
    bpy.ops.object.camera_add(location=cam_loc); cam = bpy.context.object; sc.camera = cam
    cam.data.lens = 50; cam.rotation_euler = (target-cam_loc).to_track_quat("-Z", "Y").to_euler()
    cam.data.dof.use_dof = True; cam.data.dof.focus_distance = (Vector((0.15, 0.1, 0.8))-cam_loc).length
    cam.data.dof.aperture_fstop = 4.0

    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"
    sc.cycles.samples = 16 if FAST else 64; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 12
    sc.render.resolution_x, sc.render.resolution_y = (600, 600) if FAST else (1200, 1200)
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy"
    sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
