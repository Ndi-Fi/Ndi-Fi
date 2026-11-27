// @ts-check
// Docusaurus configuration for the Ndi-Fi protocol documentation site.
// See: https://docusaurus.io/docs/api/docusaurus-config

const { themes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Ndi-Fi',
  tagline: 'Simple, secure decentralised lending and staking.',
  favicon: 'img/favicon.ico',

  // Set the production URL to wherever the site is eventually hosted.
  url: 'https://ndi-fi.github.io',
  baseUrl: '/Ndi-Fi/',

  organizationName: 'Ndi-Fi',
  projectName: 'Ndi-Fi',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // The root docs directory is the repo root (one level up).
          path: '..',
          include: ['**/*.md', '**/*.mdx'],
          exclude: [
            'node_modules/**',
            'lib/**',
            '.git/**',
            'docs/node_modules/**',
          ],
          routeBasePath: '/',
          editUrl: 'https://github.com/Ndi-Fi/Ndi-Fi/edit/main/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Ndi-Fi Docs',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'protocolSidebar',
            position: 'left',
            label: 'Protocol',
          },
          {
            href: 'https://github.com/Ndi-Fi/Ndi-Fi',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Overview', to: '/' },
              { label: 'Error Catalogue', to: '/docs/ERROR_CATALOGUE' },
              { label: 'Architecture (Stellar)', to: '/docs/stellar/ARCHITECTURE' },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/Ndi-Fi/Ndi-Fi',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Ndi-Fi. Built with Docusaurus.`,
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
        additionalLanguages: ['solidity', 'rust', 'toml', 'bash'],
      },
    }),
};

module.exports = config;
