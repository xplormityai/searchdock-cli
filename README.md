# SearchDock CLI — Google Search Console CLI

Read Google Search Console analytics, inspect indexed URLs, and monitor sitemaps from your terminal or AI agent.

SearchDock is open source, runs locally, and requests read-only Google access. Use the same core through npm, Python, MCP, a Codex or Claude Code plugin, or a standalone agent skill. **Bing Webmaster Tools support is planned.**

## Install

Node.js **22 or later** is required for every distribution.

```sh
# npm: after the first npm release
npm install --global searchdock-cli
searchdock --help

# No global installation: after the first npm release
npx --yes searchdock-cli@0.1.0 --help

# Python: after the first PyPI release; Node.js is still required
pipx install searchdock-cli
# Alternatively: python -m pip install searchdock-cli
```

The Python package is a launcher containing the exact same JavaScript runtime. It has no separate Google implementation. If you install both packages, use `python -m searchdock_cli` to select the Python launcher explicitly.

Before packages are published, run from source:

```sh
git clone https://github.com/xplormityai/searchdock-cli.git
cd searchdock-cli
npm ci
npm run build
node dist/cli.cjs --help
```

## Connect Google Search Console

Create a Google OAuth **Desktop app** client in your own Google Cloud project, enable the Search Console API, and download the client JSON. See [Google setup](docs/google-setup.md) for the steps and testing-mode limits. No shared developer credentials are included.

```sh
searchdock auth login --client-file /path/to/desktop-client.json
searchdock sites list
searchdock sites use sc-domain:example.com
searchdock auth status
```

Google opens a local browser consent flow. SearchDock uses PKCE, validates the callback state, and listens only on `127.0.0.1`. It requests `webmasters.readonly` and keeps the refresh token in your operating system's per-user configuration directory, outside this repository. Credentials are stored as permission-protected local JSON, **not encrypted by SearchDock**. See [privacy](docs/privacy.md).

## Commands

```sh
# Search performance and top queries
searchdock analytics --days 28
searchdock analytics --dimensions page --days 28 --json
searchdock analytics --dimensions date --start 2026-09-01 --end 2026-09-30

# Exact, case-insensitive brand queries
searchdock analytics --brand "Your Brand" --json

# Sitemaps and Google's indexed URL status
searchdock sitemaps
searchdock inspect https://example.com/

# Combined report, including only the URLs you specify
searchdock report --urls https://example.com/,https://example.com/about --json
searchdock report --output ./private-report.json

# Multiple accounts/sites
searchdock auth login --client-file /path/to/client.json --profile work
searchdock sites use https://example.com/ --profile work
searchdock analytics --profile work --site https://example.com/ --json

# Diagnostics and local credential removal
searchdock doctor
searchdock auth logout
```

`--json` writes machine-readable results to stdout and errors to stderr with a nonzero exit status. `--output` saves JSON to a **new** file and refuses to overwrite an existing one. Keep private reports out of Git yourself. CSV is not yet supported. For URLs containing commas, use the MCP `urls` array or the JavaScript API for batch inspection.

Report windows default to 28 days ending three days before today in **Pacific Time**, to allow for Search Console processing. You can specify exact dates. Finalized data may still lag. Pagination supports up to 100,000 requested rows, but Google's API returns top rows and omits some anonymized query data. Missing rows do not prove zero demand; zero impressions make average position meaningless.

## AI agents and MCP

SearchDock provides five read-only MCP tools: `searchdock_sites`, `searchdock_analytics`, `searchdock_sitemaps`, `searchdock_inspect`, and `searchdock_report`. Authenticate locally first; MCP tools do not start consent or change account settings.

After the npm release, add this stdio server to any compatible MCP client:

```json
{
  "mcpServers": {
    "searchdock": {
      "command": "npx",
      "args": ["--yes", "searchdock-cli@0.1.0", "mcp"]
    }
  }
}
```

For a source checkout, set `command` to `node` and `args` to `["/absolute/path/searchdock-cli/dist/cli.cjs", "mcp"]`. Windows clients that launch `npx.cmd` through a shell may need `command: "cmd"` and `args: ["/c", "npx", "--yes", "searchdock-cli@0.1.0", "mcp"]`. Use your client's Windows configuration guidance.

Plugins use the same pinned npm version. Install them **after the npm package is published**:

```sh
# Codex CLI
codex plugin marketplace add xplormityai/searchdock-cli
codex plugin add searchdock@searchdock
```

In Claude Code:

```text
/plugin marketplace add xplormityai/searchdock-cli
/plugin install searchdock@searchdock
```

For a standalone skill, copy [`skills/searchdock`](skills/searchdock) into your agent's skills directory. Codex uses `~/.agents/skills/`; Claude Code uses `~/.claude/skills/`. Install the CLI separately. The setup skill is included in the plugin. The repository includes portable Agent Plugins, Codex and Claude manifests; local stdio plugins are not automatically listed in hosted plugin directories.

You can also install the skill with the [open skills installer](https://github.com/vercel-labs/skills):

```sh
npx skills add xplormityai/searchdock-cli --skill searchdock
```

[`server.json`](server.json) prepares a listing in the MCP Registry under `io.github.xplormityai/searchdock-cli`. Registry publication requires the npm package to be live and namespace authentication; the metadata file alone does not create a listing.

## What the Google API can and cannot tell you

| Available | Requires Search Console UI or an export |
| --- | --- |
| Clicks, impressions, CTR, average position | Request indexing |
| Top queries/pages and date/device/country breakdowns | Test a live URL |
| Exact brand-query performance | Full Page indexing exclusions table |
| Sitemap processing status | Manual actions and security issues |
| Google's indexed version of specific URLs | Guaranteed current ranking or indexing |

SearchDock's report flags returned sitemap errors/warnings, pending processing and non-PASS verdicts for the URLs you inspect. It is not a complete technical SEO audit, and it does not provide invented SEO/AEO/GEO scores.

## JavaScript API

```js
import { selectedContext } from 'searchdock-cli';

const { adapter, site } = await selectedContext({ profile: 'default' });
const result = await adapter.analytics(site, { days: 28, dimensions: ['page'] });
console.log(result.rows);
```

The provider registry declares capabilities separately. Bing can be added as an adapter without changing the CLI, MCP or Python distribution model. Provider-specific differences must remain explicit. See [architecture](docs/architecture.md).

## Develop and release

```sh
npm ci
npm run build
npm test
npm run check
python -m pip install build twine
npm run release:artifacts
python -m twine check dist/releases/searchdock_cli-0.1.0-py3-none-any.whl dist/releases/searchdock_cli-0.1.0.tar.gz
```

[Release instructions](docs/releasing.md) cover npm/PyPI accounts, OIDC trusted publishing, versioning and GitHub release artifacts. Package creation alone does not publish anything.

Built by **Xplormity Collective**. [MIT license](LICENSE).
