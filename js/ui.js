/* =====================================================================
   SANITECH — ui.js
   Sons, toasts, dialogues, feuilles, thème, cloche, skeletons, infobulles.
   ===================================================================== */
/* ================= SON / TOAST / DIALOG / FX ================= */
let AC = null;
function beep(kind = 'tap') {
  if (!state.settings.sound) return;
  /* Retour haptique léger (mobile) */
  try { if (navigator.vibrate) navigator.vibrate(kind === 'error' ? 60 : (kind === 'success' ? 25 : 12)); } catch (e) { }
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination); o.type = 'sine';
    const f = { tap: 540, success: 760, error: 230, pop: 640 }[kind] || 540;
    o.frequency.setValueAtTime(f, t);
    if (kind === 'success') o.frequency.exponentialRampToValueAtTime(f * 1.35, t + .12);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.11, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    o.start(t); o.stop(t + .24);
  } catch (e) { }
}
function toast(msg, icon = 'check_circle', type = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + type;
  /* Type-based default icons */
  const defaultIcons = { ok: 'check_circle', err: 'error', warn: 'warning', info: 'info' };
  if (!icon || icon === 'check_circle') icon = defaultIcons[type] || 'check_circle';
  t.innerHTML = `<span class="mi">${icon}</span><span>${msg}</span>`;
  $('#toasts').appendChild(t);
  /* Stack management: limit visible toasts */
  const toasts = $$('#toasts .toast:not(.out)');
  if (toasts.length > 4) { toasts[0].classList.add('out'); setTimeout(() => toasts[0].remove(), 320); }
  /* Auto-dismiss */
  const duration = type === 'err' ? 4000 : type === 'warn' ? 3500 : 2700;
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350) }, duration);
  /* Manual dismiss on tap */
  t.addEventListener('click', () => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, { once: true });
}
let dlgCb = null;
function confirmDialog(o) {
  $('#d-icon').textContent = o.icon || 'warning'; $('#d-title').textContent = o.title; $('#d-msg').innerHTML = o.msg;
  $('#d-ok').textContent = o.ok || 'Confirmer'; $('#d-cancel').textContent = o.cancel || 'Annuler';
  $('#d-ok').className = 'btn rip ' + ((o.danger === false) ? 'primary' : 'danger');
  $('#d-icon-w').style.background = (o.danger === false) ? 'var(--blue-soft)' : 'var(--danger-soft)';
  $('#d-icon-w').style.color = (o.danger === false) ? 'var(--blue)' : 'var(--danger)';
  dlgCb = o.onOk; $('#dialogwrap').classList.add('on');
}
$('#d-cancel').onclick = () => $('#dialogwrap').classList.remove('on');
$('#d-ok').onclick = () => { $('#dialogwrap').classList.remove('on'); const cb = dlgCb; dlgCb = null; if (cb) cb() };
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.rip'); if (!t) return;
  const r = document.createElement('span'), rc = t.getBoundingClientRect(), d = Math.max(rc.width, rc.height) * 1.9;
  r.className = 'ripple'; r.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - rc.left - d / 2}px;top:${e.clientY - rc.top - d / 2}px`;
  t.appendChild(r); setTimeout(() => r.remove(), 560);
});
function celebrate() {
  const f = $('#successfx'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), 1250);
}


/* ================= SHEETS ================= */
let curSheet = null;
function openSheet(el) {
  closeSheet(true); curSheet = el; $('#backdrop').classList.add('on'); requestAnimationFrame(() => el.classList.add('open')); beep('pop');
  if (el.id === 'sheet-selfie') startCam();
}
function closeSheet(silent) {
  if (!curSheet) return;
  if (curSheet.id === 'sheet-selfie') stopCam();
  curSheet.classList.remove('open'); $('#backdrop').classList.remove('on'); curSheet = null;
  if (!silent) beep('tap');
}
$('#backdrop').onclick = () => closeSheet();
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeSheet()));


/* ================= THEME / ACCENT / CLOCHE / UI ================= */
function applyTheme(mode, instant) {
  const dur = instant ? 0 : 450;
  if (!instant) {
    document.documentElement.classList.add('theming');
    setTimeout(() => document.documentElement.classList.remove('theming'), dur + 50);
  }
  document.documentElement.dataset.theme = mode;
  const isDark = mode === 'dark';
  const topIc = $('#theme-ic');
  if (topIc) {
    topIc.textContent = isDark ? 'light_mode' : 'dark_mode';
    if (!instant) { topIc.classList.remove('pop'); void topIc.offsetWidth; topIc.classList.add('pop') }
  }
  const setIc = $('#set-theme-ic');
  if (setIc) {
    setIc.textContent = isDark ? 'light_mode' : 'dark_mode';
    if (!instant) { setIc.classList.remove('pop'); void setIc.offsetWidth; setIc.classList.add('pop') }
  }
  const sw = $('#sw-theme'); if (sw) sw.checked = isDark;
  if (tab === 'stats' && $('#app').classList.contains('active')) drawChart();
  /* Update theme-color meta for mobile browser chrome */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark ? '#000000' : '#0d6ef2');
}
$('#btn-theme').onclick = () => {
  const b = $('#btn-theme'); b.classList.add('spin'); setTimeout(() => b.classList.remove('spin'), 200);
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(state.settings.theme); beep('tap');
};
const ACCENTS = [['#0d6ef2', 'Océan'], ['#0aa86c', 'Émeraude'], ['#7a5cff', 'Violet'], ['#f2740d', 'Coucher'], ['#e84b8f', 'Rose']];
function buildAccents() {
  $('#accents').innerHTML = ACCENTS.map(a => `<button class="accent-dot" data-c="${a[0]}" title="${a[1]}" style="background:${a[0]}"></button>`).join('');
  $$('.accent-dot').forEach(b => b.onclick = () => { state.settings.accent = b.dataset.c; save(); applyAccent(); beep('pop'); toast('Couleur d\u2019accent : ' + b.title, 'palette', 'info') });
}
function applyAccent() {
  document.documentElement.style.setProperty('--blue', state.settings.accent || '#0d6ef2');
  $$('.accent-dot').forEach(b => b.classList.toggle('on', b.dataset.c === state.settings.accent));
}
function applyTextSize() {
  const s = state.settings.textSize || 'M';
  document.documentElement.classList.remove('ts-s', 'ts-l', 'ts-xl');
  if (s !== 'M') document.documentElement.classList.add('ts-' + s.toLowerCase());
}
function applyPattern() {
  const p = $('#pages'); p.classList.remove('pat-grid', 'pat-dots', 'pat-waves');
  const v = state.settings.pattern; if (v && v !== 'none') p.classList.add('pat-' + v);
}
function applyBell() {
  const on = state.settings.notif, b = $('#btn-bell');
  b.classList.toggle('on', on); b.classList.toggle('off', !on);
  $('#bell-ic').textContent = on ? 'notifications_active' : 'notifications_off';
  $('#sw-notif').checked = on; $('#sw-notif2').checked = on;
  updateBellBadge();
}
function updateBellBadge() {
  const un = state.notifs.filter(n => !n.read).length, bd = $('#bell-badge');
  bd.style.display = un > 0 ? 'block' : 'none'; bd.textContent = un > 9 ? '9+' : un;
}
function addNotif(icon, title, msg) {
  state.notifs.unshift({ id: uid(), icon, title, msg, ts: Date.now(), read: false });
  if (state.notifs.length > 60) state.notifs.length = 60;
  save(); updateBellBadge();
}
$('#btn-bell').onclick = () => { beep('tap'); openNotifCenter() };
function openNotifCenter() {
  const list = $('#notiflist');
  if (!state.notifs.length) { list.innerHTML = `<div class="empty"><div class="eic"><span class="mi">notifications_none</span></div><h4>Aucune notification</h4><p>Les alertes de retards, absences et automatisations apparaîtront ici.</p></div>` }
  else list.innerHTML = state.notifs.map(n => `<div class="notif-item ${n.read ? '' : 'unread'}"><span class="ni"><span class="mi">${n.icon}</span></span><div style="flex:1;min-width:0"><b>${esc(n.title)}</b><p>${esc(n.msg)}</p></div><time>${ago(n.ts)}</time></div>`).join('');
  openSheet($('#sheet-notifs'));
  setTimeout(() => { state.notifs.forEach(n => n.read = true); save(); updateBellBadge() }, 700);
}
$('#notif-clear').onclick = () => { state.notifs = []; save(); updateBellBadge(); openNotifCenter(); beep('tap'); toast('Notifications effacées', 'delete_sweep', 'info') };
$('#sw-notif').addEventListener('change', e => { state.settings.notif = e.target.checked; save(); applyBell(); beep('tap') });
$('#sw-notif2').addEventListener('change', e => { state.settings.notif = e.target.checked; save(); applyBell(); beep('tap'); toast('Notifications ' + (e.target.checked ? 'activées' : 'désactivées'), 'notifications', 'info') });
setInterval(() => { $('#tb-clock-t').textContent = new Date().toLocaleTimeString('fr-FR') }, 1000);


/* Infobulles d'aide contextuelles */
const tipEl = $('#tooltip');
document.addEventListener('pointerover', e => {
  const t = e.target.closest('[data-tip]'); if (!t) return;
  const r = t.getBoundingClientRect(), sr = $('#shell').getBoundingClientRect();
  tipEl.textContent = t.dataset.tip; tipEl.classList.add('on');
  const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  let x = r.left - sr.left + r.width / 2 - tw / 2; x = Math.max(8, Math.min(sr.width - tw - 8, x));
  let y = r.top - sr.top - th - 8; if (y < 6) y = r.bottom - sr.top + 8;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
});
document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) tipEl.classList.remove('on') });


/* ================= SKELETONS ================= */
const skRow = `<div class="sk-card"><span class="skel" style="width:48px;height:48px;border-radius:15px;flex:0 0 auto"></span><div style="flex:1"><span class="skel" style="height:13px;width:60%;display:block;margin-bottom:8px"></span><span class="skel" style="height:10px;width:40%;display:block"></span></div><span class="skel" style="width:64px;height:26px;border-radius:99px;flex:0 0 auto"></span></div>`;
function skelList(sel, fn) { const el = $(sel); if (!el) return; el.classList.remove('gridview'); el.innerHTML = skRow.repeat(4); setTimeout(fn, 430) }
function skelStats() {
  $('#kpis').innerHTML = Array(4).fill('<div class="kpi"><span class="skel" style="display:block;height:26px;width:50%;margin-bottom:8px"></span><span class="skel" style="display:block;height:10px;width:70%"></span></div>').join('');
  $('#chartskel').style.display = 'block';
  $('#mlist').innerHTML = Array(3).fill('<div style="display:flex;gap:10px;align-items:center;margin-bottom:11px"><span class="skel" style="width:30px;height:30px;border-radius:10px;flex:0 0 auto"></span><span class="skel" style="flex:1;height:9px;border-radius:99px"></span></div>').join('');
  setTimeout(() => { $('#chartskel').style.display = 'none'; renderStats(); animateChart() }, 480);
}

