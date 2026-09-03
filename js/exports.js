/* =====================================================================
   SANITECH — exports.js
   Exports CSV, sauvegarde/restauration JSON, rapport PDF.
   ===================================================================== */
/* ================= EXPORTS ================= */
function download(name, content, mime) {
  const b = new Blob([content], { type: mime }); const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
$('#btn-csv-users').onclick = () => {
  const rows = [['ID', 'Prenom', 'Nom', 'Email', 'Telephone', 'Naissance', 'Role', 'Departement', 'Statut', 'Adresse', 'Presence', 'Archive'].join(';')];
  state.users.forEach(u => rows.push([u.uid, u.prenom, u.nom, u.email, u.tel || '', u.naissance || '', u.role, u.dept || '', u.statut, u.adresse || '', u.presence, u.archived ? 'oui' : 'non'].map(csvCell).join(';')));
  download('sanitech_utilisateurs.csv', '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  beep('success'); toast('Export CSV des utilisateurs téléchargé', 'table_view', 'ok');
};
$('#btn-csv-logs').onclick = () => {
  const rows = [['Date', 'Heure', 'Utilisateur', 'ID', 'Type', 'Source', 'Retard'].join(';')];
  state.logs.forEach(l => { const d = new Date(l.ts); rows.push([d.toLocaleDateString('fr-FR'), fmtTime(l.ts), l.name, (state.users.find(u => u.id === l.userId) || {}).uid || '', l.type === 'in' ? 'Entrée' : 'Sortie', l.source || 'manual', l.late ? 'oui' : 'non'].map(csvCell).join(';')) });
  download('sanitech_journal.csv', '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  beep('success'); toast('Export CSV du journal téléchargé', 'receipt_long', 'ok');
};
$('#btn-json-out').onclick = () => {
  download('sanitech_sauvegarde_' + dayKey(Date.now()) + '.json', JSON.stringify(state, null, 2), 'application/json');
  beep('success'); toast('Sauvegarde JSON téléchargée', 'backup', 'ok');
  addNotif('backup', 'Sauvegarde exportée', 'Fichier JSON généré le ' + fmtDate(Date.now()) + '.');
};
$('#btn-json-in').onclick = () => $('#file-json').click();
$('#file-json').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (!d.users || !d.accounts) throw 0;
      confirmDialog({
        icon: 'restore', title: 'Restaurer cette sauvegarde ?', danger: false, ok: 'Restaurer',
        msg: 'Les données actuelles seront <b>remplacées</b> par celles du fichier.',
        onOk: () => { state = d; ensureState(); save(); applyTheme(state.settings.theme); applyAccent(); applyTextSize(); applyPattern(); document.documentElement.classList.toggle('cb', !!state.settings.cb); applyBell(); renderUsers(); updateStack(); renderLogsView(); renderReqs(); renderStats(); renderSettings(); beep('success'); celebrate(); toast('Sauvegarde restaurée', 'restore', 'ok'); addNotif('restore', 'Sauvegarde importée', 'Données restaurées avec succès.') }
      });
    } catch (err) { toast('Fichier JSON invalide', 'error', 'err'); beep('error') }
  };
  rd.readAsText(f); e.target.value = '';
});
/* --- Sauvegarde / restauration SQLite (.db) --- */
$('#btn-sqlite-out').onclick = () => {
  const bytes = exportDBFile();
  if (!bytes) { toast('Base de données indisponible', 'error', 'err'); beep('error'); return }
  download('sanitech_base_' + dayKey(Date.now()) + '.db', bytes, 'application/octet-stream');
  beep('success'); toast('Base SQLite téléchargée (.db)', 'database', 'ok');
  addNotif('database', 'Sauvegarde SQLite exportée', 'Fichier .db généré le ' + fmtDate(Date.now()) + '.');
};
$('#btn-sqlite-in').onclick = () => $('#file-sqlite').click();
$('#file-sqlite').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    try {
      const bytes = new Uint8Array(ev.target.result);
      confirmDialog({
        icon: 'restore', title: 'Restaurer cette base SQLite ?', danger: false, ok: 'Restaurer',
        msg: 'La base actuelle sera <b>remplacée</b> par le fichier .db choisi.',
        onOk: () => {
          if (importDBFile(bytes)) {
            applyTheme(state.settings.theme); applyAccent(); applyTextSize(); applyPattern();
            document.documentElement.classList.toggle('cb', !!state.settings.cb); applyBell();
            renderUsers(); updateStack(); renderLogsView(); renderReqs(); renderStats(); renderSettings();
            beep('success'); celebrate(); toast('Base SQLite restaurée', 'restore', 'ok');
            addNotif('restore', 'Base restaurée', 'La base de données SQLite a été importée avec succès.');
          } else { toast('Fichier .db invalide', 'error', 'err'); beep('error') }
        }
      });
    } catch (err) { toast('Fichier .db invalide', 'error', 'err'); beep('error') }
  };
  rd.readAsArrayBuffer(f); e.target.value = '';
});
$('#btn-reset').onclick = () => confirmDialog({
  icon: 'restart_alt', title: 'Réinitialiser les données ?',
  msg: 'Toutes les données (base SQLite comprise) seront remplacées par le jeu de démonstration d\u2019origine.', ok: 'Réinitialiser',
  onOk: () => {
    try { localStorage.removeItem(KEY) } catch (e) { }
    try { localStorage.setItem('sanitech_reset', '1') } catch (e) { }
    location.reload();
  }
});
$('#btn-print').onclick = () => { buildReport(); beep('pop'); setTimeout(() => window.print(), 150) };
function buildReport() {
  const P = state.settings.period, tk = dayKey(Date.now());
  const act = state.users.filter(u => !u.archived);
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (P - 1));
  const logs = state.logs.filter(l => l.ts >= start.getTime());
  const ins = logs.filter(l => l.type === 'in').length, outs = logs.filter(l => l.type === 'out').length;
  const retards = logs.filter(l => l.late).length;
  const hSum = act.reduce((s, u) => s + hoursFor(u, dayStartTs(), Date.now()), 0);
  const thr = state.settings.otThreshold * 3600e3;
  const uRows = act.map(u => { const h7 = hoursFor(u, Date.now() - 7 * 864e5, Date.now()); return `<tr><td>${u.uid}</td><td>${esc(u.prenom)} ${esc(u.nom)}</td><td>${esc(u.role)}</td><td>${esc(u.statut)}</td><td>${u.presence === 'in' ? 'Présent' : 'Sortie'}</td><td>${fmtDur(h7)}</td><td>${fmtDur(Math.max(0, h7 - thr * 7))}</td></tr>` }).join('');
  const lRows = [...logs].reverse().slice(0, 120).map(l => `<tr><td>${new Date(l.ts).toLocaleDateString('fr-FR')}</td><td>${fmtTime(l.ts)}</td><td>${esc(l.name)}</td><td>${l.type === 'in' ? 'Entrée' : 'Sortie'}</td><td>${l.source || 'manual'}</td><td>${l.late ? 'Oui' : '—'}</td></tr>`).join('');
  $('#printarea').innerHTML =`
    <div class="pr-head">
      <div class="pr-title">SANI<span>TECH</span> — Rapport d'activité</div>
      <div class="pr-date">Généré le ${fmtDate(Date.now())}<br>Période : ${P} derniers jours</div>
    </div>
    <div class="pr-grid">
      <div class="pr-k"><b>${act.length}</b>Effectif actif</div>
      <div class="pr-k"><b>${ins}</b>Entrées (${P} j)</div>
      <div class="pr-k"><b>${outs}</b>Sorties (${P} j)</div>
      <div class="pr-k"><b>${assiduite(P)}%</b>Taux d'assiduité</div>
      <div class="pr-k"><b>${retards}</b>Retards (${P} j)</div>
      <div class="pr-k"><b>${fmtDur(hSum)}</b>Heures (jour)</div>
      <div class="pr-k"><b>${state.requests.filter(r => r.status === 'pending').length}</b>Demandes en attente</div>
      <div class="pr-k"><b>${act.filter(u => u.presence === 'in').length}</b>Présents actuellement</div>
    </div>
    <div class="pr-h2">Utilisateurs actifs</div>
    <table class="pr"><thead><tr><th>ID</th><th>Nom</th><th>Rôle</th><th>Statut</th><th>Présence</th><th>Heures (7 j)</th><th>HS (7 j)</th></tr></thead><tbody>${uRows}</tbody></table>
    <div class="pr-h2">Journal des mouvements (${Math.min(logs.length, 120)} derniers)</div>
    <table class="pr"><thead><tr><th>Date</th><th>Heure</th><th>Utilisateur</th><th>Type</th><th>Source</th><th>Retard</th></tr></thead><tbody>${lRows}</tbody></table>
    <p style="font-size:9.5px;color:#8aa0b8">Sanitech 3.2 — document généré automatiquement. © 2026 Sanitech.</p>`;
}

