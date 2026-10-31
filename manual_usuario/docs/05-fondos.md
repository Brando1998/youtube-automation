# 5. Fondos y objetos: biblioteca vectorial

!!! warning "Este capítulo cambió — ya no se genera con IA de imagen"
    Mismo cambio que los personajes (ver capítulo anterior) — los fondos (y los
    objetos/props reutilizables) también pasaron a ser formas vectoriales por
    código, sin costo de AWS.

## Fondos

En `/app/fondos`, igual que antes: **nombre** + **asset_ref** (p.ej.
`2d/fondos/bosque`, tiene que coincidir con el `ASSET_REF` del `.tsx`).

El fondo se escribe en `apps/remotion-ilustrado/src/library/fondos/<slug>.tsx` —
una lista de capas (cielo, lejano, medio, cabaña, ...) cada una compuesta con las
formas de `library/primitives.tsx` (árboles, colinas, techo, ventana encendida,
...), con profundidad (`depth`) por capa para el efecto de cámara 2.5D, igual que
siempre.

El job que genera la vista previa es `vector_fondo` (mismo mecanismo que
`vector_personaje` del capítulo 4: regenera el registry, confirma el
`ASSET_REF`, renderiza con `npx remotion still` — cero AWS). Se aprueba desde el
mismo panel "Revisar y aprobar".

## Objetos (nuevo)

Categoría nueva para props reutilizables que no son ni un personaje completo ni
un fondo — un farol, una bellota, una mochila. Viven en
`/app/objetos` (mismo patrón de nombre + `asset_ref`) y en
`apps/remotion-ilustrado/src/library/objetos/<slug>.tsx`. Un objeto se puede usar
como `prop` de un personaje (lo que sostiene en la mano) o insertado directo en
una capa de fondo. El job es `vector_objeto`, misma mecánica que los otros dos.

## Por qué esto es mejor que antes

Antes, cada fondo nuevo eran 2 llamadas a Stability por capa (texto-a-imagen +
quitar fondo) — plata real, y el estilo podía variar de una capa a otra. Ahora
cada capa nueva reusa las mismas formas/paleta que ya existen en la biblioteca —
consistente por construcción, y gratis.
