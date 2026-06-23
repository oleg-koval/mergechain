# Setup: GitHub App for "Sign in with GitHub"

The extension signs in with GitHub's **OAuth Device Flow** — serverless, no
client secret. To enable it you create one GitHub App for your org and paste its
**Client ID** into `src/config.ts`. PAT auth keeps working with no setup if you
skip this.

## 1. Create the GitHub App

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**
(org-level: `https://github.com/organizations/<org>/settings/apps/new`).

| Field | Value |
|---|---|
| **GitHub App name** | e.g. `MergeChain` |
| **Homepage URL** | your repo URL (anything valid) |
| **Callback URL** | leave blank — device flow doesn't redirect |
| **Enable Device Flow** | ✅ **check this** (required) |
| **Webhook → Active** | ◻️ uncheck (not used) |

### Permissions (Repository permissions)

| Permission | Access |
|---|---|
| **Pull requests** | **Read and write** |
| **Metadata** | Read-only (auto-selected) |

Nothing else.

### Serverless token setting (important)

Under **Optional features / User authorization**, **uncheck "Expire user
authorization tokens."**

Why: refreshing an expiring GitHub App token requires the client *secret*, which
cannot live in a browser extension — that would force a backend. Non-expiring
user tokens keep the whole thing serverless. The token is still least-privilege
(Pull requests only, on installed repos) and revocable any time from
**Settings → Applications → Authorized GitHub Apps**.

Create the app.

## 2. Install it on your repos

On the app page → **Install App** → choose your account/org → select **Only
select repositories** and pick the repos you use it on (or All).

A user-to-server token can only touch repos the app is installed on, so this is
your real access boundary.

### Teams / private org repos

For a team on private org repositories, **an org owner installs the app on the
organization** (Org Settings → GitHub Apps → Install), granting it the repos
(all or selected). If the org restricts third-party GitHub Apps, an owner
approves it once. After that, each teammate just **signs in via device flow** —
no per-person install. Their access is the intersection of the app's installed
repos and the repos they can already see.

A `404` in the block on a private repo means the app is **not installed on that
org/repo yet** (GitHub returns 404, not 403, for resources a token can't see).
Fix: install the app on the org, or grant the repo to the existing installation.

## 3. Wire the Client ID into the extension

Copy the app's **Client ID** (looks like `Iv23li...` or `Iv1...`) and set it in
`src/config.ts`:

```ts
export const GITHUB_APP_CLIENT_ID = 'Iv23li...';
```

Rebuild and reload:

```bash
npm run build
# chrome://extensions → reload the extension
```

Open the extension Options → **Sign in with GitHub** → enter the shown code on
the GitHub page → approve. The token is stored locally and the page shows
`✓ Signed in as <you>`.

## Future: short-lived tokens

If you later want expiring tokens with automatic refresh, that needs the client
secret, i.e. a tiny serverless function (Cloudflare Worker / Lambda) that holds
the secret and does the `code`/`refresh` exchange. The extension would call that
function instead of `github.com` directly. Not needed for the device flow above.
