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
  { carpeta: "personajes", dictName: "PERSONAJES_VECTOR", tipo: "Omit<PersonajeDef, \"id\">" },
  { carpeta: "fondos", dictName: "FONDOS_VECTOR", tipo: "Omit<FondoDef, \"id\">" },
  { carpeta: "objetos", dictName: "OBJETOS_VECTOR", tipo: "ParteVisual" },
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
let contador = 0;

for (const { carpeta, dictName } of CATEGORIAS) {
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
  }
  dicts[dictName] = entradas;
}

const salida = `// GENERADO por scripts/generar_registry.mjs — no editar a mano.
// Resuelve los assets vectoriales de la biblioteca (library/) por su asset_ref,
// para que EpisodeRenderer/EpisodioCompleto los usen aunque --props no los traiga
// (remotion render necesita JSON puro, un componente de React no se serializa).
import type { FondoDef, ParteVisual, PersonajeDef } from "../catalog/types";

${imports.join("\n")}

export const PERSONAJES_VECTOR: Record<string, Omit<PersonajeDef, "id">> = {
${dicts.PERSONAJES_VECTOR.join("\n")}
};

export const FONDOS_VECTOR: Record<string, Omit<FondoDef, "id">> = {
${dicts.FONDOS_VECTOR.join("\n")}
};

export const OBJETOS_VECTOR: Record<string, ParteVisual> = {
${dicts.OBJETOS_VECTOR.join("\n")}
};
`;

writeFileSync(join(SRC_LIBRARY, "registry.ts"), salida, "utf-8");
console.log(`registry.ts escrito: ${contador} asset(s) de biblioteca.`);
