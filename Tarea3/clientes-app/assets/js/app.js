/* ====== Utilidades ====== */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const storageKey = 'clientes.v2';

const toTitle   = s => (s||'').trim().replace(/\s+/g,' ').replace(/\b\p{L}/gu, m => m.toUpperCase());
const normalize = s => (s||'').trim().replace(/\s+/g,' ');
const escapeHtml = s => (s??'').toString()
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
const sanitizePhone = s => normalize(s).replace(/[^\d+()\-\s]/g,'');
const sanitizeCedula = s => normalize(s).toUpperCase().replace(/[^\dA-Z\-\.]/g,''); // letras/números/-/.

const uid = () => 'c_' + Math.random().toString(36).slice(2,8) + Date.now().toString(36);
const setStatus = msg => { const el = $('#status'); if (el) el.textContent = msg; };

function showToast(msg, type=''){
  const el = $('#toast'); if(!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + (type || '');
  setTimeout(() => { el.className = 'toast'; el.textContent=''; }, 2400);
}

function saveToStorage(list){ localStorage.setItem(storageKey, JSON.stringify(list)); }
function loadFromStorage(){
  try{ return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
  catch(e){ return []; }
}

function csvCell(v){ const s=(v??'').toString(); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
function hashStr(str){ let h=0; for(let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return Math.abs(h); }

/* ====== Estado ====== */
let clientes   = loadFromStorage();
let editId     = null;
let sortState  = { key: 'createdAt', asc: false };
let filtro     = '';
let vista      = 'tabla'; // 'tabla' | 'tarjetas'

/* ====== Elementos ====== */
const form = $('#formCliente');
const btnGuardar = $('#btnGuardar');
const btnCancelarEdicion = $('#btnCancelarEdicion');
const btnLimpiar = $('#btnLimpiar');

const cedulaInput = $('#cedula');
const nombresInput = $('#nombres');
const apellidosInput = $('#apellidos');
const emailInput = $('#email');
const telInput = $('#telefono');
const dirInput = $('#direccion');
const ciudadInput = $('#ciudad');
const paisInput = $('#pais');
const notasInput = $('#notas');

const contador = $('#contador');
const busqueda = $('#busqueda');
const btnExportar = $('#btnExportar');
const btnVista = $('#btnVista');
const tbody = $('#tbodyClientes');
const tablaWrap = $('#tablaWrap');
const cardsGrid = $('#cardsGrid');

/* ====== Validaciones en vivo ====== */
cedulaInput.addEventListener('input', () => {
  const v = sanitizeCedula(cedulaInput.value);
  if (v !== cedulaInput.value) cedulaInput.value = v;
  const duplicate = clientes.some(c => c.cedula === v && c.id !== editId);
  if (duplicate){
    cedulaInput.setCustomValidity('La cédula ya está registrada.');
    $('#cedulaError').textContent = 'La cédula ya está registrada.';
  } else {
    cedulaInput.setCustomValidity('');
    $('#cedulaError').textContent = 'Ingresa la cédula.';
  }
});

emailInput.addEventListener('input', () => {
  const value = normalize(emailInput.value).toLowerCase();
  const duplicate = clientes.some(c => (c.email||'').toLowerCase() === value && c.id !== editId);
  if (duplicate){
    emailInput.setCustomValidity('Este correo ya existe.');
    $('#emailError').textContent = 'Este correo ya existe.';
  } else {
    emailInput.setCustomValidity('');
    $('#emailError').textContent = 'Ingresa un correo válido.';
  }
});

telInput.addEventListener('input', () => {
  const v = sanitizePhone(telInput.value);
  if (v !== telInput.value) telInput.value = v;
  const digits = (v.match(/\d/g)||[]).length;
  telInput.setCustomValidity(digits >= 7 ? '' : 'Teléfono muy corto.');
});

/* ====== Modelo de Vista ====== */
function viewModel(c){
  const nombreCompleto = (c.nombres + ' ' + c.apellidos).trim();
  const hue = hashStr(c.cedula || c.email || c.id) % 360;
  return { ...c, nombreCompleto, hue };
}

function getFilteredSorted(){
  const term = filtro.toLowerCase();
  let data = clientes.map(viewModel).filter(c => {
    if (!term) return true;
    return (
      (c.cedula||'').toLowerCase().includes(term) ||
      c.nombreCompleto.toLowerCase().includes(term) ||
      (c.email||'').toLowerCase().includes(term) ||
      (c.telefono||'').toLowerCase().includes(term) ||
      (c.direccion||'').toLowerCase().includes(term) ||
      (c.ciudad||'').toLowerCase().includes(term) ||
      (c.pais||'').toLowerCase().includes(term)
    );
  });

  const { key, asc } = sortState;
  const dir = asc ? 1 : -1;
  data.sort((a,b) => {
    if (key === 'createdAt' || key === 'updatedAt'){
      return (new Date(a[key]) - new Date(b[key])) * dir;
    }
    const va = (a[key] ?? '').toString().toLowerCase();
    const vb = (b[key] ?? '').toString().toLowerCase();
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  return data;
}

/* ====== Render ====== */
function render(){
  const data = getFilteredSorted();
  contador.textContent = data.length;

  // Tabla
  if (!data.length){
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--muted); padding:18px">No hay clientes. Agrega uno con el formulario.</td></tr>`;
  } else {
    tbody.innerHTML = data.map(c => `
      <tr data-id="${c.id}">
        <td><span class="badge">${escapeHtml(c.cedula)}</span></td>
        <td><strong>${escapeHtml(c.nombreCompleto)}</strong><br><small class="muted">${escapeHtml(c.pais||'')}</small></td>
        <td>${escapeHtml(c.telefono||'')}</td>
        <td>${escapeHtml(c.email||'')}</td>
        <td>${escapeHtml(c.direccion||'')}</td>
        <td>${escapeHtml(c.ciudad||'')}</td>
        <td>${escapeHtml(c.pais||'')}</td>
        <td>
          <div class="actions">
            <button type="button" class="btn ghost" data-action="edit">Editar</button>
            <button type="button" class="btn warn" data-action="delete">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Tarjetas
  if (!data.length){
    cardsGrid.innerHTML = `<div class="client-card"><div class="muted">No hay clientes. Agrega uno con el formulario.</div></div>`;
  } else {
    cardsGrid.innerHTML = data.map(c => {
      const initials = (c.nombres?.[0]||'').toUpperCase() + (c.apellidos?.[0]||'').toUpperCase();
      return `
        <article class="client-card" data-id="${c.id}">
          <div class="client-head">
            <div class="client-main">
              <div class="avatar" style="--hue:${c.hue}">${escapeHtml(initials)}</div>
              <div class="client-title">
                <strong>${escapeHtml(c.nombreCompleto)}</strong>
                <small class="muted">Cédula ${escapeHtml(c.cedula)}</small>
              </div>
            </div>
            <div class="actions">
              <button type="button" class="btn ghost" data-action="edit">Editar</button>
              <button type="button" class="btn warn" data-action="delete">Eliminar</button>
            </div>
          </div>
          <div>
            <div><strong>Tel.</strong> <a href="tel:${encodeURI(c.telefono)}">${escapeHtml(c.telefono||'')}</a></div>
            <div><strong>Email</strong> <a href="mailto:${encodeURI(c.email)}">${escapeHtml(c.email||'')}</a></div>
            <div><strong>Dirección</strong> ${escapeHtml(c.direccion||'')}</div>
            <div><strong>Ubicación</strong> ${escapeHtml([c.ciudad,c.pais].filter(Boolean).join(', '))}</div>
            ${c.notas ? `<div><strong>Notas</strong> ${escapeHtml(c.notas)}</div>` : ''}
          </div>
        </article>
      `;
    }).join('');
  }
}

/* ====== Interacción ====== */
// Ordenamiento por columnas (tabla)
$$('#tablaClientes thead th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (!key) return;
    if (sortState.key === key) sortState.asc = !sortState.asc;
    else sortState = { key, asc: true };
    render();
  });
});

// Buscar
busqueda.addEventListener('input', () => { filtro = busqueda.value; render(); });

// Acciones en tabla
tbody.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if(!btn) return;
  const tr = btn.closest('tr'); const id = tr?.getAttribute('data-id'); if(!id) return;
  if (btn.dataset.action === 'edit') startEdit(id);
  if (btn.dataset.action === 'delete') deleteCliente(id);
});

// Acciones en tarjetas
cardsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if(!btn) return;
  const card = btn.closest('.client-card'); const id = card?.getAttribute('data-id'); if(!id) return;
  if (btn.dataset.action === 'edit') startEdit(id);
  if (btn.dataset.action === 'delete') deleteCliente(id);
});

// Cambiar vista
btnVista.addEventListener('click', () => {
  vista = (vista === 'tabla') ? 'tarjetas' : 'tabla';
  applyView();
});

function applyView(){
  const isTable = vista === 'tabla';
  tablaWrap.classList.toggle('is-hidden', !isTable);
  cardsGrid.classList.toggle('is-hidden', isTable);
  btnVista.textContent = 'Vista: ' + (isTable ? 'Tarjetas' : 'Tabla');
}

// Exportar CSV
btnExportar.addEventListener('click', () => {
  if (!clientes.length){ showToast('No hay datos para exportar','error'); return; }
  const headers = [
    'ID','Cedula','Nombres','Apellidos','Telefono','Email','Direccion','Ciudad','Pais','Notas','Creado','Actualizado'
  ];
  const rows = clientes.map(c => [
    c.id, c.cedula, c.nombres, c.apellidos, c.telefono, c.email, c.direccion, c.ciudad||'', c.pais||'', c.notas||'', c.createdAt, c.updatedAt
  ]);
  const csv = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(["\uFEFF"+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `clientes_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('CSV generado','success');
});

/* ====== CRUD ====== */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.reportValidity()){ markInvalids(); return; }

  const now = new Date().toISOString();
  const c = collectFormData();

  // Duplicados defensivos
  const dupCed = clientes.some(x => x.cedula === c.cedula && x.id !== editId);
  if (dupCed){
    cedulaInput.setCustomValidity('La cédula ya está registrada.');
    cedulaInput.reportValidity(); cedulaInput.setCustomValidity('');
    return;
  }
  const dupEmail = clientes.some(x => (x.email||'').toLowerCase() === c.email.toLowerCase() && x.id !== editId);
  if (dupEmail){
    emailInput.setCustomValidity('Este correo ya existe.');
    emailInput.reportValidity(); emailInput.setCustomValidity('');
    return;
  }

  if (editId){
    const idx = clientes.findIndex(x => x.id === editId);
    if (idx !== -1) clientes[idx] = { ...clientes[idx], ...c, updatedAt: now };
    showToast('Cliente actualizado','success');
  } else {
    clientes.unshift({ id: uid(), ...c, createdAt: now, updatedAt: now });
    showToast('Cliente guardado','success');
  }

  saveToStorage(clientes);
  render();
  resetForm();
  setStatus('Lista actualizada');
});

function collectFormData(){
  return {
    cedula: sanitizeCedula(cedulaInput.value),
    nombres: toTitle(nombresInput.value),
    apellidos: toTitle(apellidosInput.value),
    email: normalize(emailInput.value).toLowerCase(),
    telefono: sanitizePhone(telInput.value),
    direccion: normalize(dirInput.value),
    ciudad: toTitle(ciudadInput.value),
    pais: toTitle(paisInput.value),
    notas: normalize(notasInput.value),
  };
}

function startEdit(id){
  const c = clientes.find(x => x.id === id); if(!c) return;
  editId = id;
  cedulaInput.value   = c.cedula || '';
  nombresInput.value  = c.nombres || '';
  apellidosInput.value = c.apellidos || '';
  emailInput.value    = c.email || '';
  telInput.value      = c.telefono || '';
  dirInput.value      = c.direccion || '';
  ciudadInput.value   = c.ciudad || '';
  paisInput.value     = c.pais || '';
  notasInput.value    = c.notas || '';

  btnGuardar.textContent = 'Guardar cambios';
  btnCancelarEdicion.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setStatus('Editando cliente: ' + (c.nombres + ' ' + c.apellidos));
}

function deleteCliente(id){
  const c = clientes.find(x => x.id === id); if(!c) return;
  const ok = confirm(`¿Eliminar a "${c.nombres} ${c.apellidos}" (cédula ${c.cedula})?\nEsta acción no se puede deshacer.`);
  if (!ok) return;
  clientes = clientes.filter(x => x.id !== id);
  saveToStorage(clientes);
  render();
  showToast('Cliente eliminado');
  setStatus('Cliente eliminado');
  if (editId === id) resetForm();
}

btnLimpiar.addEventListener('click', resetForm);
btnCancelarEdicion.addEventListener('click', resetForm);

function resetForm(){
  form.reset();
  editId = null;
  btnGuardar.textContent = 'Guardar cliente';
  btnCancelarEdicion.style.display = 'none';
  $$('.f').forEach(n => n.classList.remove('invalid'));
  cedulaInput.setCustomValidity(''); emailInput.setCustomValidity(''); telInput.setCustomValidity('');
}

function markInvalids(){
  $$('#formCliente input, #formCliente textarea').forEach(el => {
    const wrap = el.closest('.f'); if(!wrap) return;
    if (!el.checkValidity()) wrap.classList.add('invalid'); else wrap.classList.remove('invalid');
  });
}
form.addEventListener('input', (e) => {
  const el = e.target; if (!(el instanceof HTMLElement)) return;
  const wrap = el.closest('.f'); if (wrap){
    if (!el.checkValidity()) wrap.classList.add('invalid'); else wrap.classList.remove('invalid');
  }
});

/* ====== Inicio ====== */
render();
applyView();
setStatus('Aplicación cargada. Puedes comenzar a registrar clientes.');
