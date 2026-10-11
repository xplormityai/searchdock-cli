# Publish SearchDock CLI

The repository is `xplormityai/searchdock-cli`. The npm and PyPI distribution name is `searchdock-cli`, and the executable is `searchdock`. The plugin name and marketplace name are both `searchdock`.

## First publication

1. Create npm and PyPI accounts and configure their required account security. Keep tokens out of this repo and chat.
2. Run `npm ci`, `npm run build`, `npm test`, `npm run check`, and `npm run release:artifacts`. Verify with `python scripts/check_artifacts.py` and `python scripts/check_install.py`.
3. Check the Python archives with `python -m twine check dist/releases/searchdock_cli-0.1.0-py3-none-any.whl dist/releases/searchdock_cli-0.1.0.tar.gz`.
4. For npm's first release, sign in locally with `npm login`, then run `npm publish dist/releases/searchdock-cli-0.1.0.tgz --access public`. npm may require browser approval or a one-time code. Check package ownership before submitting.
5. In PyPI, configure a pending trusted publisher for `searchdock-cli` with owner `xplormityai`, repository `searchdock-cli`, workflow `release.yml`, and environment `pypi`. This can create the package on its first workflow publication.
6. Once the npm package exists, configure its trusted publisher for the same repo and workflow, environment `npm`, allowing direct `npm publish`. The workflow uses OIDC; persistent npm/PyPI upload tokens are not required.
7. Push a matching `v0.1.0` tag when both registry publishers are configured. The workflow builds tested artifacts and publishes to npm and PyPI in separate jobs. A first npm version already uploaded manually is skipped if the registry returns that exact version.

GitHub releases include an npm tarball, Python wheel/source distribution, plugin ZIP, skill ZIP and SHA256 checksums. Plugins and MCP clients resolve the pinned npm release, so publish npm before announcing plugin installation.

## Version updates

Change `package.json`, `src/cli.js`, `python/pyproject.toml`, all three plugin manifests and pinned versions in `mcp.json`, `.mcp.json`, README and skill install instructions together. `npm run build` generates the Python version module. `npm run check` validates core version consistency. Tag `v<version>` only after tests and package validation pass.

## Discoverability

Use the repository description: **Google Search Console CLI for analytics, URL inspection and sitemap monitoring. npm, Python, MCP and agent skills. Bing support planned.**

Suggested GitHub topics: `google-search-console`, `gsc`, `seo`, `cli`, `mcp`, `agent-skills`, `search-analytics`, `sitemap`, `codex`, `claude-code`. Keep the descriptive README heading, registry metadata and documentation consistent. Add a Bing keyword/title only once the Bing adapter is released.

The skill can be distributed directly from GitHub and submitted to compatible skill directories. A plugin ZIP can be shared with compatible clients. Hosted plugin stores and the MCP Registry have their own account ownership, verification and review requirements; these artifacts do not automatically publish listings there. No search ranking is guaranteed.
