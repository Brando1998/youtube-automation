import bpy, math, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--out")+1] if "--out" in sys.argv else "/tmp/frame"
STILL = "--still" in sys.argv

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, color, rough=0.6, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m

def hexc(h):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(x/12.92 if x <= 0.04045 else ((x+0.055)/1.055)**2.4 for x in c)

def smooth(o, sub=2):
    bpy.ops.object.shade_smooth()
    m = o.modifiers.new("s", "SUBSURF"); m.levels = sub; m.render_levels = sub

def sphere(name, loc, scale, m, parent=None, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg//2, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale; o.data.materials.append(m)
    smooth(o, 1)
    if parent: o.parent = parent
    return o

GREEN = mat("verde", hexc("#7BCB5B"), 0.5)
SHELL = mat("caparazon", hexc("#3E9B4F"), 0.35)
BAND = mat("borde", hexc("#F2C14E"), 0.4)
WHITE = mat("blanco", (0.95, 0.95, 0.95), 0.2)
BLACK = mat("negro", hexc("#22202E"), 0.15)
CHEEK = mat("mejilla", hexc("#FF8FA3"), 0.6)
GRASS = mat("pasto", hexc("#8BD17C"), 0.9)
TRUNK = mat("tronco", hexc("#B9875A"), 0.8)
LEAF = mat("hojas", hexc("#5DB75A"), 0.7)
LEAF2 = mat("hojas2", hexc("#9ED36A"), 0.7)
SUN = mat("sol", hexc("#FFD23F"), 0.5, emit=3)

# Suelo
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
bpy.context.object.data.materials.append(GRASS)
for x, y, s in [(-3.2, 4, 1.4), (4.5, 6, 2.0), (-6, 9, 2.6), (0.5, 10, 2.2)]:
    bpy.ops.mesh.primitive_uv_sphere_add(location=(x, y, -s*0.55), radius=s*1.6)
    o = bpy.context.object; o.scale.z = 0.5; o.data.materials.append(GRASS); smooth(o, 1)

# Árboles redondos
def tree(x, y, h):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=h, location=(x, y, h/2))
    t = bpy.context.object; t.data.materials.append(TRUNK); smooth(t, 1)
    for dx, dz, r, mm in [(0, h+0.3, 0.85, LEAF), (-0.45, h-0.1, 0.6, LEAF2), (0.45, h, 0.62, LEAF)]:
        sphere("copa", (x+dx, y, dz), (r, r, r), mm)
tree(-3.4, 3.2, 1.6); tree(3.6, 4.6, 2.0); tree(-1.4, 6.5, 1.8)

# Sol
sphere("sol", (4.5, 18, 7), (1.6, 1.6, 1.6), SUN)

# Tito: rig simple con un empty raíz (salto) y un empty de cuerpo (squash & stretch)
bpy.ops.object.empty_add(location=(0, 0, 0)); root = bpy.context.object; root.name = "raiz"
bpy.ops.object.empty_add(location=(0, 0, 0)); body = bpy.context.object; body.name = "cuerpo"; body.parent = root

shell = sphere("caparazon", (0, 0, 0.42), (0.95, 0.85, 0.75), SHELL, body, 32)
# cortar la mitad inferior del caparazón con un modificador boolean sería caro: lo hundimos en la banda
bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=0.1, location=(0, 0, 0.36))
band = bpy.context.object; band.scale = (1.05, 0.95, 1); band.data.materials.append(BAND); band.parent = body; smooth(band, 1)
# placas del caparazón
for (px, py, pz) in [(0, -0.55, 0.85), (-0.48, -0.42, 0.62), (0.48, -0.42, 0.62), (0, -0.2, 1.05)]:
    p = sphere("placa", (px, py, pz), (0.22, 0.12, 0.18), GREEN, body, 16)
    p.rotation_euler = (math.radians(-25), 0, 0)
# vientre
sphere("vientre", (0, 0, 0.28), (0.85, 0.75, 0.3), GREEN, body)

