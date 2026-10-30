import { Composition } from "remotion";
import { PruebaParallax } from "./compositions/PruebaParallax";
import { PruebaEfectos } from "./compositions/PruebaEfectos";
import { PruebaEpisodeSpec } from "./compositions/PruebaEpisodeSpec";
import { PruebaAudioReal } from "./compositions/PruebaAudioReal";
import { EpisodioCompleto, duracionTotalFrames, type EpisodioCompletoProps } from "./EpisodioCompleto";

// defaultProps minimal — el render real siempre pasa --props=<archivo.json> con el
// spec/catálogo de verdad (ver apps/web/app/pipeline_runner.py); esto solo evita que
// Remotion Studio se rompa si se abre esta composición sin pasarle nada.
const EPISODIO_DEFAULT_PROPS: EpisodioCompletoProps = {
  spec: { id: "vacio", personajes: [], escenas: [] },
  fondos: {},
  personajesCatalogo: {},
  lineasAudio: {},
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PruebaParallax"
        component={PruebaParallax}
        durationInFrames={150}
        fps={30}
        width={540}
        height={960}
      />
      <Composition
        id="PruebaEfectos"
        component={PruebaEfectos}
        durationInFrames={140}
        fps={30}
        width={540}
        height={960}
      />
      <Composition
        id="PruebaEpisodeSpec"
        component={PruebaEpisodeSpec}
        durationInFrames={450}
        fps={30}
        width={540}
        height={960}
      />
      <Composition
        id="PruebaAudioReal"
        component={PruebaAudioReal}
        durationInFrames={450}
        fps={30}
        width={540}
        height={960}
      />
      <Composition<any, EpisodioCompletoProps>
        id="Episodio"
        component={EpisodioCompleto}
        fps={30}
        width={540}
        height={960}
        durationInFrames={1}
        defaultProps={EPISODIO_DEFAULT_PROPS}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: Math.max(1, duracionTotalFrames(props.spec)),
        })}
      />
    </>
  );
};
