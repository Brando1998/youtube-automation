"""Paleta compartida del proyecto: listas de paradas de color (ramp stops) por nombre,
para que todos los assets usen las mismas familias de color en vez de definir las suyas
sueltas. Generaliza el dict `caps` de hongo.py y `mat_zorro()` de zorrito.py.

Cada entrada es una lista de (posicion, hex) apta para materials.ramp_mat(..., stops=...).
"""

PALETTE = {
    # --- vegetación: sombreros de hongo ---
    "hongo_rojo": [(0.0, "#E8452A"), (0.5, "#C8201C"), (1.0, "#7E0E14")],
    "hongo_naranja": [(0.0, "#F7A44A"), (0.45, "#EC7A2C"), (1.0, "#B4471A")],
    "hongo_lila": [(0.0, "#C79BE6"), (0.45, "#9A63CF"), (1.0, "#64379A")],
    "hongo_mancha": [(0.0, "#F3EADB"), (1.0, "#FFFDF7")],
    "hongo_laminas": [(0.0, "#D9C2A6"), (1.0, "#F1E3CF")],
    "hongo_tallo": [(0.0, "#D8C7AE"), (0.35, "#F2E7D6"), (1.0, "#FBF5EA")],

    # --- vegetación: árbol ---
    "arbol_copa_verde": [(0.0, "#3E7A34"), (0.55, "#59A04A"), (1.0, "#7FC262")],
    "arbol_copa_otono": [(0.0, "#B4541F"), (0.5, "#D98A2E"), (1.0, "#EFC24B")],
    "arbol_tronco": [(0.0, "#4A3421"), (0.4, "#6B4B2A"), (1.0, "#8A6238")],

    # --- terreno / diorama ---
    "tierra": "#5B3B28",
    "musgo": [(0.0, "#4E8A35"), (0.5, "#6FAA45"), (1.0, "#8DC25A")],
    "pasto": "#5E9E3E",
    "piedrita": [(0.0, "#8A8F96"), (1.0, "#B9BDC2")],

    # --- personaje: zorrito ---
    "zorro_pelaje": [(0.0, "#C9561C"), (0.55, "#E8742A"), (1.0, "#F08A3A")],
    "zorro_crema": [(0.0, "#F3E3CC"), (1.0, "#FFF6E9")],
    "zorro_oscuro": [(0.0, "#3A2219"), (1.0, "#5E3A28")],
    "zorro_oreja_interior": "#F2A894",
    "zorro_ojo": "#15101A",
    "zorro_nariz": "#241717",
    "zorro_rubor": "#FF8F8F",

    # --- accesorios ---
    "bufanda_a": "#2F8F86",
    "bufanda_b": "#F2C14E",
    "mochila_lona": [(0.0, "#9C6237"), (1.0, "#B57745")],
    "mochila_cuero": [(0.0, "#5E3820"), (1.0, "#774A2B")],
    "mochila_laton": "#E2B44C",
    "mochila_manta": [(0.0, "#B93A33"), (0.5, "#D9574E"), (1.0, "#B93A33")],
}


def stops(key):
    """Devuelve la lista de paradas para ramp_mat(); si la entrada es un solo hex,
    la convierte en una rampa plana de dos puntos iguales."""
    v = PALETTE[key]
    if isinstance(v, str):
        return [(0.0, v), (1.0, v)]
    return v


def hexcolor(key):
    """Para materiales planos (principled): toma el primer color de la entrada."""
    v = PALETTE[key]
    return v if isinstance(v, str) else v[0][1]
