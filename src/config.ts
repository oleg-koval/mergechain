// GitHub App used for "Sign in with GitHub" (OAuth Device Flow).
//
// The client_id is PUBLIC and safe to ship in the extension. There is NO client
// secret anywhere in this codebase: the device flow does not use one, which is
// exactly why this extension needs no backend server.
//
// Fill this in after creating the GitHub App (see SETUP.md). Until then, the
// sign-in button explains that it is unconfigured and PAT auth still works.
// Typed as `string` (not the literal '') so the configured check stays a real
// runtime comparison after you paste a real ID in.
export const GITHUB_APP_CLIENT_ID: string = 'Iv23liUYkVLH4rDFl2lm';

// GitHub OAuth device-flow endpoints (on github.com, covered by host_permissions).
export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
export const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
