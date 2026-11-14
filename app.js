(() => {
const $ = s => document.querySelector(s);
const KEY = 'weare.v1';
const C = 263.9;

let S = { meeting: 'RAYCES', members: [], att: {} };
try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.members) S = r; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
let date = todayStr(), filter = 'all', query = '';
let editingId = null, lastCount = 0;

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const full = m => `${m.nombres} ${m.apellidos}`.trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dayAtt = () => (S.att[date] ||= {});
const isIn = id => !!(S.att[date] && S.att[date][id]);
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const icons = () => window.lucide && lucide.createIcons();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const titleCase = s => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const cleanPhone = s => s.replace(/[^\d+]/g, '');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400);
}

/* ---------- Sheets ---------- */
function openSheet(id) {
  document.querySelectorAll('.sheet.on').forEach(s => s !== $(id) && s.classList.remove('on'));
  $(id).classList.add('on'); $('#scrim').classList.add('on'); $(id).setAttribute('aria-hidden', 'false');
}
function closeSheets() {
  document.querySelectorAll('.sheet.on').forEach(s => { s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); });
  $('#scrim').classList.remove('on');
  if (document.activeElement) document.activeElement.blur();
}
$('#scrim').onclick = closeSheets;
document.addEventListener('keydown', e => e.key === 'Escape' && closeSheets());
// arrastrar hacia abajo para cerrar
document.querySelectorAll('.sheet').forEach(sh => {
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop <= 0 && e.target.closest('.grab, h2, .sub')) { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; } }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 === null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) closeSheets(); y0 = null; });
});

/* ---------- Header ---------- */
function renderHead() {
  $('#meetingName').textContent = S.meeting || 'Reunión';
  const [y, m, d] = date.split('-').map(Number);
  const dl = new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  $('#dateLabel').textContent = dl.charAt(0).toUpperCase() + dl.slice(1);
  $('#dateInput').value = date;
}
function renderCount() {
  const total = S.members.length;
  const n = S.members.filter(m => isIn(m.id)).length;
  $('#cntNum').textContent = n;
  $('#cntTot').textContent = `de ${total}`;
  $('#prog').style.strokeDashoffset = C * (1 - (total ? n / total : 0));
  if (n !== lastCount) { const b = $('#cntNum'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); lastCount = n; }
}

/* ---------- List ---------- */
function hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return 205 + (h % 50); }
function initials(m) { return ((m.nombres[0] || '') + (m.apellidos[0] || '')).toUpperCase(); }

function rowHTML(m, i) {
  const h = hue(full(m));
  const isNew = m.nuevo === date;
  return `<button class="person ${isIn(m.id) ? 'in' : ''}" data-id="${m.id}" style="animation-delay:${Math.min(i, 14) * 28}ms">
    <span class="av" style="--h1:hsl(${h} 70% 52%);--h2:hsl(${h + 12} 75% 28%)">${esc(initials(m))}</span>
    <span class="who"><b>${esc(m.nombres)}</b><span>${esc(m.apellidos)}</span></span>
    ${isNew ? '<span class="badge">Nuevo</span>' : ''}
    <span class="chk"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
  </button>`;
}

function renderList() {
  const q = norm(query);
  let items = S.members.filter(m => {
    if (q && !norm(full(m)).includes(q) && !norm(m.celular).includes(q)) return false;
    if (filter === 'in') return isIn(m.id);
    if (filter === 'out') return !isIn(m.id);
    return true;
  }).sort((a, b) => norm(full(a)).localeCompare(norm(full(b)), 'es'));

  const el = $('#list');
  if (!S.members.length) {
    el.innerHTML = `<div class="empty"><div class="big"><i data-lucide="users"></i></div><h3>Aún no hay personas</h3><p>Agrega la lista de tu iglesia una sola vez y después solo tocas para marcar.</p><button class="pill solid" id="emptyAdd"><i data-lucide="list-plus"></i><span>Agregar lista</span></button></div>`;
    $('#emptyAdd').onclick = () => openSheet('#sheetImport');
  } else if (!items.length) {
    el.innerHTML = `<div class="empty"><div class="big"><i data-lucide="search-x"></i></div><h3>Sin resultados</h3><p>${query ? 'Prueba con otro nombre o registra a la persona como nueva.' : 'Nada por aquí.'}</p></div>`;
  } else {
    let html = '', cur = '', open = false, i = 0;
    for (const m of items) {
      const L = (norm(m.nombres)[0] || '#').toUpperCase();
      if (L !== cur) { if (open) html += '</div>'; html += `<div class="letter">${L}</div><div class="group">`; cur = L; open = true; }
      html += rowHTML(m, i++);
    }
    el.innerHTML = html + '</div>';
  }
  icons(); renderCount();
}

