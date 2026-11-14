/**
 * Lucía — tercer personaje de la biblioteca vectorial (el humano pendiente del demo
 * original: humano + perro + bosque + casa). Nombre en homenaje a
 * docs/reference/cabana-lucia.html, la referencia de estilo del pipeline ilustrado.
 *
 * v2 — subida de nivel tras la referencia visual que pasó el usuario (animación
 * estilo "historias" de TikTok): cuerpo completo articulado (brazos/piernas/manos/
 * pies, no un óvalo), cara con iris/pupila/brillo/pestañas, cejas ahusadas, pelo con
 * mechones largos y degradado de volumen, ropa con degradado de sombra. Sirve de
 * nueva referencia de calidad para subir Tito/Rocco después.
 *
 * Sigue REGLAS.md: brazos/piernas/mechones de pelo/cejas usan `FormaAhusada`
 * (geometría exacta de 2 círculos), nunca una curva Bézier adivinada — es la misma
 * pieza ya validada con la cola de Rocco, reutilizada 4 veces aquí.
 */
import type { ContextoAnimacion } from "../../components/CharacterPuppet";
import type { PersonajeDef } from "../../catalog/types";
import { combinarClips, evaluarClip } from "../../engine/animation/evaluator";
import type { ClipAnimacion } from "../../engine/animation/types";
import { evaluarFK } from "../../engine/rig/fk";
import type { Articulacion } from "../../engine/rig/types";
import { construirTorso, FormaAhusada } from "../primitives";
import { PALETA } from "../styleTokens";

export const ASSET_REF = "2d/personajes/lucia";

const PIEL_CLARA = "#F0C39C";
const PIEL_SOMBRA = PALETA.piel.media;
const PELO_CLARO = "#6B4A30";
const PELO_OSCURO = "#2A1810";
const HOODIE_CLARO = PALETA.acento.calido;
const HOODIE_OSCURO = PALETA.acento.calidoOscuro;
const JEANS_CLARO = "#3B4A6B";
const JEANS_OSCURO = "#20283D";
const ZAPATO = "#2E2A26";
const CONTORNO = PALETA.contorno;

// --- proporciones (pies en y=0, cabeza arriba) ---
const CABEZA_X = 0;
const CABEZA_Y = -235;
const CABEZA_R = 50;
const HOMBRO_Y = -178;
const CADERA_Y = -95;
const TOBILLO_Y = -10;
// Hueco real entre la base de la cabeza (CABEZA_Y+CABEZA_R=-185) y el torso
// (HOMBRO_Y=-178) para que el cuello se vea — antes la cabeza se hundía dentro del
// torso (CABEZA_Y=-215 => base en -165, 13 unidades DENTRO del torso) y lo tapaba
// por completo, por eso no se veía ningún cuello.

function Degradados() {
  // Un solo <defs> compartido por cuerpo/cabeza — ids prefijados "lucia-" para no
  // chocar con otros personajes en la misma escena.
  return (
    <defs>
      <radialGradient id="lucia-piel" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor={PIEL_CLARA} />
        <stop offset="100%" stopColor={PIEL_SOMBRA} />
      </radialGradient>
      <radialGradient id="lucia-pelo" cx="35%" cy="20%" r="80%">
        <stop offset="0%" stopColor={PELO_CLARO} />
        <stop offset="100%" stopColor={PELO_OSCURO} />
      </radialGradient>
      {/* gradientUnits="userSpaceOnUse" a propósito (no el default
          objectBoundingBox): desde que el brazo son piezas separadas (hombro +
          antebrazo + torso, Fase 4), cada forma con el default calcula el
          degradado relativo a SU PROPIA caja — se nota como un anillo oscuro en
          cada articulación porque las piezas no coinciden entre sí. Con
          coordenadas absolutas del personaje, todas las piezas "hoodie" muestrean
          el mismo degradado continuo, sin importar cuántas formas separadas sean. */}
      <linearGradient id="lucia-hoodie" gradientUnits="userSpaceOnUse" x1="0" y1={HOMBRO_Y} x2="0" y2={CADERA_Y}>
        <stop offset="0%" stopColor={HOODIE_CLARO} />
        <stop offset="100%" stopColor={HOODIE_OSCURO} />
      </linearGradient>
      <linearGradient id="lucia-jeans" gradientUnits="userSpaceOnUse" x1="0" y1={CADERA_Y} x2="0" y2={TOBILLO_Y}>
        <stop offset="0%" stopColor={JEANS_CLARO} />
        <stop offset="100%" stopColor={JEANS_OSCURO} />
      </linearGradient>
    </defs>
  );
}

