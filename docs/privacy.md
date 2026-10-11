# SearchDock privacy

SearchDock runs locally. There is no SearchDock backend, telemetry endpoint, account database, or analytics collection in this release. API requests go to Google. Package installation may contact npm/PyPI; an agent or MCP client may handle returned data according to its own settings and provider policies.

OAuth client credentials and refresh tokens are stored in per-user JSON profiles:

- Windows: `%LOCALAPPDATA%\SearchDock`
- macOS: `~/Library/Application Support/SearchDock`
- Linux: `$XDG_CONFIG_HOME/searchdock` or `~/.config/searchdock`

`SEARCHDOCK_CONFIG_DIR` overrides the directory. Profile files use restrictive file permissions on Unix systems; Windows directories use an ACL granting the current user and SYSTEM access. These protections are not encryption or a dedicated credential vault. Access tokens stay in process memory. SearchDock's report output contains potentially private site/query data.

Do not put OAuth files, profile files, sign-in URLs or private reports in a public repository. The npm/Python/plugin release artifacts use explicit allowlists. No credentials from the original Xplormity project are included.

`searchdock auth logout` deletes that profile's local file. To revoke the grant at Google too, remove your OAuth application's access in your [Google Account permissions](https://myaccount.google.com/permissions).

Report security issues privately to **xplormityai@gmail.com**. Do not include live secrets in a public issue.
