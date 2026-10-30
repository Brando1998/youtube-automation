# 1. Entrar al dashboard

## Si la app corre en tu máquina (desarrollo)

```bash
cd apps/web
source .venv/bin/activate  # o el intérprete que uses
uvicorn app.main:app --reload
```

Abrí `http://127.0.0.1:8000/login` en el navegador.

## Si la app corre en la instancia EC2

Hoy la app **no tiene un dominio público ni HTTPS propios** (a diferencia de
Territorio o pos) — se accede por túnel SSH, igual que se verificó la última vez
(ver `docs/PROGRESS.md`):

```bash
ssh -i Downloads/KEYS/youtube-automation.pem -N -L 8000:127.0.0.1:8000 ubuntu@52.5.177.143
```

Dejá esa terminal abierta y abrí `http://127.0.0.1:8000/login` en tu navegador —
el túnel hace que "127.0.0.1:8000" de tu máquina en realidad hable con el puerto
8000 de la instancia.

Si del otro lado la app no está corriendo todavía, hay que iniciarla en la
instancia (por SSH, en otra terminal):

```bash
ssh -i Downloads/KEYS/youtube-automation.pem ubuntu@52.5.177.143
cd ~/youtube-automation/repo/apps/web   # o donde esté desplegado el repo
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

!!! note "Esto es provisorio"
    No hay (todavía) un servicio systemd que mantenga la app corriendo sola ni un
    nginx/Caddy delante como en Territorio/pos — es el estado actual, dev-only. Si
    se decide exponerla con un dominio propio más adelante, es un trabajo aparte
    (seguiría el mismo patrón que esos dos proyectos).

## Iniciar sesión

En `/login`, entrá con tu email y contraseña. Si todo sale bien quedás en
`/app/episodios` — la lista de episodios, vacía la primera vez.

La sesión dura 14 días (cookie), después hay que loguearse de nuevo. Si te
equivocás de contraseña varias veces seguidas la cuenta se bloquea un rato por
seguridad — es normal, esperá unos minutos y probá de nuevo.
