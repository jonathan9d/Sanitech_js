/* =====================================================================
   SANITECH — users.js
   Liste des utilisateurs, formulaire, profil à onglets, corbeille.
   ===================================================================== */
/* ================= UTILISATEURS ================= */
let uFilter = 'all', uSearch = '', uService = 'all', detailId = null, detailTab = 'info', trashSel = new Set();
/* Liste des services connus : paramétrés + valeurs existantes sur les membres */
function svcList() {
  const s = [...(state.settings.services || [])];
  state.users.forEach(u => { const d = (u.dept || '').trim(); if (d && !s.includes(d)) s.push(d) });
  return s;
}
function fillSvcFilter() {
  const el = $('#ufilter-svc'); if (!el) return;
  const sel = uService === 'all' || !svcList().includes(uService) ? 'all' : uService;
  el.innerHTML = '<option value="all">Tous les services</option>' + svcList().map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  el.value = sel;
}
function fillSvcForm(current) {
  const el = $('#uf-dept'); if (!el) return;
  const svcs = svcList();
  const keep = current && !svcs.includes(current) ? [current] : [];
  el.innerHTML = '<option value="">—</option>' + keep.concat(svcs).map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  el.value = current || '';
}
function visibleUsers() {
  const q = norm(uSearch);
  return state.users.filter(u => {
    if (uFilter === 'in' && (u.archived || u.presence !== 'in')) return false;
    if (uFilter === 'out' && (u.archived || u.presence !== 'out')) return false;
    if (uFilter === 'arch' && !u.archived) return false;
    if (uFilter === 'all' && u.archived) return false;
    if (uFilter !== 'trash' && uService !== 'all' && (u.dept || '') !== uService) return false;
    if (q && !(norm(u.prenom).includes(q) || norm(u.nom).includes(q))) return false;
    return true;
  }).sort((a, b) => a.prenom.localeCompare(b.prenom, 'fr'));
}
function lateToday(u) { return state.logs.some(l => l.userId === u.id && l.type === 'in' && l.late && dayKey(l.ts) === dayKey(Date.now())) }
function renderUsers() {
  const el = $('#ulist');
  fillSvcFilter();
  const sf = $('#svc-filter'); if (sf) sf.style.display = uFilter === 'trash' ? 'none' : '';
  el.classList.toggle('gridview', state.settings.uview === 'grid' && uFilter !== 'trash');
  if (uFilter === 'trash') {
    trashSel = new Set();
    $('#ucount').textContent = `Corbeille · ${state.trash.length} élément(s) · purge après 30 j`;
    $('#fab').classList.add('hidden');
    if (!state.trash.length) { el.innerHTML = `<div class="empty reveal"><div class="eic"><span class="mi">delete_outline</span></div><h4>Corbeille vide</h4><p>Les utilisateurs supprimés apparaîtront ici pendant 30 jours.</p></div>`; return }
    el.innerHTML =`<div class="trashbar">
      <label class="tchk-all"><span class="tchk"><input type="checkbox" id="t-all"><i></i></span>Tout sélectionner</label>
      <div class="tbulk">
        <button class="btn soft-green sm rip" id="t-restore-all" disabled><span class="mi">restore_from_trash</span>Restaurer</button>
        <button class="btn soft-danger sm rip" id="t-purg-all" disabled><span class="mi">delete_forever</span>Supprimer</button>
      </div>
    </div>`+ state.trash.map((t, i) => `<article class="ucard arch reveal" data-t="${i}" style="animation-delay:${Math.min(i * 45, 380)}ms;cursor:default">
      <label class="tchk"><input type="checkbox" data-t="${i}" data-act="tcheck"><i></i></label>
      ${avatarHTML(t.u, 48)}
      <div class="u-meta"><h4>${esc(t.u.prenom)} ${esc(t.u.nom)}</h4><p><span class="mi">delete</span>Supprimé le ${fmtDshort(t.at)} · ${t.logs.length} mouvement(s)${t.requests && t.requests.length ? ` · ${t.requests.length} demande(s)` : ''} conservés</p></div>
      <div class="u-acts">
        <button class="ibtn b-in rip" data-t="${i}" data-act="restore" data-tip="Restaurer"><span class="mi">restore_from_trash</span></button>
        <button class="ibtn dngr rip" data-t="${i}" data-act="purg" data-tip="Supprimer définitivement"><span class="mi">delete_forever</span></button>
      </div></article>`).join('');
    const selUI = () => {
      const all = $('#t-all'); if (all) all.checked = trashSel.size === state.trash.length && state.trash.length > 0;
      const rb = $('#t-restore-all'), pb = $('#t-purg-all');
      if (rb) rb.disabled = trashSel.size === 0; if (pb) pb.disabled = trashSel.size === 0;
      $$('#ulist .ucard[data-t]').forEach(c => c.classList.toggle('sel', trashSel.has(+c.dataset.t)));
    };
    const ra = $('#t-restore-all'), pa = $('#t-purg-all');
    if (ra) ra.onclick = () => {
      const items = state.trash.filter((t2, i) => trashSel.has(i));
      items.forEach(t2 => { if (!state.users.some(x => x.id === t2.u.id)) state.users.push(t2.u); if (t2.logs && t2.logs.length) state.logs.push(...t2.logs); if (t2.requests && t2.requests.length) state.requests.push(...t2.requests) });
      state.logs.sort((a, b) => a.ts - b.ts);
      state.trash = state.trash.filter((t2, i) => !trashSel.has(i));
      trashSel = new Set(); save(); beep('success'); celebrate();
      toast(items.length + ' utilisateur(s) restauré(s)', 'restore_from_trash', 'ok');
      renderUsers(); updateStack(); refreshTrashCount();
    };
    if (pa) pa.onclick = () => confirmDialog({
      icon: 'delete_forever', title: 'Supprimer définitivement ?', msg: trashSel.size + ' élément(s) et leur historique seront effacés pour toujours.', ok: 'Supprimer', danger: true,
      onOk: () => { const n = trashSel.size; state.trash = state.trash.filter((t2, i) => !trashSel.has(i)); trashSel = new Set(); save(); beep('error'); toast(n + ' élément(s) supprimé(s) définitivement', 'delete_forever', 'err'); renderUsers(); refreshTrashCount() }
    });
    selUI();
    return;
  }
  $('#fab').classList.toggle('hidden', !(tab === 'users' || tab === 'reqs'));
  const list = visibleUsers();
  const act = state.users.filter(u => !u.archived).length;
  const pres = state.users.filter(u => !u.archived && u.presence === 'in').length;
  $('#ucount').textContent = `${act} membres · ${pres} présents`;
  if (!list.length) {
    const titles = { all: 'Aucun utilisateur trouvé', in: 'Aucun utilisateur présent', out: 'Aucun utilisateur sorti', arch: 'Aucun utilisateur archivé' };
    const subs = { all: 'La liste est vide.', in: 'Personne n\u2019est présent actuellement.', out: 'Tout le monde est présent.', arch: 'Aucun utilisateur archivé pour le moment.' };
    const icon = uFilter === 'arch' ? 'archive' : uFilter === 'in' ? 'location_on' : uFilter === 'out' ? 'directions_walk' : 'person_search';
    el.innerHTML = `<div class="empty reveal"><div class="eic"><span class="mi">${icon}</span></div><h4>${titles[uFilter] || 'Aucun utilisateur trouvé'}</h4><p>${uSearch ? 'Essayez un autre nom ou prénom.' : (subs[uFilter] || 'La liste est vide.')}</p></div>`;
    return;
  }
  const thr = state.settings.otThreshold * 3600e3;
  /* En recherche : mise à jour subtile, sans animation de révélation */
  const anim = uSearch ? '' : ' reveal';
  el.innerHTML = list.map((u, i) => {
    const ht = hoursFor(u, dayStartTs(), Date.now());
    const mx = Math.max(thr, ht) || 1;
    const pct = Math.min(100, ht / mx * 100), mk = Math.min(97, thr / mx * 100);
    const pres = u.presence === 'in';
    const ext = [];
    if (u.tel) ext.push(`<span class="mi">call</span>${esc(u.tel)}`);
    if (u.adresse) ext.push(`<span class="mi">location_on</span>${esc(u.adresse)}`);
    return `<article class="ucard ${u.archived ? 'arch' : ''}${anim}" style="${anim ? 'animation-delay:' + Math.min(i * 45, 380) + 'ms' : ''}" data-id="${u.id}">
      ${avatarHTML(u, 50)}
      <div class="u-meta">
        <div class="u-top">
          <h4>${esc(u.prenom)} ${esc(u.nom)}${lateToday(u) ? '<span class="mi" style="color:var(--warn);font-size:14px;vertical-align:-2px" title="Retard aujourd\u2019hui">warning</span>' : ''}</h4>
          <span class="pill ${u.archived ? 'out' : pres ? 'in' : 'out'}">
            ${u.archived ? '<span class="mi">archive</span>Archivé' : pres ? '<i class="dot"></i>Présent' : 'Sortie'}
          </span>
        </div>
        <p class="u-tags"><span class="mi">badge</span>${esc(u.uid)}&nbsp;·&nbsp;${esc(u.role)}${u.dept ? '&nbsp;·&nbsp;' + esc(u.dept) : ''}</p>
        ${ext.length ? `<p class="u-ext">${ext.join('<span class="sep">·</span>')}</p>` : ''}
        ${u.archived ? '' : `<div class="u-hours"><div class="ubar" data-tip="Heures aujourd'hui (repère : seuil HS)"><i style="width:${pct}%"></i><em style="left:${mk}%"></em></div><span>${fmtDur(ht)}</span></div>`}
      </div>
      <div class="u-acts">
        ${u.archived ? '' : `<button class="ibtn rip ${pres ? 'b-out' : 'b-in'}" data-act="toggle" data-tip="${pres ? 'Marquer la sortie' : 'Marquer l\u2019entrée'}"><span class="mi">${pres ? 'logout' : 'login'}</span></button>`}
        <button class="ibtn rip" data-act="menu" data-tip="Plus d'actions"><span class="mi">more_vert</span></button>
      </div>
    </article>`;
  }).join('');
}
/* --- Menu d'actions utilisateur (type vraie app) --- */
let actUser = null;
function openUserActions(u) {
  actUser = u;
  const pres = u.presence === 'in';
  const items = [
    { ic: 'person', lbl: 'Voir le profil', act: 'detail' },
    { ic: 'qr_code', lbl: 'Badge QR', act: 'qr' },
    { ic: 'edit', lbl: 'Modifier les informations', act: 'edit' }
  ];
  /* Les utilisateurs archivés ne peuvent plus pointer entrée / sortie */
  if (!u.archived) items.push({ ic: pres ? 'logout' : 'login', lbl: pres ? 'Marquer la sortie' : 'Marquer l\u2019entrée', act: 'toggle', cls: pres ? 'warn' : 'good' });
  items.push({ ic: 'content_copy', lbl: 'Dupliquer l\u2019utilisateur', act: 'dup' });
  if (!u.archived) items.push({ ic: 'archive', lbl: 'Archiver', act: 'arch' });
  items.push({ ic: 'delete', lbl: 'Mettre à la corbeille', act: 'del', cls: 'danger' });
  $('#act-list').innerHTML = items.map(it => `<button class="act-item rip ${it.cls || ''}" data-act="${it.act}"><span class="mi">${it.ic}</span>${it.lbl}</button>`).join('');
  $$('#act-list .act-item').forEach(b => b.onclick = () => closeSheet(true));
  openSheet($('#sheet-actions'));
}
$('#act-list').addEventListener('click', e => {
  const b = e.target.closest('.act-item'); if (!b || !actUser) return;
  const u = actUser; actUser = null;
  const a = b.dataset.act;
  if (a === 'detail') openDetail(u.id);
  else if (a === 'qr') openQR(u);
  else if (a === 'edit') openUserForm(u.id);
  else if (a === 'toggle') togglePresence(u.id);
  else if (a === 'dup') duplicateUser(u);
  else if (a === 'arch') confirmDialog({
    icon: 'archive', title: `Archiver ${u.prenom} ${u.nom} ?`,
    msg: 'Le membre sera <b>désactivé</b> : plus aucun pointage entrée/sortie possible. Vous pourrez le restaurer à tout moment depuis son profil ou la liste des utilisateurs archivés.',
    ok: 'Archiver', danger: false,
    onOk: () => archiveUser(u)
  });
  else if (a === 'del') confirmDialog({
    icon: 'delete', title: `Supprimer ${u.prenom} ${u.nom} ?`,
    msg: 'L\u2019utilisateur sera déplacé dans la <b>corbeille</b> avec son historique. Restaurable pendant 30 jours.', ok: 'Supprimer',
    onOk: () => deleteUser(u)
  });
});
function duplicateUser(u) {
  const nu = { ...u, id: uid(), uid: 'SAN-' + (state.seq++), prenom: u.prenom + ' (copie)', nom: u.nom, email: u.email, photo: null, lastMove: null, createdAt: Date.now(), presence: 'out', archived: false };
  state.users.push(nu); save(); beep('success'); celebrate();
  toast(`${nu.prenom} ${nu.nom} créé`, 'content_copy', 'ok'); renderUsers(); updateStack();
}
/* Archivage : désactive le pointage, conserve l'historique, restauration possible */
function archiveUser(u) {
  if (u.presence === 'in') finishPunch(u.id, 'out', 'auto', null, { silent: true });
  u.archived = true; save(); beep('pop');
  toast(`${u.prenom} ${u.nom} archivé(e)`, 'archive', 'info');
  closeSheet();
  if (detailId === u.id) detailId = null;
  renderUsers(); updateStack();
  if (tab === 'logs') renderLogsView();
  if (tab === 'reqs') renderReqs();
  if (tab === 'stats') renderStats();
}
/* Suppression propre : déplace utilisateur + logs + demandes vers la corbeille */
function deleteUser(u) {
  if (state.trash.some(x => x.u.id === u.id)) { closeSheet(); renderUsers(); return }
  const logs = state.logs.filter(l => l.userId === u.id);
  const reqs = state.requests.filter(r => r.userId === u.id);
  state.logs = state.logs.filter(l => l.userId !== u.id);
  state.requests = state.requests.filter(r => r.userId !== u.id);
  state.users = state.users.filter(x => x.id !== u.id);
  state.trash.push({ id: uid(), u, logs, requests: reqs, at: Date.now() }); save();
  beep('pop'); toast('Déplacé vers la corbeille', 'delete', 'info');
  addNotif('delete', 'Utilisateur supprimé', `${u.prenom} ${u.nom} a été déplacé dans la corbeille avec son historique.`);
  closeSheet(); renderUsers(); updateStack(); refreshTrashCount();
  if (tab === 'logs') renderLogsView();
  if (tab === 'reqs') renderReqs();
  if (tab === 'stats') renderStats();
}
$('#ulist').addEventListener('change', e => {
  if (e.target.id === 't-all') {
    trashSel = e.target.checked ? new Set(state.trash.map((_, i) => i)) : new Set();
    $$('#ulist .tchk input[data-act="tcheck"]').forEach(cb => cb.checked = e.target.checked);
  } else {
    const c = e.target.closest('[data-act="tcheck"]'); if (!c) return;
    const i = +c.dataset.t;
    if (c.checked) trashSel.add(i); else trashSel.delete(i);
  }
  const all = $('#t-all'); if (all) all.checked = trashSel.size === state.trash.length && state.trash.length > 0;
  const rb = $('#t-restore-all'), pb = $('#t-purg-all');
  if (rb) rb.disabled = trashSel.size === 0; if (pb) pb.disabled = trashSel.size === 0;
  $$('#ulist .ucard[data-t]').forEach(card => card.classList.toggle('sel', trashSel.has(+card.dataset.t)));
  beep('tap');
});
$('#ulist').addEventListener('click', e => {
  const ea = e.target.closest('[data-eact]');
  if (ea && ea.dataset.eact === 'add') { openUserForm(); return }
  const tbtn = e.target.closest('[data-act]');
  if (tbtn && tbtn.dataset.act === 'restore') {
    const i = +tbtn.dataset.t, t = state.trash[i]; if (!t) return;
    if (!state.users.some(x => x.id === t.u.id)) state.users.push(t.u);
    if (t.logs && t.logs.length) state.logs.push(...t.logs);
    if (t.requests && t.requests.length) state.requests.push(...t.requests);
    state.logs.sort((a, b) => a.ts - b.ts);
    state.trash.splice(i, 1); save(); beep('success'); celebrate();
    toast(`${t.u.prenom} ${t.u.nom} restauré`, 'restore_from_trash', 'ok'); renderUsers(); updateStack(); refreshTrashCount();
    if (tab === 'logs') renderLogsView(); if (tab === 'reqs') renderReqs(); if (tab === 'stats') renderStats();
    return;
  }
  if (tbtn && tbtn.dataset.act === 'purg') {
    const i = +tbtn.dataset.t, t = state.trash[i]; if (!t) return;
    confirmDialog({
      icon: 'delete_forever', title: 'Supprimer définitivement ?', msg: `${esc(t.u.prenom)} ${esc(t.u.nom)} et ses ${t.logs.length} mouvement(s) seront effacés pour toujours.`, ok: 'Supprimer',
      onOk: () => { state.trash.splice(i, 1); save(); beep('error'); toast('Suppression définitive', 'delete_forever', 'err'); renderUsers(); updateStack(); refreshTrashCount() }
    });
    return;
  }
  const card = e.target.closest('.ucard'); if (!card || !card.dataset.id) return;
  const u = state.users.find(x => x.id === card.dataset.id); if (!u) return;
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act === 'toggle') { e.stopPropagation(); togglePresence(u.id); return }
  if (act && act.dataset.act === 'qr') { e.stopPropagation(); openQR(u); return }
  if (act && act.dataset.act === 'menu') { e.stopPropagation(); openUserActions(u); return }
  openDetail(u.id);
});
$('#uchips').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  uFilter = c.dataset.f; $$('#uchips .chip').forEach(x => x.classList.toggle('active', x === c));
  beep('tap'); skelList('#ulist', renderUsers);
});
$('#ufilter-svc').addEventListener('change', e => {
  uService = e.target.value;
  beep('tap'); renderUsers();
  toast(uService === 'all' ? 'Filtre service : tous' : 'Filtre service : ' + uService, 'apartment', 'info');
});
let st1; $('#usearch').addEventListener('input', e => {
  clearTimeout(st1); $('#sbar').classList.toggle('has', !!e.target.value);
  st1 = setTimeout(() => { uSearch = e.target.value; renderUsers() }, 120);
});
$('#sbar').addEventListener('click', e => { if (e.target.closest('.clr')) return; setTimeout(() => $('#usearch').focus(), 60); beep('tap') });
$('#uclear').onclick = () => { $('#usearch').value = ''; uSearch = ''; $('#sbar').classList.remove('has'); renderUsers(); $('#usearch').focus(); beep('tap') };
$('#btn-uview').onclick = () => {
  state.settings.uview = state.settings.uview === 'list' ? 'grid' : 'list'; save();
  $('#uview-ic').textContent = state.settings.uview === 'list' ? 'grid_view' : 'view_list';
  beep('tap'); renderUsers();
};
/* Pile d'avatars présents */
function updateStack() {
  const pres = state.users.filter(u => !u.archived && u.presence === 'in');
  const sp = $('#snav-pres');
  if (sp) sp.innerHTML = `<span class="dot"></span><span>${pres.length} présent(s) maintenant</span>`;
}
function refreshTrashCount() { const tc = $('#trashcount'); if (tc) tc.textContent = state.trash.length }

