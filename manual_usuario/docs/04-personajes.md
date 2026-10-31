# 4. Personajes: biblioteca vectorial

!!! warning "Este capítulo cambió — ya no se genera con IA de imagen"
    Hasta el 2026-10-31 este capítulo describía generar una "hoja" con Stability y
    recortarla en partes. Se abandonó: la hoja salía o fotorrealista o como escena
    completa, y "quitar el fondo" nunca aisló limpiamente ninguna parte (ver
    `docs/PROGRESS.md`, pivot del 2026-10-31). Ahora los personajes son **formas
    vectoriales dibujadas por código** — sin costo de AWS, consistentes por
    construcción.

## Cómo se crea un personaje nuevo

1. Describís el personaje en texto (quién es, cómo se ve, qué tono de color).
2. Se escribe un archivo `apps/remotion-ilustrado/src/library/personajes/<slug>.tsx`
   que exporta `ASSET_REF` (el id que después va a usar el episode spec, p.ej.
   `2d/personajes/tito`) y su definición, compuesta a partir de las formas
   reutilizables de `library/primitives.tsx` (cuerpo, cabeza, ojos, cejas, las 7
   bocas por visema ya resueltas con `bocasDesdeForma`, etc.) — mismo set de
   colores/trazo que el resto de la biblioteca (`library/styleTokens.ts`), para que
   todo se vea consistente.
3. Se corre `node scripts/generar_registry.mjs` (dentro de
   `apps/remotion-ilustrado/`) — reescribe `library/registry.ts` para que el nuevo
   personaje quede disponible.

## Crear la entidad y generar la vista previa

En `/app/personajes`, el formulario **"Nuevo personaje"** sigue igual: nombre y
`asset_ref` (tiene que coincidir exacto con el `ASSET_REF` del `.tsx`).

Después, se dispara un job de tipo `vector_personaje` con
`parametros.archivo` = la ruta al `.tsx` (relativa a
`apps/remotion-ilustrado/`, p.ej. `src/library/personajes/tito.tsx`). El job:

1. Regenera el registry (por si el archivo es nuevo o cambió).
2. Confirma que el `.tsx` declara el `ASSET_REF` esperado.
3. Renderiza una vista previa fija (`npx remotion still`, local, sin AWS) — el
   personaje en pose de reposo, sin animación, sobre fondo neutro.

**Sin costo, sin checkbox de "Simular"** — no hay nada que simular, es código
local.

## Revisar y aprobar

Igual que antes: panel **"Revisar y aprobar"** en `/app/personajes`, mostrando la
vista previa generada. Si no convence (proporciones, color, expresión), se ajusta
el `.tsx` y se vuelve a correr el job — no hay límite de intentos, no cuesta nada.

Una vez aprobado, el personaje queda en la biblioteca — reutilizable en cualquier
episodio que lo referencie por su `asset_ref`, sin volver a generarlo.
