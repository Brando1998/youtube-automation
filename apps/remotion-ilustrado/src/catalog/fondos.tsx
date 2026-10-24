import type { FondoDef } from "./types";

const svgProps = {
  viewBox: "0 0 540 960",
  width: "100%",
  height: "100%",
  preserveAspectRatio: "xMidYMid slice" as const,
};

/**
 * Catálogo de fondos — por ahora un único fondo mock ("cabana-bosque-noche", el
 * mismo id que referencia episode_spec/ejemplo_15s.json) con capas placeholder,
 * reusando las formas de PruebaEfectos. Cuando exista Fase A5 (fondos reales
 * generados por Stability), estas entradas se reemplazan por imágenes sin cambiar
 * la forma de FondoDef ni el renderer que las consume.
 */
export const FONDOS: Record<string, FondoDef> = {
  "2d/fondos/cabana-bosque-noche": {
    id: "2d/fondos/cabana-bosque-noche",
    capas: [
      {
        id: "cielo",
        depth: 0,
        render: () => (
          <svg {...svgProps}>
            <rect x={-80} y={-80} width={700} height={820} fill="#16213A" />
            <circle cx={420} cy={170} r={44} fill="#F1E6C3" />
          </svg>
        ),
      },
      {
        id: "lejano",
        depth: 0.15,
        render: () => (
          <svg {...svgProps}>
            <path d="M-80 660 L60 560 L230 615 L380 580 L540 610 L620 580 L620 960 L-80 960Z" fill="#1A2235" />
          </svg>
        ),
      },
      {
        id: "medio",
        depth: 0.3,
        render: () => (
          <svg {...svgProps}>
            <path d="M40 760 L80 660 L120 760Z" fill="#17261E" />
            <path d="M400 780 L450 670 L500 780Z" fill="#17261E" />
          </svg>
        ),
      },
      {
        id: "cabana",
        depth: 0.5,
        render: () => (
          <svg {...svgProps}>
            <rect x={-80} y={780} width={700} height={260} fill="#253423" />
            <rect x={400} y={680} width={90} height={100} fill="#3a2a1a" />
          </svg>
        ),
      },
    ],
    luces: [
      { x: 420, y: 170, depth: 0, radio: 70, sprite: "cool", intensidad: 0.35, parpadeo: false },
      { x: 445, y: 700, depth: 0.5, radio: 55, sprite: "warm", intensidad: 0.4, parpadeo: true, seed: 2 },
    ],
    humoOrigen: { x: 460, y: 700, depth: 0.5 },
  },
};
