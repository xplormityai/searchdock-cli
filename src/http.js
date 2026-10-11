import { SearchDockError } from './errors.js';

const reasons = new Set(['SERVICE_DISABLED', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'IAM_PERMISSION_DENIED', 'RATE_LIMIT_EXCEEDED']);

export async function requestJson(url, options = {}, fetcher = globalThis.fetch) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['www.googleapis.com', 'searchconsole.googleapis.com', 'oauth2.googleapis.com'].includes(parsed.hostname)) {
    throw new SearchDockError('The provider request endpoint is not allowed.');
  }
  let response;
  try { response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
  catch { throw new SearchDockError('Google could not be reached. Check your network connection.'); }
  let result;
  try { result = await response.json(); }
  catch { throw new SearchDockError(`Google returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const codes = (result?.error?.details || []).map(item => item.reason).filter(value => reasons.has(value));
    const advice = response.status === 401 ? ' Reconnect with searchdock auth login.' : response.status === 429 ? ' Try again after the quota resets.' : '';
    throw new SearchDockError(`Google returned HTTP ${response.status}${codes.length ? ` (${codes.join(', ')})` : ''}.${advice}`, `GOOGLE_HTTP_${response.status}`);
  }
  return result;
}