/* --- formulaire utilisateur --- */
let editingId = null, ufPhoto = null;
function drawUfAvatar(u) {
  const el = $('#uf-avatar');
  if (ufPhoto) { el.className = 'avatar'; el.innerHTML = `<img src="${ufPhoto}" alt="">` }
  else if (u && u.prenom) { el.className = 'avatar av-c'; el.textContent = initials(u) }
  else { el.className = 'avatar av-c'; el.innerHTML = '<span class="mi ph-ic">photo_camera</span>' }
}
$('#uf-pick').onclick = () => $('#uf-file').click();
$('#uf-file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const S = 192, c = document.createElement('canvas'); c.width = S; c.height = S;
      const m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
      ufPhoto = c.toDataURL('image/jpeg', .82);
      drawUfAvatar({ prenom: $('#uf-prenom').value || 'U' }); beep('pop');
      toast('Photo ajoutée depuis la galerie', 'photo_library', 'ok');
    };
    img.src = ev.target.result;
  };
  rd.readAsDataURL(f); e.target.value = '';
});
$('#uf-delphoto').onclick = () => { ufPhoto = null; drawUfAvatar(editingId ? state.users.find(u => u.id === editingId) : null); beep('tap') };
function openUserForm(id) {
  editingId = id || null;
  const u = id ? state.users.find(x => x.id === id) : null;
  $('#uf-title').textContent = u ? 'Modifier l\u2019utilisateur' : 'Nouvel utilisateur';
  $('#uf-prenom').value = u ? u.prenom : ''; $('#uf-nom').value = u ? u.nom : '';
  $('#uf-email').value = u ? u.email : ''; $('#uf-tel').value = u ? u.tel || '' : '';
  $('#uf-naissance').value = u ? u.naissance || '' : ''; fillSvcForm(u ? (u.dept || '') : '');
  $('#uf-role').value = u ? u.role : 'Agent'; $('#uf-statut').value = u ? u.statut : 'Actif';
  $('#uf-adresse').value = u ? u.adresse || '' : '';
  /* ID : modifiable, pré-rempli avec la valeur actuelle (ou le prochain automatique) */
  $('#uf-uid').value = u ? u.uid : 'SAN-' + state.seq;
  ufPhoto = u ? u.photo || null : null;
  drawUfAvatar(u || {});
  $$('#sheet-userform .field').forEach(f => f.classList.remove('err'));
  openSheet($('#sheet-userform'));
}
$('#sheet-userform').addEventListener('submit', e => {
  e.preventDefault();
  const pre = $('#uf-prenom').value.trim(), nom = $('#uf-nom').value.trim(), mail = $('#uf-email').value.trim();
  let bad = false;
  fieldErr($('#uf-prenom'), !pre); bad = bad || !pre;
  fieldErr($('#uf-nom'), !nom); bad = bad || !nom;
  const okM = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail); fieldErr($('#uf-email'), !okM); bad = bad || !okM;
  /* ID : non vide + unique (sauf pour l'utilisateur en cours d'édition) */
  const uidv = $('#uf-uid').value.trim();
  fieldErr($('#uf-uid'), !uidv); bad = bad || !uidv;
  if (uidv && state.users.some(x => x.uid === uidv && x.id !== editingId)) { fieldErr($('#uf-uid'), true); bad = true }
  if (bad) { beep('error'); return }
  const data = { prenom: pre, nom: nom, email: mail, tel: $('#uf-tel').value.trim(), naissance: $('#uf-naissance').value, dept: $('#uf-dept').value.trim(), role: $('#uf-role').value, statut: $('#uf-statut').value, adresse: $('#uf-adresse').value.trim(), photo: ufPhoto };
  if (editingId) { Object.assign(state.users.find(u => u.id === editingId), data, { uid: uidv }); toast('Utilisateur mis à jour', 'save', 'ok') }
  else { state.users.push({ id: uid(), uid: uidv, presence: 'out', archived: false, lastMove: null, createdAt: Date.now(), ...data }); toast('Utilisateur créé', 'person_add', 'ok') }
  /* L'ID est modifiable : on avance le compteur automatique pour éviter les doublons */
  const m = uidv.match(/^(?:SAN-)?(\d+)$/);
  if (m) state.seq = Math.max(state.seq, +m[1] + 1);
  save(); beep('success'); celebrate(); closeSheet(); renderUsers(); updateStack();
});
$('#fab').onclick = () => { if (tab === 'users') openUserForm(); else if (tab === 'reqs') openRequestForm() };

