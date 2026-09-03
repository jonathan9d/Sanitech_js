/* =====================================================================
   SANITECH — nav.js
   Navigation entre onglets, gestes (swipe, pull-to-refresh), retour en haut.
   ===================================================================== */
/* ================= NAVIGATION ================= */
const TABS = ['users', 'logs', 'scanner', 'reqs', 'stats'];
let tab = 'users';
function movePill() {
  const b = $(`.navbtn[data-tab="${tab}"]`), p = $('#navpill');
  if (!b || !p || !$('#app')?.classList.contains('active')) return;
  p.style.left = (b.offsetLeft + (b.offsetWidth - p.offsetWidth) / 2) + 'px';
  p.style.opacity = 1;
}
/* Nettoie toutes les pages : classes + styles inline posés pendant le swipe */
function resetPages() {
  $$('.page').forEach(p => {
    p.classList.remove('active', 'from-left', 'swiping');
    p.style.transform = ''; p.style.opacity = ''; p.style.transition = '';
    p.style.display = ''; p.style.zIndex = ''; p.style.willChange = '';
    p.style.filter = '';
  });
}
function setTab(name) {
  if (!TABS.includes(name) || name === tab) return;
  const prevTab = tab;
  const dir = TABS.indexOf(name) > TABS.indexOf(prevTab) ? 'right' : 'left';
  if (prevTab === 'scanner' && typeof stopScanner === 'function') stopScanner();
  tab = name; beep('tap');
  resetPages();
  const pg = $('#page-' + name);
  if (dir === 'left') pg.classList.add('from-left');
  pg.classList.add('active'); pg.scrollTop = 0;
  $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  movePill();
  $('#fab').classList.toggle('hidden', !(name === 'users' || name === 'reqs'));
  if (name === 'users') { skelList('#ulist', renderUsers) }
  if (name === 'logs') { skelList('#llist', renderLogsView) }
  if (name === 'scanner' && typeof initScannerTab === 'function') { initScannerTab() }
  if (name === 'reqs') { skelList('#rlist', renderReqs) }
  if (name === 'stats') { skelStats() }
  $('#totop').classList.remove('on');
}
/* Réglages : plus d'onglet dédié — ouvert via l'engrenage de la barre supérieure */
function openSettings() {
  if (tab === 'scanner' && typeof stopScanner === 'function') stopScanner();
  tab = 'settings';
  resetPages();
  const pg = $('#page-settings');
  pg.classList.add('active'); pg.scrollTop = 0;
  $$('.navbtn').forEach(b => b.classList.toggle('active', false));
  movePill();
  $('#fab').classList.add('hidden');
  $('#totop').classList.remove('on');
  renderSettings();
  beep('tap');
}
$('#btn-gear').onclick = openSettings;
$$('.navbtn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
window.addEventListener('resize', () => { movePill(); if (tab === 'stats' && $('#app').classList.contains('active')) drawChart() });
function setTabDirect(name) {
  if (tab === name) return;
  if (tab === 'scanner' && typeof stopScanner === 'function') stopScanner();
  tab = name;
  resetPages();
  $('#page-' + name).classList.add('active');
  $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  movePill(); $('#fab').classList.toggle('hidden', !(name === 'users' || name === 'reqs'));
}

/* Swipe horizontal + Pull-to-refresh - Improved UI/UX */
const pagesEl = $('#pages');
let swipeBusy = false;
let swipePreloaded = '';      // onglet pré-rendu pendant le glissement
let sw = null;                // geste en cours (pointer tracking)
let suppressClick = false;    // neutralise le clic qui suit un vrai swipe

/* Onglet cible selon la direction du geste : gauche = suivant, droite = précédent */
function swipeTarget(dx) {
  const i = TABS.indexOf(tab);
  if (i < 0) return null;
  const dir = dx < 0 ? 1 : -1;
  const t = i + dir;
  return (t >= 0 && t < TABS.length) ? { name: TABS[t] } : null;
}

/* Haptic feedback for swipe gestures */
function triggerHaptic(intensity = 'light') {
  try {
    if (navigator.vibrate) {
      const duration = intensity === 'heavy' ? 25 : intensity === 'medium' ? 15 : 10;
      navigator.vibrate(duration);
    }
  } catch (e) { }
}

/* Nettoie les styles posés pendant un glissement */
function clearSwipeStyles() {
  $$('.page').forEach(p => {
    p.style.transition = ''; p.style.transform = ''; p.style.display = '';
    p.style.willChange = ''; p.style.zIndex = ''; p.style.opacity = ''; p.style.filter = '';
  });
  $('#ptr').classList.remove('on');
}

/* Prépare le contenu de l'onglet voisin pendant le glissement (comme les apps natives) */
function preloadTab(name) {
  try {
    if (name === 'users') renderUsers();
    else if (name === 'logs') renderLogsView();
    else if (name === 'reqs') renderReqs();
    else if (name === 'stats') { renderStats(); const cs = $('#chartskel'); if (cs) cs.style.display = 'none'; if (typeof animateChart === 'function') animateChart(); }
    swipePreloaded = name;
  } catch (e) { }
}

/* Début d'appui : on ne capture PAS le pointeur (sinon les clics sont avalés) */
pagesEl.addEventListener('pointerdown', e => {
  if (swipeBusy || curSheet || $('#dialogwrap').classList.contains('on') || locked) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const t = e.target;
  if (t && t.closest && t.closest('input,textarea,select,[contenteditable],.chips,.seg,.datefilters,#chart')) return;
  const pg = $('#page-' + tab);
  sw = {
    id: e.pointerId, sx: e.clientX, sy: e.clientY,
    lastX: e.clientX, lastT: performance.now(),
    st: pg ? pg.scrollTop : 0,
    axis: null, dx: 0, dy: 0, vel: 0, haptic: false
  };
  suppressClick = false;
});

window.addEventListener('pointermove', e => {
  if (!sw || sw.id !== e.pointerId) return;
  const pg = $('#page-' + tab);
  if (!pg) return;
  const dx = e.clientX - sw.sx, dy = e.clientY - sw.sy;
  const now = performance.now(), dt = now - sw.lastT;
  if (dt > 0) sw.vel = sw.vel * .65 + ((e.clientX - sw.lastX) / dt) * .35;
  sw.lastX = e.clientX; sw.lastT = now;
  sw.dx = dx; sw.dy = dy;

  /* Verrouillage de l'axe : horizontal = changement d'onglet, vertical = pull-to-refresh */
  if (!sw.axis) {
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.35) sw.axis = 'h';
    else if (dy > 14 && dy > Math.abs(dx) * 1.35 && sw.st <= 0) sw.axis = 'v';
    else if (Math.abs(dy) > 14) return;
  }

  if (sw.axis === 'v') {
    if (sw.st <= 0) {
      pg.style.transition = 'none';
      pg.style.transform = 'translateY(' + (dy * .38) + 'px)';
      $('#ptr').classList.toggle('on', dy > 44);
    }
    return;
  }
  if (sw.axis !== 'h') return;

  /* ---- Glissement horizontal : la page suit le doigt à l'identique ---- */
  const vw = pagesEl.clientWidth || window.innerWidth;
  const tgt = swipeTarget(dx);
  const tp = tgt ? $('#page-' + tgt.name) : null;
  if (!sw.haptic) { if (tgt) preloadTab(tgt.name); sw.haptic = true; }
  if (Math.abs(dx) > 96 && !sw.haptic2) { triggerHaptic('light'); sw.haptic2 = true; }

  /* Résistance élastique sur le premier / dernier onglet */
  const eff = tgt ? dx : dx * .32;

  pg.style.willChange = 'transform';
  pg.style.transition = 'none';
  pg.style.zIndex = '2';
  pg.style.transform = 'translateX(' + eff + 'px)';

  if (tp) {
    tp.style.display = 'block';
    tp.style.willChange = 'transform';
    tp.style.transition = 'none';
    tp.style.zIndex = '1';
    /* La page voisine arrive du bon côté (droite pour l'onglet suivant) */
    tp.style.transform = 'translateX(' + (dx + (dx < 0 ? vw : -vw)) + 'px)';
  }
}, { passive: true });

