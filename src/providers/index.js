import { GoogleProvider } from './google.js';
import { SearchDockError } from '../errors.js';

// Providers expose only their implemented capabilities. Add Bing here when its adapter is ready.
export const providers = Object.freeze({
  google: { label: 'Google Search Console', capabilities: ['sites', 'analytics', 'sitemaps', 'inspect', 'report'], create: options => new GoogleProvider(options) }
});

export function createProvider(name, options) {
  const provider = providers[name];
  if (!provider) throw new SearchDockError(`Provider "${name}" is not supported. Available: ${Object.keys(providers).join(', ')}. Bing support is planned.`);
  return provider.create(options);
}
