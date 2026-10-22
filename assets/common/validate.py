"""Validador automático de assets (parte del contrato): tamaño razonable, origen
correcto, límite de polígonos, y sin piezas sueltas/flotando. Devuelve una lista de
strings con los problemas encontrados (vacía = asset válido)."""
import bpy
from mathutils import Vector

from bbox import compute_bbox, _iter_mesh_objects

MAX_TRIS_DEFAULT = 150_000
GROUND_TOLERANCE = 0.03  # metros: cuánto puede "flotar" la base por encima de Z=0
SINK_TOLERANCE = 0.18    # metros: cuánto se puede hundir (regla 5: bases/raíces hundidas a propósito)


def _tri_count(col):
    deps = bpy.context.evaluated_depsgraph_get()
    total = 0
    for o in _iter_mesh_objects(col):
        eo = o.evaluated_get(deps)
        me = eo.to_mesh()
        if me is not None:
            me.calc_loop_triangles()
            total += len(me.loop_triangles)
            eo.to_mesh_clear()
    return total


def _object_bbox(o, deps):
    eo = o.evaluated_get(deps)
    me = eo.to_mesh()
    if me is None or not me.vertices:
        if me is not None:
            eo.to_mesh_clear()
        return None
    mw = eo.matrix_world
    mn = Vector((float("inf"),) * 3)
    mx = Vector((float("-inf"),) * 3)
    for v in me.vertices:
        w = mw @ v.co
        mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
        mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
    eo.to_mesh_clear()
    return mn, mx


def _bbox_touch(a, b, tol):
    (amn, amx), (bmn, bmx) = a, b
    return all(amn[i] - tol <= bmx[i] and bmn[i] - tol <= amx[i] for i in range(3))


def _floating_objects(col, ground_tolerance):
    """Una pieza se considera flotando si no toca el suelo (Z~0) NI el bounding box
    de ninguna otra pieza de la collection (p.ej. el sombrero de un hongo no "flota"
    aunque esté muy por encima del suelo, porque se solapa con el tallo que sí lo toca).
    Si tiene padre dentro de la misma collection, se confía en que el padre ya la posiciona."""
    deps = bpy.context.evaluated_depsgraph_get()
    names_in_col = {o.name for o in col.objects}
    mesh_objs = [o for o in col.objects if o.type == "MESH"]
    boxes = {o.name: _object_bbox(o, deps) for o in mesh_objs}

    floating = []
    for o in mesh_objs:
        if o.parent is not None and o.parent.name in names_in_col:
            continue  # se asume que el padre (p.ej. la raíz/cuerpo) ya lo posiciona bien
        box = boxes[o.name]
        if box is None:
            continue
        mn, mx = box
        touches_ground = mn.z <= ground_tolerance
        touches_sibling = any(
            other.name != o.name and boxes[other.name] is not None
            and _bbox_touch(box, boxes[other.name], ground_tolerance)
            for other in mesh_objs
        )
        if not touches_ground and not touches_sibling:
            floating.append((o.name, round(mn.z, 4)))
    return floating


def validate_asset(col, max_tris=MAX_TRIS_DEFAULT, ground_tolerance=GROUND_TOLERANCE,
                    sink_tolerance=SINK_TOLERANCE, required_props=("tipo", "seed")):
    problems = []

    if col.asset_data is None:
        problems.append("la collection no está marcada como asset (falta col.asset_mark())")

    for key in required_props:
        if key not in col:
            problems.append(f"falta el metadato requerido '{key}'")

    bb = compute_bbox(col)
    if bb is None:
        problems.append("la collection no tiene geometría (malla) evaluable")
        return problems  # sin geometría no tiene sentido seguir validando

    mn, mx = bb
    dims = mx - mn
    if dims.x <= 0 or dims.y <= 0 or dims.z <= 0:
        problems.append(f"bounding box degenerada: {tuple(round(v, 4) for v in dims)}")
    # Tolerancia asimétrica: hundir la base a propósito está bien (regla 5, raíces/tallos
    # hundidos), lo que no está bien es que quede claramente flotando por encima del suelo.
    if mn.z < -sink_tolerance:
        problems.append(f"el asset se hunde demasiado bajo el suelo: min Z = {round(mn.z, 4)}")
    elif mn.z > ground_tolerance:
        problems.append(f"el asset no toca el suelo (Z=0): min Z = {round(mn.z, 4)}")

    tris = _tri_count(col)
    if tris > max_tris:
        problems.append(f"demasiados polígonos: {tris} > límite {max_tris}")

    floating = _floating_objects(col, ground_tolerance)
    for name, min_z in floating:
        problems.append(f"objeto posiblemente flotando: '{name}' (min Z = {min_z})")

    return problems