function endSwipe(e) {
  if (!sw) return;
  if (e && e.pointerId !== undefined && sw.id !== e.pointerId) return;
  const cancel = !e || e.type === 'pointercancel';
  const pg = $('#page-' + tab);
  const vw = pagesEl.clientWidth || window.innerWidth;

  if (sw.axis === 'v') {
    if (!cancel && sw.dy > 96) { triggerHaptic('medium'); refreshTab(); }
    else setTimeout(() => $('#ptr').classList.remove('on'), 150);
    if (pg) { pg.style.transition = 'transform .25s'; pg.style.transform = ''; setTimeout(() => { if (!sw) clearSwipeStyles() }, 260) }
    sw = null;
    return;
  }

  if (sw.axis === 'h') {
    const dir = sw.dx < 0 ? 1 : -1;
    const tgt = swipeTarget(sw.dx);
    const tp = tgt ? $('#page-' + tgt.name) : null;
    const dist = Math.abs(sw.dx);
    const fling = Math.abs(sw.vel) > .45;                     // lancer rapide
    const commit = !cancel && !!tgt && (dist > Math.max(76, vw * .24) || (fling && dist > 48));
    suppressClick = !!tgt && (commit || dist > 96);
    if (commit && tp) {
      triggerHaptic('medium');
      pg.style.transition = 'transform .32s cubic-bezier(.22,.9,.28,1)';
      pg.style.transform = 'translateX(' + (dir > 0 ? -vw : vw) + 'px)';
      tp.style.transition = 'transform .32s cubic-bezier(.22,.9,.28,1)';
      tp.style.transform = 'translateX(0px)';
      swipeBusy = true;
      const name = tgt.name;
      setTimeout(() => { commitTab(name); swipeBusy = false; }, 330);
    } else {
      /* Retour élastique si le geste n'est pas assez prononcé */
      swipePreloaded = '';
      pg.style.transition = 'transform .38s cubic-bezier(.3,1.3,.5,1)';
      pg.style.transform = '';
      if (tp) {
        tp.style.transition = 'transform .38s cubic-bezier(.3,1.3,.5,1)';
        tp.style.transform = '';
        tp.style.display = '';
      }
      setTimeout(() => { if (!sw && !swipeBusy) clearSwipeStyles() }, 420);
    }
    sw = null;
    return;
  }

  /* Simple appui sans glissement : rien à faire, le clic suit naturellement */
  sw = null;
}
window.addEventListener('pointerup', endSwipe);
window.addEventListener('pointercancel', endSwipe);
/* Après un vrai glissement horizontal, on neutralise le clic fantôme */
pagesEl.addEventListener('click', e => {
  if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
}, { capture: true });

