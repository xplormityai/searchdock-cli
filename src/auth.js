import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { requestJson } from './http.js';
import { SearchDockError } from './errors.js';

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

export function sameState(actual, expected) {
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function exchangeToken(fields, fetcher) {
  const result = await requestJson('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString()
  }, fetcher);
  // Google may omit scope on a refresh; only accept the exact grant when it is present.
  if (!result.access_token || (result.scope && new Set(result.scope.split(/\s+/)).size !== 1) || (result.scope && result.scope.trim() !== GOOGLE_SCOPE)) {
    throw new SearchDockError('Google did not grant the required read-only Search Console scope.');
  }
  return result;
}

export function openBrowser(url) {
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.on('error', () => reject(new SearchDockError('Could not open your browser. Retry with --no-browser.')));
    child.on('exit', code => code === 0 ? resolve() : reject(new SearchDockError('Could not open your browser. Retry with --no-browser.')));
  });
}

export async function consent(client, { browser = openBrowser, timeout = 300_000, onUrl = () => {} } = {}) {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  let timer, finish;
  const callback = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const valid = req.method === 'GET' && url.pathname === '/callback' && sameState(url.searchParams.get('state') || '', state);
    res.writeHead(valid ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(valid ? 'SearchDock received the response. Return to your terminal.' : 'Invalid sign-in response.');
    if (!valid) return;
    if (url.searchParams.has('error') || !url.searchParams.get('code')) finish.reject(new SearchDockError('Google sign-in was declined. Run auth login to retry.'));
    else finish.resolve(url.searchParams.get('code'));
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new SearchDockError('Could not start the local sign-in callback.')));
    server.listen(0, '127.0.0.1', resolve);
  });
  const redirect = `http://127.0.0.1:${server.address().port}/callback`;
  const params = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope: GOOGLE_SCOPE, state,
    code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  timer = setTimeout(() => finish.reject(new SearchDockError('Google sign-in timed out. Run auth login to retry.')), timeout);
  try {
    // Start awaiting before launching a browser so callback rejection never goes unhandled.
    const code = await Promise.all([callback, Promise.resolve().then(() => { onUrl(url); return browser?.(url); })]).then(([value]) => value);
    return { code, code_verifier: verifier, redirect_uri: redirect };
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

export async function login(store, profile, clientFile, options = {}) {
  if (!clientFile) throw new SearchDockError('Provide --client-file with a Google OAuth Desktop app JSON file.');
  let client;
  try { client = JSON.parse((await readFile(clientFile, 'utf8')).replace(/^\uFEFF/, '')).installed; }
  catch { throw new SearchDockError('The Google OAuth client file could not be read.'); }
  if (!client?.client_id || !client.client_secret) throw new SearchDockError('Use an OAuth client of type Desktop app, not a web app or service account.');
  const auth = await consent(client, options);
  const result = await exchangeToken({ ...auth, client_id: client.client_id, client_secret: client.client_secret, grant_type: 'authorization_code' }, options.fetcher);
  if (!result.refresh_token || result.scope !== GOOGLE_SCOPE) throw new SearchDockError('Google did not return a read-only offline grant. Run auth login again.');
  const data = await store.read(profile, true);
  data.google.credentials = { client_id: client.client_id, client_secret: client.client_secret, refresh_token: result.refresh_token, scope: GOOGLE_SCOPE };
  await store.write(profile, data);
  return { connected: true, profile, provider: 'google', scope: GOOGLE_SCOPE };
}

export async function accessToken(credentials, fetcher) {
  if (!credentials?.client_id || !credentials.client_secret || !credentials.refresh_token || credentials.scope !== GOOGLE_SCOPE) {
    throw new SearchDockError('This profile is not connected with read-only access. Run searchdock auth login.');
  }
  return (await exchangeToken({ client_id: credentials.client_id, client_secret: credentials.client_secret, refresh_token: credentials.refresh_token, grant_type: 'refresh_token' }, fetcher)).access_token;
}