// Pierna = 2 huesos reales (cadera->rodilla, rodilla->tobillo), mismo patrón que
// Brazo (Fase 4, docs/PROJECT_ROADMAP.md). No hay "cap" en la cadera: ahí la
// pierna (jeans) se encuentra con el borde PLANO del torso (hoodie) — es un
// cambio de color (cintura), no una fusión de la misma pieza, así que no hace
// falta taparlo (ya funcionaba bien como una sola forma antes de separar la
// rodilla). La rodilla sí necesita el cap sin contorno, igual que el codo.
const PIERNA_CADERA = { x: 20, y: CADERA_Y, r: 19 };
const PIERNA_TOBILLO = { x: 22, y: TOBILLO_Y, r: 13 };
const PIERNA_RODILLA_RADIO = 16;
const PIERNA_LONGITUD_TOTAL = Math.hypot(PIERNA_TOBILLO.x - PIERNA_CADERA.x, PIERNA_TOBILLO.y - PIERNA_CADERA.y);
const PIERNA_LONGITUD_MUSLO = 40;
const PIERNA_LONGITUD_PANTORRILLA = PIERNA_LONGITUD_TOTAL - PIERNA_LONGITUD_MUSLO;
const PIERNA_ANGULO_REPOSO = (Math.atan2(PIERNA_TOBILLO.y - PIERNA_CADERA.y, PIERNA_TOBILLO.x - PIERNA_CADERA.x) * 180) / Math.PI;

function Pierna({
  signo,
  ctx,
  anguloCadera,
  anguloRodilla,
  clips,
}: {
  signo: 1 | -1;
  ctx: ContextoAnimacion;
  anguloCadera?: number;
  anguloRodilla?: number;
  /** capas de clip de engine/animation (Fase 5) — ver Brazo. Para alternar piernas
   * en un ciclo de caminar, pasar el mismo clip con un desfase de medio ciclo (ver
   * CLIP_CAMINAR) — eso lo decide quien arma la escena, no esta función. */
  clips?: ClipAnimacion[];
}) {
  const huesos: Articulacion[] = [
    {
      id: "muslo",
      longitud: PIERNA_LONGITUD_MUSLO,
      // mismo truco de reflejo que el brazo: para signo=-1, 180-ángulo.
      anguloReposo: signo === 1 ? PIERNA_ANGULO_REPOSO : 180 - PIERNA_ANGULO_REPOSO,
      radioProximal: PIERNA_CADERA.r,
      radioDistal: PIERNA_RODILLA_RADIO,
    },
    {
      id: "pantorrilla",
      padreId: "muslo",
      longitud: PIERNA_LONGITUD_PANTORRILLA,
      anguloReposo: 0,
      radioProximal: PIERNA_RODILLA_RADIO,
      radioDistal: PIERNA_TOBILLO.r,
    },
  ];
  const raiz = { x: signo * PIERNA_CADERA.x, y: PIERNA_CADERA.y, anguloMundo: 0 };
  const [huesoMuslo, huesoPantorrilla] = huesos;

  // Balanceo de reposo sutil (desplazamiento de peso), mismo criterio que el
  // brazo: apagado si ctx.animar=false, y si se pasa una pose explícita o un clip
  // esa gana sin sumarle temblor.
  const clipsAngulos = angulosDeClips(clips, ctx.frame, signo);
  const faseBalanceo = signo === 1 ? 0 : Math.PI;
  const balanceoCadera = ctx.animar && clipsAngulos?.muslo === undefined && anguloCadera === undefined ? Math.sin(ctx.frame * 0.04 + faseBalanceo) * 1.5 : 0;

  const angulosLocales: Record<string, number> = {
    muslo: (clipsAngulos?.muslo ?? anguloCadera ?? huesoMuslo.anguloReposo) + balanceoCadera,
    pantorrilla: clipsAngulos?.pantorrilla ?? anguloRodilla ?? huesoPantorrilla.anguloReposo,
  };
  const pose = evaluarFK(huesos, raiz, angulosLocales);
  const muslo = pose.muslo;
  const pantorrilla = pose.pantorrilla;

  return (
    <g>
      <FormaAhusada baseX={muslo.proximal.x} baseY={muslo.proximal.y} baseR={huesoMuslo.radioProximal} puntaX={muslo.distal.x} puntaY={muslo.distal.y} puntaR={huesoMuslo.radioDistal} color="url(#lucia-jeans)" />
      <FormaAhusada baseX={pantorrilla.proximal.x} baseY={pantorrilla.proximal.y} baseR={huesoPantorrilla.radioProximal} puntaX={pantorrilla.distal.x} puntaY={pantorrilla.distal.y} puntaR={huesoPantorrilla.radioDistal} color="url(#lucia-jeans)" />
      <ellipse cx={pantorrilla.distal.x} cy={pantorrilla.distal.y + 6} rx={17} ry={9} fill={ZAPATO} stroke={CONTORNO} strokeWidth={2.5} />
      {/* cap de la rodilla: sin contorno propio (mismo criterio que el codo). Radio
          +3 sobre el radio real del hueso a propósito — un círculo perfecto no
          cubre del todo el borde redondeado que arma FormaAhusada en la punta de
          cada hueso (son 2 construcciones geométricas distintas, no coinciden
          pixel a pixel aunque el radio nominal sea igual); un poco más grande
          garantiza que tape el contorno de los 2 huesos sin dejar un arco asomando. */}
      <circle cx={pantorrilla.proximal.x} cy={pantorrilla.proximal.y} r={huesoPantorrilla.radioProximal + 3} fill="url(#lucia-jeans)" />
    </g>
  );
}

