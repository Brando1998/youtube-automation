# 4. Personajes: hoja → partes → aprobar

Los personajes se crean una sola vez y se reutilizan en todos los episodios que
los necesiten — andá a `/app/personajes` (no hace falta estar dentro de un
episodio).

## Crear el personaje

Formulario **"Nuevo personaje"**:

- **Nombre**: por ejemplo `lucia`.
- **asset_ref**: el id que el episode spec va a usar para referenciarlo, por
  ejemplo `2d/personajes/lucia` — tiene que ser **exactamente** el mismo string
  que vas a poner en el `asset_ref` del personaje dentro del guion/spec, si no el
  render no lo va a encontrar.
- **Color de subtítulo** (opcional): el color del globo de diálogo cuando habla
  este personaje.

## Paso 1 — Generar la hoja de referencia

Abrí **"Generar hoja de referencia (Fase A4)"** en la fila del personaje:

- **Sujeto**: describí el personaje en inglés para el prompt de Stability, por
  ejemplo `a cheerful young girl, yellow raincoat, lantern, brown hair in braids`.
  Cuanto más específico, más consistente sale.
- Simulá primero para confirmar que el pipeline corre.
- Destildá "Simular" para generar la hoja real — **esto cuesta ~$0.03** (Stable
  Image Core, 1 llamada).

## Paso 2 — Revisar y aprobar la hoja

Abrí **"Revisar y aprobar"** en la misma fila: vas a ver la imagen de la hoja
generada. **Nada avanza hasta que la apruebes** — es la regla del proyecto, no
una sugerencia (ver `docs/PLAN.md`). Si no te convence, no la apruebes: volvé a
generar la hoja con otro `sujeto` o seed.

Click en **"Aprobar"** cuando estés conforme.

## Paso 3 — Separar en partes

Con la hoja aprobada, abrí **"Separar en partes (requiere hoja aprobada)"**. Acá
hay que decirle al sistema **dónde está cada parte** en la imagen de la hoja —
no lo adivina. El campo **"Regiones"** espera un JSON así (coordenadas en
píxeles sobre la hoja, medidas a mano mirándola):

```json
{
  "cuerpo": { "x": 60, "y": 320, "w": 420, "h": 560 },
  "cabeza": { "x": 150, "y": 120, "w": 240, "h": 240 },
  "ojos_abiertos": { "x": 190, "y": 190, "w": 160, "h": 60 },
  "ojos_cerrados": { "x": 190, "y": 190, "w": 160, "h": 60 },
  "cejas": { "x": 190, "y": 170, "w": 160, "h": 30 },
  "boca_reposo": { "x": 210, "y": 260, "w": 120, "h": 50 },
  "cabeza_pivot": { "x": 0, "y": -190 }
}
```

(`apps/pipeline_2d/regiones.ejemplo.json` en el repo tiene el ejemplo completo,
con `prop`/`prop_pivot`/`apendice_pivot` opcionales si el personaje lleva algo
en la mano.)

Simulá primero — el `--dry-run` valida las regiones contra el tamaño real de la
hoja y te dice si falta alguna, sin gastar nada. Destildá "Simular" cuando esté
bien: esto hace **19 llamadas reales a Stability** (las 5 partes simples + boca
en reposo + 6 visemas de la boca, que son 2 llamadas cada uno — buscar la forma
+ quitar el fondo — más 1 si hay `prop`), a $0.07 cada una.

## Paso 4 — Revisar y aprobar las partes

En "Revisar y aprobar" ahora vas a ver **todas las partes por separado**
(cuerpo, cabeza, ojos abiertos/cerrados, cejas, las 7 bocas, prop si hay) — cada
una con fondo transparente. Revisalas todas; aprobar el asset completo las
aprueba a todas juntas. Si alguna parte salió mal, hoy no hay forma de
regenerar una sola — hay que repetir el paso 3 completo.

Con esto aprobado, el personaje ya está listo para usarse en el render de
cualquier episodio que lo referencie por su `asset_ref`.
