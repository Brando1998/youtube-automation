import { Composition } from "remotion";
import { PruebaParallax } from "./compositions/PruebaParallax";
import { PruebaEfectos } from "./compositions/PruebaEfectos";

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
    </>
  );
};
