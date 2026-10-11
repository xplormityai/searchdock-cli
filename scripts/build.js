import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, chmod, readdir } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('dist', { recursive: true });
const result = await build({ entryPoints: ['src/main.js'], outfile: 'dist/cli.cjs', platform: 'node', target: 'node22', format: 'cjs', bundle: true,
  minify: true, legalComments: 'eof', metafile: true, banner: { js: '#!/usr/bin/env node' } });
const modules = new Set(Object.keys(result.metafile.inputs).map(path => path.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean));
const notices = ['# Bundled third-party notices\n'];
for (const module of [...modules].sort()) {
  const folder = `node_modules/${module}`;
  const metadata = JSON.parse(await readFile(`${folder}/package.json`, 'utf8'));
  notices.push(`## ${module} ${metadata.version}\n\nLicense: ${metadata.license || 'See package license'}\n`);
  for (const file of (await readdir(folder)).filter(name => /^licen[sc]e(?:[.-]|$)/i.test(name))) notices.push(await readFile(`${folder}/${file}`, 'utf8'));
}
await writeFile('dist/THIRD_PARTY_NOTICES.md', notices.join('\n\n') + '\n');
await chmod('dist/cli.cjs', 0o755);
await mkdir('python/src/searchdock_cli/_core', { recursive: true });
await copyFile('dist/cli.cjs', 'python/src/searchdock_cli/_core/cli.cjs');
await copyFile('dist/THIRD_PARTY_NOTICES.md', 'python/src/searchdock_cli/_core/THIRD_PARTY_NOTICES.md');
await writeFile('python/src/searchdock_cli/_version.py', `__version__ = "${pkg.version}"\n`);
const readme = await readFile('README.md', 'utf8');
await writeFile('python/README.md', readme.replace(/\]\((?!https?:|#)([^)]+)\)/g, '](https://github.com/xplormityai/searchdock-cli/blob/main/$1)'));
await copyFile('LICENSE', 'python/LICENSE');
console.log(`Built SearchDock ${pkg.version}: npm executable and shared Python runtime.`);
