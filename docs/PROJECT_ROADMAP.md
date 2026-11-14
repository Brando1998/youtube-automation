# Roadmap — Plataforma de animación programática dirigida por IA

Seguimiento del plan maestro (mensaje del usuario, 2026-11-09) para construir un
motor de animación 2D programático (sin IA generando imágenes/video) con una
biblioteca de recursos creciente, dirigido por un "Director IA" que interpreta
guiones y arma escenas mediante instrucciones estructuradas.

Este documento es el **único lugar** donde se sabe en qué fase estamos, qué se
decidió y por qué, y qué falta — se actualiza al cerrar cada hito, no al final del
proyecto. Para el histórico de producción de episodios (presupuesto, render,
pipeline de audio, backend), ver `docs/PROGRESS.md` — son seguimientos distintos:
este archivo es sobre el **motor**, `PROGRESS.md` es sobre la **app/producción**.

## Cómo leer este documento

Cada fase tiene: alcance, estado, criterio de aceptación, decisiones tomadas
(no re-discutir salvo que el usuario pida cambiarlas) y riesgos conocidos.

---

## Fase 0 — Auditoría y diagnóstico

**Estado: ✅ completa (2026-11-09).**

Diagnóstico completo entregado al usuario en el chat (no se repite aquí en detalle,
ver el mensaje del 2026-11-09). Resumen de lo accionable:

- Reutilizar: `primitives.tsx` (geometría), `styleTokens.ts`, el contrato
  `ParteVisual` de `CharacterPuppet.tsx`, `validar_silueta.mjs`,
  `generar_registry.mjs`, todo el backend (`apps/web`), Tito/Rocco/Lucía como
  referencias de familia.
- Problema raíz confirmado: cada personaje re-deriva su propia geometría a mano —
  no hay generador paramétrico, no hay jerarquía de articulaciones, no hay sistema
  de clips de animación, no hay pruebas automatizadas, no hay registro de activos
  con metadatos.
- Bug concreto encontrado: `tangentesExternas` oculta geometría inválida con
  `clamp` en vez de lanzar error (sección 18.9 del plan lo prohíbe explícitamente).
- Hallazgo operativo (no de código): la rama `dev` fue renombrada a `main` y
  empujada a `origin` fuera de esta conversación — confirmado con el usuario,
  queda como el estado real del repo.

---

## Fase 1 — Fundamentos y contratos

**Estado: ✅ Hito 1 completo (2026-11-09).**

### Hito 1 (alcance acordado con el usuario)

- [x] 1a. `tangentesExternas` y `FormaAhusada`: reemplazado el `clamp` silencioso
      por un error descriptivo cuando la geometría es inválida (`d===0` o
      `|a.r - b.r| >= d`).
- [x] 1b. Vitest instalado (elegido sobre Jest: nativo ESM, encaja con
      `moduleResolution: "bundler"` ya presente en el tsconfig, sin config de
      Babel). 11 pruebas reales en `src/library/primitives.test.ts`.
- [x] 1c. `PersonajeDef` (`catalog/types.ts`) extendido con `MetadatosActivo`
      (`id`, `version`, `tags`, `capabilities`, `descripcion`) — opcional, aditivo.
      Poblado en los 3 personajes existentes (tito/rocco/lucia) para que el campo
      tenga un consumidor real, no solo el tipo declarado.
- [x] Verificación: `tsc --noEmit` limpio, `vitest run` 11/11 en verde,
      Tito/Rocco/Lucía re-renderizados (`remotion still`) y validados con
      `validar_silueta.mjs` — sin regresión.

### Hallazgo real de este hito (no estaba en el plan, lo encontró la prueba)

