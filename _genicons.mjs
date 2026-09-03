import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const RES = 'android/app/src/main/res';
const LEGACY = [[48, 'mdpi'], [72, 'hdpi'], [96, 'xhdpi'], [144, 'xxhdpi'], [192, 'xxxhdpi']];
const FG = [[108, 'mdpi'], [162, 'hdpi'], [216, 'xhdpi'], [324, 'xxhdpi'], [432, 'xxxhdpi']];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle2' });

// The source icon: white background + logo (same one used by web & Windows)
const ICON = '/assets/icon-512.png';

async function shot(layoutHTML, size, file) {
  await page.evaluate(html => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.innerHTML = `<div id="__shot" style="margin:0;padding:0;background:transparent">${html}</div>`;
  }, layoutHTML);
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('#__shot img')];
    await Promise.all(imgs.map(i => i.decode().catch(() => {})));
  });
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 60));
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
  fs.mkdirSync(file.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(file, buf);
}

// Legacy + round: white rounded square (visible rounded corners, not a full square)
for (const [size, dpi] of LEGACY) {
  for (const [name, radius] of [['ic_launcher', '22%'], ['ic_launcher_round', '50%']]) {
    const html = `<div style="position:relative;width:${size}px;height:${size}px">
      <div style="position:absolute;inset:4%;border-radius:${radius};overflow:hidden;display:flex;align-items:center;justify-content:center">
        <img src="${ICON}" style="width:100%;height:100%;display:block">
      </div>
    </div>`;
    await shot(html, size, `${RES}/mipmap-${dpi}/${name}.png`);
    console.log('✓', `${RES}/mipmap-${dpi}/${name}.png`);
  }
}

// Adaptive foreground: full-bleed icon (system mask gives the rounded / circular shape)
for (const [size, dpi] of FG) {
  const html = `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;overflow:hidden">
      <img src="${ICON}" style="width:100%;height:100%;display:block">
    </div>`;
  await shot(html, size, `${RES}/mipmap-${dpi}/ic_launcher_foreground.png`);
  console.log('✓', `${RES}/mipmap-${dpi}/ic_launcher_foreground.png`);
}

await browser.close();
process.exit(0);
