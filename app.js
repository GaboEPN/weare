(() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = 'weare.v1';
const C = 263.9;

// Ministerios y su color (matiz HSL)
const MINS = ['PAREJAS', 'MIC', 'MJC', 'MAYO', 'PEC', 'DAMAS', 'AÑOS DORADOS'];
const MHUE = { PAREJAS: 340, MIC: 28, MJC: 165, MAYO: 212, PEC: 250, DAMAS: 290, 'AÑOS DORADOS': 44 };

let S = { meeting: 'RAYCES', members: [], att: {} };
try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.members) S = r; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
let date = todayStr(), filter = 'all', minFilter = 'all', query = '';
let editingId = null, lastCount = 0;

const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const full = m => `${m.nombres} ${m.apellidos}`.trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dayAtt = () => (S.att[date] ||= {});
const isIn = id => !!(S.att[date] && S.att[date][id]);
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const icons = () => window.lucide && lucide.createIcons();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const titleCase = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const cleanPhone = s => (s || '').toString().replace(/[^\d+]/g, '');

// Ministerio sugerido por edad y sexo (Parejas se elige a mano)
function suggest(edad, sexo) {
  if (edad === '' || edad == null || isNaN(edad)) return '';
  edad = +edad;
  if (edad <= 11) return 'MIC';
  if (edad <= 18) return 'MJC';
  if (edad <= 29) return 'MAYO';
  if (edad <= 45) return 'PEC';
  if (sexo === 'mujer') return edad > 65 ? 'AÑOS DORADOS' : 'DAMAS';
  return '';
}
function matchMin(v) {
  const n = norm(v).replace(/\s+/g, ' ');
  if (!n) return '';
  if (n.startsWith('anos dorados') || n === 'dorados') return 'AÑOS DORADOS';
  return MINS.find(m => norm(m) === n) || '';
}
function matchSex(v) {
  const n = norm(v);
  if (!n) return '';
  if (n[0] === 'f' || n.startsWith('mujer') || n.startsWith('dama')) return 'mujer';
  if (n[0] === 'h' || n[0] === 'm' || n[0] === 'v') return 'hombre';
  return '';
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ---------- Hojas ---------- */
function openSheet(id) {
  $$('.sheet.on').forEach(s => s !== $(id) && s.classList.remove('on'));
  $(id).classList.add('on'); $('#scrim').classList.add('on'); $(id).setAttribute('aria-hidden', 'false');
}
function closeSheets() {
  $$('.sheet.on').forEach(s => { s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); });
  $('#scrim').classList.remove('on');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
$('#scrim').onclick = closeSheets;
$$('[data-close]').forEach(b => b.onclick = closeSheets);
document.addEventListener('keydown', e => e.key === 'Escape' && closeSheets());
$$('.sheet').forEach(sh => {
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (innerWidth < 700 && sh.scrollTop <= 0 && e.target.closest('.grab, .bar, h2, .sub')) { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; } }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 === null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) closeSheets(); y0 = null; });
});

/* ---------- Cabecera ---------- */
function renderHead() {
  $('#meetingName').textContent = S.meeting || 'Reunión';
  const [y, m, d] = date.split('-').map(Number);
  const dl = new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  $('#dateLabel').textContent = dl.charAt(0).toUpperCase() + dl.slice(1);
  $('#dateInput').value = date;
}
function renderMins() {
  const box = $('#mins'), sl = box.scrollLeft;
  const cnt = k => {
    const arr = S.members.filter(m => k === 'all' ? true : k === '_none' ? !m.ministerio : m.ministerio === k);
    return [arr.filter(m => isIn(m.id)).length, arr.length];
  };
  const keys = ['all', ...MINS];
  if (S.members.some(m => !m.ministerio)) keys.push('_none');
  box.innerHTML = keys.map(k => {
    const [p, t] = cnt(k);
    const label = k === 'all' ? 'Todos' : k === '_none' ? 'Sin ministerio' : k;
    return `<button data-m="${k}" class="${minFilter === k ? 'on' : ''}">${label}<em>${p}/${t}</em></button>`;
  }).join('');
  box.scrollLeft = sl;
}
function renderCount() {
  const total = S.members.length;
  const n = S.members.filter(m => isIn(m.id)).length;
  $('#cntNum').textContent = n;
  $('#cntTot').textContent = `de ${total}`;
  $('#prog').style.strokeDashoffset = C * (1 - (total ? n / total : 0));
  if (n !== lastCount) { const b = $('#cntNum'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); lastCount = n; }
  renderMins();
}

