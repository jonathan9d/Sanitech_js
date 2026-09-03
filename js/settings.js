/* =====================================================================
   SANITECH — settings.js
   Paramètres, sécurité (code PIN) et verrouillage.
   ===================================================================== */
/* ================= SETTINGS ================= */
function renderSettings() {
  const acc = state.accounts.find(a => a.username === state.session.user) || state.accounts[0];
  $('#sp-name').textContent = acc.username === 'admin' ? 'Administrateur' : acc.username;
  $('#sp-mail').textContent = acc.email || '—';
  $('#sp-avatar').textContent = acc.username.slice(0, 2).toUpperCase();
  /* Barre latérale (bureau) */
  const sn = $('#snav-name'); if (sn) sn.textContent = acc.username === 'admin' ? 'Administrateur' : acc.username;
  const sm = $('#snav-mail'); if (sm) sm.textContent = acc.email || '—';
  const sa = $('#snav-avatar'); if (sa) sa.textContent = acc.username.slice(0, 2).toUpperCase();
  $('#sw-theme').checked = state.settings.theme === 'dark';
  const setIc = $('#set-theme-ic'); if (setIc) setIc.textContent = state.settings.theme === 'dark' ? 'light_mode' : 'dark_mode';
  $('#sw-sound').checked = state.settings.sound;
  $('#ic-sound').textContent = state.settings.sound ? 'volume_up' : 'volume_off';
  $('#ic-sound-box').classList.toggle('off', !state.settings.sound);
  $('#sw-notif').checked = state.settings.notif;
  $('#sw-notif2').checked = state.settings.notif;
  $('#sw-selfie').checked = state.settings.selfie;
  $('#sw-voice').checked = state.settings.voice !== false;
  $('#sw-autoout').checked = state.settings.autoOut.on;
  $('#in-autoout').value = state.settings.autoOut.time;
  $('#in-late').value = state.settings.lateTime;
  $('#in-ot').value = state.settings.otThreshold;
  $('#sel-pintime').value = String(state.pin.timeout);
  $('#sw-pin').checked = state.pin.enabled;
  $('#pin-sub').textContent = state.pin.enabled ? `Activé · verrou après ${state.pin.timeout} min` : 'Désactivé';
  $('#btn-lock').style.display = state.pin.enabled ? 'grid' : 'none';
  $('#trashcount').textContent = state.trash.length;
  $('#uview-ic').textContent = state.settings.uview === 'list' ? 'grid_view' : 'view_list';
  $('#sel-tsize').value = state.settings.textSize;
  $('#sel-pattern').value = state.settings.pattern;
  $('#sw-cb').checked = !!state.settings.cb;
  $('#sel-session').value = String(state.settings.sessionLimit || 0);
  $('#sw-autoarch').checked = state.settings.autoArch.on;
  $('#in-archdays').value = state.settings.autoArch.days;
  $('#sw-summary').checked = state.settings.summary.on;
  $('#in-summary').value = state.settings.summary.time;
  $('#sw-dense').checked = !!state.settings.dense;
  $('#sw-latealert').checked = state.settings.lateAlert !== false;
  $('#sw-autodark').checked = !!state.settings.autoDark.on;
  $('#in-autodark-from').value = state.settings.autoDark.from;
  $('#in-autodark-to').value = state.settings.autoDark.to;
}
function applyDense() { const el = document.getElementById('shell'); if (el) el.classList.toggle('dense', !!state.settings.dense) }
$('#sw-theme').addEventListener('change', e => { state.settings.theme = e.target.checked ? 'dark' : 'light'; save(); applyTheme(state.settings.theme); beep('tap') });
$('#sw-sound').addEventListener('change', e => {
  state.settings.sound = e.target.checked; save();
  const ic = $('#ic-sound'), box = $('#ic-sound-box');
  ic.textContent = e.target.checked ? 'volume_up' : 'volume_off';
  box.classList.toggle('off', !e.target.checked);
  ic.classList.remove('pop'); void ic.offsetWidth; ic.classList.add('pop');
  box.classList.remove('sicon-pop'); void box.offsetWidth; box.classList.add('sicon-pop');
  if (e.target.checked) beep('success');
  toast('Sons ' + (e.target.checked ? 'activés' : 'désactivés'), e.target.checked ? 'volume_up' : 'volume_off', 'info');
});
$('#sw-selfie').addEventListener('change', e => { state.settings.selfie = e.target.checked; save(); beep('tap'); toast('Selfie de pointage ' + (e.target.checked ? 'activé' : 'désactivé'), 'photo_camera', 'info') });
$('#sw-voice').addEventListener('change', e => {
  state.settings.voice = e.target.checked; save(); beep('tap');
  toast('Annonce vocale ' + (e.target.checked ? 'activée' : 'désactivée'), 'record_voice_over', 'info');
});
$('#sw-autoout').addEventListener('change', e => { state.settings.autoOut.on = e.target.checked; save(); beep('tap'); toast('Sortie automatique ' + (e.target.checked ? 'activée à ' + state.settings.autoOut.time : 'désactivée'), 'event_repeat', 'info') });
$('#in-autoout').addEventListener('change', e => { state.settings.autoOut.time = e.target.value || '19:00'; save(); toast('Sortie automatique à ' + state.settings.autoOut.time, 'schedule', 'info') });
$('#in-late').addEventListener('change', e => { state.settings.lateTime = e.target.value || '08:30'; save(); toast('Heure limite : ' + state.settings.lateTime, 'alarm', 'info') });
$('#in-ot').addEventListener('change', e => { state.settings.otThreshold = Math.max(1, Math.min(12, +e.target.value || 8)); e.target.value = state.settings.otThreshold; save(); toast('Seuil HS : ' + state.settings.otThreshold + ' h/jour', 'more_time', 'info'); renderUsers() });
$('#sel-tsize').addEventListener('change', e => { state.settings.textSize = e.target.value; save(); applyTextSize(); beep('tap'); toast('Taille du texte : ' + e.target.value, 'format_size', 'info') });
$('#sel-pattern').addEventListener('change', e => { state.settings.pattern = e.target.value; save(); applyPattern(); beep('tap'); toast('Motif de fond appliqué', 'texture', 'info') });
$('#sw-cb').addEventListener('change', e => {
  state.settings.cb = e.target.checked; save(); document.documentElement.classList.toggle('cb', e.target.checked); beep('tap'); toast('Mode daltonien ' + (e.target.checked ? 'activé' : 'désactivé'), 'visibility', 'info');
  if (tab === 'stats') { renderStats(); drawChart() } if (tab === 'logs') renderLogsView(); renderUsers()
});
$('#sel-session').addEventListener('change', e => { state.settings.sessionLimit = +e.target.value; state.sessionStart = Date.now(); save(); toast(e.target.value === '0' ? 'Session sans expiration' : 'Déconnexion auto après ' + e.target.value + ' h', 'timer_off', 'info') });
$('#sw-autoarch').addEventListener('change', e => { state.settings.autoArch.on = e.target.checked; save(); toast('Archivage automatique ' + (e.target.checked ? 'activé' : 'désactivé'), 'auto_mode', 'info'); if (e.target.checked) autoArchive() });
$('#in-archdays').addEventListener('change', e => { state.settings.autoArch.days = Math.max(7, +e.target.value || 60); e.target.value = state.settings.autoArch.days; save(); toast('Inactivité avant archivage : ' + state.settings.autoArch.days + ' j', 'auto_mode', 'info') });
$('#sw-summary').addEventListener('change', e => { state.settings.summary.on = e.target.checked; save(); toast('Résumé quotidien ' + (e.target.checked ? 'activé' : 'désactivé'), 'summarize', 'info') });
$('#in-summary').addEventListener('change', e => { state.settings.summary.time = e.target.value || '18:00'; save(); toast('Résumé quotidien à ' + state.settings.summary.time, 'summarize', 'info') });
$('#sw-dense').addEventListener('change', e => { state.settings.dense = e.target.checked; save(); applyDense(); beep('tap'); toast('Cartes ' + (e.target.checked ? 'compactes' : 'confortables'), 'density_medium', 'info') });
$('#sw-latealert').addEventListener('change', e => { state.settings.lateAlert = e.target.checked; save(); beep('tap'); toast('Alerte de retard ' + (e.target.checked ? 'activée' : 'désactivée'), 'warning_amber', 'info') });
$('#sw-autodark').addEventListener('change', e => { state.settings.autoDark.on = e.target.checked; save(); applyAutoDark(); beep('tap'); toast('Mode sombre automatique ' + (e.target.checked ? 'activé' : 'désactivé'), 'auto_awesome', 'info') });
$('#in-autodark-from').addEventListener('change', e => { state.settings.autoDark.from = e.target.value || '20:00'; save(); applyAutoDark(); toast('Créneau sombre : ' + state.settings.autoDark.from + ' → ' + state.settings.autoDark.to, 'nights_stay', 'info') });
$('#in-autodark-to').addEventListener('change', e => { state.settings.autoDark.to = e.target.value || '07:00'; save(); applyAutoDark(); toast('Créneau sombre : ' + state.settings.autoDark.from + ' → ' + state.settings.autoDark.to, 'nights_stay', 'info') });
$('#btn-trash-empty').onclick = () => confirmDialog({ icon: 'delete_sweep', title: 'Vider la corbeille ?', msg: 'Tous les éléments supprimés et leur historique seront effacés <b>définitivement</b>. Cette action est irréversible.', ok: 'Vider', danger: true, onOk: () => { const n = state.trash.length; state.trash = []; save(); beep('error'); toast(n + ' élément(s) supprimé(s) définitivement', 'delete_sweep', 'err'); renderUsers(); renderSettings() } });
$('#btn-chpwd').onclick = () => { ['#cp-cur', '#cp-new', '#cp-new2'].forEach(s => $(s).value = ''); setErr('cp-err', false); openSheet($('#sheet-chpwd')) };
$('#sheet-chpwd').addEventListener('submit', e => {
  e.preventDefault();
  const acc = state.accounts.find(a => a.username === state.session.user);
  const cur = $('#cp-cur').value, nw = $('#cp-new').value, nw2 = $('#cp-new2').value;
  if (cur !== acc.pass) { setErr('cp-err', true, 'Le mot de passe actuel est incorrect.'); beep('error'); return }
  if (nw.length < 6) { setErr('cp-err', true, 'Le nouveau mot de passe doit contenir au moins 6 caractères.'); beep('error'); return }
  if (nw !== nw2) { setErr('cp-err', true, 'La confirmation ne correspond pas.'); beep('error'); return }
  acc.pass = nw; save(); setErr('cp-err', false); beep('success'); celebrate(); toast('Mot de passe mis à jour', 'key', 'ok'); closeSheet();
});
$('#btn-help').onclick = () => openSheet($('#sheet-help'));
$('#btn-about').onclick = () => openSheet($('#sheet-about'));
$('#btn-contact').onclick = () => { $('#ct-name').value = state.session.user; $('#ct-mail').value = ''; $('#ct-msg').value = ''; openSheet($('#sheet-contact')) };
$('#sheet-contact').addEventListener('submit', e => {
  e.preventDefault();
  if (!$('#ct-name').value.trim() || !$('#ct-msg').value.trim()) { toast('Complétez votre nom et votre message', 'edit', 'err'); beep('error'); return }
  beep('success'); toast('Message envoyé au support', 'send', 'ok'); closeSheet();
});
$$('.acc-head').forEach(h => h.addEventListener('click', () => { h.parentElement.classList.toggle('open'); beep('tap') }));
$('#btn-trash').onclick = () => { uFilter = 'trash'; $$('#uchips .chip').forEach(x => x.classList.toggle('active', x.dataset.f === 'trash')); setTabDirect('users'); skelList('#ulist', renderUsers) };
const doLogout = () => confirmDialog({
  icon: 'logout', title: 'Se déconnecter ?', msg: 'Vous devrez vous reconnecter pour accéder à Sanitech.', ok: 'Déconnexion', danger: false,
  onOk: () => { state.session = null; state.sessionStart = null; save(); closeSheet(); showScreen('auth'); switchAuth('login'); $('#li-pass').value = ''; toast('Vous êtes déconnecté', 'logout', 'info') }
});
$('#btn-logout').onclick = doLogout;
$('#btn-logout2').onclick = doLogout;


