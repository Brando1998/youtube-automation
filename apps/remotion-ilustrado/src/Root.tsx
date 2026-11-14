import { Composition } from "remotion";
import { PruebaParallax } from "./compositions/PruebaParallax";
import { PruebaEfectos } from "./compositions/PruebaEfectos";
import { PruebaEpisodeSpec } from "./compositions/PruebaEpisodeSpec";
import { PruebaAudioReal } from "./compositions/PruebaAudioReal";
import { PruebaVector } from "./compositions/PruebaVector";
import { PruebaCuerposHumanoides } from "./compositions/PruebaCuerposHumanoides";
import { PruebaHombroFK } from "./compositions/PruebaHombroFK";
import { PreviewPersonaje, type PreviewPersonajeProps } from "./compositions/PreviewPersonaje";
import { PreviewFondo, type PreviewFondoProps } from "./compositions/PreviewFondo";
import { PreviewObjeto, type PreviewObjetoProps } from "./compositions/PreviewObjeto";
import { PreviewFamilia, type PreviewFamiliaProps } from "./compositions/PreviewFamilia";
import { PreviewSvgGenerado, type PreviewSvgGeneradoProps } from "./compositions/PreviewSvgGenerado";
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
      <Composition
        id="PruebaVector"
        component={PruebaVector}
        durationInFrames={150}
        fps={30}
        width={540}
        height={960}
      />
      <Composition
        id="PruebaCuerposHumanoides"
        component={PruebaCuerposHumanoides}
        durationInFrames={1}
        fps={30}
        width={540}
        height={960}
      />
      <Composition
        id="PruebaHombroFK"
        component={PruebaHombroFK}
        durationInFrames={1}
        fps={30}
        width={540}
        height={960}
      />
      <Composition<any, PreviewPersonajeProps>
        id="PreviewPersonaje"
        component={PreviewPersonaje}
        durationInFrames={1}
        fps={30}
        width={540}
        height={960}
        defaultProps={{ asset_ref: "" }}
      />
      <Composition<any, PreviewFondoProps>
        id="PreviewFondo"
        component={PreviewFondo}
        durationInFrames={1}
        fps={30}
        width={540}
        height={960}
        defaultProps={{ asset_ref: "" }}
      />
      <Composition<any, PreviewObjetoProps>
        id="PreviewObjeto"
        component={PreviewObjeto}
        durationInFrames={1}
        fps={30}
        width={540}
        height={960}
        defaultProps={{ asset_ref: "" }}
      />
      <Composition<any, PreviewFamiliaProps>
        id="PreviewFamilia"
        component={PreviewFamilia}
        durationInFrames={1}
        fps={30}
        width={540}
        height={960}
        defaultProps={{ familia: "", tipo: "personaje", parametros: {} }}
      />
      <Composition<any, PreviewSvgGeneradoProps>
        id="PreviewSvgGenerado"
        component={PreviewSvgGenerado}
        durationInFrames={1}
        fps={30}
        width={540}
        height={960}
        defaultProps={{ svg: "<svg></svg>" }}
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
