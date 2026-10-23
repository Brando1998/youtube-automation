# Provisión de la instancia EC2 (lo ejecutas tú en tu cuenta AWS)

Esta guía crea la infraestructura mínima para que la app pueda llamar a Bedrock
(Stability AI, Polly) sin usar claves planas — todo vía IAM role de instancia, como
quedó decidido en `docs/PLAN.md`. Región recomendada: **us-east-1** (cubre los modelos
de Stability AI y Polly).

**Sin S3 por ahora** (decisión del usuario, para no pagar por un bucket todavía): los
assets generados (imágenes, audio, renders) se guardan en el volumen EBS de la propia
instancia. Se puede agregar S3 más adelante sin romper nada — solo implica cambiar
dónde escribe el código, no la arquitectura.

Yo no tengo credenciales de AWS en esta máquina, así que estos pasos los corres tú
(consola o CLI, como prefieras) y luego me das acceso SSH a la instancia ya creada
para desplegar la app.

## 1. IAM Role para la instancia (permisos mínimos, no claves planas)

**Consola**: IAM → Roles → Create role → Trusted entity: **AWS service → EC2** →
siguiente, y pega esta política inline (Create inline policy → JSON) en vez de usar
políticas administradas amplias:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockImagenYTexto",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.*",
        "arn:aws:bedrock:us-west-2::foundation-model/stability.*"
      ]
    },
    {
      "Sid": "Polly",
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech", "polly:StartSpeechSynthesisTask", "polly:DescribeVoices"],
      "Resource": "*"
    }
  ]
}
```
(El permiso de Bedrock incluye `anthropic.*` porque el style guide y los specs de
episodio usan Claude vía Bedrock también. **Nota real de despliegue**: Stability AI
en Bedrock solo está disponible en `us-west-2` — se verificó en la documentación oficial
de AWS al momento de la Fase A4, no asumir que está en `us-east-1` aunque la instancia
viva ahí. Por eso el ARN de `stability.*` apunta a `us-west-2` mientras el resto del
proyecto corre en `us-east-1` — las llamadas a Bedrock son HTTPS normales, no hace
falta que la región coincida con la de la instancia.)

Nombre del role: `youtube-automation-ec2-role`.

## 2. Instancia EC2

**Consola**: EC2 → Launch instance
- **AMI**: Ubuntu 24.04 LTS (o 22.04)
- **Tipo**: `t3.medium` (2 vCPU / 4GB — suficiente para la app + render liviano de
  Remotion; el render 3D pesado en GPU es aparte, Fase 6, AWS Batch)
- **Key pair**: crea uno nuevo (p.ej. `youtube-automation-key`) y **guarda el .pem**,
  lo vas a necesitar para darme acceso SSH después
- **Security group**: nuevo, con:
  - SSH (22) — origen: **tu IP únicamente** (no 0.0.0.0/0)
  - HTTP (80) y HTTPS (443) — origen: 0.0.0.0/0 (la app pública)
- **Storage**: 40-50GB gp3 (un poco más que antes, ya que ahora los assets generados
  viven aquí en vez de en S3 — si más adelante se llena, se agranda el volumen o se
  agrega S3 sin cambiar la arquitectura)
- **IAM instance profile**: el role `youtube-automation-ec2-role` del paso 1
- **Elastic IP** (⚠️ importante dado que vas a apagar/prender la instancia a diario):
  sin esto, la IP pública cambia cada vez que la reinicias y cualquier dominio que
  apunte ahí se rompe. Asigna una Elastic IP a la instancia después de crearla (EC2 →
  Elastic IPs → Allocate → Associate con tu instancia).

## 3. Después de crear todo

Para que yo pueda desplegar la app ahí, necesito acceso SSH a la instancia. Cuando la
tengas lista, compárteme (fuera del chat, no pegues la clave privada aquí):
- La IP pública (o el dominio, si ya tienes uno apuntando a la Elastic IP)
- Cómo prefieres darme acceso: ¿agregas mi clave pública SSH a `~/.ssh/authorized_keys`
  de la instancia, o prefieres correr tú los comandos de despliegue que yo te vaya
  dando? Ambas opciones funcionan — dime cuál prefieres cuando lleguemos ahí.

No voy a tocar nada de AWS hasta que confirmes que esta infraestructura ya existe.

## Nota: respaldo de lo generado

Sin S3, lo que se genere en la instancia solo existe ahí — si algún día se borra la
instancia o su volumen, se pierde. Mientras el proyecto es chico esto es aceptable
(y es exactamente el tradeoff que se eligió para no pagar por el bucket ahora), pero
vale la pena recordarlo: conviene hacer backups periódicos manuales (o agregar S3 más
adelante) antes de que haya contenido valioso que no se quiera perder.
