# Google Search Console CLI setup

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or choose your own project, and enable the **Google Search Console API**.
2. Configure the OAuth consent screen. If using an external app in testing, add your Google account as a test user.
3. Create an OAuth client ID of type **Desktop app**. Download the JSON to a private directory outside your checkout.
4. Run `searchdock auth login --client-file <path>`. Complete Google consent in your browser using an account with access to your Search Console property.
5. Run `searchdock sites list`, then `searchdock sites use <exact-property>`. Domain properties start with `sc-domain:`. URL-prefix properties must match the API's exact value, including protocol, prefix and trailing slash.

SearchDock requests only `https://www.googleapis.com/auth/webmasters.readonly`. It does not use a shared OAuth app, upload your client file to a SearchDock service, or request Cloud Platform access. Client IDs and secrets are sent to Google's token endpoint as part of OAuth.

If your external OAuth application stays in **testing**, refresh tokens for this scope can expire after seven days. Reconnect when required, or configure your own application's production status according to Google's requirements. Do not claim Google verification for this project: each user owns and configures their OAuth app.

`--no-browser` prints the authorization URL for you to open locally. Keep that URL private. The callback still must reach the terminal's machine at `127.0.0.1`; this flow is not a remote/headless device authorization flow.

Troubleshooting:

- **SERVICE_DISABLED**: enable the Search Console API in the OAuth client's project.
- **403 / missing property**: verify that the consenting Google account has access to the exact property. Unverified properties are excluded from `sites list`.
- **401 / expired grant**: run `auth login` again; testing mode or revoked consent can invalidate refresh tokens.
- **429**: wait for the relevant API quota to reset. URL inspection has separate quotas; avoid inspecting large lists repeatedly.
- **No metrics**: inspect the requested date range and property, and remember that query anonymization, processing lag and top-row limits affect results.

Official references: [Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [token expiration](https://developers.google.com/identity/protocols/oauth2#expiration), [Search Console API](https://developers.google.com/webmaster-tools/v1/api_reference_index), [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect).
