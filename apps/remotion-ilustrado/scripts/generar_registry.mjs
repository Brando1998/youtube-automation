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

// Extrae un objeto literal balanceado a partir de un regex que matchea hasta
// (e incluye) su "{" de apertura — SIN importar/ejecutar el .tsx (mismo motivo
// que el resto del script: evitar depender de ts-node). Los objetos que esto
// lee (metadatos, PARAMETROS_SCHEMA) son literales JS simples (strings/
// números/arrays) — alcanza con contar llaves balanceadas y evaluar ESE
// fragmento con `Function` (es código propio de la biblioteca, no entrada de
// usuario; no es distinto en confianza a importar el .tsx directamente).
// Devuelve `null` si el regex no matchea (ambos campos son opcionales).
function extraerObjetoBalanceado(texto, regexInicio) {
  const m = regexInicio.exec(texto);
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
  if (fin === -1) throw new Error("objeto sin llave de cierre balanceada");
  const inicioLlave = m.index + m[0].length - 1;
  const snippet = texto.slice(inicioLlave, fin + 1);
  return new Function(`return (${snippet});`)();
}

const extraerMetadatos = (texto) => extraerObjetoBalanceado(texto, /\bmetadatos\s*:\s*\{/);
const extraerParametrosSchema = (texto) => extraerObjetoBalanceado(texto, /export const PARAMETROS_SCHEMA[^={]*=\s*\{/);

function nombresExportados(texto) {
  const consts = [...texto.matchAll(/export const (\w+)\s*[:=]/g)].map((m) => m[1]);
  const funciones = [...texto.matchAll(/export function (\w+)\s*\(/g)].map((m) => m[1]);
  return [...consts, ...funciones];
}

function extraerExports(texto, archivo) {
  const nombres = nombresExportados(texto);
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

// Una familia (library/familias/*.tsx) exporta ASSET_REF + TIPO_FAMILIA +
// PARAMETROS_SCHEMA + exactamente 1 función factory — más campos fijos que un
// asset normal (extraerExports de arriba), por eso tiene su propio extractor.
function extraerExportsFamilia(texto, archivo) {
  const nombres = nombresExportados(texto);
  const fijos = new Set(["ASSET_REF", "TIPO_FAMILIA", "PARAMETROS_SCHEMA"]);
  for (const requerido of fijos) {
    if (!nombres.includes(requerido)) throw new Error(`${archivo}: falta "export const ${requerido}"`);
  }
  const factorias = nombres.filter((n) => !fijos.has(n));
  if (factorias.length !== 1) {
    throw new Error(`${archivo}: se esperaba exactamente 1 función factory además de ${[...fijos].join("/")}, se encontraron ${factorias.length} (${factorias.join(", ")})`);
  }
  const tipoMatch = /export const TIPO_FAMILIA\s*=\s*"([^"]+)"/.exec(texto);
  if (!tipoMatch) throw new Error(`${archivo}: TIPO_FAMILIA no es un literal string simple`);
  return { nombreFactory: factorias[0], tipoFamilia: tipoMatch[1] };
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

// Familias paramétricas (Fase C, docs/PROJECT_ROADMAP.md) — library/familias/,
// cada una se registra en FAMILIAS_PERSONAJE_VECTOR u OBJETO_VECTOR según su
// propio TIPO_FAMILIA, y entra a registry.json con parametrosSchema para que el
// backend/dashboard sepan qué formulario mostrar sin hardcodear nada.
const familiasEntradas = { personaje: [], objeto: [] };
for (const archivo of listarArchivos("familias")) {
  const ruta = `./familias/${archivo.replace(/\.tsx$/, "")}`;
  const texto = readFileSync(join(SRC_LIBRARY, "familias", archivo), "utf-8");
  const { nombreFactory, tipoFamilia } = extraerExportsFamilia(texto, `familias/${archivo}`);
  if (!(tipoFamilia in familiasEntradas)) {
    throw new Error(`familias/${archivo}: TIPO_FAMILIA "${tipoFamilia}" inválido (debe ser "personaje" u "objeto")`);
  }
  const aliasRef = `REF_${contador}`;
  const aliasDef = `DEF_${contador}`;
  contador += 1;
  imports.push(`import { ASSET_REF as ${aliasRef}, ${nombreFactory} as ${aliasDef} } from "${ruta}";`);
  familiasEntradas[tipoFamilia].push(`  [${aliasRef}]: ${aliasDef},`);

  const refMatch = /export const ASSET_REF\s*=\s*"([^"]+)"/.exec(texto);
  if (!refMatch) throw new Error(`familias/${archivo}: ASSET_REF no es un literal string simple`);
  const parametrosSchema = extraerParametrosSchema(texto);
  if (!parametrosSchema) throw new Error(`familias/${archivo}: no se pudo leer PARAMETROS_SCHEMA`);
  indice.push({
    assetRef: refMatch[1],
    tipo: tipoFamilia === "personaje" ? "familia_personaje" : "familia_objeto",
    metadatos: { id: refMatch[1], version: 1, tags: [], capabilities: [] },
    parametrosSchema,
  });
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

// Familias paramétricas (Fase C) — factories, no definiciones ya armadas. Cada
// una se llama con los parámetros guardados en el Personaje/Objeto de la DB
// (ver app/pipeline_runner.py) para materializar la definición en el momento
// del render — así una instancia nueva no necesita su propio archivo de código.
export const FAMILIAS_PERSONAJE_VECTOR: Record<string, (params: any) => Omit<PersonajeDef, "id">> = {
${familiasEntradas.personaje.join("\n")}
};

export const FAMILIAS_OBJETO_VECTOR: Record<string, (params: any) => Omit<ObjetoDef, "id">> = {
${familiasEntradas.objeto.join("\n")}
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
