"""Cálculo de bounding box (mundo) de una collection, usando la malla evaluada
(con modificadores aplicados: Subsurf, Solidify, etc.) para que sea preciso."""
import bpy
from mathutils import Vector


def _iter_mesh_objects(col, seen=None):
    seen = seen if seen is not None else set()
    for o in col.objects:
        if o.type == "MESH" and o.name not in seen:
            seen.add(o.name)
            yield o
    for child in col.children:
        yield from _iter_mesh_objects(child, seen)


def compute_bbox(col):
    """Devuelve (min: Vector, max: Vector) en espacio mundo, o None si no hay geometría."""
    deps = bpy.context.evaluated_depsgraph_get()
    mn = Vector((float("inf"),) * 3)
    mx = Vector((float("-inf"),) * 3)
    found = False
    for o in _iter_mesh_objects(col):
        eo = o.evaluated_get(deps)
        me = eo.to_mesh()
        if me is None or not me.vertices:
            if me is not None:
                eo.to_mesh_clear()
            continue
        found = True
        mw = eo.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
            mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
        eo.to_mesh_clear()
    return (mn, mx) if found else None


def size(col):
    bb = compute_bbox(col)
    if bb is None:
        return None
    mn, mx = bb
    return mx - mn