/* ================= CODE PIN ================= */
function padHTML() {
  return`<div class="pin-dots"><i></i><i></i><i></i><i></i></div>
  <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'back'].map(k => k === '' ? '<span></span>' : `<button type="button" class="pinkey rip" data-k="${k}">${k === 'back' ? '<span class="mi">backspace</span>' : k}</button>`).join('')}</div>`;
}
function initPad(zone, onCode) {
  zone._buf = '';
  const dots = () => zone.querySelectorAll('.pin-dots i').forEach((d, i) => d.classList.toggle('on', i < zone._buf.length));
  zone.addEventListener('click', e => {
    const k = e.target.closest('.pinkey'); if (!k) return; beep('tap');
    const v = k.dataset.k;
    if (v === 'back') zone._buf = zone._buf.slice(0, -1);
    else if (zone._buf.length < 4) zone._buf += v;
    dots();
    if (zone._buf.length === 4) { const c = zone._buf; zone._buf = ''; setTimeout(() => onCode(c, zone), 140); setTimeout(dots, 140) }
  });
  zone.reset = () => { zone._buf = ''; dots() };
  zone.shake = () => { const d = zone.querySelector('.pin-dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); zone.reset(); beep('error') };
  return zone;
}
let pinStage = null, pinFirst = null;
const setupPad = initPad($('#pin-setup-pad'), code => {
  if (pinStage === 'cur') {
    if (code === state.pin.code) { pinStage = 'new'; $('#pin-msg').textContent = 'Entrez le nouveau code PIN'; setupPad.reset() }
    else { setupPad.shake(); $('#pin-msg').textContent = 'Code actuel incorrect — réessayez' }
  } else if (pinStage === 'new') {
    pinFirst = code; pinStage = 'confirm'; $('#pin-msg').textContent = 'Confirmez le nouveau code'; setupPad.reset();
  } else if (pinStage === 'confirm') {
    if (code === pinFirst) {
      state.pin.code = code; state.pin.enabled = true; save();
      hidePinSetup(); renderSettings(); beep('success'); celebrate(); toast('Code PIN activé', 'pin', 'ok');
      addNotif('pin', 'Sécurité renforcée', 'Le code PIN a été activé.');
    } else { setupPad.shake(); pinStage = 'new'; $('#pin-msg').textContent = 'Codes différents — nouveau code' }
  }
});
$('#pin-setup-pad').innerHTML = padHTML();
function showPinSetup(msg) { pinStage = state.pin.code ? 'cur' : 'new'; pinFirst = null; $('#pin-msg').textContent = msg || (state.pin.code ? 'Entrez votre code PIN actuel' : 'Choisissez un code PIN à 4 chiffres'); $('#pin-setup').style.display = 'block'; $('#btn-pin-change').style.display = 'none'; setupPad.reset() }
function hidePinSetup() { $('#pin-setup').style.display = 'none'; $('#btn-pin-change').style.display = state.pin.code ? 'flex' : 'none' }
$('#btn-pin').onclick = () => { hidePinSetup(); $('#btn-pin-change').style.display = state.pin.code ? 'flex' : 'none'; openSheet($('#sheet-pin')) };
$('#sw-pin').addEventListener('change', e => {
  if (e.target.checked) {
    if (state.pin.code) { state.pin.enabled = true; save(); renderSettings(); beep('success'); toast('Code PIN activé', 'pin', 'ok') }
    else { $('#sw-pin').checked = false; showPinSetup() }
  } else { state.pin.enabled = false; save(); renderSettings(); beep('tap'); toast('Code PIN désactivé', 'lock_open', 'info') }
});
$('#btn-pin-change').onclick = () => showPinSetup();
$('#pin-cancel').onclick = () => { hidePinSetup(); beep('tap') };
$('#sel-pintime').addEventListener('change', e => { state.pin.timeout = +e.target.value; save(); renderSettings(); toast('Verrouillage après ' + state.pin.timeout + ' min d\u2019inactivité', 'timer', 'info') });
// Global state for PIN lock - exposed on window for cross-module access
window.locked = false;
window.lastActive = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { window.lastActive = Date.now() }, { passive: true }));

