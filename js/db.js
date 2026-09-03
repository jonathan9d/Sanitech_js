/* =====================================================================
   SANITECH — db.js
   Couche de persistance SQLite (sql.js / WebAssembly embarqué).
   La base est stockée localement (IndexedDB, repli localStorage) :
   aucune connexion réseau n'est nécessaire, tout fonctionne hors-ligne.
   - initDB()           : charge le moteur, ouvre ou crée la base
   - loadStateFromDB()  : reconstruit l'état applicatif depuis SQLite
   - dbSyncState()      : écrit l'état dans SQLite (appelé par save())
   - exportDBFile()     : octets de la base (sauvegarde .db)
   - importDBFile()     : remplace la base depuis un fichier .db
   ===================================================================== */

let DB = null;              // instance SQL.Database
let dbReady = false;        // vrai après ouverture de la base
let SQLMod = null;          // module sql.js (permet de recréer une base)
let dbPersistTimer = null;

const DB_STORE = 'sanitech_db';
const DB_KEY = 'main';
const DB_LS_KEY = 'sanitech_sqlite_v1';

const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, pass TEXT, email TEXT);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, uid TEXT, prenom TEXT, nom TEXT, email TEXT, tel TEXT, naissance TEXT, role TEXT, dept TEXT, statut TEXT, presence TEXT, adresse TEXT, archived INTEGER DEFAULT 0, photo TEXT, lastMove INTEGER, createdAt INTEGER);
CREATE TABLE IF NOT EXISTS logs(id TEXT PRIMARY KEY, userId TEXT, name TEXT, type TEXT, ts INTEGER, source TEXT, late INTEGER DEFAULT 0, photo TEXT);
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, userId TEXT, userName TEXT, type TEXT, fromDate TEXT, toDate TEXT, reason TEXT, status TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS notifs(id TEXT PRIMARY KEY, icon TEXT, title TEXT, msg TEXT, ts INTEGER, read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS trash(id TEXT PRIMARY KEY, userJson TEXT, logsJson TEXT, requestsJson TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
`;

/* ---------- IndexedDB : stockage principal des octets ---------- */
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_STORE, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch (e) { return null; }
}
async function idbSet(key, val) {
  try {
    const db = await idbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) { 
    // Silencieux : le repli localStorage reste disponible
  }
}

/* ---------- Conversion octets <-> base64 (repli localStorage) ---------- */
function bytesToB64(bytes) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
function b64ToBytes(b64) {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/* ---------- Ouverture de la base ---------- */
async function initDB() {
  const bin = Uint8Array.from(atob(SQL_WASM_B64), c => c.charCodeAt(0));
  SQLMod = await initSqlJs({ wasmBinary: bin });
  /* Réinitialisation demandée : on repart d'une base vierge */
  if (localStorage.getItem('sanitech_reset') === '1') {
    try { indexedDB.deleteDatabase(DB_STORE); } catch (e) { }
    try { localStorage.removeItem(DB_LS_KEY); } catch (e) { }
    try { localStorage.removeItem('sanitech_reset'); } catch (e) { }
  }
  let bytes = await idbGet(DB_KEY);
  if (!bytes) {
    try { const ls = localStorage.getItem(DB_LS_KEY); if (ls) bytes = b64ToBytes(ls); } catch (e) { }
  }
  if (bytes && bytes.byteLength) {
    DB = new SQLMod.Database(new Uint8Array(bytes));
  } else {
    DB = new SQLMod.Database();
  }
  DB.run(DB_SCHEMA);
  dbReady = true;
}

/* ---------- Requêtes utilitaires ---------- */
function dbSelectAll(sql, params) {
  const stmt = DB.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/* ---------- Reconstruction de l'état depuis SQLite ---------- */
function loadStateFromDB() {
  if (state) return; // déjà rempli (migration depuis l'ancienne version)
  state = defaults();
  if (!DB || !dbReady) { seed(); return; }
  try {
    const users = dbSelectAll('SELECT * FROM users');
    if (!users.length) {
      // Migration depuis l'ancienne version (stockée en localStorage)
      try {
        const legacy = localStorage.getItem(KEY);
        if (legacy) {
          const d = JSON.parse(legacy);
          if (d && d.users) { state = d; localStorage.removeItem(KEY); return; }
        }
      } catch (e) { }
      seed();
      return;
    }
    state.accounts = dbSelectAll('SELECT * FROM accounts').map(r => ({ username: r.username, pass: r.pass, email: r.email || '' }));
    state.users = users.map(r => ({
      id: r.id, uid: r.uid, prenom: r.prenom, nom: r.nom, email: r.email,
      tel: r.tel || '', naissance: r.naissance || '', role: r.role, dept: r.dept || '',
      statut: r.statut, presence: r.presence, adresse: r.adresse || '',
      archived: !!r.archived, photo: r.photo || null, lastMove: r.lastMove, createdAt: r.createdAt
    }));
    state.logs = dbSelectAll('SELECT * FROM logs ORDER BY ts').map(r => ({
      id: r.id, userId: r.userId, name: r.name, type: r.type, ts: r.ts,
      source: r.source || 'manual', late: !!r.late, photo: r.photo || null
    }));
    state.requests = dbSelectAll('SELECT * FROM requests').map(r => ({
      id: r.id, userId: r.userId, userName: r.userName, type: r.type,
      from: r.fromDate, to: r.toDate, reason: r.reason || '', status: r.status, ts: r.ts
    }));
    state.notifs = dbSelectAll('SELECT * FROM notifs').map(r => ({
      id: r.id, icon: r.icon, title: r.title, msg: r.msg, ts: r.ts, read: !!r.read
    }));
    state.trash = dbSelectAll('SELECT * FROM trash').map(r => {
      try {
        return { id: r.id, u: JSON.parse(r.userJson), logs: JSON.parse(r.logsJson || '[]'), requests: JSON.parse(r.requestsJson || '[]'), at: r.at };
      } catch (e) { return null; }
    }).filter(Boolean);
    const kv = {};
    dbSelectAll('SELECT * FROM settings').forEach(r => { kv[r.k] = r.v; });
    if (kv.settings) { try { state.settings = Object.assign({}, defaults().settings, JSON.parse(kv.settings)); } catch (e) { } }
    if (kv.session) { try { state.session = kv.session ? JSON.parse(kv.session) : null; } catch (e) { } }
    if (kv.extra) {
      try {
        const x = JSON.parse(kv.extra);
        state.seq = x.seq || state.seq;
        state.pin = Object.assign({ enabled: false, code: null, timeout: 3 }, x.pin || {});
        state.sessionStart = x.sessionStart || null;
        state.autoOutLast = x.autoOutLast || null;
        state.summaryLast = x.summaryLast || null;
      } catch (e) { }
    }
    purgeTrash();
  } catch (e) {
    seed();
  }
}

/* ---------- Écriture de l'état dans SQLite (appelée par save()) ---------- */
function dbSyncState() {
  if (!DB || !dbReady || !state) return;
  try {
    DB.run('BEGIN');
    ['accounts', 'users', 'logs', 'requests', 'notifs', 'trash', 'settings'].forEach(t => DB.run('DELETE FROM ' + t));
    const acc = DB.prepare('INSERT INTO accounts(username,pass,email) VALUES(?,?,?)');
    for (const a of state.accounts) acc.run([a.username, a.pass, a.email || '']);
    acc.free();
    const usr = DB.prepare('INSERT INTO users(id,uid,prenom,nom,email,tel,naissance,role,dept,statut,presence,adresse,archived,photo,lastMove,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const u of state.users) usr.run([u.id, u.uid, u.prenom, u.nom, u.email, u.tel || '', u.naissance || '', u.role, u.dept || '', u.statut, u.presence, u.adresse || '', u.archived ? 1 : 0, u.photo || null, u.lastMove, u.createdAt]);
    usr.free();
    const lg = DB.prepare('INSERT INTO logs(id,userId,name,type,ts,source,late,photo) VALUES(?,?,?,?,?,?,?,?)');
    for (const l of state.logs) lg.run([l.id, l.userId, l.name, l.type, l.ts, l.source || 'manual', l.late ? 1 : 0, l.photo || null]);
    lg.free();
    const rq = DB.prepare('INSERT INTO requests(id,userId,userName,type,fromDate,toDate,reason,status,ts) VALUES(?,?,?,?,?,?,?,?,?)');
    for (const r of state.requests) rq.run([r.id, r.userId, r.userName, r.type, r.from, r.to, r.reason || '', r.status, r.ts]);
    rq.free();
    const nf = DB.prepare('INSERT INTO notifs(id,icon,title,msg,ts,read) VALUES(?,?,?,?,?,?)');
    for (const n of state.notifs) nf.run([n.id, n.icon, n.title, n.msg, n.ts, n.read ? 1 : 0]);
    nf.free();
    const tr = DB.prepare('INSERT INTO trash(id,userJson,logsJson,requestsJson,at) VALUES(?,?,?,?,?)');
    for (const t of state.trash) tr.run([t.id || uid(), JSON.stringify(t.u), JSON.stringify(t.logs || []), JSON.stringify(t.requests || []), t.at]);
    tr.free();
    const st = DB.prepare('INSERT INTO settings(k,v) VALUES(?,?)');
    st.run(['settings', JSON.stringify(state.settings)]);
    st.run(['session', state.session ? JSON.stringify(state.session) : '']);
    st.run(['extra', JSON.stringify({ seq: state.seq, pin: state.pin, sessionStart: state.sessionStart, autoOutLast: state.autoOutLast, summaryLast: state.summaryLast })]);
    st.free();
    DB.run('COMMIT');
  } catch (e) {
    try { DB.run('ROLLBACK'); } catch (_) { }
  }
  schedulePersist();
}

/* ---------- Persistance des octets (débounce + sortie de page) ---------- */
function schedulePersist() {
  clearTimeout(dbPersistTimer);
  dbPersistTimer = setTimeout(persistNow, 400);
}
function persistNow() {
  if (!DB || !dbReady) return;
  try {
    const bytes = DB.export();
    idbSet(DB_KEY, bytes);
    try { localStorage.setItem(DB_LS_KEY, bytesToB64(bytes)); } catch (e) { /* quota dépassé : IndexedDB suffit */ }
  } catch (e) { }
}
window.addEventListener('beforeunload', () => { clearTimeout(dbPersistTimer); persistNow(); });
window.addEventListener('pagehide', () => { clearTimeout(dbPersistTimer); persistNow(); });

/* ---------- Sauvegarde / restauration d'un fichier .db ---------- */
function exportDBFile() {
  if (!DB || !dbReady) return null;
  return DB.export();
}
function importDBFile(bytes) {
  if (!SQLMod || !bytes) return false;
  DB = new SQLMod.Database(new Uint8Array(bytes));
  DB.run(DB_SCHEMA);
  dbReady = true;
  state = null;            // force le rechargement depuis la base importée
  loadStateFromDB();
  ensureState();
  save();
  return true;
}
function dbStats() {
  if (!DB || !dbReady) return null;
  try {
    const size = DB.export().length;
    const c = k => { const r = dbSelectAll('SELECT COUNT(*) AS n FROM ' + k); return r.length ? r[0].n : 0; };
    return { size, users: c('users'), logs: c('logs'), trash: c('trash'), requests: c('requests') };
  } catch (e) { return null; }
}