Las pruebas de `tangentesExternas` (propiedad "el segmento es perpendicular al
radio en el punto de tangencia", no solo "no truena") detectaron un **bug de signo
real y preexistente**: la fórmula usaba `theta + 90° + alpha` cuando la derivación
correcta (`cos(θ-theta) = (a.r-b.r)/d`) da `theta + 90° - alpha`. Con diferencias de
radio chicas (los casos ya usados en Rocco/Lucía) el error era visualmente
imperceptible; con diferencias grandes el punto "tangente" queda a cientos de
unidades de distancia de serlo de verdad. Corregido en ambas funciones
(`tangentesExternas` y `FormaAhusada`, que comparten la fórmula), verificado
numéricamente (producto punto ≈ 0) y con las 3 previsualizaciones re-renderizadas.
Es la primera prueba concreta de que el pedido del usuario ("un estándar real, no
solo cuidado manual") ya está dando resultado — este bug nunca se habría encontrado
solo mirando el render.

### Decisiones tomadas en esta fase

- **Vitest, no Jest.** Motivo arriba. Reversible si aparece una razón concreta.
- **Zod NO se agrega todavía de forma transversal.** Se reserva para cuando exista
  el Director IA (Fase 8) y necesite validar salida estructurada de un modelo — ahí
  el patrón `zod + structured output` es de bajo riesgo y alto valor. Meterlo antes,
  en un proceso de render de Remotion, solo agrega peso sin un consumidor real.
- Contratos de Fase 1 se escriben como tipos TS + funciones `validarX` propias
  (no Zod) hasta que haya un caso de uso que justifique la dependencia.

### Riesgos conocidos

- Ninguno bloqueante para este hito — es deliberadamente pequeño y reversible.

---

## Fase 2 — Motor geométrico

**Estado: ✅ completa (2026-11-10).**

12 pruebas nuevas en `primitives.test.ts` (30/30 en ese archivo, 56/56 en todo el
proyecto) cerrando los huecos reales que quedaban sobre las funciones
GEOMÉTRICAS (las que tienen matemática real, no solo props de JSX):

- `anguloParaX`: caso normal (el ángulo devuelto reproduce el `targetX` pedido
  vía `puntoEnCirculo`), `ladoInferior` true/false dan el lado correcto (Y
  mayor/menor), bordes exactos (`targetX = c.x ± r`) no truenan, fuera de rango sí
  lanza error descriptivo.
- `validarAnclaje`: caso ok=true (bien metido), ok=false (flotando), y el borde
  exacto donde `profundidad === minimaRequerida` (confirma que la comparación es
  `>=`, no `>`).
- `validarAnclajeConMascara`: ok=true (cerca del borde de la elipse padre),
  ok=false por los 2 lados (muy adentro / muy afuera).
- `arcoCorto`: faltaba el caso `largo=true` (el que usa
  `construirTorsoYBrazos` para el arco de la mano) — confirma `largeArcFlag=1`.
- `FormaAhusada`: tenía solo "no truena"/"longitud del `d`" — se agregó la MISMA
  propiedad real que ya prueba `tangentesExternas` (producto punto ≈ 0 entre el
  radio y el lado recto del path, extrayendo los puntos reales del `d` generado)
  con una diferencia de radios grande, el caso que tenía el bug de signo
  original. Confirma que la geometría interna de `FormaAhusada` (no expuesta como
  función aparte) también es tangente de verdad, no solo "se ve bien".

**Alcance deliberadamente recortado** (decisión tomada sin preguntar, documentada
aquí): los componentes puramente decorativos sin matemática de por medio
(`CuerpoBlob`, `CabezaRedonda`, `OjoAlmendra`, `OjoCerrado`, `Ceja` propiamente
dicho, `Miembro`, `Techo`, `Ventana`, `Arbol`, `Colina`, `bocasDesdeForma`) NO
recibieron pruebas unitarias — son wrappers de JSX sin invariantes geométricos
que puedan romperse en un caso borde (a diferencia de `tangentesExternas`/
`FormaAhusada`, no hay ningún `asin`/`acos`/división que pueda fallar). Escribir
pruebas ahí sería solo repetir "no truena con props válidas", sin el valor real
que sí tuvo esta fase en las funciones con matemática real. Se revisa si hace
falta cuando alguna de esas formas gane parámetros con restricciones reales.

---

## Fase 3 — Generador humano paramétrico

**Estado: ✅ núcleo completo (2026-11-09).** (Es la que más fricción causó antes de
tener un plan — ver `docs/PROGRESS.md`, sesión del 2026-11-07/08/09: 3 personajes
construidos a mano, muchas rondas de corrección visual, hasta encontrar la técnica
de curva única — y luego, con el estándar real, un bug de signo encontrado por
prueba automática en la Fase 1.)

- `construirTorsoYBrazos(medidas)` en `primitives.tsx`: generaliza la técnica de
  Lucía (torso+brazos como una sola curva cerrada). Recibe medidas reales (anchos,
  posición/radio de hombro y mano) — los ÁNGULOS de tangencia los resuelve la
  función internamente vía `anguloParaX` (nunca se le pasan ángulos adivinados).
- `lucia.tsx` fue refactorizada para USAR este generador (no quedó como pieza
  especial aparte) — se verificó que el render sigue viéndose igual de bien.
- **Bug real encontrado generalizando**: la primera versión conflacionaba "ancho de
  cadera" y "ancho donde el torso toca el hombro" en una sola medida —
  con ambos iguales, el ángulo resuelto quedaba tan cerca de la tangente del brazo
  que la curva se autointersecaba (se veía como "manos" apareciendo junto al cuello
  en vez de en la muñeca). Se separaron en `anchoCaderaMitad` y
  `anchoTorsoSuperiorMitad` — corregido y reverificado.
- **Prueba de genericidad real**: `compositions/PruebaCuerposHumanoides.tsx` (queda
  en el repo como fixture de prueba visual permanente, no se borra) renderiza 3
  cuerpos (delgado/medio=Lucía/robusto) con proporciones muy distintas usando la
  MISMA función — los 3 salen como una sola pieza conectada
  (`validar_silueta.mjs`: 1 componente cada uno, verificado con zoom visual real,
  no solo "compila").

### Validador de auto-intersección — ✅ construido (2026-11-09)

`validarOrdenAngularHombro` (`primitives.tsx`) confirma que los 2 arcos que se
dibujan sobre el círculo del hombro (torso→manga y manga→cuello) no se solapan
entre sí — si uno de los 4 ángulos cae adentro del arco corto del otro par, lanza
un error descriptivo ANTES de construir el `d` del path, en vez de producir una
curva autointersecada en silencio. Ya está conectado dentro de
`construirTorsoYBrazos` (corre siempre, no es opcional). 6 pruebas nuevas en
`primitives.test.ts` (16/16 en verde), incluyendo un caso real encontrado probando
medidas (brazo demasiado corto — mano casi pegada al hombro) que efectivamente
lanza el error.

**Corrección honesta sobre su alcance** (importante, no inflar lo que hace): al
intentar reproducir el bug visual original de Lucía ("manos" apareciendo junto al
cuello) con este chequeo, los números reales **no disparaban ninguna alerta** —
resultó ser una silueta geométricamente válida (sin cruce real) pero con mala
proporción visual, no una auto-intersección. Ese bug se corrigió separando
`anchoCaderaMitad` de `anchoTorsoSuperiorMitad`, y se verificó a ojo (render +
`validar_silueta.mjs`), no con este validador. Conclusión real: este chequeo SÍ
detecta auto-intersecciones genuinas (un caso real ya lo confirma), pero "la
silueta es topológicamente válida" y "la silueta se ve bien" siguen siendo
preguntas distintas — la segunda sigue necesitando R3/R4 de REGLAS.md (renderizar
y mirar), no hay atajo todavía.

### Pendiente dentro de esta fase (no bloqueante, siguiente iteración)

- Piernas y manos siguen siendo piezas independientes (`FormaAhusada` + círculo),
  no generalizadas en un builder propio todavía — son más simples (no tuvieron
  bugs), se puede abordar cuando haga falta una pierna con proporciones muy
  distintas a las ya probadas.
- Los 3 prototipos de la prueba de genericidad son solo el torso+brazos (sin
  cabeza/cara) — construir cabezas/caras paramétricas es trabajo aparte, no se
  intentó generalizar aquí.

---

## Fase 4 — Rigging

**Estado: 🔄 en progreso — primer hombro funcionando (2026-11-09).**

### Decisión arquitectónica (importante, afecta a Lucía)

La técnica de la Fase 3 (torso+brazos como una sola curva fundida) es excelente
para una silueta ESTÁTICA, pero mala base para articulaciones que rotan: no se
puede animar "solo el codo" de una curva ya fundida sin recalcular tangentes
válidas en cada cuadro, arriesgando los mismos bugs de auto-intersección de la
Fase 3 pero ahora en movimiento. En vez de eso, Fase 4 usa la técnica estándar de
rigs 2D reales (Spine2D/DragonBones): cada hueso es una pieza independiente
(`FormaAhusada`), y la unión entre dos huesos que rotan se tapa con un círculo del
mismo color en la articulación (el "cap") — se ve limpio en cualquier ángulo
porque un círculo se ve igual rotado o no. Esto significa que los brazos de Lucía
(hoy fundidos en el torso) necesitarán separarse en huesos reales para poder
posarse — el torso no (no se dobla).

### Construido

- `engine/rig/types.ts` — `Articulacion` (longitud, radios, ángulo de reposo,
  padreId), `PoseMundo`, `PoseHueso`.
- `engine/rig/fk.ts` — `evaluarFK`: resuelve posición/orientación en el mundo de
  toda una jerarquía a partir de ángulos LOCALES (los que se animan), determinista
  (sin estado, se puede llamar en cualquier frame de Remotion). 7 pruebas
  (`fk.test.ts`): hueso simple en 0°/90°, cadena de 2 huesos heredando rotación del
  padre, y los 3 errores de jerarquía mal formada (sin raíz, más de una raíz,
  `padreId` inexistente).
- `compositions/PruebaHombroFK.tsx` — prueba visual real: un hombro con un hueso
  que rota -45°/0°/45°, con el "cap" en la articulación. Verificado con
  `validar_silueta.mjs` (cada instancia es 1 sola pieza conectada) y por inspección
  visual — la unión se ve limpia en los 3 ángulos, no solo en reposo.

### Conectado al personaje real (2026-11-09)

Los brazos de Lucía ya NO están fundidos con el torso — son 2 huesos reales
(`brazo` hombro→codo, `antebrazo` codo→muñeca, jerarquía padre-hijo real vía
`evaluarFK`) en `lucia.tsx`. El torso ahora se construye con la nueva
`construirTorso` (sin brazos — más simple que `construirTorsoYBrazos`, no necesita
tangentear contra ninguna mano). Verificado: pose de reposo pixel-equivalente a la
versión fundida anterior (sin regresión), y una pose nueva de verdad (codo
doblado, saludo con hombro+codo) renderizada y validada — ya no es solo
arquitectura distinta, Lucía es posable de verdad.

**2 bugs reales encontrados construyendo esto** (ambos corregidos, ninguno se
había visto en la prueba aislada de `PruebaHombroFK` porque esa prueba nunca tuvo
una pieza "padre" ni 2 huesos propios con el mismo degradado):
1. Parámetro `anguloLocal = 0` por defecto: 0 es un ángulo válido, no "sin
   especificar" — pisaba siempre el ángulo de reposo real vía el `??` de
   `evaluarFK`, poniendo el brazo horizontal en vez de colgando. Fix: el default
   del parámetro queda `undefined`, solo se arma la clave en `angulosLocales` si
   de verdad se pasó un valor.
2. Anillo oscuro visible en el codo: cada `FormaAhusada` con el mismo
   `url(#lucia-hoodie)` calculaba el degradado relativo a SU PROPIA caja
   (`objectBoundingBox`, el default de SVG) — con el brazo fundido en una sola
   pieza esto nunca se notaba, pero con 3 piezas separadas (torso/brazo/antebrazo)
   cada una queda con un tono ligeramente distinto en la unión. Fix:
   `gradientUnits="userSpaceOnUse"` con coordenadas absolutas del personaje, para
   que todas las piezas "hoodie" compartan el mismo degradado continuo. Mismo fix
   aplicado a `lucia-jeans` preventivamente.
3. (Ajuste de diseño, no bug) El "cap" del hombro se ve bien CON su propio
   contorno (se lee como el hombro redondeado, igual que en `PruebaHombroFK`
   contra un torso circular) — pero el mismo cap CON contorno en el codo se veía
   como una articulación mecánica (bola/rótula), no como un codo. Se le quitó el
   contorno propio al cap del codo (solo relleno, el contorno de los 2 huesos ya
   define la silueta) — la regla parece ser: cap con contorno en articulaciones
   "terminales visibles" (hombro contra el torso), sin contorno en articulaciones
   intermedias (codo, muñeca, rodilla).

### Animación real por frame (2026-11-09)

El brazo de Lucía ya tiene un balanceo de reposo frame-driven (`useCurrentFrame()`
+ `evaluarFK`, no un `<g rotate>` suelto) — probado en 5 cuadros repartidos en un
ciclo (15/30/45/60/75), cada uno validado (1 sola pieza conectada) e inspeccionado
visualmente en mosaico: el movimiento es continuo y limpio en todo el rango, no
solo en los 3 ángulos puntuales probados antes. La fase del balanceo es múltiplo
de 180° a propósito — en el frame 0 (el que usa `remotion still` por defecto para
las previsualizaciones de aprobación) el balanceo vale exactamente 0, así que la
pose de reposo exacta sigue intacta para el flujo de aprobación existente
(verificado: mismo conteo de píxeles que antes del cambio). Si se pasa una pose
explícita (`anguloHombro`/`anguloCodo`, como en las pruebas de saludo/codo
doblado), esa pose gana — no se le suma el balanceo.

### Contrato `ParteVisual` extendido — ✅ cerrado (2026-11-09)

`ParteVisual.render` pasó de `() => React.ReactNode` a `(ctx: ContextoAnimacion) =>
React.ReactNode`, con `ContextoAnimacion = { animar, frame }` — el mismo
animar/frame que `CharacterPuppet` ya calculaba para breath/blink/look, ahora
disponible para CUALQUIER parte de CUALQUIER personaje, no solo Lucía. Gracias a
que TypeScript permite que una función `() => X` siga siendo válida donde se
espera `(ctx) => X` (contravarianza de parámetros), **Tito y Rocco no necesitaron
ningún cambio** — sus `render: () => ...` existentes siguen compilando y
funcionando igual, confirmado con `tsc --noEmit` limpio antes de tocarlos.

Lucía se migró al canal oficial: `Brazo` ya no llama a `useCurrentFrame()` por su
cuenta, recibe `ctx` desde `cuerpo.render(ctx)` (que a su vez lo recibe de
`CharacterPuppet` vía `Placeholder`). Esto cerró la inconsistencia real que tenía
el balanceo: antes ignoraba `animar`; ahora, verificado, con `animar=false` (el
valor real que usa `PreviewPersonaje` en todas las previsualizaciones de
aprobación) el frame 50 es pixel-idéntico al frame 0 — el balanceo se apaga
correctamente, igual que ya hacían breath/blink/look.

Un único call-site externo (`PreviewObjeto.tsx`, que llama a `render()` fuera de
`CharacterPuppet` para objetos sueltos) necesitó actualizarse para pasar un
contexto estático (`{ animar: false, frame: 0 }`), consistente con que esa
previsualización siempre fue "sin animación, para revisar/aprobar".

### Cadera + rodilla — ✅ cerrado (2026-11-09)

Piernas reconstruidas igual que los brazos: `muslo` (cadera→rodilla) +
`pantorrilla` (rodilla→tobillo), jerarquía real vía `evaluarFK`, balanceo de peso
sutil respetando `ctx.animar`. **Sin cap en la cadera** — ahí la pierna (jeans) se
encuentra con el borde plano del torso (hoodie): es un cambio de color de cintura,
no una fusión de la misma pieza, nunca necesitó taparse.

**Un bug más encontrado y corregido**: el cap de la rodilla, con el radio EXACTO
del hueso (mismo truco que funcionó en el codo), dejaba un arco visible asomando
— un círculo perfecto no cubre exactamente el borde redondeado que arma
`FormaAhusada` en la punta de un hueso (son 2 construcciones geométricas
distintas: una tangente de 2 círculos, la otra un círculo simple — coinciden en el
punto de tangencia, no en todo el contorno). Fix: el cap de la rodilla usa el
radio del hueso **+3**, puramente cosmético (no afecta la geometría del hueso en
sí, solo qué tan grande se dibuja el parche que tapa la unión) — resuelto,
verificado con zoom. El codo no se tocó (ya se veía bien) para no arreglar lo que
no estaba roto.

Demostrado con una pose real de rodilla doblada (zancada de caminata) — limpia,
sin costuras, lista para servir de base al clip "walk" de la Fase 5.

**Muñeca/tobillo**: no se construyeron como huesos aparte — la mano/pie ya quedan
correctamente posicionados en el extremo distal del antebrazo/pantorrilla (su
rotación ya sigue la del hueso padre); un hueso adicional ahí solo aportaría valor
si en el futuro se necesita rotar la mano/pie de forma independiente (p.ej. un
gesto de muñeca) — se deja como extensión futura, no como pendiente bloqueante.

**Criterio de aceptación:** hombros, codos, caderas y rodillas se mueven
individualmente sin separaciones ni deformaciones visuales — **cumplido y
verificado con 2 personajes reales posados** (saludo con brazo, zancada de
pierna). Queda abierta la pregunta de muñeca/tobillo como huesos independientes,
pero no bloquea nada de lo planeado para la Fase 5.

---

## Fase 5 — Biblioteca de animaciones

**Estado: 🔄 en progreso — núcleo + 2 clips reales + capas (`combinarClips`) funcionando end-to-end (2026-11-10).**

### Construido

- `engine/animation/types.ts` — `ClipAnimacion` (id, categoría, duración, loop,
  pistas), `PistaAngular` (huesoId + claves), `ClaveAngular` (frame + ángulo).
  Clips son DATOS, no saben nada de ningún personaje — una pista anima un ID de
  hueso genérico ("brazo", "muslo", etc. — los mismos IDs que usa `engine/rig`),
  no coordenadas de Lucía.
- `engine/animation/evaluator.ts` — `evaluarClip` (interpolación LINEAL entre
  claves a propósito, nada de curvas adivinadas; valida ≥2 claves y orden
  estrictamente creciente, lanza error descriptivo si no) + `combinarClips`
  (combina varias evaluaciones, "el último gana" por hueso — capas simples,
  sección 8.3 del plan maestro). 10 pruebas reales (`evaluator.test.ts`).
- 2 clips reales: `CLIP_SALUDAR` (gesto, un brazo, no-loop: sube, agita el
  antebrazo 3 veces, vuelve a reposo) y `CLIP_CAMINAR` (locomoción, una pierna,
  loop) — en `engine/animation/clips/`.
- `lucia.tsx`: `Brazo`/`Pierna` aceptan un `clip?` opcional — si se pasa, tiene
  prioridad sobre pose explícita y sobre el balanceo de reposo. Reflejo
  lado-izquierdo con el mismo criterio que `anguloReposo` (`180 - ángulo`) vía un
  helper compartido `anguloDeClip`.

### Demostrado con un personaje real

Probado: brazo izquierdo reproduciendo `CLIP_SALUDAR` + ambas piernas
reproduciendo `CLIP_CAMINAR` **con la pierna derecha desfasada medio ciclo**
(`ctx.frame + duracionFrames/2`, pasado como un `ctx` modificado — así se alternan
sin que el clip necesite saber que hay 2 piernas, exactamente como anticipa la
sección 8.2 del plan maestro). 6 cuadros repartidos en el rango de ambos clips,
todos validados (1 sola pieza conectada) e inspeccionados en mosaico — saludo y
caminata visibles, sin costuras ni piezas sueltas. Revertido a reposo para el
estado normal del personaje (los clips no están conectados permanentemente
todavía — ver pendientes).

### `combinarClips` conectado de verdad — ✅ cerrado (2026-11-10)

El pendiente real no era "animar 2 partes del cuerpo a la vez" (eso ya funcionaba:
cada extremidad es su propia cadena de `evaluarFK`, así que un clip en el brazo y
otro en la pierna ya convivían sin tocarse). El hueco real era que `combinarClips`
—con su regla "el último gana si 2 capas tocan el MISMO hueso"— nunca se había
usado dentro de `Brazo`/`Pierna`, solo en pruebas unitarias con datos sintéticos.

Cerrado: `Brazo`/`Pierna` cambiaron su prop `clip?: ClipAnimacion` (una sola capa)
por `clips?: ClipAnimacion[]` (varias capas, combinadas con `combinarClips` de
verdad vía el helper compartido `angulosDeClips`). Demostrado de forma temporal
(wiring revertido después, mismo patrón que toda la Fase 4/5): `CLIP_SALUDAR`
(toca "brazo" y "antebrazo") + una capa overlay sintética que solo toca
"antebrazo" — en el frame 20, verificado tanto numéricamente (llamando a las
funciones reales: `brazo=-70` de la capa base intacto, `antebrazo=60` del
overlay, confirmando que el hueso NO tocado por el overlay no se pisa) como
visualmente (render + `validar_silueta.mjs`: 1 sola pieza conectada, sin
auto-intersección pese al ángulo poco natural — la pose en sí es un valor
sintético para probar el mecanismo, no una animación pensada para verse bien).
Revertido el wiring temporal y re-verificado: `tsc`/`vitest` limpios, render de
Lucía en reposo pixel-idéntico al estado anterior al cambio.

### Tercer clip real: `CLIP_SENALAR` (point) — ✅ (2026-11-10)

Mismos huesos que `CLIP_SALUDAR` (brazo/antebrazo), pero el antebrazo se queda
RECTO todo el gesto (sube y se extiende, se mantiene, vuelve a reposo) — es lo
que distingue "señalar" de "saludar" (que agita el antebrazo). Demostrado en 4
cuadros (0/10/20/30) temporalmente conectado al brazo derecho de Lucía, cada uno
con 1 sola pieza conectada (`validar_silueta.mjs`) e inspeccionado en mosaico —
el brazo sube y se extiende limpiamente, sin costuras. Wiring revertido, render
de reposo pixel-idéntico al estado anterior.

### Por qué NO se hicieron idle/sit/stand/talk/emociones como `ClipAnimacion` (decisión arquitectónica, no un "no me alcanzó el tiempo")

Investigando cómo encajaría cada uno, aparecieron límites reales del modelo
actual — documentados aquí en vez de forzar un clip que no sirve de verdad:

- **Idle**: el balanceo de reposo es necesariamente un DELTA alrededor del
  ángulo de reposo propio de CADA personaje (`anguloReposo`, distinto por
  personaje/hueso) — pero `ClaveAngular.angulo` en el modelo actual es un ÁNGULO
  ABSOLUTO (como los de `CLIP_SALUDAR`/`CLIP_SENALAR`/`CLIP_CAMINAR`, pensados
  para gestos/locomoción que SÍ reemplazan la pose por completo mientras duran).
  Un clip de idle con ángulos absolutos solo funcionaría para un personaje con
  ESE ángulo de reposo exacto — no es genérico, rompería el principio de "huesoId
  genérico, cualquier biped lo reproduce" que sí cumplen los otros 3 clips. Se
  necesitaría un tipo de pista aditiva (delta sobre el reposo), que es una
  extensión real del modelo de datos, no un clip más — queda documentada como
  trabajo futuro explícito, no se improvisa aquí. El balanceo hardcodeado actual
  (gated por `ctx.animar`, ya revisado en la Fase 4) se queda como está: es
  honestamente el lugar correcto para vivir mientras no exista ese tipo de pista.
- **Sit/stand**: requeriría que el TORSO rote en la cadera — el torso de Lucía
  (`construirTorso`) sigue siendo una sola pieza estática fundida (Fase 3), no un
  hueso (Fase 4 nunca le dio un pivote de cadera al torso, solo a las piernas).
  Sin eso, "sentarse" solo podría doblar las piernas con el torso rígido
  vertical — en un personaje dibujado de frente (no de perfil) esto se ve como
  la pierna pateando hacia adelante, no como sentarse. Construir un clip así
  sería inventar contenido que no se ve bien para poder tachar un casillero —
  se deja pendiente hasta que el rig tenga un pivote de cadera en el torso.
- **Talk**: la boca YA se anima (visemas, sistema separado por completo de
  `engine/animation` — ver `bocas`/`ojosAbiertos` en `PersonajeDef`, dirigido por
  `lineasAudio`). Un "clip de hablar" en el sentido de `ClipAnimacion` tendría
  que ser un gesto de manos mientras se habla — contenido especulativo sin un
  requisito real detrás todavía; se retoma si la Fase 9 (audio/sync) lo pide.
- **Emociones**: se expresan con cejas/ojos/boca (swaps estáticos por frame, ver
  `cejas`/`ojosAbiertos`/`ojosCerrados` en `PersonajeDef`), no con ángulos de
  hueso — fuera del modelo de `ClipAnimacion` por completo, no es un hueco de
  esta fase sino un sistema distinto que ya existe y no necesita `engine/animation`.

### Pendiente dentro de esta fase

- Pista aditiva/delta en `ClipAnimacion` (necesaria para idle-como-clip, ver arriba).
- Pivote de cadera en el torso (necesario para sit/stand con sentido visual).
- Los clips no están conectados a ningún disparador real todavía (hoy se activan
  cambiando código a mano para la demo) — eso es trabajo de la Fase 7/8 (motor de
  escenas / Director IA decide qué clip reproducir y cuándo).

## Fase 6 — Biblioteca de recursos

**Estado: 🔄 en progreso — registro consultable real (2026-11-10).**

### Construido

- `FondoDef` (`catalog/types.ts`) extendido con `metadatos?: MetadatosActivo` —
  mismo campo opcional/aditivo que ya tenía `PersonajeDef` desde la Fase 1.
  Poblado en el único fondo real que existe hoy (`library/fondos/bosque.tsx`,
  id `environment_forest_001`).
- `engine/registry/` — capa de consulta SOBRE `library/registry.ts`
  (`PERSONAJES_VECTOR`/`FONDOS_VECTOR`, auto-generado por
  `scripts/generar_registry.mjs`; ese generador no se toca ni se reemplaza).
  `construirIndice()` une `assetRef` + `metadatos` de lo que SÍ declara
  metadatos (no retroactivo). Expone: `todosLosActivos`, `buscarPorId`,
  `buscarPorAssetRef`, `buscarPorTipo`, `buscarPorTag`, `buscarPorCapacidad` —
  cubre literalmente lo que pide la sección 4.2 del plan maestro ("registrar,
  buscar por ID, por categoría, por etiquetas, consultar capacidades").
- 9 pruebas reales (`engine/registry/registro.test.ts`) corriendo contra los
  datos REALES de la biblioteca (no un índice de prueba aparte): confirma 3
  personajes + 1 fondo indexados, separación correcta por tipo, búsqueda por id
  estable de Lucía, `buscarPorId`/`buscarPorTag` con valores inexistentes
  devuelven `undefined`/`[]` (no lanzan, no inventan), `buscarPorCapacidad("tail-wag")`
  devuelve solo a Rocco, `buscarPorTag("animal")` devuelve Tito+Rocco y excluye a
  Lucía.
- **Objetos (`OBJETOS_VECTOR`) quedan fuera del índice a propósito**: `ParteVisual`
  no tiene campo `metadatos` todavía y hoy no existe ningún objeto real en la
  biblioteca — se documenta como pendiente (necesitará su propio `ObjetoDef` o
  extender `ParteVisual`, igual que se hizo con Personaje/FondoDef en la Fase 1),
  no se resuelve en abstracto sin un consumidor real.

### Bug propio encontrado verificando (no del código de producción, del método de verificación)

Al re-renderizar Tito/Rocco/Lucía para confirmar que los cambios de `FondoDef`
no rompían nada, usé el prop equivocado (`personaje` en vez de `asset_ref`, el
que de verdad espera `PreviewPersonaje.tsx`) — los 3 renders cayeron en el mismo
mensaje de error "no encontrado" y salieron **pixel-idénticos** (mismo md5). La
alerta de "segunda región casi tan grande como la principal" de
`validar_silueta.mjs` sobre esos 3 archivos era sobre las letras del mensaje de
error, no sobre los personajes. Detectado comparando md5 antes de confiar en el
resultado (no se reportó éxito con ese dato) — corregido el prop, los 3 renders
salieron distintos entre sí y correctos: Tito y Lucía 1 sola pieza conectada,
Rocco 2 (cuerpo + hueso de prop suelto, ya conocido y aprobado desde la auditoría
inicial, no es una regresión nueva). Confirmado también por inspección visual
directa de los 3 PNG.

### Pendiente dentro de esta fase

- Asset Factory (`createHumanCharacter({...})`-estilo, sección 4 del plan
  maestro) — **deferido a propósito** (decisión tomada sin preguntar, documentada
  aquí): hoy solo existe UN personaje humano real con rig (Lucía) — construir una
  fábrica paramétrica genérica ahora sería diseñar para un segundo caso
  hipotético que todavía no existe, justo lo que el plan maestro pide evitar. Se
  retoma en cuanto haya un segundo personaje humano real que la necesite de
  verdad (la generalización de `construirTorso`/`construirTorsoYBrazos` ya
  demostrada en la Fase 3 con 3 proporciones distintas es la base que usaría).
- Resolución de dependencias y validación de compatibilidad entre activos — no
  empezada, mismo motivo (sin un segundo caso real, es prematuro).
- El índice recalcula `construirIndice()` en cada llamada (sin cachear) — no es
  un problema real hoy (4 activos, nada remotamente caliente en un pipeline de
  render), se deja así hasta que haya un motivo concreto para cachear.

## Hallazgo importante (2026-11-10): las Fases 7, 8 y 9 YA EXISTÍAN, construidas antes de este plan

Auditando el resto del repo antes de seguir (no asumir que "pendiente" en este
documento significaba "no construido" — este documento se escribió enfocado solo
en el motor nuevo de esta sesión, sin revisar primero el resto del pipeline), se
confirmó que gran parte de lo que estas 3 fases pedían **ya está construido y
probado**, en una sesión anterior, documentado en `docs/PROGRESS.md` (no en este
archivo, que es nuevo):

- **Motor de escenas (Fase 7)**: `episode_spec/schema.json` (JSON Schema real,
  consumido tanto por el generador en Python como por el renderer en TS) +
  `EpisodeRenderer.tsx` (`TomaIlustrada`) + `EpisodioCompleto.tsx`. Ya resuelve
  timeline (episodio→escenas→tomas, `<Series>`), cámara (`useCamera2D`, zoom
  inicial/final, golpes de zoom atados a eventos), capas por profundidad
  (`ParallaxLayer`), efectos (humo/niebla/lluvia/partículas/viñeta/grano/color
  grade), subtítulos y globos de diálogo — todo dirigido por el spec JSON.
- **Director IA (Fase 8)**: `apps/pipeline_spec/generar_episode_spec.py` ya
  convierte un guion de texto en un `episode_spec` válido vía **Bedrock**
  (Amazon Nova por defecto, Claude como alternativa), con reintento automático
  si el JSON no cumple el schema (hasta `--max-reintentos` veces, el error de
  validación se le devuelve al modelo en el siguiente turno). Probado a fondo
  con `--dry-run` y un cliente de Bedrock simulado — **nunca ejecutado contra la
  API real**.
- **Audio y sincronización (Fase 9)**: `apps/pipeline_audio/` (Polly y
  Whisper+Rhubarb, dos caminos con la misma forma de salida — palabras/visemas
  por frame) y `apps/pipeline_2d/` (personajes/fondos vía Stability) — mismo
  patrón: código completo, probado localmente con `--dry-run`, nunca ejecutado
  de verdad.
- **Por qué nunca se ejecutaron de verdad**: el usuario pidió explícitamente,
  el **2026-10-26** (`docs/PROGRESS.md`, sección "Pausa de costos AWS"), parar
  todo gasto real de AWS hasta tener el sistema completo en código — primero
  construir todo, probarlo con mocks/dry-run, y recién después probar la
  generación real de punta a punta. Esa decisión sigue vigente y el usuario la
  reconfirmó explícitamente el 2026-11-10 al preguntarle cómo interpretar
  "terminar todo el proyecto" dado este hallazgo: **seguir solo con trabajo de
  código, sin gastar en AWS**, y avisar en vez de ejecutar cuando se llegue al
  punto donde lo único que falte sea invocar la API real.

**Lo que de verdad faltaba** (y es lo que se cerró después de este hallazgo, ver
abajo) no era construir estas 3 fases desde cero — era conectar el motor de
animación NUEVO de esta sesión (rig/clips, Fases 4-5) a este pipeline YA
EXISTENTE, para que el Director IA pudiera pedir gestos de verdad.

## Fase 7 — Motor de escenas

**Estado: ✅ ya existía (ver hallazgo arriba) + conectado al sistema de clips (2026-11-10).**

### Conectado: un personaje puede reproducir un clip de animación, pedido desde el spec

- `ContextoAnimacion` (`components/CharacterPuppet.tsx`) += `clips?:
  ClipAnimacion[]` y `clipFrame?: number` — el mismo canal oficial de la Fase 4
  (animar/frame), ahora también transporta qué clips están activos y en qué
  frame LOCAL del clip (independiente del frame real, para que un gesto pueda
  empezar a mitad de una toma sin desincronizar breathing/blink/look).
  `CharacterPuppet` recibe `clips`/`clipsInicioFrame` como props nuevas y
  construye ese contexto — opcional, aditivo, no rompe a Tito/Rocco (que no
  leen `ctx.clips`) ni al call-site de `PreviewObjeto.tsx`.
- `lucia.tsx`: `cuerpo.render(ctx)` despacha `ctx.clips` por `categoria` del
  clip (esto es decisión de ESTE personaje, no del motor genérico): `"gesto"`
  va al brazo derecho (misma convención de autor que ya usan
  `CLIP_SALUDAR`/`CLIP_SENALAR`), `"locomocion"` va a AMBAS piernas, la
  izquierda con medio ciclo de desfase — el mismo patrón que ya se había
  demostrado a mano en la Fase 5, ahora conectado de verdad al spec en vez de a
  código editado para la demo.
- `engine/animation/clips/registro.ts` (nuevo): `buscarClip(id)` resuelve un
  string (el `clip_id` que vendría del spec) a un `ClipAnimacion` real — 3
  pruebas reales.
- `episode_spec/schema.json`: `personajes_en_escena[].gesto` nuevo (opcional,
  `clip_id` + `inicio_frame`) — un `clip_id` desconocido se ignora (el
  personaje queda en reposo), no es un error de validación. Confirmado que
  `ejemplo_15s.json` sigue validando sin cambios, y que un spec CON `gesto`
  también valida (`jsonschema.validate`, ambos casos probados).
- `EpisodeRenderer.tsx` (`TomaIlustrada`): resuelve `gesto.clip_id` vía
  `buscarClip`, pasa el clip encontrado + `inicio_frame` a `CharacterPuppet`.

### Bug real encontrado verificando esta conexión (no introducido por este cambio, pero bloqueaba probarlo)

`catalog/personajes.tsx` (el catálogo "escrito a mano", camino PNG/Stability de
la vieja Fase A4) tenía una entrada placeholder-only para
`"2d/personajes/lucia"` (solo `colorPlaceholder`, sin partes) que sobrevivía
desde antes del pivote a biblioteca de código vectorial. Como
`personajesCatalogo[ref] ?? (personajeVector ? ... )` solo cae al vector real
cuando el catálogo a mano NO tiene esa clave, esa entrada placeholder TAPABA
silenciosamente a la Lucía real (con rig/clips/cara) en
`PruebaEpisodeSpec`/`PruebaAudioReal` — ambas composiciones mostraban el
círculo genérico de `CharacterPuppet` en vez del personaje real, incluso antes
de este cambio. Detectado al revisar el primer render de prueba del gesto (el
personaje no tenía cara ni ropa). Corregido vaciando esa entrada (documentado en
el propio archivo); verificado que ambas composiciones ahora muestran a la
Lucía real, sin crash, y que `PruebaAudioReal` incluso gana algo (el lip-sync
real ahora tiene una boca real que mostrar, antes no tenía ningún efecto visible).

### Verificación end-to-end (la prueba real de que el Director IA podrá usar esto sin tocar código)

Wiring temporal en el fixture compartido `fixtures/ejemplo15s.json` (agregar
`"gesto": {"clip_id": "senalar", "inicio_frame": 20}` a la entrada de Lucía,
revertido después — mismo patrón de todo el resto de la sesión): renderizados
los frames 0/20/30/50/70 de `PruebaEpisodeSpec` (toma completa: fondo, cámara,
partículas, subtítulos, TODO lo demás intacto). Resultado correcto y esperado
por la propia matemática de `evaluarClip` (no coincidencia): frame 0 y 20 en
reposo (clip aún en su propio frame 0), frame 30 y 50 señalando (brazo extendido,
fase de sostenido del clip), frame 70 de vuelta a reposo (clip ya terminado, no
hace loop). Inspección visual (mosaico + crop de cerca) confirma brazo extendido
limpiamente, sin costuras. **Este es el resultado real que demuestra que un
`episode_spec` generado por IA (Fase 8) ya podría pedir un gesto real hoy,
escribiendo 2 campos de JSON — cero cambios de código por episodio.** Fixture
revertido, `tsc`/`vitest` (59/59) limpios, Tito/Rocco/Lucía (`PreviewPersonaje`)
pixel-idénticos al estado anterior.

## Fase 8 — Director de escenas mediante IA

**Estado: ✅ ya existía (ver hallazgo arriba) + prompt actualizado con el catálogo de clips (2026-11-10). Ejecución real contra Bedrock sigue bloqueada por la pausa de costos del usuario (2026-10-26) — no se tocó.**

`apps/pipeline_spec/generar_episode_spec.py::construir_system_prompt` ya le
pasaba al modelo el schema completo (con lo cual ya "sabía" de la existencia del
campo `gesto` en teoría, por estar en el JSON Schema) pero no tenía forma de
saber QUÉ `clip_id` son reales — mismo problema que ya resolvía
`personajes_catalogo` para evitar que el modelo inventara `asset_ref`
inexistentes. Agregado `CLIPS_DISPONIBLES` (lista a mano de los 3 clips reales
con su categoría/descripción — duplicada a propósito desde
`engine/animation/clips/registro.ts`, que es TypeScript y no se puede importar
desde Python; documentado en el propio archivo que si la biblioteca de clips
crece bastante, esto debería generarse desde esa misma fuente en vez de
mantenerse a mano en 2 lugares, igual que ya hace `generar_registry.mjs` para
assets) inyectada en el prompt cuando `estilo == "ilustrado"`.

**Verificado sin gastar nada**: sintaxis Python válida, `--dry-run` corrido de
verdad (mismo patrón que ya usaba el proyecto desde la pausa de costos) —
confirma que el prompt ahora incluye el catálogo de clips (8847 caracteres,
antes menos) y que **0 llamadas a Bedrock se ejecutaron**. No se verificó que el
modelo de verdad USE bien este campo (eso solo se sabe invocando la API real,
bloqueado por la pausa de costos) — la parte verificable sin gastar (que el
prompt se construye correctamente y el schema lo acepta) sí quedó confirmada.

**Lo que falta para que esto funcione de punta a punta** es, literalmente, UNA
sola cosa: que el usuario autorice gastar en AWS para invocar
`generar_episode_spec.py` contra Bedrock de verdad (y, para un episodio
completo real, también Polly/audio). Eso no se hizo en esta sesión — queda como
el límite explícito de "hasta acá llega el trabajo de código".

## Fase 9 — Audio y sincronización

**Estado: ✅ ya existía (ver hallazgo arriba), ya conectada al motor. Nada nuevo que hacer en esta fase desde esta sesión.**

`EpisodeRenderer.tsx` ya consume `AudioLinea.visemas`/`palabras` (de Polly o
Whisper+Rhubarb, misma forma de salida) para mover la boca
(`visemaActivo`/`bocas[VisemaCode]`, el mismo contrato que ya usan
Tito/Rocco/Lucía) y alimentar `Captions`/`SpeechBubble`. `PruebaAudioReal.tsx`
ya lo prueba con audio real generado localmente (Whisper+Rhubarb, gratis, sin
Bedrock/Polly). Lo único pendiente es específicamente de producción (generar
audio real con Polly para un episodio real), bloqueado por la misma pausa de
costos que la Fase 8 — no es trabajo de motor/código pendiente.

## Fase 10 — Renderizado completo

**Estado: ✅ ya existía.** `EpisodioCompleto.tsx` + `remotion render` ya encadenan
todas las tomas de todas las escenas de un episodio completo en un solo mp4
(`Series`/`Series.Sequence`, duración real sacada del spec vía
`duracionTotalFrames`). Conectado con el resto (Fases 4-9) por construcción,
sin cambios adicionales necesarios desde esta sesión.

## Fase 11 — Expansión y optimización

**Estado: ⏳ pendiente, como corresponde** — es la única fase que de verdad va
DESPUÉS de un MVP real (nuevas familias anatómicas, IK, editor de escenas), y el
MVP real todavía depende de la ejecución contra AWS que sigue en pausa (ver Fase
8). No hay nada que adelantar aquí sin esa pieza.

## Fase 12 — Detectar qué necesita un guion + fábrica de assets (2026-11-14)

**Estado: ✅ completa (Fases A-D del plan `sleepy-tinkering-cascade.md`), verificada en el servidor real.**

Disparada por una pregunta directa probando el pipeline real: un episodio con un
guion sobre el estrés no tenía ningún personaje/fondo que encajara (solo existía
Lucía+bosque) — y la idea real del usuario es poder mandar CUALQUIER guion. Esto
reveló que el sistema de antes solo sabía elegir entre un elenco fijo, nunca
detectar qué hace falta ni crear nada nuevo.

### Fase A/B — Detectar + emparejar (sin IA inventando geometría)

- `apps/pipeline_spec/detectar_necesidades.py` (Bedrock, mismo patrón que
  `generar_episode_spec.py`): lee el guion, lista personajes/objetos/fondos
  necesarios con tags — NUNCA decide asset_ref ni dibuja nada.
- `app/matching.py` (Python puro, sin IA): empareja esas necesidades contra
  `library/registry.json` (ahora también generado por `generar_registry.mjs`,
  misma fuente que el `registry.ts` de TypeScript) por intersección de tags.
- Job `detectar_necesidades` + panel en `episodio_detail.html` ("Detectar
  necesidades") con tabla ✅ coincide / ⚠️ falta — antes de gastar en el resto.
- **Verificado con el caso real**: las 3 necesidades del guion del estrés
  ("una persona", "un corazón", "un cerebro") no encontraban nada al principio
  — después de la Fase B (ver abajo), las 3 resuelven con match perfecto.

### Fase C — Familias paramétricas (opción 1, elegida primero)

- `library/familias/persona.tsx` y `library/familias/icono.tsx`: factories
  (`crearPersona(params)`, `crearIcono(params)`) que reciben parámetros
  (tono de piel, color de ropa, forma del ícono) — reusan la misma geometría
  exacta que ya tenían `persona-generica.tsx`/`corazon.tsx`/`cerebro.tsx`
  (Fase B del plan anterior), sin duplicar código nuevo.
- `generar_registry.mjs` escanea `library/familias/` y expone
  `FAMILIAS_PERSONAJE_VECTOR`/`FAMILIAS_OBJETO_VECTOR` + `parametrosSchema` en
  `registry.json` — el dashboard arma el formulario de creación SOLO a partir
  de ese schema, sin hardcodear nada por familia nueva.
- `Personaje`/`Objeto` (DB) += `familia_ref`/`parametros`. Crear una instancia
  desde `/app/personajes` o `/app/objetos` sintetiza su propio `asset_ref`
  (`familia/<nombre>/<uuid>`) — sirve de id estable para el spec sin necesitar
  ningún archivo de código nuevo por instancia.
- `EpisodeRenderer.tsx` materializa la definición de una familia AL MOMENTO DEL
  RENDER (los parámetros viajan por `--props`, la factory vive en el bundle) —
  es lo único que no podía viajar ya armado, tendría funciones de render.
- **Bug real encontrado probando contra el servidor** (no en revisión de
  código): `asset_ref` es `NOT NULL` desde el INSERT — el código intentaba
  poblarlo recién después de un `flush()`, que ya fallaba antes de llegar ahí.
  Corregido generando el id del lado de Python antes de construir el modelo.
- **Verificado de punta a punta en el servidor real**: creada una instancia
  real (`piel: media, ropa: #8E5BD1`) vía API, generado su preview
  (`remotion still` real, sin AWS), confirmado visualmente que el color
  correcto salió en el render, y aprobada — mismo flujo genérico de
  "Revisar y aprobar" que ya usaban personajes/fondos.

### Fase D — Generación asistida por IA (opción 2, solo si la familia no alcanza)

**Alcance deliberado: solo objetos simples, sin rig.** Un personaje articulado
generado por IA necesitaría anclas/huesos coherentes sin ningún validador
geométrico que lo confirme — mucho más riesgoso que un objeto estático. Queda
fuera a propósito, no es un olvido.

- `apps/web/app/svg_seguro.py` + copia en `apps/pipeline_spec/svg_seguro.py`
  (duplicado a propósito, mismo criterio que `COSTO_PLACEHOLDER_TEXTO_USD`/
  `CLIPS_DISPONIBLES`: los scripts de `apps/pipeline_*` no importan código de
  `apps/web` para poder seguir corriendo standalone): sanea el SVG que devuelve
  el modelo con `xml.etree.ElementTree` (stdlib, sin dependencia nueva) y una
  lista blanca explícita de tags/atributos — cualquier otra cosa se elimina,
  nunca se "arregla". Probado contra `<script>`, `onclick`/`onload`,
  `<image>` externa, `javascript:` en atributos, `<foreignObject>` — todos
  neutralizados, el contenido real sobrevive.
- `apps/pipeline_spec/generar_objeto_ia.py` (Bedrock, mismo patrón que el
  resto): pide un SVG simple, lo sanea, reintenta si no sirve.
- Job `ia_objeto` + botón "Generar con IA" en la tabla de necesidades (solo
  para objetos sin match) + panel de revisión en `/app/objetos` (el SVG ya
  saneado se embebe inline, sin necesitar Remotion para previsualizarlo). El
  `Objeto` real se crea recién AL APROBAR (`routers/assets.py`), nunca antes.
- `SvgGenerado.tsx` + `engine/svgSeguro.ts` (segunda capa de saneo, en
  TypeScript — defensa en profundidad, no la capa principal) inyecta el SVG
  aprobado vía `dangerouslySetInnerHTML` — seguro acá porque Remotion renderiza
  sobre Chromium real, no SSR.
- **Bug real encontrado RENDERIZANDO** (otra vez no en revisión de código): el
  SVG guardado es un documento `<svg>...</svg>` completo, pero se inyectaba
  dentro de un `<g>` que ya vive adentro de OTRO `<svg>` — un `<svg>` anidado
  sin `width`/`height` propios no tiene tamaño por defecto, el primer render
  de prueba salió completamente en blanco. Corregido extrayendo solo el
  contenido interno (`extraerContenidoInterno`) antes de inyectar;
  re-verificado con el caso "malicioso" (script + onclick): el círculo real
  aparece, nada peligroso se ejecuta.

### Pendiente, fuera de alcance (documentado, no resuelto en esta fase)

**Los objetos — de CUALQUIER origen (biblioteca fija, familia, o IA) — todavía
no se pueden colocar dentro de una escena real.** `episode_spec`/
`EpisodeRenderer.tsx` nunca tuvieron el concepto de "objeto en escena" (solo
"personajes_en_escena") — es un hueco anterior a todo este trabajo, no
introducido ni resuelto acá. `SvgGenerado.tsx` queda listo (componente +
saneo + prueba visual) para cuando se construya ese mecanismo.

---

## MVP (criterio de "funciona de punta a punta")

El guion de aceptación del plan maestro ("Pedro entra a una oficina...") es
alcanzable EN CÓDIGO hoy mismo (todo el pipeline existe y está conectado,
incluyendo gestos reales pedidos desde el spec) — lo único que falta es
ejecutarlo contra servicios reales de AWS (Bedrock para generar el spec desde un
guion de verdad, Polly para audio real), bloqueado por la pausa de costos del
usuario (2026-10-26, reconfirmada 2026-11-10). No es una limitación de
arquitectura ni de las Fases 1-10 — es una decisión de negocio del usuario sobre
cuándo gastar, y se respeta tal cual hasta que él la levante explícitamente.

## Próximo paso inmediato

Con la Fase 12 cerrada, el sistema ya puede detectar qué necesita un guion
cualquiera, emparejarlo contra la biblioteca, y — si falta algo — crearlo desde
la app misma (familia paramétrica primero, IA con revisión humana si no
alcanza). **El trabajo de código puro que se podía hacer sin gastar en AWS
está sustancialmente completo.** Queda, sin bloquear nada de lo anterior:
"objeto en escena" (hueco pre-existente documentado en la Fase 12), más
plantillas/familias si aparece una necesidad concreta nueva, personajes
generados por IA (deferido a propósito, necesita resolver anclas/huesos
primero), y Fase 11 (después de un MVP real). El siguiente paso real de FONDO
ya no es de código — es que el usuario decida cuándo levantar la pausa de
costos de AWS para probar
Bedrock/Polly de verdad por primera vez.
