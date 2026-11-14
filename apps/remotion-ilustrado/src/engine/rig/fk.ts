/**
 * Forward Kinematics mínimo (Fase 4, docs/PROJECT_ROADMAP.md) — resuelve la
 * posición/orientación en el mundo de cada hueso de una jerarquía a partir de sus
 * ángulos LOCALES (relativos al padre). Determinista: misma entrada, misma salida,
 * sin estado — se puede llamar en cualquier frame de Remotion sin acumular error.
 */
import type { Articulacion, PoseHueso, PoseMundo } from "./types";

/**
 * Resuelve las poses en el mundo de todas las articulaciones de `huesos`, dada la
 * posición/orientación de la raíz y un override opcional de ángulo local por
 * articulación (para animar — si una articulación no aparece en `angulosLocales`,
 * usa su `anguloReposo`).
 *
 * Lanza error si hay una referencia a un `padreId` que no existe en `huesos` o si
 * hay más de una raíz / ninguna raíz — una jerarquía mal formada es un error de
 * configuración, no algo que deba fallar en silencio con una pose rota.
 */
export function evaluarFK(
  huesos: Articulacion[],
  raizPose: PoseMundo,
  angulosLocales: Record<string, number> = {}
): Record<string, PoseHueso> {
  const porId = new Map(huesos.map((h) => [h.id, h]));
  const raices = huesos.filter((h) => !h.padreId);
  if (raices.length === 0) {
    throw new Error("evaluarFK: ningún hueso sin padreId — la jerarquía no tiene raíz.");
  }
  if (raices.length > 1) {
    throw new Error(`evaluarFK: más de una raíz (${raices.map((h) => h.id).join(", ")}) — una jerarquía debe tener exactamente 1.`);
  }
  for (const h of huesos) {
    if (h.padreId && !porId.has(h.padreId)) {
      throw new Error(`evaluarFK: "${h.id}" referencia un padreId ("${h.padreId}") que no existe en la lista de huesos.`);
    }
  }

  const resultado: Record<string, PoseHueso> = {};

  function resolver(id: string, proximal: PoseMundo) {
    const hueso = porId.get(id)!;
    const anguloLocal = angulosLocales[id] ?? hueso.anguloReposo;
    const anguloMundo = proximal.anguloMundo + anguloLocal;
    const rad = (anguloMundo * Math.PI) / 180;
    const distal: PoseMundo = {
      x: proximal.x + hueso.longitud * Math.cos(rad),
      y: proximal.y + hueso.longitud * Math.sin(rad),
      anguloMundo,
    };
    resultado[id] = { proximal, distal };
    for (const hijo of huesos) {
      if (hijo.padreId === id) resolver(hijo.id, distal);
    }
  }

  resolver(raices[0].id, raizPose);
  return resultado;
}
