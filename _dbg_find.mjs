import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT = process.argv[2] || 'C:/Users/USER/Documents/projets/Sanitech_js/tests/shots/63-emulateur-avant-login.png';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('file:///' + SHOT, { waitUntil: 'load' });
const res = await page.evaluate(() => {
  const img = document.querySelector('img');
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const isBlue = (i) => d[i] > 60 && d[i] < 160 && d[i + 1] > 100 && d[i + 1] < 180 && d[i + 2] > 220 && d[i + 2] < 255 && d[i] < d[i + 2] - 80;
  const isWhite = (i) => d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240;
  // recherche de zones bleues (bouton) et blanches (champs) — balayage par blocs
  const blocks = [];
  for (let y = 0; y < H; y += 20) {
    for (let xx = 0; xx < W; xx += 20) {
      let blue = 0, white = 0, n = 0;
      for (let dy = 0; dy < 20; dy += 4) for (let dx = 0; dx < 20; dx += 4) {
        const i = ((y + dy) * W + xx + dx) * 4; n++;
        if (isBlue(i)) blue++; if (isWhite(i)) white++;
      }
      blocks.push({ x: xx, y, blue: blue / n, white: white / n });
    }
  }
  const blueRows = {};
  blocks.forEach(b => { if (b.blue > 0.5) { blueRows[b.y] = (blueRows[b.y] || 0) + 1; } });
  const whiteRows = {};
  blocks.forEach(b => { if (b.white > 0.8) { whiteRows[b.y] = (whiteRows[b.y] || 0) + 1; } });
  const topBlueRows = Object.entries(blueRows).filter(([, v]) => v > 10).map(([y, v]) => +y).sort((a, b) => a - b);
  const topWhiteRows = Object.entries(whiteRows).filter(([, v]) => v > 15).map(([y, v]) => +y).sort((a, b) => a - b);
  // groupes de lignes contiguës
  const group = arr => { const g = []; let cur = [arr[0]]; for (let i = 1; i < arr.length; i++) { if (arr[i] - arr[i - 1] <= 60) cur.push(arr[i]); else { g.push(cur); cur = [arr[i]]; } } g.push(cur); return g; };
  return { W, H, blueBands: group(topBlueRows).map(g => ({ from: g[0], to: g[g.length - 1] })).slice(0, 6), whiteBands: group(topWhiteRows).map(g => ({ from: g[0], to: g[g.length - 1] })).slice(0, 8) };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
process.exit(0);
