/* Tests v3.5 — clics souris (fix capture), swipe type WhatsApp, rotation scanner,
   confirmation d'archivage, pastilles couleur responsives. */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const URL = 'file:///C:/Users/USER/Documents/projets/Sanitech_js/www/index.html';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'].find(p => existsSync(p));
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
  await page.waitForSelector('#view-login.active', { timeout: 20000 });
  await page.type('#li-user', 'admin');
  await page.type('#li-pass', 'admin123');
  await page.$eval('#view-login button[type="submit"]', b => b.click());
  await page.waitForSelector('#app.active', { timeout: 15000 });
  await page.waitForSelector('#ulist .ucard', { timeout: 15000 });
}
async function mouseClick(sel) {
  await page.$eval(sel, el => el.scrollIntoView({ block: 'center' }));
  await sleep(180);
  const r = await page.$eval(sel, el => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.click(r.x, r.y, { delay: 40 });
  await sleep(400);
}
async function touchSwipe(dx, pointerId = 7) {
  await page.evaluate(({ dx, pointerId }) => new Promise(res => {
    const el = document.getElementById('pages');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, clientX: x, clientY: y, pointerType: 'touch' }));
    fire('pointerdown', cx, cy);
    for (let i = 1; i <= 10; i++) fire('pointermove', cx + dx * i / 10, cy);
    fire('pointerup', cx + dx, cy);
    setTimeout(res, 600);
  }), { dx, pointerId });
}

// ============ MOBILE : clics réels réparés ============
await page.setViewport({ width: 430, height: 900 });
await login();
await page.evaluate(() => { state.settings.selfie = true; save(); });
const uv0 = await page.evaluate(() => state.settings.uview);
await mouseClick('#btn-uview');
ok(await page.evaluate(() => state.settings.uview) !== uv0, 'Clic souris réel : bascule liste/grille');

// Engrenage même avec un toast affiché (les toasts sont passés en bas d'écran)
await page.evaluate(() => toast('Toast de test', 'info', 'info'));
await sleep(150);
await mouseClick('#btn-gear');
ok(await page.evaluate(() => document.getElementById('page-settings').classList.contains('active')), 'Engrenage cliquable malgré un toast présent');

// Pastilles de couleur : petites + sans débordement sur petit écran
await page.$eval('#accents', el => el.scrollIntoView({ block: 'center' }));
await sleep(250);
const acc = await page.evaluate(() => {
  const dots = [...document.querySelectorAll('#accents .accent-dot')];
  const row = document.querySelector('.setrow.accrow');
  return { n: dots.length, w: parseFloat(getComputedStyle(dots[0]).width), overflow: row.scrollWidth > row.clientWidth + 1 };
});
ok(acc.n === 5 && acc.w <= 27 && !acc.overflow, 'Pastilles couleurs petites & adaptées (' + acc.w + 'px, sans débordement)');
await mouseClick('#accents .accent-dot:nth-child(3)');
ok(await page.evaluate(() => state.settings.accent === '#7a5cff'), 'Clic pastille → accent appliqué');

// ============ SCANNER : rotation & miroirs ============
await page.$eval('.navbtn[data-tab="scanner"]', b => b.click());
await sleep(700);
const hasRot = await page.evaluate(() => ['scan-rot-ccw', 'scan-rot-cw', 'scan-rot-fh', 'scan-rot-fv', 'scan-rot-reset'].every(id => !!document.getElementById(id)));
ok(hasRot, 'Barre d\u2019orientation du scanner présente');
const dims = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 80; c.height = 40;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 80, 40); g.fillStyle = '#fff'; g.fillRect(0, 0, 20, 20);
  const img = new Image(); img.src = c.toDataURL();
  const draw = () => { const d = drawForDecode(img, 80, 40, false); return [d.width, d.height]; };
  scanRot = { deg: 90, flipH: false, flipV: false };
  const r90 = draw();
  scanRot = { deg: 0, flipH: false, flipV: false };
  return r90;
});
ok(dims[0] === 40 && dims[1] === 80, 'Rotation 90° → décodage sur buffer 40×80 (largeur/hauteur échangées)');
await mouseClick('#scan-rot-cw');
await mouseClick('#scan-rot-fh');
const rotOn = await page.evaluate(() => state.settings.scanRot.deg === 90 && state.settings.scanRot.flipH === true && document.getElementById('scan-rot-fh').classList.contains('on'));
ok(rotOn, 'Rotation persistée + miroir H actif/surligné');
await mouseClick('#scan-rot-fv');
await mouseClick('#scan-rot-reset');
ok(await page.evaluate(() => { const r = state.settings.scanRot; return r.deg === 0 && !r.flipH && !r.flipV; }), 'Reset orientation');

// ============ ARCHIVER : confirmation ============
await page.$eval('.navbtn[data-tab="users"]', b => b.click());
await sleep(700);
const uid = await page.evaluate(() => document.querySelector('#ulist .ucard').dataset.id);
await page.$eval('#ulist .ucard [data-act="menu"]', b => b.click());
await sleep(400);
await page.$eval('#act-list .act-item[data-act="arch"]', b => b.click());
await sleep(400);
ok(await page.evaluate(() => document.getElementById('dialogwrap').classList.contains('on')), '« Archiver » demande confirmation');
await page.$eval('#d-cancel', b => b.click());
await sleep(300);
ok(await page.evaluate(id => state.users.find(u => u.id === id).archived === false, uid), 'Annulation → toujours actif');
await page.$eval('#ulist .ucard [data-act="menu"]', b => b.click());
await sleep(400);
await page.$eval('#act-list .act-item[data-act="arch"]', b => b.click());
await sleep(400);
await page.$eval('#d-ok', b => b.click());
await sleep(500);
ok(await page.evaluate(id => state.users.find(u => u.id === id).archived === true, uid), 'Confirmation → archivé');
await page.evaluate(id => { const u = state.users.find(x => x.id === id); u.archived = false; save(); renderUsers(); }, uid);
await sleep(300);

// ============ SWIPE : navigation fluide (gauche/droite, retour, clic préservé) ============
await touchSwipe(-160, 21);
ok(await page.evaluate(() => document.querySelector('#pages .page.active').id) === 'page-logs', 'Swipe gauche → Journal');
await touchSwipe(160, 22);
ok(await page.evaluate(() => document.querySelector('#pages .page.active').id) === 'page-users', 'Swipe droite → Utilisateurs');
await touchSwipe(30, 23);
ok(await page.evaluate(() => document.querySelector('#pages .page.active').id) === 'page-users', 'Petit glissement → retour élastique, onglet inchangé');
await mouseClick('#ulist .ucard');
ok(await page.evaluate(() => document.getElementById('sheet-detail').classList.contains('open')), 'Après swipe, clic carte → profil toujours fonctionnel');

console.log(errors.length ? '\nERREURS CONSOLE:\n' + errors.slice(0, 12).join('\n') : '\nAucune erreur console.');
console.log('\nRésultat: ' + (failures === 0 ? 'TOUS LES TESTS PASSENT ✅' : failures + ' échec(s) ❌'));
await browser.close();
process.exit(failures === 0 ? 0 : 1);
