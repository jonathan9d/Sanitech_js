import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'].find(p => existsSync(p));
const shots = 'tests/shots';
mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; fails.push(name + (extra ? ' — ' + extra : '')); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--window-size=420,880'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 880, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle2' }).catch(async () => {
  // sert www/ si pas de serveur
  throw new Error('Serveur absent');
});

await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('sanitech'); });
await page.reload({ waitUntil: 'networkidle2' });
await sleep(600);
/* login */
await page.type('#a-user', 'admin');
await page.type('#a-pass', 'admin123');
await page.click('#a-go');
await sleep(900);
ok('login', await page.evaluate(() => document.querySelector('#app').classList.contains('active')));

/* ============ 1. SWIPE : pas de fuite de display ============ */
async function swipe(x1, y1, x2, y2, steps = 8) {
  const sx = x1, sy = y1, ex = x2, ey = y2;
  await page.touchscreen.touchStart(sx, sy);
  for (let i = 1; i <= steps; i++) { await page.touchscreen.touchMove(sx + (ex - sx) * i / steps, sy + (ey - sy) * i / steps); await sleep(12) }
  await page.touchscreen.touchEnd();
  await sleep(650);
}
const curTab = () => page.evaluate(() => {
  const a = document.querySelector('.page.active'); return a ? a.id.replace('page-', '') : null;
});
ok('départ onglet users', (await curTab()) === 'users');

/* swipe gauche → logs */
await swipe(210, 400, 60, 400);
ok('swipe gauche → logs', (await curTab()) === 'logs');
/* swipe gauche → scanner */
await swipe(210, 400, 60, 400);
ok('swipe gauche → scanner', (await curTab()) === 'scanner');
/* swipe droite → logs */
await swipe(60, 400, 210, 400);
ok('swipe droite → logs', (await curTab()) === 'logs');
/* swipe droite → users */
await swipe(60, 400, 210, 400);
ok('swipe droite → users', (await curTab()) === 'users');

/* BUG CRITIQUE : après 2 swipes, aucune page inactive ne doit rester visible */
const leak = await page.evaluate(() => {
  const act = document.querySelector('.page.active'); if (!act) return 'pas de page active';
  const res = [];
  document.querySelectorAll('.page').forEach(p => {
    const cs = getComputedStyle(p);
    if (p !== act && cs.display !== 'none') res.push(p.id + ' → ' + cs.display + ' (inl:' + p.style.display + ')');
  });
  return res;
});
ok('aucune page inactive visible après swipes', Array.isArray(leak) && leak.length === 0, JSON.stringify(leak));

/* BUG : après un swipe, le premier clic sur une rangée ne doit pas être avalé */
await page.evaluate(() => {
  const card = document.querySelector('#ulist .ucard'); if (card) card.click();
});
await sleep(400);
ok('clic sur utilisateur après swipe (pas avalé)', await page.evaluate(() => document.querySelector('#sheet-detail') && document.querySelector('#sheet-detail').classList.contains('open')));
await page.evaluate(() => { document.querySelector('#sheet-detail') && (document.querySelector('#sheet-detail').classList.remove('open')); document.querySelector('#backdrop') && document.querySelector('#backdrop').classList.remove('on') });
await sleep(250);

/* ============ 2. SWIPE : transition visible (capture) ============ */
/* pendant un swipe, la page voisine doit être visible en parallaxe */
const during = await page.evaluate(async () => {
  const p = document.querySelector('#page-users');
  const dx = new Promise(r => { const m = ev => { document.removeEventListener('pointermove', m); r(ev.clientX - 210) }; document.addEventListener('pointermove', m); });
  const s = new PointerEvent('pointerdown', { pointerId: 9, clientX: 210, clientY: 400, bubbles: true, cancelable: true });
  p.dispatchEvent(s);
  for (let i = 1; i <= 6; i++) { await new Promise(r => setTimeout(r, 16)); const mv = new PointerEvent('pointermove', { pointerId: 9, clientX: 210 - i * 25, clientY: 400, bubbles: true, cancelable: true }); p.dispatchEvent(mv) }
  await dx;
  const tp = document.querySelector('#page-logs');
  return { tgtVisible: tp.style.display === 'block' && tp.style.transform !== '', curTransform: p.style.transform };
});
ok('pendant le swipe : page voisine affichée en parallaxe', during.tgtVisible, JSON.stringify(during));
/* relâche → retour propre, aucune fuite */
await page.evaluate(() => { document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true })) });
await sleep(650);
ok('après swipe annulé : pas de fuite', await page.evaluate(() => { const r = []; document.querySelectorAll('.page').forEach(p => { if (!p.classList.contains('active') && getComputedStyle(p).display !== 'none') r.push(p.id) }); return r.length === 0 }));

