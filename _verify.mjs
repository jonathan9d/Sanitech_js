import puppeteer from 'puppeteer-core';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--window-size=430,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle2' });
await page.waitForSelector('#auth.active', { timeout: 15000 });

// 1) Greeting dynamic
const greeting = await page.evaluate(() => document.getElementById('a-hello').textContent.trim());
console.log('greeting text:', JSON.stringify(greeting));

// 2) No demo chip
const hasDemo = await page.evaluate(() => !!document.getElementById('demo-fill'));
console.log('demo chip present:', hasDemo);

// 3) Login logo size / border
const aMark = await page.evaluate(() => {
  const el = document.querySelector('.a-mark');
  const cs = getComputedStyle(el);
  const img = el.querySelector('img');
  const ics = getComputedStyle(img);
  return { w: el.offsetWidth, h: el.offsetHeight, border: cs.border, imgPad: ics.padding };
});
console.log('a-mark:', JSON.stringify(aMark));

await page.type('#li-user', 'admin');
await page.type('#li-pass', 'admin123');
await page.evaluate(() => document.querySelector('#view-login').requestSubmit());
await page.waitForSelector('#app.active', { timeout: 15000 });
await sleep(500);

// 4) Swipe tactile (PointerEvents, comme un vrai appareil) sur stats (dernier onglet)
const tswipe = (x1, y1, x2, y2, steps = 8) => page.evaluate(async (x1, y1, x2, y2, steps) => {
  const pages = document.getElementById('pages');
  const fire = (type, x, y) => pages.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: x, clientY: y, pointerType: 'touch' }));
  fire('pointerdown', x1, y1);
  for (let i = 1; i <= steps; i++) { fire('pointermove', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await new Promise(r => setTimeout(r, 12)); }
  fire('pointerup', x2, y2);
}, x1, y1, x2, y2, steps);
const atTab = () => page.evaluate(() => document.querySelector('#pages .page.active').id);
await page.evaluate(() => document.querySelector('.navbtn[data-tab="stats"]').click());
await sleep(900);
console.log('swipe test start:', await atTab());
// stats (dernier onglet) : swipe droite → demandes
await tswipe(60, 400, 330, 400);
await sleep(650);
const afterRight = await atTab();
console.log('swipe right from stats →', afterRight);
// demandes : swipe gauche → stats
await tswipe(330, 400, 60, 400);
await sleep(650);
console.log('swipe left from', afterRight, '→', await atTab());

// 5) Sound icon change
await page.evaluate(() => { const p = document.getElementById('page-settings'); p.scrollTop = 0; });
await sleep(300);
const soundOn = await page.evaluate(() => document.getElementById('ic-sound').textContent);
console.log('sound icon (default on):', soundOn);
await page.evaluate(() => { document.getElementById('sw-sound').click(); });
await sleep(400);
const soundOff = await page.evaluate(() => document.getElementById('ic-sound').textContent);
console.log('sound icon (after off):', soundOff);

// 6) Tooltip works (data-tip hover)
await page.evaluate(() => document.getElementById('btn-gear').click());
await sleep(800);
await page.evaluate(() => { const p = document.getElementById('page-settings'); p.scrollTop = 0; });
await sleep(300);
await page.hover('#btn-pin');
await sleep(400);
const tip = await page.evaluate(() => {
  const t = document.getElementById('tooltip');
  const r = t.getBoundingClientRect();
  return { on: t.classList.contains('on'), text: t.textContent, y: Math.round(r.y), h: Math.round(r.height) };
});
console.log('tooltip:', JSON.stringify(tip));

