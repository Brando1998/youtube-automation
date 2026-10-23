/** Sprites radiales (gradientes) para blitear luces/partículas en canvas — porta
 * sprite()/S_WARM/S_WHITE/S_COOL/S_FLY/S_SMOKE/S_FOG de cabana-lucia.html. Cada
 * sprite se genera una sola vez (no por frame) y se reusa via blit(). */

export type Sprite = HTMLCanvasElement;

export function makeSprite(radius: number, stops: [number, string][]): Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = radius * 2;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  stops.forEach((s) => gr.addColorStop(s[0], s[1]));
  g.fillStyle = gr;
  g.fillRect(0, 0, radius * 2, radius * 2);
  return c;
}

let cache: Record<string, Sprite> = {};

/** Sprites estándar del proyecto, generados perezosamente (una vez por proceso de render). */
export function stdSprites() {
  if (!cache.warm) {
    cache = {
      warm: makeSprite(64, [
        [0, "rgba(255,214,140,1)"],
        [0.3, "rgba(255,170,70,.5)"],
        [1, "rgba(255,140,40,0)"],
      ]),
      white: makeSprite(32, [
        [0, "rgba(255,255,240,1)"],
        [0.4, "rgba(255,240,200,.6)"],
        [1, "rgba(255,230,180,0)"],
      ]),
      cool: makeSprite(64, [
        [0, "rgba(220,230,255,.9)"],
        [0.35, "rgba(160,185,240,.35)"],
        [1, "rgba(120,150,220,0)"],
      ]),
      fly: makeSprite(16, [
        [0, "rgba(240,255,170,1)"],
        [0.35, "rgba(200,255,110,.55)"],
        [1, "rgba(160,230,80,0)"],
      ]),
      smoke: makeSprite(48, [
        [0, "rgba(120,126,138,.9)"],
        [0.6, "rgba(105,110,122,.45)"],
        [1, "rgba(95,100,112,0)"],
      ]),
      fog: makeSprite(64, [
        [0, "rgba(150,170,200,.75)"],
        [0.6, "rgba(140,160,190,.3)"],
        [1, "rgba(130,150,180,0)"],
      ]),
    };
  }
  return cache as Record<"warm" | "white" | "cool" | "fly" | "smoke" | "fog", Sprite>;
}

/** Dibuja un sprite centrado en (x,y) con radio rw (y rh si es elíptico) y alpha. */
export function blit(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  rw: number,
  alpha: number,
  rh?: number
) {
  if (alpha <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(sprite, x - rw, y - (rh ?? rw), rw * 2, (rh ?? rw) * 2);
  ctx.globalAlpha = 1;
}

/** Parpadeo determinista (porta fl(f,s) de la demo): suma de senos + "caída" periódica. */
export function flicker(frame: number, seed: number): number {
  let v =
    0.84 +
    0.09 * Math.sin(frame * 0.9 + seed) +
    0.05 * Math.sin(frame * 2.3 + seed * 2) +
    0.03 * Math.sin(frame * 5.1 + seed * 3);
  if (((frame * 7 + seed * 13) % 61) < 2) v -= 0.22;
  return v;
}