/* ============ 3. NAVBAR : pastille couvre icône + label, texte visible ============ */
const pill = await page.evaluate(() => {
  const b = document.querySelector('#bnav .navbtn.active');
  if (!b) return null;
  const pill = getComputedStyle(b, '::before');
  const r = b.getBoundingClientRect();
  const pr = {
    w: pill.width, h: pill.height, top: pill.top, z: pill.zIndex,
    btnH: Math.round(r.height), btnW: Math.round(r.width)
  };
  /* le texte du label doit être peint AU-DESSUS de la pastille */
  const mi = b.querySelector('.mi').getBoundingClientRect();
  const txt = document.createElement('span'); txt.textContent = b.childNodes[b.childNodes.length - 1].textContent; document.body.appendChild(txt);
  const tr = txt.getBoundingClientRect(); txt.remove();
  return { ...pr, labelBelowIcon: tr.top > mi.bottom, pillCoversLabel: parseFloat(pill.height) > (tr.bottom - r.top) };
});
ok('pastille présente', !!pill && pill.z === '-1', JSON.stringify(pill));
ok('pastille assez haute pour couvrir icône + label', !!pill && pill.pillCoversLabel, JSON.stringify(pill));
ok('pastille derrière le contenu (z-index -1)', !!pill && pill.z === '-1');
await page.screenshot({ path: shots + '/30-nav-pastille.png', fullPage: false });
ok('capture pastille OK', true);

/* ============ 4. ID UTILISATEUR MODIFIABLE ============ */
await page.evaluate(() => { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.querySelector('#page-users').classList.add('active') });
await sleep(300);
await page.evaluate(() => {
  const b = document.querySelector('#fab'); if (b) b.click();
});
await sleep(500);
ok('formulaire ouvert', await page.evaluate(() => document.querySelector('#sheet-userform').classList.contains('open')));
const uidDefault = await page.evaluate(() => document.querySelector('#uf-uid').value);
ok('ID auto pré-rempli (SAN-1001+)', /^SAN-\d+$/.test(uidDefault), uidDefault);
/* saisie d'un ID personnalisé */
await page.evaluate(() => {
  const u = document.querySelector('#uf-uid'); u.value = 'SAN-2500'; u.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#uf-prenom').value = 'Test'; document.querySelector('#uf-nom').value = 'ID';
  document.querySelector('#uf-email').value = 'testid@sanitech.io';
});
await page.evaluate(() => document.querySelector('#sheet-userform').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
await sleep(500);
ok('utilisateur créé avec ID modifié', await page.evaluate(() => {
  const u = window._t ? window._t : null;
  return document.body.textContent.includes('SAN-2500');
}));
/* vérif dans la liste */
const uidShown = await page.evaluate(() => { const el = document.querySelector('#ulist'); return el ? el.textContent.includes('SAN-2500') : false });
ok('ID modifié visible dans la liste', uidShown);
/* doublon refusé */
await page.evaluate(() => { document.querySelector('#fab').click() });
await sleep(400);
await page.evaluate(() => {
  const u = document.querySelector('#uf-uid'); u.value = 'SAN-2500'; u.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#uf-prenom').value = 'Dup'; document.querySelector('#uf-nom').value = 'ID';
  document.querySelector('#uf-email').value = 'dup@sanitech.io';
});
await page.evaluate(() => document.querySelector('#sheet-userform').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
await sleep(300);
ok('ID dupliqué refusé (erreur affichée)', await page.evaluate(() => document.querySelector('#uf-uid').closest('.field').classList.contains('err')));
await page.screenshot({ path: shots + '/31-form-id.png', fullPage: false });
await page.evaluate(() => { document.querySelector('#sheet-userform').classList.remove('open'); document.querySelector('#backdrop').classList.remove('on') });

/* ============ 5. Réglages via engrenage + retour swipe ============ */
await page.evaluate(() => document.querySelector('#btn-gear').click());
await sleep(400);
ok('engrenage → réglages', await page.evaluate(() => document.querySelector('#page-settings').classList.contains('active')));
await page.evaluate(() => document.querySelector('#btn-gear').click());
await sleep(400);

/* erreurs console */
const fatal = errs.filter(e => !/favicon|SamsungOne 400|woff2/.test(e));
ok('zéro erreur console fatale', fatal.length === 0, JSON.stringify(fatal.slice(0, 3)));

console.log(`\nRésultat : ${pass} PASS / ${fail} FAIL`);
if (fail) { console.log('Échecs :', fails); process.exit(1) }
await browser.close();
