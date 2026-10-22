# Estado del proyecto — léeme primero

Este archivo existe para que cualquier sesión nueva (sin el contexto de esta conversación)
pueda retomar el trabajo. El plan completo y las decisiones de arquitectura están en
`docs/PLAN.md` — este archivo es solo el "dónde vamos" y el registro de decisiones.

**Repo**: git inicializado localmente, rama de trabajo `dev` (nunca se hace commit/merge a
`main` sin aprobación explícita del usuario, por instrucción global del usuario).

## Fase actual: Fase 1 — Fundamentos (ver docs/PLAN.md)

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

### Próximo paso (una vez aprobado el hongo)
Fase 2: migrar/crear el resto de la biblioteca de vegetación, un asset a la vez, cada uno
con su propio render de aprobación: árbol, arbusto, roca, flor, pasto, piedras de camino,
cerca, nube, montaña lejana. Ver contrato de asset en `docs/PLAN.md`.

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
