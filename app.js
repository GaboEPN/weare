(() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = 'weare.v1';
const C = 263.9;

// Ministerios y su color (matiz HSL)
const MINS = ['RAYCES', 'PAREJAS', 'MIC INFANTIL', 'MIC JUNIOR', 'JOVENES MJC', 'UNIVERSITARIOS MAYO', 'PROFESIONALES PEC', 'DAMAS TARDE', 'DAMAS AÑOS DORADOS'];
const MHUE = { RAYCES: 200, PAREJAS: 340, 'MIC INFANTIL': 28, 'MIC JUNIOR': 12, 'JOVENES MJC': 165, 'UNIVERSITARIOS MAYO': 212, 'PROFESIONALES PEC': 250, 'DAMAS TARDE': 290, 'DAMAS AÑOS DORADOS': 44 };

// Lista base (Excel «Recurso Humano Chillogallo 2026»): siempre visible en todas las reuniones.
// Las personas nuevas que se agregan desde la app llevan un id que empieza con «n-».
const BASE = (window.BASE_MEMBERS || []).map(m => ({ id: m.id, nombres: m.nombres, apellidos: '', ministerio: m.ministerio, edad: '', sexo: '', celular: '', nuevo: '' }));
const isExtra = m => String(m.id).startsWith('n-');
const withBase = list => { const seen = new Set(BASE.map(m => m.id)); return [...BASE, ...(list || []).filter(m => isExtra(m) && !seen.has(m.id) && seen.add(m.id))]; };
const pruneAtt = (a, members) => { const ok = new Set(members.map(m => m.id)), o = {}; Object.keys(a || {}).forEach(d => { const ids = Object.keys(a[d]).filter(i => ok.has(i)); if (ids.length) { o[d] = {}; ids.forEach(i => o[d][i] = a[d][i]); } }); return o; };

let S = { meeting: 'RAYCES', members: [], att: {} };
try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.members) S = r; } catch (e) {}
S.members = withBase(S.members); S.att = pruneAtt(S.att, S.members);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- Sincronización con el servidor compartido (Google Sheets) ---------- */
const API = 'https://script.google.com/macros/s/AKfycbzF3YgzmxetfjLnbbHV987vhc4yRdNTVfTVTcvaOxcMRfP6gigyQ3_wa1hzbSz_aFTv/exec'; // URL del servidor (Google Apps Script). Vacío = datos solo en este dispositivo.
const QKEY = 'weare.q';
let queue = []; try { queue = JSON.parse(localStorage.getItem(QKEY)) || []; } catch (e) {}
const saveQ = () => { try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch (e) {} };
let flushing = false;
const normAtt = a => { const o = {}; Object.keys(a || {}).forEach(d => { const ids = Object.keys(a[d]); if (ids.length) { o[d] = {}; ids.forEach(i => o[d][i] = 1); } }); return o; };
function setSync(s) {
  const el = document.getElementById('syncMsg'); if (!el) return;
  el.dataset.s = s;
  el.textContent = !API ? 'Los datos se guardan solo en este dispositivo.' : s === 'err' ? 'Sin conexión · los cambios se enviarán cuando vuelva.' : s === 'busy' ? 'Sincronizando…' : 'Sincronizado · todos los dispositivos ven la misma lista.';
}
function op(o) { if (!API) return; queue.push(o); saveQ(); flush(); }
async function flush() {
  if (!API || flushing || !queue.length) return;
  flushing = true; const n = queue.length; let ok = true;
  try {
    const res = await fetch(API, { method: 'POST', body: JSON.stringify({ ops: queue.slice(0, n) }) });
    const r = await res.json();
    queue = queue.slice(n); saveQ(); setSync('ok');
    if (!queue.length && r.state) applyRemote(r.state);
  } catch (e) { ok = false; setSync('err'); setTimeout(flush, 7000); }
  flushing = false;
  if (ok && queue.length) flush();
}
function applyRemote(st) {
  if (!st || !st.members) return;
  // La lista base viene del repo; del servidor solo se toman las personas nuevas agregadas desde la app
  const members = withBase([...st.members, ...S.members.filter(m => isExtra(m) && !st.members.some(x => x.id === m.id))]);
  const next = { meeting: st.meeting || S.meeting, members, att: pruneAtt(normAtt(st.att), members) };
  const cur = JSON.stringify({ meeting: S.meeting, members: S.members, att: normAtt(S.att) });
  if (JSON.stringify(next) === cur) return;
  S = next; save(); renderHead(); renderList();
}
async function pull() {
  if (!API) return;
  await flush(); if (queue.length) return;
  try { setSync('busy'); const r = await fetch(API + '?t=' + Date.now()); applyRemote(await r.json()); setSync('ok'); }
  catch (e) { setSync('err'); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
setInterval(() => { if (!document.hidden) pull(); }, 20000);

const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
let date = todayStr(), filter = 'all', minFilter = 'all', query = '';
let editingId = null, lastCount = 0;
let view = 'home';

const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const full = m => `${m.nombres} ${m.apellidos}`.trim();
const uid = () => 'n-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dayAtt = () => (S.att[date] ||= {});
const isIn = id => !!(S.att[date] && S.att[date][id]);
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const icons = () => window.lucide && lucide.createIcons();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const titleCase = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const cleanPhone = s => (s || '').toString().replace(/[^\d+]/g, '');

// Ministerio sugerido por edad y sexo (Parejas se elige a mano)
function suggest() { return ''; }
function matchMin(v) {
  const n = norm(v).replace(/\s+/g, ' ');
  if (!n) return '';
  if (n === 'anos dorados' || n === 'dorados') return 'DAMAS AÑOS DORADOS';
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
  $('#subtitle').textContent = `${dl.charAt(0).toUpperCase() + dl.slice(1)} · ${S.meeting || 'Reunión'}`;
}
function renderMins() {
  const cnt = k => {
    const arr = S.members.filter(m => k === 'all' ? true : k === '_none' ? !m.ministerio : m.ministerio === k);
    return [arr.filter(m => isIn(m.id)).length, arr.length];
  };
  const keys = ['all', ...MINS];
  if (S.members.some(m => !m.ministerio)) keys.push('_none');
  const html = keys.map(k => {
    const [p, t] = cnt(k);
    const label = k === 'all' ? 'Todos' : k === '_none' ? 'Sin ministerio' : k;
    const dot = k === 'all' || k === '_none' ? '<i class="dot" style="--mh:215"></i>' : `<i class="dot" style="--mh:${MHUE[k]}"></i>`;
    return `<button data-m="${k}" class="${minFilter === k ? 'on' : ''}">${dot}<span class="lb">${label}</span><em>${p}/${t}</em></button>`;
  }).join('');
  ['#mins', '#minsM'].forEach(sel => { const box = $(sel), sl = box.scrollLeft; box.innerHTML = html; box.scrollLeft = sl; });
}
function renderCount() {
  const total = S.members.length;
  const n = S.members.filter(m => isIn(m.id)).length;
  const frac = total ? n / total : 0;
  const nuevos = S.members.filter(m => m.nuevo === date && isIn(m.id)).length;
  $('#cntNum').textContent = n; $('#cntNum2').textContent = n;
  $('#cntTot').textContent = `de ${total}`; $('#cntTot2').textContent = `de ${total} personas`;
  $('#prog').style.strokeDashoffset = C * (1 - frac); $('#prog2').style.strokeDashoffset = C * (1 - frac);
  $('#stOut2').textContent = total - n; $('#stNew2').textContent = nuevos; $('#stPct2').textContent = Math.round(frac * 100) + '%';
  if (n !== lastCount) { ['#cntNum', '#cntNum2'].forEach(s => { const b = $(s); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }); lastCount = n; }
  renderMins();
}

/* ---------- Lista ---------- */
function hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return 190 + (h % 110); }
function initials(m) { const w = full(m).split(/\s+/).filter(Boolean), b = w.length >= 4 ? w[2] : w[1]; return ((w[0] || '').charAt(0) + (b || '').charAt(0)).toUpperCase(); }

function rowHTML(m, i) {
  const h = hue(full(m));
  const pill = m.ministerio ? `<i class="mp" style="--mh:${MHUE[m.ministerio]}">${esc(m.ministerio)}</i>` : '';
  const isNew = m.nuevo === date;
  return `<button class="person ${isIn(m.id) ? 'in' : ''}" data-id="${m.id}" style="animation-delay:${Math.min(i, 14) * 28}ms">
    <span class="av" style="--h:${h}">${esc(initials(m))}</span>
    <span class="who"><b>${esc(m.nombres)}</b>
      <span class="sub2"><span>${esc(m.apellidos)}</span>${pill}</span></span>
    <span class="c-min">${pill || '<span style="color:#b3bdd2">—</span>'}</span>
    <span class="c-age">${m.edad !== '' && m.edad != null ? esc(m.edad) : '—'}</span>
    <span class="c-tel">${m.celular ? esc(m.celular) : '—'}</span>
    <span class="c-st"><i class="st"></i>${isNew ? '<i class="nw">Nuevo</i>' : ''}</span>
    ${isNew ? '<span class="badge">Nuevo</span>' : ''}
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
    let html = `<div class="tbl"><div class="tbl-head"><span></span><span>Nombre</span><span>Ministerio</span><span>Edad</span><span>Celular</span><span>Estado</span><span></span></div>${add}`, cur = '', open = false, i = 0;
    for (const m of items) {
      const L = (norm(m.nombres)[0] || '#').toUpperCase();
      if (L !== cur) { if (open) html += '</div>'; html += `<div class="letter">${L}</div><div class="group">`; cur = L; open = true; }
      html += rowHTML(m, i++);
    }
    el.innerHTML = html + '</div></div>';
  }
  icons(); renderCount();
  if (view !== 'meeting') renderPages();
}

function toggle(id, row) {
  const d = dayAtt();
  if (d[id]) delete d[id]; else d[id] = Date.now();
  save();
  const on = !!d[id];
  op({ t: 'att', date, id, on });
  buzz(on ? 14 : 6);
  row.classList.toggle('in', on);
  if (on) { row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop'); }
  renderCount();
  if (filter !== 'all') setTimeout(renderList, 380);
}

$('#list').addEventListener('click', e => {
  const r = e.target.closest('.person'); if (!r) return;
  toggle(r.dataset.id, r);
});

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
['#mins', '#minsM'].forEach(sel => $(sel).addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  minFilter = b.dataset.m; renderList();
  const on = $('#minsM .on'); if (on && innerWidth < 1024 && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}));
// atajo: "/" enfoca la búsqueda
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
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
  $('#minHint').textContent = pickMin ? '' : 'Elige el ministerio de la persona.';
}
buildMinPick();
$('#minPick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pickMin = b.dataset.v; minTouched = true; buzz(6); syncPick(); });

function openPerson() {
  const f = $('#personForm'); f.reset();
  $('#personTitle').textContent = 'Persona nueva';
  $('#personBtn').textContent = 'Registrar y marcar presente';
  pickMin = ''; pickSex = ''; minTouched = false;
  if (query) {
    const p = query.trim().split(/\s+/); f.nombres.value = titleCase(p[0] || ''); f.apellidos.value = titleCase(p.slice(1).join(' '));
  }
  syncPick();
  openSheet('#sheetPerson');
}
$('#personForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const nombres = titleCase(f.nombres.value), apellidos = titleCase(f.apellidos.value);
  const edad = f.edad.value === '' ? '' : Math.round(+f.edad.value);
  if (!nombres) return toast('Escribe los nombres'), f.nombres.focus();
  if (!apellidos) return toast('Escribe los apellidos'), f.apellidos.focus();
  if (edad !== '' && (edad < 0 || edad > 110)) return toast('Revisa la edad'), f.edad.focus();
  if (!pickMin) return toast('Elige el ministerio');
  const data = { nombres, apellidos, celular: '', edad, sexo: '', ministerio: pickMin };
  const dup = S.members.find(m => norm(full(m)) === norm(`${nombres} ${apellidos}`));
  if (dup) {
    dayAtt()[dup.id] = Date.now(); op({ t: 'att', date, id: dup.id, on: true }); save(); closeSheets(); renderList();
    return toast(`${dup.nombres} ya existía · marcada ✓`);
  }
  const m = { id: uid(), ...data, nuevo: date };
  S.members.push(m); dayAtt()[m.id] = Date.now(); save();
  op({ t: 'upsert', m }); op({ t: 'att', date, id: m.id, on: true });
  closeSheets(); $('#q').value = ''; query = ''; $('#qClear').hidden = true; minFilter = 'all'; filter = 'all';
  $$('#seg button').forEach(x => x.classList.toggle('on', x.dataset.f === 'all')); $('.seg-pill').style.transform = 'translateX(0)';
  renderList();
  buzz([12, 40, 12]); toast(`${nombres} registrado/a ✓`);
  setTimeout(() => { const r = document.querySelector(`[data-id="${m.id}"]`); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('pop'); } }, 250);
});

/* ---------- Exportar ---------- */
function reportRows(dt = date) {
  const [y, m, d] = dt.split('-');
  const a = S.att[dt] || {};
  const rows = S.members.map(p => ({ p, in: !!a[p.id], nuevo: p.nuevo === dt }));
  rows.sort((a, b) => (b.in - a.in) || norm(full(a.p)).localeCompare(norm(full(b.p)), 'es'));
  return { rows, fecha: `${d}/${m}/${y}` };
}
function xlsxBlob(dt = date) {
  const { rows, fecha } = reportRows(dt);
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
const fileName = (dt = date) => `asistencia-${norm(S.meeting).replace(/\W+/g, '-')}-${dt}.xlsx`;
function summaryText(dt = date) {
  const { rows, fecha } = reportRows(dt);
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
async function shareWA(dt = date) {
  const text = summaryText(dt), blob = xlsxBlob(dt);
  const file = new File([blob], fileName(dt), { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  download(fileName(dt), blob);
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  toast('Excel descargado · adjúntalo en WhatsApp');
}
$('#btnWA').onclick = () => shareWA();

/* ---------- Ajustes / importar ---------- */
const openMenu = () => { $('#setName').value = S.meeting; openSheet('#sheetMenu'); };
$('#btnMenu').onclick = openMenu; $('#btnMenu2').onclick = openMenu;
let nameT;
$('#setName').addEventListener('input', e => {
  S.meeting = e.target.value.trim() || 'RAYCES'; save(); renderHead();
  clearTimeout(nameT); nameT = setTimeout(() => op({ t: 'meeting', name: S.meeting }), 700);
});
$('#btnImport').onclick = () => openSheet('#sheetImport');

function upsert(p) {
  if (!p.nombres) return 0;
  const key = norm(`${p.nombres} ${p.apellidos}`);
  const ex = S.members.find(m => norm(full(m)) === key || (p.celular && m.celular === p.celular));
  if (ex) return 0; // las personas que ya existen no se modifican
  S.members.push({ id: uid(), nombres: p.nombres, apellidos: p.apellidos, celular: p.celular || '', edad: p.edad ?? '', sexo: p.sexo || '', ministerio: p.ministerio || '', nuevo: todayStr() });
  return 1;
}
function splitName(parts) {
  if (parts.length === 1) return [parts[0], ''];
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts.slice(1).join(' ')];
  return [parts.slice(0, 2).join(' '), parts.slice(2).join(' ')];
}
function finishImport(n, label) { save(); op({ t: 'bulk', members: S.members.filter(isExtra) }); renderList(); closeSheets(); toast(n ? `${n} ${label} agregadas` : 'No había nadie nuevo'); }

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

/* ---------- Navegación: inicio · reuniones · asistentes ---------- */
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const fmtD = (d, o) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('es', o).replace(/\./g, ''); };
const byName = (a, b) => norm(full(a)).localeCompare(norm(full(b)), 'es');
const meetingDates = () => Object.keys(S.att).filter(d => Object.keys(S.att[d] || {}).length).sort().reverse();
function mstats(d) {
  const a = S.att[d] || {};
  return { n: S.members.filter(m => a[m.id]).length, nuevos: S.members.filter(m => m.nuevo === d && a[m.id]).length, total: S.members.length };
}
const longD = d => cap(fmtD(d, { weekday: 'long', day: 'numeric', month: 'long' }));

function setView(v, push = true) {
  view = v; document.body.dataset.view = v; closeSheets();
  if (push) history.pushState({ v }, '', '#' + v);
  if (v !== 'meeting') renderPages();
  window.scrollTo(0, 0);
  $$('.page').forEach(p => p.scrollTop = 0);
}
addEventListener('popstate', e => setView((e.state && e.state.v) || 'home', false));

function startMeeting(d) {
  date = d; filter = 'all'; minFilter = 'all'; query = '';
  $('#q').value = ''; $('#qClear').hidden = true;
  $$('#seg button').forEach(x => x.classList.toggle('on', x.dataset.f === 'all'));
  $('.seg-pill').style.transform = 'translateX(0)';
  renderHead(); setView('meeting'); renderList();
}

function meetRow(d, i = 0) {
  const s = mstats(d), pct = s.total ? Math.round(s.n / s.total * 100) : 0;
  return `<button class="mrow" data-meet="${d}" style="animation-delay:${Math.min(i, 10) * 30}ms">
    <span class="dt"><b>${+d.slice(8)}</b><small>${esc(fmtD(d, { month: 'short' }))}</small></span>
    <span class="mw"><b>${esc(longD(d))}</b><span>${s.n} asistentes${s.nuevos ? ` · ${s.nuevos} nuevos` : ''}</span></span>
    <span class="pc">${pct}%</span><i data-lucide="chevron-right" class="chev"></i></button>`;
}

function renderHome() {
  const t = todayStr(), md = meetingDates();
  $('#homeMeeting').textContent = S.meeting || 'Reunión';
  $('#homeSub').textContent = `${longD(t)} · ${S.members.length} personas · ${md.length} ${md.length === 1 ? 'reunión' : 'reuniones'}`;
  const ts = mstats(t);
  $('#newSub').textContent = ts.n ? `Continuar la de hoy · ${ts.n} presentes` : 'Registrar la asistencia de hoy';
  $('#meetSub').textContent = md.length ? `${md.length} registradas · la última, ${fmtD(md[0], { day: 'numeric', month: 'short' })}` : 'Aún no hay reuniones guardadas';
  $('#pplSub').textContent = S.members.length ? `${S.members.length} personas y su historial` : 'Importa tu lista para empezar';
  const rec = md.slice(0, 4);
  $('#recentT').hidden = !rec.length;
  $('#recent').innerHTML = rec.map(meetRow).join('');
}
function renderMeetings() {
  const q = norm($('#qMeet').value), md = meetingDates();
  const ds = md.filter(d => !q || norm(`${fmtD(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ${d} ${fmtD(d, { day: '2-digit', month: '2-digit', year: 'numeric' })}`).includes(q));
  $('#meetCount').textContent = md.length ? `${md.length} ${md.length === 1 ? 'reunión registrada' : 'reuniones registradas'}` : 'Todavía no hay reuniones registradas';
  let html = '', mon = '', i = 0;
  ds.forEach(d => {
    if (d.slice(0, 7) !== mon) { mon = d.slice(0, 7); html += `<div class="mon">${esc(fmtD(d, { month: 'long', year: 'numeric' }))}</div>`; }
    html += meetRow(d, i++);
  });
  $('#meetList').innerHTML = html || `<div class="empty"><div class="big"><i data-lucide="calendar-x"></i></div><h3>${md.length ? 'Sin resultados' : 'Aún no hay reuniones'}</h3><p>${md.length ? 'Prueba con otra fecha o mes.' : 'Cuando registres asistencia en una reunión, aparecerá aquí.'}</p></div>`;
}
function renderPeople() {
  const q = norm($('#qPeople').value), md = meetingDates();
  const items = S.members.filter(m => !q || norm(full(m)).includes(q) || norm(m.celular).includes(q) || norm(m.ministerio).includes(q)).sort(byName);
  $('#peopleCount').textContent = `${S.members.length} personas registradas`;
  $('#peopleList').innerHTML = items.map((m, i) => {
    const mine = md.filter(d => S.att[d][m.id]);
    const pill = m.ministerio ? `<i class="mp" style="--mh:${MHUE[m.ministerio]}">${esc(m.ministerio)}</i>` : '';
    return `<button class="mrow prow" data-person="${m.id}" style="animation-delay:${Math.min(i, 10) * 25}ms">
      <span class="av" style="--h:${hue(full(m))}">${esc(initials(m))}</span>
      <span class="mw"><b>${esc(full(m))}</b><span class="sub2">${pill}<span>${mine.length} de ${md.length} reuniones</span></span></span>
      <span class="pc">${mine.length ? esc(fmtD(mine[0], { day: 'numeric', month: 'short' })) : '—'}</span><i data-lucide="chevron-right" class="chev"></i></button>`;
  }).join('') || `<div class="empty"><div class="big"><i data-lucide="search-x"></i></div><h3>${S.members.length ? 'Sin resultados' : 'Aún no hay personas'}</h3><p>${S.members.length ? 'Prueba con otro nombre o número.' : 'Importa tu lista desde Ajustes o registra una nueva reunión.'}</p></div>`;
}
function renderPages() {
  if (view === 'home') renderHome();
  else if (view === 'meetings') renderMeetings();
  else if (view === 'people') renderPeople();
  icons();
}
$('#qMeet').addEventListener('input', () => { renderMeetings(); icons(); });
$('#qPeople').addEventListener('input', () => { renderPeople(); icons(); });

function showMeeting(d) {
  const s = mstats(d), a = S.att[d] || {};
  const ppl = S.members.filter(m => a[m.id]).sort(byName);
  const by = MINS.map(k => [k, ppl.filter(m => m.ministerio === k).length]).filter(x => x[1]);
  $('#meetBody').innerHTML = `
    <h3 class="mt-h">${esc(longD(d))}</h3>
    <p class="mt-sub">${esc(S.meeting)} · ${esc(fmtD(d, { year: 'numeric' }))}</p>
    <div class="stats"><div><b>${s.n}</b><span>Asistentes</span></div><div><b>${s.nuevos}</b><span>Nuevos</span></div><div><b>${s.total - s.n}</b><span>Faltaron</span></div></div>
    ${by.length ? `<div class="minline">${by.map(([k, c]) => `<i class="mp" style="--mh:${MHUE[k]}">${k} · ${c}</i>`).join('')}</div>` : ''}
    <p class="cap">Asistentes</p>
    <div class="inset alist">${ppl.map(m => `<div class="ar"><span class="av" style="--h:${hue(full(m))}">${esc(initials(m))}</span><b>${esc(full(m))}</b>${m.ministerio ? `<i class="mp" style="--mh:${MHUE[m.ministerio]}">${esc(m.ministerio)}</i>` : ''}</div>`).join('') || '<p class="muted p">Nadie quedó marcado en esta reunión.</p>'}</div>
    <div class="stack top">
      <button class="pill solid wide" data-open="${d}"><i data-lucide="pencil"></i><span>Abrir y editar</span></button>
      <button class="pill ghost wide" data-wa="${d}"><i data-lucide="send"></i><span>Enviar por WhatsApp</span></button>
      <button class="pill ghost wide" data-xls="${d}"><i data-lucide="file-spreadsheet"></i><span>Descargar Excel</span></button>
    </div>`;
  icons(); openSheet('#sheetMeet');
}
function showPerson(id) {
  const m = S.members.find(x => x.id === id); if (!m) return;
  const md = meetingDates(), mine = md.filter(d => S.att[d][id]);
  const pct = md.length ? Math.round(mine.length / md.length * 100) : 0;
  const row = (l, v) => `<div class="cell"><span>${l}</span><i class="val">${v}</i></div>`;
  $('#pinfoBody').innerHTML = `
    <div class="pi-top"><span class="av" style="--h:${hue(full(m))}">${esc(initials(m))}</span><h3>${esc(full(m))}</h3>${m.ministerio ? `<i class="mp" style="--mh:${MHUE[m.ministerio]}">${esc(m.ministerio)}</i>` : ''}</div>
    <div class="stats"><div><b>${mine.length}</b><span>Asistencias</span></div><div><b>${md.length}</b><span>Reuniones</span></div><div><b>${pct}%</b><span>Constancia</span></div></div>
    <div class="inset">${row('Edad', m.edad !== '' && m.edad != null ? esc(m.edad) + ' años' : '—')}${row('Celular', m.celular ? esc(m.celular) : '—')}${row('Registrada', m.nuevo ? esc(fmtD(m.nuevo, { day: 'numeric', month: 'short', year: 'numeric' })) : 'Lista inicial')}</div>
    <p class="cap">Historial</p>
    <div class="inset hlist">${md.map(d => `<div class="hrow"><span>${esc(longD(d))}</span><i class="hs ${S.att[d][id] ? 'ok' : ''}">${S.att[d][id] ? 'Asistió' : 'No asistió'}</i></div>`).join('') || '<p class="muted p">Aún no hay reuniones registradas.</p>'}</div>
    ${m.celular ? `<div class="stack top"><a class="pill solid wide" href="tel:${esc(m.celular)}"><i data-lucide="phone"></i><span>Llamar</span></a></div>` : ''}`;
  icons(); openSheet('#sheetPInfo');
}

document.addEventListener('click', e => {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-go]'))) {
    const g = el.dataset.go;
    if (g === 'meeting-new') startMeeting(todayStr());
    else if (g !== view) setView(g);
    else closeSheets();
    return;
  }
  if (t.closest('[data-menu]')) return openMenu();
  if ((el = t.closest('[data-meet]'))) return showMeeting(el.dataset.meet);
  if ((el = t.closest('[data-person]'))) return showPerson(el.dataset.person);
  if ((el = t.closest('[data-open]'))) return startMeeting(el.dataset.open);
  if ((el = t.closest('[data-wa]'))) return shareWA(el.dataset.wa);
  if ((el = t.closest('[data-xls]'))) { download(fileName(el.dataset.xls), xlsxBlob(el.dataset.xls)); return toast('Excel descargado'); }
});
$('#btnHomeFin').onclick = () => setView('home');

$('#q').placeholder = matchMedia('(min-width:1024px)').matches ? 'Buscar persona   ( / )' : 'Buscar persona';
history.replaceState({ v: 'home' }, '', '#home');
renderHead(); renderList(); renderPages(); icons();
setSync('ok'); pull();
})();
