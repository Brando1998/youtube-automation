import { AbsoluteFill } from "remotion";
import { useCamera2D } from "../components/Camera2D";
import { ParallaxLayer } from "../components/ParallaxLayer";
import { Captions, type Palabra } from "../components/Captions";
import { SpeechBubble } from "../components/SpeechBubble";
import { ColorGrade } from "../components/ColorGrade";
import { Vignette } from "../components/Vignette";
import { Grain } from "../components/Grain";
import { FlickerLight } from "../components/FlickerLight";
import { Particles } from "../components/Particles";
import { Smoke } from "../components/Smoke";
import { Fog } from "../components/Fog";
import { Rain } from "../components/Rain";
import { Lightning } from "../components/Lightning";
import { CharacterPuppet } from "../components/CharacterPuppet";

const W = 540;
const H = 960;

// Evento de la toma: un relámpago en la palabra "NOCHE" (como en cabana-lucia.html),
// y la línea de diálogo de Lucía arranca justo después — todo dummy, no viene de
// Polly/Claude todavía (eso es Fase A6/A1 real).
const F_RELAMPAGO = [40];
const F_MIRA = 60;
const F_DIALOGO = 70;

const PALABRAS_PRUEBA: Palabra[] = [
  { texto: "Cada", inicio_frame: 5, fin_frame: 20 },
  { texto: "NOCHE", inicio_frame: 20, fin_frame: 40, clave: true },
  { texto: "salía", inicio_frame: 40, fin_frame: 58 },
  { texto: "a", inicio_frame: 58, fin_frame: 62 },
  { texto: "jugar", inicio_frame: 62, fin_frame: 85 },
];

/**
 * Render de prueba combinando casi toda la biblioteca de efectos sobre la escena
 * dummy de PruebaParallax: cámara 2.5D, luces (ventana/luna/linterna), partículas,
 * humo, niebla, lluvia + relámpago sincronizado, personaje animado con mirada y
 * globo de diálogo, gradación de color, viñeta y grano. Sin asset real todavía
 * (Fase A4 bloqueada por AWS Marketplace) — valida que los componentes encajan.
 */
export function PruebaEfectos() {
  const camera = useCamera2D({
    cx: W / 2,
    cy: H * 0.667,
    zoomInicial: 1,
    zoomFinal: 1.12,
    golpeZoomFrames: F_RELAMPAGO,
  });

  const svgProps = {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid slice" as const,
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ColorGrade preset="calido">
        <ParallaxLayer depth={0} camera={camera}>
          <svg {...svgProps}>
            <rect x={-80} y={-80} width={700} height={820} fill="#16213A" />
            <circle cx={420} cy={170} r={44} fill="#F1E6C3" />
          </svg>
        </ParallaxLayer>

        <ParallaxLayer depth={0.15} camera={camera}>
          <svg {...svgProps}>
            <path d="M-80 660 L60 560 L230 615 L380 580 L540 610 L620 580 L620 960 L-80 960Z" fill="#1A2235" />
          </svg>
        </ParallaxLayer>

        <ParallaxLayer depth={0.3} camera={camera}>
          <svg {...svgProps}>
            <path d="M40 760 L80 660 L120 760Z" fill="#17261E" />
            <path d="M400 780 L450 670 L500 780Z" fill="#17261E" />
          </svg>
        </ParallaxLayer>

        <ParallaxLayer depth={0.5} camera={camera}>
          <svg {...svgProps}>
            <rect x={-80} y={780} width={700} height={260} fill="#253423" />
          </svg>
        </ParallaxLayer>

        <ParallaxLayer depth={0.82} camera={camera}>
          <svg {...svgProps}>
            <CharacterPuppet
              x={200}
              y={820}
              escala={1}
              colorPlaceholder="#E4AA2F"
              mirarEnFrame={F_MIRA}
              visemas={[
                { tipo: "A", inicio_frame: F_DIALOGO, fin_frame: F_DIALOGO + 6 },
                { tipo: "reposo", inicio_frame: F_DIALOGO + 6, fin_frame: F_DIALOGO + 10 },
                { tipo: "O", inicio_frame: F_DIALOGO + 10, fin_frame: F_DIALOGO + 16 },
                { tipo: "reposo", inicio_frame: F_DIALOGO + 16, fin_frame: F_DIALOGO + 40 },
              ]}
            />
          </svg>
        </ParallaxLayer>
      </ColorGrade>

      <Smoke origen={{ x: 460, y: 700 }} depth={0.5} camera={camera} />
      <Fog camera={camera} width={W} />
      <Rain camera={camera} width={W} height={H} />
      <Lightning camera={camera} frames={F_RELAMPAGO} cx={150} />

      <FlickerLight
        camera={camera}
        luces={[
          { x: 420, y: 170, depth: 0, radio: 70, sprite: "cool", intensidad: 0.35, parpadeo: false },
          { x: 460, y: 660, depth: 0.15, radio: 60, sprite: "warm", intensidad: 0.45, parpadeo: true, seed: 2 },
          { x: 255, y: 760, depth: 0.82, radio: 90, sprite: "warm", intensidad: 0.8, parpadeo: true, seed: 0, capas: true },
        ]}
      />
      <Particles preset="luciernagas" cantidad={24} area={{ x0: -20, y0: 560, x1: 560, y1: 920 }} depth={0.6} camera={camera} />

      <Vignette />
      <Grain />

      <Captions palabras={PALABRAS_PRUEBA} />
      <SpeechBubble texto="¡Ven a jugar!" anclaX={200} anclaY={690} color="#F2B33D" inicioFrame={F_DIALOGO} />
    </AbsoluteFill>
  );
}