$('#lk-zone').innerHTML = padHTML();
const lkPad = initPad($('#lk-zone'), code => {
  if (code === state.pin.code) {
    window.lastActive = Date.now(); // Reset timer on successful unlock
    unlockApp();
  }
  else { lkPad.shake(); $('#lk-err').textContent = 'Code incorrect' }
});
function lockApp() {
  if (!state.pin.enabled || window.locked) return;
  window.locked = true; closeSheet(true); $('#dialogwrap').classList.remove('on');
  $('#lk-err').textContent = ''; $('#lk-pass').style.display = 'none'; $('#lk-pass-link').style.display = 'inline'; $('#lk-pass-in').value = '';
  lkPad.reset(); $('#lockscreen').classList.add('on'); beep('pop');
}
function unlockApp() { window.locked = false; window.lastActive = Date.now(); $('#lockscreen').classList.remove('on'); beep('success'); toast('Application déverrouillée', 'lock_open', 'ok') }

// Expose lock function globally after definition
window.lockApp = lockApp;
$('#btn-lock').onclick = lockApp;
$('#lk-pass-link').onclick = () => { $('#lk-pass').style.display = 'block'; $('#lk-pass-link').style.display = 'none'; $('#lk-pass-in').focus() };
$('#lk-pass-go').onclick = () => {
  const acc = state.accounts.find(a => a.username === state.session.user);
  if (acc && $('#lk-pass-in').value === acc.pass) unlockApp();
  else { $('#lk-err').textContent = 'Mot de passe incorrect'; beep('error') }
};
$('#lk-pass-in').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lk-pass-go').click() });


