import puppeteer from 'puppeteer-core';

const URL = 'file:///C:/Users/USER/Documents/projets/Sanitech_js/index.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label); if (!cond) failures++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

async function login() {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#view-login.active', { timeout: 15000 });
  await page.type('#li-user', 'admin');
  await page.type('#li-pass', 'admin123');
  await page.$eval('#view-login button[type="submit"]', b => b.click());
  await page.waitForSelector('#app.active', { timeout: 8000 });
  await page.waitForSelector('#ulist .ucard', { timeout: 8000 });
}

// ============ MOBILE : fonctionnel ============
await page.setViewport({ width: 430, height: 900 });
await login();
ok(true, 'Connexion + liste utilisateurs (mobile)');

// Polices modernes
await page.evaluate(() => document.fonts.ready);
const fonts = await page.evaluate(() => ({
  inter: document.fonts.check('400 16px Inter') && document.fonts.check('700 16px Inter'),
  sg: document.fonts.check('700 16px "Space Grotesk"'),
  icons: document.fonts.check('16px "Material Symbols Rounded"')
}));
ok(fonts.inter && fonts.sg, 'Polices modernes Inter + Space Grotesk chargées');
ok(fonts.icons, 'Icônes Material Symbols chargées');

// Menu d'actions (⋯)
await page.$eval('#ulist .ucard [data-act="menu"]', b => b.click());
await sleep(500);
const actOpen = await page.$eval('#sheet-actions', el => el.classList.contains('open'));
const actItems = await page.$$eval('#act-list .act-item', els => els.length);
ok(actOpen && actItems >= 5, 'Menu d\'actions utilisateur ouvert (' + actItems + ' actions)');

// Duplication
await page.$eval('#act-list [data-act="dup"]', b => b.click());
await sleep(600);
const usersAfterDup = await page.evaluate(() => state.users.length);
const hasCopy = await page.evaluate(() => state.users.some(u => u.prenom.includes('(copie)')));
ok(usersAfterDup === 9 && hasCopy, 'Utilisateur dupliqué (9 utilisateurs)');

// Profil : page à part entière
await page.$eval('#ulist .ucard', c => c.click());
await sleep(600);
const prof = await page.evaluate(() => ({
  isPage: document.getElementById('sheet-detail').classList.contains('sheet-page'),
  open: document.getElementById('sheet-detail').classList.contains('open'),
  full: document.getElementById('sheet-detail').getBoundingClientRect().width >= 400
}));
ok(prof.isPage && prof.open && prof.full, 'Profil = page pleine (classe sheet-page, largeur ' + Math.round(prof.full ? 430 : 0) + 'px)');
await page.$eval('#sheet-detail .shclose', b => b.click());
await sleep(400);

// Formulaire : page à part entière
await page.$eval('#fab', b => b.click());
await sleep(500);
const form = await page.evaluate(() => ({
  isPage: document.getElementById('sheet-userform').classList.contains('sheet-page'),
  open: document.getElementById('sheet-userform').classList.contains('open')
}));
ok(form.isPage && form.open, 'Formulaire utilisateur = page pleine');
await page.$eval('#sheet-userform .shclose', b => b.click());
await sleep(400);

// Caméra : sélecteur de périphérique + miroir (selfie activé pour le test)
await page.evaluate(() => { state.settings.selfie = true; save(); });
await page.$eval('#ulist .ucard [data-act="toggle"]', b => b.click());
await sleep(600);
const cam = await page.evaluate(() => ({
  sheet: document.getElementById('sheet-selfie').classList.contains('open'),
  devSel: !!document.getElementById('cam-device'),
  flip: !!document.getElementById('cam-flip')
}));
ok(cam.sheet && cam.devSel && cam.flip, 'Feuille selfie : sélecteur caméra + bouton miroir présents');
await page.$eval('#cam-flip', b => b.click());
await sleep(200);
const mirrored = await page.evaluate(() => document.getElementById('cam').classList.contains('mirrored'));
ok(mirrored, 'Bouton miroir : inverser portrait / selfie');
await page.$eval('#btn-nosnap', b => b.click());
await sleep(400);

// Recherche journal
await page.$eval('.navbtn[data-tab="logs"]', b => b.click());
await sleep(600);
await page.type('#lsearch', 'Aïcha');
await sleep(400);
const lCount = await page.$$eval('#llist .lcard', els => els.length);
const allAicha = await page.$$eval('#llist .l-meta b', els => els.every(e => e.textContent.includes('Aïcha')));
ok(lCount > 0 && allAicha, 'Recherche journal fonctionne (' + lCount + ' résultats)');

