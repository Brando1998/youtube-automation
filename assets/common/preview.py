"""Render de vista previa automático para cualquier asset: miniatura fija +
turntable corto (cámara orbitando), con encuadre automático según el bounding box.
Generaliza las funciones de diorama/estudio de hongo.py y zorrito.py."""
import math

import bpy
from mathutils import Vector

from bbox import compute_bbox
from color import lin
from geo import lathe_bm, to_obj
from materials import principled


def _studio_lighting(sc, target):
    world = bpy.data.worlds.new("estudio")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*lin("#EFE6D8"), 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

    def area(loc, energy, size, color):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = size
        light.data.color = color
        light.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return light

    area((3.2, -4.0, 3.6), 900, 3.0, (1.0, 0.92, 0.82))   # clave cálida
    area((-4.0, -2.0, 2.0), 260, 3.5, (0.78, 0.86, 1.0))  # relleno frío
    area((-1.0, 3.6, 3.0), 500, 2.0, (1.0, 0.96, 0.9))    # contraluz


def _ground(sc, radius):
    """Dish cóncavo simétrico en Z (perfil girado) en vez de un plano infinito:
    desde cualquier ángulo de cámara (clave para el turntable de 360°) el piso se
    curva hacia un fondo en vez de mostrar un horizonte recto."""
    mat = principled("piso_preview", "#E0D6C3", 0.9)
    R = radius * 7
    profile = [(0, -0.02), (R * 0.55, -0.02), (R * 0.7, 0.0), (R * 0.85, R * 0.3),
               (R * 0.95, R * 0.75), (R, R * 1.3)]
    bm = lathe_bm(profile, 64)
    o = to_obj("piso_preview", bm, bpy.context.scene.collection, mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def _frame_camera(col, sc, angle_deg=35.0, elevation_deg=22.0, lens=50):
    bb = compute_bbox(col)
    if bb is None:
        center, radius = Vector((0, 0, 0.5)), 1.0
    else:
        mn, mx = bb
        center = (mn + mx) / 2
        radius = max((mx - mn).length / 2, 0.05)

    dist = radius * 3.2
    az, el = math.radians(angle_deg), math.radians(elevation_deg)
    cam_loc = center + Vector((
        dist * math.cos(el) * math.sin(az),
        -dist * math.cos(el) * math.cos(az),
        dist * math.sin(el) + radius * 0.15,
    ))
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    cam.data.lens = lens
    cam.rotation_euler = (Vector(center) - cam_loc).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    return cam, center, radius


def _render_settings(sc, res, fast, view_transform, look):
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 16 if fast else 64
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 12
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = view_transform
    sc.view_settings.look = look


def render_preview(col, out_thumb, out_turntable=None, fast=True, turntable_frames=48,
                    res=(960, 960), turntable_res=(480, 480), view_transform="AgX", look="AgX - Punchy"):
    """Arma un mini-estudio alrededor de `col`, renderiza una miniatura fija en
    `out_thumb` (calidad según `fast`) y, si se da `out_turntable`, una vuelta de
    cámara corta (mp4) — el turntable siempre usa pocas muestras/resolución reducida
    porque son muchos frames (48 a calidad de miniatura sería demasiado lento en CPU)."""
    sc = bpy.context.scene
    cam, center, radius = _frame_camera(col, sc)
    _ground(sc, radius)
    _studio_lighting(sc, center)

    _render_settings(sc, res, fast, view_transform, look)
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = out_thumb
    sc.frame_set(1)
    bpy.ops.render.render(write_still=True)

    if out_turntable:
        pivot = bpy.data.objects.new("turntable_pivot", None)
        bpy.context.scene.collection.objects.link(pivot)
        pivot.location = center
        cam_offset = cam.location - center
        cam.parent = pivot
        cam.location = cam_offset

        sc.frame_start, sc.frame_end = 1, turntable_frames
        sc.render.fps = 24
        prev_interp = bpy.context.preferences.edit.keyframe_new_interpolation_type
        bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
        pivot.rotation_euler = (0, 0, 0)
        pivot.keyframe_insert("rotation_euler", frame=1)
        pivot.rotation_euler = (0, 0, 2 * math.pi)
        pivot.keyframe_insert("rotation_euler", frame=turntable_frames)
        bpy.context.preferences.edit.keyframe_new_interpolation_type = prev_interp

        _render_settings(sc, turntable_res, True, view_transform, look)
        sc.render.image_settings.file_format = "FFMPEG"
        sc.render.ffmpeg.format = "MPEG4"
        sc.render.ffmpeg.codec = "H264"
        sc.render.ffmpeg.constant_rate_factor = "MEDIUM"
        sc.render.filepath = out_turntable
        bpy.ops.render.render(animation=True)
