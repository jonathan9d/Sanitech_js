import puppeteer from 'puppeteer-core';
const URL = 'file:///C:/Users/USER/Documents/projets/Sanitech_js/index.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900 });
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => {
  window.__keys = [];
  document.addEventListener('keydown', e => window.__keys.push({ key: e.key, ctrl: e.ctrlKey, code: e.code }));
});
await page.keyboard.down('Control');
await page.keyboard.press('3');
await page.keyboard.up('Control');
await sleep(300);
console.log(JSON.stringify(await page.evaluate(() => window.__keys)));
await browser.close();