// ============ BUREAU : responsive ============
await page.setViewport({ width: 1280, height: 800 });
await sleep(500);
const desk = await page.evaluate(() => ({
  snav: getComputedStyle(document.getElementById('snav')).display !== 'none',
  bnav: getComputedStyle(document.getElementById('bnav')).display === 'none',
  shellW: document.getElementById('shell').getBoundingClientRect().width,
  viewW: window.innerWidth
}));
ok(desk.snav, 'Bureau : barre latérale affichée');
ok(desk.bnav, 'Bureau : navigation du bas masquée');
ok(desk.shellW >= desk.viewW - 4, 'Bureau : l\'affichage remplit tout l\'écran (' + Math.round(desk.shellW) + 'px)');

// Onglets cliquables depuis la sidebar
await page.$eval('#snav .navbtn[data-tab="stats"]', b => b.click());
await sleep(900);
const statsActive = await page.$eval('#page-stats', el => el.classList.contains('active'));
ok(statsActive, 'Bureau : navigation par clic sur l\'icône d\'onglet (sidebar)');

// Scroll-to-top : apparaît puis se cache après délai
await page.evaluate(() => { document.getElementById('page-stats').scrollTop = 600; });
await sleep(300);
const totopOn = await page.$eval('#totop', el => el.classList.contains('on'));
await sleep(3200);
const totopOff = await page.$eval('#totop', el => !el.classList.contains('on'));
ok(totopOn && totopOff, 'Bouton retour en haut : apparaît au scroll, disparaît après délai');

// KPI sur bureau
const kpiN = await page.$$eval('#kpis .kpi', els => els.length);
ok(kpiN >= 6, 'Widgets stats rendus sur bureau (' + kpiN + ')');

// ============ PERSISTANCE ============
await page.setViewport({ width: 430, height: 900 });
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#view-login.active', { timeout: 15000 });
await page.type('#li-user', 'admin');
await page.type('#li-pass', 'admin123');
await page.$eval('#view-login button[type="submit"]', b => b.click());
await page.waitForSelector('#app.active', { timeout: 8000 });
await page.waitForSelector('#ulist .ucard', { timeout: 8000 });
const afterReload = await page.evaluate(() => ({
  users: state.users.length,
  db: DB.exec('SELECT COUNT(*) AS n FROM users')[0].values[0][0],
  hasCopy: state.users.some(u => u.prenom.includes('(copie)'))
}));
ok(afterReload.users === 9 && afterReload.db === 9 && afterReload.hasCopy, 'Persistance SQLite après rechargement (9 utilisateurs, dont la copie)');

// Thème
await page.$eval('#btn-theme', b => b.click());
await sleep(400);
ok(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'Thème sombre');
await page.$eval('#btn-theme', b => b.click());

// À propos : logo + version (réglages via l'engrenage de la barre supérieure)
await page.$eval('#btn-gear', b => b.click());
await sleep(600);
await page.$eval('#btn-about', b => b.click());
await sleep(500);
const about = await page.evaluate(() => ({
  logo: !!document.querySelector('.about-logo img') && document.querySelector('.about-logo img').src.includes('logo.png'),
  db: document.getElementById('about-db').textContent.includes('Base SQLite')
}));
ok(about.logo, 'À propos : logo assets/logo.png utilisé');
ok(about.db, 'À propos : stats base SQLite');
await page.$eval('#sheet-about .shclose', b => b.click());

// Raccourci clavier : Ctrl+4 → demandes (ordre des onglets : 1 utilisateurs, 2 journal, 3 scanner, 4 demandes, 5 stats)
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', ctrlKey: true, bubbles: true })));
await sleep(500);
ok(await page.$eval('#page-reqs', el => el.classList.contains('active')) && await page.evaluate(() => tab === 'reqs'), 'Raccourci clavier Ctrl+4 → onglet Demandes');

console.log(errors.length ? '\nERREURS CONSOLE:\n' + errors.slice(0, 10).join('\n') : '\nAucune erreur console.');
console.log('\nRésultat: ' + (failures === 0 ? 'TOUS LES TESTS PASSENT ✅' : failures + ' échec(s) ❌'));
await browser.close();
process.exit(failures === 0 ? 0 : 1);