// 7) Archived user restrictions
await page.evaluate(() => document.querySelector('.navbtn[data-tab="users"]').click());
await sleep(800);
await page.evaluate(() => document.querySelector('.chip[data-f="arch"]').click());
await sleep(800);
const archCards = await page.evaluate(() => document.querySelectorAll('#ulist .ucard.arch').length);
console.log('archived cards:', archCards);
if (archCards > 0) {
  await page.evaluate(() => {
    const card = document.querySelector('#ulist .ucard.arch');
    const menu = card.querySelector('[data-act="menu"]');
    if (menu) menu.click();
  });
  await sleep(600);
  const archItems = await page.evaluate(() => Array.from(document.querySelectorAll('#act-list .act-item')).map(b => b.dataset.act));
  console.log('archived actions:', JSON.stringify(archItems));
  console.log('archived has toggle:', archItems.includes('toggle'));
  await page.evaluate(() => document.querySelector('#sheet-actions .shclose').click());
  await sleep(400);
  // QR sheet for archived user
  await page.evaluate(() => {
    const card = document.querySelector('#ulist .ucard.arch');
    const qr = card.querySelector('[data-act="qr"]');
    if (qr) qr.click();
  });
  await sleep(700);
  const qrState = await page.evaluate(() => ({
    inDisp: getComputedStyle(document.getElementById('qr-in')).display,
    outDisp: getComputedStyle(document.getElementById('qr-out')).display,
    noteDisp: getComputedStyle(document.getElementById('qr-note')).display
  }));
  console.log('QR sheet archived:', JSON.stringify(qrState));
  await page.evaluate(() => document.querySelector('#sheet-qr .shclose').click());
}

// 8) Delete request works (create one first)
await page.evaluate(() => document.querySelector('.navbtn[data-tab="reqs"]').click());
await sleep(800);
const reqCount0 = await page.evaluate(() => state.requests.length);
console.log('requests before:', reqCount0);
await page.evaluate(() => openRequestForm());
await sleep(600);
await page.evaluate(() => {
  document.getElementById('rq-user').value = state.users.find(u => !u.archived).id;
  document.getElementById('rq-from').value = new Date().toISOString().slice(0, 10);
  document.getElementById('rq-to').value = new Date().toISOString().slice(0, 10);
  document.getElementById('rq-reason').value = 'Test suppression';
  document.querySelector('#sheet-request').requestSubmit();
});
await sleep(800);
const reqCount1 = await page.evaluate(() => state.requests.length);
console.log('requests after create:', reqCount1);
await page.evaluate(() => document.querySelector('#rlist [data-r][data-d="del"]').click());
await sleep(600);
const dlgOn = await page.evaluate(() => document.getElementById('dialogwrap').classList.contains('on'));
const dlgRect = await page.evaluate(() => {
  const r = document.querySelector('.dialog').getBoundingClientRect();
  return { y: Math.round(r.y), h: Math.round(r.height) };
});
console.log('delete dialog on:', dlgOn, 'rect:', JSON.stringify(dlgRect));
if (dlgOn) await page.evaluate(() => document.getElementById('d-ok').click());
await sleep(700);
const reqCount2 = await page.evaluate(() => state.requests.length);
console.log('requests after delete confirm:', reqCount2);

// 9) Trash flow: delete a user and check trash count increments
await page.evaluate(() => document.querySelector('.navbtn[data-tab="users"]').click());
await sleep(800);
// Reset user filter to "all"
await page.evaluate(() => document.querySelector('#uchips .chip[data-f="all"]').click());
await sleep(800);
const trash0 = await page.evaluate(() => state.trash.length);
await page.evaluate(() => {
  const card = document.querySelector('#ulist .ucard:not(.arch)');
  card.querySelector('[data-act="menu"]').click();
});
await sleep(600);
await page.evaluate(() => document.querySelector('#act-list .act-item[data-act="del"]').click());
await sleep(500);
await page.evaluate(() => document.getElementById('d-ok').click());
await sleep(800);
const trash1 = await page.evaluate(() => state.trash.length);
console.log('trash before:', trash0, 'after delete confirm:', trash1);

