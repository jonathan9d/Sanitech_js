/* =====================================================================
   SANITECH — backend (server.js)
   Serveur local Node.js (aucune dépendance native) :
   - sert l'application (PWA installable sur http://localhost)
   - expose une API REST (statistiques, sauvegarde/restauration JSON)
   - base SQLite côté serveur (sql.js) pour les sauvegardes
   Démarrage :  npm start   →   http://localhost:8080
   ===================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(ROOT, 'server-data');
const DB_FILE = path.join(DATA_DIR, 'sanitech.db');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.db': 'application/octet-stream'
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, pass TEXT, email TEXT);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, uid TEXT, prenom TEXT, nom TEXT, email TEXT, tel TEXT, naissance TEXT, role TEXT, dept TEXT, statut TEXT, presence TEXT, adresse TEXT, archived INTEGER DEFAULT 0, photo TEXT, lastMove INTEGER, createdAt INTEGER);
CREATE TABLE IF NOT EXISTS logs(id TEXT PRIMARY KEY, userId TEXT, name TEXT, type TEXT, ts INTEGER, source TEXT, late INTEGER DEFAULT 0, photo TEXT);
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, userId TEXT, userName TEXT, type TEXT, fromDate TEXT, toDate TEXT, reason TEXT, status TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS notifs(id TEXT PRIMARY KEY, icon TEXT, title TEXT, msg TEXT, ts INTEGER, read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS trash(id TEXT PRIMARY KEY, userJson TEXT, logsJson TEXT, requestsJson TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
`;

let DB = null;
let SQL = null;

/* ---------- Base SQLite côté serveur ---------- */
async function openDB() {
  SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    DB = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    DB = new SQL.Database();
  }
  DB.run(SCHEMA);
}
function saveDB() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, Buffer.from(DB.export()));
  } catch (e) { console.error('saveDB:', e); }
}
function dbRows(sql, params) {
  const stmt = DB.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function importState(d) {
  if (!d || !Array.isArray(d.users) || !Array.isArray(d.accounts)) return false;
  DB.run('BEGIN');
  try {
    ['accounts', 'users', 'logs', 'requests', 'notifs', 'trash', 'settings'].forEach(t => DB.run('DELETE FROM ' + t));
    const acc = DB.prepare('INSERT INTO accounts(username,pass,email) VALUES(?,?,?)');
    for (const a of d.accounts) acc.run([a.username, a.pass, a.email || '']);
    acc.free();
    const usr = DB.prepare('INSERT INTO users(id,uid,prenom,nom,email,tel,naissance,role,dept,statut,presence,adresse,archived,photo,lastMove,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const u of d.users) usr.run([u.id, u.uid, u.prenom, u.nom, u.email, u.tel || '', u.naissance || '', u.role, u.dept || '', u.statut, u.presence, u.adresse || '', u.archived ? 1 : 0, u.photo || null, u.lastMove, u.createdAt]);
    usr.free();
    const lg = DB.prepare('INSERT INTO logs(id,userId,name,type,ts,source,late,photo) VALUES(?,?,?,?,?,?,?,?)');
    for (const l of d.logs || []) lg.run([l.id, l.userId, l.name, l.type, l.ts, l.source || 'manual', l.late ? 1 : 0, l.photo || null]);
    lg.free();
    const rq = DB.prepare('INSERT INTO requests(id,userId,userName,type,fromDate,toDate,reason,status,ts) VALUES(?,?,?,?,?,?,?,?,?)');
    for (const r of d.requests || []) rq.run([r.id, r.userId, r.userName, r.type, r.from, r.to, r.reason || '', r.status, r.ts]);
    rq.free();
    const nf = DB.prepare('INSERT INTO notifs(id,icon,title,msg,ts,read) VALUES(?,?,?,?,?,?)');
    for (const n of d.notifs || []) nf.run([n.id, n.icon, n.title, n.msg, n.ts, n.read ? 1 : 0]);
    nf.free();
    const tr = DB.prepare('INSERT INTO trash(id,userJson,logsJson,requestsJson,at) VALUES(?,?,?,?,?)');
    for (const t of d.trash || []) tr.run([t.id, JSON.stringify(t.u), JSON.stringify(t.logs || []), JSON.stringify(t.requests || []), t.at]);
    tr.free();
    const st = DB.prepare('INSERT INTO settings(k,v) VALUES(?,?)');
    st.run(['settings', JSON.stringify(d.settings || {})]);
    st.run(['session', d.session ? JSON.stringify(d.session) : '']);
    st.run(['extra', JSON.stringify({ seq: d.seq, pin: d.pin, sessionStart: d.sessionStart, autoOutLast: d.autoOutLast, summaryLast: d.summaryLast })]);
    st.free();
    DB.run('COMMIT');
  } catch (e) {
    try { DB.run('ROLLBACK'); } catch (_) { }
    console.error('[import] erreur SQL:', e && e.message);
    return false;
  }
  saveDB();
  return true;
}
function exportState() {
  const q = t => dbRows('SELECT * FROM ' + t);
  const kv = {};
  dbRows('SELECT * FROM settings').forEach(r => { kv[r.k] = r.v; });
  let settings = {}, session = null, extra = {};
  try { if (kv.settings) settings = JSON.parse(kv.settings); } catch (e) { }
  try { if (kv.session) session = JSON.parse(kv.session); } catch (e) { }
  try { if (kv.extra) extra = JSON.parse(kv.extra); } catch (e) { }
  return {
    accounts: q('accounts'),
    users: q('users').map(r => ({ ...r, archived: !!r.archived })),
    logs: q('logs').map(r => ({ ...r, late: !!r.late })),
    requests: q('requests').map(r => ({ ...r, from: r.fromDate, to: r.toDate })),
    notifs: q('notifs').map(r => ({ ...r, read: !!r.read })),
    trash: q('trash').map(r => { try { return { id: r.id, u: JSON.parse(r.userJson), logs: JSON.parse(r.logsJson || '[]'), requests: JSON.parse(r.requestsJson || '[]'), at: r.at }; } catch (e) { return null; } }).filter(Boolean),
    settings, session, ...extra
  };
}

/* ---------- Réponses HTTP ---------- */
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 25e6) { reject(new Error('trop volumineux')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/* ---------- Serveur ---------- */
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Introuvable'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const cache = (ext === '.woff2' || ext === '.png') ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/api/health') {
      return sendJSON(res, 200, { ok: true, name: 'Sanitech backend', version: '3.2.0', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
    }
    if (url === '/api/stats') {
      const c = t => { const r = dbRows('SELECT COUNT(*) AS n FROM ' + t); return r.length ? r[0].n : 0; };
      return sendJSON(res, 200, { users: c('users'), logs: c('logs'), requests: c('requests'), trash: c('trash'), dbSize: DB ? DB.export().length : 0 });
    }
    if (url === '/api/export-json') {
      return sendJSON(res, 200, exportState());
    }
    if (url === '/api/import-json' && req.method === 'POST') {
      const body = await readBody(req);
      let d = null;
      try { d = JSON.parse(body); } catch (e) { console.error('[import] JSON invalide:', e.message, '| body:', body.slice(0, 120)); return sendJSON(res, 400, { error: 'JSON invalide' }); }
      console.error('[import] body len=', body.length, 'users array=', Array.isArray(d && d.users), 'accounts array=', Array.isArray(d && d.accounts));
      if (!importState(d)) return sendJSON(res, 400, { error: 'Structure invalide (users/accounts requis)' });
      return sendJSON(res, 200, { ok: true, message: 'Sauvegarde importée côté serveur' });
    }
    if (url === '/api/backup') {
      const bytes = DB ? Buffer.from(DB.export()) : Buffer.alloc(0);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="sanitech-server.db"' });
      return res.end(bytes);
    }
    serveStatic(req, res);
  } catch (e) {
    console.error('Erreur serveur:', e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Erreur interne' });
    else res.end();
  }
});

openDB().then(() => {
  server.listen(PORT, () => {
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│  SANITECH — backend prêt                     │');
    console.log('│  Application : http://localhost:' + PORT + '        │');
    console.log('│  API REST    : http://localhost:' + PORT + '/api  │');
    console.log('│  Base SQLite : ' + DB_FILE);
    console.log('└─────────────────────────────────────────────┘');
  });
}).catch(e => { console.error('Impossible d\'ouvrir la base :', e); process.exit(1); });
