/* =====================================================================
   SANITECH — logs.js
   Journal des mouvements, vue « Aujourd'hui », calendrier.
   ===================================================================== */
/* ================= LOGS / AUJOURD'HUI / CALENDRIER ================= */
let lFilter = 'all', lFrom = '', lTo = '', lSearch = '', logView = 'list';
function dayLabel(k) {
  const t = new Date(); const tk = dayKey(t.getTime()); t.setDate(t.getDate() - 1);
  if (k === tk) return 'Aujourd\u2019hui';
  if (k === dayKey(t.getTime())) return 'Hier';
  return cap(new Date(k + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
}
function renderLogsView() {
  if (logView === 'list') renderLogs();
  else if (logView === 'today') renderToday();
  else renderCal();
}
$$('#logseg button').forEach(b => b.onclick = () => {
  logView = b.dataset.lv;
  $$('#logseg button').forEach(x => x.classList.toggle('on', x === b));
  $('#logview-list').style.display = logView === 'list' ? 'block' : 'none';
  $('#logview-today').style.display = logView === 'today' ? 'block' : 'none';
  $('#logview-cal').style.display = logView === 'cal' ? 'block' : 'none';
  beep('tap'); renderLogsView();
});
function renderLogs() {
  const todayK = dayKey(Date.now());
  const todayN = state.logs.filter(l => dayKey(l.ts) === todayK).length;
  $('#lcount').textContent = `${state.logs.length} mouvements · ${todayN} aujourd'hui`;
  const list = [...state.logs].reverse().filter(l => {
    if (lFilter !== 'all' && l.type !== lFilter) return false;
    const k = dayKey(l.ts);
    if (lFrom && k < lFrom) return false;
    if (lTo && k > lTo) return false;
    if (lSearch && !norm(l.name).includes(lSearch) && !fmtTime(l.ts).includes(lSearch)) return false;
    return true;
  }).slice(0, 220);
  const el = $('#llist');
  if (!list.length) { el.innerHTML = `<div class="empty reveal"><div class="eic"><span class="mi">event_busy</span></div><h4>Aucun mouvement</h4><p>Aucun résultat pour ces critères.</p></div>`; return }
  let html = '', curK = '';
  for (const l of list) {
    const k = dayKey(l.ts);
    if (k !== curK) { curK = k; html += `<div class="lday">${dayLabel(k)}</div>` }
    html += logMini(l, true);
  }
  el.innerHTML = html;
  $$('#llist .l-photo').forEach(p => p.onclick = () => { $('#imgview-img').src = p.dataset.phsrc; $('#imgview').classList.add('on'); beep('tap') });
}
$('#imgview').onclick = () => $('#imgview').classList.remove('on');
$('#lchips').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  lFilter = c.dataset.f; $$('#lchips .chip').forEach(x => x.classList.toggle('active', x === c));
  beep('tap'); renderLogs();
});
$('#lf-apply').onclick = () => {
  const fromVal = $('#lf-from').value, toVal = $('#lf-to').value;
  if (!fromVal && !toVal && (lFrom || lTo)) {
    /* Clear filter */
    lFrom = lTo = '';
    renderLogs(); beep('pop');
    toast('Filtres de dates effacés', 'filter_alt_off', 'info');
  } else {
    lFrom = fromVal; lTo = toVal;
    beep('tap'); renderLogs();
    toast(lFrom && lTo ? `Filtre appliqué : du ${lFrom} au ${lTo}` : 'Filtre de dates appliqué', 'filter_alt', 'info');
  }
};
let lst2; $('#lsearch').addEventListener('input', e => {
  clearTimeout(lst2); $('#lsbar').classList.toggle('has', !!e.target.value);
  lst2 = setTimeout(() => { lSearch = norm(e.target.value); renderLogs() }, 120);
});
$('#lsbar').addEventListener('click', e => { if (e.target.closest('.clr')) return; setTimeout(() => $('#lsearch').focus(), 60); beep('tap') });
$('#lclear').onclick = () => { $('#lsearch').value = ''; lSearch = ''; $('#lsbar').classList.remove('has'); renderLogs(); $('#lsearch').focus(); beep('tap') };
function renderToday() {
  const tk = dayKey(Date.now());
  const tlogs = state.logs.filter(l => dayKey(l.ts) === tk).sort((a, b) => b.ts - a.ts);
  const act = state.users.filter(u => !u.archived);
  const pres = act.filter(u => u.presence === 'in').length;
  const ret = tlogs.filter(l => l.type === 'in' && l.late).length;
  const hSum = act.reduce((s, u) => s + hoursFor(u, dayStartTs(), Date.now()), 0);
  const now = new Date();
  const btd = act.filter(u => { if (!u.naissance) return false; const d = new Date(u.naissance + 'T12:00'); return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() });
  const absT = state.requests.filter(r => r.status === 'approved' && r.from <= tk && r.to >= tk);
  let html =`<div class="tsum">
    <div class="ttile g"><b>${pres}</b><small>Présents</small></div>
    <div class="ttile w"><b>${ret}</b><small>Retards</small></div>
    <div class="ttile b"><b>${fmtDur(hSum)}</b><small>Heures</small></div>
  </div>`;
  if (btd.length) html += `<div class="tbanner"><span class="mi">cake</span><span>Anniversaire : ${btd.map(u => esc(u.prenom)).join(', ')}</span></div>`;
  if (absT.length) html += `<div class="tbanner"><span class="mi">event_busy</span><span>Absent(s) aujourd'hui : ${absT.map(r => esc(r.userName)).slice(0, 3).join(', ')}${absT.length > 3 ? '…' : ''}</span></div>`;
  html += `<div class="dsub">Timeline du jour — ${tlogs.length} mouvement(s)</div>`;
  html += tlogs.length ? tlogs.map(l => `<div class="titem ${l.type}">
    <div class="t-time">${fmtTime(l.ts)}</div><div class="t-dot"></div>
    <div class="t-card"><span class="tt-name">${esc(l.name)}</span>
      ${l.late ? '<span class="pill warnp"><span class="mi">warning</span>Retard</span>' : ''}
      <span class="pill ${l.type === 'in' ? 'in' : 'out'}"><span class="mi">${typeIcon(l.type)}</span>${l.type === 'in' ? 'Entrée' : 'Sortie'}</span>
    </div></div>`).join('')
    : '<div class="empty"><div class="eic"><span class="mi">event_available</span></div><h4>Journée calme</h4><p>Aucun mouvement enregistré pour l\u2019instant.</p></div>';
  $('#tlist').innerHTML = html;
}
let calCur = new Date(), calSel = dayKey(Date.now());
$('#cal-prev').onclick = () => { calCur.setMonth(calCur.getMonth() - 1); renderCal(); beep('tap') };
$('#cal-next').onclick = () => { calCur.setMonth(calCur.getMonth() + 1); renderCal(); beep('tap') };
function renderCal() {
  const y = calCur.getFullYear(), m = calCur.getMonth();
  $('#cal-label').textContent = calCur.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const first = new Date(y, m, 1); const off = (first.getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const cnt = {};
  state.logs.forEach(l => { const d = new Date(l.ts); if (d.getFullYear() === y && d.getMonth() === m) { const k = d.getDate(); cnt[k] = cnt[k] || { in: 0, out: 0 }; cnt[k][l.type]++ } });
  const todayK = dayKey(Date.now());
  const [cIn, cOut] = seriesColors();
  let html = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(w => `<div class="cal-wd">${w}</div>`).join('');
  for (let i = 0; i < off; i++)html += '<span></span>';
  for (let d = 1; d <= dim; d++) {
    const k = dayKey(new Date(y, m, d, 12).getTime());
    const c = cnt[d];
    html += `<div class="cal-cell ${k === todayK ? 'today' : ''} ${k === calSel ? 'sel' : ''}" data-k="${k}">${d}<span class="cdots">${c ? `<i style="background:${c.in ? cIn : 'transparent'}"></i><i style="background:${c.out ? cOut : 'transparent'}"></i>` : ''}</span></div>`;
  }
  $('#cal-grid').innerHTML = html;
  $$('#cal-grid .cal-cell').forEach(c => c.onclick = () => { calSel = c.dataset.k; renderCal(); beep('tap') });
  const dl = state.logs.filter(l => dayKey(l.ts) === calSel).sort((a, b) => b.ts - a.ts);
  $('#callogs').innerHTML = `<div class="dsub" style="margin-top:14px">${dayLabel(calSel)} — ${dl.length} mouvement(s)</div>` + (dl.length ? dl.map(l => logMini(l, true)).join('') : '<p style="color:var(--muted);font-weight:400;font-size:13px">Aucun mouvement ce jour.</p>');
  $$('#callogs .l-photo').forEach(p => p.onclick = () => { $('#imgview-img').src = p.dataset.phsrc; $('#imgview').classList.add('on') });
}

