# SearchDock architecture and provider roadmap

The shared JavaScript core handles CLI parsing, local profiles, OAuth, HTTP requests and provider calls. npm/npx use a bundled executable with no runtime npm dependencies. The Python wheel carries that same bundle and starts it with Node.js. The MCP server and agent plugins call the same provider implementation.

`src/providers/index.js` is the provider registry. An adapter declares its actual capabilities and implements `sites`, `analytics`, `sitemaps`, `inspect` and/or `report`. Google is the only implemented adapter in 0.1.0. Profiles keep provider credentials and a default property separately.

For Bing, first verify the current Webmaster Tools authentication and API contracts, then add an adapter with capability-specific commands/tools and tests. Do not reuse Google's scope, property rules, ranking semantics or indexing limitations blindly. Only advertise and expose capabilities once implemented.

The public JavaScript API is experimental before 1.0. JSON result envelopes carry `provider`, `site` and date-range context. Adding a provider should preserve existing Google commands. Broader API schemas, native credential-vault integration, CSV exports and standalone binaries are future work, not current features.