/* ---------- Lista ---------- */
function hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return 205 + (h % 50); }
function initials(m) { return ((m.nombres[0] || '') + (m.apellidos[0] || '')).toUpperCase(); }

function rowHTML(m, i) {
  const h = hue(full(m));
  return `<button class="person ${isIn(m.id) ? 'in' : ''}" data-id="${m.id}" style="animation-delay:${Math.min(i, 14) * 28}ms">
    <span class="av" style="--h1:hsl(${h} 70% 52%);--h2:hsl(${h + 12} 75% 28%)">${esc(initials(m))}</span>
    <span class="who"><b>${esc(m.nombres)}</b>
      <span class="sub2"><span>${esc(m.apellidos)}</span>${m.ministerio ? `<i class="mp" style="--mh:${MHUE[m.ministerio]}">${esc(m.ministerio)}</i>` : ''}</span></span>
    ${m.nuevo === date ? '<span class="badge">Nuevo</span>' : ''}
    <span class="chk"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
  </button>`;
}

function renderList() {
  const q = norm(query);
  const items = S.members.filter(m => {
    if (q && !norm(full(m)).includes(q) && !norm(m.celular).includes(q)) return false;
    if (minFilter === '_none' ? m.ministerio : minFilter !== 'all' && m.ministerio !== minFilter) return false;
    if (filter === 'in') return isIn(m.id);
    if (filter === 'out') return !isIn(m.id);
    return true;
  }).sort((a, b) => norm(full(a)).localeCompare(norm(full(b)), 'es'));

  const el = $('#list');
  const add = `<button class="addrow" data-act="new"><span class="plus"><i data-lucide="user-plus"></i></span><span><b>${query ? `Agregar “${esc(query.trim())}”` : 'Agregar persona nueva'}</b><small>${query ? 'No está en la lista · se marcará presente' : 'Visitante o alguien que falta en la lista'}</small></span></button>`;

  if (!S.members.length) {
    el.innerHTML = `<div class="empty"><div class="big"><i data-lucide="users"></i></div><h3>Aún no hay personas</h3><p>Importa tu lista de Excel una sola vez y después solo tocas para marcar.</p><button class="pill solid" id="emptyFile"><i data-lucide="file-spreadsheet"></i><span>Importar Excel</span></button><button class="pill ghost" data-act="new"><i data-lucide="user-plus"></i><span>Agregar una persona</span></button></div>`;
    $('#emptyFile').onclick = () => $('#fileCSV').click();
  } else if (!items.length) {
    el.innerHTML = add + `<div class="empty"><div class="big"><i data-lucide="search-x"></i></div><h3>Sin resultados</h3><p>Prueba con otro nombre, otro filtro o agrégala como nueva.</p></div>`;
  } else {
    let html = add, cur = '', open = false, i = 0;
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
  list.addEventListener('contextmenu', e => { const r = e.target.closest('.person'); if (r) { e.preventDefault(); openPerson(r.dataset.id); } });
  list.addEventListener('click', e => {
    const r = e.target.closest('.person'); if (!r) return;
    if (fired) { fired = false; return; }
    toggle(r.dataset.id, r);
  });
})();

// botones con data-act (dock, panel de escritorio, fila de agregar)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'new') openPerson();
  if (b.dataset.act === 'finish') openFinish();
});

/* ---------- Búsqueda / filtros / fecha ---------- */
$('#q').addEventListener('input', e => { query = e.target.value; $('#qClear').hidden = !query; renderList(); });
$('#qClear').onclick = () => { $('#q').value = ''; query = ''; $('#qClear').hidden = true; renderList(); $('#q').focus(); };
$('#seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  filter = b.dataset.f;
  $$('#seg button').forEach(x => x.classList.toggle('on', x === b));
  $('.seg-pill').style.transform = `translateX(${['all', 'in', 'out'].indexOf(filter) * 100}%)`;
  renderList();
});
$('#mins').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  minFilter = b.dataset.m; renderList();
  const on = $('#mins .on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
});
$('#dateInput').addEventListener('change', e => { if (e.target.value) { date = e.target.value; renderHead(); renderList(); } });

