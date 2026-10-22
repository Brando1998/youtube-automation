"""Geometría compartida: perfiles girados (lathe), primitivas, metaballs fundidos
(regla 1: cuerpos orgánicos como una sola superficie), y el acabado estándar
(shade smooth + subsurf + contorno opcional)."""
import bmesh
import bpy
from mathutils import Matrix, Vector

from materials import outline_mat


def finish(obj, sub=2, outline=0.0):
    for p in obj.data.polygons:
        p.use_smooth = True
    if sub:
        m = obj.modifiers.new("sub", "SUBSURF")
        m.levels = sub
        m.render_levels = sub
    if outline:
        obj.data.materials.append(outline_mat())
        s = obj.modifiers.new("contorno", "SOLIDIFY")
        s.thickness = outline
        s.offset = 1
        s.use_flip_normals = True
        s.use_rim = False
        s.material_offset = len(obj.data.materials) - 1


def lathe_bm(profile, steps=64):
    """Gira un perfil (r, z) alrededor del eje Z y devuelve un bmesh."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in profile]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=6.283185307179586,
                    steps=steps, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def to_obj(name, bm, col, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    me.materials.append(mat)
    return o


def interp(pts, r):
    """z del perfil en el radio r (pts ordenados por r ascendente)."""
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if r0 <= r <= r1:
            t = (r - r0) / (r1 - r0 + 1e-9)
            return z0 + (z1 - z0) * t
    return pts[-1][1]


def new_col(name, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col


def empty(col, name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    col.objects.link(e)
    e.location = loc
    e.empty_display_size = 0.15
    if parent:
        e.parent = parent
    return e


def relink(o, col):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)


def to_mesh(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return bpy.context.view_layer.objects.active


def face(d):
    return Vector(d).normalized().to_track_quat("Z", "Y").to_euler()


def ell(col, parent, name, loc, scale, m, rot=(0, 0, 0), ol=0.0, sub=1, seg=32):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
    o = to_obj(name, bm, col, m)
    o.location = loc
    o.scale = scale
    o.rotation_euler = rot
    o.parent = parent
    finish(o, sub, ol)
    return o


def cone(col, parent, name, loc, r1, r2, depth, m, rot=(0, 0, 0), scale=(1, 1, 1), ol=0.0, seg=24):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth)
    o = to_obj(name, bm, col, m)
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    o.parent = parent
    finish(o, 1, ol)
    return o


def rbox(col, parent, name, loc, half, m, rot=(0, 0, 0), bevel=0.06, ol=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    o = to_obj(name, bm, col, m)
    o.location = loc
    o.rotation_euler = rot
    o.parent = parent
    # aplicar la escala antes del bisel para que el redondeo sea uniforme
    o.data.transform(Matrix.Diagonal((*half, 1)))
    o.scale = (1, 1, 1)
    b = o.modifiers.new("bisel", "BEVEL")
    b.width = bevel
    b.segments = 4
    b.affect = "EDGES"
    finish(o, 1, ol)
    return o


def tube(col, parent, name, pts, r, m, ol=0.0):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 4
    cu.resolution_u = 16
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu)
    col.objects.link(o)
    cu.materials.append(m)
    o = to_mesh(o)
    o.parent = parent
    for p in o.data.polygons:
        p.use_smooth = True
    if ol:
        finish(o, 0, ol)
    return o


def metaball_obj(col, name, elems, m, ol=0.0):
    """Regla 1: cuerpos orgánicos como una sola superficie fundida.
    elems: lista de (tipo, co, radio_visible, extra). Devuelve la malla ya convertida."""
    K = 0.67
    mb = bpy.data.metaballs.new(name)
    mb.resolution = 0.025
    mb.render_resolution = 0.025
    mb.threshold = 0.6
    for kind, co, r, extra in elems:
        e = mb.elements.new(type=kind)
        e.radius = r / K
        e.stiffness = 2.0
        if kind == "CAPSULE":
            p1, p2 = Vector(co), Vector(extra)
            v = p2 - p1
            e.co = (p1 + p2) / 2
            e.size_x = v.length / 2
            e.rotation = Vector((1, 0, 0)).rotation_difference(v.normalized())
        else:
            e.co = co
            if kind == "ELLIPSOID":
                e.size_x, e.size_y, e.size_z = extra
    o = bpy.data.objects.new(name, mb)
    col.objects.link(o)
    mb.materials.append(m)
    o = to_mesh(o)
    for p in o.data.polygons:
        p.use_smooth = True
    if ol:
        finish(o, 0, ol)
    return o
