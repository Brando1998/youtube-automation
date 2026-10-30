# 7. Renderizar el episodio completo

Cuando todo lo anterior está aprobado — cada fondo que usa el spec, cada
personaje, y el audio de cada línea — el episodio está listo para renderizarse.

En el detalle del episodio, panel **"Renderizar episodio completo"**: click en
el botón. No hay checkbox de "Simular" acá — el render es **siempre local**
(Remotion corriendo en el servidor, no AWS) y **no cuesta nada**, así que no
tiene sentido simularlo.

## Qué hace

Encadena, una atrás de la otra, todas las tomas de todas las escenas del spec
(`EpisodioCompleto`/composición `Episodio` en Remotion) — a diferencia de los
renders de prueba que solo arman una toma sola, este arma el episodio entero,
con la duración real que sume el spec. Antes de renderizar, junta automáticamente
el fondo, los personajes y el audio real aprobados y se los pasa a Remotion.

## Si falla

El error más común va a ser algo como:

```
el fondo '2d/fondos/cabana-bosque-noche' todavía no tiene una capa_fondo aprobada
```

o lo mismo para un personaje o una línea de audio — significa exactamente lo que
dice: falta aprobar ese asset (volvé al capítulo correspondiente). El render no
arranca a medias ni con placeholders — o está todo aprobado, o no corre.

Otro error posible: `el episodio no tiene episode_spec todavía` — faltó el
[paso 3](03-guion-spec.md).

## Mientras corre

Un episodio de varios minutos puede tardar bastante más que los jobs de
generación (hasta una hora, según la duración) — el badge de estado se sigue
actualizando solo cada pocos segundos, no hace falta recargar la página.

Al terminar, el episodio pasa a estado **"listo"** y aparece el botón de
descarga — ver [próximo capítulo](08-descargar-subir-youtube.md).
