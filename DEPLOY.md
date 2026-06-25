# Deploy: automated publishing to browser stores

MergeChain ships to **Chrome Web Store**, **Microsoft Edge Add-ons**, and
**Firefox AMO** from one GitHub Actions workflow. The build is identical for all
three (Manifest V3, same `dist/`).

## How a release happens

Publishing is triggered by a **version tag**, not every push to `main`. Stores
reject a re-upload of an already-published version and queue each submission for
review, so "publish on every merge" would fail on the second commit. The flow is:

```bash
# on main, with your change merged and CI green:
npm version patch            # bumps package.json + manifest version, makes a vX.Y.Z commit + tag
git push --follow-tags       # pushes the commit and the tag
```

The tag push fires `.github/workflows/release.yml`, which:

1. typechecks, lints, tests, builds;
2. zips `dist/` (excluding source maps) → `mergechain-vX.Y.Z.zip`;
3. creates a GitHub Release with that zip + auto-generated notes;
4. **if `SUBMIT_KEYS` is configured**, uploads + submits to all three stores via
   [`PlasmoHQ/bpp`](https://github.com/PlasmoHQ/bpp).

Without `SUBMIT_KEYS`, step 4 is skipped and you still get the GitHub Release —
so the pipeline is safe to merge before store credentials exist.

> The manifest `version` is the single source of truth (`src/manifest.config.ts`,
> kept in sync with `package.json` by `npm version`). Every store upload needs a
> higher version than the last — `npm version` enforces that for you.

## One-time setup: store credentials

Create the developer listings, then add **one** repo secret named `SUBMIT_KEYS`
(Settings → Secrets and variables → Actions) containing a JSON blob with the
stores you want to publish to. `bpp` publishes to whichever keys are present, so
you can start with Chrome only and add the others later.

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/PlasmoHQ/bms/main/assets/schema.json",
  "chrome": {
    "clientId": "…", "clientSecret": "…", "refreshToken": "…",
    "extId": "<chrome web store item id>"
  },
  "edge": {
    "clientId": "…", "clientSecret": "…",
    "productId": "<edge product id>",
    "accessTokenUrl": "https://login.microsoftonline.com/…/oauth2/v2.0/token"
  },
  "firefox": {
    "apiKey": "user:xxxx:nnn", "apiSecret": "…",
    "extId": "<addon id, e.g. mergechain@teifi.com>"
  }
}
```

Where each value comes from:

| Store | Get credentials | Docs |
|---|---|---|
| **Chrome** | Google Cloud OAuth client (Chrome Web Store API enabled) → generate a refresh token. `extId` is the item id from the dashboard URL. | [CWS API](https://developer.chrome.com/docs/webstore/using-api) |
| **Edge** | Partner Center → Publish API → create API credentials. `productId` is in the dashboard URL. | [Edge API](https://learn.microsoft.com/microsoft-edge/extensions-chromium/publish/api/using-addons-api) |
| **Firefox** | addons.mozilla.org → Manage API Keys → JWT issuer + secret. | [AMO signing](https://addons-server.readthedocs.io/en/latest/topics/api/signing.html) |

### Firefox-only extra step

Firefox requires a stable add-on id. Before the first Firefox submit, add it to
`src/manifest.config.ts` (Chromium ignores this key):

```ts
browser_specific_settings: { gecko: { id: 'mergechain@teifi.com' } },
```

## Local dry run

Build and zip exactly like CI, without publishing:

```bash
npm run package      # → mergechain.zip, loadable via chrome://extensions
```

## Trade-offs (deliberate)

- **Tag-triggered, not push-triggered.** Required by the stores (unique version +
  manual-ish review per submission). If you want "merge to main = release", bump
  the version in the merge commit and tag it — or add a small workflow that
  auto-tags when `version` changes (needs a PAT, since tags pushed by the default
  `GITHUB_TOKEN` don't trigger other workflows). Not wired up to keep this simple.
- **Review latency is the stores', not ours.** The upload is automated; approval
  still takes each store's review time (hours–days).
