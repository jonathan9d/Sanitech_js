/* =====================================================================
   SANITECH — tour.js
   Visite guidée du premier lancement (rejouable depuis l'Aide).
   ===================================================================== */
const TOUR_STEPS = [
  { ic: 'waving_hand', t: 'Bienvenue sur Sanitech', x: 'Cette visite guidée de 6 étapes vous présente l\u2019essentiel. Vous pouvez la quitter à tout moment avec « Passer ».' },
  { ic: 'group', t: 'Vos membres', x: 'Chaque carte affiche le badge (ID), le rôle, le téléphone et le service. Le bouton ⋯ ouvre le profil, le badge QR ou la modification.', tab: 'users', sel: '#ulist .ucard' },
  { ic: 'add_circle', t: 'Ajouter un membre', x: 'Le bouton + ouvre le formulaire : prénom, nom, ID de badge, service… La photo et le QR sont automatiques.', tab: 'users', sel: '#fab' },
  { ic: 'manage_search', t: 'Le journal', x: 'Chaque entrée et sortie est tracée avec l\u2019heure et les retards. Le bouton ⋯ d\u2019une ligne permet de corriger une heure ou supprimer un doublon.', tab: 'logs', sel: '#llist .lcard' },
  { ic: 'qr_code_scanner', t: 'Scanner & pointage', x: 'Ouvrez l\u2019onglet Scanner puis appuyez sur « Démarrer le scan » : un badge QR pointé est reconnu et annoncé à voix haute.', tab: 'scanner', sel: '#btn-toggle-scan' },
  { ic: 'settings', t: 'Les paramètres', x: 'L\u2019engrenage ⚙ en haut à droite : sécurité PIN, services, couleurs, sons, exports et sauvegardes.', sel: '#btn-gear' }
];
let tourOn = false, tourI = -1;

function tourBuild() {
  let w = $('#tourbox');
  if (w) return;
  w = document.createElement('div');
  w.id = 'tourbox';
  w.innerHTML = `<div class="t-dim"></div>
    <div class="t-card" role="dialog" aria-label="Visite guidée">
      <button class="t-skip rip" id="t-skip" type="button">Passer</button>
      <div class="t-ic"><span class="mi" id="t-ic">tour</span></div>
      <div class="t-tx">
        <b id="t-title">—</b>
        <p id="t-text"></p>
      </div>
      <div class="t-ctrl">
        <button class="btn ghost sm rip" id="t-prev" type="button"><span class="mi">chevron_left</span>Précédent</button>
        <span class="t-dots" id="t-dots"></span>
        <button class="btn primary sm rip" id="t-next" type="button"><span id="t-next-lb">Suivant</span><span class="mi" id="t-next-ic">chevron_right</span></button>
      </div>
    </div>`;
  document.body.appendChild(w);
  $('#t-prev').onclick = () => stepTour(-1);
  $('#t-next').onclick = () => {
    if (tourI >= TOUR_STEPS.length - 1) stopTour(true);
    else stepTour(1);
  };
  $('#t-skip').onclick = () => stopTour(false);
}
function clearTourHl() { $$('.t-hl').forEach(el => el.classList.remove('t-hl')) }
function tourDonePersist() {
  try { sessionStorage.setItem('st-tour', '1') } catch (e) { }
  if (state && state.settings) { state.settings.tourDone = true; save(); }
}
function stopTour(finished) {
  if (!tourOn) return;
  tourOn = false;
  tourBuild();
  $('#tourbox').classList.remove('on');
  clearTourHl();
  tourI = -1;
  if (finished) { tourDonePersist(); beep('success'); setTimeout(() => toast('Visite guidée terminée', 'tour', 'ok'), 200) }
  else { tourDonePersist(); }
}
function stepTour(dir) {
  tourI += dir;
  if (tourI < 0) tourI = 0;
  if (tourI >= TOUR_STEPS.length) { stopTour(true); return }
  const s = TOUR_STEPS[tourI];
  $('#t-ic').textContent = s.ic;
  $('#t-title').textContent = s.t;
  $('#t-text').textContent = s.x;
  $('#t-prev').style.visibility = tourI === 0 ? 'hidden' : 'visible';
  const last = tourI === TOUR_STEPS.length - 1;
  $('#t-next-lb').textContent = last ? 'Terminer' : 'Suivant';
  $('#t-next-ic').textContent = last ? 'check_circle' : 'chevron_right';
  $('#t-dots').innerHTML = TOUR_STEPS.map((_, i) => `<i class="${i === tourI ? 'on' : ''}"></i>`).join('');
  /* Onglet cible (si différent) */
  if (s.tab && tab !== s.tab) { try { if (typeof setTab === 'function') setTab(s.tab) } catch (e) { } }
  requestAnimationFrame(() => highlightTour(s, 0));
}
function highlightTour(s, tries) {
  clearTourHl();
  const card = $('#tourbox .t-card');
  if (!card) return;
  let el = null;
  if (s.sel) {
    el = document.querySelector(s.sel);
    if (!el && tries < 12) { setTimeout(() => highlightTour(s, tries + 1), 140); return }
  }
  if (el) {
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (e) { }
    el.classList.add('t-hl');
  }
}
function startTour(force = false) {
  if (tourOn) return;
  try { const q = new URLSearchParams(location.search); if (q.get('tour') === 'off') return } catch (e) { }
  if (!force && ((state && state.settings && state.settings.tourDone) || sessionStorage.getItem('st-tour') === '1')) return;
  tourBuild();
  tourOn = true;
  $('#tourbox').classList.add('on');
  tourI = -1;
  stepTour(1);
  beep('pop');
}
function startTourIfFirst() {
  try {
    if (!$('#app').classList.contains('active')) return;
    if (!state || !state.session) return;
    setTimeout(() => startTour(false), 350);
  } catch (e) { }
}
const tbtn = $('#btn-tour');
if (tbtn) tbtn.onclick = () => { if (typeof closeSheet === 'function') closeSheet(); setTimeout(() => startTour(true), 280) };
window.startTour = startTour;
window.startTourIfFirst = startTourIfFirst;
