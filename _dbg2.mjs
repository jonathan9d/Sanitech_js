import puppeteer from 'puppeteer-core';
const URL = 'file:///C:/Users/USER/Documents/projets/Sanitech_js/index.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900 });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('#view-login.active', { timeout: 15000 });
await page.type('#li-user', 'admin');
await page.type('#li-pass', 'admin123');
await page.$eval('#view-login button[type="submit"]', b => b.click());
await page.waitForSelector('#app.active', { timeout: 8000 });
await page.waitForSelector('#ulist .ucard', { timeout: 8000 });

// 1) événement synthétique
const r1 = await page.evaluate(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', ctrlKey: true, bubbles: true }));
  return tab;
});
console.log('synthétique Ctrl+3 → tab =', r1);

// 2) clavier réel
await page.evaluate(() => { tab = 'users'; });
await page.keyboard.down('Control');
await page.keyboard.press('3');
await page.keyboard.up('Control');
await sleep(400);
console.log('clavier réel Ctrl+3 → tab =', await page.evaluate(() => tab));
console.log('page-reqs active:', await page.$eval('#page-reqs', el => el.classList.contains('active')));
await browser.close();
