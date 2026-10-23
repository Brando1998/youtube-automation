import { useCurrentFrame } from "remotion";
import { easeOutBack } from "../easing";

/**
 * Globo de diálogo para cuando habla un personaje (modo_voz "dialogos"/"mixto" del
 * episode spec) — no viene de cabana-lucia.html (esa demo es solo narrador), se
 * diseñó nuevo siguiendo el mismo acabado de tinta que Captions: entra con un
 * pequeño "pop" (easeOutBack), borde y cola en tinta oscura, acento en el color del
 * personaje (`color_subtitulo` del spec).
 */
export function SpeechBubble({
  texto,
  anclaX,
  anclaY,
  color = "#F2B33D",
  inicioFrame,
}: {
  texto: string;
  anclaX: number;
  anclaY: number;
  color?: string;
  /** Frame en el que empieza a mostrarse esta línea — controla la animación de entrada. */
  inicioFrame: number;
}) {
  const frame = useCurrentFrame();
  const t = Math.min(1, Math.max(0, (frame - inicioFrame) / 6));
  if (t <= 0) return null;
  const s = 0.5 + 0.5 * easeOutBack(t);

  return (
    <div
      style={{
        position: "absolute",
        left: anclaX,
        top: anclaY,
        transform: `translate(-50%,-100%) scale(${s})`,
        transformOrigin: "50% 100%",
        maxWidth: 280,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#FFFBF2",
          color: "#05070A",
          border: "3px solid #05070A",
          borderRadius: 20,
          padding: "10px 16px",
          fontFamily: '"Barlow", sans-serif',
          fontWeight: 600,
          fontSize: 24,
          lineHeight: 1.25,
          boxShadow: `0 0 0 3px ${color}`,
          textAlign: "center",
        }}
      >
        {texto}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -15,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "11px solid transparent",
            borderRight: "11px solid transparent",
            borderTop: "15px solid #05070A",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -11,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "11px solid #FFFBF2",
          }}
        />
      </div>
    </div>
  );
}
