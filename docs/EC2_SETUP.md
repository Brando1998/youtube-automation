# Provisión de la instancia EC2 (lo ejecutas tú en tu cuenta AWS)

Esta guía crea la infraestructura mínima para que la app pueda llamar a Bedrock
(Stability AI, Polly) sin usar claves planas — todo vía IAM role de instancia, como
quedó decidido en `docs/PLAN.md`. Región recomendada: **us-east-1** (cubre los modelos
de Stability AI y Polly).

Yo no tengo credenciales de AWS en esta máquina, así que estos pasos los corres tú
(consola o CLI, como prefieras) y luego me das acceso SSH a la instancia ya creada
para desplegar la app.

## 1. Bucket S3 (assets generados, sobrevive aunque apagues la instancia)

**Consola**: S3 → Create bucket → nombre único (p.ej. `tuempresa-youtube-automation`) → región `us-east-1` → dejar "Block all public access" activado (todo privado).

**CLI equivalente**:
```bash
aws s3api create-bucket --bucket tuempresa-youtube-automation --region us-east-1
aws s3api put-public-access-block --bucket tuempresa-youtube-automation \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## 2. IAM Role para la instancia (permisos mínimos, no claves planas)

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
        "arn:aws:bedrock:us-east-1::foundation-model/stability.*",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.*"
      ]
    },
    {
      "Sid": "Polly",
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech", "polly:StartSpeechSynthesisTask", "polly:DescribeVoices"],
      "Resource": "*"
    },
    {
      "Sid": "S3Proyecto",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::tuempresa-youtube-automation",
        "arn:aws:s3:::tuempresa-youtube-automation/*"
      ]
    }
  ]
}
```
(Cambia `tuempresa-youtube-automation` por el nombre real del bucket del paso 1. El
permiso de Bedrock incluye `anthropic.*` porque el style guide y los specs de episodio
usan Claude vía Bedrock también.)

Nombre del role: `youtube-automation-ec2-role`.

## 3. Instancia EC2

**Consola**: EC2 → Launch instance
- **AMI**: Ubuntu 24.04 LTS (o 22.04)
- **Tipo**: `t3.medium` (2 vCPU / 4GB — suficiente para la app + render liviano de
  Remotion; el render 3D pesado en GPU es aparte, Fase 6, AWS Batch)
- **Key pair**: crea uno nuevo (p.ej. `youtube-automation-key`) y **guarda el .pem**,
  lo vas a necesitar para darme acceso SSH después
- **Security group**: nuevo, con:
  - SSH (22) — origen: **tu IP únicamente** (no 0.0.0.0/0)
  - HTTP (80) y HTTPS (443) — origen: 0.0.0.0/0 (la app pública)
- **Storage**: 30-40GB gp3
- **IAM instance profile**: el role `youtube-automation-ec2-role` del paso 2
- **Elastic IP** (⚠️ importante dado que vas a apagar/prender la instancia a diario):
  sin esto, la IP pública cambia cada vez que la reinicias y cualquier dominio que
  apunte ahí se rompe. Asigna una Elastic IP a la instancia después de crearla (EC2 →
  Elastic IPs → Allocate → Associate con tu instancia).

## 4. Después de crear todo

Para que yo pueda desplegar la app ahí, necesito acceso SSH a la instancia. Cuando la
tengas lista, compárteme (fuera del chat, no pegues la clave privada aquí):
- La IP pública (o el dominio, si ya tienes uno apuntando a la Elastic IP)
- Cómo prefieres darme acceso: ¿agregas mi clave pública SSH a `~/.ssh/authorized_keys`
  de la instancia, o prefieres correr tú los comandos de despliegue que yo te vaya
  dando? Ambas opciones funcionan — dime cuál prefieres cuando lleguemos ahí.

No voy a tocar nada de AWS hasta que confirmes que esta infraestructura ya existe.
