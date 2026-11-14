import { AbsoluteFill, Audio, staticFile, useVideoConfig } from "remotion";
import { useCamera2D } from "./components/Camera2D";
import { ParallaxLayer } from "./components/ParallaxLayer";
import { Captions, type Palabra } from "./components/Captions";
import { SpeechBubble } from "./components/SpeechBubble";
import { ColorGrade } from "./components/ColorGrade";
import { Vignette } from "./components/Vignette";
import { Grain } from "./components/Grain";
import { FlickerLight } from "./components/FlickerLight";
import { Particles, type ParticlePreset } from "./components/Particles";
import { Smoke } from "./components/Smoke";
import { Fog } from "./components/Fog";
import { Rain } from "./components/Rain";
import { Lightning } from "./components/Lightning";
import { CharacterPuppet, type Segmento } from "./components/CharacterPuppet";
import type { FondoDef, PersonajeDef } from "./catalog/types";
import { buscarClip } from "./engine/animation/clips/registro";
import { FAMILIAS_PERSONAJE_VECTOR, FONDOS_VECTOR, PERSONAJES_VECTOR } from "./library/registry";

/** Una entrada de `personajesCatalogo` (--props) es o bien un `PersonajeDef` ya
 * armado (biblioteca fija, viejo camino PNG/Stability — ver preparar_catalogo_
 * remotion en pipeline_runner.py) o, desde la Fase C (familias paramétricas,
 * docs/PROJECT_ROADMAP.md), una referencia a una familia + sus parámetros —
 * ambos son JSON plano, viajan bien por --props; lo que NO viaja es la
 * definición ya materializada de una familia (tendría funciones de render). */
export type EntradaPersonajeCatalogo = PersonajeDef | { familiaRef: string; parametros: Record<string, unknown> };

function esEntradaFamilia(entrada: EntradaPersonajeCatalogo): entrada is { familiaRef: string; parametros: Record<string, unknown> } {
  return "familiaRef" in entrada;
}

// ---- Tipos mínimos que reflejan episode_spec/schema.json (subset usado aquí) ----
// No se generan automáticamente del JSON Schema (sería una dependencia más para un
// subset chico); si el schema cambia, actualizar a mano.

export interface PersonajeSpec {
  id: string;
  nombre: string;
  color_subtitulo?: string;
  asset_ref?: string;
}

export interface LineaSpec {
  id: string;
  hablante: string;
  texto: string;
}

export interface EventoSpec {
  tipo: string;
  en_frame?: number;
  en_palabra?: { linea: string; texto: string };
}

export interface TomaSpec {
  id: string;
  duracion_frames: number;
  camara?: { zoom_inicial?: number; zoom_final?: number; golpe_zoom_en?: string[] };
  lineas: LineaSpec[];
  eventos?: EventoSpec[];
  render?: {
    ilustrado?: {
      capas_fondo?: string[];
      personajes_en_escena?: {
        id: string;
        posicion: [number, number];
        escala?: number;
        /** Animación de cuerpo (episode_spec/schema.json) — ver
         * engine/animation/clips/registro.ts para los clip_id reales disponibles. */
        gesto?: { clip_id: string; inicio_frame?: number };
      }[];
      efectos?: {
        humo?: boolean;
        niebla?: boolean;
        lluvia?: boolean;
        particulas?: ParticlePreset | null;
        grano?: boolean;
        vineta?: boolean;
        color_grade?: string;
      };
    };
  };
}

export interface EscenaSpec {
  id: string;
  fondo?: string;
  tomas: TomaSpec[];
}

export interface EpisodeSpec {
  id: string;
  personajes: PersonajeSpec[];
  escenas: EscenaSpec[];
}

export interface AudioLinea {
  fuente?: "polly" | "grabado";
  /** Ruta relativa a `public/` del app Remotion (consumible con `staticFile()`) —
   * Remotion no puede leer rutas absolutas arbitrarias del filesystem, el archivo
   * tiene que vivir dentro de `public/` (confirmado contra la documentación oficial). */
  archivo?: string;
  palabras: Palabra[];
  visemas: Segmento[];
}

/** Resuelve un evento del spec a un número de frame: directo (`en_frame`) o buscando
 * la palabra que lo dispara dentro de las palabras ya sincronizadas de esa línea
 * (`en_palabra`) — así "relámpago en la palabra NOCHE" se vuelve un frame concreto. */
