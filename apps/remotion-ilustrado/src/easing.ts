/** Easings portados de docs/reference/cabana-lucia.html — mismas fórmulas, para que el
 * timing se sienta igual que en la demo aprobada. */

export const easeIO = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Smoothstep entre [a,b] evaluado en x — usado para que un evento (parpadeo,
 * mirada, iluminación) entre/salga suave en vez de a golpe. */
export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