/* Bascule d'état après un swipe : on nettoie tout, on active la cible sans animation d'entrée */
function commitTab(name) {
  if (tab === name) return;
  if (tab === 'scanner' && typeof stopScanner === 'function') stopScanner();
  tab = name; beep('tap');
  resetPages();
  const np = $('#page-' + name);
  np.classList.add('active', 'swiping'); np.scrollTop = 0;
  $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  movePill();
  $('#fab').classList.toggle('hidden', !(name === 'users' || name === 'reqs'));
  /* Contenu déjà pré-rendu pendant le glissement : pas de squelette */
  const fast = swipePreloaded === name;
  swipePreloaded = '';
  if (name === 'users') { if (fast) renderUsers(); else skelList('#ulist', renderUsers) }
  if (name === 'logs') { if (fast) renderLogsView(); else skelList('#llist', renderLogsView) }
  if (name === 'scanner' && typeof initScannerTab === 'function') { initScannerTab() }
  if (name === 'reqs') { if (fast) renderReqs(); else skelList('#rlist', renderReqs) }
  if (name === 'stats') { if (fast) renderStats(); else skelStats() }
  $('#totop').classList.remove('on');
}
function refreshTab() {
  beep('pop'); $('#ptr').classList.add('on');
  setTimeout(() => {
    if (tab === 'users') skelList('#ulist', renderUsers);
    else if (tab === 'logs') { skelList('#llist', renderLogsView) }
    else if (tab === 'reqs') skelList('#rlist', renderReqs);
    else if (tab === 'stats') skelStats();
    else renderSettings();
    $('#ptr').classList.remove('on');
    toast('Données actualisées', 'refresh', 'info');
  }, 650);
}
/* Retour en haut : apparaît au scroll, se cache après un délai d'inactivité */
let topTimer = null;
$$('.page').forEach(p => p.addEventListener('scroll', () => {
  const act = $('#page-' + tab);
  /* Seuil proportionnel à la hauteur défilable : le bouton apparaît dès
     qu'on a parcouru ~30 % de la page (plafonné à 300 px sur les longues). */
  const range = act ? Math.max(1, act.scrollHeight - act.clientHeight) : 1;
  const on = !!(act && act.scrollTop > Math.min(300, range * 0.3));
  $('#totop').classList.toggle('on', on);
  if (on) { clearTimeout(topTimer); topTimer = setTimeout(() => { $('#totop').classList.remove('on') }, 1100) }
}, { passive: true }));
$('#totop').onclick = () => { $('#page-' + tab).scrollTo({ top: 0, behavior: 'smooth' }); beep('tap') };