function resolverFrame(evento: EventoSpec, lineasAudio: Record<string, AudioLinea>): number | null {
  if (evento.en_frame !== undefined) return evento.en_frame;
  if (evento.en_palabra) {
    const audio = lineasAudio[evento.en_palabra.linea];
    const palabra = audio?.palabras.find((p) => p.texto.toLowerCase() === evento.en_palabra!.texto.toLowerCase());
    return palabra?.inicio_frame ?? null;
  }
  return null;
}

/**
 * Arma una toma completa a partir del episode spec real (episode_spec/schema.json) +
 * catálogos de fondo/personaje — reemplaza las composiciones de prueba armadas a
 * mano (PruebaParallax/PruebaEfectos) por el renderer genérico que de verdad va a
 * usar el pipeline. `lineasAudio` viene de Polly/Whisper+Rhubarb (Fase A6); mientras
 * esa fase está bloqueada, se le pasa un mock con la misma forma.
 */
export function TomaIlustrada({
  spec,
  escena,
  toma,
  fondos,
  personajesCatalogo,
  lineasAudio,
}: {
  spec: EpisodeSpec;
  escena: EscenaSpec;
  toma: TomaSpec;
  fondos: Record<string, FondoDef>;
  personajesCatalogo: Record<string, EntradaPersonajeCatalogo>;
  lineasAudio: Record<string, AudioLinea>;
}) {
  const { width: W, height: H } = useVideoConfig();
  const ilustrado = toma.render?.ilustrado;
  const efectos = ilustrado?.efectos ?? {};

  const eventosResueltos = (toma.eventos ?? [])
    .map((e) => ({ tipo: e.tipo, frame: resolverFrame(e, lineasAudio) }))
    .filter((e): e is { tipo: string; frame: number } => e.frame !== null);

  const golpeZoomTipos = new Set(toma.camara?.golpe_zoom_en ?? []);
  const golpeZoomFrames = eventosResueltos.filter((e) => golpeZoomTipos.has(e.tipo)).map((e) => e.frame);
  const relampagoFrames = eventosResueltos.filter((e) => e.tipo === "relampago").map((e) => e.frame);
  const primerEventoFrame = eventosResueltos[0]?.frame;

  const camera = useCamera2D({
    cx: W / 2,
    cy: H * 0.667,
    zoomInicial: toma.camara?.zoom_inicial ?? 1,
    zoomFinal: toma.camara?.zoom_final ?? 1,
    golpeZoomFrames,
  });

  // El fallback a *_VECTOR cubre los assets de la biblioteca de código (library/) —
  // --props de render_episodio no los trae (son componentes, no datos JSON), los
  // resuelve el registry generado, importado estático en el bundle.
  const fondoVector = escena.fondo ? FONDOS_VECTOR[escena.fondo] : undefined;
  const fondo = escena.fondo
    ? (fondos[escena.fondo] ?? (fondoVector ? { id: escena.fondo, ...fondoVector } : undefined))
    : undefined;
  const capasVisibles = ilustrado?.capas_fondo
    ? fondo?.capas.filter((c) => ilustrado.capas_fondo!.includes(c.id))
    : fondo?.capas;

  const palabrasNarrador: Palabra[] = toma.lineas
    .filter((l) => l.hablante === "narrador")
    .flatMap((l) => lineasAudio[l.id]?.palabras ?? []);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {toma.lineas.map((l) => {
        const archivo = lineasAudio[l.id]?.archivo;
        return archivo ? <Audio key={l.id} src={staticFile(archivo)} /> : null;
      })}

      <ColorGrade preset={efectos.color_grade ?? "neutro"}>
        {capasVisibles?.map((capa) => (
          <ParallaxLayer key={capa.id} depth={capa.depth} camera={camera}>
            {capa.src ? (
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                <image href={staticFile(capa.src)} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
              </svg>
            ) : (
              capa.render?.()
            )}
          </ParallaxLayer>
        ))}

        {(ilustrado?.personajes_en_escena ?? []).map((pEscena) => {
          // pEscena.id es el id del personaje en el spec (igual que `hablante`), no el
          // asset_ref — el asset_ref solo sirve para consultar el catálogo visual.
          const specPersonaje = spec.personajes.find((p) => p.id === pEscena.id);
          const refPersonaje = specPersonaje?.asset_ref;
          const personajeVector = refPersonaje ? PERSONAJES_VECTOR[refPersonaje] : undefined;
          const entradaCatalogo = refPersonaje ? personajesCatalogo[refPersonaje] : undefined;
          // Fase C: si la entrada es una familia paramétrica, materializar la
          // definición llamando a la factory con sus parámetros — es lo único
          // que NO podía viajar ya armado por --props (tendría funciones).
          const def = entradaCatalogo
            ? esEntradaFamilia(entradaCatalogo)
              ? { id: refPersonaje!, ...FAMILIAS_PERSONAJE_VECTOR[entradaCatalogo.familiaRef]?.(entradaCatalogo.parametros) }
              : entradaCatalogo
            : personajeVector
              ? { id: refPersonaje!, ...personajeVector }
              : undefined;
          const lineaActiva = toma.lineas.find((l) => l.hablante === pEscena.id);
          const audio = lineaActiva ? lineasAudio[lineaActiva.id] : undefined;
          // id desconocido -> undefined -> el personaje queda en reposo, no es un
          // error (ver episode_spec/schema.json: "se ignora silenciosamente").
          const clip = pEscena.gesto ? buscarClip(pEscena.gesto.clip_id) : undefined;
          return (
            <ParallaxLayer key={pEscena.id} depth={0.82} camera={camera}>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                <CharacterPuppet
                  x={pEscena.posicion[0] * W}
                  y={pEscena.posicion[1] * H}
                  escala={pEscena.escala ?? 1}
                  colorPlaceholder={def?.colorPlaceholder}
                  cabezaPivot={def?.cabezaPivot}
                  propPivot={def?.propPivot}
                  apendicePivot={def?.apendicePivot}
                  cuerpo={def?.cuerpo}
                  cabeza={def?.cabeza}
                  ojosAbiertos={def?.ojosAbiertos}
                  ojosCerrados={def?.ojosCerrados}
                  cejas={def?.cejas}
                  bocas={def?.bocas}
                  prop={def?.prop}
                  apendice={def?.apendice}
                  visemas={audio?.visemas}
                  mirarEnFrame={primerEventoFrame}
                  clips={clip ? [clip] : undefined}
                  clipsInicioFrame={pEscena.gesto?.inicio_frame ?? 0}
                />
              </svg>
            </ParallaxLayer>
          );
        })}
      </ColorGrade>

      {fondo?.humoOrigen && efectos.humo && (
        <Smoke origen={fondo.humoOrigen} depth={fondo.humoOrigen.depth} camera={camera} />
      )}
      {efectos.niebla && <Fog camera={camera} width={W} />}
      {efectos.lluvia && <Rain camera={camera} width={W} height={H} />}
      {relampagoFrames.length > 0 && <Lightning camera={camera} frames={relampagoFrames} />}
      {fondo?.luces && <FlickerLight camera={camera} luces={fondo.luces} />}
      {efectos.particulas && (
        <Particles
          preset={efectos.particulas}
          area={{ x0: -20, y0: H * 0.58, x1: W + 20, y1: H * 0.96 }}
          depth={0.6}
          camera={camera}
        />
      )}

      {efectos.vineta !== false && <Vignette />}
      {efectos.grano !== false && <Grain />}

      {palabrasNarrador.length > 0 && <Captions palabras={palabrasNarrador} />}

      {toma.lineas
        .filter((l) => l.hablante !== "narrador")
        .map((l) => {
          const specPersonaje = spec.personajes.find((p) => p.id === l.hablante);
          const pEscena = ilustrado?.personajes_en_escena?.find((pe) => pe.id === l.hablante);
          const audio = lineasAudio[l.id];
          const inicio = audio?.palabras[0]?.inicio_frame;
          if (!pEscena || inicio === undefined) return null;
          return (
            <SpeechBubble
              key={l.id}
              texto={l.texto}
              anclaX={pEscena.posicion[0] * W}
              anclaY={pEscena.posicion[1] * H - 250}
              color={specPersonaje?.color_subtitulo}
              inicioFrame={inicio}
            />
          );
        })}
    </AbsoluteFill>
  );
}
