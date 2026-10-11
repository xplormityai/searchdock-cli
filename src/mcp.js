import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { context, selectedContext } from './service.js';
import { publicError } from './errors.js';
import { VERSION } from './cli.js';

export function createMcpServer(defaults = {}) {
  const server = new McpServer({ name: 'searchdock', version: VERSION });
  const shared = { profile: z.string().optional(), provider: z.enum(['google']).optional(), site: z.string().optional() };
  const reportOptions = { days: z.number().int().min(1).max(365).optional(), start: z.string().optional(), end: z.string().optional(),
    brand: z.string().max(200).optional(), limit: z.number().int().min(1).max(100000).optional() };
  function register(name, description, inputSchema, handler) {
    server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } }, async input => {
      try {
        const result = await handler(input);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) { return { isError: true, content: [{ type: 'text', text: publicError(error) }] }; }
    });
  }
  const ctx = input => selectedContext({ ...defaults, ...input });
  register('searchdock_sites', 'List properties available to an already connected Google Search Console profile.', { profile: shared.profile, provider: shared.provider }, async input => (await context({ ...defaults, ...input })).adapter.sites());
  register('searchdock_analytics', 'Read finalized search performance. Dates use Pacific Time. Missing query rows do not prove zero demand.', { ...shared, ...reportOptions, dimensions: z.array(z.enum(['date', 'query', 'page', 'country', 'device', 'searchAppearance'])).optional(), type: z.enum(['web', 'image', 'video', 'news', 'discover', 'googleNews']).optional() }, async input => { const c = await ctx(input); return c.adapter.analytics(c.site, input); });
  register('searchdock_sitemaps', 'Read sitemap processing status, errors and warnings.', shared, async input => { const c = await ctx(input); return c.adapter.sitemaps(c.site); });
  register('searchdock_inspect', 'Inspect the indexed version of a URL. Cannot perform live tests or request indexing.', { ...shared, url: z.string() }, async input => { const c = await ctx(input); return c.adapter.inspect(c.site, input.url); });
  register('searchdock_report', 'Read search metrics, sitemap issues and optionally indexed status for specific URLs. Does not expose the full Page indexing exclusions report.', { ...shared, ...reportOptions, urls: z.array(z.string()).max(20).optional() }, async input => { const c = await ctx(input); return c.adapter.report(c.site, input); });
  return server;
}

export async function serve(defaults = {}) {
  const server = createMcpServer(defaults);
  await server.connect(new StdioServerTransport());
}
