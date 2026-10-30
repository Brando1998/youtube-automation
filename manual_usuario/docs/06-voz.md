# 6. Voz de cada línea

A diferencia de personajes/fondos, la voz **sí es por episodio** — cada línea
del spec (`l1`, `l2`, ...) necesita su propio audio aprobado antes del render.
Esto se hace desde el detalle del episodio, panel **"Generar línea de voz
(Polly)"**.

Por cada línea del spec:

1. **id de línea**: el mismo id que tiene esa línea en el episode spec (`l1`,
   `l2`, ...) — si no coincide, el render no la va a encontrar.
2. **Texto**: exactamente lo que dice esa línea (lo que vaya a decir Polly).
3. Simulá primero.
4. Destildá "Simular" para generar la voz real — Polly cobra **por carácter**,
   y como hace 2 llamadas por línea (una para los tiempos de palabra/visema, otra
   para el audio en sí, ambas sintetizando el mismo texto), el costo es
   `2 × caracteres × precio_del_engine`. Con el engine `neural` (el que usa por
   defecto) son $16 cada 1 millón de caracteres — para una línea de 60
   caracteres, estamos hablando de **menos de un centavo**.
5. Checkbox **"Forzar aunque exceda el presupuesto"**: solo hace falta si el
   job se bloqueó por presupuesto (ver [capítulo 2](02-episodio-presupuesto.md)).

## Revisar y aprobar

En **"Revisar y aprobar (audio, render)"**, arriba en el detalle del episodio,
vas a poder escuchar el audio generado de cada línea antes de aprobarlo — a
diferencia de las imágenes, acá no hay nada que "se vea mal", pero igual pasa
por el mismo control antes de poder usarse en el render.

!!! warning "Voz por personaje — todavía no tiene campo en el formulario"
    Por defecto Polly usa la voz `Lucia` (es-ES, neural) para toda línea. El
    script/backend sí soporta elegir otra voz por línea (`parametros.voz` del
    job), y el spec ya trae la voz pensada para cada personaje en
    `voz_polly.voice_id` — pero el formulario del dashboard **todavía no tiene un
    campo para elegirla**, solo manda `texto` y `linea_id`. Mientras no se agregue
    ese campo, para usar una voz distinta de la default hay que llamar al
    endpoint `POST /jobs` directamente (no desde el dashboard) agregando
    `parametros.voz` con el `voice_id` que corresponda.
