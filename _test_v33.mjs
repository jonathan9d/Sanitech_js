/* Tests v3.3 — assertions fonctionnelles + captures d'écran approfondies. */
import puppeteer from 'puppeteer-core';
const URL = 'file:///C:/Users/USER/Documents/projets/Sanitech_js/www/index.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = 'C:/Users/USER/Documents/projets/Sanitech_js/tests/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label); if (!cond) failures++; };
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
async function shot(name) { await sleep(450); await page.screenshot({ path: SHOTS + '/' + name + '.png' }); console.log('  📸 ' + name + '.png'); }
async function login() {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#view-login.active', { timeout: 20000 });
  await page.type('#li-user', 'admin');
  await page.type('#li-pass', 'admin123');
  await page.$eval('#view-login button[type="submit"]', b => b.click());
  await page.waitForSelector('#app.active', { timeout: 15000 });
  await page.waitForSelector('#ulist .ucard', { timeout: 15000 });
}

// ============ LOGIN (mobile) ============
await page.setViewport({ width: 430, height: 900 });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('#view-login.active', { timeout: 20000 });
const loginStyles = await page.evaluate(() => {
  const am = document.querySelector('.a-mark');
  const cs = getComputedStyle(am);
  const f1 = document.querySelector('#view-login .field');
  const f2 = document.querySelector('#view-login .field:nth-of-type(2)');
  const gap = f2.getBoundingClientRect().top - f1.getBoundingClientRect().bottom;
  const fbox = getComputedStyle(document.querySelector('#view-login .fbox'));
  return { outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, gap: Math.round(gap), fboxH: fbox.height, fboxBg: fbox.backgroundColor };
});
ok(loginStyles.outline.includes('solid') && loginStyles.outline.includes('255'), 'Login : logo avec outline blanc (' + loginStyles.outline + ')');
ok(loginStyles.gap >= 20, 'Login : espacement champs = ' + loginStyles.gap + 'px');
ok(loginStyles.fboxH === '54px', 'Login : champs de 54px');
await shot('20-login-mobile.png');

// ============ CONNEXION ============
await page.type('#li-user', 'admin');
await page.type('#li-pass', 'admin123');
await page.$eval('#view-login button[type="submit"]', b => b.click());
await page.waitForSelector('#app.active', { timeout: 15000 });
await page.waitForSelector('#ulist .ucard', { timeout: 15000 });

// ============ TOPBAR : plus de recherche globale ============
const top = await page.evaluate(() => ({ hasSearch: !!document.getElementById('tb-search'), gear: !!document.getElementById('btn-gear') }));
ok(!top.hasSearch && top.gear, 'Recherche globale retirée de la topbar, engrenage conservé');

// ============ RECHERCHE PAGE UTILISATEURS : toujours ouverte ============
const sbar = await page.evaluate(() => {
  const sb = document.getElementById('sbar');
  const inp = document.getElementById('usearch');
  const cs = getComputedStyle(sb);
  return { w: Math.round(sb.getBoundingClientRect().width), inpVisible: getComputedStyle(inp).opacity === '1' && inp.getBoundingClientRect().width > 100, rowW: Math.round(document.querySelector('#page-users > div[style*="align-items:center"]').getBoundingClientRect().width) };
});
ok(sbar.inpVisible && sbar.w > 200, 'Barre de recherche utilisateurs toujours dépliée (' + sbar.w + 'px sur ' + sbar.rowW + 'px)');
await shot('21-utilisateurs-mobile.png');

// Recherche : rendu subtil (pas de classe reveal) + filtre OK
await page.type('#usearch', 'aï');
await sleep(500);
const search = await page.evaluate(() => ({
  reveal: document.querySelectorAll('#ulist .ucard.reveal').length,
  cards: document.querySelectorAll('#ulist .ucard').length,
  matches: [...document.querySelectorAll('#ulist .u-top h4')].map(e => e.textContent)
}));
ok(search.cards > 0 && search.reveal === 0, 'Recherche : ' + search.cards + ' résultat(s), aucune animation de révélation (mise à jour subtile)');
const allMatch = await page.evaluate(() => {
  const q = norm('aï');
  return [...document.querySelectorAll('#ulist .u-top h4')].every(t => norm(t.textContent).includes(q));
});
ok(allMatch, 'Recherche : tous les résultats correspondent (normalisés, accents ignorés)');
await shot('22-recherche-utilisateurs.png');
await page.$eval('#uclear', b => b.click());
await sleep(400);

