import { parseArgs } from 'node:util';
import { writeFile, access } from 'node:fs/promises';
import { Store, profileName, configDirectory } from './storage.js';
import { login } from './auth.js';
import { context, selectedContext, selectSite } from './service.js';
import { providers } from './providers/index.js';
import { SearchDockError, publicError } from './errors.js';

export const VERSION = '0.1.1';
const help = `SearchDock CLI ${VERSION} — Google Search Console from your terminal

Usage: searchdock <command> [options]

  auth login --client-file <path>  Connect with read-only Google consent
  auth status                     Check connection and property access
  auth logout                     Remove this profile's local credentials
  sites list                      List verified properties
  sites use <property>            Choose a default property
  analytics                       Search performance, queries and pages
  sitemaps                        Sitemap processing status
  inspect <url>                   Google's indexed version of a URL
  report                          Metrics, sitemaps and optional URL checks
  providers                       Show implemented providers
  doctor                          Check runtime and local profile state
  mcp                             Run the read-only MCP server over stdio

Options:
  --profile <name>                 Local account profile (default: default)
  --provider <name>                Provider (default: google)
  --site <property>                Exact URL-prefix or sc-domain property
  --days <1-365>                   Report window (default: 28)
  --start <YYYY-MM-DD> --end <date> Explicit dates, in Search Console's PT zone
  --dimensions <query,page,...>    Analytics dimensions (default: query)
  --type <web|image|video|news|discover|googleNews>
  --brand <name>                   Exact, case-insensitive brand query filter
  --limit <1-100000>               Maximum rows per breakdown (default: 1000)
  --urls <url,url,...>             URLs to inspect as part of a report
  --json                          Machine-readable output
  --output <path>                  Save JSON to a new file (no overwrite)
  --no-browser                    Print a sign-in URL instead of opening it
  --help, --version

Examples:
  searchdock sites use sc-domain:example.com
  searchdock analytics --dimensions page --days 28 --json
  searchdock report --brand Example --urls https://example.com/ --json

Google support is available. Bing support is planned.
`;

function numeric(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new SearchDockError(`${label} must be a positive integer.`);
  return Number(value);
}

export function parse(argv) {
  try {
    const stringNames = ['profile', 'provider', 'site', 'days', 'start', 'end', 'dimensions', 'type', 'brand', 'limit', 'urls', 'output', 'client-file'];
    const booleanNames = ['json', 'help', 'version', 'no-browser'];
    const options = Object.fromEntries([...stringNames.map(name => [name, { type: 'string' }]), ...booleanNames.map(name => [name, { type: 'boolean' }])]);
    return parseArgs({ args: argv, options, allowPositionals: true });
  } catch { throw new SearchDockError('Invalid command options. Run searchdock --help.'); }
}

function table(rows) {
  if (!rows.length) return 'No rows returned.';
  const textRows = rows.map(row => row.map(value => String(value ?? '—').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 100)));
  const widths = textRows[0].map((_, index) => Math.max(...textRows.map(row => row[index].length)));
  return textRows.map(row => row.map((value, index) => value.padEnd(widths[index])).join('  ').trimEnd()).join('\n');
}

export function format(result) {
  if (result.rows) return `${result.site} · ${result.range.start} to ${result.range.end}\n${table([
    [...result.dimensions, 'Clicks', 'Impressions', 'CTR', 'Position'],
    ...result.rows.map(row => [...(row.keys || []), row.clicks, row.impressions, `${(row.ctr * 100).toFixed(2)}%`, row.impressions ? row.position.toFixed(2) : '—'])
  ])}\n${result.note}${result.limitReached ? '\nRow limit reached; increase --limit for more rows.' : ''}`;
  if (result.sites) return table([['Property', 'Permission'], ...result.sites.map(item => [item.siteUrl, item.permissionLevel])]);
  if (result.inspectionResult) {
    const status = result.inspectionResult.indexStatusResult || {};
    return `${result.url}\n${table([['Index status', status.coverageState], ['Verdict', status.verdict], ['Last crawl', status.lastCrawlTime], ['Google canonical', status.googleCanonical]])}\n${result.note}`;
  }
  if (result.summary !== undefined) {
    const summary = result.summary;
    return `${result.site} · ${result.range.start} to ${result.range.end}\n${summary ? `${summary.clicks} clicks · ${summary.impressions} impressions · ${(summary.ctr * 100).toFixed(2)}% CTR · position ${summary.impressions ? summary.position.toFixed(2) : '—'}` : 'No aggregate metrics returned.'}\n${result.issues.length} reported issue(s)\n${result.issues.map(item => `${item.kind}: ${item.url || item.path}${item.coverageState ? ` — ${item.coverageState}` : ''}`).join('\n')}\n${result.note}`;
  }
  if (result.sitemaps) return table([['Sitemap', 'Pending', 'Errors', 'Warnings', 'Last downloaded'], ...result.sitemaps.map(item => [item.path, Boolean(item.isPending), item.errors || 0, item.warnings || 0, item.lastDownloaded])]);
  return JSON.stringify(result, null, 2);
}

