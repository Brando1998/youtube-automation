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
import type { PersonajeDef } from "../../catalog/types";
import { arcoCorto, Circulo, FormaAhusada, puntoEnCirculo, tangentesExternas } from "../primitives";
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
      <linearGradient id="lucia-hoodie" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={HOODIE_CLARO} />
        <stop offset="100%" stopColor={HOODIE_OSCURO} />
      </linearGradient>
      <linearGradient id="lucia-jeans" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={JEANS_CLARO} />
        <stop offset="100%" stopColor={JEANS_OSCURO} />
      </linearGradient>
    </defs>
  );
}

function Pierna({ signo }: { signo: 1 | -1 }) {
  const cadera = { x: signo * 20, y: CADERA_Y, r: 19 };
  const tobillo = { x: signo * 22, y: TOBILLO_Y, r: 13 };
  return (
    <>
      <FormaAhusada baseX={cadera.x} baseY={cadera.y} baseR={cadera.r} puntaX={tobillo.x} puntaY={tobillo.y} puntaR={tobillo.r} color="url(#lucia-jeans)" />
      <ellipse cx={tobillo.x} cy={tobillo.y + 6} rx={17} ry={9} fill={ZAPATO} stroke={CONTORNO} strokeWidth={2.5} />
    </>
  );
}

// Hombro = círculo grande (la esquina redondeada del torso Y el punto donde nace
// la manga, a la vez). Mano = círculo chico al final del brazo. anguloTorso/
// anguloCuello son puntos FIJOS sobre el círculo del hombro (no tangentes — no hay
// un segundo círculo del lado del torso/cuello, son solo el borde recto del torso y
// la línea del cuello) que delimitan dónde termina el "lado del torso" y empieza la
// "manga" en el recorrido de un solo path. Para signo=1 son el espejo de signo=-1
// (reflejo en x: ángulo → 180-ángulo).
// Círculo chico y centrado en la altura del hombro (antes: r=26 centrado en -172
// ocupaba más de la mitad del alto del torso en su propia transición, sin dejar
// tramo recto a ancho completo entre la cadera y el hombro — por eso salía cono).
const HOMBRO = (signo: 1 | -1): Circulo => ({ x: signo * 34, y: -180, r: 18 });
const MANO = (signo: 1 | -1): Circulo => ({ x: signo * 57, y: -99, r: 11 });
const ANGULO_TORSO = (signo: 1 | -1) => (signo === -1 ? 150 : 30);
const ANGULO_CUELLO = (signo: 1 | -1) => (signo === -1 ? 250 : 290);

/**
 * Torso + ambos brazos como UNA sola curva cerrada (no piezas separadas que fusionar
 * — ver REGLAS.md y la investigación de Open Peeps/Avataaars en docs/PROGRESS.md:
 * así es como un ilustrador real evita costuras, construido aquí con círculos y
 * tangentes exactas en vez de Bézier adivinado). Recorrido: cadera-izq → lado del
 * torso → hombro-izq → manga-izq (ida) → mano-izq → manga-izq (vuelta) → hombro-izq
 * → cuello-izq → [línea del cuello] → cuello-der → hombro-der → manga-der (ida) →
 * mano-der → manga-der (vuelta) → hombro-der → lado del torso → cadera-der → cierre
 * por abajo.
 */
/** Todos los puntos/datos de un lado, siempre calculados en el sentido cadera→cuello
 * ("ida") — el lado derecho se recorre en el path al revés (cuello→cadera), lo que
 * solo exige invertir los sweep-flags de sus arcos (misma curva, sentido contrario),
 * no recalcular nada. */
