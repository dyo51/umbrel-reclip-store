# OSINT reader image

This is a small, stateless Nginx image that serves the UI shell for two Umbrel apps. The shell fetches only the upstream Markdown index and category files directly from `raw.githubusercontent.com` when a user opens a page. It does not bundle or persist the curated list content, run searches against people, execute third-party tools, store query text, or send analytics.

- `SITE=legendary` serves the Legendary OSINT reader.
- `SITE=awesome` serves the Awesome OSINT reader.
- The browser-side filter operates only on content already loaded in the current tab.
- The `awesome-osint` repository currently has no declared license; its README is fetched directly from upstream, not copied into this repository or the image.
- The app proxy is the only exposure path; the compose package does not publish a host port.

Checks: `npm test` and `npm run check`.