export async function run(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, store = new Store(), fetcher } = {}) {
  let json = argv.includes('--json');
  try {
    const { values, positionals } = parse(argv);
    json = values.json;
    if (values.version) { stdout.write(`${VERSION}\n`); return 0; }
    if (values.help || !positionals.length) { stdout.write(help); return 0; }
    const [command, subcommand, ...rest] = positionals;
    const profile = profileName(values.profile), provider = values.provider || 'google';
    const options = { profile, provider, site: values.site, store, fetcher };
    let result;
    if (command === 'mcp') {
      if (values.output || values.json || positionals.length !== 1) throw new SearchDockError('Run mcp without --json, --output or positional arguments.');
      const { serve } = await import('./mcp.js');
      await serve(options); return 0;
    } else if (command === 'providers') {
      result = { providers: Object.entries(providers).map(([id, item]) => ({ id, name: item.label, capabilities: item.capabilities })), planned: ['bing'] };
    } else if (command === 'doctor') {
      const data = await store.read(profile, true);
      result = { version: VERSION, node: process.versions.node, configDirectory: store.directory || configDirectory(), profile, provider,
        connectedLocally: Boolean(data[provider]?.credentials?.refresh_token), selectedSite: data[provider]?.site || null,
        note: 'Local configuration check only. Run auth status to verify Google access.' };
    } else if (command === 'auth') {
      if (rest.length) throw new SearchDockError('Unexpected auth arguments. Run searchdock --help.');
      if (subcommand === 'login') {
        if (provider !== 'google') throw new SearchDockError('Only Google authentication is implemented.');
        if (json) throw new SearchDockError('Interactive login does not support --json.');
        stderr.write('Complete read-only Google Search Console consent in your browser.\n');
        result = await login(store, profile, values['client-file'], { browser: values['no-browser'] ? null : undefined,
          onUrl: url => { if (values['no-browser']) stderr.write(`Open this sign-in URL locally; do not share it:\n${url}\n`); }, fetcher });
      } else if (subcommand === 'logout') {
        await store.remove(profile); result = { profile, removedLocalCredentials: true, note: 'To revoke Google access too, remove the OAuth app in your Google Account permissions.' };
      } else if (subcommand === 'status') {
        const ctx = await context(options); const sites = await ctx.adapter.sites();
        result = { connected: true, provider, profile, selectedSite: ctx.site || null, ...sites };
      } else throw new SearchDockError('Use auth login, auth status or auth logout.');
    } else if (command === 'sites') {
      if (subcommand === 'use' && rest.length === 1) result = await selectSite(rest[0], options);
      else if (subcommand === 'list' && !rest.length) result = await (await context(options)).adapter.sites();
      else throw new SearchDockError('Use sites list or sites use <property>.');
    } else if (['analytics', 'sitemaps', 'inspect', 'report'].includes(command)) {
      if (command === 'inspect' ? positionals.length !== 2 : positionals.length !== 1) throw new SearchDockError('Unexpected or missing positional arguments. Run searchdock --help.');
      const query = { days: numeric(values.days, 28, 'Days'), start: values.start, end: values.end,
        dimensions: values.dimensions?.split(','), type: values.type, brand: values.brand, limit: numeric(values.limit, 1000, 'Limit'), urls: values.urls?.split(',') };
      const ctx = await selectedContext(options);
      result = command === 'inspect' ? await ctx.adapter.inspect(ctx.site, subcommand) : command === 'sitemaps' ? await ctx.adapter.sitemaps(ctx.site) : await ctx.adapter[command](ctx.site, query);
    } else throw new SearchDockError(`Unknown command "${command}". Run searchdock --help.`);
    if (values.output) {
      try { await access(values.output); throw new SearchDockError('The output file already exists. Choose a new path.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await writeFile(values.output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    stdout.write((json ? JSON.stringify(result, null, 2) : format(result)) + '\n');
    return 0;
  } catch (error) {
    stderr.write((json ? JSON.stringify({ error: { code: error.code?.startsWith?.('GOOGLE_') ? error.code : 'SEARCHDOCK_ERROR', message: publicError(error) } }) : `SearchDock: ${publicError(error)}`) + '\n');
    return 1;
  }
}
