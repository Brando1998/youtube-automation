# Qué hacer si algo falla

## "excedería el presupuesto del episodio"

Ver [capítulo 2](02-episodio-presupuesto.md). O subís el presupuesto, o tildás
"Forzar aunque exceda el presupuesto" y volvés a mandar el mismo formulario.

## "el fondo/personaje '...' todavía no tiene ... aprobada"

El render completo (capítulo 7) exige que **todo** lo que el spec referencia
esté aprobado — fondo, cada personaje, y el audio de cada línea. El mensaje te
dice exactamente qué falta. Volvé al capítulo correspondiente (4, 5 o 6) y
aprobalo.

## "La hoja todavía no está aprobada"

Al generar las partes de un personaje (capítulo 4, paso 3) — hay que aprobar la
hoja (paso 2) antes. Si ya la aprobaste y sigue el error, puede ser que estés
generando las partes para otro `--id` o `--out` que no es el mismo de la hoja.

## AccessDeniedException / Marketplace / INVALID_PAYMENT_INSTRUMENT

Esto pasó una vez con Stability y quedó bien documentado en
`docs/PROGRESS.md` (sección "Fase A4 desbloqueada") — resumen:

1. Primero falla por permisos de Marketplace: hay que invocar el modelo **una
   vez** desde el Playground de Bedrock con un usuario que tenga permisos de
   Marketplace (no el role de la instancia).
2. Si después de eso da `INVALID_PAYMENT_INSTRUMENT`, es un problema de
   **perfil de pago**, no de la tarjeta en sí: Billing → Preferencias de pago →
   **Perfiles de pago** (no "Métodos de pago") — Marketplace necesita un
   perfil específico en **USD**, aunque el perfil general de la cuenta facture
   en otra moneda.

## El job queda "corriendo" para siempre

Los jobs de generación (hoja, partes, fondo, voz) tienen un timeout de 10
minutos; `render_episodio` tiene una hora (un episodio largo puede tardar).
Pasado ese tiempo el job pasa solo a "fallido" con el error de timeout. Si pasa
mucho antes de eso, revisá que la instancia donde corre la app tenga salida a
internet (para hablar con AWS) y que el servicio esté corriendo de verdad (ver
[capítulo 1](01-entrar.md)).

## El video renderizado no tiene sonido

No debería pasar — desde que se conectó el audio real al render (ver
`docs/PROGRESS.md`, "Fase A6"), todo render que use líneas con audio aprobado
trae la pista de sonido real. Si pasa, lo primero a revisar es si la línea en
cuestión tiene de verdad un asset de tipo `audio` aprobado para ese
`linea_id` — sin eso, `render_episodio` ni siquiera debería haber arrancado
(te lo bloquea con el error de "todavía no tiene audio aprobado").

## No tengo usuario/contraseña

El primer usuario de cada cuenta se crea por script
(`apps/web/scripts/crear_tenant.py`), no hay signup público habilitado para
esto todavía — pedíselo a quien tenga acceso al servidor.
