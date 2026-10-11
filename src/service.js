import { Store } from './storage.js';
import { createProvider } from './providers/index.js';
import { validateSite } from './providers/google.js';
import { SearchDockError } from './errors.js';

export async function context({ profile = 'default', provider = 'google', site, store = new Store(), fetcher } = {}) {
  const data = await store.read(profile);
  const adapter = createProvider(provider, { credentials: data[provider]?.credentials, fetcher });
  const selected = site || data[provider]?.site;
  return { adapter, data, store, profile, provider, site: selected ? validateSite(selected) : undefined };
}

export async function selectedContext(options = {}) {
  const ctx = await context(options);
  if (!ctx.site) {
    const result = await ctx.adapter.sites();
    if (result.sites.length !== 1) throw new SearchDockError('Choose a property with --site, or run searchdock sites use <property>.');
    ctx.site = result.sites[0].siteUrl;
  }
  return ctx;
}

export async function selectSite(site, options = {}) {
  validateSite(site);
  const ctx = await context(options);
  const result = await ctx.adapter.sites();
  if (!result.sites.some(item => item.siteUrl === site)) throw new SearchDockError('This profile does not have verified access to that exact property. Run searchdock sites list.');
  ctx.data[ctx.provider].site = site;
  await ctx.store.write(ctx.profile, ctx.data);
  return { profile: ctx.profile, provider: ctx.provider, site };
}
