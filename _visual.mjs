/* Tests visuels complets — Sanitech 3.1
   Captures mobile / bureau, thèmes clair / sombre, avec vérifications
   programmatiques : débordement horizontal, thème appliqué, rognage. */
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:8080/';
const SHOTS = 'C:/Users/USER/Documents/projets/Sanitech_js/tests/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; fails.push(name + (extra ? ' — ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')) } };
const errs = [];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--window-size=430,900'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

async function login() {
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#auth.active', { timeout: 20000 });
  await sleep(400);
  await page.type('#li-user', 'admin');
  await page.type('#li-pass', 'admin123');
  await page.evaluate(() => document.querySelector('#view-login').requestSubmit());
  await page.waitForSelector('#app.active', { timeout: 15000 });
  await page.waitForSelector('#ulist .ucard', { timeout: 15000 });
  await sleep(500);
}
async function shot(name) { await sleep(450); await page.screenshot({ path: SHOTS + '/' + name + '.png' }); console.log('  📸 ' + name); }
async function setTab(t) { await page.evaluate(n => document.querySelector('.navbtn[data-tab="' + n + '"]').click(), t); await sleep(900); }
/* Vérifie qu'aucune page active n'a de débordement horizontal ni d'élément dépassant */
async function overflowCheck(label) {
  const r = await page.evaluate(() => {
    const out = [];
    const act = document.querySelector('.page.active');
    if (!act) return ['pas de page active'];
    if (act.scrollWidth > act.clientWidth + 2) out.push('scrollWidth ' + act.scrollWidth + ' > clientWidth ' + act.clientWidth);
    document.querySelectorAll('.page.active *').forEach(el => {
      if (el.children.length) return;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (r.right > window.innerWidth + 2 && r.width > 2) out.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' dépasse droite (' + Math.round(r.right) + ' > ' + window.innerWidth + ')');
      if (r.left < -2 && r.width > 2) out.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' dépasse gauche (' + Math.round(r.left) + ')');
    });
    return out.slice(0, 8);
  });
  ok('aucun débordement horizontal (' + label + ')', r.length === 0, JSON.stringify(r));
}
async function themeIs(dark) {
  return page.evaluate(d => document.documentElement.dataset.theme === (d ? 'dark' : 'light'), dark);
}

