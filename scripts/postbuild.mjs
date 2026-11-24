import { createHash } from 'node:crypto';
import { cp, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const shell = ['index.html', 'LICENSE.txt', 'sw.js', 'src/styles.css',
  ...(await readdir('public')).sort().map(name => `public/${name}`)];
for (const file of shell) await cp(file, path.join('dist', file));

const bundles = (await readdir('dist/assets')).sort();
const files = [...shell, ...bundles.map(name => `assets/${name}`)];
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(path.join('dist', file)));
const version = hash.digest('hex').slice(0, 12);
await writeFile('dist/assets/precache.js',
  `const CACHE = 'ttt-shell-${version}';\nconst FILES = ${JSON.stringify(files)};\n`);

// Mirror only generated bundles to the Pages root; never use the repo as Vite's outDir.
await cp('dist/assets', 'assets', { recursive: true });
for (const entry of await readdir('assets', { withFileTypes: true })) {
  if (entry.isFile() && entry.name !== 'precache.js' && !bundles.includes(entry.name)) {
    await unlink(path.join('assets', entry.name));
  }
}
