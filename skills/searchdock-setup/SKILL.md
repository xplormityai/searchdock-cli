---
name: searchdock-setup
description: Set up SearchDock CLI and read-only Google Search Console authentication, choose an account profile and verified property, and check the connection. Use for first installation or reconnecting Google access.
---

1. Check `node --version` (22 or later) and `searchdock --version`. Install `searchdock-cli` from npm if published; for a checkout use `npm ci`, `npm run build` and `node dist/cli.cjs`.
2. Tell the user to enable the Google Search Console API in their Google Cloud project, configure the OAuth consent screen, add their account as a test user if the app is in testing, and create an OAuth client of type Desktop app. They must download the JSON locally. Ask only for its path, never its contents.
3. Run `searchdock auth login --client-file <path> --profile <name>` when the user requests connection. Explain that Google requires them to complete the browser's read-only consent. Do not paste sign-in URLs or secrets into the conversation.
4. Run `searchdock auth status --profile <name> --json`, then `searchdock sites list --profile <name> --json`. Ask which verified property to use if several exist. Set it using `searchdock sites use <property> --profile <name>`.
5. Verify `searchdock analytics --profile <name> --days 28 --json`. Explain that Search Console metrics may lag and missing query rows do not establish zero demand.

Profiles are stored in the operating system's per-user SearchDock configuration directory, outside the repo. `SEARCHDOCK_CONFIG_DIR` overrides it. Do not store credentials in a public project. `auth logout` removes local credentials; revocation in Google Account permissions is separate. OAuth apps left in Google's testing mode can have short-lived refresh tokens, so consult `docs/google-setup.md` when reconnects are frequent.