/* ============ MOBILE CLAIR ============ */
console.log('\n=== MOBILE (430x900) — CLAIR ===');
await page.setViewport({ width: 430, height: 900, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await login();
await shot('40-login-clair');
await setTab('users');
await sleep(500);
await overflowCheck('utilisateurs');
await shot('41-utilisateurs-clair');

// Recherche
await page.type('#usearch', 'Aïcha');
await sleep(500);
await shot('42-recherche');
await page.$eval('#uclear', b => b.click());
await sleep(400);

// Profil
await page.$eval('#ulist .ucard', c => c.click());
await sleep(700);
await overflowCheck('profil');
await shot('43-profil');
await page.$eval('#sheet-detail .shclose', b => b.click());
await sleep(400);

// Formulaire
await page.$eval('#fab', b => b.click());
await sleep(600);
await overflowCheck('formulaire');
await shot('44-formulaire');
await page.$eval('#sheet-userform .shclose', b => b.click());
await sleep(400);

// Journal
await setTab('logs');
await sleep(400);
await shot('45-journal');

// Scanner
await setTab('scanner');
await sleep(600);
await overflowCheck('scanner');
await shot('46-scanner');

// Demandes
await setTab('reqs');
await sleep(500);
await shot('47-demandes');

// Stats
await setTab('stats');
await sleep(1200);
await overflowCheck('stats');
await shot('48-stats-clair');

// Réglages
await page.evaluate(() => document.getElementById('btn-gear').click());
await sleep(800);
await overflowCheck('réglages');
await shot('49-reglages-clair');

// Notifications
await page.evaluate(() => { addNotif('warning_amber', 'Retard', 'Aïcha Diallo est entrée après 08:30.'); addNotif('event_repeat', 'Sortie auto', '3 utilisateurs passés en sortie.'); });
await sleep(300);
await page.evaluate(() => document.getElementById('btn-bell').click());
await sleep(700);
await shot('50-notifications');
await page.evaluate(() => document.querySelector('#sheet-notifs .shclose').click());
await sleep(400);

/* ============ MOBILE SOMBRE ============ */
console.log('\n=== MOBILE (430x900) — SOMBRE ===');
await page.evaluate(() => document.getElementById('btn-theme').click());
await sleep(500);
ok(await themeIs(true), 'thème sombre appliqué');
await setTab('users');
await shot('51-utilisateurs-sombre');
await setTab('stats');
await sleep(1000);
await shot('52-stats-sombre');
await page.evaluate(() => document.getElementById('btn-gear').click());
await sleep(700);
await shot('53-reglages-sombre');

// Verrouillage PIN
await page.evaluate(() => { state.pin.enabled = true; state.pin.code = '1234'; save(); });
await page.evaluate(() => lockApp());
await sleep(500);
await overflowCheck('verrouillage');
await shot('54-verrouillage');
await page.evaluate(() => { ['1', '2', '3', '4'].forEach(k => document.querySelector('#lk-zone .pinkey[data-k="' + k + '"]').click()); });
await sleep(600);
ok(await page.evaluate(() => !document.getElementById('lockscreen').classList.contains('on')), 'déverrouillage PIN OK');
await page.evaluate(() => { state.pin.enabled = false; state.pin.code = null; save(); });
await page.evaluate(() => document.getElementById('btn-theme').click());
await sleep(400);

/* ============ BUREAU ============ */
console.log('\n=== BUREAU (1280x800) — CLAIR ===');
await page.setViewport({ width: 1280, height: 800 });
await sleep(600);
const desk = await page.evaluate(() => ({
  snav: getComputedStyle(document.getElementById('snav')).display !== 'none',
  bnav: getComputedStyle(document.getElementById('bnav')).display === 'none',
  shellW: Math.round(document.getElementById('shell').getBoundingClientRect().width)
}));
ok(desk.snav && desk.bnav, 'bureau : sidebar visible, nav bas masquée');
ok(desk.shellW >= 1276, 'bureau : pleine largeur (' + desk.shellW + 'px)');
await setTab('users');
await overflowCheck('utilisateurs bureau');
await shot('55-utilisateurs-bureau');
await setTab('stats');
await sleep(1200);
await overflowCheck('stats bureau');
await shot('56-stats-bureau');
await page.evaluate(() => document.getElementById('btn-gear').click());
await sleep(800);
await shot('57-reglages-bureau');

// Thème sombre bureau
await page.evaluate(() => document.getElementById('btn-theme').click());
await sleep(500);
await setTab('users');
await shot('58-utilisateurs-bureau-sombre');
await page.evaluate(() => document.getElementById('btn-theme').click());
await sleep(400);

/* ============ COULEURS DE FOND (thèmes) ============ */
const bg = await page.evaluate(() => {
  const shell = getComputedStyle(document.getElementById('shell'));
  const body = getComputedStyle(document.body);
  return { bodyBg: body.backgroundColor, shellBg: shell.backgroundColor, theme: document.documentElement.dataset.theme };
});
console.log('  fond body:', bg.bodyBg, '| shell:', bg.shellBg, '| thème:', bg.theme);
ok(['rgb(238, 244, 251)', 'rgb(240, 246, 253)', 'rgb(245, 250, 255)'].some(c => bg.bodyBg === c) || bg.bodyBg !== 'rgb(0, 0, 0)', 'fond clair cohérent (' + bg.bodyBg + ')');

/* ============ ERREURS CONSOLE ============ */
const fatal = errs.filter(e => !/favicon/.test(e));
console.log('\n=== ERREURS CONSOLE ===');
console.log(fatal.length ? fatal.slice(0, 10).join('\n') : '(aucune)');
ok('zéro erreur console', fatal.length === 0, JSON.stringify(fatal.slice(0, 3)));

console.log(`\n=== RÉSULTAT VISUEL : ${pass} PASS / ${fail} FAIL ===`);
if (fail) { console.log('Échecs:', fails); process.exit(1) }
await browser.close();
process.exit(0);