// Medidas del torso SOLO (Fase 4, docs/PROJECT_ROADMAP.md: el brazo ya no se funde
// con el torso en una sola curva — es un hueso aparte, ver BRAZO_HUESO más abajo —
// así se puede animar sin arriesgar auto-intersección en cada cuadro).
const MEDIDAS_TORSO = {
  caderaY: CADERA_Y,
  anchoCaderaMitad: 38,
  anchoTorsoSuperiorMitad: 49.6,
  anchoCuelloMitad: 22,
  hombro: { x: 34, y: -180, r: 18 },
};

function Torso() {
  const d = construirTorso(MEDIDAS_TORSO);
  return <path d={d} fill="url(#lucia-hoodie)" stroke={CONTORNO} strokeWidth={3} strokeLinejoin="round" />;
}

// El brazo son 2 huesos reales (engine/rig): brazo (hombro->codo) y antebrazo
// (codo->muñeca). Cada articulación tiene su propio "cap" (mismo truco que el
// hombro con el torso) para que la unión se vea limpia sin importar el ángulo.
// Longitudes/ángulo de reposo calculados para que la postura por defecto quede
// IGUAL a cuando era un solo hueso (mano en x=57,y=-99 del lado derecho, ángulo de
// reposo del antebrazo = 0 = continúa recto) — ver docs/PROJECT_ROADMAP.md Fase 4.
const BRAZO_RADIO_DISTAL = 11;
const BRAZO_RADIO_CODO = 14;
const BRAZO_LONGITUD_TOTAL = Math.hypot(57 - MEDIDAS_TORSO.hombro.x, -99 - MEDIDAS_TORSO.hombro.y);
const BRAZO_LONGITUD_SUPERIOR = 45;
const BRAZO_LONGITUD_INFERIOR = BRAZO_LONGITUD_TOTAL - BRAZO_LONGITUD_SUPERIOR;
const BRAZO_ANGULO_REPOSO_DER = (Math.atan2(-99 - MEDIDAS_TORSO.hombro.y, 57 - MEDIDAS_TORSO.hombro.x) * 180) / Math.PI;

