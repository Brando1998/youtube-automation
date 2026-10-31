# Presupuesto y costos, en detalle

Esta página explica exactamente cómo se calcula cada número que ves en el
dashboard — para confiar en el sistema hace falta saber de dónde sale cada
cifra, no solo creerle.

!!! note "Las filas de Stability quedaron sin uso"
    Desde el pivot a biblioteca vectorial (2026-10-31, ver `docs/PROGRESS.md`),
    personajes/fondos/objetos ya no llaman a Stability — son código. Las filas de
    Stability de abajo describen `apps/pipeline_2d/generar_hoja.py`/
    `generar_partes.py`/`generar_fondo.py`, que siguen en el repo pero sin usarse.
    Quedan documentadas por si alguna vez se retoma ese camino.

## Precios usados (verificados contra AWS, con una excepción)

| Servicio | Operación | Precio | Fuente |
|---|---|---|---|
| Bedrock / Stability | Stable Image Core (texto→imagen) | ~$0.03 / imagen | Verificado en una sesión anterior (`docs/PROGRESS.md`) — la página de pricing de Bedrock es dinámica y no se pudo re-confirmar en la sesión que agregó el presupuesto. Revisar de nuevo antes de un gasto grande. |
| Bedrock / Stability | Stable Image Ultra | ~$0.08 / imagen | Misma nota que arriba — no se usa hoy en el pipeline (solo Core), queda documentado por si se agrega. |
| Bedrock / Stability | Remove Background / Search and Replace | $0.07 / llamada | Confirmado en `aws.amazon.com/bedrock/pricing` directamente. |
| Polly | Standard | $4.00 por millón de caracteres | Confirmado en `aws.amazon.com/polly/pricing`. |
| Polly | Neural (el que usa el proyecto por defecto) | $16.00 por millón de caracteres | Ídem. |
| Polly | Long-form | $100.00 por millón de caracteres | Ídem (no se usa hoy). |
| Polly | Generative | $30.00 por millón de caracteres | Ídem (no se usa hoy). |
| Bedrock / Nova o Claude | Generar el episode spec | Placeholder plano de $0.05 por intento | **No verificado con confianza** — ver más abajo. |

## Por qué el episode spec tiene un placeholder, no un precio por token

Para Stability y Polly el precio es por llamada/carácter, así que se puede saber
el costo **exacto antes de gastar**. Para Nova/Claude el precio real es por
token de entrada/salida — la página de precios de Bedrock es dinámica y, al
construir este sistema, no se logró extraer con confianza las cifras exactas
(los números que devolvió la herramienta de scraping eran inconsistentes entre
sí). En vez de inventar un precio por token, se usa un número fijo conservador
por intento (`COSTO_PLACEHOLDER_TEXTO_USD = 0.05` en
`apps/web/app/costos.py` y en `apps/pipeline_spec/generar_episode_spec.py`).

Esto no afecta mucho en la práctica: generar un spec de un guion corto con Nova
Lite cuesta, en la realidad, fracciones de centavo — muy por debajo de lo que
cuestan las imágenes o la voz de un episodio de varios minutos. El placeholder
es solo para que la guardia de presupuesto tenga *algo* con qué comparar antes
de llamar a Bedrock, no para que sea exacto.

**Lo que sí es exacto**: después de una llamada real, el sistema guarda el
conteo real de tokens que devolvió la respuesta (`UsageLog.cantidad`, unidad
"tokens") — no es el placeholder, es el dato real. Si en algún momento se
confirma el precio por token oficial, ajustar `costos.py` y los scripts para
usar ese número en vez del placeholder es un cambio chico y acotado.

## Cómo se calcula cada estimación (antes de gastar)

- **hoja_personaje**: 1 llamada a Stable Image Core → `$0.03`.
- **partes_personaje**: 5 partes simples + boca en reposo (6 × remove_bg) + 6
  visemas (cada uno 2 llamadas: search_replace + remove_bg) + 1 si hay `prop` →
  entre 18 y 19 llamadas × $0.07.
- **fondo**: 2 llamadas por capa (texto-a-imagen + remove_bg) × número de capas.
- **voz_polly**: `2 × caracteres_del_texto × precio_del_engine` (las 2 llamadas
  de Polly — marcas y audio — sintetizan el mismo texto completo cada una).
- **episode_spec**: `$0.05 × max_reintentos` (caso peor, 3 intentos por
  defecto).
- **render_episodio**: sin costo — corre local, no toca AWS.

## Cómo se calcula el costo acumulado (después de gastar)

Cada script, al terminar una corrida real (no simulada), imprime una línea
`USO_REAL: [...]` con el uso **exacto** (no la estimación) — cuántas llamadas
hizo de verdad, cuántos caracteres mandó, cuántos tokens devolvió el modelo. El
backend (`pipeline_runner._loguear_uso_real`) la lee y guarda un registro en
`UsageLog`. El costo acumulado de un episodio es la suma de esos registros para
los jobs que tienen `episodio_id` — por eso personajes/fondos (que no tienen
`episodio_id`, son compartidos) no entran en esa suma.

## Dónde mirar los números crudos

- `GET /episodios/{id}` trae `costo_acumulado_usd` ya calculado.
- Cada fila de `UsageLog` en la base de datos tiene `servicio`, `operacion`,
  `cantidad`, `unidad` y `costo_estimado_usd` — si alguna vez hace falta
  auditar gasto real por tenant (por ejemplo, para facturar si la app se
  vende), está todo ahí.
