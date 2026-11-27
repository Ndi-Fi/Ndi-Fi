/** English help copy. Other locales fall back to this file for missing keys. */
const en = {
  code: 'en',
  name: 'English',
  ui: {
    whatIs: 'What is {term}?',
    learnMore: 'Learn more',
    showLess: 'Show less',
    close: 'Close help',
  },
  terms: {
    apr: {
      term: 'APR',
      summary: 'The yearly interest rate for borrowing or lending, shown as a percentage before compounding.',
      details:
        'APR stands for Annual Percentage Rate. If you lend 100 tokens at 5% APR and the rate stays the same, you would earn about 5 tokens over one year. It does not include interest earned on previously earned interest; APY does.',
    },
    apy: {
      term: 'APY',
      summary: 'The yearly return including compounding — interest earned on earlier interest.',
      details:
        'APY stands for Annual Percentage Yield. Because interest is added to your balance and then earns interest itself, APY is usually higher than the same rate shown as APR. Use APY to compare offers that compound at different frequencies.',
    },
    collateral: {
      term: 'Collateral',
      summary: 'Assets you lock up to back a loan. If you do not repay, the protocol can use them to cover the debt.',
      details:
        'Collateral is the borrower’s safety deposit for lenders. Its value must stay above the value of the loan. Pledge only assets you can afford to lose, because a sharp price drop can lead to liquidation.',
    },
    collateralFactor: {
      term: 'Collateral factor',
      summary: 'The percentage of your collateral value that the protocol lets you borrow against.',
      details:
        'A collateral factor of 75% means $100 of collateral supports up to $75 of debt. The remaining 25% is a buffer that absorbs price drops before liquidation. A higher collateral factor lets you borrow more, but leaves less room for safety.',
    },
    healthFactor: {
      term: 'Health factor',
      summary: 'A score that shows how safe your loan is — collateral value adjusted for risk divided by your debt.',
      details:
        'Above 1 means your collateral covers your debt. At 1 or below, your loan can be liquidated: part of the collateral is sold to repay the debt, usually with a penalty. Example: $150 of adjusted collateral and $100 of debt gives a health factor of 1.5. Add collateral or repay debt to raise it.',
    },
    liquidation: {
      term: 'Liquidation',
      summary: 'The sale of part of your collateral to repay a loan that is no longer safely backed.',
      details:
        'Liquidation protects lenders when collateral value falls or debt grows. It can happen automatically and may charge a penalty. Keep an eye on your health factor, especially during volatile markets.',
    },
    ltv: {
      term: 'Loan-to-value (LTV)',
      summary: 'Your debt divided by the value of your collateral, shown as a percentage.',
      details:
        'A $60 loan backed by $100 of collateral is 60% LTV. Each asset has a maximum LTV, closely related to its collateral factor. The closer you are to that limit, the easier it is to be liquidated.',
    },
    borrow: {
      term: 'Borrow',
      summary: 'To take out a loan by pledging collateral, then repay the principal plus interest.',
      details:
        'When you borrow, you receive assets to use now and owe the amount borrowed plus interest. In DeFi, the loan is secured by collateral locked in a smart contract rather than by a credit check.',
    },
    yield: {
      term: 'Yield',
      summary: 'The return you earn from an asset over time, such as lending interest or staking rewards.',
      details:
        'Yield can come from borrowers paying interest, trading fees, or protocol rewards. It is not guaranteed: rates change with supply and demand, and rewards can carry their own risks.',
    },
    staking: {
      term: 'Staking',
      summary: 'Locking tokens or a liquidity position to support a protocol and earn rewards.',
      details:
        'Staked assets are usually held for a period of time. In return you may earn rewards, but you may not be able to sell or move them until you unstake, and some protocols add an unbonding period.',
    },
    vaultShares: {
      term: 'Vault shares',
      summary: 'Tokens that represent your portion of a pooled vault, like a receipt for your deposit.',
      details:
        'Ndi-Fi lending uses an ERC-4626 vault. When you deposit, you receive shares. As the pool earns interest, each share becomes redeemable for more of the underlying asset; when you withdraw, your shares are burned.',
    },
    utilizationRate: {
      term: 'Utilization rate',
      summary: 'The share of a lending pool that is currently borrowed.',
      details:
        'A high utilization rate means most deposited funds are out on loan, so withdrawals can be tight and interest rates usually rise. A low rate means plenty of idle liquidity and lower rates for borrowers.',
    },
    oracle: {
      term: 'Oracle',
      summary: 'A price feed that tells a smart contract what an asset is worth.',
      details:
        'Lending protocols use oracles to value collateral and decide if a loan is safe. If an oracle is late or wrong, liquidations can be wrong too, so oracle design is a key risk to check.',
    },
  },
};

export default en;
