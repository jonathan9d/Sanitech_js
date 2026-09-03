/* =====================================================================
   SANITECH — app.js
   Automatisations, initialisation et démarrage de l'application.
   ===================================================================== */
/* ================= AUTOMATISATIONS ================= */
function checkAutoOut() {
  const s = state?.settings?.autoOut;
  if (!s?.on || !state?.session) return;
  const today = dayKey(Date.now());
  if (state.autoOutLast === today) return;
  const now = new Date(), [h, m] = s.time?.split(':')?.map(Number) || [0, 0];
  if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
    const ins = state.users?.filter(u => !u.archived && u.presence === 'in') || [];
    state.autoOutLast = today;
    ins.forEach(u => finishPunch(u.id, 'out', 'auto', null, { silent: true }));
    save();
    if (ins.length) {
      addNotif('event_repeat', 'Sortie automatique', `${ins.length} utilisateur(s) passé(s) en sortie à ${s.time}.`);
      toast(`Sortie automatique : ${ins.length} pointage(s)`, 'event_repeat', 'info');
      renderUsers(); updateStack();
    }
  }
}
function checkSummary() {
  const s = state?.settings?.summary; if (!s?.on || !state?.session) return;
  const today = dayKey(Date.now()); if (state.summaryLast === today) return;
  const now = new Date(), [h, m] = s.time?.split(':')?.map(Number) || [0, 0];
  if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
    state.summaryLast = today;
    const act = state.users?.filter(u => !u.archived) || [];
    const ins = state.logs?.filter(l => l.type === 'in' && dayKey(l.ts) === today).length || 0;
    const outs = state.logs?.filter(l => l.type === 'out' && dayKey(l.ts) === today).length || 0;
    const ret = state.logs?.filter(l => l.type === 'in' && l.late && dayKey(l.ts) === today).length || 0;
    const pres = act.filter(u => u.presence === 'in').length;
    const hSum = act.reduce((s2, u) => s2 + hoursFor(u, dayStartTs(), Date.now()), 0);
    addNotif('summarize', 'Résumé de la journée', `${ins} entrées · ${outs} sorties · ${ret} retard(s) · ${pres} présent(s) · ${fmtDur(hSum)} travaillées.`);
    toast('Résumé quotidien disponible', 'summarize', 'info'); save();
  }
}
/* Mode sombre automatique : suit un créneau horaire (ex. 20h → 7h) */
function autoDarkTarget() {
  const s = state?.settings?.autoDark; if (!s || !s.on) return null;
  const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
  const f = s.from?.split(':')?.map(Number) || [0, 0], t = s.to?.split(':')?.map(Number) || [0, 0];
  const fM = (f[0] || 0) * 60 + (f[1] || 0), tM = (t[0] || 0) * 60 + (t[1] || 0);
  return fM <= tM ? (cur >= fM && cur < tM) : (cur >= fM || cur < tM);
}
function applyAutoDark() {
  const dark = autoDarkTarget(); if (dark === null) return;
  const target = dark ? 'dark' : 'light';
  if ((document.documentElement.dataset.theme || 'light') !== target) { state.settings.theme = target; applyTheme(target, true); save(); }
}
function autoArchive() {
  const s = state?.settings?.autoArch; if (!s?.on || !state?.session) return;
  const cut = Date.now() - s.days * 864e5; const hits = [];
  state.users?.forEach(u => { if (!u.archived && (u.lastMove || u.createdAt || Date.now()) < cut) { u.archived = true; hits.push(u.prenom + ' ' + u.nom) } });
  if (hits.length) {
    save();
    addNotif('auto_mode', 'Archivage automatique', hits.length + ' utilisateur(s) inactif(s) archivé(s) : ' + hits.slice(0, 3).join(', ') + (hits.length > 3 ? '…' : ''));
    toast(hits.length + ' utilisateur(s) archivé(s) automatiquement', 'auto_mode', 'info');
    if (tab === 'users') renderUsers(); updateStack();
  }
}
let tick = 0;
setInterval(() => {
  tick++;
  checkAutoOut(); checkSummary(); applyAutoDark();
  if (tick % 120 === 0) autoArchive();
  const sl = state?.settings?.sessionLimit;
  if (state?.session && sl > 0 && state.sessionStart && Date.now() - state.sessionStart > sl * 3600e3) {
    state.session = null; state.sessionStart = null; save(); closeSheet(true);
    showScreen('auth'); switchAuth('login'); $('#li-pass').value = '';
    toast('Session expirée — reconnectez-vous', 'timer_off', 'info'); beep('error');
    return;
  }
  if (state?.session && state?.pin?.enabled && !window.locked && $('#app')?.classList.contains('active') && typeof window.lastActive !== 'undefined' && Date.now() - window.lastActive > state.pin.timeout * 60000) {
    if (typeof lockApp === 'function') lockApp();
  }
}, 5000);


/* ================= INIT ================= */
function enterApp() {
  showScreen('app');
  if (!state.sessionStart) { state.sessionStart = Date.now(); save() }
  requestAnimationFrame(() => { movePill(); skelList('#ulist', renderUsers); renderLogsView(); renderReqs(); renderSettings(); applyBell(); updateStack() });
  $('#fab').classList.remove('hidden');
  // Update global lastActive
  try { window.lastActive = Date.now(); } catch (e) { }
  autoArchive();
  /* Visite guidée du premier lancement (désactivable via ?tour=off) */
  try { if (typeof startTourIfFirst === 'function') startTourIfFirst() } catch (e) { }
}
/* ================= DÉMARRAGE ================= */
async function boot() {
  try { await initDB(); }
  catch (e) { 
    toast('Erreur d\'initialisation de la base de données', 'error', 'err');
  }
  loadStateFromDB();
  ensureState(); purgeTrash();
  buildAccents();
  applyTheme(state.settings.theme, true);
  applyAutoDark();
  applyDense();
  applyAccent();
  applyTextSize();
  applyPattern();
  document.documentElement.classList.toggle('cb', !!state.settings.cb);
  save();
  // Statistiques de la base affichées dans « À propos »
  const ab = dbStats();
  if (ab && document.getElementById('about-db')) {
    const kb = Math.max(1, Math.round(ab.size / 1024));
    document.getElementById('about-db').textContent = `Base SQLite · ${ab.users} utilisateurs · ${ab.logs} mouvements · ${kb} Ko`;
  }
  /* PWA : enregistrement du service worker (hors-ligne complet) */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => { });
  }
  startSplash();
}
boot();
