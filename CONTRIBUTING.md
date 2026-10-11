# Contributing

Use Node.js 22+, run `npm ci`, `npm run build`, `npm test` and `npm run check`. Keep provider logic in adapters, preserve read-only Google access, and test behavior without live credentials. Do not commit generated reports, OAuth files or local profiles.

Use conventional commit titles such as `feat: add a provider` or `fix(auth): handle revoked access`, with a short body describing the change. Use Xplormity Collective for public project metadata; do not introduce personal creator names.

Bing support is planned. Open an issue describing its current API authentication and capabilities before adding an adapter. Keep limitations and provider differences explicit in the docs.