/** Ángulos de una o más capas de clip (Fase 5, engine/animation) ya combinadas
 * (`combinarClips` — el último de la lista gana por hueso si 2 capas tocan el
 * mismo, sección 8.3 del plan maestro), reflejadas para el lado izquierdo con el
 * mismo criterio que `anguloReposo` (`180 - angulo`). Compartido entre Brazo y
 * Pierna. `undefined` si no hay clips (así el llamador cae a su propio ángulo de
 * reposo/pose) — por hueso individual puede seguir siendo `undefined` si NINGUNA
 * capa lo anima. */
function angulosDeClips(clips: ClipAnimacion[] | undefined, frame: number, signo: 1 | -1): Record<string, number> | undefined {
  if (!clips || clips.length === 0) return undefined;
  const combinado = combinarClips(...clips.map((c) => evaluarClip(c, frame)));
  if (signo === 1) return combinado;
  const reflejado: Record<string, number> = {};
  for (const huesoId of Object.keys(combinado)) reflejado[huesoId] = 180 - combinado[huesoId];
  return reflejado;
}

function Brazo({
  signo,
  anguloHombro,
  anguloCodo,
  clips,
  ctx,
}: {
  signo: 1 | -1;
  anguloHombro?: number;
  anguloCodo?: number;
  /** capas de clip de engine/animation (Fase 5), combinadas con `combinarClips`
   * (el último de la lista gana por hueso si 2 capas tocan el mismo) — si alguna
   * anima un hueso, gana sobre anguloHombro/anguloCodo y sobre el balanceo de
   * reposo para ESE hueso puntual (no es todo o nada: si una capa solo toca
   * "antebrazo", "brazo" sigue cayendo a su pose/balanceo normal). */
  clips?: ClipAnimacion[];
  /** animar/frame oficiales de CharacterPuppet (ver ContextoAnimacion) — antes
   * esta función llamaba a useCurrentFrame() por su cuenta y nunca respetaba
   * `animar`; ahora usa el mismo canal que breath/blink/look. */
  ctx: ContextoAnimacion;
}) {
  const huesos: Articulacion[] = [
    {
      id: "brazo",
      longitud: BRAZO_LONGITUD_SUPERIOR,
      anguloReposo: signo === 1 ? BRAZO_ANGULO_REPOSO_DER : 180 - BRAZO_ANGULO_REPOSO_DER,
      radioProximal: MEDIDAS_TORSO.hombro.r,
      radioDistal: BRAZO_RADIO_CODO,
    },
    {
      id: "antebrazo",
      padreId: "brazo",
      longitud: BRAZO_LONGITUD_INFERIOR,
      anguloReposo: 0, // 0 = sigue derecho, misma dirección que el brazo superior
      radioProximal: BRAZO_RADIO_CODO,
      radioDistal: BRAZO_RADIO_DISTAL,
    },
  ];
  const raiz = { x: signo * MEDIDAS_TORSO.hombro.x, y: MEDIDAS_TORSO.hombro.y, anguloMundo: 0 };
  const [huesoBrazo, huesoAntebrazo] = huesos;

  // Balanceo de reposo real (Fase 4, docs/PROJECT_ROADMAP.md) — frame-driven vía
  // evaluarFK, no un <g rotate> suelto: prueba que el rig se anima de verdad, no
  // solo que acepta una pose fija. Desfasado por brazo (signo) con una fase que es
  // múltiplo de 180° para que en el frame 0 el balanceo valga exactamente 0 — así
  // una previsualización estática (`remotion still`, frame 0 por defecto) sigue
  // mostrando la pose de reposo exacta, sin importar que el personaje "ya esté
  // animado". Si el llamador pasa una pose explícita (anguloHombro/anguloCodo,
  // como en las pruebas de pose de más arriba), esa pose GANA — no se le suma el
  // balanceo, para que una pose deliberada no quede temblando.
  // ctx.animar=false (equivalente a "Personaje animado" apagado en la demo) ->
  // sin balanceo, igual que breath/blink/look en CharacterPuppet. Un clip (Fase 5)
  // tiene la prioridad más alta: si lo hay, ni el balanceo ni anguloHombro/
  // anguloCodo se aplican para ese hueso.
  const clipsAngulos = angulosDeClips(clips, ctx.frame, signo);
  const faseBalanceo = signo === 1 ? 0 : Math.PI;
  const balanceoHombro = ctx.animar && clipsAngulos?.brazo === undefined && anguloHombro === undefined ? Math.sin(ctx.frame * 0.05 + faseBalanceo) * 3 : 0;
  const balanceoCodo = ctx.animar && clipsAngulos?.antebrazo === undefined && anguloCodo === undefined ? Math.sin(ctx.frame * 0.07 + faseBalanceo) * 2 : 0;

  const angulosLocales: Record<string, number> = {
    brazo: (clipsAngulos?.brazo ?? anguloHombro ?? huesoBrazo.anguloReposo) + balanceoHombro,
    antebrazo: (clipsAngulos?.antebrazo ?? anguloCodo ?? huesoAntebrazo.anguloReposo) + balanceoCodo,
  };
  const pose = evaluarFK(huesos, raiz, angulosLocales);
  const brazo = pose.brazo;
  const antebrazo = pose.antebrazo;
  return (
    <g>
      <FormaAhusada baseX={brazo.proximal.x} baseY={brazo.proximal.y} baseR={huesoBrazo.radioProximal} puntaX={brazo.distal.x} puntaY={brazo.distal.y} puntaR={huesoBrazo.radioDistal} color="url(#lucia-hoodie)" />
      <FormaAhusada baseX={antebrazo.proximal.x} baseY={antebrazo.proximal.y} baseR={huesoAntebrazo.radioProximal} puntaX={antebrazo.distal.x} puntaY={antebrazo.distal.y} puntaR={huesoAntebrazo.radioDistal} color="url(#lucia-hoodie)" />
      <circle cx={antebrazo.distal.x} cy={antebrazo.distal.y + 2} r={10} fill="url(#lucia-piel)" stroke={CONTORNO} strokeWidth={2.5} />
      {/* cap del hombro: SÍ con contorno — contra el torso se lee como el hombro
          redondeado (igual que en la prueba de PruebaHombroFK). El cap del codo
          NO lleva contorno propio a propósito: un círculo con su propio contorno
          en la mitad del brazo se ve como una articulación mecánica (bola), no
          como un codo — solo necesita el relleno para tapar el pliegue, el
          contorno de los 2 huesos ya delimita la silueta. */}
      <circle cx={brazo.proximal.x} cy={brazo.proximal.y} r={huesoBrazo.radioProximal} fill="url(#lucia-hoodie)" stroke={CONTORNO} strokeWidth={3} />
      <circle cx={antebrazo.proximal.x} cy={antebrazo.proximal.y} r={huesoAntebrazo.radioProximal} fill="url(#lucia-hoodie)" />
    </g>
  );
}

