// Helpers compartidos por todas las páginas del dashboard — fetch simple contra la
// misma API JSON (mismo origen, la cookie de sesión viaja sola, sin CORS).

async function apiGet(url) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw await erroApi(resp);
  return resp.json();
}

async function apiPost(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!resp.ok) throw await erroApi(resp);
  return resp.json();
}

async function apiPatch(url, body) {
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!resp.ok) throw await erroApi(resp);
  return resp.json();
}

async function apiDelete(url) {
  const resp = await fetch(url, { method: 'DELETE' });
  if (!resp.ok && resp.status !== 204) throw await erroApi(resp);
}

async function erroApi(resp) {
  const datos = await resp.json().catch(() => ({}));
  return new Error(datos.detail || `Error ${resp.status}`);
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

const ESTADO_CLASE = {
  pendiente: 'estado-pendiente',
  corriendo: 'estado-corriendo',
  completado: 'estado-ok',
  fallido: 'estado-error',
  borrador: 'estado-pendiente',
  revision: 'estado-corriendo',
  aprobado: 'estado-ok',
};

function badgeEstado(estado) {
  const clase = ESTADO_CLASE[estado] || '';
  return `<span class="badge ${clase}">${estado}</span>`;
}

// Hace polling de un job hasta que termina (completado/fallido) y llama a onUpdate
// en cada vuelta — así el dashboard se actualiza sin que el usuario recargue.
function pollJob(jobId, onUpdate, intervalMs = 2000) {
  let activo = true;
  async function tick() {
    if (!activo) return;
    try {
      const job = await apiGet(`/jobs/${jobId}`);
      onUpdate(job);
      if (job.estado === 'completado' || job.estado === 'fallido') return;
    } catch (e) {
      onUpdate(null, e);
      return;
    }
    if (activo) setTimeout(tick, intervalMs);
  }
  tick();
  return () => { activo = false; };
}

// --- Revisión/aprobación de assets (hoja/partes/fondo/audio/render) — mismo panel
// reutilizado en personajes, fondos y el detalle de episodio.

function _nombresDeAsset(asset) {
  if (asset.tipo === 'parte_personaje') {
    const partes = asset.metadatos?.partes || {};
    const simples = Object.keys(partes).filter((k) => k !== 'bocas');
    const bocas = Object.keys(partes.bocas || {});
    return [...simples, ...bocas];
  }
  if (asset.tipo === 'capa_fondo') {
    return (asset.metadatos?.capas || []).map((c) => c.id);
  }
  return [null]; // hoja_personaje, audio, render: un solo archivo, sin ?nombre=
}

function _previewAsset(asset, nombre) {
  if (asset.tipo === 'ia_objeto') {
    // SVG ya saneado del lado del servidor (apps/web/app/svg_seguro.py, Fase D)
    // — se embebe directo, no hay archivo que pedir a /archivo para este tipo.
    return `<div title="${asset.metadatos?.descripcion || ''}" style="width:110px;height:110px;display:inline-block;margin:4px;background:repeating-conic-gradient(#8884 0% 25%,transparent 0% 50%) 0/16px 16px">${asset.metadatos?.svg || ''}</div>`;
  }
  const url = `/assets/${asset.id}/archivo${nombre ? `?nombre=${encodeURIComponent(nombre)}` : ''}`;
  if (asset.tipo === 'render') return `<video src="${url}" controls style="max-width:220px;display:inline-block;margin:4px"></video>`;
  if (asset.tipo === 'audio') return `<audio src="${url}" controls style="display:inline-block;margin:4px"></audio>`;
  return `<img src="${url}" alt="${nombre || ''}" title="${nombre || ''}" style="max-width:110px;max-height:110px;display:inline-block;margin:4px;background:repeating-conic-gradient(#8884 0% 25%,transparent 0% 50%) 0/16px 16px">`;
}

// Pinta `assets` (resultado de GET /assets?...&pendientes=true) dentro de `contenedorEl`,
// con preview + botón Aprobar por cada uno. Al aprobar, el panel de ese asset desaparece.
function renderPanelAssets(contenedorEl, assets) {
  contenedorEl.innerHTML = '';
  if (assets.length === 0) {
    contenedorEl.innerHTML = '<p class="vacio">Nada pendiente de revisión.</p>';
    return;
  }
  for (const asset of assets) {
    const div = document.createElement('div');
    div.className = 'panel';
    const previews = _nombresDeAsset(asset).map((n) => _previewAsset(asset, n)).join('');
    div.innerHTML = `
      <div class="flex-entre"><strong>${asset.tipo}</strong><span class="vacio">${formatFecha(asset.creado_en)}</span></div>
      <div>${previews}</div>
      <button class="btn btn-aprobar-asset" data-asset-id="${asset.id}">Aprobar</button>
    `;
    contenedorEl.appendChild(div);
  }
  contenedorEl.querySelectorAll('.btn-aprobar-asset').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await apiPatch(`/assets/${btn.dataset.assetId}/aprobar`, {});
        btn.closest('.panel').remove();
        if (!contenedorEl.querySelector('.panel')) {
          contenedorEl.innerHTML = '<p class="vacio">Nada pendiente de revisión.</p>';
        }
      } catch (e) {
        alert('No se pudo aprobar: ' + e.message);
        btn.disabled = false;
      }
    });
  });
}

// Fase C (docs/PROJECT_ROADMAP.md) — formulario genérico para los parámetros de
// una familia paramétrica (library/familias/), construido desde el
// `parametrosSchema` que devuelve GET /familias — así una familia nueva no
// necesita ningún cambio de este lado, el formulario sale solo del schema.
function renderizarCamposParametros(contenedorEl, parametrosSchema) {
  contenedorEl.innerHTML = Object.entries(parametrosSchema).map(([nombre, campo]) => {
    const id = `param_${nombre}`;
    if (campo.tipo === 'enum') {
      const opciones = (campo.opciones || []).map(
        (o) => `<option value="${o}" ${o === campo.porDefecto ? 'selected' : ''}>${o}</option>`
      ).join('');
      return `<label>${campo.etiqueta}<select name="${id}">${opciones}</select></label>`;
    }
    if (campo.tipo === 'color') {
      return `<label>${campo.etiqueta}<input type="color" name="${id}" value="${campo.porDefecto}"></label>`;
    }
    return `<label>${campo.etiqueta}<input type="text" name="${id}" value="${campo.porDefecto || ''}"></label>`;
  }).join('');
}

// Lee de vuelta los valores de los campos que arma renderizarCamposParametros.
function leerParametros(form, parametrosSchema) {
  const parametros = {};
  for (const nombre of Object.keys(parametrosSchema)) {
    parametros[nombre] = form.elements[`param_${nombre}`]?.value ?? '';
  }
  return parametros;
}

document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await fetch('/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  }
});
