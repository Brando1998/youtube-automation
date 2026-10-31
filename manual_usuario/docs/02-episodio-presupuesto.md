# 2. Crear el episodio y fijar el presupuesto

En `/app/episodios`, completá el formulario **"Nuevo episodio"**:

| Campo | Qué poner |
|---|---|
| Título | El nombre del episodio, libre. |
| Estilo | `ilustrado` (2.5D, Remotion — el único estilo activo; `3d`/Blender se abandonó el 2026-10-31, no usar). |
| Modo de voz | `narrador` (solo voz en off), `dialogos` (solo personajes hablando) o `mixto` (los dos). |
| Guion | Opcional acá — se puede completar después, antes de generar el spec. |
| **Presupuesto en USD** | El tope de gasto para **este** episodio. Dejalo vacío si no querés límite. |

## Qué cubre el presupuesto (y qué no)

Después del pivot a biblioteca vectorial (ver `docs/PROGRESS.md`, 2026-10-31),
**personajes/fondos/objetos ya no gastan AWS en absoluto** — son código, no
imágenes generadas. Lo único que el presupuesto de un episodio cubre hoy:

- generar el episode spec (guion → JSON, vía Claude/Nova en Bedrock),
- la voz de cada línea (Polly),
- el render final (siempre fue local, cero AWS).

Construir la biblioteca de personajes/fondos/objetos ([capítulo 4](04-personajes.md),
[capítulo 5](05-fondos.md)) es ahora gratis — podés hacer todos los que quieras
sin que toque el presupuesto de ningún episodio.

## Ver y cambiar el presupuesto después

Entrando al episodio (click en el título desde la lista), arriba de todo hay un
panel **"Presupuesto de este episodio"** con:

- cuánto llevás gastado (`costo_acumulado_usd`, con 4 decimales — los centavos
  importan cuando una llamada cuesta $0.03),
- una barra que se pone amarilla al 75% del presupuesto y roja al 100%,
- un campo para cambiar el tope cuando quieras (dejalo vacío para sacar el
  límite).

## Si un job se bloquea por presupuesto

Cuando pidas generar algo real (no simulado) y el costo estimado haría que te
pases del presupuesto, el job no corre — queda **fallido** con un mensaje como:

```
excedería el presupuesto del episodio: estimado $0.0640, disponible $0.0500
(ya gastado $0.0 de $0.05). Repetí el job con forzar=true para gastar igual.
```

Cada formulario que gasta (generar episode spec, generar voz) tiene un checkbox
**"Forzar aunque exceda el presupuesto"** — tildalo y volvé a mandar el mismo
formulario si de verdad querés gastar igual. O, más prolijo: subí el presupuesto
en el panel de arriba y mandá el job de nuevo sin forzar nada.

Más detalle de cómo se calcula cada estimación (precios de Stability/Polly, de
dónde salen) está en [Presupuesto y costos, en detalle](presupuesto.md).
