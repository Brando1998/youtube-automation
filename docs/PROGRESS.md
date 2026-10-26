# Estado del proyecto — léeme primero

Este archivo existe para que cualquier sesión nueva (sin el contexto de esta conversación)
pueda retomar el trabajo. El plan completo y las decisiones de arquitectura están en
`docs/PLAN.md` — este archivo es solo el "dónde vamos" y el registro de decisiones.

**Repo**: git inicializado localmente, rama de trabajo `dev` (nunca se hace commit/merge a
`main` sin aprobación explícita del usuario, por instrucción global del usuario).

## ✅ Infraestructura AWS lista (EC2 + IAM role)

Resuelto. El usuario provisionó todo siguiendo `docs/EC2_SETUP.md`:

- **Instancia**: `youtube-automation`, Ubuntu 26.04.1 LTS, `t3.medium`, región
  `us-east-1`, 50GB gp3. **IP fija (Elastic IP): `52.5.177.143`** — acceso SSH
  confirmado con `Downloads/KEYS/youtube-automation.pem` (usuario `ubuntu`).
- **IAM role** `youtube-automation-ec2-role` adjunto, confirmado vía metadata (IMDSv2)
  desde la instancia. Policy inline `bedrock-polly-inline` con `bedrock:InvokeModel` +
  `polly:SynthesizeSpeech`.
- **Security group**: SSH abierto a `0.0.0.0/0` por decisión del usuario (la IP de
  salida de esta sesión rotaba y rompía la regla "solo mi IP"; mitigado porque el
  acceso sigue siendo solo por llave privada, no hay login por contraseña). HTTP/HTTPS
  abiertos. Sin bucket S3 (decisión de costo del usuario) — assets en el volumen EBS.
- **Hallazgo importante corregido en el camino**: Stability AI en Bedrock **solo existe
  en `us-west-2`**, no en `us-east-1` donde vive la instancia — confirmado con la
  documentación oficial de AWS después de que el primer intento fallara. El IAM policy
  quedó con `stability.*` apuntando a `us-west-2` y `anthropic.*` a `us-east-1` — esto
  funciona bien porque las llamadas a Bedrock son HTTPS normales, no hace falta que la
  región de la instancia coincida con la del modelo. El usuario preguntó si convenía
  mover todo a la región de sus otros proyectos (Docubot, `us-east-2`) — **no**, esa
  región tampoco tiene Stability, así que no hubiera resuelto nada y se descartó.
- **Python**: venv en `~/youtube-automation/.venv` en la instancia, con `boto3` y
  `pillow` instalados.
- **Verificado end-to-end**: llamada real a `stability.stable-image-core-v1:1` desde
  la instancia generó una imagen de prueba correctamente (círculo rojo simple) —
  confirma que IAM role + región + SDK están bien configurados antes de gastar en algo
  real.

**Código ya desplegado** a la instancia vía `rsync` (no hay git remoto todavía).
**Fase A4 desbloqueada** (ver sección "Fase A4" más abajo — era un perfil de pago de
Marketplace faltante en USD, no un problema de IAM ni de código) — listo para generar
el personaje real.

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
  - **A3 (resto de la biblioteca)**: `FlickerLight`, `Particles` (presets luciérnagas/
    brasas/nieve/polvo), `Smoke`, `Fog`, `Rain`, `Lightning` (relámpago disparado por
    frame de evento, con destello de pantalla + golpe de zoom vía
    `golpeZoomFrames` de `Camera2D`), `ColorGrade`, `Vignette`, `Grain` — todos portan
    las fórmulas exactas de `cabana-lucia.html`, generalizadas para recibir parámetros
    del episode spec en vez de valores fijos de la demo. `SpeechBubble` es diseño
    nuevo (la demo es solo narrador). `CharacterPuppet` generaliza
    breathing/parpadeo/mirada/cejas/balanceo de la demo a cualquier personaje, con
    **placeholders** (formas simples, incluidas las 7 bocas por visema
    reposo/A/E/O/MBP/FV/L) para poder probar la animación sin esperar arte real.
    Composición `PruebaEfectos` combina casi toda la biblioteca sobre la escena dummy
    — **renderizada localmente y verificada frame por frame**: parallax, luces,
    partículas, humo, niebla, lluvia, relámpago sincronizado con la palabra "NOCHE",
    personaje con mirada/lip-sync, globo de diálogo, color/viñeta/grano, todo
    funcionando junto. `tsc --noEmit` limpio.

**A1, A2 y A3 completas.**