/* Raccourcis clavier (bureau) */
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if ((e.ctrlKey || e.metaKey) && ['1', '2', '3', '4', '5'].includes(e.key)) { e.preventDefault(); setTab(TABS[+e.key - 1]); return }
  if ((e.ctrlKey || e.metaKey) && e.key === '6') { e.preventDefault(); openSettings(); return }
  if (e.key.toLowerCase() === 't' && !typing) { e.preventDefault(); $('#btn-theme').click(); return }
  if (e.key === '/' && tab === 'users' && !typing) { e.preventDefault(); $('#usearch').focus(); beep('tap'); return }
  if (e.key === 'Escape') {
    if ($('#dialogwrap').classList.contains('on')) $('#dialogwrap').classList.remove('on');
    else if (curSheet) closeSheet();
    return;
  }
});

/* =====================================================================
   ANDROID BACK BUTTON — Navigation stack
   ===================================================================== */
const navHistory = [];
function pushNavState(name) {
  if (navHistory[navHistory.length - 1] !== name) {
    navHistory.push(name);
    try { history.pushState({ screen: name }, '', location.href); } catch (e) { }
  }
}
function popNavState() {
  navHistory.pop();
}

/* Patch setTab / openSettings / commitTab to push history */
const _origSetTab = setTab;
setTab = function(name) {
  const prev = tab;
  _origSetTab(name);
  if (tab !== prev && tab !== 'settings') pushNavState(tab);
};
const _origOpenSettings = openSettings;
openSettings = function() {
  const prev = tab;
  _origOpenSettings();
  if (tab !== prev) pushNavState('settings');
};
const _origCommitTab = commitTab;
commitTab = function(name) {
  const prev = tab;
  _origCommitTab(name);
  if (tab !== prev) pushNavState(tab);
};

/* Handle Android back button via popstate */
window.addEventListener('popstate', e => {
  /* Priority 1: close open dialogs/sheets */
  if ($('#dialogwrap').classList.contains('on')) {
    $('#dialogwrap').classList.remove('on');
    return;
  }
  if (curSheet) {
    closeSheet();
    return;
  }
  /* Priority 2: navigate to previous screen */
  if (navHistory.length > 1) {
    navHistory.pop();
    const prev = navHistory[navHistory.length - 1];
    if (prev === 'settings') {
      _origOpenSettings();
    } else if (prev && TABS.includes(prev)) {
      _origSetTab(prev);
    }
  } else {
    /* On home tab — suggest quit on Android */
    if (tab !== 'users') {
      _origSetTab('users');
    }
  }
});

/* Push initial state */
try { history.replaceState({ screen: 'users' }, '', location.href); } catch (e) { }
navHistory.push('users');

