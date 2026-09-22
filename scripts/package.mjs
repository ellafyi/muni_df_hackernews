import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { ZipArchive } from 'archiver';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const archivePath = `artifacts/forum-newsreader-v${version}.zip`;

await mkdir('artifacts', { recursive: true });

await new Promise((resolve, reject) => {
  const output = createWriteStream(archivePath);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  output.on('close', resolve);
  output.on('error', reject);
  archive.on('warning', reject);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory('dist/', false);
  void archive.finalize();
});

console.log(`Created ${archivePath}`);