function toggle(id, row) {
  const d = dayAtt();
  if (d[id]) delete d[id]; else d[id] = Date.now();
  save();
  const on = !!d[id];
  buzz(on ? 14 : 6);
  row.classList.toggle('in', on);
  if (on) { row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop'); }
  renderCount();
  if (filter !== 'all') setTimeout(renderList, 380);
}

// toque y pulsación larga (editar)
(() => {
  let timer = null, fired = false, sx = 0, sy = 0;
  const list = $('#list');
  list.addEventListener('pointerdown', e => {
    const r = e.target.closest('.person'); if (!r) return;
    fired = false; sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { fired = true; buzz(20); openPerson(r.dataset.id); }, 550);
  });
  const cancel = () => clearTimeout(timer);
  list.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) cancel(); });
  list.addEventListener('pointerup', cancel); list.addEventListener('pointercancel', cancel);
  list.addEventListener('contextmenu', e => e.target.closest('.person') && e.preventDefault());
  list.addEventListener('click', e => {
    const r = e.target.closest('.person'); if (!r) return;
    if (fired) { fired = false; return; }
    toggle(r.dataset.id, r);
  });
})();

/* ---------- Búsqueda / filtros / fecha ---------- */
$('#q').addEventListener('input', e => { query = e.target.value; $('#qClear').hidden = !query; renderList(); });
$('#qClear').onclick = () => { $('#q').value = ''; query = ''; $('#qClear').hidden = true; renderList(); $('#q').focus(); };
$('#seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('on', x === b));
  $('.seg-pill').style.transform = `translateX(${['all', 'in', 'out'].indexOf(filter) * 100}%)`;
  renderList();
});
$('#dateInput').addEventListener('change', e => { if (e.target.value) { date = e.target.value; renderHead(); renderList(); } });

/* ---------- Persona nueva / editar ---------- */
function openPerson(id) {
  editingId = id || null;
  const f = $('#personForm'); f.reset();
  const m = id && S.members.find(x => x.id === id);
  $('#personTitle').textContent = m ? 'Editar persona' : 'Persona nueva';
  $('#personSub').textContent = m ? 'Corrige sus datos o elimínala de la lista.' : 'Se registrará y quedará marcada como presente.';
  $('#personBtn').textContent = m ? 'Guardar cambios' : 'Registrar y marcar';
  $('#btnDelPerson').hidden = !m;
  if (m) { f.nombres.value = m.nombres; f.apellidos.value = m.apellidos; f.celular.value = m.celular; }
  else if (query) { const p = query.trim().split(/\s+/); f.nombres.value = titleCase(p[0] || ''); f.apellidos.value = titleCase(p.slice(1).join(' ')); }
  openSheet('#sheetPerson');
  setTimeout(() => (m ? f.nombres : f.nombres.value ? f.celular : f.nombres).focus(), 380);
}
$('#btnNew').onclick = () => openPerson();
$('#personForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const nombres = titleCase(f.nombres.value), apellidos = titleCase(f.apellidos.value), celular = cleanPhone(f.celular.value);
  if (!nombres || !apellidos) return toast('Faltan nombres o apellidos');
  if (celular.replace(/\D/g, '').length < 7) return toast('Revisa el número de celular');
  if (editingId) {
    Object.assign(S.members.find(x => x.id === editingId), { nombres, apellidos, celular });
    save(); closeSheets(); renderList(); return toast('Cambios guardados');
  }
  const dup = S.members.find(m => m.celular && m.celular === celular);
  if (dup) {
    dayAtt()[dup.id] = Date.now(); save(); closeSheets(); renderList();
    return toast(`${dup.nombres} ya existía · marcada ✓`);
  }
  const m = { id: uid(), nombres, apellidos, celular, nuevo: date };
  S.members.push(m); dayAtt()[m.id] = Date.now(); save();
  closeSheets(); $('#q').value = ''; query = ''; $('#qClear').hidden = true; renderList();
  buzz([12, 40, 12]); toast(`${nombres} registrada ✓`);
  setTimeout(() => { const r = document.querySelector(`[data-id="${m.id}"]`); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('pop'); } }, 200);
});
$('#btnDelPerson').onclick = () => {
  const m = S.members.find(x => x.id === editingId);
  if (!m || !confirm(`¿Eliminar a ${full(m)} de la lista?`)) return;
  S.members = S.members.filter(x => x.id !== editingId);
  Object.values(S.att).forEach(d => delete d[editingId]);
  save(); closeSheets(); renderList(); toast('Eliminada');
};

