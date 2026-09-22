import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
manifest.version = packageJson.version;

await mkdir('dist/src', { recursive: true });
await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

for (const file of [
  'src/forum-newsreader.css',
  'src/options.css',
  'src/options.html',
  'src/popup.css',
  'src/popup.html'
]) {
  await cp(file, `dist/${file}`);
}
