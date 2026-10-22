"""Materiales compartidos: Principled BSDF plano, degradado con ruido/relieve, y el
contorno de caricatura (regla 2: casco con normales invertidas + visible solo a cámara)."""
import bpy

from color import lin


def principled(name, hexcol, rough=0.6, coat=0.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*lin(hexcol), 1)
    b.inputs["Roughness"].default_value = rough
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (0.4, 0.15, 0.1)
        b.inputs["Subsurface Scale"].default_value = 0.05
    return m


def ramp_mat(name, stops, coord="Generated", axis="Z", rough=0.5, coat=0.0, sss=0.0,
             noise_amt=0.08, noise_scale=6.0, bump=0.0, bump_scale=30.0, stretch=None):
    """Color en degradado a lo largo de un eje, con ruido y relieve opcional."""
    m = principled(name, "#FFFFFF", rough, coat, sss)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = noise_scale
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = noise_amt
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*lin(stops[0][1]), 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*lin(stops[-1][1]), 1)
    for pos, col in stops[1:-1]:
        e = cr.elements.new(pos)
        e.color = (*lin(col), 1)
    nt.links.new(tc.outputs[coord], sep.inputs[0])
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], add.inputs[0])
    nt.links.new(sep.outputs[axis], add.inputs[2])
    nt.links.new(add.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    if bump:
        if stretch:  # fibras alargadas (p.ej. tallo)
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = stretch
            nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
            src = mp.outputs[0]
        else:
            src = tc.outputs["Object"]
        bn = nt.nodes.new("ShaderNodeTexNoise")
        bn.inputs["Scale"].default_value = bump_scale
        bn.inputs["Detail"].default_value = 6
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        nt.links.new(src, bn.inputs["Vector"])
        nt.links.new(bn.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def outline_mat():
    """Regla 2: casco (Solidify, normales invertidas) visible SOLO para rayos de cámara.
    Sin el mix por Light Path -> Is Camera Ray, el casco bloquea la luz y el objeto sale negro."""
    m = bpy.data.materials.get("contorno")
    if m:
        return m
    m = bpy.data.materials.new("contorno")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*lin("#2B1B14"), 1)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(geo.outputs["Backfacing"], mix.inputs["Fac"])
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr2 = nt.nodes.new("ShaderNodeBsdfTransparent")
    cam = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], cam.inputs["Fac"])
    nt.links.new(tr2.outputs[0], cam.inputs[1])
    nt.links.new(mix.outputs[0], cam.inputs[2])
    nt.links.new(cam.outputs[0], out.inputs["Surface"])
    return m