- **Renderer real (adelantado mientras A4 sigue bloqueada)**: `EpisodeRenderer.tsx`
  (componente `TomaIlustrada`) — arma una toma **a partir del episode spec real**
  (tipado mínimo que refleja `episode_spec/schema.json`), no de una escena armada a
  mano. Lee: fondo por id desde un catálogo (`catalog/fondos.tsx` — hoy un mock
  "2d/fondos/cabana-bosque-noche" con capas/luces/origen de humo placeholder),
  personajes desde otro catálogo (`catalog/personajes.tsx` — mock "2d/personajes/
  lucia"), y audio sincronizado (`lineasAudio`, hoy un mock en `fixtures/
  audioMock.ts` porque Polly/A6 sigue bloqueada) — resuelve eventos `en_palabra` a
  frames concretos buscando la palabra en ese audio, arma golpes de zoom/relámpago
  desde ahí, y reparte líneas entre `Captions` (narrador) y `SpeechBubble`
  (personajes). Composición `PruebaEpisodeSpec` usa una copia de
  `episode_spec/ejemplo_15s.json` tal cual — **renderizada localmente y verificada**.
  - **Bug encontrado y corregido**: `personajes_en_escena[].id` se estaba comparando
    contra `asset_ref` en dos sitios (debía ser contra el `id` del personaje, igual
    que `hablante`) — el globo de diálogo no aparecía por este motivo. Corregido;
    confirmado visualmente que ahora sí aparece con el texto correcto y el lip-sync
    se ve cambiando de boca en los frames correctos.
  - Ajuste menor: posición del globo de diálogo subida para no montarse sobre la
    cabeza del placeholder.
  - Esto es, en los hechos, la primera versión de `RemotionIllustratedRenderer` de
    la arquitectura (`docs/PLAN.md`) — falta conectarlo a catálogos/audio reales en
    vez de mocks, que es exactamente lo que destraba la Fase A4.

- **Camino "audio grabado" (Fase A6, mitad no-AWS) — REAL, no mock, construido
  mientras A4 seguía bloqueada**: `apps/pipeline_audio/generar_audio_local.py` —
  Whisper (`openai-whisper`, instalado sin root con `uv` porque esta máquina no tiene
  `python3-venv` ni sudo) para palabras con tiempos, **Rhubarb Lip Sync** (binario
  oficial descargado sin root, igual que Blender/ffmpeg) para formas de boca.
  Mapeo Rhubarb (A-H,X) → nuestro `VisemaCode` (reposo/A/E/O/MBP/FV/L) confirmado
  contra la documentación oficial del proyecto, no adivinado — queda comentado en el
  script con el porqué de cada mapeo. Todo convertido a número de frame (no
  segundos), mismo formato que `audio.palabras`/`audio.visemas` del episode spec.
  - **Rhubarb solo acepta `.wav`/`.ogg`** (no mp3) — el script convierte siempre con
    ffmpeg antes de llamarlo, así acepta cualquier formato de entrada.
  - **Probado de punta a punta con audio real**: sin tener todavía una grabación del
    usuario, se generó audio de prueba con gTTS (gratis, sin cuenta — solo para tener
    un .mp3 con el que ejercitar Whisper+Rhubarb, no es la voz de producción) para
    las dos líneas de `ejemplo_15s.json`, se corrió el pipeline real, y el resultado
    se conectó al `EpisodeRenderer` (composición `PruebaAudioReal`,
    `fixtures/audioReal.ts`) — **renderizado localmente y verificado: la boca del
    personaje cambia de forma de verdad, sincronizada con la transcripción real**, no
    con datos inventados a mano.
  - Pendiente (no bloqueante): agregar el audio real a la pista de sonido del video
    renderizado (hoy solo se usa para derivar texto/tiempos, el render queda mudo) —
    cuestión de usar `<Audio>` de Remotion, no de pipeline.

Próximo paso real: Fase A4 (personaje 2D real desde una imagen) — el script
(`apps/pipeline_2d/generar_hoja.py`) ya está escrito y probado contra la API real,
pero **sigue bloqueado por un problema de pago de AWS Marketplace** (ver sección
"Fase A4" abajo) antes de poder generar el personaje de verdad y conectarlo al
catálogo/renderer ya construidos.

## Pausa de costos AWS (decisión del usuario, 2026-10-26)

El usuario pidió explícitamente **no generar más costo de AWS por ahora** — primero
quiere el sistema completo (backend multitenant, resto del pipeline, front/dashboard)
y recién después probar la generación real de principio a fin. Mientras tanto se
sigue avanzando **solo código** (sin llamar a Bedrock/Polly), y cada script nuevo se
prueba localmente con datos sintéticos (`--dry-run` o equivalente) en vez de contra la
API real. La Fase A4 real (generar la hoja/partes de Lucía de verdad) y el resto de
las fases con costo (A5 fondos, A6 Polly) quedan pendientes hasta que el usuario pida
retomarlas.

- **`apps/pipeline_2d/generar_partes.py`** (nuevo): Fase A4 paso 2 — separa una hoja
  **ya aprobada** (`hoja.meta.json: aprobado=true`, si no, aborta con error explícito)
  en las partes del puppet que ya espera `CharacterPuppet.tsx` (mismo contrato:
  `cuerpo/cabeza/ojosAbiertos/ojosCerrados/cejas/bocas[VisemaCode]/prop`,
  `Pivote{x,y}`). Sigue el plan documentado en `docs/PLAN.md`: cada parte se recorta
  de la hoja (regiones en píxeles, en un JSON escrito a mano tras revisar la hoja —
  ver `regiones.ejemplo.json`, el script no adivina dónde está cada parte) y pasa por
  **Remove Background** de Stability (`us.stability.stable-image-remove-background-v1:0`)
  para quedar con fondo transparente real. Las 6 bocas que no son "reposo" se generan
  con **Search and Replace** (`us.stability.stable-image-search-replace-v1:0`,
  `search_prompt: "mouth"` + un prompt de forma por visema, mismos 7 códigos que ya
  usa `generar_audio_local.py`/Rhubarb) antes de quitarles el fondo. Formato de ambas
  llamadas verificado contra la documentación oficial de AWS (no adivinado) — nota:
  estos dos servicios no tienen endpoint in-region en `us-west-2` como sí tiene Stable
  Image Core, necesitan el id con prefijo `us.` (enrutamiento Geo).
  **Probado localmente sin tocar AWS**: con una hoja sintética + `--dry-run`, confirma
  que arma el plan de 13 llamadas correctamente, y que bloquea con error claro tanto si
  la hoja no está aprobada como si faltan regiones requeridas en el JSON.
- **`apps/pipeline_2d/generar_fondo.py`** (nuevo): Fase A5 — fondos en capas (cielo,
  lejano, medio, cabaña, ...). A diferencia de personajes, cada capa se genera
  aislada directamente (`text-to-image` con Stable Image Core + el style guide,
  pidiendo "isolated on a plain flat white background, no scene elements") y después
  pasa por Remove Background — no hay hoja de la que recortar. Composición de capas
  (qué dibuja cada una, profundidad, luces, origen de humo) va en `--spec`, escrito a
  mano (`fondo_spec.ejemplo.json` usa el mismo id/capas/luces/humo que el mock de
  `catalog/fondos.tsx`, para no tocar el renderer al conectar el fondo real).
  **Probado localmente**: `--dry-run` arma el plan de 8 llamadas sin importar boto3
  siquiera, y valida specs mal formados (sin capas, depth fuera de [0,1]).
- **`apps/pipeline_audio/generar_voz_polly.py`** (nuevo): Fase A6, camino
  "narrador"/voces sintéticas — paralelo a `generar_audio_local.py` (que parte de
  audio grabado con Whisper+Rhubarb), mismo formato de salida (`palabras`/`visemas`
  por frame) para que `EpisodeRenderer.tsx` no necesite saber cuál de los dos se usó.
  Dos llamadas a Polly por línea (la API no da audio + marcas juntos):
  `SpeechMarkTypes=["word","viseme"]` para los tiempos, y una segunda en mp3 para el
  audio real — a diferencia del camino Whisper/Rhubarb, acá **no** queda pendiente
  agregar el audio al render, Polly ya lo da. Mapeo de los 18 visemas de Polly
  (`p/t/S/T/f/k/i/l/r/s/u/@/a/e/E/o/O/sil`) a nuestros 7 `VisemaCode` verificado
  contra la tabla oficial de fonemas/visemas de Polly, no adivinado. Voz por defecto
  `Lucia` (es-ES, neural) — confirmada real en la documentación de voces de Polly, no
  supuesta. **Probado localmente sin tocar AWS**: `--dry-run`, y la conversión de
  marcas NDJSON sintéticas a frames/visemas verificada con un caso de prueba a mano
  (confirma el mapeo de visemas y la inferencia de `fin_frame` por pares consecutivos).
- **`apps/pipeline_spec/generar_episode_spec.py`** (nuevo): genera
  `episode_spec/<id>.json` de verdad a partir de un guion de texto, vía Claude en
  Bedrock — hasta ahora `ejemplo_15s.json` estaba escrito a mano. Usa **InvokeModel**
  (no Converse/Messages API directa): body con `anthropic_version:
  "bedrock-2023-05-31"` + `messages` + `max_tokens`, modelId
  `us.anthropic.claude-sonnet-5` (el id plano no tiene endpoint in-region en
  us-east-1, mismo hallazgo de "necesita prefijo Geo" que ya vimos con Stability).
  Modelo por defecto **Sonnet 5, no Opus** — decisión explícita de costo del usuario,
  configurable con `--modelo`. En vez de apostarle a un structured-output específico
  de Bedrock para un modelo recién lanzado (no documentado con certeza), le pide a
  Claude JSON crudo y lo valida contra `episode_spec/schema.json` con `jsonschema`
  (mismo patrón que ya usa el proyecto desde la Fase A1) — si no valida, reintenta
  devolviéndole el error de validación en el siguiente turno, hasta
  `--max-reintentos` veces. **Probado localmente sin tocar AWS**: `--dry-run`;
  `extraer_json` confirmado contra una respuesta con fences markdown y una cruda;
  `episode_spec/ejemplo_15s.json` revalidado contra el schema real (sigue pasando);
  y el loop completo de reintento probado con un cliente de Bedrock simulado —
  primera respuesta inválida se corrige en el segundo turno, y agotar los reintentos
  sin éxito lanza un error claro en vez de devolver un spec roto.

## ✅ Fase A4 desbloqueada — causa real: falta de perfil de pago de Marketplace en USD

Quedó resuelto, pero el camino fue más largo de lo esperado — queda documentado para
no repetirlo si vuelve a pasar en otro proveedor de Bedrock Marketplace más adelante:

1. Primer síntoma: `AccessDeniedException: ... aws-marketplace:ViewSubscriptions,
   aws-marketplace:Subscribe` — nuestro IAM role (a propósito, permisos mínimos) no
   tiene esos permisos. Esto es esperado: según la documentación de AWS, los modelos
   servidos vía **AWS Marketplace** (Stability es uno) necesitan que **un principal
   con permisos de Marketplace** (el usuario logueado en la consola, no el role de la
   instancia) invoque el modelo **una vez** desde el Playground de Bedrock para
   habilitarlo a nivel de cuenta.
2. Al invocar desde el Playground, el error cambió a `INVALID_PAYMENT_INSTRUMENT` —
   esto sí es un problema real de facturación, no de permisos. Investigado (ver
   hilos de AWS re:Post): es un problema conocido, no exclusivo de esta cuenta.
3. **Causa real encontrada**: Billing → Preferencias de pago tiene dos pestañas,
   "Métodos de pago" (tarjetas registradas) y **"Perfiles de pago"** (qué tarjeta y
   qué moneda usa cada proveedor de AWS). El perfil predeterminado de esta cuenta
   factura en **COP**, pero AWS Marketplace necesita **USD** — sin un perfil de pago
   específico para Marketplace en USD, la suscripción nunca se completa aunque la
   tarjeta esté verificada. Se creó un perfil nuevo: proveedor **"AWS Inc. -
   Marketplace"**, divisa **USD**, método de pago la Mastercard ••••8461 (crédito).
4. Tras crear ese perfil, la misma llamada mínima de prueba funcionó: imagen
   generada correctamente (`stability.stable-image-core-v1:1`, 2.9MB, verificada
   visualmente).

**Para la próxima vez** (si otro proveedor de Marketplace da el mismo error): revisar
primero Billing → Preferencias de pago → Perfiles de pago, no solo Métodos de pago.

**Comando para generar el personaje real ahora que está desbloqueado**:
```
ssh -i Downloads/KEYS/youtube-automation.pem ubuntu@52.5.177.143
source ~/youtube-automation/.venv/bin/activate && cd ~/youtube-automation/repo
python3 apps/pipeline_2d/generar_hoja.py --id lucia --sujeto "..." --out assets/2d/personajes/lucia
```
(puede hacer falta un `rsync` antes si el repo local cambió desde el último despliegue).

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
- **Entornos Python en esta máquina local (no la EC2) van con `uv`, no `venv`** — no
  hay `python3-venv` instalado y no hay sudo local (`python3 -m venv` falla con
  "ensurepip is not available"; `pip install --user` falla por PEP 668 "externally
  managed environment"). `uv` se instala sin root (`curl -LsSf
  https://astral.sh/uv/install.sh | sh`, queda en `~/.local/bin`) y resuelve ambos
  problemas. La instancia EC2 sí tiene sudo (usuario `ubuntu`), ahí se puede seguir
  usando `python3 -m venv` normal.
- **Rhubarb Lip Sync** (`tools/rhubarb/`, binario oficial, sin root) para el camino de
  lip sync con audio pregrabado — solo acepta `.wav`/`.ogg`, hay que convertir con
  ffmpeg antes si el audio viene en otro formato.
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