// 10) totop styling
await page.evaluate(() => { const p = document.getElementById('page-settings'); p.scrollTop = 0; });
await sleep(300);
await page.evaluate(() => document.getElementById('btn-gear').click());
await sleep(800);
await page.evaluate(() => { const p = document.getElementById('page-settings'); p.scrollTop = 800; });
await sleep(400);
const totop = await page.evaluate(() => {
  const el = document.getElementById('totop');
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return { radius: cs.borderRadius, left: Math.round(r.left), bottom: Math.round(900 - r.bottom), on: el.classList.contains('on') };
});
console.log('totop:', JSON.stringify(totop));

// 11) Notification badge not clipped (fully visible)
await page.evaluate(() => {
  const t = Date.now();
  addNotif('bell', 'n1', 'm1'); addNotif('bell', 'n2', 'm2'); addNotif('bell', 'n3', 'm3');
});
await sleep(300);
const bellBadge = await page.evaluate(() => {
  const b = document.getElementById('bell-badge');
  const btn = document.getElementById('btn-bell');
  const br = b.getBoundingClientRect(), r = btn.getBoundingClientRect();
  return {
    badgeTop: Math.round(br.top), badgeBottom: Math.round(br.bottom), badgeW: Math.round(br.width),
    btnTop: Math.round(r.top), btnBottom: Math.round(r.bottom), overflow: getComputedStyle(btn).overflow
  };
});
console.log('bell badge not clipped:', JSON.stringify(bellBadge));

// 12) Empty users state (no add button, filter message)
await page.evaluate(() => document.querySelector('.navbtn[data-tab="users"]').click());
await sleep(700);
// Create a filter with zero results: type a nonsense search
await page.evaluate(() => {
  const input = document.getElementById('usearch');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'zzzzz');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(500);
const emptyState = await page.evaluate(() => {
  const el = document.querySelector('#ulist .empty');
  return { hasEmpty: !!el, hasAddBtn: !!document.querySelector('#ulist [data-eact="add"]'), title: el ? el.querySelector('h4').textContent : null };
});
console.log('empty state (search):', JSON.stringify(emptyState));
await page.evaluate(() => document.getElementById('uclear').click());
await sleep(300);
// Filtre archivés : la carte archivée est bien listée (l'état vide est déjà
// vérifié plus haut via la recherche sans résultat)
await page.evaluate(() => { document.querySelector('#uchips .chip[data-f="arch"]').click(); });
await sleep(500);
const archFilter = await page.evaluate(() => ({
  archCards: document.querySelectorAll('#ulist .ucard.arch').length,
  emptyTitle: (document.querySelector('#ulist .empty h4') || {}).textContent || null
}));
console.log('filter archivés:', JSON.stringify(archFilter));

// 13) Profile page renders with banner for archived user
await page.evaluate(() => { document.querySelector('#uchips .chip[data-f="arch"]').click(); });
await sleep(600);
const archCard = await page.evaluate(() => !!document.querySelector('#ulist .ucard.arch'));
if (archCard) {
  await page.evaluate(() => document.querySelector('#ulist .ucard.arch').click());
  await sleep(700);
  const prof = await page.evaluate(() => ({
    banner: !!document.querySelector('#detail-body .arch-banner'),
    avatar: (document.querySelector('#detail-body .dhero .avatar') || {}).offsetWidth || 0,
    title: document.querySelector('#detail-body .dhero h3').textContent
  }));
  console.log('profile (archived):', JSON.stringify(prof));
  await page.evaluate(() => document.querySelector('#sheet-detail .shclose').click());
}

// 14) Search bar geometry
await page.evaluate(() => { document.querySelector('#uchips .chip[data-f="all"]').click(); });
await sleep(600);
const sbar = await page.evaluate(() => {
  const sb = document.getElementById('sbar');
  const sc = document.getElementById('btn-scan');
  const rb = document.getElementById('page-users').querySelector('div[style*="align-items:center"]');
  const sr = sb.getBoundingClientRect();
  return { sbarW: Math.round(sr.height), scanH: Math.round(sc.getBoundingClientRect().height), rowAlign: rb ? getComputedStyle(rb).alignItems : null };
});
console.log('search bar:', JSON.stringify(sbar));

console.log('--- ERRORS ---');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
process.exit(0);
