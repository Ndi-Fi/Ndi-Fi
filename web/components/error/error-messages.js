/**
 * User-facing copy for every error template, in English, Spanish and French.
 *
 * Writing rules (see README.md → "Writing error messages"):
 *   - title: what happened, in ≤ 5 words, no blame, no jargon.
 *   - message: why (if known) + what to do next, in ≤ 2 short sentences.
 *   - action: a verb phrase for the button; omit to use the default label.
 *   - Never mention "revert", "RPC", error codes or hex — those go in the
 *     Technical details panel.
 *
 * `{placeholders}` are filled from `describeError(…, { vars })`, falling back
 * to `defaults`. Every locale must define every template key;
 * `ndi-error.test.js` enforces parity with English.
 */

const en = {
  name: 'English',
  defaults: { network: 'the supported network', token: 'the network’s native token' },
  actions: {
    retry: 'Try again',
    'switch-network': 'Switch network',
    'connect-wallet': 'Connect wallet',
    edit: 'Edit amount',
    dismiss: 'Dismiss',
  },
  ui: { details: 'Technical details', dismiss: 'Dismiss' },
  templates: {
    'vault-maintenance': {
      title: 'Vault under maintenance',
      message: 'Deposits and withdrawals are paused while the vault is being maintained. Your funds are safe — try again later.',
      action: 'Try again later',
    },
    'deposit-cap-reached': {
      title: 'Deposit limit reached',
      message: 'The vault is at capacity. Try a smaller amount or come back when space frees up.',
    },
    'invalid-amount': {
      title: 'Enter a valid amount',
      message: 'The amount must be greater than zero and large enough to receive at least one share.',
    },
    'amount-out-of-range': {
      title: 'Amount outside the limits',
      message: 'This amount is below the minimum or above the maximum allowed. Adjust it and try again.',
    },
    'not-authorized': {
      title: 'Action not available',
      message: 'This action is restricted to an approved address, and the connected wallet is not one of them.',
    },
    'insufficient-balance': {
      title: 'Not enough balance',
      message: 'You don’t have enough tokens or shares for this amount. Lower the amount or add funds.',
    },
    'allowance-too-low': {
      title: 'Approval needed',
      message: 'Ndi-Fi needs your permission to move this token. Approve the amount in your wallet, then try again.',
      action: 'Approve and retry',
    },
    'insufficient-collateral': {
      title: 'Not enough collateral',
      message: 'Deposit more collateral, or borrow a smaller amount.',
    },
    'collateral-locked': {
      title: 'Collateral is locked',
      message: 'Part of your collateral secures an active loan. Repay the loan or withdraw a smaller amount.',
    },
    'borrow-limit-exceeded': {
      title: 'Over your borrow limit',
      message: 'This loan is larger than your collateral allows. Borrow less or add collateral to stay clear of liquidation.',
    },
    'loan-already-open': {
      title: 'Loan already open',
      message: 'Repay your current loan before opening a new one.',
    },
    'no-active-loan': {
      title: 'No active loan',
      message: 'There is no outstanding loan to repay or liquidate.',
    },
    'full-repayment-required': {
      title: 'Repay the full amount',
      message: 'Partial repayments aren’t supported yet. Enter your full outstanding debt to repay.',
      action: 'Use full amount',
    },
    'insufficient-liquidity': {
      title: 'Not enough liquidity',
      message: 'The vault doesn’t have enough available funds for this amount right now. Try a smaller amount.',
    },
    'token-not-supported': {
      title: 'Token not supported',
      message: 'This token can’t be used as collateral. Choose one of the supported tokens.',
    },
    'not-liquidatable': {
      title: 'Position is healthy',
      message: 'This loan is above the liquidation threshold, so it can’t be liquidated.',
    },
    'transfer-failed': {
      title: 'Token transfer failed',
      message: 'The token transfer didn’t go through. Check your balance and approval, then try again.',
    },
    'already-staked': {
      title: 'Already staking',
      message: 'You already have an active stake. Unstake it before starting a new one.',
    },
    'no-active-stake': {
      title: 'No active stake',
      message: 'You don’t have a stake to claim from or withdraw.',
    },
    'no-rewards': {
      title: 'No rewards yet',
      message: 'Rewards accrue over time. Check back later to claim.',
    },
    'reward-pool-empty': {
      title: 'Rewards temporarily unavailable',
      message: 'The reward pool needs to be topped up before rewards can be paid. Your stake is unaffected.',
    },
    'withdrawal-already-requested': {
      title: 'Withdrawal already requested',
      message: 'Your withdrawal request is open. Complete it once the cooldown ends.',
    },
    'withdrawal-not-requested': {
      title: 'Request a withdrawal first',
      message: 'Start a withdrawal request; you can complete it after the cooldown period.',
    },
    'cooldown-active': {
      title: 'Cooldown still running',
      message: 'You can complete this withdrawal once the cooldown period has passed.',
    },
    'calculation-overflow': {
      title: 'Amount too large',
      message: 'This amount is too large to process. Try a smaller amount.',
    },
    'contract-reverted': {
      title: 'Transaction failed',
      message: 'The contract rejected this transaction and no funds moved. Check the details and try again.',
    },
    'unknown-contract-error': {
      title: 'Transaction failed',
      message: 'The contract returned an error this app doesn’t recognise. Refresh to get the latest version, then try again.',
    },
    'wrong-network': {
      title: 'Wrong network',
      message: 'Your wallet is on a different network. Switch to {network} to continue.',
    },
    'unsupported-network': {
      title: 'Network not added',
      message: 'Your wallet doesn’t have {network} yet. Add it and switch to continue.',
      action: 'Add and switch',
    },
    'network-unavailable': {
      title: 'Can’t reach the network',
      message: 'We couldn’t connect to the blockchain. Check your internet connection and try again.',
    },
    'rate-limited': {
      title: 'Too many requests',
      message: 'The network is busy. Wait a few seconds and try again.',
      action: 'Try again in a moment',
    },
    'user-rejected': {
      title: 'Request cancelled',
      message: 'You cancelled the request in your wallet. Nothing was sent.',
    },
    'wallet-not-found': {
      title: 'No wallet found',
      message: 'Install or enable a browser wallet, or connect with a mobile wallet.',
      action: 'Choose a wallet',
    },
    'wallet-disconnected': {
      title: 'Wallet disconnected',
      message: 'Your wallet is locked or no longer connected. Unlock it and reconnect to continue.',
      action: 'Reconnect wallet',
    },
    'request-pending': {
      title: 'Check your wallet',
      message: 'A request is already waiting in your wallet. Open it to approve or reject.',
    },
    'insufficient-gas': {
      title: 'Not enough for fees',
      message: 'You need a little {token} to pay network fees. Add some to your wallet and try again.',
    },
    unknown: {
      title: 'Something went wrong',
      message: 'An unexpected error occurred and nothing was changed. Try again, or contact support if it keeps happening.',
    },
  },
};