function datosLado(signo: 1 | -1) {
  const hombro = HOMBRO(signo);
  const mano = MANO(signo);
  const anguloTorso = ANGULO_TORSO(signo);
  const anguloCuello = ANGULO_CUELLO(signo);
  const pTorso = puntoEnCirculo(hombro, anguloTorso);
  const pCuello = puntoEnCirculo(hombro, anguloCuello);
  const tan = tangentesExternas(hombro, mano);
  // aP1/aP2 están a ±90°+alpha de la dirección hombro→mano — para signo=-1 esa
  // dirección apunta hacia abajo-afuera, así que aP1 (que suma +90°) cae del lado de
  // "afuera/abajo" (más cerca de pTorso) y aP2 del lado "adentro/arriba" (más cerca
  // de pCuello). Para signo=1 se invierte. El ángulo de un punto en el círculo
  // "mano" (bP1/bP2) es el MISMO ángulo que su par en "hombro" (son tangentes
  // paralelas), por eso se reutiliza para el arco alrededor de la mano.
  const [tangTorsoLado, tangCuelloLado, anguloTorsoLado, anguloCuelloLado] =
    signo === -1 ? [tan.aP1, tan.aP2, tan.anguloA1, tan.anguloA2] : [tan.aP2, tan.aP1, tan.anguloA2, tan.anguloA1];
  const [tangTorsoMano, tangCuelloMano] = signo === -1 ? [tan.bP1, tan.bP2] : [tan.bP2, tan.bP1];
  const [anguloManoTorso, anguloManoCuello] = signo === -1 ? [tan.anguloA1, tan.anguloA2] : [tan.anguloA2, tan.anguloA1];
  return {
    hombro,
    mano,
    pTorso,
    pCuello,
    anguloTorso,
    anguloCuello,
    tangTorsoLado,
    tangCuelloLado,
    anguloTorsoLado,
    anguloCuelloLado,
    tangTorsoMano,
    tangCuelloMano,
    anguloManoTorso,
    anguloManoCuello,
  };
}

function TorsoYBrazos() {
  const izq = datosLado(-1);
  const der = datosLado(1);

  const d = [
    // --- lado izquierdo, sentido cadera -> cuello ---
    `M${-38} ${CADERA_Y}`,
    `L${izq.pTorso.x} ${izq.pTorso.y}`,
    arcoCorto(izq.hombro, izq.anguloTorso, izq.anguloTorsoLado, izq.tangTorsoLado),
    `L${izq.tangTorsoMano.x} ${izq.tangTorsoMano.y}`,
    arcoCorto(izq.mano, izq.anguloManoTorso, izq.anguloManoCuello, izq.tangCuelloMano, true),
    `L${izq.tangCuelloLado.x} ${izq.tangCuelloLado.y}`,
    arcoCorto(izq.hombro, izq.anguloCuelloLado, izq.anguloCuello, izq.pCuello),
    // --- línea del cuello, izq -> der ---
    `L${der.pCuello.x} ${der.pCuello.y}`,
    // --- lado derecho, sentido INVERSO (cuello -> cadera) — mismos ángulos que
    // datosLado(1), solo invertidos como inicio/fin; arcoCorto calcula los flags
    // correctos desde la diferencia angular real, no hace falta adivinar nada ---
    arcoCorto(der.hombro, der.anguloCuello, der.anguloCuelloLado, der.tangCuelloLado),
    `L${der.tangCuelloMano.x} ${der.tangCuelloMano.y}`,
    arcoCorto(der.mano, der.anguloManoCuello, der.anguloManoTorso, der.tangTorsoMano, true),
    `L${der.tangTorsoLado.x} ${der.tangTorsoLado.y}`,
    arcoCorto(der.hombro, der.anguloTorsoLado, der.anguloTorso, der.pTorso),
    `L${38} ${CADERA_Y}`,
    "Z",
  ].join(" ");

  return <path d={d} fill="url(#lucia-hoodie)" stroke={CONTORNO} strokeWidth={3} strokeLinejoin="round" />;
}

function Mano({ signo }: { signo: 1 | -1 }) {
  const mano = MANO(signo);
  return <circle cx={mano.x} cy={mano.y + 2} r={10} fill="url(#lucia-piel)" stroke={CONTORNO} strokeWidth={2.5} />;
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
  colorPlaceholder: HOODIE_CLARO,
  cabezaPivot: { x: CABEZA_X, y: CABEZA_Y },
  apendice: { render: () => null },
  prop: { render: () => null },

  cuerpo: {
    render: () => (
      <g>
        <Degradados />
        <Pierna signo={-1} />
        <Pierna signo={1} />
        <TorsoYBrazos />
        <Mano signo={-1} />
        <Mano signo={1} />
        <Cuello />
      </g>
    ),
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
