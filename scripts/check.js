import { readFile, readdir } from 'node:fs/promises';
import { VERSION } from '../src/cli.js';
import assert from 'node:assert/strict';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(pkg.version, VERSION);
for (const path of ['plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(manifest.version, pkg.version, `${path}: version mismatch`);
  assert.equal(manifest.author.name, 'Xplormity Collective');
}
const metadata = await readFile('python/pyproject.toml', 'utf8');
assert.ok(metadata.includes(`version = "${pkg.version}"`));
assert.ok((await readFile('python/src/searchdock_cli/_version.py', 'utf8')).includes(pkg.version));
for (const file of ['mcp.json', '.mcp.json']) {
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  assert.ok(manifest.mcpServers.searchdock.args.includes(`searchdock-cli@${pkg.version}`), `${file}: runtime version mismatch`);
}
for (const file of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json']) JSON.parse(await readFile(file, 'utf8'));
for (const folder of await readdir('skills')) {
  const skill = await readFile(`skills/${folder}/SKILL.md`, 'utf8');
  assert.match(skill, /^---\nname: [a-z0-9-]+\ndescription: .+\n---\n/);
}
console.log('Package, Python, plugin and skill metadata are consistent.');