const es = {
  name: 'Español',
  defaults: { network: 'la red compatible', token: 'el token nativo de la red' },
  actions: {
    retry: 'Reintentar',
    'switch-network': 'Cambiar de red',
    'connect-wallet': 'Conectar billetera',
    edit: 'Editar importe',
    dismiss: 'Cerrar',
  },
  ui: { details: 'Detalles técnicos', dismiss: 'Cerrar' },
  templates: {
    'vault-maintenance': {
      title: 'Bóveda en mantenimiento',
      message: 'Los depósitos y retiros están en pausa durante el mantenimiento. Tus fondos están seguros; inténtalo más tarde.',
      action: 'Reintentar más tarde',
    },
    'deposit-cap-reached': {
      title: 'Límite de depósito alcanzado',
      message: 'La bóveda está llena. Prueba con un importe menor o vuelve cuando haya espacio.',
    },
    'invalid-amount': {
      title: 'Introduce un importe válido',
      message: 'El importe debe ser mayor que cero y suficiente para recibir al menos una participación.',
    },
    'amount-out-of-range': {
      title: 'Importe fuera de los límites',
      message: 'El importe está por debajo del mínimo o por encima del máximo permitido. Ajústalo e inténtalo de nuevo.',
    },
    'not-authorized': {
      title: 'Acción no disponible',
      message: 'Esta acción está reservada a una dirección aprobada y la billetera conectada no lo es.',
    },
    'insufficient-balance': {
      title: 'Saldo insuficiente',
      message: 'No tienes suficientes tokens o participaciones para este importe. Redúcelo o añade fondos.',
    },
    'allowance-too-low': {
      title: 'Se necesita aprobación',
      message: 'Ndi-Fi necesita tu permiso para mover este token. Aprueba el importe en tu billetera y vuelve a intentarlo.',
      action: 'Aprobar y reintentar',
    },
    'insufficient-collateral': {
      title: 'Colateral insuficiente',
      message: 'Deposita más colateral o pide prestado un importe menor.',
    },
    'collateral-locked': {
      title: 'Colateral bloqueado',
      message: 'Parte de tu colateral respalda un préstamo activo. Paga el préstamo o retira un importe menor.',
    },
    'borrow-limit-exceeded': {
      title: 'Supera tu límite de préstamo',
      message: 'Este préstamo supera lo que permite tu colateral. Pide menos o añade colateral para evitar la liquidación.',
    },
    'loan-already-open': {
      title: 'Ya tienes un préstamo',
      message: 'Paga tu préstamo actual antes de abrir uno nuevo.',
    },
    'no-active-loan': {
      title: 'Sin préstamo activo',
      message: 'No hay ningún préstamo pendiente que pagar o liquidar.',
    },
    'full-repayment-required': {
      title: 'Paga el importe completo',
      message: 'Aún no se admiten pagos parciales. Introduce tu deuda total pendiente.',
      action: 'Usar importe total',
    },
    'insufficient-liquidity': {
      title: 'Liquidez insuficiente',
      message: 'La bóveda no tiene fondos disponibles suficientes para este importe ahora mismo. Prueba con menos.',
    },
    'token-not-supported': {
      title: 'Token no compatible',
      message: 'Este token no se puede usar como colateral. Elige uno de los tokens compatibles.',
    },
    'not-liquidatable': {
      title: 'Posición saludable',
      message: 'Este préstamo está por encima del umbral de liquidación, así que no se puede liquidar.',
    },
    'transfer-failed': {
      title: 'Falló la transferencia',
      message: 'La transferencia del token no se completó. Revisa tu saldo y la aprobación e inténtalo de nuevo.',
    },
    'already-staked': {
      title: 'Ya estás haciendo staking',
      message: 'Ya tienes un stake activo. Retíralo antes de iniciar uno nuevo.',
    },
    'no-active-stake': {
      title: 'Sin stake activo',
      message: 'No tienes ningún stake del que reclamar o retirar.',
    },
    'no-rewards': {
      title: 'Aún no hay recompensas',
      message: 'Las recompensas se acumulan con el tiempo. Vuelve más tarde para reclamarlas.',
    },
    'reward-pool-empty': {
      title: 'Recompensas no disponibles',
      message: 'Hay que recargar el fondo de recompensas antes de poder pagarlas. Tu stake no se ve afectado.',
    },
    'withdrawal-already-requested': {
      title: 'Retiro ya solicitado',
      message: 'Tu solicitud de retiro está abierta. Complétala cuando termine el periodo de espera.',
    },
    'withdrawal-not-requested': {
      title: 'Solicita primero el retiro',
      message: 'Inicia una solicitud de retiro; podrás completarla tras el periodo de espera.',
    },
    'cooldown-active': {
      title: 'Periodo de espera en curso',
      message: 'Podrás completar este retiro cuando haya pasado el periodo de espera.',
    },
    'calculation-overflow': {
      title: 'Importe demasiado grande',
      message: 'Este importe es demasiado grande para procesarlo. Prueba con uno menor.',
    },
    'contract-reverted': {
      title: 'La transacción falló',
      message: 'El contrato rechazó esta transacción y no se movieron fondos. Revisa los detalles e inténtalo de nuevo.',
    },
    'unknown-contract-error': {
      title: 'La transacción falló',
      message: 'El contrato devolvió un error que esta app no reconoce. Actualiza la página e inténtalo de nuevo.',
    },
    'wrong-network': {
      title: 'Red incorrecta',
      message: 'Tu billetera está en otra red. Cambia a {network} para continuar.',
    },
    'unsupported-network': {
      title: 'Red no añadida',
      message: 'Tu billetera aún no tiene {network}. Añádela y cambia para continuar.',
      action: 'Añadir y cambiar',
    },
    'network-unavailable': {
      title: 'No se puede conectar a la red',
      message: 'No pudimos conectar con la blockchain. Revisa tu conexión a internet e inténtalo de nuevo.',
    },
    'rate-limited': {
      title: 'Demasiadas solicitudes',
      message: 'La red está ocupada. Espera unos segundos e inténtalo de nuevo.',
      action: 'Reintentar en un momento',
    },
    'user-rejected': {
      title: 'Solicitud cancelada',
      message: 'Cancelaste la solicitud en tu billetera. No se envió nada.',
    },
    'wallet-not-found': {
      title: 'No se encontró billetera',
      message: 'Instala o activa una billetera de navegador, o conéctate con una billetera móvil.',
      action: 'Elegir billetera',
    },
    'wallet-disconnected': {
      title: 'Billetera desconectada',
      message: 'Tu billetera está bloqueada o ya no está conectada. Desbloquéala y vuelve a conectarla.',
      action: 'Reconectar billetera',
    },
    'request-pending': {
      title: 'Revisa tu billetera',
      message: 'Ya hay una solicitud esperando en tu billetera. Ábrela para aprobarla o rechazarla.',
    },
    'insufficient-gas': {
      title: 'Fondos insuficientes para comisiones',
      message: 'Necesitas un poco de {token} para pagar las comisiones de red. Añade algo a tu billetera e inténtalo de nuevo.',
    },
    unknown: {
      title: 'Algo salió mal',
      message: 'Ocurrió un error inesperado y no se cambió nada. Inténtalo de nuevo o contacta con soporte si persiste.',
    },
  },
};

