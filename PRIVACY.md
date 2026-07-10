# MergeChain — Privacy Policy

_Last updated: 2026-06-23_

MergeChain is a browser extension that adds merge-dependency tracking to GitHub
pull requests. This policy explains exactly what data it handles.

## Short version

MergeChain has **no backend server**. It stores your GitHub credential locally
in your browser and talks **only** to GitHub (`github.com` and
`api.github.com`). Nothing is sent to the developer or any third party. No
analytics, no tracking, no ads.

## What is stored, and where

- **Your GitHub access token** (from "Sign in with GitHub" device flow, or a
  personal access token you paste). Stored in `chrome.storage.local` on your
  own device. It is never synced to any cloud and never transmitted anywhere
  except GitHub's own API over HTTPS.
- **Your settings** (enabled repositories, block placement, max depth, show/hide
  toggle). Stored in `chrome.storage.local` on your device.

The extension's background service worker is the only component that holds the
token; the GitHub web pages you browse never receive it.

## What is sent, and to whom

- Requests to `https://api.github.com` and `https://github.com`, authenticated
  with your token, to: read pull requests, read the open-PR list, and update a
  pull request's description (to store the dependency marker). These requests go
  directly from your browser to GitHub. The developer of MergeChain receives
  none of this data.
- Dependency data is stored as a hidden HTML comment inside the pull request's
  description on GitHub. That data lives in your repository on GitHub and is
  visible to anyone who can see the PR.

## What is NOT collected

- No analytics or telemetry.
- No personal data is sent to the developer or any third-party service.
- No advertising or tracking identifiers.
- No selling or sharing of data.

## Permissions and why they are needed

- `storage` — to save your token and settings locally.
- Host access to `github.com` and `api.github.com` — to read/update PR
  dependency data and to inject the dependency UI on PR pages. The extension
  requests no other hosts; you can verify this in `chrome://extensions` →
  Details → site access.

## Removing your data

Uninstalling the extension removes all locally stored data (token and settings).
Dependency markers already written into PR descriptions remain in those PRs; you
can edit a PR description on GitHub to remove them, or use the extension's remove
controls before uninstalling. You can revoke the token any time from GitHub →
Settings → Applications.

## Contact

Questions about this policy: oleg.koval (GitHub: @oleg-koval).
