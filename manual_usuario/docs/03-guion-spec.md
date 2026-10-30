# 3. Del guion al episode spec

Dentro del episodio, en el panel **"Guion"** ves el texto que escribiste (o podés
editarlo — si no lo pusiste al crear el episodio, por ahora hay que volver a
crear el episodio con el guion completo, no hay un botón de editar guion
todavía).

## Generar el episode spec

Bajo **"Episode spec"**:

1. Elegí el **modelo**. Por defecto es **Nova Lite** — mucho más barato que
   Claude para esta tarea (convertir texto a JSON no necesita el modelo más
   caro) y no pasa por AWS Marketplace, así que no tiene el dolor de cabeza de
   permisos/facturación que sí tuvo Stability la primera vez. Nova Micro es
   todavía más barato si el guion es simple; Claude Sonnet 5 solo si un guion
   complicado sale mal con Nova.
2. Dejá **"Simular"** tildado para probar que el pipeline corre sin gastar nada
   — no te va a dar un spec de verdad, solo confirma que todo está bien armado.
3. Destildá "Simular" cuando quieras el spec real. **Esto llama a Bedrock de
   verdad** (costo: fracciones de centavo con Nova Lite para un guion corto,
   ver [presupuesto](presupuesto.md)).
4. Click en **"Generar episode spec"**.

El job queda corriendo (lo ves con un badge de estado que se actualiza solo) y,
al terminar, el spec aparece abajo en formato JSON. Si falla, el error se
muestra al lado del botón.

## Qué hace el spec

Convierte tu guion en escenas → tomas → líneas (quién habla, qué dice, en qué
emoción) → eventos (p.ej. "en la palabra X pasa un relámpago") → duración. Ese
JSON es lo que después van a usar los personajes, fondos, la voz y el render
final — todos leen de ahí, no vuelven a tocar el guion.

!!! tip "Si el spec sale mal armado"
    El script reintenta solo hasta 3 veces (configurable), devolviéndole el
    error de validación al modelo en el siguiente intento, antes de rendirse. Si
    aun así falla, revisá que el guion tenga el formato esperado (`NARRADOR:
    ...`, `NOMBRE_PERSONAJE: ...` por línea) y que los personajes que menciona ya
    existan (ver próximo capítulo) — el modelo usa sus ids reales si existen, no
    los inventa.
