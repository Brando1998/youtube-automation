/** RNG determinista (porta mulberry32 de cabana-lucia.html) — mismo seed siempre da la
 * misma secuencia, indispensable en Remotion porque los frames pueden renderizarse en
 * paralelo y fuera de orden; nunca usar Math.random() en código de composición. */
export function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rangeFn(rnd: () => number) {
  return (a: number, b: number) => a + (b - a) * rnd();
}
