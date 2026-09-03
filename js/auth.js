/* =====================================================================
   SANITECH — auth.js
   Écrans d'accueil et authentification (connexion, inscription, mot de passe oublié).
   ===================================================================== */
/* ================= ÉCRANS / SPLASH ================= */
function showScreen(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)) }
function startSplash() {
  setTimeout(() => {
    $('#splash').classList.remove('active');
    /* Si l'utilisateur s'est déjà connecté pendant le splash, ne pas relancer enterApp() */
    if ($('#app').classList.contains('active')) return;
    if (state.session) { enterApp() } else { showScreen('auth'); setGreeting() }
  }, 2300);
}
function greeting() {
  const h = new Date().getHours(), n = state.session?.user || 'Utilisateur';
  const g = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  toast(`${g}, ${n} — bienvenue sur Sanitech`, 'waving_hand', 'info');
}


/* ================= AUTH ================= */
/* Message d'accueil dynamique selon l'heure de la journée */
function greetingText() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return ['Bonjour&nbsp;!', ''];
  if (h >= 12 && h < 18) return ['Bon après-midi&nbsp;!', ''];
  if (h >= 18 && h < 23) return ['Bonsoir&nbsp;!', ''];
  return ['Bonne nuit&nbsp;!', ''];
}
function setGreeting() {
  const [g, s] = greetingText();
  const el = $('#a-hello'); if (el) el.innerHTML = g + (s ? ' <small id="a-sub">' + s + '</small>' : '');
}
function switchAuth(v) {
  $$('.authview').forEach(x => x.classList.remove('active'));
  $('#view-' + v).classList.add('active');
  const sub = $('#a-sub');
  if (v === 'login') { setGreeting(); if (sub) sub.textContent = ''; }
  else if (sub) sub.textContent = v === 'register' ? 'Créez votre compte pour commencer.' : v === 'forgot' ? 'Réinitialisez votre mot de passe en 2 étapes.' : '';
  beep('tap');
}
function bindEye(btn, input) { $(btn).addEventListener('click', () => { const i = $(input); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; $(btn).textContent = show ? 'visibility_off' : 'visibility'; $(btn).classList.remove('pop'); void $(btn).offsetWidth; $(btn).classList.add('pop'); beep('tap') }) }
['#li-eye|#li-pass', '#rg-eye|#rg-pass', '#rg-eye2|#rg-pass2', '#fg-eye|#fg-new', '#cp-eye1|#cp-cur', '#cp-eye2|#cp-new', '#cp-eye3|#cp-new2'].forEach(p => { const [a, b] = p.split('|'); bindEye(a, b) });
$('#to-register').onclick = () => switchAuth('register');
$('#to-forgot').onclick = () => switchAuth('forgot');
$('#back-login').onclick = () => switchAuth('login');
$('#back-login2').onclick = () => switchAuth('login');
function setErr(id, on, msg) { const el = $('#' + id); el.classList.toggle('on', !!on); const t = $('#' + id + '-t'); if (msg && t) t.textContent = msg; if (on) { const c = el.closest('form'); if (c) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake') } } }
function fieldErr(input, on) { const f = input.closest('.field'); if (f) f.classList.toggle('err', on) }
$('#view-login').addEventListener('submit', e => {
  e.preventDefault();
  const u = $('#li-user').value.trim(), p = $('#li-pass').value;
  const btn = $('#view-login button[type="submit"]');
  if (!u || !p) { setErr('li-err', true, 'Veuillez remplir tous les champs.'); return }
  /* Loading state */
  btn.disabled = true;
  const origHTML = btn.innerHTML;
  btn.innerHTML = '<span class="mi" style="animation:spin 1s linear infinite">sync</span> Connexion en cours...';
  btn.classList.add('loading');
  const acc = state.accounts.find(a => a.username.toLowerCase() === u.toLowerCase());
  setTimeout(() => {
    if (acc && acc.pass === p) {
      setErr('li-err', false);
      /* Success state */
      btn.innerHTML = '<span class="mi">check_circle</span> Connexion réussie';
      btn.classList.remove('loading');
      btn.classList.add('success');
      state.session = { user: acc.username }; state.sessionStart = Date.now(); save(); beep('success');
      setTimeout(() => { enterApp(); setTimeout(greeting, 600); btn.innerHTML = origHTML; btn.classList.remove('success'); btn.disabled = false; }, 600);
    } else {
      /* Error state */
      btn.innerHTML = '<span class="mi">error</span> Identifiants incorrects';
      btn.classList.remove('loading');
      btn.classList.add('error-state');
      setErr('li-err', true, 'Nom d\u2019utilisateur ou mot de passe incorrect.'); beep('error');
      setTimeout(() => { btn.innerHTML = origHTML; btn.classList.remove('error-state'); btn.disabled = false; }, 1800);
    }
  }, 650);
});
$('#rg-pass').addEventListener('input', e => {
  const v = e.target.value; let s = 0;
  if (v.length >= 8) s++; if (/[A-Z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
  const bar = $('#rg-str'); bar.style.width = (v ? Math.max(1, s) : 0) * 25 + '%';
  bar.style.background = s <= 1 ? 'var(--danger)' : s === 2 ? 'var(--warn)' : 'var(--green)';
});
$('#view-register').addEventListener('submit', e => {
  e.preventDefault();
  const u = $('#rg-user').value.trim(), m = $('#rg-email').value.trim(), p = $('#rg-pass').value, p2 = $('#rg-pass2').value;
  let bad = false;
  fieldErr($('#rg-user'), u.length < 3); bad = bad || u.length < 3;
  const okMail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m); fieldErr($('#rg-email'), !okMail); bad = bad || !okMail;
  fieldErr($('#rg-pass'), p.length < 6); bad = bad || p.length < 6;
  fieldErr($('#rg-pass2'), p !== p2 || !p2); bad = bad || p !== p2;
  if (bad) { setErr('rg-err', true, 'Corrigez les champs signalés.'); beep('error'); return }
  if (state.accounts.some(a => a.username.toLowerCase() === u.toLowerCase())) { setErr('rg-err', true, 'Ce nom d\u2019utilisateur est déjà pris.'); beep('error'); return }
  state.accounts.push({ username: u, pass: p, email: m }); save();
  beep('success'); toast('Compte créé avec succès', 'person_add', 'ok');
  $('#li-user').value = u; $('#li-pass').value = ''; switchAuth('login');
});
let fgAcc = null, fgCode = null;
$('#fg-send').onclick = () => {
  const v = $('#fg-id').value.trim();
  const acc = state.accounts.find(a => a.username.toLowerCase() === v.toLowerCase() || (a.email || '').toLowerCase() === v.toLowerCase());
  if (!v) { setErr('fg-err', true, 'Indiquez un email ou un nom d\u2019utilisateur.'); beep('error'); return }
  if (!acc) { setErr('fg-err', true, 'Aucun compte ne correspond à cette adresse.'); beep('error'); return }
  setErr('fg-err', false); fgAcc = acc; fgCode = String(100000 + rnd(900000));
  $('#fg-code').textContent = fgCode; $('#fg-note').classList.add('on');
  $('#fg-step1').style.display = 'none'; $('#fg-step2').style.display = 'block';
  $('#fg-sub').textContent = `Code envoyé à ${acc.email}. Saisissez-le ci-dessous.`;
  beep('success'); toast('Code de vérification envoyé', 'mark_email_read', 'info');
};
$('#fg-ok').onclick = () => {
  const c = $('#fg-codein').value.trim(), n = $('#fg-new').value;
  if (c !== fgCode) { setErr('fg-err', true, 'Code incorrect.'); beep('error'); return }
  if (n.length < 6) { setErr('fg-err', true, 'Le nouveau mot de passe doit contenir au moins 6 caractères.'); beep('error'); return }
  fgAcc.pass = n; save(); setErr('fg-err', false); beep('success');
  toast('Mot de passe réinitialisé', 'password', 'ok');
  $('#li-user').value = fgAcc.username; $('#fg-step2').style.display = 'none'; $('#fg-step1').style.display = 'block';
  $('#fg-note').classList.remove('on'); $('#fg-codein').value = ''; $('#fg-new').value = ''; switchAuth('login');
};