function Cuello() {
  // Llena el hueco real entre la base de la cabeza (-185) y el torso (-178), con 2
  // unidades de margen de cada lado para que cabeza/torso (dibujados encima/debajo)
  // tapen las costuras de arriba y abajo — solo quedan visibles los lados.
  return <rect x={-16} y={-188} width={32} height={14} rx={5} fill="url(#lucia-piel)" stroke={CONTORNO} strokeWidth={2.5} />;
}

/** Mechones largos a los lados (hasta el pecho) + "casco" base detrás de la cabeza
 * — mismo truco que Puas()/Cabello() v1: la cabeza se dibuja encima y tapa la base,
 * solo los mechones ahusados (FormaAhusada, geometría exacta) quedan sueltos. */
function Cabello() {
  // La punta llegaba a HOMBRO_Y+35 (bien adentro del largo de la manga) — como el
  // mechón corre en diagonal hacia afuera y la manga también, se cruzaban formando
  // una X visible. Acortado para terminar A LA ALTURA del hombro, antes de que
  // empiece el brazo, no invadiendo ese tramo.
  const mechon = (signo: 1 | -1) => (
    <FormaAhusada
      baseX={signo * 38}
      baseY={CABEZA_Y - 18}
      baseR={22}
      puntaX={signo * 44}
      puntaY={HOMBRO_Y - 4}
      puntaR={9}
      color="url(#lucia-pelo)"
    />
  );
  return (
    <>
      {mechon(-1)}
      {mechon(1)}
      <circle cx={CABEZA_X} cy={CABEZA_Y - 14} r={CABEZA_R + 8} fill="url(#lucia-pelo)" stroke={CONTORNO} strokeWidth={3} />
    </>
  );
}

