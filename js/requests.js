/* =====================================================================
   SANITECH — requests.js
   Demandes d'absence : création, approbation, refus.
   ===================================================================== */
/* ================= DEMANDES ================= */
function renderReqs() {
  const pend = state.requests.filter(r => r.status === 'pending').length;
  $('#rcount').textContent = pend ? `${pend} en attente` : 'Aucune demande en attente';
  const bd = $('#reqbadge'); bd.style.display = pend > 0 ? 'block' : 'none'; bd.textContent = pend;
  const bd2 = $('#reqbadge2'); if (bd2) { bd2.style.display = pend > 0 ? 'block' : 'none'; bd2.textContent = pend; }
  const el = $('#rlist');
  if (!state.requests.length) {
    el.innerHTML = `<div class="empty reveal"><div class="eic"><span class="mi">event_available</span></div><h4>Aucune demande</h4><p>Créez une demande d'absence pour un utilisateur.</p><button class="btn primary sm rip" data-eact="newreq" style="margin:0 auto;display:inline-flex"><span class="mi">add</span>Nouvelle demande</button></div>`;
    return;
  }
  const list = [...state.requests].sort((a, b) => ((a.status === 'pending') ? 0 : 1) - ((b.status === 'pending') ? 0 : 1) || b.ts - a.ts);
  el.innerHTML = list.map((r, i) => {
    const u = state.users.find(x => x.id === r.userId);
    const stPill = r.status === 'pending' ? '<span class="pill warnp"><span class="mi">hourglass_top</span>En attente</span>' : r.status === 'approved' ? '<span class="pill actif"><span class="mi">check_circle</span>Approuvée</span>' : '<span class="pill susp"><span class="mi">cancel</span>Refusée</span>';
    return `<div class="rcard ${r.status === 'pending' ? 'pending' : ''} reveal" style="animation-delay:${Math.min(i * 45, 380)}ms">
      ${u ? avatarHTML(u, 44) : '<span class="avatar av-c" style="width:44px;height:44px;font-size:15px">?</span>'}
      <div class="r-meta">
        <b>${esc(r.userName)}</b>
        <div class="rtags"><span class="pill role">${esc(r.type)}</span><span class="pill out"><span class="mi">event</span>${fmtDshort(new Date(r.from + 'T12:00').getTime())} → ${fmtDshort(new Date(r.to + 'T12:00').getTime())}</span>${stPill}</div>
        ${r.reason ? `<small>« ${esc(r.reason)} »</small>` : ''}
      </div>
      <div class="r-acts">
        ${r.status === 'pending' ? `<button class="ibtn b-in rip" data-r="${r.id}" data-d="ok" data-tip="Approuver"><span class="mi">check</span></button>
        <button class="ibtn dngr rip" data-r="${r.id}" data-d="no" data-tip="Refuser"><span class="mi">close</span></button>` : ''}
        <button class="ibtn dngr rip" data-r="${r.id}" data-d="del" data-tip="Supprimer la demande"><span class="mi">delete</span></button>
      </div>
    </div>`;
  }).join('');
  $$('#rlist [data-r]').forEach(b => b.onclick = () => { if (b.dataset.d === 'del') delReq(b.dataset.r); else decideReq(b.dataset.r, b.dataset.d === 'ok') });
}
$('#rlist').addEventListener('click', e => {
  const ea = e.target.closest('[data-eact]');
  if (ea && ea.dataset.eact === 'newreq') openRequestForm();
});
function delReq(id) {
  const r = state.requests.find(x => x.id === id); if (!r) return;
  confirmDialog({
    icon: 'delete', title: 'Supprimer la demande ?', msg: `La demande de ${esc(r.userName)} (${r.type}) sera supprimée définitivement.`, ok: 'Supprimer', danger: true,
    onOk: () => { state.requests = state.requests.filter(x => x.id !== id); save(); beep('pop'); toast('Demande supprimée', 'delete', 'info'); renderReqs() }
  });
}
function decideReq(id, ok) {
  const r = state.requests.find(x => x.id === id); if (!r) return;
  r.status = ok ? 'approved' : 'rejected'; save();
  const u = state.users.find(x => x.id === r.userId);
  if (ok && u) {
    const t = Date.now(), f = new Date(r.from + 'T00:00').getTime(), e2 = new Date(r.to + 'T23:59').getTime();
    if (t >= f && t <= e2) { u.statut = 'En congé'; u.presence = 'out'; save(); renderUsers(); updateStack() }
  }
  addNotif(ok ? 'event_available' : 'event_busy', `Demande ${ok ? 'approuvée' : 'refusée'}`, `${r.type} de ${r.userName} (${fmtDshort(new Date(r.from + 'T12:00').getTime())} → ${fmtDshort(new Date(r.to + 'T12:00').getTime())}).`);
  beep(ok ? 'success' : 'error'); if (ok) celebrate();
  toast(`Demande ${ok ? 'approuvée' : 'refusée'}`, ok ? 'check_circle' : 'cancel', ok ? 'ok' : 'err');
  renderReqs();
}
function openRequestForm(userId) {
  const act = state.users.filter(u => !u.archived);
  if (!act.length) { toast('Aucun utilisateur actif', 'error', 'err'); return }
  $('#rq-user').innerHTML = act.map(u => `<option value="${u.id}" ${u.id === userId ? 'selected' : ''}>${esc(u.prenom)} ${esc(u.nom)} (${u.uid})</option>`).join('');
  const t = new Date().toISOString().slice(0, 10);
  $('#rq-from').value = t; $('#rq-to').value = t; $('#rq-reason').value = ''; $('#rq-type').value = 'Congé';
  setErr('rq-err', false);
  $$('#sheet-request .field').forEach(f => f.classList.remove('err'));
  closeSheet(true); openSheet($('#sheet-request'));
}
$('#sheet-request').addEventListener('submit', e => {
  e.preventDefault();
  const uidv = $('#rq-user').value, f = $('#rq-from').value, t = $('#rq-to').value, reason = $('#rq-reason').value.trim();
  const u = state.users.find(x => x.id === uidv);
  let bad = false;
  fieldErr($('#rq-user'), !u); bad = bad || !u;
  fieldErr($('#rq-from'), !f); bad = bad || !f;
  fieldErr($('#rq-to'), !t || (f && f > t)); bad = bad || !t || (f && f > t);
  fieldErr($('#rq-reason'), !reason); bad = bad || !reason;
  if (bad) { setErr('rq-err', true, 'Vérifiez les champs : utilisateur, dates (du ≤ au) et motif requis.'); beep('error'); return }
  state.requests.push({ id: uid(), userId: u.id, userName: u.prenom + ' ' + u.nom, type: $('#rq-type').value, from: f, to: t, reason, status: 'pending', ts: Date.now() });
  save(); beep('success'); toast('Demande soumise', 'event_note', 'ok');
  addNotif('event_note', 'Nouvelle demande d\u2019absence', `${u.prenom} ${u.nom} — ${$('#rq-type').value}.`);
  closeSheet(); renderReqs();
  if (tab !== 'reqs') setTab('reqs');
});

