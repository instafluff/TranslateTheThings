// Manual build helper. Lists the generated static assets for offline shell caching.
// Nothing is deployed automatically: upload dist/ yourself.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
async function collect(dir, relative = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path.join(dir, entry.name), name));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}
const assets = (await collect(root)).filter((name) =>
  name !== 'index.html' && name !== 'sw.js' && name !== 'precache.json'
).sort();
await writeFile(path.join(root, 'precache.json'), JSON.stringify(assets.map((name) => './' + name), null, 2) + '\n');
const version = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12);
const worker = path.join(root, 'sw.js');
const original = await readFile(worker, 'utf8');
if (!original.includes('__VERSION__')) throw new Error('Expected service worker version placeholder');
await writeFile(worker, original.replaceAll('__VERSION__', version));
console.log('Static app ready in dist/: ' + assets.length + ' assets precached. No deployment performed.');