function Ceja({ signo }: { signo: 1 | -1 }) {
  // Más gruesa cerca del centro (puente de la nariz), afinando hacia afuera.
  return (
    <FormaAhusada
      baseX={signo * 11}
      baseY={CABEZA_Y - 23}
      baseR={6}
      puntaX={signo * 33}
      puntaY={CABEZA_Y - 17}
      puntaR={2}
      color={PELO_OSCURO}
      trazo={1.5}
    />
  );
}

function Ojo({ signo }: { signo: 1 | -1 }) {
  const cx = signo * 19;
  const cy = CABEZA_Y - 2;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={12} ry={14} fill="#FFF8EE" stroke={CONTORNO} strokeWidth={2.5} />
      <circle cx={cx} cy={cy + 2} r={7.5} fill="#4A2E1A" />
      <circle cx={cx} cy={cy + 2} r={3.5} fill="#000" />
      <circle cx={cx - 2.5} cy={cy - 1} r={1.8} fill="#FFFFFF" />
      {/* pestaña: trazo corto en la esquina superior-externa */}
      <path
        d={`M${cx + signo * 9} ${cy - 11} q${signo * 6} ${-4} ${signo * 9} ${-2}`}
        fill="none"
        stroke={CONTORNO}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
}

function Nariz() {
  return (
    <path
      d={`M${-3} ${CABEZA_Y + 10} Q${0} ${CABEZA_Y + 15} ${3} ${CABEZA_Y + 10}`}
      fill="none"
      stroke={PIEL_SOMBRA}
      strokeWidth={2}
      strokeLinecap="round"
    />
  );
}

function Mejillas() {
  return (
    <>
      <ellipse cx={-28} cy={CABEZA_Y + 14} rx={9} ry={6} fill="#E8927A" opacity={0.45} />
      <ellipse cx={28} cy={CABEZA_Y + 14} rx={9} ry={6} fill="#E8927A" opacity={0.45} />
    </>
  );
}

