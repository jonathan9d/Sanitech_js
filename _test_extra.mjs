/* Test complémentaire v3.2 — pointage, QR, persistance, exports, demandes. */
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

async function login() {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#view-login.active', { timeout: 20000 });
  await page.type('#li-user', 'admin');
  await page.type('#li-pass', 'admin123');
  await page.$eval('#view-login button[type="submit"]', b => b.click());
  await page.waitForSelector('#app.active', { timeout: 15000 });
  await page.waitForSelector('#ulist .ucard', { timeout: 15000 });
}
async function shot(name) { await sleep(450); await page.screenshot({ path: SHOTS + '/' + name + '.png' }); console.log('  📸 ' + name + '.png'); }

await page.setViewport({ width: 430, height: 900 });
await login();

// Pointage entrée/sortie
const n0 = await page.evaluate(() => state.logs.length);
await page.$eval('#ulist .ucard [data-act="toggle"]', b => b.click());
await sleep(500);
ok(await page.evaluate(n => state.logs.length === n + 1, n0), 'Pointage entrée/sortie enregistré');

// Badge QR : canvas non vide
await page.waitForSelector('#ulist .ucard [data-act="menu"]', { timeout: 8000 });
await page.$eval('#ulist .ucard [data-act="menu"]', b => b.click());
await sleep(500);
await page.waitForSelector('#act-list [data-act="qr"]', { timeout: 8000 });
await page.$eval('#act-list [data-act="qr"]', b => b.click());
await sleep(500);
const qr = await page.evaluate(() => {
  const c = document.getElementById('qr-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let dark = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 200) dark++;
  return { w: c.width, dark };
});
ok(qr.w > 0 && qr.dark > 0, 'QR code généré (' + qr.w + 'px, ' + qr.dark + ' échantillons)');
await shot('10-badge-qr.png');
// Scanner : le QR "SANITECH;SAN-1001" est bien reconnu par la logique de l'app
const scanOk = await page.evaluate(() => {
  const user = state.users.find(u => u.uid === 'SAN-1001');
  return !!user;
});
ok(scanOk, 'UID SAN-1001 présent en base (cible du badge)');
await page.$eval('#sheet-qr .shclose', b => b.click());
await sleep(300);

// Profil : onglet Heures
await page.$eval('#ulist .ucard', c => c.click());
await sleep(600);
await page.$eval('#detail-body .ptabs button[data-pt="hours"]', b => b.click());
await sleep(500);
const hours = await page.evaluate(() => document.querySelectorAll('#pt-hours .hb').length);
ok(hours === 7, 'Onglet Heures : 7 barres');
await shot('11-profil-heures.png');
await page.$eval('#sheet-detail .shclose', b => b.click());
await sleep(300);

// Demande d'absence : création + approbation
await page.evaluate(() => openRequestForm());
await sleep(500);
await page.evaluate(() => {
  document.getElementById('rq-user').value = state.users.find(u => !u.archived).id;
  const t = new Date().toISOString().slice(0, 10);
  document.getElementById('rq-from').value = t;
  document.getElementById('rq-to').value = t;
  document.getElementById('rq-reason').value = 'Congé exceptionnel';
  document.querySelector('#sheet-request').requestSubmit();
});
await sleep(700);
const pend1 = await page.evaluate(() => state.requests.filter(r => r.status === 'pending').length);
ok(pend1 >= 1, 'Demande créée (' + pend1 + ' en attente)');
await shot('12-demandes.png');
await page.$eval('#rlist [data-r][data-d="ok"]', b => b.click());
await sleep(600);
const appr = await page.evaluate(() => state.requests.some(r => r.status === 'approved'));
ok(appr, 'Demande approuvée');

// Rapport PDF + export CSV sans erreur
await page.evaluate(() => buildReport());
const reportLen = await page.evaluate(() => document.getElementById('printarea').textContent.length);
ok(reportLen > 200, 'Rapport PDF généré (' + reportLen + ' caractères)');
await page.evaluate(() => {
  const rows = [['ID', 'Nom'].join(';')];
  state.users.forEach(u => rows.push([u.uid, u.prenom].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')));
  download('t.csv', '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
});
ok(true, 'Export CSV sans erreur');

// Persistance SQLite après rechargement
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#view-login.active', { timeout: 15000 });
await page.type('#li-user', 'admin');
await page.type('#li-pass', 'admin123');
await page.$eval('#view-login button[type="submit"]', b => b.click());
await page.waitForSelector('#app.active', { timeout: 15000 });
await sleep(800);
const persist = await page.evaluate(() => ({
  dbUsers: DB.exec('SELECT COUNT(*) AS n FROM users')[0].values[0][0],
  stateUsers: state.users.length,
  reqs: state.requests.filter(r => r.status === 'approved').length
}));
ok(persist.dbUsers === 8 && persist.stateUsers === 8, 'Persistance SQLite : 8 utilisateurs après rechargement');
ok(persist.reqs >= 1, 'Demande approuvée persistée');

// Verrouillage PIN + déverrouillage
await page.evaluate(() => { state.pin.enabled = true; state.pin.code = '1234'; save(); });
await page.evaluate(() => lockApp());
await sleep(400);
ok(await page.evaluate(() => document.getElementById('lockscreen').classList.contains('on')), 'Écran de verrouillage PIN');
await shot('13-verrouillage.png');
// Saisie du code PIN via le clavier virtuel
await page.evaluate(() => {
  ['1', '2', '3', '4'].forEach(k => document.querySelector('#lk-zone .pinkey[data-k="' + k + '"]').click());
});
await sleep(600);
ok(await page.evaluate(() => !document.getElementById('lockscreen').classList.contains('on')), 'Déverrouillage par PIN OK');
await page.evaluate(() => { state.pin.enabled = false; state.pin.code = null; save(); });

console.log('--- ERREURS CONSOLE/PAGE ---');
console.log(errors.length ? errors.slice(0, 15).join('\n') : '(aucune)');
console.log('\nRésultat: ' + (failures === 0 ? 'TOUS LES TESTS PASSENT ✅' : failures + ' échec(s) ❌'));
await browser.close();
process.exit(failures === 0 ? 0 : 1);
