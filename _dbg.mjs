import puppeteer from 'puppeteer-core';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--window-size=1280,800']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle2' });
await page.waitForSelector('#auth.active', { timeout: 15000 });
await page.type('#li-user', 'admin');
await page.type('#li-pass', 'admin123');
await page.evaluate(() => document.querySelector('#view-login').requestSubmit());
await page.waitForSelector('#app.active', { timeout: 15000 });
await sleep(700);

// Create a pending request to show the badge
await page.evaluate(() => {
  state.requests.push({ id: uid(), userId: state.users[0].id, userName: state.users[0].prenom + ' ' + state.users[0].nom, type: 'Congé', from: '2026-08-18', to: '2026-08-19', reason: 'test', status: 'pending', ts: Date.now() });
  save(); renderReqs();
});
await sleep(400);
const snavBadge = await page.evaluate(() => {
  const b = document.getElementById('reqbadge2');
  const br = b.getBoundingClientRect();
  const navBtn = b.closest('.navbtn');
  const r = navBtn.getBoundingClientRect();
  return {
    badge: { top: Math.round(br.top), bottom: Math.round(br.bottom), left: Math.round(br.left), right: Math.round(br.right) },
    btn: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
    overflow: getComputedStyle(navBtn).overflow,
    text: b.textContent, display: getComputedStyle(b).display
  };
});
console.log('sidebar badge:', JSON.stringify(snavBadge, null, 1));
await browser.close();
process.exit(0);
