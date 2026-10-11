import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { analyticsBody, dateRange, GoogleProvider } from '../src/providers/google.js';
import { createProvider } from '../src/providers/index.js';
import { Store } from '../src/storage.js';
import { consent, exchangeToken, GOOGLE_SCOPE } from '../src/auth.js';
import { requestJson } from '../src/http.js';
import { run } from '../src/cli.js';
import { selectSite } from '../src/service.js';

const credentials = { client_id: 'test-client', client_secret: 'test-secret', refresh_token: 'test-refresh', scope: GOOGLE_SCOPE };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const refresh = () => reply({ access_token: 'test-access', scope: GOOGLE_SCOPE });
async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'searchdock-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('default window uses Pacific date, accounts for processing and validates real dates', () => {
  assert.deepEqual(dateRange({ days: 28 }, new Date('2026-10-11T01:00:00Z')), { start: '2026-09-10', end: '2026-10-07' });
  assert.throws(() => dateRange({ start: '2026-02-30', end: '2026-03-01' }), /valid/);
  assert.throws(() => dateRange({ start: '2026-01-01' }), /both/);
  assert.throws(() => dateRange({ days: 0 }), /between/);
});

test('brand values are escaped as literal RE2 expressions and dimensions are validated', () => {
  const body = analyticsBody({ brand: 'A+B (AI)?' });
  assert.equal(body.dimensionFilterGroups[0].filters[0].expression, '(?i)^A\\+B \\(AI\\)\\?$');
  assert.equal(body.dataState, 'final');
  assert.throws(() => analyticsBody({ dimensions: ['query', 'query'] }), /unique/);
  assert.throws(() => analyticsBody({ dimensions: ['hour'] }), /Hourly/);
  assert.throws(() => analyticsBody({ brand: '' }), /nonempty/);
});

test('OAuth rejects invalid state and accepts only a matching callback with PKCE', async () => {
  let authorization;
  const result = await consent(credentials, { timeout: 5000, browser: async value => {
    authorization = new URL(value);
    const redirect = authorization.searchParams.get('redirect_uri');
    const invalid = await fetch(`${redirect}?state=wrong&code=bad`);
    assert.equal(invalid.status, 400);
    const valid = await fetch(`${redirect}?state=${authorization.searchParams.get('state')}&code=test-code`);
    assert.equal(valid.status, 200);
  } });
  assert.equal(result.code, 'test-code');
  assert.equal(authorization.searchParams.get('scope'), GOOGLE_SCOPE);
  assert.equal(authorization.searchParams.get('code_challenge'), createHash('sha256').update(result.code_verifier).digest('base64url'));
  assert.match(result.redirect_uri, /^http:\/\/127\.0\.0\.1:\d+\/callback$/);
});

test('OAuth timeout and denied consent close the local callback', async () => {
  await assert.rejects(consent(credentials, { timeout: 30, browser: null }), /timed out/);
  await assert.rejects(consent(credentials, { timeout: 5000, browser: async value => {
    const url = new URL(value);
    await fetch(`${url.searchParams.get('redirect_uri')}?state=${url.searchParams.get('state')}&error=access_denied`);
  } }), /declined/);
});

test('Google token exchange rejects broad scope, accepts omitted refresh scope, and sanitizes errors', async () => {
  await assert.rejects(exchangeToken({}, async () => reply({ access_token: 'SECRET', scope: `${GOOGLE_SCOPE} cloud-platform` })), /read-only/);
  assert.equal((await exchangeToken({}, async () => reply({ access_token: 'test' }))).access_token, 'test');
  await assert.rejects(requestJson('https://www.googleapis.com/test', {}, async () => reply({ error: { message: 'DO-NOT-LEAK', details: [{ reason: 'SERVICE_DISABLED' }] } }, 403)), error => error.message.includes('SERVICE_DISABLED') && !error.message.includes('DO-NOT-LEAK'));
  await assert.rejects(requestJson('https://attacker.invalid/test'), /not allowed/);
});

