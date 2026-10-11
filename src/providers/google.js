import { accessToken } from '../auth.js';
import { requestJson } from '../http.js';
import { SearchDockError } from '../errors.js';

const dimensions = new Set(['date', 'query', 'page', 'country', 'device', 'searchAppearance', 'hour']);
const types = new Set(['web', 'image', 'video', 'news', 'discover', 'googleNews']);
const permissions = new Set(['siteOwner', 'siteFullUser', 'siteRestrictedUser']);

export function validateSite(site) {
  if (typeof site !== 'string' || site.length > 2048) throw new SearchDockError('Provide a Search Console property URL or sc-domain:example.com.');
  if (/^sc-domain:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(site)) return site;
  try { const url = new URL(site); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.hash && !url.search) return site; } catch {}
  throw new SearchDockError('Provide the exact Search Console property, such as https://example.com/ or sc-domain:example.com.');
}

export function validateUrl(value) {
  try { const url = new URL(value); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash) return value; } catch {}
  throw new SearchDockError('Provide an HTTP or HTTPS page URL without credentials or a fragment.');
}

export function dateRange({ days = 28, start, end } = {}, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new SearchDockError('Days must be an integer between 1 and 365.');
  if (Boolean(start) !== Boolean(end)) throw new SearchDockError('Provide both --start and --end.');
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (start) {
    if (!valid(start) || !valid(end) || start > end) throw new SearchDockError('Use valid YYYY-MM-DD dates with start on or before end.');
    return { start, end };
  }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const finish = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  finish.setUTCDate(finish.getUTCDate() - 3);
  const begin = new Date(finish); begin.setUTCDate(begin.getUTCDate() - days + 1);
  return { start: begin.toISOString().slice(0, 10), end: finish.toISOString().slice(0, 10) };
}

export function analyticsBody(options = {}) {
  const range = dateRange(options);
  const dims = options.dimensions || ['query'];
  if (!Array.isArray(dims) || dims.some(value => !dimensions.has(value)) || new Set(dims).size !== dims.length) throw new SearchDockError('Use unique supported dimensions: date, query, page, country, device, searchAppearance or hour.');
  if (!types.has(options.type || 'web')) throw new SearchDockError('Unsupported search type. Use web, image, video, news, discover or googleNews.');
  if (dims.includes('hour')) throw new SearchDockError('Hourly fresh data is not available in this finalized-data report.');
  const body = { startDate: range.start, endDate: range.end, dimensions: dims, type: options.type || 'web', dataState: 'final' };
  if (options.brand !== undefined) {
    if (typeof options.brand !== 'string' || !options.brand.trim() || options.brand.length > 200) throw new SearchDockError('Brand must be a nonempty string of at most 200 characters.');
    const escaped = options.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body.dimensionFilterGroups = [{ filters: [{ dimension: 'query', operator: 'includingRegex', expression: `(?i)^${escaped}$` }] }];
  }
  return body;
}

export class GoogleProvider {
  constructor({ credentials, fetcher } = {}) { this.credentials = credentials; this.fetcher = fetcher; this.token = null; this.tokenCreated = 0; }
  refreshToken() {
    this.tokenCreated = Date.now();
    this.token = accessToken(this.credentials, this.fetcher).catch(error => { this.token = null; throw error; });
    return this.token;
  }
  async request(url, body) {
    if (this.token && Date.now() - this.tokenCreated > 30 * 60 * 1000) this.token = null;
    if (!this.token) this.refreshToken();
    const token = await this.token;
    const options = { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    try { return await requestJson(url, options, this.fetcher); }
    catch (error) {
      if (error.code !== 'GOOGLE_HTTP_401') throw error;
      this.refreshToken();
      options.headers.Authorization = `Bearer ${await this.token}`;
      return requestJson(url, options, this.fetcher);
    }
  }
  async sites() {
    const data = await this.request('https://www.googleapis.com/webmasters/v3/sites');
    return { provider: 'google', sites: (data.siteEntry || []).filter(site => permissions.has(site.permissionLevel)) };
  }
  base(site) { return `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(validateSite(site))}`; }
  async analytics(site, options = {}) {
    const body = analyticsBody(options);
    const limit = options.limit ?? 1000;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100000) throw new SearchDockError('Limit must be an integer between 1 and 100000.');
    const rows = []; let complete = false, aggregationType;
    while (rows.length < limit) {
      const count = Math.min(25000, limit - rows.length);
      const result = await this.request(`${this.base(site)}/searchAnalytics/query`, { ...body, startRow: rows.length, rowLimit: count });
      aggregationType = result.responseAggregationType || aggregationType;
      const page = result.rows || [];
      rows.push(...page);
      if (page.length < count) { complete = true; break; }
    }
    return { provider: 'google', site, range: { start: body.startDate, end: body.endDate }, dimensions: body.dimensions, type: body.type,
      dataState: 'final', rows, aggregationType, limitReached: !complete, ...(options.brand === undefined ? {} : { brand: { value: options.brand, match: 'exact_case_insensitive' } }),
      note: 'Search Console returns top rows and omits some anonymized queries. Missing rows do not prove zero demand; pagination does not recover all omitted data.' };
  }
  async sitemaps(site) {
    const result = await this.request(`${this.base(site)}/sitemaps`);
    return { provider: 'google', site, sitemaps: result.sitemap || [] };
  }
  async inspect(site, url) {
    validateSite(site); validateUrl(url);
    const result = await this.request('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { siteUrl: site, inspectionUrl: url, languageCode: 'en-US' });
    return { provider: 'google', site, url, ...result, note: 'This is Google’s indexed version. The API cannot test a live URL or request indexing.' };
  }
  async report(site, options = {}) {
    if (options.urls && (!Array.isArray(options.urls) || options.urls.length > 20)) throw new SearchDockError('A report can inspect up to 20 explicit URLs.');
    for (const url of options.urls || []) validateUrl(url);
    const [totals, queries, pages, sitemaps] = await Promise.all([
      this.analytics(site, { ...options, dimensions: [] }), this.analytics(site, { ...options, dimensions: ['query'] }),
      this.analytics(site, { ...options, dimensions: ['page'] }), this.sitemaps(site)
    ]);
    const inspections = [];
    for (const url of options.urls || []) inspections.push(await this.inspect(site, url));
    const issues = [];
    for (const sitemap of sitemaps.sitemaps) {
      if (Number(sitemap.errors) > 0) issues.push({ kind: 'sitemap_errors', path: sitemap.path, count: Number(sitemap.errors) });
      if (Number(sitemap.warnings) > 0) issues.push({ kind: 'sitemap_warnings', path: sitemap.path, count: Number(sitemap.warnings) });
      if (sitemap.isPending) issues.push({ kind: 'sitemap_pending', path: sitemap.path });
    }
    for (const inspection of inspections) {
      const status = inspection.inspectionResult?.indexStatusResult;
      if (status && status.verdict !== 'PASS') issues.push({ kind: 'index_inspection', url: inspection.url, verdict: status.verdict, coverageState: status.coverageState });
    }
    return { provider: 'google', site, generatedAt: new Date().toISOString(), range: totals.range, ...(totals.brand ? { brand: totals.brand } : {}),
      summary: totals.rows[0] || null, queries, pages, sitemaps: sitemaps.sitemaps, inspections, issues,
      note: 'Issues cover only the returned sitemap data and explicitly inspected URLs. This is not the full Page indexing report. Zero impressions means average position cannot be interpreted.' };
  }
}
