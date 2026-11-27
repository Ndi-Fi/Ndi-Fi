/** Spanish help copy. Keys mirror locales/en.js. */
const es = {
  code: 'es',
  name: 'Español',
  ui: {
    whatIs: '¿Qué es {term}?',
    learnMore: 'Más información',
    showLess: 'Ver menos',
    close: 'Cerrar ayuda',
  },
  terms: {
    apr: {
      term: 'APR',
      summary: 'La tasa de interés anual para prestar o pedir prestado, expresada como porcentaje antes de la capitalización.',
      details:
        'APR significa Tasa Anual Porcentual. Si prestas 100 tokens al 5 % de APR y la tasa no cambia, ganarás unos 5 tokens en un año. No incluye los intereses generados por intereses anteriores; eso lo muestra la APY.',
    },
    apy: {
      term: 'APY',
      summary: 'El rendimiento anual que incluye la capitalización: intereses ganados sobre intereses anteriores.',
      details:
        'APY significa Rendimiento Porcentual Anual. Como los intereses se añaden al saldo y luego generan más intereses, la APY suele ser mayor que la APR para la misma tasa. Usa la APY para comparar ofertas con distintas frecuencias de capitalización.',
    },
    collateral: {
      term: 'Garantía',
      summary: 'Activos que bloqueas para respaldar un préstamo. Si no devuelves el préstamo, el protocolo puede usarlos para cubrir la deuda.',
      details:
        'La garantía es el depósito de seguridad del prestatario para los prestamistas. Su valor debe mantenerse por encima del valor del préstamo. Compromete solo activos que puedas permitirte perder, porque una caída fuerte de precio puede provocar una liquidación.',
    },
    collateralFactor: {
      term: 'Factor de garantía',
      summary: 'El porcentaje del valor de tu garantía que el protocolo te permite pedir prestado.',
      details:
        'Un factor de garantía del 75 % significa que 100 USD de garantía respaldan hasta 75 USD de deuda. El 25 % restante es un margen que absorbe caídas de precio antes de la liquidación. Un factor más alto te permite pedir más, pero deja menos margen de seguridad.',
    },
    healthFactor: {
      term: 'Factor de salud',
      summary: 'Una puntuación que indica qué tan seguro está tu préstamo: el valor de la garantía ajustado por riesgo dividido entre tu deuda.',
      details:
        'Por encima de 1 significa que tu garantía cubre la deuda. En 1 o menos, tu préstamo puede liquidarse: se vende parte de la garantía para pagar la deuda, normalmente con una penalización. Ejemplo: 150 USD de garantía ajustada y 100 USD de deuda dan un factor de salud de 1,5. Añade garantía o devuelve deuda para subirlo.',
    },
    liquidation: {
      term: 'Liquidación',
      summary: 'La venta de parte de tu garantía para pagar un préstamo que ya no está bien respaldado.',
      details:
        'La liquidación protege a los prestamistas cuando cae el valor de la garantía o crece la deuda. Puede ocurrir automáticamente y suele incluir una penalización. Vigila tu factor de salud, sobre todo en mercados volátiles.',
    },
    ltv: {
      term: 'Ratio préstamo/valor (LTV)',
      summary: 'Tu deuda dividida entre el valor de tu garantía, expresada como porcentaje.',
      details:
        'Un préstamo de 60 USD con 100 USD de garantía tiene un LTV del 60 %. Cada activo tiene un LTV máximo, muy relacionado con su factor de garantía. Cuanto más cerca estés de ese límite, más fácil será la liquidación.',
    },
    borrow: {
      term: 'Pedir prestado',
      summary: 'Obtener un préstamo ofreciendo garantía y devolver el capital más intereses.',
      details:
        'Cuando pides prestado, recibes activos para usar ahora y debes el importe más los intereses. En DeFi, el préstamo se garantiza con activos bloqueados en un contrato inteligente, no con una comprobación de crédito.',
    },
    yield: {
      term: 'Rendimiento',
      summary: 'Lo que ganas con un activo a lo largo del tiempo, como intereses por préstamo o recompensas por staking.',
      details:
        'El rendimiento puede venir de los intereses que pagan los prestatarios, comisiones de negociación o recompensas del protocolo. No está garantizado: las tasas cambian según la oferta y la demanda, y las recompensas tienen sus propios riesgos.',
    },
    staking: {
      term: 'Staking (bloqueo de tokens)',
      summary: 'Bloquear tokens o una posición de liquidez para apoyar a un protocolo y ganar recompensas.',
      details:
        'Los activos en staking suelen retenerse durante un tiempo. A cambio puedes ganar recompensas, pero quizá no puedas venderlos ni moverlos hasta retirarlos, y algunos protocolos imponen un periodo de espera.',
    },
    vaultShares: {
      term: 'Participaciones del vault',
      summary: 'Tokens que representan tu parte de un vault compartido, como un recibo de tu depósito.',
      details:
        'El préstamo de Ndi-Fi usa un vault ERC-4626. Al depositar recibes participaciones. A medida que el fondo gana intereses, cada participación vale más del activo subyacente; al retirar, tus participaciones se queman.',
    },
    utilizationRate: {
      term: 'Tasa de utilización',
      summary: 'La parte de un fondo de préstamos que está prestada en este momento.',
      details:
        'Una tasa alta significa que casi todos los fondos depositados están prestados, por lo que los retiros pueden complicarse y los intereses suelen subir. Una tasa baja indica mucha liquidez ociosa y tasas más bajas para quien pide prestado.',
    },
    oracle: {
      term: 'Oráculo',
      summary: 'Un feed de precios que indica a un contrato inteligente cuánto vale un activo.',
      details:
        'Los protocolos de préstamo usan oráculos para valorar la garantía y decidir si un préstamo es seguro. Si un oráculo se retrasa o se equivoca, las liquidaciones también pueden ser incorrectas: su diseño es un riesgo importante a revisar.',
    },
  },
};

export default es;
