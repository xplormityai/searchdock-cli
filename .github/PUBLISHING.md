# Publishing SearchDock CLI

| Setting | Value |
| --- | --- |
| GitHub repository | `xplormityai/searchdock-cli` |
| npm account | `xplormityai` |
| npm package | `searchdock-cli` |
| PyPI account | `xplormityai` |
| PyPI project | `searchdock-cli` |
| Workflow filename | `release.yml` |
| npm environment | `npm` |
| PyPI environment | `pypi` |
| MCP registry name | `io.github.xplormityai/searchdock-cli` |

The public author is Xplormity Collective. Both package registries use GitHub OIDC with this repository and `release.yml`. npm must allow publishing. The official MCP Registry uses GitHub OIDC through publish-mcp.yml. No upload token, `.npmrc` credential or `.pypirc` credential belongs in this repository.

Follow docs/releasing.md for synchronized version changes and push an annotated `vX.Y.Z` tag. Tests validate both package installations, matching Node runtime, public artifact contents and plugin/skill bundles. The Python launcher also requires Node.js 22+.

GitHub's Packages panel lists GitHub-hosted packages, while the README links the published npm/PyPI versions and MCP Registry entry.
