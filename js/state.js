/* =====================================================================
   SANITECH — state.js
   État applicatif : valeurs par défaut, données de démo, sauvegarde.
   ===================================================================== */
/* ================= STATE ================= */
const KEY = 'sanitech_v1';
let state = null;
function defaults() { return { accounts: [{ username: 'admin', pass: 'admin123', email: 'admin@sanitech.io' }], users: [], logs: [], settings: { theme: 'light', sound: true, notif: true, accent: '#0d6ef2', uview: 'list', period: 14, selfie: false, voice: true, services: ['Maintenance', 'Technique', 'Direction', 'Administration', 'Développement', 'Comptabilité'], tourDone: false, autoOut: { on: false, time: '19:00' }, lateTime: '08:30', textSize: 'S', pattern: 'none', cb: false, sessionLimit: 0, autoArch: { on: false, days: 60 }, summary: { on: true, time: '18:00' }, otThreshold: 8, dense: false, lateAlert: true, autoDark: { on: false, from: '20:00', to: '07:00' }, scanSource: 'phone', espCamUrl: 'http://192.168.4.1', kpis: [{ id: 'pres', on: true }, { id: 'in', on: true }, { id: 'out', on: true }, { id: 'total', on: true }, { id: 'assid', on: true }, { id: 'hours', on: true }, { id: 'late', on: false }, { id: 'ot', on: false }] }, session: null, sessionStart: null, seq: 1001, pin: { enabled: false, code: null, timeout: 3 }, requests: [], notifs: [], trash: [], autoOutLast: null, summaryLast: null } }
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
  if (state.settings.voice === undefined) state.settings.voice = true;
  if (!Array.isArray(state.settings.services)) state.settings.services = d.settings.services.slice();
  if (state.settings.tourDone === undefined) state.settings.tourDone = false;
  if (!state.settings.scanSource) state.settings.scanSource = 'phone';
  if (!state.settings.espCamUrl) state.settings.espCamUrl = 'http://192.168.4.1';
}
function purgeTrash() { state.trash = state.trash.filter(t => Date.now() - t.at < 30 * 864e5) }
function mklog(u, type, ts) { return { id: uid(), userId: u.id, name: u.prenom + ' ' + u.nom, type, ts, source: 'seed', late: false, photo: null } }
function seed() {
  /* Email dérivé du nom : prenom.nom@suffixe (minuscules, sans accents) */
  const mail = (prenom, nom) => (norm(prenom.split(/\s+/)[0]) + '.' + norm(nom)).replace(/[^a-z0-9.]/g, '') + '@sanitech.io';
  /* Téléphone malgache standard aléatoire : +261 3X XX XXX XX */
  const mgPhone = () => { const d = () => rnd(10); return '+261 ' + ['32', '33', '34'][rnd(3)] + ' ' + d() + d() + ' ' + d() + d() + d() + ' ' + d() + d() };
  /* [prénom, nom, id badge, rôle, service, statut, présence, adresse] */
  const P = [
    ['Arotia Tolotra', 'RASOLONIAINA', '1', 'Agent', '', 'Actif', 'in', 'Sabotsy'],
    ['Mamisoa Johan', 'RAKOTOZANAY', '25', 'Agent', '', 'Actif', 'out', '67 Ha'],
    ['Marc Fredderman', 'RAHARISON', '30', 'Agent', '', 'Actif', 'in', 'Ambohipo'],
    ['Tsinjo Nantenaina', 'RAZANAVAHY', '31', 'Agent', '', 'Actif', 'out', 'Ambohipo'],
    ['Tsilavina Jonathan', 'RANDRIANARISON', '32', 'Développeur', 'Maintenance', 'Actif', 'in', 'Mahazo'],
    ['Henintsoa', 'RAJOELINA', '33', 'Agent', '', 'Actif', 'out', 'Mahazo'],
    ['Sandaniaina', 'RANDRIANARISOA', '36', 'Agent', '', 'Actif', 'in', 'Ambohitrarahaba']
  ];
  const now = new Date();
  state.users = P.map((p, i) => ({ id: uid(), uid: p[2], prenom: p[0], nom: p[1], email: mail(p[0], p[1]), role: p[3], dept: p[4], statut: p[5], presence: p[6], adresse: p[7], naissance: '', tel: mgPhone(), archived: false, photo: null, lastMove: null, createdAt: now.getTime() - (30 - i) * 864e5 }));
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
  state.seq = 1001;
}