/* --- profil à onglets --- */
function statutPill(s) { return s === 'Actif' ? 'actif' : s === 'En congé' ? 'conge' : 'susp' }
function logMini(l, withPhoto) {
  const u = state.users.find(x => x.id === l.userId);
  return `<div class="lcard ${l.type}" data-log="${l.id}">
    ${u ? avatarHTML(u, 38) : `<span class="avatar av-c" style="width:38px;height:38px;font-size:13px">${esc((l.name || '?').split(' ').map(w => w[0]).join(''))}</span>`}
    <div class="l-meta"><b>${esc(l.name)}</b><span>${u ? u.uid : ''}${u && u.dept ? ' · ' + esc(u.dept) : ''}</span></div>
    ${withPhoto && l.photo ? `<img class="l-photo" src="${l.photo}" alt="selfie" data-phsrc="${l.photo}">` : ''}
    <div class="l-time"><b>${fmtTime(l.ts)}</b><br>
      <span class="tag ${l.late ? 'warn' : ''}"><span class="mi">${l.late ? 'warning' : typeIcon(l.type)}</span>${l.late ? 'Retard' : (l.type === 'in' ? 'Entrée' : 'Sortie')}</span>
      ${l.source && l.source !== 'manual' && l.source !== 'seed' ? `<span class="src">${l.source === 'auto' ? 'Auto' : 'Badge'}</span>` : ''}
    </div>
    <button class="l-edit rip" data-logedit="${l.id}" data-tip="Corriger ce pointage"><span class="mi">more_vert</span></button>
  </div>`;
}
function openDetail(id, keep) {
  const u = state.users.find(x => x.id === id); if (!u) return;
  detailId = id;
  const thr = state.settings.otThreshold * 3600e3;
  const hT = hoursFor(u, dayStartTs(), Date.now()), h7 = hoursFor(u, Date.now() - 7 * 864e5, Date.now()), h30 = hoursFor(u, Date.now() - 30 * 864e5, Date.now());
  const otT = Math.max(0, hT - thr), ot7 = Math.max(0, h7 - thr * 7);
  const hist = [...state.logs].reverse().filter(l => l.userId === u.id).slice(0, 20);
  const histTotal = state.logs.filter(l => l.userId === u.id).length;
  const reqs = state.requests.filter(r => r.userId === id).sort((a, b) => b.ts - a.ts);
  let bars = ''; const maxH = Math.max(thr, ...Array.from({ length: 7 }, (_, i) => hoursOnDay(u, Date.now() - (6 - i) * 864e5)));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5), h = hoursOnDay(u, d.getTime());
    bars += `<div class="hb"><i data-h="${maxH ? Math.round(h / maxH * 100) : 0}"></i><small>${d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2)}${d.getDate()}</small></div>`;
  }
  const pt = t => detailTab === t ? 'on' : '';
  $('#detail-body').innerHTML =`
    ${u.archived ? '<div class="arch-banner"><span class="mi">archive</span><span>Utilisateur archivé — le pointage entrée/sortie est désactivé.</span></div>' : ''}
    <div class="dhero">
      <div class="dhero-in">
        ${avatarHTML(u, 92)}
        <div class="dmeta">
          <h3>${esc(u.prenom)} ${esc(u.nom)}</h3>
          <div class="dsub2">${esc(u.uid)} · ${esc(u.role)}${u.dept ? ' · ' + esc(u.dept) : ''}</div>
          <div class="dchips">
            ${u.archived ? '<span class="pill out"><span class="mi">archive</span>Archivé</span>' : u.presence === 'in' ? '<span class="pill in"><i class="dot"></i>Présent</span>' : '<span class="pill out">Sortie</span>'}
            <span class="pill ${statutPill(u.statut)}">${esc(u.statut)}</span>
          </div>
        </div>
      </div>
    </div>
    ${u.archived ? '' : '<div class="d-primary"><button class="btn primary block rip" id="dd-toggle"><span class="mi">' + (u.presence === 'in' ? 'logout' : 'login') + '</span>' + (u.presence === 'in' ? 'Marquer la sortie' : 'Marquer l\u2019entrée') + '</button></div>'}
    <div class="d-acts">
      ${u.archived ? '<button class="btn soft-green rip" id="dd-restore" style="grid-column:1/-1"><span class="mi">unarchive</span>Restaurer</button>' : ''}
      <button class="btn soft-blue rip" id="dd-qr"><span class="mi">qr_code</span>Badge QR</button>
      <button class="btn ghost rip" id="dd-edit"><span class="mi">edit</span>Modifier</button>
      <button class="btn ghost rip" id="dd-req"><span class="mi">event_busy</span>Absence</button>
    </div>
    ${u.archived ? '' : '<div class="d-acts two"><button class="btn ghost rip" id="dd-arch"><span class="mi">archive</span>Archiver</button><button class="btn soft-danger rip" id="dd-del"><span class="mi">delete</span>Corbeille</button></div>'}
    <div class="ptabs">
      <button class="${pt('info')}" data-pt="info"><span class="mi">person</span>Infos</button>
      <button class="${pt('hist')}" data-pt="hist"><span class="mi">history</span>Journal</button>
      <button class="${pt('abs')}" data-pt="abs"><span class="mi">event_busy</span>Absences</button>
      <button class="${pt('hours')}" data-pt="hours"><span class="mi">timer</span>Heures</button>
    </div>
    <div class="ptab ${pt('info')}" id="pt-info">
      <div class="dsub">Badge QR</div>
      <div class="dq-card">
        <canvas id="detail-qr" width="145" height="145" style="width:104px;height:104px" title="Ouvrir le badge QR"></canvas>
        <div class="dq-meta">
          <b>${esc(u.uid)}</b>
          <small>${u.archived ? 'Utilisateur archivé — pointage désactivé' : 'Badge de pointage — présentez ce QR au scanner'}</small>
          <button type="button" class="btn soft-blue sm rip" id="dd-qr-lg"><span class="mi">qr_code</span>Agrandir</button>
        </div>
      </div>
      <div class="dsub">Contact</div>
      <div class="info-grid">
        <div class="info-card"><span class="mi">mail</span><div style="min-width:0"><small>Email</small><b>${esc(u.email)}</b></div></div>
        <div class="info-card"><span class="mi">call</span><div style="min-width:0"><small>Téléphone</small><b>${esc(u.tel || '—')}</b></div></div>
      </div>
      <div class="dsub">Identité</div>
      <div class="info-grid">
        <div class="info-card"><span class="mi">badge</span><div style="min-width:0"><small>Identifiant</small><b>${esc(u.uid)}</b></div></div>
        <div class="info-card"><span class="mi">work</span><div style="min-width:0"><small>Rôle</small><b>${esc(u.role)}</b></div></div>
        <div class="info-card"><span class="mi">apartment</span><div style="min-width:0"><small>Service</small><b>${esc(u.dept || '—')}</b></div></div>
        <div class="info-card"><span class="mi">cake</span><div style="min-width:0"><small>Naissance</small><b>${u.naissance ? fmtDate(new Date(u.naissance + 'T12:00').getTime()) : '—'}</b></div></div>
        <div class="info-card full"><span class="mi">event</span><div style="min-width:0"><small>Créé le</small><b>${u.createdAt ? fmtDate(u.createdAt) : '—'}</b></div></div>
      </div>
      <div class="dsub">Localisation</div>
      <div class="info-grid">
        <div class="info-card full"><span class="mi">location_on</span><div style="min-width:0"><small>Adresse</small><b>${esc(u.adresse || '—')}</b></div></div>
      </div>
    </div>
    <div class="ptab ${pt('hist')}" id="pt-hist">
      <div class="dsub">${histTotal} mouvement(s) au total — 20 derniers</div>
      ${hist.length ? hist.map(l => logMini(l, false)).join('') : '<p style="color:var(--muted);font-weight:400;font-size:13px">Aucun mouvement enregistré.</p>'}
    </div>
    <div class="ptab ${pt('abs')}" id="pt-abs">
      <button class="btn soft-blue sm rip" id="dd-newreq" style="margin-bottom:12px"><span class="mi">add</span>Nouvelle demande</button>
      ${reqs.length ? reqs.map(r =>`<div class="lcard" style="border-left-color:var(--warn)">
        <span class="mi" style="color:var(--warn);font-size:20px">event_busy</span>
        <div class="l-meta"><b>${esc(r.type)}</b><span>${fmtDshort(new Date(r.from + 'T12:00').getTime())} → ${fmtDshort(new Date(r.to + 'T12:00').getTime())}</span></div>
        <span class="pill ${r.status === 'pending' ? 'warnp' : r.status === 'approved' ? 'actif' : 'susp'}">${r.status === 'pending' ? 'En attente' : r.status === 'approved' ? 'Approuvée' : 'Refusée'}</span>
      </div>`).join('') : '<p style="color:var(--muted);font-weight:400;font-size:13px">Aucune demande pour cet utilisateur.</p>'}
    </div>
    <div class="ptab ${pt('hours')}" id="pt-hours">
      <div class="hstats">
        <div class="hstat"><b>${fmtDur(hT)}</b><small>Aujourd'hui</small></div>
        <div class="hstat"><b>${fmtDur(h7)}</b><small>7 jours</small></div>
        <div class="hstat"><b>${fmtDur(h30)}</b><small>30 jours</small></div>
      </div>
      ${otT > 0 ? `<div class="pill warnp" style="margin-bottom:10px"><span class="mi">more_time</span>+${fmtDur(otT)} heures supp aujourd'hui</div>` : ''}
      ${ot7 > 0 ? `<div class="pill warnp" style="margin-bottom:10px"><span class="mi">more_time</span>+${fmtDur(ot7)} HS sur 7 jours</div>` : ''}
      <div class="dsub">Heures — 7 derniers jours (seuil : ${state.settings.otThreshold} h/j)</div>
      <div class="hbars">${bars}</div>
    </div>`;
  const bind = (bid, fn) => { const el = document.getElementById(bid); if (el) el.onclick = fn };
  bind('dd-toggle', () => togglePresence(u.id));
  bind('dd-restore', () => { u.archived = false; save(); beep('success'); toast(`${u.prenom} ${u.nom} restauré`, 'unarchive', 'ok'); renderUsers(); updateStack(); openDetail(u.id, true) });
  bind('dd-qr', () => openQR(u));
  bind('dd-qr-lg', () => openQR(u));
  const dqc = document.getElementById('detail-qr');
  if (dqc) { drawQR(dqc, 'SANITECH;' + u.uid, 5); dqc.onclick = () => openQR(u) }
  bind('dd-edit', () => openUserForm(u.id));
  bind('dd-req', () => openRequestForm(u.id));
  bind('dd-newreq', () => openRequestForm(u.id));
  bind('dd-arch', () => confirmDialog({
    icon: 'archive', title: `Archiver ${u.prenom} ${u.nom} ?`,
    msg: 'Le membre sera <b>désactivé</b> : plus aucun pointage entrée/sortie possible. Vous pourrez le restaurer à tout moment depuis son profil ou la liste des utilisateurs archivés.',
    ok: 'Archiver', danger: false,
    onOk: () => archiveUser(u)
  }));
  bind('dd-del', () => confirmDialog({
    icon: 'delete', title: `Supprimer ${u.prenom} ${u.nom} ?`,
    msg: 'L\u2019utilisateur sera déplacé dans la <b>corbeille</b> avec son historique. Restaurable pendant 30 jours.',
    ok: 'Supprimer',
    onOk: () => deleteUser(u)
  }));
  $$('#detail-body .ptabs button').forEach(b => b.onclick = () => {
    detailTab = b.dataset.pt;
    $$('#detail-body .ptabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('#detail-body .ptab').forEach(p => p.classList.toggle('on', p.id === 'pt-' + detailTab));
    beep('tap');
    if (detailTab === 'hours') requestAnimationFrame(() => $$('#pt-hours .hb i').forEach(b2 => b2.style.height = b2.dataset.h + '%'));
  });
  if (!keep) openSheet($('#sheet-detail'));
  if (detailTab === 'hours') requestAnimationFrame(() => $$('#pt-hours .hb i').forEach(b2 => b2.style.height = b2.dataset.h + '%'));
}

