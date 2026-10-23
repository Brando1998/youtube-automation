import { AbsoluteFill } from "remotion";
import { useCamera2D } from "../components/Camera2D";
import { ParallaxLayer } from "../components/ParallaxLayer";
import { Captions, type Palabra } from "../components/Captions";

const W = 540;
const H = 960;

// Palabras de prueba (dummy) solo para validar el componente Captions — no vienen de
// Polly todavía, eso es Fase A6.
const PALABRAS_PRUEBA: Palabra[] = [
  { texto: "Esto", inicio_frame: 10, fin_frame: 30 },
  { texto: "es", inicio_frame: 30, fin_frame: 45 },
  { texto: "una", inicio_frame: 45, fin_frame: 60 },
  { texto: "PRUEBA", inicio_frame: 60, fin_frame: 90, clave: true },
  { texto: "de", inicio_frame: 90, fin_frame: 105 },
  { texto: "parallax", inicio_frame: 105, fin_frame: 140 },
];

/**
 * Composición de prueba (Fase A3): capas de color planas en vez de arte generado,
 * para validar Camera2D + ParallaxLayer + Captions de punta a punta sin depender
 * todavía de ningún asset del estilo ilustrado.
 */
export function PruebaParallax() {
  const camera = useCamera2D({ cx: W / 2, cy: H * 0.667, zoomInicial: 1, zoomFinal: 1.1 });

  // Nota: cada capa lleva su propio <svg> autocontenido — un <div> (ParallaxLayer) no
  // puede ser hijo directo de un <svg> compartido, el DOM lo descarta en silencio.
  // En producción cada capa normalmente será una imagen <img> generada, no SVG.
  const svgProps = {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid slice" as const,
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* L0 — cielo, sin paralaje relativo (depth bajo) */}
      <ParallaxLayer depth={0} camera={camera}>
        <svg {...svgProps}>
          <rect x={-80} y={-80} width={700} height={820} fill="#16213A" />
          <circle cx={420} cy={170} r={44} fill="#F1E6C3" />
        </svg>
      </ParallaxLayer>

      {/* L1 — montañas lejanas */}
      <ParallaxLayer depth={0.15} camera={camera}>
        <svg {...svgProps}>
          <path d="M-80 660 L60 560 L230 615 L380 580 L540 610 L620 580 L620 960 L-80 960Z" fill="#1A2235" />
        </svg>
      </ParallaxLayer>

      {/* L2 — árboles medios */}
      <ParallaxLayer depth={0.3} camera={camera}>
        <svg {...svgProps}>
          <path d="M40 760 L80 660 L120 760Z" fill="#17261E" />
          <path d="M400 780 L450 670 L500 780Z" fill="#17261E" />
        </svg>
      </ParallaxLayer>

      {/* L3 — suelo */}
      <ParallaxLayer depth={0.5} camera={camera}>
        <svg {...svgProps}>
          <rect x={-80} y={780} width={700} height={260} fill="#253423" />
        </svg>
      </ParallaxLayer>

      {/* L4 — "personaje" placeholder, profundidad alta (se mueve casi con la cámara) */}
      <ParallaxLayer depth={0.82} camera={camera}>
        <svg {...svgProps}>
          <circle cx={200} cy={780} r={50} fill="#E4AA2F" />
        </svg>
      </ParallaxLayer>

      <Captions palabras={PALABRAS_PRUEBA} />
    </AbsoluteFill>
  );
}
