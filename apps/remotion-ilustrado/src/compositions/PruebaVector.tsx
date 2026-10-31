import { AbsoluteFill } from "remotion";
import { useCamera2D } from "../components/Camera2D";
import { ParallaxLayer } from "../components/ParallaxLayer";
import { CharacterPuppet } from "../components/CharacterPuppet";
import { BOSQUE } from "../library/fondos/bosque";
import { TITO } from "../library/personajes/tito";

const W = 540;
const H = 960;

/**
 * Prueba de la biblioteca vectorial (Tito + fondo bosque, ambos dibujados por
 * código, sin IA de imagen) — verifica que CharacterPuppet anima correctamente
 * (respiración/parpadeo/lip-sync/mirada) con `render()` en vez de `src`.
 */
export function PruebaVector() {
  const camera = useCamera2D({ cx: W / 2, cy: H * 0.667, zoomInicial: 1, zoomFinal: 1.08, golpeZoomFrames: [] });

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {BOSQUE.capas.map((capa) => (
        <ParallaxLayer key={capa.id} depth={capa.depth} camera={camera}>
          {capa.render?.()}
        </ParallaxLayer>
      ))}

      <ParallaxLayer depth={0.82} camera={camera}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <CharacterPuppet
            x={220}
            y={860}
            escala={1}
            cuerpo={TITO.cuerpo}
            cabeza={TITO.cabeza}
            ojosAbiertos={TITO.ojosAbiertos}
            ojosCerrados={TITO.ojosCerrados}
            cejas={TITO.cejas}
            bocas={TITO.bocas}
            prop={TITO.prop}
            cabezaPivot={TITO.cabezaPivot}
            propPivot={TITO.propPivot}
            apendicePivot={TITO.apendicePivot}
            mirarEnFrame={40}
            visemas={[
              { tipo: "A", inicio_frame: 60, fin_frame: 68 },
              { tipo: "reposo", inicio_frame: 68, fin_frame: 74 },
              { tipo: "O", inicio_frame: 74, fin_frame: 82 },
              { tipo: "reposo", inicio_frame: 82, fin_frame: 150 },
            ]}
          />
        </svg>
      </ParallaxLayer>
    </AbsoluteFill>
  );
}