/* ---------- Persona nueva / editar ---------- */
let pickMin = '', pickSex = '', minTouched = false;
function buildMinPick() {
  $('#minPick').innerHTML = [...MINS, ''].map(m => `<button type="button" data-v="${m}">${m || 'Ninguno'}</button>`).join('');
}
function syncPick() {
  const f = $('#personForm');
  $$('#minPick button').forEach(b => b.classList.toggle('on', b.dataset.v === pickMin));
  $$('#sexSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === pickSex));
  const sug = suggest(f.edad.value, pickSex);
  $$('#minPick button').forEach(b => b.classList.toggle('sug', !!sug && b.dataset.v === sug));
  $('#minHint').textContent = sug ? `Según la edad${pickSex ? ' y el sexo' : ''}, le corresponde ${sug}.` : (f.edad.value !== '' && +f.edad.value > 45 && pickSex !== 'mujer' ? 'Elige el ministerio (por ejemplo PAREJAS si viene con su pareja).' : 'Se sugiere automáticamente según la edad.');
}
function autoMin() {
  const f = $('#personForm');
  if (minTouched) return syncPick();
  const sug = suggest(f.edad.value, pickSex);
  pickMin = sug; syncPick();
}
buildMinPick();
$('#minPick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pickMin = b.dataset.v; minTouched = true; buzz(6); syncPick(); });
$('#sexSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pickSex = pickSex === b.dataset.v ? '' : b.dataset.v; buzz(6); autoMin(); });
$('#personForm').edad.addEventListener('input', autoMin);

function openPerson(id) {
  editingId = id || null;
  const f = $('#personForm'); f.reset();
  const m = id && S.members.find(x => x.id === id);
  $('#personTitle').textContent = m ? 'Editar persona' : 'Persona nueva';
  $('#personBtn').textContent = m ? 'Guardar cambios' : 'Registrar y marcar presente';
  $('#btnDelPerson').hidden = !m;
  pickMin = ''; pickSex = ''; minTouched = false;
  if (m) {
    f.nombres.value = m.nombres; f.apellidos.value = m.apellidos; f.celular.value = m.celular || '';
    f.edad.value = m.edad ?? ''; pickSex = m.sexo || ''; pickMin = m.ministerio || ''; minTouched = true;
  } else if (query) {
    const p = query.trim().split(/\s+/); f.nombres.value = titleCase(p[0] || ''); f.apellidos.value = titleCase(p.slice(1).join(' '));
  }
  syncPick();
  openSheet('#sheetPerson');
  if (innerWidth >= 700) setTimeout(() => (f.nombres.value ? (f.apellidos.value ? f.edad : f.apellidos) : f.nombres).focus(), 350);
}
$('#personForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const nombres = titleCase(f.nombres.value), apellidos = titleCase(f.apellidos.value), celular = cleanPhone(f.celular.value);
  const edad = f.edad.value === '' ? '' : Math.round(+f.edad.value);
  if (!nombres) return toast('Escribe los nombres'), f.nombres.focus();
  if (!apellidos) return toast('Escribe los apellidos'), f.apellidos.focus();
  if (edad === '' || edad < 0 || edad > 110) return toast('Escribe la edad'), f.edad.focus();
  if (celular.replace(/\D/g, '').length < 7) return toast('Revisa el número de celular'), f.celular.focus();
  const data = { nombres, apellidos, celular, edad, sexo: pickSex, ministerio: pickMin };
  if (editingId) {
    Object.assign(S.members.find(x => x.id === editingId), data);
    save(); closeSheets(); renderList(); return toast('Cambios guardados');
  }
  const dup = S.members.find(m => m.celular && m.celular === celular);
  if (dup) {
    dayAtt()[dup.id] = Date.now(); save(); closeSheets(); renderList();
    return toast(`${dup.nombres} ya existía · marcada ✓`);
  }
  const m = { id: uid(), ...data, nuevo: date };
  S.members.push(m); dayAtt()[m.id] = Date.now(); save();
  closeSheets(); $('#q').value = ''; query = ''; $('#qClear').hidden = true; minFilter = 'all'; filter = 'all';
  $$('#seg button').forEach(x => x.classList.toggle('on', x.dataset.f === 'all')); $('.seg-pill').style.transform = 'translateX(0)';
  renderList();
  buzz([12, 40, 12]); toast(`${nombres} registrado/a ✓`);
  setTimeout(() => { const r = document.querySelector(`[data-id="${m.id}"]`); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('pop'); } }, 250);
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
function xlsxBlob() {
  const { rows, fecha } = reportRows();
  const A = [['Fecha', 'Reunión', 'Nombres', 'Apellidos', 'Edad', 'Ministerio', 'Celular', 'Asistió', 'Nuevo']];
  rows.forEach(r => A.push([fecha, S.meeting, r.p.nombres, r.p.apellidos, r.p.edad ?? '', r.p.ministerio || '', r.p.celular || '', r.in ? 'Sí' : 'No', r.nuevo ? 'Sí' : 'No']));
  const ws = XLSX.utils.aoa_to_sheet(A);
  ws['!cols'] = [{ wch: 11 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 6 }, { wch: 15 }, { wch: 14 }, { wch: 8 }, { wch: 7 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
  const N = [['Nombres', 'Apellidos', 'Edad', 'Ministerio', 'Celular']];
  rows.filter(r => r.in && r.nuevo).forEach(r => N.push([r.p.nombres, r.p.apellidos, r.p.edad ?? '', r.p.ministerio || '', r.p.celular || '']));
  const wn = XLSX.utils.aoa_to_sheet(N); wn['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 6 }, { wch: 15 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wn, 'Nuevos');
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const fileName = () => `asistencia-${norm(S.meeting).replace(/\W+/g, '-')}-${date}.xlsx`;
function summaryText() {
  const { rows, fecha } = reportRows();
  const ins = rows.filter(r => r.in), news = ins.filter(r => r.nuevo);
  let t = `*${S.meeting}* · ${fecha}\n✅ ${ins.length} asistentes de ${rows.length}\n`;
  const by = MINS.map(k => [k, ins.filter(r => r.p.ministerio === k).length]).filter(x => x[1]);
  if (by.length) t += by.map(x => `${x[0]} ${x[1]}`).join(' · ') + '\n';
  if (news.length) t += `\n🆕 *Nuevos (${news.length})*\n` + news.map(r => `• ${full(r.p)}${r.p.edad !== '' && r.p.edad != null ? ` (${r.p.edad})` : ''} — ${r.p.celular}`).join('\n') + '\n';
  t += `\n*Asistentes*\n` + ins.map((r, i) => `${i + 1}. ${full(r.p)}`).join('\n');
  return t;
}
function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function openFinish() {
  const { rows, fecha } = reportRows();
  const ins = rows.filter(r => r.in).length;
  $('#stIn').textContent = ins; $('#stNew').textContent = rows.filter(r => r.in && r.nuevo).length; $('#stOut').textContent = rows.length - ins;
  $('#finSub').textContent = `${S.meeting} · ${fecha}`;
  openSheet('#sheetFinish');
  if (ins && window.confetti) setTimeout(() => confetti({ particleCount: 70, spread: 75, origin: { y: .75 }, colors: ['#2f6bff', '#0a1f44', '#5b9bff', '#ffffff'], disableForReducedMotion: true, zIndex: 40 }), 250);
}
$('#btnXLS').onclick = () => { download(fileName(), xlsxBlob()); toast('Excel descargado'); };
$('#btnCopy').onclick = async () => { try { await navigator.clipboard.writeText(summaryText()); toast('Resumen copiado'); } catch (e) { toast('No se pudo copiar'); } };
$('#btnWA').onclick = async () => {
  const text = summaryText(), blob = xlsxBlob();
  const file = new File([blob], fileName(), { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  download(fileName(), blob);
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  toast('Excel descargado · adjúntalo en WhatsApp');
};

/* ---------- Ajustes / importar ---------- */
$('#btnMenu').onclick = () => { $('#setName').value = S.meeting; openSheet('#sheetMenu'); };
$('#setName').addEventListener('input', e => { S.meeting = e.target.value.trim() || 'RAYCES'; save(); renderHead(); });
$('#btnImport').onclick = () => openSheet('#sheetImport');

function upsert(p) {
  if (!p.nombres) return 0;
  const key = norm(`${p.nombres} ${p.apellidos}`);
  const ex = S.members.find(m => norm(full(m)) === key || (p.celular && m.celular === p.celular));
  if (ex) {
    let ch = false;
    for (const k of ['edad', 'sexo', 'ministerio', 'celular']) if ((ex[k] === '' || ex[k] == null) && p[k] !== '' && p[k] != null) { ex[k] = p[k]; ch = true; }
    return 0;
  }
  S.members.push({ id: uid(), nombres: p.nombres, apellidos: p.apellidos, celular: p.celular || '', edad: p.edad ?? '', sexo: p.sexo || '', ministerio: p.ministerio || '' });
  return 1;
}
function splitName(parts) {
  if (parts.length === 1) return [parts[0], ''];
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts.slice(1).join(' ')];
  return [parts.slice(0, 2).join(' '), parts.slice(2).join(' ')];
}
function finishImport(n, label) { save(); renderList(); closeSheets(); toast(n ? `${n} ${label} agregadas` : 'No había nadie nuevo'); }

// Texto pegado: "Nombres Apellidos, edad, ministerio"
function importText(text) {
  let n = 0;
  text.split(/\r?\n/).forEach(line => {
    line = line.trim(); if (!line) return;
    const f = line.split(/[,;\t]/).map(s => s.trim()).filter(Boolean);
    let edad = '', ministerio = '', celular = '';
    const name = [];
    f.forEach((x, i) => {
      if (i === 0) return name.push(x);
      if (matchMin(x)) ministerio = matchMin(x);
      else if (/^\d{1,3}$/.test(x)) edad = +x;
      else if (/^[\d\s+()-]{7,}$/.test(x)) celular = cleanPhone(x);
      else name.push(x);
    });
    let nombres, apellidos;
    if (name.length >= 2) { nombres = name[0]; apellidos = name.slice(1).join(' '); }
    else [nombres, apellidos] = splitName(name[0].split(/\s+/));
    n += upsert({ nombres: titleCase(nombres), apellidos: titleCase(apellidos || ''), edad, ministerio, celular });
  });
  return n;
}
// Excel / CSV con encabezados (Nombre, Apellido, Edad, Ministerio, Sexo, Celular)
function importSheet(rows) {
  const pick = (r, ...names) => { for (const k of Object.keys(r)) if (names.includes(norm(k))) return r[k]; return ''; };
  let n = 0, seen = 0;
  rows.forEach(r => {
    const nombres = titleCase(String(pick(r, 'nombre', 'nombres', 'name')));
    const apellidos = titleCase(String(pick(r, 'apellido', 'apellidos', 'last name')));
    if (!nombres) return;
    seen++;
    const e = pick(r, 'edad', 'age');
    n += upsert({
      nombres, apellidos,
      edad: e === '' || isNaN(+e) ? '' : Math.round(+e),
      ministerio: matchMin(pick(r, 'ministerio', 'ministry')),
      sexo: matchSex(pick(r, 'sexo', 'genero', 'gender')),
      celular: cleanPhone(String(pick(r, 'celular', 'telefono', 'cel', 'whatsapp', 'movil')))
    });
  });
  return [n, seen];
}
$('#btnImportGo').onclick = () => { const n = importText($('#importText').value); $('#importText').value = ''; finishImport(n, 'personas'); };
$('#btnFile').onclick = () => $('#fileCSV').click();
$('#fileCSV').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const [n, seen] = importSheet(rows);
    if (!seen) toast('No encontré la columna “Nombre”. Revisa los encabezados.');
    else { finishImport(n, 'personas'); if (!n) toast('Esas personas ya estaban en la lista'); }
  } catch (err) { toast('No pude leer el archivo'); }
  e.target.value = '';
};
$('#btnBackup').onclick = () => { download(`onefamily-copia-${todayStr()}.json`, new Blob([JSON.stringify(S)], { type: 'application/json' })); toast('Copia guardada'); };
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