// ============ AVATAR : pastille de statut visible ============
const avdot = await page.evaluate(() => {
  const d = document.querySelector('#ulist .ucard .avdot');
  if (!d) return null;
  const a = d.parentElement.getBoundingClientRect();
  const r = d.getBoundingClientRect();
  return { avatarOverflow: getComputedStyle(d.parentElement).overflow, fullyIn: r.right <= a.right + 1 && r.bottom <= a.bottom + 1 && r.left >= a.left - 1 && r.top >= a.top - 1, dotW: Math.round(r.width), dotH: Math.round(r.height) };
});
ok(avdot && avdot.dotW >= 10 && avdot.dotH >= 10 && avdot.avatarOverflow === 'visible', 'Pastille de statut non rognée (' + avdot.dotW + 'x' + avdot.dotH + 'px, overflow=' + avdot.avatarOverflow + ')');

// ============ NAV : pastille WhatsApp + icônes ============
const nav = await page.evaluate(() => {
  const btn = document.querySelector('#bnav .navbtn.active');
  const pill = getComputedStyle(btn, '::before');
  const ic = btn.querySelector('.mi');
  return { pillBg: pill.backgroundColor, pillW: pill.width, pillR: pill.borderRadius, iconSize: getComputedStyle(ic).fontSize, bnavH: document.getElementById('bnav').getBoundingClientRect().height };
});
ok(parseFloat(nav.pillW) >= 50 && nav.pillBg !== 'rgba(0, 0, 0, 0)', 'Nav : pastille WhatsApp derrière l\u2019icône active (' + nav.pillBg + ', ' + nav.pillW + ')');
ok(parseFloat(nav.iconSize) >= 26, 'Nav : icônes agrandies (' + nav.iconSize + ')');
ok(nav.bnavH >= 72, 'Navbar haute (' + Math.round(nav.bnavH) + 'px)');
await shot('23-nav-whatsapp-mobile.png');

// ============ SCANNER : chips non coupées ============
await page.$eval('.navbtn[data-tab="scanner"]', b => b.click());
await sleep(600);
const chips = await page.evaluate(() => {
  const c = document.getElementById('scan-modes');
  const btns = [...c.querySelectorAll('.chip')];
  const last = btns[btns.length - 1].getBoundingClientRect();
  const wrap = c.getBoundingClientRect();
  return { scrollW: c.scrollWidth, clientW: c.clientWidth, lastVisible: last.right <= wrap.right + 1, wrap: getComputedStyle(c).flexWrap };
});
ok(chips.scrollW <= chips.clientW + 1 && chips.lastVisible, 'Chips scanner non coupées (wrap=' + chips.wrap + ')');
await shot('24-scanner-mobile.png');
await page.$eval('.navbtn[data-tab="users"]', b => b.click());
await sleep(600);

// ============ PROFIL : bannière héro + infos ============
await page.waitForSelector('#ulist .ucard [data-act="menu"]', { timeout: 8000 });
await page.$eval('#ulist .ucard [data-act="menu"]', b => b.click());
await sleep(500);
await page.$eval('#act-list [data-act="detail"]', b => b.click());
await sleep(700);
const prof = await page.evaluate(() => {
  const hero = document.querySelector('#detail-body .dhero');
  const hcs = hero ? getComputedStyle(hero) : null;
  return { hero: !!hero, heroBg: hcs ? hcs.backgroundImage : '', infoCards: document.querySelectorAll('#pt-info .info-card').length, iconChips: !!document.querySelector('#pt-info .info-card .mi') };
});
ok(prof.hero && prof.heroBg.includes('linear-gradient'), 'Profil : bannière héro dégradée');
ok(prof.infoCards >= 6 && prof.iconChips, 'Profil : cartes d\u2019infos avec icônes (' + prof.infoCards + ')');
await shot('25-profil-hero.png');
await page.$eval('#sheet-detail .shclose', b => b.click());
await sleep(400);

