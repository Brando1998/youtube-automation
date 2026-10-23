# Plan: Pipeline de episodios infantiles — dos estilos visuales (3D y 2.5D ilustrado)

> **Actualización (tercer cambio de alcance):** el proyecto ahora tiene DOS estilos de
> producción, elegibles por episodio — "3d" (todo lo de este documento hasta la sección
> "Extensión") y "ilustrado" (2.5D con Remotion, ver sección **"Extensión: estilo
> ilustrado 2.5D"** al final). El estilo ilustrado sale primero a producción por ser más
> rápido; el 3D sigue su curso en paralelo, sin abandonarse. Todo lo de abajo hasta la
> Extensión sigue vigente tal cual para el estilo "3d".

## Contexto

Segundo cambio de estrategia sobre la animación 3D: en vez de modelar cada escena desde cero (plan anterior), se construye primero una **biblioteca de assets 3D reutilizables** (vegetación, terreno, personajes), y las escenas se componen instanciando esos assets — así trabajan los estudios de animación, y además es el diseño correcto para que Claude orqueste: su trabajo pasa a ser "elegir qué assets usar y dónde colocarlos" (un scene spec sobre un catálogo conocido), no "inventar geometría" en cada render.

Referencias revisadas:
- **`/home/brando/Downloads/hongo (1).py`** (→ se migrará a `docs/reference/hongo.py`): primer asset terminado, es el patrón de calidad y de código a seguir. Produce un hongo completo (sombrero con borde, láminas, manchas en relieve, tallo con anillo y base) vía perfiles girados (`lathe_bm`), materiales en degradado con ruido/relieve (`ramp_mat`), y contorno de caricatura real (`outline_mat`, ver regla 2). El render (`hongo-final.png`) confirma el nivel visual objetivo.
- **`/home/brando/Downloads/zorrito (1).py`** (→ se migrará a `docs/reference/zorrito.py`), con `zorrito-vestido.png` como render de referencia: **ya resuelve el método de cuerpo fundido** (regla 1) — pelaje, máscara clara y calcetines son cada uno una sola superficie fundida vía `metaball_obj()` (elementos `BALL`/`CAPSULE`/`ELLIPSOID`), no piezas sueltas. También separa personaje y accesorios (bufanda, mochila) como collections independientes con **anclas** (`ancla_cuello`, `ancla_espalda`) donde "vestir" los accesorios — el propio script ya anota que esas anclas "luego serán huesos del rig", anticipando la Fase 5. Importa utilidades directamente de `hongo.py` (`lin, principled, ramp_mat, finish, lathe_bm, to_obj, arg`), lo que confirma que extraerlas a un módulo común (Fase 1) es necesario: hoy un script de personaje depende de uno de vegetación. Tiene errores visuales de proporción/acabado según el propio usuario — se usa como referencia **técnica** (metaballs, anclas, separación personaje/accesorios), no como versión final del zorrito. También confirma el riesgo de la regla 4: la hebilla roja de la correa de la mochila en `zorrito-vestido.png` es exactamente el tipo de detalle decorativo ambiguo a evitar.

**Reglas del proyecto (de las lecciones ya aprendidas) — aplican a todos los assets:**
1. Cuerpos orgánicos (personajes, animales) = **una sola superficie fundida** (metaballs convertidos a malla). Piezas sueltas se ven desconectadas.
2. Contorno de caricatura = Solidify con normales invertidas + material visible solo para rayos de cámara (`Light Path → Is Camera Ray`, exactamente como `outline_mat()` en `hongo.py`). Sin esto el casco bloquea la luz y el objeto sale negro. Solo en siluetas grandes, no en detalles pequeños.
3. Formas: perfiles girados (`lathe`) + ruido sutil para lo orgánico. Nunca esferas aplastadas como solución final.
4. Menos detalle sintético: ojos simples, evitar piezas decorativas ambiguas.
5. Todo apoyado en el suelo: bases ensanchadas, nada flotando.

**Como antes: cero gasto de AWS en estas fases sin tu aprobación explícita.** Todos los renders de prueba son locales, CPU, pocas muestras.

## Contrato de cada asset

- Función generadora: `crear_<asset>(seed, escala, ...variaciones)` → devuelve una **Collection**. Mismo patrón que `crear_hongo()`.
- **Determinista**: mismo seed → mismo resultado (`random.Random(seed)`, como ya hace `hongo.py`).
- Origen en la base del objeto, apoyado en Z=0, unidades en metros, mirando hacia -Y.
- Collection marcada como asset de Blender (`col.asset_mark()`) con metadatos: `tipo` (p.ej. `"vegetacion/hongo"`), `seed`, `version`, `bbox` (tamaño aproximado — hay que añadir cálculo de bounding box, `hongo.py` aún no lo guarda).
- Materiales desde una **paleta compartida del proyecto** (generalizar el patrón `mats(tono)` de `hongo.py` a un módulo común, no repetido por asset).
- **Validación automática**: tamaño razonable, origen correcto, límite de polígonos, sin piezas sueltas/flotando (ningún objeto de la colección con su mínimo en Z muy por encima de 0, salvo que esté explícitamente parentado a algo que sí toca el suelo).
- **Render de vista previa automático**: miniatura fija + turntable corto (unas pocas vueltas de cámara, pocas muestras) — generalizar la escena de diorama que ya tiene `hongo.py` (terreno, luces de 3 puntos, cámara con DOF) a una utilidad reusable para cualquier asset, no solo hongos.

## Decisión a confirmar en Fase 1: transform de vista

`hongo.py` usa `AgX` / `AgX - Punchy` (colores más vívidos); el script de personaje anterior (`escena.py`, el salto de "Tito") usaba `Standard`. Como `hongo-final.png` es la referencia de calidad aprobada, **recomiendo estandarizar todo el proyecto en `AgX - Punchy`** y es lo que usaré salvo que me digas lo contrario — esto afecta cómo se ven todos los colores hex definidos después, así que lo dejo como primer punto a validar con el render de Fase 1.

## Fases

### Fase 1 — Fundamentos (siguiente paso inmediato)
- Extraer de `hongo.py` **y de `zorrito.py`** lo reutilizable a módulos comunes (hoy `zorrito.py` depende de `hongo.py` directamente vía import — hay que romper esa dependencia cruzada):
  - `common/color.py` (`lin`/hex→lineal)
  - `common/materials.py` (`principled`, `ramp_mat`, `outline_mat`)
  - `common/geo.py` (`lathe_bm`, `to_obj`, `interp`, `finish`, y de `zorrito.py`: `ell`, `cone`, `rbox`, `tube`, `metaball_obj`, `empty`, `relink`, `face`, `new_col`)
  - `common/palette.py` (paleta compartida del proyecto, generalizando `mats()` / `mat_zorro()`)
- `common/validate.py`: el validador automático descrito arriba.
- `common/preview.py`: miniatura + turntable corto, generalizado de las funciones de estudio/diorama de `hongo.py` y `zorrito.py` (`estudio()`).
- `common/bbox.py`: cálculo de bounding box para los metadatos del asset.
- **Migrar `hongo.py` al nuevo formato usando estos módulos comunes** — primer asset validado bajo el nuevo contrato. Te entrego su render de vista previa (miniatura + turntable) para tu visto bueno antes de seguir.
- `zorrito.py` **no se migra todavía** (es Fase 5, personajes) — pero su método de metaballs y su sistema de anclas quedan documentados como el patrón a seguir cuando llegue esa fase.

### Fase 2 — Biblioteca de entorno
Un asset a la vez, cada uno con su render de vista previa para tu aprobación antes de pasar al siguiente: hongo (ya migrado en Fase 1), árbol, arbusto, roca, flor, pasto, piedras de camino, cerca, nube, montaña lejana. Todos con variaciones por seed, todos sobre el contrato de la sección anterior.

### Fase 3 — Catálogo
Un `.blend` por categoría con las variantes generadas, más un **catálogo JSON** (id, tipo, tags, tamaño/bbox, seed, ruta de miniatura) que Claude pueda consultar al componer escenas — este catálogo es la interfaz entre "biblioteca de assets" y "composición de escenas".

### Fase 4 — Compositor de escenas
A partir de un **scene spec JSON** (generado por Claude a partir del guion), coloca **instancias** de los assets del catálogo (linked/collection instances — nunca copias duplicadas) con: distribución automática de vegetación, reglas de no-flotar / no-atravesarse, y respeto de caminos/zonas libres definidas en el spec.

### Fase 5 — Personajes
Generador de personajes con el método de **cuerpo fundido** (metaballs → malla, regla 1), rig automático (huesos colocados según las posiciones de extremidades que vengan en el spec del personaje) y una **biblioteca de animaciones base** sobre ese rig (reemplaza el enfoque de rig de 2 empties del plan anterior — ahora el rig es consistente con el método de cuerpo fundido). Aquí se retoma todo lo ya diseñado de voz + lip sync (Polly visemes / Rhubarb) y biblioteca de acciones reutilizable del plan previo, adaptado al nuevo rig.

### Fase 6 — Solo después: animación de escenas completas, render en AWS, pipeline de video
Aquí se retoman, sin cambios de fondo respecto al plan anterior (ya investigado y documentado):
- **Render AWS**: AWS Batch + GPU spot (g5/g6) sobre EC2 manual, por el control de costo garantizado (timeout nativo de job + budget action + alarma) — requiere tu aprobación explícita antes de provisionar nada.
- **Composición final**: Remotion ligero (subtítulos, intro/outro, 16:9/9:16) sobre los renders ya generados.
- **Publicación**: YouTube con `selfDeclaredMadeForKids=true`; TikTok/Meta sin flag único de cumplimiento infantil (autogestión de categorías/contenido); gate de aprobación manual antes de publicar en cualquier plataforma.
- **Web app**: FastAPI + frontend ligero, login con bcrypt + sesión segura, progreso en vivo, desplegado en EC2 + Docker Compose + nginx/certbot (patrón de `Docubot`) pero con IAM role de instancia para Bedrock/S3/Batch en vez de claves planas.

## Verificación

- Fase 1: render de vista previa (miniatura + turntable) del hongo migrado, comparado visualmente contra `hongo-final.png` — deben verse equivalentes. Confirmar que el validador detecta correctamente un caso roto a propósito (ej. un objeto flotando) antes de confiar en él.
- Fase 2: cada asset nuevo se aprueba individualmente antes de avanzar al siguiente (regla explícita tuya — no se avanza sin visto bueno).
- Fase 3: consultar el catálogo JSON manualmente y confirmar que los metadatos (tipo, tags, bbox) son suficientes para que Claude elija assets con sentido.
- Fase 4: una escena compuesta con 5-10 instancias de assets distintos, confirmar visualmente que nada flota ni se atraviesa.
- Fase 5: un personaje de prueba con el método de cuerpo fundido, confirmar que no se ve como piezas desconectadas (regla 1) y que el rig automático queda en las posiciones correctas.
- Fase 6: igual que el plan anterior (no listado en YouTube primero, tester/admin en Meta durante revisión, borrador en TikTok).

## Archivos/rutas críticas

- `docs/reference/hongo.py`, `docs/reference/hongo-final.png`, `docs/reference/zorrito.py`, `docs/reference/zorrito-vestido.png` — referencias de estilo.
- `assets/common/{color,materials,geo,palette,validate,preview,bbox}.py` — fundamentos compartidos (Fase 1).
- `assets/vegetacion/hongo.py` (migrado), `arbol.py`, `arbusto.py`, `roca.py`, `flor.py`, `pasto.py`, `piedras_camino.py`, `cerca.py`, `nube.py`, `montana.py` (Fase 2).
- `assets/catalogo.json` + `.blend` por categoría (Fase 3).
- `scenes/compositor.py` (Fase 4).
- `characters/builder.py`, `characters/rig.py`, `characters/acciones/*.py` (Fase 5).
- `apps/web/`, `packages/publish/`, `packages/lipsync/` — retomados del plan anterior (Fase 6).

---

# Extensión: estilo ilustrado 2.5D (Remotion)

## Contexto

El estilo "3d" (todo lo anterior) sigue vigente y no se toca. Se agrega un segundo
estilo, **"ilustrado"**: ilustración tipo cómic separada en capas, animada en Remotion
con cámara 2.5D (parallax por profundidad), más rápido de producir que el 3D. El
usuario elige el estilo por episodio. El estilo ilustrado sale primero a producción.

**Referencia de estilo y técnica**: `docs/reference/cabana-lucia.html` (copiar desde
`/home/brando/Downloads/cabana-lucia.html`) — demo funcional en SVG+Canvas+JS que ya
resuelve, de forma 100% determinista por número de frame (requisito de Remotion):
cámara 2.5D por capa (`camFor(d)`, cada capa `Lx` tiene una profundidad `d` y se mueve
proporcional a ella), luces con parpadeo por ruido (linterna, ventana, luna), personaje
animado por partes (respiración = traslación senoidal, parpadeo = escala por tramos,
mirada/giro de cabeza = rotación con `smooth()` ante un evento, balanceo de la linterna
= rotación senoidal), partículas (luciérnagas con deriva+brillo), humo (bocanadas con
edad cíclica `(frame+i*L/26)%L`), niebla en capas, lluvia+relámpago sincronizados a
palabras de la narración, gradación de color + viñeta + grano, y subtítulos palabra por
palabra con resaltado de palabras clave. Todo se traduce directo a componentes Remotion
(`useCurrentFrame()` en vez de `frame` global, mismas fórmulas). **La demo es de
misterio solo como ejemplo técnico — los presets por defecto del proyecto deben ser
amigables para niños, sin nada tipo terror.**

## Hallazgo de investigación: generación de imágenes en Bedrock (Oct 2026)

Verificado antes de asumir nada, como se pidió:
- **Titan Image Generator** (Amazon): fin de vida 30 jun 2026 — ya no funciona.
- **Nova Canvas** (Amazon): fin de vida 30 sep 2026 — ya no funciona.
- **Ningún modelo de imagen propio de Amazon funciona hoy en Bedrock.**
- **Opción viable: Stability AI** (Stable Image Ultra, Core, SD3.5 Large) vía Bedrock,
  disponible en `us-east-1`, `us-east-2`, `us-west-2`. Precio: Ultra ~$0.08/imagen,
  Core ~$0.03/imagen. Licencia Community de Stability: **gratuita para uso comercial
  por debajo de $1M/año de ingresos** (aplica a este proyecto). También ofrece ~13
  "primitivas" de edición (inpaint, erase/fondo transparente, outpaint, search-and-
  recolor, upscale) útiles para el pipeline de partes de personaje.
- Esto reemplaza cualquier supuesto anterior sobre Titan/Nova Canvas en el plan previo.

## Arquitectura compartida entre los dos estilos

1. **Episode spec (JSON, independiente del estilo)**: Claude convierte el guion en un
   spec con escenas → tomas → líneas (hablante, texto, voz asignada, emoción opcional)
   → eventos (p.ej. "en la palabra X → relámpago") → duración. Campo `estilo`: `"3d"` |
   `"ilustrado"`, elegido por episodio. El mismo spec debe poder renderizarse con
   cualquiera de los dos estilos (los campos específicos de estilo quedan bajo una
   sub-clave `render.3d` / `render.ilustrado` por toma).
2. **Interfaz `Renderer`**: `render(spec) -> video`, dos implementaciones:
   - `BlenderRenderer` (ya planeado arriba, Fases 2-6, sin cambios).
   - `RemotionIllustratedRenderer` (nuevo, esta extensión).
3. **Modo de voz** (por episodio, campo `modo_voz`): `"narrador"` | `"dialogos"` |
   `"mixto"`. Cada línea del spec trae `hablante` (`"narrador"` o id de personaje),
   `texto`, `voz`, `emocion` opcional.
4. **Voz y lip sync (compartido entre estilos)**:
   - TTS: **Amazon Polly**, una voz por personaje + una para narrador, con
     `SpeechMarkTypes=["word","viseme"]` (palabra → subtítulos/eventos; visema → lip
     sync). *(Esto genera costo AWS — pedir aprobación antes de la primera llamada real.)*
   - Audio grabado: **Whisper** para tiempos de palabra, **Rhubarb Lip Sync** para
     formas de boca — ya investigado y vigente del plan original, sin cambios.
   - Hablando un personaje: lip sync + gesto sutil + subtítulo con color del personaje
     (o globo de diálogo, configurable). Hablando el narrador: subtítulos palabra por
     palabra estilo la demo.

## Assets del estilo ilustrado (categoría nueva `"2d"` en la misma biblioteca)

Mismo espíritu de contrato que los assets 3D (determinista, con metadatos, con
aprobación manual antes de usarse) pero para recursos 2D:

- **Personajes como "puppets" por partes**: cuerpo, cabeza, ojos abiertos/cerrados,
  cejas, bocas por visema (mínimo: reposo, A, E, O, M/B/P, F/V, L — igual que Rhubarb),
  brazos/objetos con punto de pivote. Se guarda un JSON por personaje: lista de partes
  (imagen, pivote, orden de capa).
- **Flujo propuesto para construir un personaje** (a partir del arte que sube el
  usuario), con aprobación tuya en cada paso:
  1. Subes una imagen/boceto de referencia.
  2. Claude (visión, Bedrock) + un **style guide del proyecto** (prompt base, paleta,
     grosor de línea — para que todo el arte generado se vea consistente) genera una
     "hoja de personaje" limpia vía Stability **image-to-image** condicionada a tu
     boceto (conserva pose/parecido, aplica el estilo). **Apruebas la hoja antes de
     seguir.**
  3. Cada parte requerida (cuerpo, cabeza, ojos, cejas, bocas por visema, props con
     pivote) se genera como su **propia llamada** de image-to-image/inpaint sobre la
     hoja aprobada, con fondo transparente (primitiva "erase"/background removal de
     Stability) — **recomendado en vez de segmentar la hoja completa con un modelo tipo
     SAM**, porque evita auto-hospedar un segmentador aparte (SAM es open-source/Apache
     2.0 pero necesita su propia GPU) y da más control por parte. Documento SAM como
     alternativa futura si la calidad de generar-por-parte no alcanza, no como el
     camino por defecto.
  4. Validador equivalente al de assets 3D (fondo transparente real, tamaño razonable,
     todas las partes requeridas presentes) + render de vista previa (la hoja completa
     armada) para tu aprobación antes de usar el personaje en cualquier escena.
- **Fondos en capas** (cielo, lejano, medio, suelo, primer plano — como `L0`-`L5` de la
  demo), cada capa con su profundidad y sus puntos de luz/emisión de partículas
  (chimenea, ventana, etc.) marcados en el JSON de la capa.
- Todo esto vive en `assets/2d/personajes/`, `assets/2d/fondos/`, con su propio
  catálogo JSON — mismo rol que el catálogo 3D de la Fase 3, pero para este estilo.

## Biblioteca de efectos Remotion (nueva, Node/TypeScript)

Primer código Node/TS del proyecto (todo lo anterior es Python/bpy) — vive en algo como
`apps/remotion-ilustrado/`. Componentes, mapeados 1:1 desde la demo:

| Componente | De la demo | Config desde el spec |
|---|---|---|
| `Camera2D` | `camFor(d)`, `withCam` | zoom base, golpe de zoom por evento |
| `ParallaxLayer` | `LAYERS`, transform por capa | profundidad `d` por capa |
| `FlickerLight` | `fl(f,s)`, luz de linterna/ventana/luna | posición, color, intensidad base |
| `Particles` | `FLIES` (luciérnagas) | preset: luciérnagas/brasas/nieve/polvo |
| `Smoke` | bocanadas de humo cíclicas | origen, intensidad |
| `Fog` | `FOGS` en 2 capas | profundidades, velocidad |
| `Rain` | `DROPS` | intensidad, ángulo |
| `Lightning` | `BOLT`/`BRANCH`, destello sincronizado | palabra(s) disparadoras |
| `ColorGrade` | filtro CSS + viñeta radial | preset del style guide |
| `Grain` | `GRAIN` (ruido animado) | intensidad |
| `Captions` | `caption(f)`, resaltado de clave | lista de palabras+tiempos del spec |
| `SpeechBubble` | (nuevo, no está en la demo) | color por personaje, texto |
| `CharacterPuppet` | `breath`/`swing`/`pony`/`head`/`eyes`/`brows` | partes del puppet + eventos de lip sync |

Todo configurable por toma desde el spec, con eventos atados a palabras (igual que
`LIGHT=[at("NOCHE"), ...]` en la demo). Salida en 16:9 y 9:16 desde el mismo spec.
**Presets por defecto amigables para niños** (sin preset de "terror" aunque la demo lo
use como ejemplo).

## Fases propuestas (estilo ilustrado)

| Fase | Qué incluye | Costo AWS |
|---|---|---|
| **A1** | Copiar `cabana-lucia.html` a `docs/reference/`; definir el **episode spec** (JSON) compartido entre estilos | Ninguno |
| **A2** | Style guide del proyecto (prompt base, paleta, grosor de línea) — propuesta para tu aprobación antes de generar nada | Ninguno |
| **A3** | Scaffold de `apps/remotion-ilustrado/` + componentes base (`Camera2D`, `ParallaxLayer`, `Captions`) portados de la demo | Ninguno |
| **A4** | Pipeline de personaje 2D: 1 personaje de prueba desde una imagen tuya → hoja → partes → aprobación | **Sí** (Stability image-gen, ~$1-2 para un personaje completo) — pregunto antes de la primera llamada |
| **A5** | Fondo en capas para la escena de prueba (5 capas) | **Sí** (Stability, similar costo bajo) — mismo aviso |
| **A6** | Voz: narrador + 1 línea de diálogo con lip sync para la escena de 15s | **Sí** (Polly, costo mínimo, fracciones de centavo) — mismo aviso |
| **A7** | Componer y renderizar localmente la escena de 15s completa (modo mixto, narrador + diálogo con lip sync) — recorrido de punta a punta | Ninguno (render es local) |

No se avanza de fase sin visto bueno explícito, igual que en el estilo 3D. El trabajo
3D (Fases 1-6 de arriba) sigue su curso en paralelo sin interrupciones.

## Qué se comparte vs. qué es nuevo

**Compartido** (una sola vez, sirve para ambos estilos): episode spec + su generación
con Claude, modo de voz, Polly+Whisper+Rhubarb, la disciplina de aprobación manual por
asset, estructura general del repo (`docs/PROGRESS.md` sigue siendo el registro único).

**Nuevo, solo para "ilustrado"**: categoría de asset `"2d"` (personajes-puppet +
fondos en capas), pipeline de generación de imágenes (Stability vía Bedrock), style
guide del proyecto, y toda la app Remotion/Node (primer código no-Python del repo).

## Verificación

- A3: los componentes base renderizan localmente (Remotion Studio o render directo) con
  datos de prueba, sin depender todavía de assets generados.
- A4: la hoja de personaje y cada parte se revisan visualmente contra el style guide
  antes de aprobarse; el validador confirma fondo transparente real y partes completas.
- A7: reproducir el mp4 de 15s y confirmar sincronía de labios en la línea de diálogo,
  subtítulos palabra por palabra correctos, y que los efectos (parallax mínimo, al
  menos) se vean coherentes con la demo de referencia.

## Archivos/rutas críticas (ilustrado)

- `docs/reference/cabana-lucia.html` — referencia de técnica y estilo.
- `episode_spec/schema.json` (o similar) — spec compartido entre estilos.
- `assets/2d/personajes/<nombre>/{hoja.png, partes/*.png, puppet.json}`
- `assets/2d/fondos/<nombre>/{capas/*.png, fondo.json}`
- `assets/2d/catalogo.json`
- `apps/remotion-ilustrado/src/components/{Camera2D,ParallaxLayer,FlickerLight,Particles,Smoke,Fog,Rain,Lightning,ColorGrade,Grain,Captions,SpeechBubble,CharacterPuppet}.tsx`
- `style_guide.json` (prompt base, paleta, grosor de línea)
