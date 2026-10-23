# Estado del proyecto — léeme primero

Este archivo existe para que cualquier sesión nueva (sin el contexto de esta conversación)
pueda retomar el trabajo. El plan completo y las decisiones de arquitectura están en
`docs/PLAN.md` — este archivo es solo el "dónde vamos" y el registro de decisiones.

**Repo**: git inicializado localmente, rama de trabajo `dev` (nunca se hace commit/merge a
`main` sin aprobación explícita del usuario, por instrucción global del usuario).

## 🔴 Bloqueado: falta infraestructura AWS (EC2 + IAM role)

El usuario pidió avanzar con todas las fases restantes (A4-A7), pero **esta máquina no
tiene ninguna credencial de AWS configurada** (sin `~/.aws/`, sin env vars, sin AWS
CLI). El plan siempre fue usar IAM role de instancia EC2 en vez de claves planas, y el
usuario confirmó que va a desplegar en EC2 — así que el orden real es: **primero la
instancia, después Fase A4+**.

**Guía de provisión escrita en `docs/EC2_SETUP.md`** (IAM role con permisos mínimos a
Bedrock/Polly, instancia `t3.medium` en `us-east-1`, security group, Elastic IP —
importante porque la instancia se prende/apaga a diario). **Sin bucket S3 por decisión
del usuario** (no quiere pagar por eso todavía) — los assets generados se guardan en el
volumen EBS de la instancia; se puede agregar S3 más adelante sin romper nada. **La
ejecuta el usuario** en su cuenta AWS (eligió esa opción explícitamente sobre dármela a
mí o sobre un IAM user acotado). Sin esto no se puede seguir con A4 (Stability), A5
(Stability) ni A6 (Polly) — A1-A3 ya están hechas y no dependen de AWS.

**Próximo paso real**: esperar a que el usuario provisione la instancia según
`docs/EC2_SETUP.md` y me dé acceso para desplegar (SSH, o que corra él los comandos).

## ⚠️ Cambio de alcance mayor: dos estilos visuales en paralelo

El proyecto ahora tiene **dos estilos de producción elegibles por episodio**: "3d"
(todo lo de abajo, sin cambios) e **"ilustrado"** (2.5D con Remotion — nuevo, ver
`docs/PLAN.md` sección "Extensión: estilo ilustrado 2.5D"). El estilo ilustrado sale
**primero** a producción por ser más rápido de hacer; el 3D sigue en paralelo, no se
abandona. Hallazgo clave de investigación: **Titan Image Generator y Nova Canvas (los
modelos de imagen propios de Amazon en Bedrock) están ambos en fin de vida** — la
opción viable hoy es **Stability AI** vía Bedrock (us-east-1/us-east-2/us-west-2,
licencia comercial gratuita bajo $1M/año de ingresos).

**Estado**: usuario aprobó el arbusto (Fase 2 del estilo 3D queda cerrada como prueba de
patrón, ver sección "Fase 2" más abajo) y dio luz verde para arrancar la Fase A del
estilo ilustrado. **A1, A2 y A3 ya están hechas** (sin tocar AWS):

- [x] **A1** — `episode_spec/schema.json` (JSON Schema) + `episode_spec/ejemplo_15s.json`,
      validado contra el schema con `python3 -c "import jsonschema; ..."`. Cubre: campo
      `estilo` por episodio, `modo_voz`, personajes con voz Polly, líneas con `audio`
      (se llena en A6), eventos atados a palabras, y bloques `render.ilustrado`/`render.3d`
      por toma.
