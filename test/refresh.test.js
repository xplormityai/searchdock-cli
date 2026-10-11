import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleProvider } from '../src/providers/google.js';
import { GOOGLE_SCOPE } from '../src/auth.js';

test('expired access tokens refresh once and retry the read request', async () => {
  let refreshes = 0, requests = 0;
  const provider = new GoogleProvider({ credentials: { client_id: 'test', client_secret: 'test', refresh_token: 'test', scope: GOOGLE_SCOPE },
    fetcher: async url => {
      if (url.includes('oauth2')) { refreshes++; return new Response(JSON.stringify({ access_token: `access-${refreshes}`, scope: GOOGLE_SCOPE })); }
      requests++;
      return new Response(JSON.stringify(requests === 1 ? { error: {} } : { siteEntry: [] }), { status: requests === 1 ? 401 : 200 });
    }
  });
  await provider.sites();
  assert.equal(refreshes, 2);
  assert.equal(requests, 2);
});

test('a transient refresh failure does not poison later reads', async () => {
  let refreshes = 0;
  const provider = new GoogleProvider({ credentials: { client_id: 'test', client_secret: 'test', refresh_token: 'test', scope: GOOGLE_SCOPE },
    fetcher: async url => {
      if (url.includes('oauth2')) {
        refreshes++;
        if (refreshes === 1) throw new Error('Network unavailable');
        return new Response(JSON.stringify({ access_token: 'test', scope: GOOGLE_SCOPE }));
      }
      return new Response(JSON.stringify({ siteEntry: [] }));
    }
  });
  await assert.rejects(provider.sites(), /could not be reached/);
  await provider.sites();
  assert.equal(refreshes, 2);
});
