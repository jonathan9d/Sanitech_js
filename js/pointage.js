/* =====================================================================
   SANITECH — pointage.js
   Pointage entrée/sortie, terminal de badge, selfie.
   ===================================================================== */
/* ================= TERMINAL DE BADGE ================= */
function openScan() {
  $('#sc-code').value = '';
  const act = state.users.filter(u => !u.archived).sort((a, b) => a.prenom.localeCompare(b.prenom, 'fr'));
  $('#sc-list').innerHTML = act.map(u => `<div class="sc-row rip" data-id="${u.id}">${avatarHTML(u, 36)}<b>${esc(u.prenom)} ${esc(u.nom)}</b><small>${u.uid}</small><span class="pill ${u.presence === 'in' ? 'in' : 'out'}">${u.presence === 'in' ? 'Présent' : 'Sortie'}</span><span class="mi" style="color:var(--muted)">qr_code</span></div>`).join('') || '<p style="color:var(--muted);font-weight:400;font-size:13px;text-align:center;padding:14px">Aucun utilisateur actif.</p>';
  $$('#sc-list .sc-row').forEach(r => r.onclick = () => { togglePresence(r.dataset.id, 'badge') });
  openSheet($('#sheet-scan'));
}
$('#btn-scan').onclick = openScan;
$('#btn-scan2').onclick = openScan;
$('#sc-go').onclick = () => {
  const v = $('#sc-code').value.trim().toUpperCase();
  const u = state.users.find(x => x.uid.toUpperCase() === v && !x.archived);
  if (!u) { toast('Badge introuvable : ' + esc(v || '?'), 'error', 'err'); beep('error'); return }
  togglePresence(u.id, 'badge');
};
$('#sc-code').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#sc-go').click() } });


