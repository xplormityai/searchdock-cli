# Publish SearchDock CLI

The repository is `xplormityai/searchdock-cli`. The npm and PyPI distribution name is `searchdock-cli`, and the executable is `searchdock`. The plugin name and marketplace name are both `searchdock`.

## First publication

1. Create npm and PyPI accounts and configure their required account security. Keep tokens out of this repo and chat.
2. Run `npm ci`, `npm run build`, `npm test`, `npm run check`, and `npm run release:artifacts`. Verify with `python scripts/check_artifacts.py` and `python scripts/check_install.py`.
3. Check the Python archives with `python -m twine check dist/releases/searchdock_cli-0.1.1-py3-none-any.whl dist/releases/searchdock_cli-0.1.1.tar.gz`.
4. For npm's first release, sign in locally with `npm login`, then run `npm publish dist/releases/searchdock-cli-0.1.1.tgz --access public`. npm may require browser approval or a one-time code. Check package ownership before submitting.
5. In PyPI, configure a pending trusted publisher for `searchdock-cli` with owner `xplormityai`, repository `searchdock-cli`, workflow `release.yml`, and environment `pypi`. This can create the package on its first workflow publication.
6. Once the npm package exists, enable account-level 2FA and configure its trusted publisher for the same repo and workflow, environment `npm`, allowing direct `npm publish`. Use the package settings page or `npm trust github searchdock-cli --file release.yml --repo xplormityai/searchdock-cli --environment npm --allow-publish --yes`. The workflow uses OIDC; persistent npm/PyPI upload tokens are not required.
7. Push a matching `v0.1.1` tag when both registry publishers are configured. The workflow builds tested artifacts and publishes to npm and PyPI in separate jobs. A first npm version already uploaded manually is skipped if the registry returns that exact version.

GitHub releases include an npm tarball, Python wheel/source distribution, plugin ZIP, skill ZIP and SHA256 checksums. Plugins and MCP clients resolve the pinned npm release, so publish npm before announcing plugin installation.

The GitHub release is created only after both registry jobs succeed. Failed jobs can be rerun; uploading GitHub release files is idempotent. GitHub creates the `npm` and `pypi` environments when the workflow first references them if they do not already exist. The publisher environment names must match these job names exactly.

## Version updates

Change `package.json`, `src/cli.js`, `python/pyproject.toml`, `server.json`, all three plugin manifests and pinned versions in `mcp.json`, `.mcp.json`, README and skill install instructions together. `npm run build` generates the Python version module. `npm run check` validates core version consistency. Tag `v<version>` only after tests and package validation pass.

## Discoverability

Use the repository description: **Google Search Console CLI for analytics, URL inspection and sitemap monitoring. npm, Python, MCP and agent skills. Bing support planned.**

Suggested GitHub topics: `google-search-console`, `gsc`, `seo`, `cli`, `mcp`, `agent-skills`, `search-analytics`, `sitemap`, `codex`, `claude-code`. Keep the descriptive README heading, registry metadata and documentation consistent. Add a Bing keyword/title only once the Bing adapter is released.

The skill is discoverable directly from GitHub with `npx skills add xplormityai/searchdock-cli --list` and installable with `--skill searchdock`. A plugin ZIP can be shared with compatible clients. Hosted plugin stores have separate ownership and review requirements; these artifacts do not automatically publish listings there. No search ranking is guaranteed.

## MCP Registry

After npm publication, use the official [MCP Registry publisher](https://modelcontextprotocol.io/registry/quickstart) with the included `server.json`. Its name matches the package's `mcpName`. Authenticate with an identity authorized for `io.github.xplormityai/`, then run `mcp-publisher publish` from this repository. If this is an organization namespace, use the supported [GitHub Actions OIDC flow](https://modelcontextprotocol.io/registry/github-actions) or another ownership verification method. Publishing the npm package does not automatically create the MCP Registry listing.
