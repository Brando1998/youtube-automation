# 5. Fondos: capas → aprobar

Igual que los personajes, los fondos viven en `/app/fondos` y se reutilizan
entre episodios.

## Crear el fondo

- **Nombre**: por ejemplo `cabana-bosque-noche`.
- **asset_ref**: el id que usa el spec para referenciarlo, por ejemplo
  `2d/fondos/cabana-bosque-noche` — mismo cuidado que con los personajes, tiene
  que coincidir exacto con lo que diga el guion/spec.

## Generar las capas

Abrí **"Generar capas"**. El campo **Spec** espera un JSON con las capas,
luces y origen de humo — `apps/pipeline_2d/fondo_spec.ejemplo.json` en el repo
tiene un ejemplo completo. Forma mínima:

```json
{
  "id": "cabana-bosque-noche",
  "capas": [
    { "id": "cielo", "depth": 0, "sujeto": "night sky with a full moon, deep blue" },
    { "id": "lejano", "depth": 0.15, "sujeto": "distant dark forest silhouette" },
    { "id": "medio", "depth": 0.3, "sujeto": "pine trees, moonlit" },
    { "id": "cabana", "depth": 0.5, "sujeto": "small wooden cabin with a lit window" }
  ],
  "luces": [],
  "humo_origen": null
}
```

`depth` controla cuánto se mueve esa capa con la cámara (0 = fondo fijo, más
alto = se mueve y se acerca más) — tiene que coincidir con lo que después pida
el spec en `capas_fondo` de cada toma.

A diferencia de los personajes (una hoja completa que después se recorta), cada
capa de fondo se genera **aislada** directamente con Stability, sobre fondo
blanco, y se le quita el fondo después — por eso el costo es **2 llamadas por
capa** (texto-a-imagen + quitar fondo), a ~$0.03 + $0.07.

Simulá primero para validar el spec (capas sin `depth` fuera de rango, etc.)
sin gastar nada.

## Revisar y aprobar

En "Revisar y aprobar" vas a ver cada capa por separado, ya con el fondo
transparente. Aprobá cuando estén bien — el fondo completo queda disponible
para cualquier episodio que lo referencie.
