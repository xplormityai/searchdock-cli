import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('bundled MCP speaks stdio protocol, exposes read-only tools and handles disconnected profiles', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'searchdock-mcp-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const client = new Client({ name: 'searchdock-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/cli.cjs'), 'mcp'], env: { ...process.env, SEARCHDOCK_CONFIG_DIR: directory }, stderr: 'pipe' });
  let diagnostics = '';
  transport.stderr?.on('data', chunk => { diagnostics += chunk.toString(); });
  await client.connect(transport);
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.equal(tools.length, 5);
  assert.ok(tools.every(tool => tool.annotations.readOnlyHint === true));
  const result = await client.callTool({ name: 'searchdock_sites', arguments: {} });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /not connected/);
  assert.equal(diagnostics, '');
});
