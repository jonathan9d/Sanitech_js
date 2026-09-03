/* Copie l'APK final dans dist/. Privilégie l'APK release signé, sinon debug. */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const debug = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const outDir = join(root, 'dist');

/* Nom du fichier aligné sur la version de package.json */
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version || '0.0.0';
const src = existsSync(release) ? release : debug;

if (!existsSync(src)) {
  console.error('APK introuvable : ' + src);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, `Sanitech-${version}.apk`));
console.log(`✓ APK copié → dist/Sanitech-${version}.apk (` + (src.includes('release') ? 'release signé' : 'debug') + ')');