export const LUCIA: Omit<PersonajeDef, "id"> = {
  metadatos: {
    id: "character_human_lucia_001",
    version: 2,
    tags: ["personaje", "humano", "biped"],
    capabilities: ["idle", "blink", "talk", "look"],
    descripcion:
      "Humana bípeda — torso+brazos como una sola curva cerrada (tangentesExternas), primera referencia para el generador paramétrico de la Fase 3.",
  },
  colorPlaceholder: HOODIE_CLARO,
  cabezaPivot: { x: CABEZA_X, y: CABEZA_Y },
  apendice: { render: () => null },
  prop: { render: () => null },

  cuerpo: {
    // Despacho de ctx.clips (Fase 7, docs/PROJECT_ROADMAP.md) por `categoria` — es
    // la pieza específica de ESTE personaje (ContextoAnimacion solo transporta los
    // clips, no sabe de huesos): "gesto" va al brazo derecho (convención de autor
    // de CLIP_SALUDAR/CLIP_SENALAR, ver esos archivos), "locomocion" va a AMBAS
    // piernas, la izquierda con medio ciclo de desfase (mismo patrón ya demostrado
    // a mano en la Fase 5 — aquí queda conectado de verdad al spec, no a código
    // editado para la demo).
    render: (ctx) => {
      const gesto = ctx.clips?.find((c) => c.categoria === "gesto");
      const locomocion = ctx.clips?.find((c) => c.categoria === "locomocion");
      const frameClip = ctx.clipFrame ?? ctx.frame;
      const ctxPiernaIzq = locomocion ? { ...ctx, frame: frameClip + locomocion.duracionFrames / 2 } : ctx;
      const ctxPiernaDer = locomocion ? { ...ctx, frame: frameClip } : ctx;
      const ctxBrazoDer = gesto ? { ...ctx, frame: frameClip } : ctx;
      return (
        <g>
          <Degradados />
          <Pierna signo={-1} ctx={ctxPiernaIzq} clips={locomocion ? [locomocion] : undefined} />
          <Pierna signo={1} ctx={ctxPiernaDer} clips={locomocion ? [locomocion] : undefined} />
          <Torso />
          <Brazo signo={-1} ctx={ctx} />
          <Brazo signo={1} ctx={ctxBrazoDer} clips={gesto ? [gesto] : undefined} />
          <Cuello />
        </g>
      );
    },
  },

  cabeza: {
    render: () => (
      <g>
        <Cabello />
        <circle cx={CABEZA_X} cy={CABEZA_Y} r={CABEZA_R} fill="url(#lucia-piel)" stroke={CONTORNO} strokeWidth={3} />
        <Mejillas />
        <Nariz />
        {/* El círculo de la cabeza se dibuja ENCIMA del pelo (para no tapar la cara),
            así que su propio borde inferior queda visible más allá de donde el pelo/
            la capucha llegan — medido con muestreo de píxeles: piel asomando en
            x=15-24, y=-195 a -188 de cada lado. Estas "patillas" se dibujan después,
            tapando justo esa franja, como mechones cayendo sobre el cuello. */}
        <ellipse cx={-25} cy={-197} rx={7} ry={13} fill="url(#lucia-pelo)" />
        <ellipse cx={25} cy={-197} rx={7} ry={13} fill="url(#lucia-pelo)" />
      </g>
    ),
  },

  ojosAbiertos: {
    render: () => (
      <g>
        <Ojo signo={-1} />
        <Ojo signo={1} />
      </g>
    ),
  },
  ojosCerrados: {
    render: () => (
      <g>
        <path d={`M${-29} ${CABEZA_Y - 2} Q${-19} ${CABEZA_Y + 5} ${-9} ${CABEZA_Y - 2}`} fill="none" stroke={CONTORNO} strokeWidth={2.5} strokeLinecap="round" />
        <path d={`M${9} ${CABEZA_Y - 2} Q${19} ${CABEZA_Y + 5} ${29} ${CABEZA_Y - 2}`} fill="none" stroke={CONTORNO} strokeWidth={2.5} strokeLinecap="round" />
      </g>
    ),
  },

  cejas: {
    render: () => (
      <g>
        <Ceja signo={-1} />
        <Ceja signo={1} />
      </g>
    ),
  },

  bocas: {
    reposo: { render: () => <path d={`M${-9} ${CABEZA_Y + 27} Q${0} ${CABEZA_Y + 31} ${9} ${CABEZA_Y + 27}`} fill="none" stroke={CONTORNO} strokeWidth={2.5} strokeLinecap="round" /> },
    A: { render: () => <ellipse cx={0} cy={CABEZA_Y + 29} rx={9} ry={9} fill="#7A3E3E" stroke={CONTORNO} strokeWidth={2} /> },
    E: { render: () => <ellipse cx={0} cy={CABEZA_Y + 28} rx={12} ry={3.5} fill="#7A3E3E" stroke={CONTORNO} strokeWidth={2} /> },
    O: { render: () => <ellipse cx={0} cy={CABEZA_Y + 29} rx={7} ry={8} fill="#7A3E3E" stroke={CONTORNO} strokeWidth={2} /> },
    MBP: { render: () => <path d={`M${-9} ${CABEZA_Y + 28} Q${0} ${CABEZA_Y + 29} ${9} ${CABEZA_Y + 28}`} fill="none" stroke={CONTORNO} strokeWidth={2.5} strokeLinecap="round" /> },
    FV: { render: () => <ellipse cx={0} cy={CABEZA_Y + 28} rx={10} ry={2.5} fill="#7A3E3E" stroke={CONTORNO} strokeWidth={2} /> },
    L: { render: () => <ellipse cx={0} cy={CABEZA_Y + 29} rx={6} ry={7} fill="#7A3E3E" stroke={CONTORNO} strokeWidth={2} /> },
  },
};