/* ================= SERVICES & DÉPARTEMENTS ================= */
let svcEditId = null;
function renderServices() {
  const el = $('#svc-list'); if (!el) return;
  const list = state.settings.services || [];
  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="eic"><span class="mi">apartment</span></div><h4>Aucun service</h4><p>Ajoutez le premier service ci-dessous.</p></div>';
    svcEditId = null;
    return;
  }
  el.innerHTML = list.map((s, i) => {
    const n = state.users.filter(u => !u.archived && (u.dept || '') === s).length;
    if (svcEditId === i) {
      return `<div class="svc-row edit" data-i="${i}">
        <span class="sicon b"><span class="mi">edit</span></span>
        <div class="fbox" style="flex:1;min-width:0"><input id="svc-edit-in" value="${esc(s)}" maxlength="40" style="font-weight:600"></div>
        <button class="ibtn b-in rip" data-act="save" data-tip="Enregistrer"><span class="mi">check</span></button>
        <button class="ibtn rip" data-act="cancel" data-tip="Annuler"><span class="mi">close</span></button>
      </div>`;
    }
    return `<div class="svc-row" data-i="${i}">
      <span class="sicon b"><span class="mi">apartment</span></span>
      <div class="stxt"><b>${esc(s)}</b><small>${n} membre${n > 1 ? 's' : ''}</small></div>
      <button class="ibtn rip" data-act="edit" data-tip="Renommer"><span class="mi">edit</span></button>
      <button class="ibtn dngr rip" data-act="del" data-tip="Supprimer"><span class="mi">delete</span></button>
    </div>`;
  }).join('');
  const svcBox = $('#svc-list');
  if (svcBox) {
    svcBox.onclick = svcListClick;
    svcBox.onkeydown = e => { if (e.key === 'Enter' && e.target && e.target.id === 'svc-edit-in') { e.preventDefault(); svcCommitEdit() } };
  }
}
function svcListClick(e) {
  const row = e.target.closest('.svc-row'); if (!row) return;
  const act = e.target.closest('[data-act]'); if (!act) return;
  const i = +row.dataset.i;
  if (act.dataset.act === 'edit') { svcEditId = i; renderServices(); setTimeout(() => { const x = $('#svc-edit-in'); if (x) { x.focus(); x.select() } }, 60) }
  else if (act.dataset.act === 'cancel') { svcEditId = null; renderServices() }
  else if (act.dataset.act === 'save') svcCommitEdit();
  else if (act.dataset.act === 'del') svcDelete(i);
}
function svcCommitEdit() {
  const v = ($('#svc-edit-in') ? $('#svc-edit-in').value : '').trim();
  const list = state.settings.services || [];
  const old = svcEditId !== null ? list[svcEditId] : '';
  svcEditId = null;
  if (!v) { renderServices(); return }
  if (old && v === old) { renderServices(); return }
  if (list.includes(v)) { toast('Ce service existe déjà', 'error', 'err'); beep('error'); renderServices(); return }
  if (old) {
    list[list.indexOf(old)] = v;
    state.users.forEach(u => { if ((u.dept || '') === old) u.dept = v });
    toast(`Service renommé « ${old} » → « ${v} »`, 'drive_file_rename_outline', 'ok');
  }
  save(); beep('success');
  renderServices();
  if (tab === 'users') renderUsers();
}
function svcAdd(name) {
  const v = (name || '').trim(); if (!v) return;
  const list = state.settings.services || [];
  if (list.includes(v)) { toast('Ce service existe déjà', 'error', 'err'); beep('error'); return }
  list.push(v); save(); beep('success'); celebrate();
  toast(`Service « ${v} » ajouté`, 'apartment', 'ok');
  renderServices();
  if (tab === 'users') renderUsers();
}
function svcDelete(i) {
  const list = state.settings.services || [];
  const s = list[i]; if (!s) return;
  const n = state.users.filter(u => (u.dept || '') === s).length;
  confirmDialog({
    icon: 'apartment', title: `Supprimer « ${s} » ?`,
    msg: n ? `Le service sera retiré de la liste et <b>${n} membre(s)</b> se verront sans service (à réaffecter dans leur profil).` : 'Ce service sera simplement retiré de la liste.',
    ok: 'Supprimer', danger: true,
    onOk: () => {
      list.splice(i, 1);
      state.users.forEach(u => { if ((u.dept || '') === s) u.dept = '' });
      save(); beep('error');
      toast(`Service « ${s} » supprimé`, 'delete', 'err');
      renderServices();
      if (tab === 'users') renderUsers();
    }
  });
}
$('#btn-services').onclick = () => { svcEditId = null; openSheet($('#sheet-services')); renderServices(); setTimeout(() => { const n = $('#svc-new'); if (n) n.focus() }, 350) };
$('#svc-add-btn').onclick = () => { const n = $('#svc-new'); svcAdd(n ? n.value : ''); if (n) { n.value = ''; n.focus() } };
$('#svc-new').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#svc-add-btn').click() } });
/* Les clics sur les lignes sont reliés dans renderServices() (contenu régénéré à chaque action). */

