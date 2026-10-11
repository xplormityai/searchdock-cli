import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';

// Optional online compatibility check against the portable plugin specifications.
for (const name of ['plugin', 'mcp']) {
  const response = await fetch(`https://agent-plugins.org/schemas/1.0.0/${name}.schema.json`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Could not fetch ${name} schema: ${response.status}`);
  const schema = await response.json();
  const validate = new Ajv2020({ strict: false }).compile(schema);
  const manifest = JSON.parse(await readFile(`${name}.json`, 'utf8'));
  if (!validate(manifest)) throw new Error(JSON.stringify(validate.errors));
}
console.log('Portable plugin and MCP manifests match their official schemas.');