test('analytics paginates correctly and refreshes once across concurrent requests', async () => {
  const offsets = []; let refreshes = 0;
  const provider = new GoogleProvider({ credentials, fetcher: async (url, options) => {
    if (url.includes('oauth2')) { refreshes++; return refresh(); }
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    const body = JSON.parse(options.body); offsets.push(body.startRow);
    return reply({ rows: Array.from({ length: body.startRow ? 2 : 25000 }, (_, index) => ({ keys: [`query-${body.startRow + index}`], clicks: 0, impressions: 1, ctr: 0, position: 5 })) });
  } });
  const result = await provider.analytics('sc-domain:example.com', { limit: 30000 });
  assert.deepEqual(offsets, [0, 25000]);
  assert.equal(result.rows.length, 25002);
  assert.equal(result.limitReached, false);
  await Promise.all([provider.analytics('sc-domain:example.com', { limit: 1 }), provider.analytics('sc-domain:example.com', { limit: 1 })]);
  assert.equal(refreshes, 1);
});

test('report uses aggregate totals and flags only returned sitemap and inspected URL evidence', async () => {
  const provider = new GoogleProvider({ credentials, fetcher: async (url, options) => {
    if (url.includes('oauth2')) return refresh();
    if (url.endsWith('/sitemaps')) return reply({ sitemap: [{ path: 'https://example.com/sitemap.xml', errors: '2', warnings: '1', isPending: true }] });
    if (url.includes('index:inspect')) return reply({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'URL is unknown to Google' } } });
    const body = JSON.parse(options.body);
    return reply({ rows: [{ clicks: body.dimensions.length ? 2 : 3, impressions: body.dimensions.length ? 10 : 100, ctr: 0.03, position: 5 }] });
  } });
  const result = await provider.report('sc-domain:example.com', { urls: ['https://example.com/'] });
  assert.equal(result.summary.impressions, 100);
  assert.deepEqual(result.issues.map(item => item.kind), ['sitemap_errors', 'sitemap_warnings', 'sitemap_pending', 'index_inspection']);
  assert.match(result.note, /not the full Page indexing/);
});

test('store handles profiles and refuses traversal; default selection verifies exact access', async t => {
  const store = new Store(await temporary(t));
  await store.write('work', { version: 1, google: { credentials } });
  assert.equal((await store.read('work')).google.credentials.refresh_token, 'test-refresh');
  assert.throws(() => store.path('../escape'), /Profile names/);
  const fetcher = async url => url.includes('oauth2') ? refresh() : reply({ siteEntry: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }, { siteUrl: 'sc-domain:unverified.com', permissionLevel: 'siteUnverifiedUser' }] });
  await assert.rejects(selectSite('sc-domain:wrong.com', { store, profile: 'work', fetcher }), /verified access/);
  await selectSite('sc-domain:example.com', { store, profile: 'work', fetcher });
  assert.equal((await store.read('work')).google.site, 'sc-domain:example.com');
  await store.remove('work');
  await assert.rejects(store.read('work'), /not connected/);
});

test('CLI JSON results and errors remain separate; output cannot overwrite an existing file', async t => {
  const directory = await temporary(t); const store = new Store(join(directory, 'config'));
  let stdout = '', stderr = '';
  const streams = { stdout: { write: text => { stdout += text; } }, stderr: { write: text => { stderr += text; } }, store };
  assert.equal(await run(['providers', '--json'], streams), 0);
  assert.equal(JSON.parse(stdout).providers[0].id, 'google'); assert.equal(stderr, '');
  stdout = ''; stderr = '';
  assert.equal(await run(['unknown', '--json'], streams), 1);
  assert.equal(stdout, ''); assert.match(JSON.parse(stderr).error.message, /Unknown command/);
  const output = join(directory, 'report.json');
  assert.equal(await run(['providers', '--output', output, '--json'], streams), 0);
  const before = await readFile(output, 'utf8');
  assert.equal(await run(['providers', '--output', output, '--json'], streams), 1);
  assert.equal(await readFile(output, 'utf8'), before);
  assert.throws(() => createProvider('bing', {}), /planned/);
});
