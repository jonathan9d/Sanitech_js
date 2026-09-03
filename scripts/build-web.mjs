/* Génère le dossier www/ : copie propre des ressources web de l'application. */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const item of ['index.html', 'manifest.json', 'service-worker.js', 'css', 'js', 'fonts', 'assets']) {
  cpSync(join(root, item), join(out, item), { recursive: true });
}

console.log('✓ www/ généré (' + ['index.html', 'manifest.json', 'service-worker.js', 'css', 'js', 'fonts', 'assets'].join(', ') + ')');
