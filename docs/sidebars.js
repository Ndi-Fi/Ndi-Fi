// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  protocolSidebar: [
    {
      type: 'doc',
      id: 'README',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Protocol',
      items: [
        'ProjectDescription',
        'TechnicalAnalysis',
        'Tokenomics',
        'MarketAnalysis',
        'Roadmap',
      ],
    },
    {
      type: 'category',
      label: 'Contracts',
      items: [
        'NdiFiStaking_README',
        'NdiPoint_README',
      ],
    },
    {
      type: 'doc',
      id: 'docs/ERROR_CATALOGUE',
      label: 'Error Catalogue',
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'docs/stellar/ARCHITECTURE',
        'docs/stellar/MIGRATION',
        'docs/stellar/WAVE_ISSUES',
      ],
    },
    {
      type: 'doc',
      id: 'CONTRIBUTING',
      label: 'Contributing',
    },
  ],
};

module.exports = sidebars;
