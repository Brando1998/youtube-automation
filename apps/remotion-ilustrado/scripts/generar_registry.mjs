#!/usr/bin/env node
// Escanea apps/remotion-ilustrado/src/library/{personajes,objetos,fondos}/*.tsx y
// reescribe library/registry.ts — un import + una entrada de diccionario por
// archivo encontrado. NO importa/ejecuta los .tsx (evita necesitar ts-node); solo
// lee el texto y extrae por regex `export const ASSET_REF = "..."` + el siguiente
// `export const NOMBRE`. Por eso cada archivo de la biblioteca TIENE que exportar
// ASSET_REF explícito, no se infiere del nombre de archivo.
//
// Se corre a mano tras escribir/editar un asset (`node scripts/generar_registry.mjs`)
// y automáticamente como paso previo dentro del job del backend
// (pipeline_runner.py) — así nunca queda desincronizado en silencio.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_LIBRARY = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "library");

const CATEGORIAS = [
  { carpeta: "personajes", dictName: "PERSONAJES_VECTOR", tipo: "Omit<PersonajeDef, \"id\">", tipoRegistro: "personaje" },
  { carpeta: "fondos", dictName: "FONDOS_VECTOR", tipo: "Omit<FondoDef, \"id\">", tipoRegistro: "fondo" },
  { carpeta: "objetos", dictName: "OBJETOS_VECTOR", tipo: "Omit<ObjetoDef, \"id\">", tipoRegistro: "objeto" },
];

function listarArchivos(carpeta) {
  try {
    return readdirSync(join(SRC_LIBRARY, carpeta))
      .filter((f) => f.endsWith(".tsx"))
      .sort();
  } catch {
    return []; // la carpeta puede no existir todavía (p.ej. sin objetos aún)
  }
}

// Extrae el literal `metadatos: { ... }` del texto fuente SIN importar/ejecutar
// el .tsx (mismo motivo que el resto del script: evitar depender de ts-node).
// Los bloques de metadatos son literales JS simples (strings/números/arrays) —
// alcanza con encontrar las llaves balanceadas y evaluar ESE fragmento con
// `Function` (es código propio de la biblioteca, no entrada de usuario; no es
// distinto en confianza a importar el .tsx directamente). Devuelve `null` si el
// archivo no declara `metadatos` (sigue siendo opcional, Fase 1/6 del roadmap).
function extraerMetadatos(texto) {
  const m = /\bmetadatos\s*:\s*\{/.exec(texto);
  if (!m) return null;
  let i = m.index + m[0].length - 1; // posición de la "{" de apertura
  let profundidad = 0;
  let fin = -1;
  for (; i < texto.length; i++) {
    if (texto[i] === "{") profundidad++;
    else if (texto[i] === "}") {
      profundidad--;
      if (profundidad === 0) {
        fin = i;
        break;
      }
    }
  }
  if (fin === -1) throw new Error("metadatos: llave de apertura sin cierre balanceado");
  const inicioLlave = m.index + m[0].length - 1;
  const snippet = texto.slice(inicioLlave, fin + 1);
  return new Function(`return (${snippet});`)();
}

function extraerExports(texto, archivo) {
  const nombres = [...texto.matchAll(/export const (\w+)\s*[:=]/g)].map((m) => m[1]);
  const assetRefIdx = nombres.indexOf("ASSET_REF");
  if (assetRefIdx === -1) {
    throw new Error(`${archivo}: falta "export const ASSET_REF = \"...\";"`);
  }
  const definiciones = nombres.filter((n) => n !== "ASSET_REF");
  if (definiciones.length !== 1) {
    throw new Error(
      `${archivo}: se esperaba exactamente 1 export además de ASSET_REF, se encontraron ${definiciones.length} (${definiciones.join(", ")})`
    );
  }
  return { nombreDef: definiciones[0] };
}

const imports = [];
const dicts = {};
const indice = []; // para registry.json — ver abajo
let contador = 0;

for (const { carpeta, dictName, tipoRegistro } of CATEGORIAS) {
  const entradas = [];
  for (const archivo of listarArchivos(carpeta)) {
    const ruta = `./${carpeta}/${archivo.replace(/\.tsx$/, "")}`;
    const texto = readFileSync(join(SRC_LIBRARY, carpeta, archivo), "utf-8");
    const { nombreDef } = extraerExports(texto, `${carpeta}/${archivo}`);
    const aliasRef = `REF_${contador}`;
    const aliasDef = `DEF_${contador}`;
    contador += 1;
    imports.push(`import { ASSET_REF as ${aliasRef}, ${nombreDef} as ${aliasDef} } from "${ruta}";`);
    entradas.push(`  [${aliasRef}]: ${aliasDef},`);

    const refMatch = /export const ASSET_REF\s*=\s*"([^"]+)"/.exec(texto);
    if (!refMatch) throw new Error(`${carpeta}/${archivo}: ASSET_REF no es un literal string simple, no se pudo leer su valor`);
    const metadatos = extraerMetadatos(texto);
    if (metadatos) indice.push({ assetRef: refMatch[1], tipo: tipoRegistro, metadatos });
  }
  dicts[dictName] = entradas;
}

const salida = `// GENERADO por scripts/generar_registry.mjs — no editar a mano.
// Resuelve los assets vectoriales de la biblioteca (library/) por su asset_ref,
// para que EpisodeRenderer/EpisodioCompleto los usen aunque --props no los traiga
// (remotion render necesita JSON puro, un componente de React no se serializa).
import type { FondoDef, ObjetoDef, PersonajeDef } from "../catalog/types";

${imports.join("\n")}

export const PERSONAJES_VECTOR: Record<string, Omit<PersonajeDef, "id">> = {
${dicts.PERSONAJES_VECTOR.join("\n")}
};

export const FONDOS_VECTOR: Record<string, Omit<FondoDef, "id">> = {
${dicts.FONDOS_VECTOR.join("\n")}
};

export const OBJETOS_VECTOR: Record<string, Omit<ObjetoDef, "id">> = {
${dicts.OBJETOS_VECTOR.join("\n")}
};
`;

writeFileSync(join(SRC_LIBRARY, "registry.ts"), salida, "utf-8");

// registry.json — mismo índice que arma engine/registry/registro.ts en TS, pero
// como JSON plano para que el backend Python (apps/web/app/pipeline_runner.py,
// Fase A del plan de "detectar necesidades") lo lea directo, sin invocar Node en
// cada request. Misma fuente (este script), no un sistema paralelo.
writeFileSync(join(SRC_LIBRARY, "registry.json"), JSON.stringify(indice, null, 2) + "\n", "utf-8");

console.log(`registry.ts escrito: ${contador} asset(s) de biblioteca.`);
console.log(`registry.json escrito: ${indice.length} asset(s) con metadatos.`);
