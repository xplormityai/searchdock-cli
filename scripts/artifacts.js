import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('dist/releases', { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
// npm.cmd needs the command interpreter on Windows; no user supplied shell input is used.
execFileSync(npm, ['pack', '--pack-destination', 'dist/releases'], { stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync(process.env.PYTHON || 'python', ['-m', 'build', 'python', '--outdir', 'dist/releases'], { stdio: 'inherit' });
execFileSync(process.env.PYTHON || 'python', ['scripts/bundles.py', pkg.version], { stdio: 'inherit' });
execFileSync(process.env.PYTHON || 'python', ['scripts/build_mcpb.py'], { stdio: 'inherit' });
await copyFile('server.json', 'dist/releases/server.json');
const { readdir } = await import('node:fs/promises');
const hashes = [];
for (const file of (await readdir('dist/releases')).sort()) {
  if (file === 'SHA256SUMS') continue;
  const content = await readFile(join('dist/releases', file));
  hashes.push(`${createHash('sha256').update(content).digest('hex')}  ${file}`);
}
await writeFile('dist/releases/SHA256SUMS', hashes.join('\n') + '\n');
console.log('Release packages, plugin/skill archives and SHA256SUMS are in dist/releases.');
