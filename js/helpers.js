/* =====================================================================
   SANITECH — helpers.js
   Fonctions utilitaires + avatars.
   ===================================================================== */
/* ================= HELPERS ================= */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const rnd = n => Math.floor(Math.random() * n);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const fmtTime = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDate = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDshort = t => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
const dayStartTs = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() };
function fmtDur(ms) { const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return h + 'h' + String(m).padStart(2, '0') }
function ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 60) return 'à l\u2019instant'; if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min'; if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h'; return fmtDshort(ts) }
function typeIcon(t) { return state.settings.cb ? (t === 'in' ? 'north' : 'south') : (t === 'in' ? 'login' : 'logout') }
function seriesColors() { return state.settings.cb ? ['#2f6df6', '#e8890b'] : [cssVar('--green', '#0fc37e'), cssVar('--blue', '#0d6ef2')] }

/* ================= SYNTHÈSE VOCALE (annonce au scan) ================= */
let _synth = null, _synthVoices = [];
function synthVoices() {
  try { if (typeof speechSynthesis !== 'undefined') _synth = speechSynthesis } catch (e) { }
  return _synthVoices;
}
if (typeof speechSynthesis !== 'undefined') {
  try {
    speechSynthesis.onvoiceschanged = () => { _synthVoices = speechSynthesis.getVoices() || [] };
    _synthVoices = speechSynthesis.getVoices() || [];
  } catch (e) { }
}
/* Annonce vocale française : coupe l'annonce précédente, puis prononce le texte. */
function speak(text) {
  try {
    if (typeof speechSynthesis === 'undefined') return;
    const voices = synthVoices();
    if (!voices.length) return;             // moteur indisponible (ex. tests headless)
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const fr = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('fr'));
    if (fr) u.voice = fr;
    u.rate = 1.02; u.pitch = 1; u.volume = .95;
    u.onerror = () => { };
    speechSynthesis.speak(u);
  } catch (e) { }
}


/* ================= AVATARS ================= */
function initials(u) { return (u.prenom || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() }
function hashN(s) { let h = 0; for (let i = 0; i < s.length; i++)h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
function avatarHTML(u, s = 46, extra = '') {
  let inner, dot = '';
  if (u.photo) inner = `<img src="${u.photo}" alt="photo">`;
  else { const pal = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'][hashN((u.prenom || '') + (u.nom || '')) % 5]; extra = pal + ' ' + extra; inner = esc(initials(u)) }
  if ('presence' in u && !u.archived) dot = `<i class="avdot ${u.presence === 'in' ? 'in' : 'out'}"></i>`;
  return `<span class="avatar ${extra}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.36)}px">${inner}${dot}</span>`;
}