/* ---------- Exportar ---------- */
function reportRows() {
  const [y, m, d] = date.split('-');
  const rows = S.members.map(p => ({ p, in: isIn(p.id), nuevo: p.nuevo === date }));
  rows.sort((a, b) => (b.in - a.in) || norm(full(a.p)).localeCompare(norm(full(b.p)), 'es'));
  return { rows, fecha: `${d}/${m}/${y}` };
}
function csvText() {
  const { rows, fecha } = reportRows();
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['Fecha', 'Reunión', 'Nombres', 'Apellidos', 'Celular', 'Asistió', 'Nuevo'].map(q).join(',')];
  rows.forEach(r => lines.push([fecha, S.meeting, r.p.nombres, r.p.apellidos, r.p.celular, r.in ? 'Sí' : 'No', r.nuevo ? 'Sí' : 'No'].map(q).join(',')));
  return '﻿' + lines.join('\r\n');
}
function fileName() { return `asistencia-${norm(S.meeting).replace(/\W+/g, '-')}-${date}.csv`; }
function summaryText() {
  const { rows, fecha } = reportRows();
  const ins = rows.filter(r => r.in), news = ins.filter(r => r.nuevo);
  let t = `*${S.meeting}* · ${fecha}\n✅ ${ins.length} asistentes de ${rows.length}\n`;
  if (news.length) t += `\n🆕 *Nuevos (${news.length})*\n` + news.map(r => `• ${full(r.p)} — ${r.p.celular}`).join('\n') + '\n';
  t += `\n*Asistentes*\n` + ins.map((r, i) => `${i + 1}. ${full(r.p)}`).join('\n');
  return t;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$('#btnFinish').onclick = () => {
  const { rows, fecha } = reportRows();
  const ins = rows.filter(r => r.in).length;
  $('#stIn').textContent = ins; $('#stNew').textContent = rows.filter(r => r.in && r.nuevo).length; $('#stOut').textContent = rows.length - ins;
  $('#finSub').textContent = `${S.meeting} · ${fecha}`;
  openSheet('#sheetFinish');
  if (ins && window.confetti) setTimeout(() => confetti({ particleCount: 70, spread: 75, origin: { y: .75 }, colors: ['#2f6bff', '#0a1f44', '#5b9bff', '#ffffff'], disableForReducedMotion: true, zIndex: 40 }), 250);
};
$('#btnCSV').onclick = () => { download(fileName(), csvText(), 'text/csv;charset=utf-8'); toast('Archivo descargado'); };
$('#btnCopy').onclick = async () => { try { await navigator.clipboard.writeText(summaryText()); toast('Resumen copiado'); } catch (e) { toast('No se pudo copiar'); } };
$('#btnWA').onclick = async () => {
  const text = summaryText();
  const file = new File([csvText()], fileName(), { type: 'text/csv' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  download(fileName(), csvText(), 'text/csv;charset=utf-8');
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  toast('Archivo descargado · adjúntalo en WhatsApp');
};

/* ---------- Ajustes / importar ---------- */
$('#btnMenu').onclick = () => { $('#setName').value = S.meeting; openSheet('#sheetMenu'); };
$('#setName').addEventListener('input', e => { S.meeting = e.target.value.trim() || 'RAYCES'; save(); renderHead(); });
$('#btnImport').onclick = () => openSheet('#sheetImport');

function splitName(parts) {
  if (parts.length === 1) return [parts[0], ''];
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts.slice(1).join(' ')];
  return [parts.slice(0, 2).join(' '), parts.slice(2).join(' ')];
}
function importLines(text) {
  let added = 0;
  text.split(/\r?\n/).forEach((line, idx) => {
    line = line.trim(); if (!line) return;
    const f = line.split(/[,;\t]/).map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
    if (idx === 0 && /nombre/i.test(line)) return;
    let phone = '';
    if (f.length > 1 && /\d{6,}/.test(f[f.length - 1].replace(/\D/g, '')) && !/[a-z]/i.test(f[f.length - 1])) phone = cleanPhone(f.pop());
    let nombres, apellidos;
    if (f.length >= 2) { nombres = f[0]; apellidos = f.slice(1).join(' '); }
    else [nombres, apellidos] = splitName((f[0] || '').split(/\s+/));
    nombres = titleCase(nombres || ''); apellidos = titleCase(apellidos || '');
    if (!nombres) return;
    const key = norm(`${nombres} ${apellidos}`);
    if (S.members.some(m => norm(full(m)) === key || (phone && m.celular === phone))) return;
    S.members.push({ id: uid(), nombres, apellidos, celular: phone }); added++;
  });
  save(); renderList(); return added;
}
$('#btnImportGo').onclick = () => {
  const n = importLines($('#importText').value);
  $('#importText').value = ''; closeSheets(); toast(n ? `${n} personas agregadas` : 'No se agregó nadie nuevo');
};
$('#btnFile').onclick = () => $('#fileCSV').click();
$('#fileCSV').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const n = importLines(await f.text()); e.target.value = ''; closeSheets(); toast(`${n} personas importadas`);
};
$('#btnBackup').onclick = () => { download(`weare-copia-${todayStr()}.json`, JSON.stringify(S), 'application/json'); toast('Copia guardada'); };
$('#btnRestore').onclick = () => $('#fileJSON').click();
$('#fileJSON').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const r = JSON.parse(await f.text());
    if (!r.members || !confirm('Esto reemplazará los datos actuales. ¿Continuar?')) return;
    S = r; save(); closeSheets(); renderHead(); renderList(); toast('Copia restaurada');
  } catch (err) { toast('Archivo no válido'); }
  e.target.value = '';
};
$('#btnClearDay').onclick = () => {
  if (!confirm('¿Quitar todas las asistencias de esta fecha?')) return;
  delete S.att[date]; save(); closeSheets(); renderList(); toast('Asistencia limpiada');
};

renderHead(); renderList(); icons();
})();
