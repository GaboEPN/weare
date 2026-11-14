/**
 * OneFamily ICT · servidor gratis en Google Apps Script
 * Guarda personas y asistencias en esta misma hoja de cálculo.
 * Hojas: Personas · Asistencia · Config
 */
const PCOLS = ['id', 'nombres', 'apellidos', 'edad', 'sexo', 'ministerio', 'celular', 'nuevo'];

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(headers);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eaf1ff');
    s.getRange(1, 1, s.getMaxRows(), headers.length).setNumberFormat('@'); // todo como texto (celulares con 0, fechas)
  }
  return s;
}
const P_ = () => sheet_('Personas', PCOLS);
const A_ = () => sheet_('Asistencia', ['fecha', 'id']);
const C_ = () => sheet_('Config', ['clave', 'valor']);

function rows_(s, n) {
  const last = s.getLastRow();
  return last < 2 ? [] : s.getRange(2, 1, last - 1, n).getValues();
}

function state_() {
  const members = rows_(P_(), PCOLS.length).filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), nombres: String(r[1]), apellidos: String(r[2]),
    edad: r[3] === '' ? '' : Number(r[3]), sexo: String(r[4]), ministerio: String(r[5]),
    celular: String(r[6]), nuevo: String(r[7])
  }));
  const att = {};
  rows_(A_(), 2).forEach(r => { if (r[0] !== '') (att[String(r[0])] ||= {})[String(r[1])] = 1; });
  let meeting = 'RAYCES';
  rows_(C_(), 2).forEach(r => { if (r[0] === 'meeting' && r[1]) meeting = String(r[1]); });
  return { members, att, meeting };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return json_(state_()); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ops = (JSON.parse(e.postData.contents).ops) || [];
    ops.forEach(apply_);
    SpreadsheetApp.flush();
    return json_({ ok: true, state: state_() });
  } finally { lock.releaseLock(); }
}

function memberRow_(m) { return PCOLS.map(k => (m[k] === undefined || m[k] === null) ? '' : m[k]); }

function upsert_(list) {
  const s = P_();
  const ids = {};
  rows_(s, 1).forEach((r, i) => ids[String(r[0])] = i + 2);
  const add = [];
  list.forEach(m => {
    if (ids[m.id]) s.getRange(ids[m.id], 1, 1, PCOLS.length).setValues([memberRow_(m)]);
    else add.push(memberRow_(m));
  });
  if (add.length) {
    const start = s.getLastRow() + 1;
    s.getRange(start, 1, add.length, PCOLS.length).setNumberFormat('@').setValues(add);
  }
}

function deleteWhere_(s, col, value) {
  const vals = rows_(s, 2);
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][col]) === String(value)) s.deleteRow(i + 2);
}

function apply_(o) {
  if (o.t === 'upsert') upsert_([o.m]);
  else if (o.t === 'bulk') upsert_(o.members);
  else if (o.t === 'del') { deleteWhere_(P_(), 0, o.id); deleteWhere_(A_(), 1, o.id); }
  else if (o.t === 'att') {
    const s = A_(), vals = rows_(s, 2);
    const at = vals.findIndex(r => String(r[0]) === o.date && String(r[1]) === o.id);
    if (o.on && at < 0) { const n = s.getLastRow() + 1; s.getRange(n, 1, 1, 2).setNumberFormat('@').setValues([[o.date, o.id]]); }
    if (!o.on && at >= 0) s.deleteRow(at + 2);
  }
  else if (o.t === 'clearDay') deleteWhere_(A_(), 0, o.date);
  else if (o.t === 'meeting') {
    const s = C_(), vals = rows_(s, 2), at = vals.findIndex(r => r[0] === 'meeting');
    if (at >= 0) s.getRange(at + 2, 2).setValue(o.name); else s.appendRow(['meeting', o.name]);
  }
  else if (o.t === 'replaceAll') {
    const p = P_(), a = A_();
    if (p.getLastRow() > 1) p.deleteRows(2, p.getLastRow() - 1);
    if (a.getLastRow() > 1) a.deleteRows(2, a.getLastRow() - 1);
    upsert_(o.members);
    const A = []; Object.keys(o.att || {}).forEach(d => Object.keys(o.att[d]).forEach(id => A.push([d, id])));
    if (A.length) a.getRange(2, 1, A.length, 2).setNumberFormat('@').setValues(A);
    apply_({ t: 'meeting', name: o.meeting || 'RAYCES' });
  }
}
