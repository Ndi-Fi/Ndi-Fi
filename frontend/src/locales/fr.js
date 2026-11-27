/** French help copy. Keys mirror locales/en.js. */
const fr = {
  code: 'fr',
  name: 'Français',
  ui: {
    whatIs: 'Qu’est-ce que {term} ?',
    learnMore: 'En savoir plus',
    showLess: 'Réduire',
    close: 'Fermer l’aide',
  },
  terms: {
    apr: {
      term: 'APR',
      summary: 'Le taux d’intérêt annuel pour emprunter ou prêter, exprimé en pourcentage avant capitalisation.',
      details:
        'APR signifie Annual Percentage Rate (taux annuel en pourcentage). Si vous prêtez 100 jetons à 5 % d’APR et que le taux reste inchangé, vous gagnerez environ 5 jetons en un an. Ce chiffre n’inclut pas les intérêts générés par les intérêts précédents ; c’est ce que montre l’APY.',
    },
    apy: {
      term: 'APY',
      summary: 'Le rendement annuel qui inclut la capitalisation — les intérêts gagnés sur les intérêts précédents.',
      details:
        'APY signifie Annual Percentage Yield (rendement annuel en pourcentage). Les intérêts étant ajoutés au solde puis générant à leur tour des intérêts, l’APY est généralement supérieure à l’APR pour un même taux. Utilisez l’APY pour comparer des offres avec des fréquences de capitalisation différentes.',
    },
    collateral: {
      term: 'Collatéral',
      summary: 'Des actifs que vous verrouillez pour garantir un prêt. Si vous ne remboursez pas, le protocole peut les utiliser pour couvrir la dette.',
      details:
        'Le collatéral est le dépôt de garantie de l’emprunteur envers les prêteurs. Sa valeur doit rester supérieure à celle du prêt. N’engagez que des actifs que vous pouvez vous permettre de perdre : une forte baisse de prix peut entraîner une liquidation.',
    },
    collateralFactor: {
      term: 'Facteur de collatéral',
      summary: 'Le pourcentage de la valeur de votre collatéral que le protocole vous autorise à emprunter.',
      details:
        'Un facteur de collatéral de 75 % signifie que 100 $ de collatéral permettent d’emprunter jusqu’à 75 $. Les 25 % restants servent de marge pour absorber les baisses de prix avant la liquidation. Un facteur plus élevé permet d’emprunter davantage, mais laisse moins de marge de sécurité.',
    },
    healthFactor: {
      term: 'Facteur de santé',
      summary: 'Un indicateur de la sécurité de votre prêt : la valeur du collatéral ajustée au risque divisée par votre dette.',
      details:
        'Au-dessus de 1, votre collatéral couvre votre dette. À 1 ou moins, votre prêt peut être liquidé : une partie du collatéral est vendue pour rembourser la dette, généralement avec une pénalité. Exemple : 150 $ de collatéral ajusté et 100 $ de dette donnent un facteur de santé de 1,5. Ajoutez du collatéral ou remboursez de la dette pour l’augmenter.',
    },
    liquidation: {
      term: 'Liquidation',
      summary: 'La vente d’une partie de votre collatéral pour rembourser un prêt qui n’est plus suffisamment garanti.',
      details:
        'La liquidation protège les prêteurs lorsque la valeur du collatéral baisse ou que la dette augmente. Elle peut se produire automatiquement et comporte généralement une pénalité. Surveillez votre facteur de santé, surtout sur des marchés volatils.',
    },
    ltv: {
      term: 'Ratio prêt/valeur (LTV)',
      summary: 'Votre dette divisée par la valeur de votre collatéral, exprimée en pourcentage.',
      details:
        'Un prêt de 60 $ garanti par 100 $ de collatéral correspond à un LTV de 60 %. Chaque actif a un LTV maximal, lié à son facteur de collatéral. Plus vous vous approchez de cette limite, plus la liquidation est facile à déclencher.',
    },
    borrow: {
      term: 'Emprunter',
      summary: 'Obtenir un prêt en fournissant un collatéral, puis rembourser le capital plus les intérêts.',
      details:
        'Lorsque vous empruntez, vous recevez des actifs à utiliser immédiatement et vous devez le montant emprunté plus les intérêts. En DeFi, le prêt est garanti par des actifs verrouillés dans un contrat intelligent, et non par une évaluation de crédit.',
    },
    yield: {
      term: 'Rendement',
      summary: 'Ce que rapporte un actif au fil du temps, comme les intérêts de prêt ou les récompenses de staking.',
      details:
        'Le rendement peut provenir des intérêts payés par les emprunteurs, des frais de transaction ou des récompenses du protocole. Il n’est pas garanti : les taux varient selon l’offre et la demande, et les récompenses comportent leurs propres risques.',
    },
    staking: {
      term: 'Staking (verrouillage de jetons)',
      summary: 'Verrouiller des jetons ou une position de liquidité pour soutenir un protocole et gagner des récompenses.',
      details:
        'Les actifs en staking sont généralement conservés pendant une certaine durée. En échange, vous pouvez gagner des récompenses, mais vous ne pouvez pas les vendre ni les déplacer avant de les retirer, et certains protocoles imposent un délai de désengagement.',
    },
    vaultShares: {
      term: 'Parts de vault',
      summary: 'Des jetons qui représentent votre part d’un vault mutualisé, comme un reçu de votre dépôt.',
      details:
        'Le prêt de Ndi-Fi utilise un vault ERC-4626. Lors de votre dépôt, vous recevez des parts. À mesure que le pool gagne des intérêts, chaque part est convertible en une plus grande quantité de l’actif sous-jacent ; au retrait, vos parts sont brûlées.',
    },
    utilizationRate: {
      term: 'Taux d’utilisation',
      summary: 'La part d’un pool de prêt qui est actuellement empruntée.',
      details:
        'Un taux élevé signifie que la plupart des fonds déposés sont prêtés : les retraits peuvent être tendus et les taux d’intérêt ont tendance à monter. Un taux faible indique beaucoup de liquidité inutilisée et des taux plus bas pour les emprunteurs.',
    },
    oracle: {
      term: 'Oracle',
      summary: 'Un flux de prix qui indique à un contrat intelligent la valeur d’un actif.',
      details:
        'Les protocoles de prêt utilisent des oracles pour valoriser le collatéral et vérifier qu’un prêt est sûr. Si un oracle est en retard ou se trompe, les liquidations peuvent être erronées : sa conception est un risque important à examiner.',
    },
  },
};

export default fr;
