# Set up SearchDock with an AI agent

Start with the copyable prompt at the top of the [README](../README.md#set-up-with-your-agent). `searchdock-setup` installs the CLI and guides Google connection; `searchdock` reads metrics and indexing evidence.

## Standalone skills

Run in the project where your agent should use SearchDock:

```sh
npx --yes skills add xplormityai/searchdock-cli --skill searchdock-setup searchdock --agent codex --copy --yes
```

Replace `codex` with your [agent identifier](https://github.com/vercel-labs/skills#supported-agents). Default installation is project-scoped; add `--global` for use across projects. `--copy` avoids symlink permissions on Windows. Install the CLI separately with `npm install --global searchdock-cli`, or `pipx install searchdock-cli` for Python. Both require Node.js 22+; the Python launcher also requires Python 3.10+.

Without the skills installer, copy `skills/searchdock` and `skills/searchdock-setup` from a checkout into your client's skills directory. Codex uses `.agents/skills/` in a project; Claude Code uses `.claude/skills/`. Preserve existing skills and reload the agent if needed.

## Plugins

Choose a plugin instead of standalone installation to bundle both skills and MCP configuration.

Codex CLI:

```sh
codex plugin marketplace add xplormityai/searchdock-cli
codex plugin add searchdock@searchdock
```

Claude Code:

```text
/plugin marketplace add xplormityai/searchdock-cli
/plugin install searchdock@searchdock --scope project
```

Run the setup skill after installation. Plugins use `searchdock-cli@0.1.2` and do not bundle credentials. Repository plugins are not automatically published in hosted directories. Formats: [portable plugins](https://developers.openai.com/plugins/build/plugins), [Claude Code plugins](https://code.claude.com/docs/en/plugins-reference).

## MCP without a plugin

Merge this server into the client's configuration, keeping existing servers:

```json
{
  "mcpServers": {
    "searchdock": {
      "command": "npx",
      "args": ["--yes", "searchdock-cli@0.1.2", "mcp"]
    }
  }
}
```

Use your client's Windows process-launch guidance if it cannot start `npx`. An absolute `node` executable and the installed `dist/cli.cjs` path are another option. Reload the client when necessary and confirm the five `searchdock_*` tools are listed.

## Google connection and verification

Follow [Google setup](google-setup.md) to create your own Desktop OAuth client. Keep its JSON and SearchDock tokens outside public repositories. Agents need the file path, not credential contents. Google browser consent must be completed by you.

```sh
searchdock --version
searchdock doctor --json
searchdock auth login --client-file /path/to/desktop-client.json
searchdock sites list --json
searchdock sites use sc-domain:example.com
searchdock analytics --days 28 --json
```

Replace the example property with one returned by `sites list`. Reuse an authenticated profile instead of reconnecting it. CLI installation, skill discovery, MCP tool discovery and successful Google analytics are separate checks; an installation is not proof of account access.

SearchDock reads Google's existing indexed URL data. Requesting indexing, running live URL tests, manual actions and full page-indexing exclusion reports require the Search Console UI.