/* ================= POINTAGE ================= */
let pendingPunch = null;
function isLate() {
  const [h, m] = (state.settings.lateTime || '08:30').split(':').map(Number);
  const n = new Date(); return n.getHours() > h || (n.getHours() === h && n.getMinutes() > m);
}
function togglePresence(id, source = 'manual') {
  const u = state.users.find(x => x.id === id); if (!u || u.archived) return;
  const type = u.presence === 'in' ? 'out' : 'in';
  if (state.settings.selfie && source !== 'auto') { pendingPunch = { id, type, source }; openSheet($('#sheet-selfie')); return }
  finishPunch(id, type, source, null);
}
function forcePunch(id, type, source) {
  const u = state.users.find(x => x.id === id); if (!u || u.archived) return;
  if (u.presence === type) { toast(`${u.prenom} ${u.nom} est déjà ${type === 'in' ? 'présent(e)' : 'en sortie'}`, 'info', 'info'); beep('tap'); return }
  if (state.settings.selfie && source !== 'auto') { pendingPunch = { id, type, source }; openSheet($('#sheet-selfie')); return }
  finishPunch(id, type, source, null);
}
function finishPunch(id, type, source = 'manual', photo = null, opts = {}) {
  const u = state.users.find(x => x.id === id); if (!u) return;
  const late = type === 'in' && isLate();
  u.presence = type; u.lastMove = Date.now();
  state.logs.push({ id: uid(), userId: u.id, name: u.prenom + ' ' + u.nom, type, ts: Date.now(), source, late, photo: photo || null });
  trimLogPhotos(); save();
  if (late && state.settings.lateAlert !== false) addNotif('warning_amber', `${u.prenom} ${u.nom} en retard`, `Entrée après ${state.settings.lateTime}.`);
  if (!opts.silent) {
    beep('success'); toast(`${u.prenom} ${u.nom} — ${type === 'in' ? 'entrée' : 'sortie'} enregistrée${late ? ' (retard)' : ''}`, typeIcon(type), late ? 'info' : 'ok');
    if (state.settings.voice) speak(`${u.prenom} ${u.nom}, ${type === 'in' ? 'entrée' : 'sortie'} à ${fmtTime(Date.now())}${late ? ', en retard' : ''}`);
  }
  renderUsers(); updateStack();
  if (tab === 'logs') renderLogsView();
  if (tab === 'stats') renderStats();
  if (curSheet && curSheet.id === 'sheet-detail' && detailId === id) openDetail(id, true);
}
function trimLogPhotos() {
  const withP = state.logs.filter(l => l.photo).sort((a, b) => a.ts - b.ts);
  while (withP.length > 60) { withP.shift().photo = null }
}
let camStream = null, camMirror = false, camDevices = [];
/* Liste les caméras disponibles (externe, avant, arrière…) pour laisser le choix */
async function listCameras() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const devs = await navigator.mediaDevices.enumerateDevices();
    camDevices = devs.filter(d => d.kind === 'videoinput');
    const sel = $('#cam-device'); if (!sel) return;
    sel.innerHTML = camDevices.length
      ? camDevices.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || ('Caméra ' + (i + 1))) + (i === 0 && camDevices.length > 1 ? ' (par défaut)' : '')}</option>`).join('')
      : '<option value="">Caméra par défaut</option>';
  } catch (e) { }
}
async function startCam() {
  const v = $('#cam'); if (!v) return;
  v.classList.toggle('mirrored', camMirror);
  $('#cam-msg').hidden = true;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw 0;
    await listCameras();
    const chosen = $('#cam-device') ? $('#cam-device').value : '';
    const video = { audio: false };
    if (chosen) video.deviceId = { exact: chosen };
    else video.facingMode = { ideal: 'user' };
    camStream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    v.srcObject = camStream; await v.play();
  } catch (e) { $('#cam-msg').hidden = false }
}
function stopCam() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null } const v = $('#cam'); if (v) v.srcObject = null }
$('#cam-device').addEventListener('change', () => { stopCam(); startCam(); beep('tap') });
$('#cam-flip').onclick = () => {
  camMirror = !camMirror;
  const v = $('#cam'); if (v) v.classList.toggle('mirrored', camMirror);
  beep('tap'); toast(camMirror ? 'Miroir activé (selfie)' : 'Miroir désactivé (portrait)', 'flip', 'info');
};
$('#btn-snap').onclick = () => {
  const v = $('#cam'), c = $('#snap'); let photo = null;
  if (camStream && v.videoWidth) {
    const S = 200; c.width = S; c.height = S; const x = c.getContext('2d'); const m = Math.min(v.videoWidth, v.videoHeight);
    if (camMirror) { x.translate(S, 0); x.scale(-1, 1); }
    x.drawImage(v, (v.videoWidth - m) / 2, (v.videoHeight - m) / 2, m, m, 0, 0, S, S);
    if (camMirror) x.setTransform(1, 0, 0, 1, 0, 0);
    photo = c.toDataURL('image/jpeg', .72)
  }
  const p = pendingPunch; pendingPunch = null; stopCam(); closeSheet();
  if (p) finishPunch(p.id, p.type, p.source, photo);
};
$('#btn-nosnap').onclick = () => {
  const p = pendingPunch; pendingPunch = null; stopCam(); closeSheet();
  if (p) finishPunch(p.id, p.type, p.source, null);
};
function hoursFor(u, fromTs, toTs) {
  let total = 0, lastIn = null;
  const ls = state.logs.filter(l => l.userId === u.id && l.ts >= fromTs && l.ts <= toTs).sort((a, b) => a.ts - b.ts);
  for (const l of ls) { if (l.type === 'in') lastIn = l.ts; else if (lastIn) { total += l.ts - lastIn; lastIn = null } }
  if (lastIn && u.presence === 'in') total += Math.min(toTs, Date.now()) - lastIn;
  return total;
}
function hoursOnDay(u, d) {
  const s = new Date(d); s.setHours(0, 0, 0, 0); const e2 = s.getTime() + 864e5;
  return hoursFor(u, s.getTime(), Math.min(e2, Date.now()));
}