// ============ FORMULAIRE UTILISATEUR : design ============
await page.$eval('#fab', b => b.click());
await sleep(600);
const form = await page.evaluate(() => {
  const ph = document.querySelector('.uf-photo');
  const cs = getComputedStyle(ph);
  const av = document.querySelector('#uf-avatar');
  const ring = getComputedStyle(av).boxShadow;
  return { photoBox: !!ph && cs.borderRadius === '20px', avatarRing: ring.includes('0px 0px 0px 3px'), fields: document.querySelectorAll('#sheet-userform .fbox').length, ring };
});
ok(form.photoBox && form.avatarRing && form.fields >= 8, 'Formulaire : zone photo + anneau avatar + ' + form.fields + ' champs');
if (!form.avatarRing) console.log('  (box-shadow av:', form.ring, ')');
await shot('26-formulaire-utilisateur.png');
await page.$eval('#sheet-userform .shclose', b => b.click());
await sleep(400);

// ============ JOURNAL : recherche toujours ouverte ============
await page.$eval('.navbtn[data-tab="logs"]', b => b.click());
await page.waitForSelector('#llist .lcard', { timeout: 8000 });
const lsb = await page.evaluate(() => {
  const inp = document.getElementById('lsearch');
  return getComputedStyle(inp).opacity === '1' && inp.getBoundingClientRect().width > 100;
});
ok(lsb, 'Barre de recherche journal toujours dépliée');
await page.type('#lsearch', 'Aïcha');
await sleep(400);
const lres = await page.evaluate(() => [...document.querySelectorAll('#llist .l-meta b')].every(b => b.textContent.includes('Aïcha')));
ok(lres, 'Recherche journal fonctionne');
await page.$eval('#lclear', b => b.click());
await sleep(300);
await shot('27-journal-mobile.png');

// ============ SWIPE : transition visible (page voisine glisse) ============
await page.evaluate(() => document.querySelector('.navbtn[data-tab="scanner"]').click());
await sleep(800);
// Simule un glissement et inspecte l'état à mi-course : la page suivante doit être visible en parallaxe
const mid = await page.evaluate(() => new Promise(res => {
  const pg = document.getElementById('page-scanner');
  const tgt = document.getElementById('page-reqs');
  const r = pg.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const fire = (type, x, y) => document.getElementById('pages').dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: x, clientY: y, pointerType: 'touch' }));
  fire('pointerdown', cx, cy);
  for (let i = 1; i <= 8; i++) fire('pointermove', cx - i * 15, cy);
  const state = { tgtDisplay: getComputedStyle(tgt).display, tgtTransform: getComputedStyle(tgt).transform, curTransform: getComputedStyle(pg).transform };
  fire('pointerup', cx - 120, cy);
  setTimeout(() => res(state), 500);
}));
ok(mid.tgtDisplay === 'block' && mid.tgtTransform !== 'none', 'Swipe : page voisine visible pendant le glissement (transition naturelle)');
ok(await page.evaluate(() => document.querySelector('#pages .page.active').id) === 'page-reqs', 'Swipe gauche → onglet demandes');

// ============ POLICES OPTIMISÉES ============
const fonts = await page.evaluate(async () => {
  await document.fonts.ready;
  const loaded = [];
  for (const f of document.fonts) if (f.family.includes('SamsungOne') && f.status === 'loaded') loaded.push(f.weight);
  return { loaded, ok400: document.fonts.check('400 16px "SamsungOne"'), ok700: document.fonts.check('700 16px "SamsungOne"') };
});
ok(fonts.ok400 && fonts.ok700 && fonts.loaded.length >= 2, 'SamsungOne woff2 chargée (' + fonts.loaded.join(',') + ')');

console.log('--- ERREURS CONSOLE/PAGE ---');
console.log(errors.length ? errors.slice(0, 15).join('\n') : '(aucune)');
console.log('\nRésultat: ' + (failures === 0 ? 'TOUS LES TESTS PASSENT ✅' : failures + ' échec(s) ❌'));
await browser.close();
process.exit(failures === 0 ? 0 : 1);