const fr = {
  name: 'Français',
  defaults: { network: 'le réseau pris en charge', token: 'le jeton natif du réseau' },
  actions: {
    retry: 'Réessayer',
    'switch-network': 'Changer de réseau',
    'connect-wallet': 'Connecter le portefeuille',
    edit: 'Modifier le montant',
    dismiss: 'Fermer',
  },
  ui: { details: 'Détails techniques', dismiss: 'Fermer' },
  templates: {
    'vault-maintenance': {
      title: 'Coffre en maintenance',
      message: 'Les dépôts et retraits sont suspendus pendant la maintenance. Vos fonds sont en sécurité ; réessayez plus tard.',
      action: 'Réessayer plus tard',
    },
    'deposit-cap-reached': {
      title: 'Plafond de dépôt atteint',
      message: 'Le coffre est plein. Essayez un montant plus petit ou revenez quand de la place se libère.',
    },
    'invalid-amount': {
      title: 'Saisissez un montant valide',
      message: 'Le montant doit être supérieur à zéro et suffisant pour recevoir au moins une part.',
    },
    'amount-out-of-range': {
      title: 'Montant hors limites',
      message: 'Ce montant est inférieur au minimum ou supérieur au maximum autorisé. Ajustez-le et réessayez.',
    },
    'not-authorized': {
      title: 'Action indisponible',
      message: 'Cette action est réservée à une adresse approuvée, ce qui n’est pas le cas du portefeuille connecté.',
    },
    'insufficient-balance': {
      title: 'Solde insuffisant',
      message: 'Vous n’avez pas assez de jetons ou de parts pour ce montant. Réduisez-le ou ajoutez des fonds.',
    },
    'allowance-too-low': {
      title: 'Autorisation requise',
      message: 'Ndi-Fi a besoin de votre autorisation pour déplacer ce jeton. Approuvez le montant dans votre portefeuille, puis réessayez.',
      action: 'Approuver et réessayer',
    },
    'insufficient-collateral': {
      title: 'Garantie insuffisante',
      message: 'Déposez plus de garantie ou empruntez un montant plus faible.',
    },
    'collateral-locked': {
      title: 'Garantie bloquée',
      message: 'Une partie de votre garantie couvre un prêt actif. Remboursez le prêt ou retirez un montant plus faible.',
    },
    'borrow-limit-exceeded': {
      title: 'Limite d’emprunt dépassée',
      message: 'Ce prêt dépasse ce que votre garantie permet. Empruntez moins ou ajoutez de la garantie pour éviter la liquidation.',
    },
    'loan-already-open': {
      title: 'Prêt déjà ouvert',
      message: 'Remboursez votre prêt actuel avant d’en ouvrir un nouveau.',
    },
    'no-active-loan': {
      title: 'Aucun prêt actif',
      message: 'Il n’y a aucun prêt en cours à rembourser ou à liquider.',
    },
    'full-repayment-required': {
      title: 'Remboursez la totalité',
      message: 'Les remboursements partiels ne sont pas encore pris en charge. Saisissez la totalité de votre dette.',
      action: 'Utiliser le montant total',
    },
    'insufficient-liquidity': {
      title: 'Liquidité insuffisante',
      message: 'Le coffre n’a pas assez de fonds disponibles pour ce montant pour le moment. Essayez un montant plus petit.',
    },
    'token-not-supported': {
      title: 'Jeton non pris en charge',
      message: 'Ce jeton ne peut pas servir de garantie. Choisissez l’un des jetons pris en charge.',
    },
    'not-liquidatable': {
      title: 'Position saine',
      message: 'Ce prêt est au-dessus du seuil de liquidation : il ne peut pas être liquidé.',
    },
    'transfer-failed': {
      title: 'Échec du transfert',
      message: 'Le transfert du jeton n’a pas abouti. Vérifiez votre solde et votre autorisation, puis réessayez.',
    },
    'already-staked': {
      title: 'Staking déjà actif',
      message: 'Vous avez déjà un stake actif. Retirez-le avant d’en commencer un nouveau.',
    },
    'no-active-stake': {
      title: 'Aucun stake actif',
      message: 'Vous n’avez aucun stake à réclamer ou à retirer.',
    },
    'no-rewards': {
      title: 'Pas encore de récompenses',
      message: 'Les récompenses s’accumulent avec le temps. Revenez plus tard pour les réclamer.',
    },
    'reward-pool-empty': {
      title: 'Récompenses indisponibles',
      message: 'La réserve de récompenses doit être réapprovisionnée avant tout paiement. Votre stake n’est pas affecté.',
    },
    'withdrawal-already-requested': {
      title: 'Retrait déjà demandé',
      message: 'Votre demande de retrait est ouverte. Finalisez-la à la fin du délai d’attente.',
    },
    'withdrawal-not-requested': {
      title: 'Demandez d’abord un retrait',
      message: 'Lancez une demande de retrait ; vous pourrez la finaliser après le délai d’attente.',
    },
    'cooldown-active': {
      title: 'Délai d’attente en cours',
      message: 'Vous pourrez finaliser ce retrait une fois le délai d’attente écoulé.',
    },
    'calculation-overflow': {
      title: 'Montant trop élevé',
      message: 'Ce montant est trop élevé pour être traité. Essayez un montant plus petit.',
    },
    'contract-reverted': {
      title: 'Échec de la transaction',
      message: 'Le contrat a refusé cette transaction et aucun fonds n’a bougé. Vérifiez les détails et réessayez.',
    },
    'unknown-contract-error': {
      title: 'Échec de la transaction',
      message: 'Le contrat a renvoyé une erreur que l’application ne reconnaît pas. Actualisez la page, puis réessayez.',
    },
    'wrong-network': {
      title: 'Mauvais réseau',
      message: 'Votre portefeuille est sur un autre réseau. Passez sur {network} pour continuer.',
    },
    'unsupported-network': {
      title: 'Réseau non ajouté',
      message: 'Votre portefeuille ne connaît pas encore {network}. Ajoutez-le et basculez pour continuer.',
      action: 'Ajouter et basculer',
    },
    'network-unavailable': {
      title: 'Réseau injoignable',
      message: 'Impossible de se connecter à la blockchain. Vérifiez votre connexion internet et réessayez.',
    },
    'rate-limited': {
      title: 'Trop de requêtes',
      message: 'Le réseau est saturé. Patientez quelques secondes et réessayez.',
      action: 'Réessayer dans un instant',
    },
    'user-rejected': {
      title: 'Demande annulée',
      message: 'Vous avez annulé la demande dans votre portefeuille. Rien n’a été envoyé.',
    },
    'wallet-not-found': {
      title: 'Aucun portefeuille trouvé',
      message: 'Installez ou activez un portefeuille de navigateur, ou connectez-vous avec un portefeuille mobile.',
      action: 'Choisir un portefeuille',
    },
    'wallet-disconnected': {
      title: 'Portefeuille déconnecté',
      message: 'Votre portefeuille est verrouillé ou n’est plus connecté. Déverrouillez-le et reconnectez-vous.',
      action: 'Reconnecter le portefeuille',
    },
    'request-pending': {
      title: 'Vérifiez votre portefeuille',
      message: 'Une demande attend déjà dans votre portefeuille. Ouvrez-le pour l’approuver ou la refuser.',
    },
    'insufficient-gas': {
      title: 'Fonds insuffisants pour les frais',
      message: 'Il vous faut un peu de {token} pour payer les frais de réseau. Ajoutez-en à votre portefeuille et réessayez.',
    },
    unknown: {
      title: 'Une erreur est survenue',
      message: 'Une erreur inattendue s’est produite et rien n’a été modifié. Réessayez ou contactez le support si cela persiste.',
    },
  },
};

export const ERROR_MESSAGES = Object.freeze({ en, es, fr });

/** Locales with full translations. */
export const ERROR_LOCALES = Object.freeze(Object.keys(ERROR_MESSAGES));

/**
 * Messages for a locale. Accepts region tags (`fr-CA` → `fr`) and falls back
 * to English; missing keys in a locale also fall back to English.
 */
export function getMessages(locale = 'en') {
  const base = String(locale || 'en').toLowerCase().split(/[-_]/)[0];
  const code = ERROR_MESSAGES[base] ? base : 'en';
  const pack = ERROR_MESSAGES[code];
  return {
    locale: code,
    defaults: { ...en.defaults, ...pack.defaults },
    actions: { ...en.actions, ...pack.actions },
    ui: { ...en.ui, ...pack.ui },
    templates: { ...en.templates, ...pack.templates },
  };
}