# cabeza (hacia la cámara, que está en -Y)
head = sphere("cabeza", (0.0, -0.95, 0.75), (0.48, 0.45, 0.46), GREEN, body, 32)
eyes = []
for sx in (-1, 1):
    e = sphere("ojo", (sx*0.19, -1.33, 0.86), (0.13, 0.08, 0.16), WHITE, body, 20)
    pu = sphere("pupila", (sx*0.18, -1.40, 0.85), (0.075, 0.05, 0.1), BLACK, body, 16)
    sphere("brillo", (sx*0.15, -1.44, 0.9), (0.025, 0.02, 0.03), WHITE, body, 12)
    eyes += [e, pu]
    sphere("mejilla", (sx*0.33, -1.27, 0.66), (0.07, 0.03, 0.05), CHEEK, body, 12)
# sonrisa
bpy.ops.mesh.primitive_torus_add(major_radius=0.11, minor_radius=0.022, location=(0, -1.39, 0.68))
sm = bpy.context.object
import bmesh
bm = bmesh.new(); bm.from_mesh(sm.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.0], context="VERTS")
bm.to_mesh(sm.data); bm.free()
sm.location.z = 0.72; sm.rotation_euler = (math.radians(90), 0, 0); sm.scale = (1, 0.6, 1)
sm.data.materials.append(BLACK); sm.parent = body
# patas
legs = []
for (lx, ly) in [(-0.6, -0.5), (0.6, -0.5), (-0.6, 0.5), (0.6, 0.5)]:
    l = sphere("pata", (lx, ly, 0.13), (0.22, 0.22, 0.17), GREEN, body, 16); legs.append(l)
# cola
sphere("cola", (0, 0.92, 0.3), (0.12, 0.2, 0.1), GREEN, body, 12)

# Animación: 36 frames, salto con anticipación, estirar y aplastar
sc.frame_start, sc.frame_end = 1, 36
sc.render.fps = 24
def key(f, z, sxy, sz, tilt=0.0):
    root.location = (0, 0, z); root.keyframe_insert("location", frame=f)
    body.scale = (sxy, sxy, sz); body.keyframe_insert("scale", frame=f)
    body.rotation_euler = (math.radians(tilt), 0, 0); body.keyframe_insert("rotation_euler", frame=f)
key(1, 0, 1.0, 1.0)
key(7, 0, 1.14, 0.78, -4)    # anticipación: se agacha
key(11, 0.55, 0.9, 1.18, 6)  # despega estirado
key(17, 1.05, 1.0, 1.02, 2)  # punto más alto
key(23, 0.35, 0.92, 1.12)    # cae estirado
key(26, 0, 1.2, 0.72)        # aterriza aplastado
key(30, 0, 0.96, 1.06)       # rebote
key(36, 0, 1.0, 1.0)
for fc in body.animation_data.action.fcurves if hasattr(body.animation_data.action, "fcurves") else []:
    for kp in fc.keyframe_points: kp.interpolation = "BEZIER"

# parpadeo
for f, s in [(1, 1), (30, 1), (32, 0.1), (34, 1)]:
    for e in eyes:
        e.scale.z = (0.16 if e.name.startswith("ojo") else 0.1) * s
        e.keyframe_insert("scale", frame=f)

# Cámara y luces
bpy.ops.object.camera_add(location=(0.8, -8.6, 2.0))
cam = bpy.context.object; sc.camera = cam
cam.data.lens = 36
d = Vector((0, 0, 1.3)) - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.light_add(type="SUN", location=(3, -4, 6))
sun = bpy.context.object; sun.data.energy = 3.2; sun.data.angle = math.radians(12)
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))
sun.data.color = (1.0, 0.95, 0.85)

world = bpy.data.worlds.new("cielo"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (*hexc("#8FD0F5"), 1); bg.inputs["Strength"].default_value = 1.1

# Render
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 24
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 4
sc.render.resolution_x, sc.render.resolution_y = 640, 360
sc.render.film_transparent = False
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT
if STILL:
    sc.frame_set(17)
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
