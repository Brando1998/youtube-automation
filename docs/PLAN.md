# Plan: Biblioteca de assets 3D (Blender) → composición de escenas → video infantil

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
