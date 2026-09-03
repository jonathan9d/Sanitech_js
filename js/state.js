/* =====================================================================
   SANITECH — state.js
   État applicatif : valeurs par défaut, données de démo, sauvegarde.
   ===================================================================== */
/* ================= STATE ================= */
const KEY = 'sanitech_v1';
let state = null;
function defaults() { return { accounts: [{ username: 'admin', pass: 'admin123', email: 'admin@sanitech.io' }], users: [], logs: [], settings: { theme: 'light', sound: true, notif: true, accent: '#0d6ef2', uview: 'list', period: 14, selfie: false, autoOut: { on: false, time: '19:00' }, lateTime: '08:30', textSize: 'S', pattern: 'none', cb: false, sessionLimit: 0, autoArch: { on: false, days: 60 }, summary: { on: true, time: '18:00' }, otThreshold: 8, dense: false, lateAlert: true, autoDark: { on: false, from: '20:00', to: '07:00' }, scanSource: 'phone', espCamUrl: 'http://192.168.4.1', kpis: [{ id: 'pres', on: true }, { id: 'in', on: true }, { id: 'out', on: true }, { id: 'total', on: true }, { id: 'assid', on: true }, { id: 'hours', on: true }, { id: 'late', on: false }, { id: 'ot', on: false }] }, session: null, sessionStart: null, seq: 1001, pin: { enabled: false, code: null, timeout: 3 }, requests: [], notifs: [], trash: [], autoOutLast: null, summaryLast: null } }
/* Sauvegarde : écrit l'état dans la base SQLite (js/db.js). */
function save() { if (dbReady) dbSyncState(); }
function ensureState() {
  const d = defaults();
  state.pin = Object.assign(d.pin, state.pin || {});
  state.requests = state.requests || []; state.notifs = state.notifs || []; state.trash = state.trash || [];
  state.settings = Object.assign({}, d.settings, state.settings || {});
  state.settings.autoOut = Object.assign({ on: false, time: '19:00' }, state.settings.autoOut || {});
  state.settings.autoArch = Object.assign({ on: false, days: 60 }, state.settings.autoArch || {});
  state.settings.summary = Object.assign({ on: true, time: '18:00' }, state.settings.summary || {});
  state.settings.autoDark = Object.assign({ on: false, from: '20:00', to: '07:00' }, state.settings.autoDark || {});
  if (state.settings.lateAlert === undefined) state.settings.lateAlert = true;
  if (state.settings.dense === undefined) state.settings.dense = false;
  if (!state.settings.kpis || !state.settings.kpis.length) state.settings.kpis = d.settings.kpis;
  if (!state.settings.accent) state.settings.accent = '#0d6ef2';
  if (!state.settings.period) state.settings.period = 14;
  if (!state.settings.textSize) state.settings.textSize = 'M';
  if (!state.settings.pattern) state.settings.pattern = 'none';
  if (!state.settings.otThreshold) state.settings.otThreshold = 8;
  if (!state.settings.scanSource) state.settings.scanSource = 'phone';
  if (!state.settings.espCamUrl) state.settings.espCamUrl = 'http://192.168.4.1';
}
function purgeTrash() { state.trash = state.trash.filter(t => Date.now() - t.at < 30 * 864e5) }
function mklog(u, type, ts) { return { id: uid(), userId: u.id, name: u.prenom + ' ' + u.nom, type, ts, source: 'seed', late: false, photo: null } }
function seed() {
  const P = [
    ['Aïcha', 'Diallo', 'aicha.diallo@sanitech.io', 'Administratrice', 'Direction', 'Actif', 'in', 'Dakar, Plateau', '1992-04-12', '+221 77 450 22 10', false],
    ['Moussa', 'Traoré', 'moussa.traore@sanitech.io', 'Superviseur', 'Exploitation', 'Actif', 'in', 'Dakar, Yoff', '1988-11-03', '+221 76 118 90 42', false],
    ['Claire', 'Dubois', 'claire.dubois@sanitech.io', 'Technicienne', 'Maintenance', 'Actif', 'out', 'Rufisque, Nord', '1995-02-21', '+221 70 233 41 87', false],
    ['Karim', 'Benali', 'karim.benali@sanitech.io', 'Agent', 'Collecte', 'Actif', 'in', 'Pikine, Ouest', '1990-07-15', '+221 77 902 15 66', false],
    ['Sophie', 'Martin', 'sophie.martin@sanitech.io', 'Comptable', 'Finance', 'Actif', 'out', 'Dakar, Mermoz', '1986-09-28', '+221 78 410 77 23', false],
    ['Ibrahima', 'Ndiaye', 'ibrahima.ndiaye@sanitech.io', 'Agent', 'Collecte', 'Actif', 'in', 'Guédiawaye', '1998-01-09', '+221 70 556 30 19', false],
    ['Lucas', 'Moreau', 'lucas.moreau@sanitech.io', 'Technicien', 'Maintenance', 'En congé', 'out', 'Thiaroye', '1993-05-17', '+221 76 884 52 08', false],
    ['Nadia', 'Cherif', 'nadia.cherif@sanitech.io', 'Agente', 'Exploitation', 'Actif', 'out', 'Ngor, Almadies', '1991-12-05', '+221 77 300 68 41', true]
  ];
  const now = new Date();
  state.users = P.map((p, i) => ({ id: uid(), uid: 'SAN-' + (1001 + i), prenom: p[0], nom: p[1], email: p[2], role: p[3], dept: p[4], statut: p[5], presence: p[6], adresse: p[7], naissance: p[8], tel: p[9], archived: p[10], photo: null, lastMove: null, createdAt: now.getTime() - (30 - i) * 864e5 }));
  const logs = [];
  for (let d = 13; d >= 1; d--) {
    for (const u of state.users) {
      if (u.archived || Math.random() < 0.12) continue;
      const day = new Date(now); day.setDate(now.getDate() - d);
      const inT = new Date(day); inT.setHours(7, 30 + rnd(90), rnd(60), 0); logs.push(mklog(u, 'in', inT.getTime()));
      if (Math.random() < 0.88) { const o = new Date(day); o.setHours(16, 30 + rnd(110), rnd(60), 0); logs.push(mklog(u, 'out', o.getTime())) }
    }
  }
  for (const u of state.users) {
    if (u.archived) continue;
    let inT = new Date(); inT.setHours(7, 15 + rnd(80), rnd(60), 0);
    if (inT.getTime() > Date.now()) inT.setTime(Date.now() - rnd(150) * 60000 - 60000);
    logs.push(mklog(u, 'in', inT.getTime()));
    if (u.presence === 'out') { const o = new Date(inT.getTime() + (4 + rnd(6)) * 3600e3); if (o.getTime() > Date.now()) o.setTime(Date.now() - rnd(45) * 60000 - 60000); if (o.getTime() > inT.getTime()) logs.push(mklog(u, 'out', o.getTime())) }
  }
  logs.sort((a, b) => a.ts - b.ts);
  state.logs = logs;
  state.users.forEach(u => { for (let i = logs.length - 1; i >= 0; i--) { if (logs[i].userId === u.id) { u.lastMove = logs[i].ts; break } } });
  state.seq = 1001 + P.length;
}

