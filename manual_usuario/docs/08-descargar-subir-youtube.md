# 8. Descargar y subir a YouTube

## Descargar el video

En el detalle del episodio, una vez que el render terminó, aparece un botón
**"Descargar video"** (con la fecha del render) en el panel de renderizado — baja
el mp4 final a tu computadora.

Si renderizaste el episodio más de una vez, el botón siempre apunta al **render
más reciente** — los anteriores no se borran solos, pero tampoco se ven listados
todavía (quedan en la base de datos como assets sin aprobar; se pueden revisar
vía `GET /assets?episodio_id=...&tipo=render` si hace falta encontrar uno viejo).

El mp4 también se puede revisar (y marcar como aprobado, si querés dejar
registro de cuál es "el bueno") desde el panel **"Revisar y aprobar (audio,
render)"** más arriba en la misma página — ahí se puede reproducir antes de
aprobar.

## Subir a YouTube (manual, por ahora)

No hay integración automática con YouTube todavía — decisión explícita para
esta etapa (evita tener que manejar OAuth/credenciales de tu cuenta de Google
desde la app). Los pasos, en [YouTube Studio](https://studio.youtube.com):

1. **Crear** → **Subir videos** → elegí el mp4 que bajaste.
2. **Detalles**: título, descripción, miniatura (si tenés una — si no, YouTube
   genera opciones automáticas del propio video).
3. **Audiencia**: como este es contenido infantil, marcá
   **"Sí, está hecho para niños"** (`selfDeclaredMadeForKids=true`, la decisión ya
   documentada en `docs/PLAN.md` para la Fase 6) — esto desactiva comentarios,
   notificaciones personalizadas y algunas otras funciones, es el comportamiento
   esperado de YouTube para contenido infantil, no un bug.
4. **Elementos de video**: pantallas finales/tarjetas no aplican si el canal es
   "hecho para niños" (YouTube las deshabilita).
5. **Visibilidad**: elegí **"No listado"** o **"Privado"** para la primera
   tanda de episodios de prueba, antes de hacerlo público — así lo podés revisar
   vos (o quien corresponda) antes de que lo vea cualquiera.
6. **Publicar**.

## TikTok / Meta (si aplica)

El plan original (`docs/PLAN.md`, Fase 6) menciona subir también a TikTok (como
borrador) y Meta (en modo tester/admin durante revisión) — hoy esto tampoco está
automatizado, mismo camino manual que YouTube.