- [x] **A2** — `style_guide.json`: línea (#05070A, 3px en lienzo 540×960), paleta por
      familias, **ánimo por defecto amigable para niños** (evita terror/gore aunque la
      demo de referencia sea de misterio), prompt/negative_prompt base para Stability.
      Pendiente de usarse recién en A4.
- [x] **A3** — primer código Node/TS del repo: `apps/remotion-ilustrado/` (Remotion 4,
      React 18, TS). `Camera2D` (hook `useCamera2D`) y `ParallaxLayer` portan
      exactamente las fórmulas `camFor(d)`/`Z`/`PX`/`PY` de la demo; `Captions` porta
      `caption(f)` con el pop-in `easeOutBack` y resaltado de palabra clave.
      Composición de prueba `PruebaParallax` (capas de color planas, sin assets reales
      todavía) **renderizada localmente y verificada visualmente**: el parallax por
      profundidad se ve correcto (el elemento de profundidad baja casi no se mueve, el
      de profundidad alta se mueve y acerca notoriamente) y los subtítulos palabra por
      palabra funcionan con el resaltado de clave.
  - **Bug encontrado y corregido**: un `<div>` (`ParallaxLayer`) no puede ser hijo
    directo de un `<svg>` compartido — el DOM lo descarta en silencio y esa capa
    simplemente no aparece (así se vieron los subtítulos pero no las capas en el primer
    intento). Cada capa ahora lleva su propio `<svg>` autocontenido; en producción la
    mayoría de capas serán `<img>` de todos modos, no SVG a mano.

**Próximo paso**: Fase A4 (personaje 2D de prueba desde una imagen) — **requiere
aprobación explícita antes de la primera llamada a Stability** (genera costo AWS, aunque
bajo, ~$1-2).

## Fase actual (estilo 3D): Fase 2 — Biblioteca de entorno (ver docs/PLAN.md)

Fase 1 (fundamentos) completa y aprobada por el usuario.

### Cambio de alcance (importante, decisión del usuario)
**La biblioteca de assets NO tiene que completarse a mano ahora.** El resto de los
assets (roca, flor, pasto, piedras de camino, cerca, nube, montaña lejana, y
cualquier otro que haga falta) se construirá más adelante a partir de **bocetos e
instrucciones que el usuario suba a la app** — no haciendo que Claude escriba cada
generador `crear_<asset>()` a mano uno por uno. Los 3 assets de vegetación ya hechos
(hongo, árbol, arbusto) cumplieron su propósito: **probar que el contrato/patrón
funciona** (módulos comunes, validador, vista previa automática, el fix de costuras
en pliegues cóncavos). Eso es lo valioso de esta fase, no la lista completa de
vegetación. El pipeline de "boceto/instrucción → spec → builder genérico" (ya
descrito en `docs/PLAN.md` para personajes, sección Fase 5) es el que falta construir
para que el usuario pueda pedir nuevos assets sin que cada uno se escriba a mano —
y aplicará a cualquier categoría de asset, no solo personajes.

### Assets de Fase 2 (prueba de patrón, no biblioteca exhaustiva)
- [x] `assets/vegetacion/hongo.py` — migrado en Fase 1, aprobado.
- [x] `assets/vegetacion/arbol.py` — tronco lathe (base ensanchada/hundida) + copa
      metaball fundida. Primera versión tenía un hueco entre copa y tronco (el
      validador lo detectó correctamente como "flotando") y proporciones muy
      achaparradas (copa tapaba casi todo el tronco) — corregido. **Aprobado por el
      usuario.**
- [x] `assets/vegetacion/arbusto.py` — masa de hojas fundida sin tronco. Primera
      versión se hundía demasiado bajo el suelo y luego mostraba una costura oscura
      en un pliegue cóncavo entre lóbulos (el contorno/Solidify se auto-intersectaba
      ahí) — corregido dando más solape entre lóbulos al generarlos, no solo bajando
      el grosor del contorno. Este fix quedó en `assets/common/geo.py`
      (`use_quality_normals`, resolución de metaball balanceada en 0.02) y beneficia a
      cualquier asset futuro con piezas fundidas, incluidos personajes (Fase 5).
      **Aprobado por el usuario** (miniatura + turntable verificados sin artefactos
      desde ningún ángulo).
- [ ] roca, flor, pasto, piedras de camino, cerca, nube, montaña lejana — **no se van
      a construir a mano ahora**, quedan para el pipeline de bocetos/instrucciones.

**Fase 2 (estilo 3D) queda cerrada aquí** — cumplió su propósito de probar el patrón.
Próximo trabajo del lado 3D: pipeline de bocetos→asset (cuando se priorice) o Fase 3
(catálogo). Por ahora el foco pasa a la Fase A (estilo ilustrado) — ver arriba.

### Lección reutilizable (de construir `arbol.py`)
Al fundir una nube de metaballs contra otra pieza (p.ej. copa contra tronco), el
centro de la nube debe ubicarse **ligeramente dentro** de la pieza vecina, no justo
encima de su punta — un offset solo-positivo deja un hueco invisible a simple vista
en un render estático pero que el validador detecta bien como "flotando". Aplica a
cualquier asset futuro con piezas que deban fundirse (arbusto sobre el suelo, flores
sobre un tallo, etc.).

## Fase 1 — Fundamentos (completa, ver docs/PLAN.md para el detalle)

### Hecho
- [x] Estructura base del proyecto creada (`assets/`, `characters/`, `scenes/`, `docs/`, `tools/`).
- [x] Referencias copiadas a `docs/reference/`: `hongo.py`, `zorrito.py`, `escena_tito.py`
      (salto con rig de 2 empties, referencia histórica previa a la biblioteca de assets),
      `hongo-final.png`, `zorrito-vestido.png`, `zorrito-hoja.png`.
- [x] Blender 5.2.3 LTS instalado localmente **sin root** en `tools/blender/`
      (tarball oficial `blender.org`, extraído — no está en PATH del sistema, se invoca
      como `./tools/blender/blender`). Está en `.gitignore` (no se commitea, ~1.5GB extraído).
- [x] Confirmado que `docs/reference/hongo.py` (tal cual, sin modificar) renderiza
      correctamente en Blender 5.2.3 — solo warnings de deprecación de `use_nodes`
      (se eliminará en Blender 6.0, no bloquea nada todavía).
- [x] Módulos comunes creados en `assets/common/`: `color.py`, `materials.py`, `geo.py`,
      `palette.py`, `bbox.py`, `validate.py`, `preview.py`. Extraen y generalizan las
      utilidades de `hongo.py` **y** `zorrito.py` (antes `zorrito.py` importaba directo de
      `hongo.py` — ya no hay dependencia cruzada entre assets).
- [x] `assets/vegetacion/hongo.py` migrado al nuevo contrato (usa los módulos comunes,
      agrega metadatos `tipo/seed/tono/version/bbox`, pasa el validador automático).
- [x] Validador (`validate.py`) probado y corregido: la primera versión marcaba falsos
      positivos de "objeto flotando" (el sombrero del hongo está muy por encima del suelo
      por diseño). Se corrigió para que un objeto cuente como "no flotando" si toca el
      suelo **o** el bounding box de alguna otra pieza del mismo asset — no solo por altura
      absoluta.
- [x] Estudio de vista previa genérico (`preview.py`): cámara con encuadre automático según
      bounding box (sirve para cualquier asset, no solo hongos), 3 luces de área, fondo tipo
      "dish" cóncavo con perfil girado (en vez de plano infinito — necesario para que el
      turntable de 360° nunca muestre un horizonte/borde, igual en todos los ángulos).
- [x] Bug de compatibilidad con Blender 5.x corregido: `fcurves` ya no cuelga directo de
      `action` (Blender 4.4+/5.x cambió el sistema de Animation/Actions). Se evitó tocar
      fcurves directamente usando `bpy.context.preferences.edit.keyframe_new_interpolation_type`
      antes de insertar los keyframes del turntable.

- [x] ffmpeg estático instalado localmente sin root en `tools/ffmpeg/` (build de
      johnvansickle.com). Necesario porque el build oficial de Blender (tarball de
      blender.org) **no trae el encoder FFMPEG compilado** —
      `image_settings.file_format` no incluye `"FFMPEG"` en esta build. El turntable se
      renderiza como secuencia PNG a una carpeta temporal y se une a mp4 con este ffmpeg
      local vía `subprocess` (ver `assets/common/preview.py`).
- [x] Render final de aprobación del hongo migrado generado: miniatura a calidad
      completa (`hongo_v1.png`) + turntable de 360° (`hongo_v1_turntable.mp4`, h264,
      480×480, 48 frames/2s). Verificado visualmente en 4 ángulos del giro: fondo tipo
      "dish" se mantiene limpio (sin horizonte/borde) en todo el recorrido de cámara.
      **Pendiente de aprobación explícita del usuario** antes de pasar al siguiente asset.

### Próximo paso
Fase 2 (como prueba de patrón) está esencialmente completa con hongo+árbol+arbusto.
Pendiente: confirmar con el usuario hacia dónde seguir — candidatos: (a) Fase 3
(catálogo JSON) con estos 3 assets como semilla, (b) construir ya el pipeline de
boceto/instrucción → spec → builder genérico (lo que destraba que el usuario pida
nuevos assets desde la app), u (c) otra prioridad que el usuario defina. No asumir —
preguntar.

## Decisiones tomadas (no re-discutir salvo que el usuario pida cambiarlas)

- **Transform de vista estandarizado en `AgX` / look `AgX - Punchy`** (igual que
  `hongo.py`), no `Standard` (que usaba el script de referencia anterior `escena_tito.py`).
  Afecta cómo se ven todos los colores hex del proyecto.
- **Blender headless binario** (no el módulo `bpy` vía pip) — más aislamiento por proceso,
  mejor soporte GPU/EGL, es el patrón de producción estándar. Instalado localmente sin root.
- **ffmpeg estático local** (`tools/ffmpeg/`, sin root) para codificar los turntables a mp4,
  porque el build oficial de Blender no trae el encoder de video compilado.
- **Cero gasto de AWS** en las fases de biblioteca de assets (Fases 1-5). Render en AWS
  (Batch + GPU spot) es Fase 6, requiere aprobación explícita antes de provisionar nada.
- **Backend futuro (Fase 6, web app) en Python (FastAPI)**, no Node — porque el núcleo del
  sistema (Blender/bpy) es Python nativo. Remotion (Node) se mantiene solo como capa ligera
  de composición final (subtítulos/intro-outro/aspect ratios), no para animación.
- **Referencia de diseño de UI para la Fase 6** (el usuario compartió una captura de
  "Faceless Clip Studio", facelessclipstudio.androidemathias.com, una plataforma de terceros
  de generación de video con IA): panel de configuración a la izquierda (tema/nicho/tono/
  duración estimada) + "estudio" en vivo a la derecha (selector de voz narradora, tipografía
  de subtítulos, estilo visual, pista de música de fondo + volumen, reproducir/detener,
  botón de renderizar). Mapea bien a nuestro sistema: selector de voz → Polly/Rhubarb,
  música de fondo, botón de aprobar/renderizar. Su "Modo Full Cinema" (animar todo con IA en
  un clic) equivale a todo nuestro pipeline guion→escenas→Blender — no es un patrón nuevo,
  es la misma automatización con otra etiqueta. No implementar todavía (es Fase 6); queda
  aquí para no perder la referencia visual cuando llegue el momento del frontend.

## Convenciones de código (para assets nuevos)

- Cada asset vive en `assets/<categoria>/<nombre>.py`, importa de `assets/common/` vía
  `sys.path.insert(0, ...../common)` (ver encabezado de `assets/vegetacion/hongo.py` como
  plantilla).
- Función `crear_<asset>(seed, escala, ...)` determinista, devuelve una Collection marcada
  como asset con metadatos `tipo/seed/version/bbox` (y los que apliquen por tipo, p.ej.
  `tono`).
- Bloque `if __name__ == "__main__":` para CLI de vista previa:
  `blender -b -P <asset>.py -- --out x.png [--turntable x.mp4] [--fast] [--blend x.blend]`
  — siempre corre `validate_asset()` e imprime el resultado antes de renderizar.
- Colores desde `assets/common/palette.py` (no hardcodear hex sueltos en cada asset).

## Cómo retomar en una sesión nueva sin este contexto

1. Leer este archivo completo y `docs/PLAN.md`.
2. Revisar qué assets ya existen en `assets/vegetacion/` (o `characters/` para Fase 5) y
   cuáles de ellos tienen render de aprobación pendiente de mostrar al usuario.
3. Blender: `./tools/blender/blender` (no está en PATH). Si `tools/blender/` no existe
   (está gitignored), hay que volver a descargarlo: tarball oficial de
   `https://download.blender.org/release/Blender5.2/` (o la versión estable vigente),
   extraer sin instalar, no requiere root.
4. No avanzar de un asset al siguiente sin que el usuario apruebe explícitamente el render
   de vista previa — es una regla explícita del usuario, no una sugerencia.
