import { defineManifest } from '@crxjs/vite-plugin';

// ponytail: version bumped here, single source of truth for the manifest.
export default defineManifest({
  manifest_version: 3,
  name: 'MergeChain: PR merge dependencies',
  description:
    'GitLab-style merge dependencies for GitHub pull requests. Block merging until prerequisite PRs land.',
  version: '0.1.0',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'MergeChain',
    default_popup: 'src/popup/popup.html',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
  options_ui: {
    page: 'src/settings/settings.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://github.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  host_permissions: ['https://api.github.com/*', 'https://github.com/*'],
  permissions: ['storage'],
});
