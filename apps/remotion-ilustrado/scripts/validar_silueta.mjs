#!/usr/bin/env node
// Validador automático de siluetas 2D — equivalente de assets/common/validate.py
// (pipeline 3D) pero para la biblioteca vectorial. No reemplaza la revisión visual
// (regla R3 de library/REGLAS.md), es un chequeo barato y determinista que corre
// ANTES de mostrarle un asset nuevo al usuario, para no depender solo de "a ojo".
//
// Qué detecta: cuenta las regiones de píxeles conectados (4-conectividad) que no
// son el color de fondo, sobre el PNG ya generado por `remotion still` (cero costo
// adicional, no se renderiza nada de nuevo). Reporta el tamaño de cada región.
//
// Qué NO decide por sí solo: cuántas regiones "deberían" existir depende del
// personaje (ojos, boca, props sueltos a propósito, etc.) — por eso este script
// reporta los números, no aprueba/rechaza solo. La señal útil es la que ya nos
// falló 3 veces en Rocco: una región grande (comparable en tamaño a la silueta
// principal) que aparece SEPARADA de la región más grande casi siempre es una
// pieza que se ve flotando/desconectada, no una característica a propósito (esas
// suelen ser mucho más chicas: ojos, boca, hueso).
//
// Uso: node scripts/validar_silueta.mjs <archivo.png> [colorFondoHex]
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";

const archivo = process.argv[2];
const fondoHex = process.argv[3] ?? "#EDE6D8"; // mismo fondo que PreviewPersonaje/PreviewFondo/PreviewObjeto
const UMBRAL_DISTANCIA_COLOR = 18; // tolerancia para antialiasing contra el fondo

if (!archivo) {
  console.error("Uso: node scripts/validar_silueta.mjs <archivo.png> [colorFondoHex]");
  process.exit(1);
}

function hexARgb(hex) {
  const limpio = hex.replace("#", "");
  return {
    r: parseInt(limpio.slice(0, 2), 16),
    g: parseInt(limpio.slice(2, 4), 16),
    b: parseInt(limpio.slice(4, 6), 16),
  };
}

const fondo = hexARgb(fondoHex);
const png = PNG.sync.read(readFileSync(archivo));
const { width, height, data } = png;

function esFondo(idx) {
  const dr = data[idx] - fondo.r;
  const dg = data[idx + 1] - fondo.g;
  const db = data[idx + 2] - fondo.b;
  const alpha = data[idx + 3];
  if (alpha < 10) return true; // transparente = fondo
  return Math.sqrt(dr * dr + dg * dg + db * db) < UMBRAL_DISTANCIA_COLOR;
}

const visitado = new Uint8Array(width * height);
const componentes = [];

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const pos = y * width + x;
    if (visitado[pos]) continue;
    const idx = pos * 4;
    if (esFondo(idx)) {
      visitado[pos] = 1;
      continue;
    }
    // BFS del componente conectado (4-vecinos) a partir de (x,y).
    let tamano = 0;
    let minX = x, maxX = x, minY = y, maxY = y;
    const pila = [pos];
    visitado[pos] = 1;
    while (pila.length) {
      const p = pila.pop();
      const px = p % width;
      const py = Math.floor(p / width);
      tamano++;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      const vecinos = [p - 1, p + 1, p - width, p + width];
      for (const v of vecinos) {
        if (v < 0 || v >= width * height) continue;
        if (Math.abs((v % width) - px) > 1) continue; // evita wrap de fila
        if (visitado[v]) continue;
        const vi = v * 4;
        visitado[v] = 1;
        if (!esFondo(vi)) pila.push(v);
      }
    }
    componentes.push({ tamano, bbox: { minX, maxX, minY, maxY } });
  }
}

componentes.sort((a, b) => b.tamano - a.tamano);
const totalPx = componentes.reduce((s, c) => s + c.tamano, 0);
const principal = componentes[0]?.tamano ?? 0;

console.log(`Archivo: ${archivo}`);
console.log(`Componentes detectados (no-fondo, 4-conectividad): ${componentes.length}`);
console.log(`Píxeles no-fondo totales: ${totalPx}`);
console.log();
console.log("Tamaño   | % del total | bbox (x,y)-(x,y)");
for (const c of componentes.slice(0, 10)) {
  const pct = ((c.tamano / totalPx) * 100).toFixed(1);
  console.log(
    `${String(c.tamano).padStart(8)} | ${pct.padStart(10)}% | (${c.bbox.minX},${c.bbox.minY})-(${c.bbox.maxX},${c.bbox.maxY})`
  );
}
if (componentes.length > 10) console.log(`... y ${componentes.length - 10} componente(s) más chico(s).`);

// Señal de alerta: una segunda región grande (>25% del tamaño de la principal) casi
// siempre es una pieza que debería estar fundida con el cuerpo y no lo está — ojos/
// boca/props reales son muchísimo más chicos que eso. No es un fail automático
// (puede haber casos legítimos), es una alerta para revisar antes de aprobar.
const segunda = componentes[1]?.tamano ?? 0;
if (principal > 0 && segunda / principal > 0.25) {
  console.log();
  console.log(
    `ALERTA: la segunda región más grande es ${((segunda / principal) * 100).toFixed(0)}% del tamaño de la principal.`
  );
  console.log("Si no es un prop/objeto suelto a propósito, probablemente hay una pieza desconectada del cuerpo.");
  process.exitCode = 2;
}
