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

document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await fetch('/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  }
});
