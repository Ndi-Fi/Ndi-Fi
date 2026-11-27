// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import {NdiFiVault} from "./NdiFiVault.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from
    "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title NdiFiLending
/// @notice Collateralized lending market backed by liquidity in `NdiFiVault`.
/// @dev Loan terms and collateral parameters are configured by the owner via `initialize` and the setter functions.
contract NdiFiLending is Ownable, ReentrancyGuard, Pausable {
    /// @notice Loan record for a borrower.
    /// @dev `collateralAmount` is the token amount locked for this loan, not a USD value.
    struct Loan {
        uint256 principal; // Original borrowed amount
        uint256 originationFee; // One-time origination fee
        uint256 collateralAmount; // Actual collateral locked for this loan
        uint256 startTime; // Loan start timestamp
        bool isActive; // Loan status
    }

    /// @notice Supported collateral token and the price feed used to value it.
    struct CollateralToken {
        address tokenAddress;
        AggregatorV3Interface priceFeed;
    }

    /// @notice Configuration for a supported collateral token, including its Chainlink price feed.
    mapping(address => CollateralToken) public supportedCollateralTokens;

    /// @notice List of collateral tokens currently accepted by the market.
    address[] public supportedCollateralTokenAddresses;

    /// @notice ERC-20 token lent to borrowers.
    IERC20 public immutable lendingToken;

    /// @notice Vault that supplies loan liquidity.
    NdiFiVault public immutable vault;
    AggregatorV3Interface internal lendingTokenPriceFeed;

    /// @notice Maximum loan-to-value percentage, e.g. 75 means 75%.
    uint256 public collateralFactor;

    /// @notice Collateral value percentage at which a loan becomes liquidatable, e.g. 85 means 85%.
    uint256 public liquidationThreshold;

    /// @notice One-time origination fee rate in basis points, charged when a loan is taken.
    uint256 public originationFeeRate;

    /// @notice Liquidation penalty in basis points applied to repaid debt value.
    uint256 public liquidationPenalty;

    /// @notice Number of seconds in a year, used by interest and reward calculations.
    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

    /// @notice Basis point divisor (10,000).
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Unlocked collateral balances by account and token.
    mapping(address => mapping(address => uint256)) public collateralBalances;

    /// @notice Collateral locked against active loans by account and token.
    mapping(address => mapping(address => uint256)) public lockedCollateral;

    /// @notice Active and historical loan records by borrower.
    mapping(address => Loan) public loans;

    /// @notice Total collateral deposited across all accounts.
    uint256 public totalCollateral;

    /// @notice Total principal currently borrowed across all loans.
    uint256 public totalBorrowed;

    // Initialization tracking
    bool private initialized;

    /// @notice Emitted when a user deposits collateral.
    /// @param user Account that deposited the collateral.
    /// @param amount Amount of collateral deposited.
    event CollateralDeposited(address indexed user, uint256 amount);

    /// @notice Emitted when a user withdraws unlocked collateral.
    /// @param user Account that withdrew the collateral.
    /// @param amount Amount of collateral withdrawn.
    event CollateralWithdrawn(address indexed user, uint256 amount);

    /// @notice Emitted when a borrower takes a new loan.
    /// @param user Borrower receiving the loan.
    /// @param principal Principal amount borrowed.
    /// @param collateralLocked Amount of collateral locked for the loan.
    event LoanTaken(address indexed user, uint256 principal, uint256 collateralLocked);

    /// @notice Emitted when a borrower repays an active loan in full.
    /// @param user Borrower repaying the loan.
    /// @param amount Total amount repaid, including the origination fee.
    /// @param originationFee Origination fee included in the repayment.
    event LoanRepaid(address indexed user, uint256 amount, uint256 originationFee);

    /// @notice Emitted when an undercollateralized loan is liquidated.
    /// @param borrower Borrower whose loan was liquidated.
    /// @param liquidator Account that repaid the debt and seized collateral.
    /// @param collateralSeized Value of collateral seized, price-denominated.
    /// @param debtRepaid Amount of debt repaid by the liquidator.
    event LoanLiquidated(
        address indexed borrower, address indexed liquidator, uint256 collateralSeized, uint256 debtRepaid
    );

    /// @notice Emitted when the origination fee rate is updated.
    /// @param oldRate Previous origination fee rate in basis points.
    /// @param newRate New origination fee rate in basis points.
    event OriginationFeeRateUpdated(uint256 oldRate, uint256 newRate);

    /// @notice Emitted once when the market parameters are initialized.
    /// @param collateralFactor Initial loan-to-value percentage.
    /// @param liquidationThreshold Initial liquidation threshold percentage.
    /// @param originationFeeRate Initial origination fee rate in basis points.
    /// @param penalty Initial liquidation penalty in basis points.
    event ContractInitialized(
        uint256 collateralFactor, uint256 liquidationThreshold, uint256 originationFeeRate, uint256 penalty
    );

    modifier onlyLiquidator() {
        require(msg.sender == owner(), "Not authorized liquidator");
        _;
    }

    modifier onlyInitialized() {
        require(initialized, "Contract not initialized");
        _;
    }

    /// @notice Deploys the lending market.
    /// @param _lendingToken ERC-20 token lent to borrowers.
    /// @param _vault Vault that holds the available liquidity.
    /// @param _lendingTokenPriceFeed Chainlink price feed for the lending token.
    constructor(IERC20 _lendingToken, NdiFiVault _vault, AggregatorV3Interface _lendingTokenPriceFeed)
        Ownable(msg.sender)
    {
        require(address(_lendingToken) != address(0), "Invalid lending token");
        require(address(_vault) != address(0), "Invalid vault address");

        lendingToken = _lendingToken;
        vault = _vault;
        lendingTokenPriceFeed = _lendingTokenPriceFeed;
    }

    /// @notice Adds a collateral token and its Chainlink price feed.
    /// @dev Only callable by the owner. The token must not already be supported.
    /// @param _tokenAddress Address of the collateral ERC-20 token.
    /// @param _priceFeedAddress Address of the token's Chainlink price feed.
    function addCollateralToken(address _tokenAddress, address _priceFeedAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_priceFeedAddress != address(0), "Invalid price feed address");
        require(supportedCollateralTokens[_tokenAddress].tokenAddress == address(0), "Token already supported");

        supportedCollateralTokens[_tokenAddress] =
            CollateralToken({tokenAddress: _tokenAddress, priceFeed: AggregatorV3Interface(_priceFeedAddress)});
        supportedCollateralTokenAddresses.push(_tokenAddress);
    }

    /// @notice Removes a collateral token from the supported set.
    /// @dev Only callable by the owner.
    /// @param _tokenAddress Address of the collateral token to remove.
    function removeCollateralToken(address _tokenAddress) external onlyOwner {
        require(supportedCollateralTokens[_tokenAddress].tokenAddress != address(0), "Token not supported");

        delete supportedCollateralTokens[_tokenAddress];

        for (uint256 i = 0; i < supportedCollateralTokenAddresses.length; i++) {
            if (supportedCollateralTokenAddresses[i] == _tokenAddress) {
                supportedCollateralTokenAddresses[i] =
                    supportedCollateralTokenAddresses[supportedCollateralTokenAddresses.length - 1];
                supportedCollateralTokenAddresses.pop();
                break;
            }
        }
    }

    /// @notice Sets the initial market parameters and marks the contract initialized.
    /// @dev Only callable by the owner and only once. Emits `ContractInitialized`.
    /// @param _collateralFactor Loan-to-value percentage (1-100).
    /// @param _liquidationThreshold Liquidation threshold percentage, greater than `_collateralFactor`.
    /// @param _originationFeeRate One-time origination fee rate in basis points (max 10%).
    /// @param _liquidationPenalty Liquidation penalty in basis points (max 20%).
    function initialize(
        uint256 _collateralFactor,
        uint256 _liquidationThreshold,
        uint256 _originationFeeRate,
        uint256 _liquidationPenalty
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        require(_collateralFactor <= 100 && _collateralFactor > 0, "Invalid collateral factor");
        require(
            _liquidationThreshold <= 100 && _liquidationThreshold > _collateralFactor, "Invalid liquidation threshold"
        );
        require(_originationFeeRate <= 1000, "Origination fee too high"); // Max 10%
        require(_liquidationPenalty <= 2000, "Liquidation penalty too high"); // Max 20%

        collateralFactor = _collateralFactor;
        liquidationThreshold = _liquidationThreshold;
        originationFeeRate = _originationFeeRate;
        liquidationPenalty = _liquidationPenalty;

        initialized = true;

        emit ContractInitialized(_collateralFactor, _liquidationThreshold, _originationFeeRate, _liquidationPenalty);
    }

    /// @notice Updates the maximum loan-to-value percentage.
    /// @dev Only callable by the owner after initialization; must remain below the liquidation threshold.
    /// @param _newFactor New loan-to-value percentage (1-100).
    function setCollateralFactor(uint256 _newFactor) external onlyOwner onlyInitialized {
        require(_newFactor <= 100 && _newFactor > 0, "Invalid collateral factor");
        require(_newFactor < liquidationThreshold, "Must be less than liquidation threshold");
        collateralFactor = _newFactor;
    }

    /// @notice Updates the collateral value percentage at which loans become liquidatable.
    /// @dev Only callable by the owner after initialization; must be greater than the collateral factor.
    /// @param _newThreshold New liquidation threshold percentage.
    function setLiquidationThreshold(uint256 _newThreshold) external onlyOwner onlyInitialized {
        require(_newThreshold <= 100 && _newThreshold > collateralFactor, "Invalid liquidation threshold");
        liquidationThreshold = _newThreshold;
    }

    /// @notice Updates the one-time origination fee rate.
    /// @dev Only callable by the owner after initialization; emits `OriginationFeeRateUpdated`.
    /// @param _newRate New origination fee rate in basis points (max 1,000).
    function setOriginationFeeRate(uint256 _newRate) external onlyOwner onlyInitialized {
        require(_newRate <= 1000, "Origination fee too high");
        uint256 oldRate = originationFeeRate;
        originationFeeRate = _newRate;
        emit OriginationFeeRateUpdated(oldRate, _newRate);
    }

    /// @notice Updates the penalty applied when a loan is liquidated.
    /// @dev Only callable by the owner after initialization.
    /// @param _newPenalty New liquidation penalty in basis points (max 2,000).
    function setLiquidationPenalty(uint256 _newPenalty) external onlyOwner onlyInitialized {
        require(_newPenalty <= 2000, "Liquidation penalty too high");
        liquidationPenalty = _newPenalty;
    }

    /// @notice Pauses deposits, withdrawals, borrowing, repayments and liquidations.
    /// @dev Only callable by the owner.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes all paused market operations.
    /// @dev Only callable by the owner.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Deposits a supported collateral token on behalf of the caller.
    /// @dev Requires prior ERC-20 approval to this contract and an initialized, unpaused market.
    /// @param _tokenAddress Address of the supported collateral token.
    /// @param _amount Amount of collateral to deposit.
    function depositCollateral(address _tokenAddress, uint256 _amount)
        external
        whenNotPaused
        nonReentrant
        onlyInitialized
    {
        require(_amount > 0, "Amount must be greater than zero");
        require(supportedCollateralTokens[_tokenAddress].tokenAddress != address(0), "Token not supported");

        require(IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        collateralBalances[msg.sender][_tokenAddress] += _amount;
        totalCollateral += _amount;

        emit CollateralDeposited(msg.sender, _amount);
    }

    /// @notice Withdraws collateral that is not locked against an active loan.
    /// @dev Reverts if the requested amount exceeds the unlocked balance.
    /// @param _tokenAddress Address of the collateral token.
    /// @param _amount Amount of collateral to withdraw.
    function withdrawCollateral(address _tokenAddress, uint256 _amount)
        external
        whenNotPaused
        nonReentrant
        onlyInitialized
    {
        require(_amount > 0, "Amount must be greater than zero");
        require(collateralBalances[msg.sender][_tokenAddress] >= _amount, "Insufficient collateral");

        uint256 lockedCollateralTokens = _getLockedCollateral(msg.sender, _tokenAddress);
        uint256 availableCollateral = collateralBalances[msg.sender][_tokenAddress] - lockedCollateralTokens;
        require(_amount <= availableCollateral, "Cannot withdraw collateral locked for loan");

        collateralBalances[msg.sender][_tokenAddress] -= _amount;
        totalCollateral -= _amount;

        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "Transfer failed");

        emit CollateralWithdrawn(msg.sender, _amount);
    }

    /// @notice Calculates the price-denominated value of all collateral deposited by an account.
    /// @param _user Account whose collateral is valued.
    /// @return Total collateral value across every supported token.
    function getCollateralValue(address _user) public view returns (uint256) {
        uint256 totalCollateralValue = 0;
        for (uint256 i = 0; i < supportedCollateralTokenAddresses.length; i++) {
            address tokenAddress = supportedCollateralTokenAddresses[i];
            uint256 collateralAmount = collateralBalances[_user][tokenAddress];
            if (collateralAmount > 0) {
                uint256 tokenPrice = _getLatestPrice(supportedCollateralTokens[tokenAddress].priceFeed);
                uint256 collateralDecimals = ERC20(tokenAddress).decimals();
                totalCollateralValue += (collateralAmount * tokenPrice) / (10 ** collateralDecimals);
            }
        }
        return totalCollateralValue;
    }

    /// @notice Borrows lending tokens against the caller's collateral.
    /// @dev The caller may have at most one active loan; the net proceeds are sent from the vault.
    /// @param _amount Principal amount to borrow, including the origination fee.
    function takeLoan(uint256 _amount) external whenNotPaused nonReentrant onlyInitialized {
        require(getCollateralValue(msg.sender) > 0, "No collateral deposited");
        require(_amount > 0, "Amount must be greater than zero");
        require(!loans[msg.sender].isActive, "Existing loan must be repaid first");

        // Calculate one-time origination fee
        uint256 originationFee = (_amount * originationFeeRate) / BASIS_POINTS;
        uint256 netLoanAmount = _amount - originationFee;

        // Check vault has sufficient liquidity
        require(vault.getAvailableLiquidity() >= netLoanAmount, "Insufficient vault liquidity");

        uint256 collateralValue = getCollateralValue(msg.sender);
        uint256 maxLoanValue = (collateralValue * collateralFactor) / 100;

        uint256 lendingTokenPrice = _getLatestPrice(lendingTokenPriceFeed);
        uint256 lendingDecimals = ERC20(address(lendingToken)).decimals();
        uint256 requestedLoanValue = (_amount * lendingTokenPrice) / (10 ** lendingDecimals);

        require(requestedLoanValue <= maxLoanValue, "Loan exceeds collateral limit");

        uint256 requiredCollateralValue = (requestedLoanValue * 100) / collateralFactor;
        require(collateralValue >= requiredCollateralValue, "Insufficient collateral for this loan");

        uint256 lockedCollateralValue = 0;
        uint256 totalLockedCollateral = 0;

        for (uint256 i = 0; i < supportedCollateralTokenAddresses.length; i++) {
            address tokenAddress = supportedCollateralTokenAddresses[i];
            uint256 availableAmount =
                collateralBalances[msg.sender][tokenAddress] - lockedCollateral[msg.sender][tokenAddress];

            if (availableAmount > 0) {
                uint256 tokenPrice = _getLatestPrice(supportedCollateralTokens[tokenAddress].priceFeed);
                uint256 collateralDecimals = ERC20(tokenAddress).decimals();
                uint256 availableValue = (availableAmount * tokenPrice) / (10 ** collateralDecimals);

                if (availableValue > 0) {
                    uint256 amountToLock;
                    if (lockedCollateralValue + availableValue >= requiredCollateralValue) {
                        amountToLock = ((requiredCollateralValue - lockedCollateralValue) * (10 ** collateralDecimals))
                            / tokenPrice;
                    } else {
                        amountToLock = availableAmount;
                    }

                    lockedCollateral[msg.sender][tokenAddress] += amountToLock;
                    totalLockedCollateral += amountToLock;
                    lockedCollateralValue += (amountToLock * tokenPrice) / (10 ** collateralDecimals);

                    if (lockedCollateralValue >= requiredCollateralValue) {
                        break;
                    }
                }
            }
        }

        loans[msg.sender] = Loan({
            principal: _amount,
            originationFee: originationFee,
            collateralAmount: totalLockedCollateral,
            startTime: block.timestamp,
            isActive: true
        });

        totalBorrowed += _amount;

        // Get lending tokens from vault and send net amount to borrower
        vault.withdrawForLoan(msg.sender, netLoanAmount);

        emit LoanTaken(msg.sender, _amount, totalLockedCollateral);
    }

    /// @notice Repays an active loan in full and unlocks the borrower's collateral.
    /// @dev Requires ERC-20 approval for the total debt (principal plus origination fee).
    /// @param _amount Full debt amount to repay.
    function repayLoan(uint256 _amount) external whenNotPaused nonReentrant onlyInitialized {
        Loan storage userLoan = loans[msg.sender];
        require(userLoan.isActive, "No active loan");
        require(_amount > 0, "Amount must be greater than zero");

        uint256 totalDebt = userLoan.principal + userLoan.originationFee;
        require(_amount == totalDebt, "Must repay full debt amount");

        require(lendingToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        // Clear the loan
        userLoan.isActive = false;
        totalBorrowed -= userLoan.principal;

        for (uint256 i = 0; i < supportedCollateralTokenAddresses.length; i++) {
            address tokenAddress = supportedCollateralTokenAddresses[i];
            lockedCollateral[msg.sender][tokenAddress] = 0;
        }

        emit LoanRepaid(msg.sender, _amount, userLoan.originationFee);

        // Reset loan data
        userLoan.principal = 0;
        userLoan.originationFee = 0;
    }

    /// @notice Liquidates an undercollateralized loan and seizes the borrower's collateral.
    /// @dev Only callable by the owner; the liquidator must repay the outstanding debt first.
    /// @param _borrower Address of the borrower whose loan is liquidated.
    function liquidateLoan(address _borrower) external onlyLiquidator nonReentrant onlyInitialized {
        Loan storage loan = loans[_borrower];
        require(loan.isActive, "No active loan");

        uint256 healthFactor = calculateHealthFactor(_borrower);
        require(healthFactor < 100, "Loan is not liquidatable");

        uint256 totalDebt = loan.principal + loan.originationFee;
        uint256 totalDebtValue =
            (totalDebt * _getLatestPrice(lendingTokenPriceFeed)) / (10 ** ERC20(address(lendingToken)).decimals());

        uint256 penaltyValue = (totalDebtValue * liquidationPenalty) / BASIS_POINTS;
        uint256 collateralToSeizeValue = totalDebtValue + penaltyValue;

        // Repay debt (transfer lending token from liquidator to this contract)
        require(lendingToken.transferFrom(msg.sender, address(this), totalDebt), "Debt repayment failed");

        // Get collateral addresses sorted by value
        address[] memory sortedCollateral = _sortCollateral(_borrower);

        uint256 seizedValue = 0;

        // Loop tokens; call compact helper to seize from each token
        for (uint256 i = 0; i < sortedCollateral.length && seizedValue < collateralToSeizeValue; i++) {
            (uint256 addedValue, uint256 amountSeized) =
                _seizeFromToken(_borrower, sortedCollateral[i], collateralToSeizeValue - seizedValue);
            amountSeized += 0;
            // addedValue is the USD (or price-denominated) value we added to seizedValue
            if (addedValue > 0) {
                seizedValue += addedValue;
            }
        }

        // Update global accounting & loan state
        totalBorrowed -= loan.principal;

        loan.isActive = false;
        loan.principal = 0;
        loan.originationFee = 0;

        emit LoanLiquidated(_borrower, msg.sender, seizedValue, totalDebt);
    }

    function _sortCollateral(address _user) internal view returns (address[] memory) {
        address[] memory collateral = new address[](supportedCollateralTokenAddresses.length);
        uint256[] memory values = new uint256[](supportedCollateralTokenAddresses.length);

        for (uint256 i = 0; i < supportedCollateralTokenAddresses.length; i++) {
            address tokenAddress = supportedCollateralTokenAddresses[i];
            uint256 collateralAmount = collateralBalances[_user][tokenAddress];
            if (collateralAmount > 0) {
                uint256 tokenPrice = _getLatestPrice(supportedCollateralTokens[tokenAddress].priceFeed);
                uint256 collateralDecimals = ERC20(tokenAddress).decimals();
                values[i] = (collateralAmount * tokenPrice) / (10 ** collateralDecimals);
                collateral[i] = tokenAddress;
            }
        }

        for (uint256 i = 1; i < collateral.length; i++) {
            address tempAddress = collateral[i];
            uint256 tempValue = values[i];
            uint256 j = i;
            while (j > 0 && values[j - 1] < tempValue) {
                collateral[j] = collateral[j - 1];
                values[j] = values[j - 1];
                j--;
            }
            collateral[j] = tempAddress;
            values[j] = tempValue;
        }

        return collateral;
    }

    function _getLockedCollateral(address _user, address _tokenAddress) internal view returns (uint256) {
        return lockedCollateral[_user][_tokenAddress];
    }

    function _getLatestPrice(AggregatorV3Interface priceFeed) internal view returns (uint256) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        // Price is returned with 8 decimals, so we convert it to 18 decimals
        return uint256(price) * 1e10;
    }
    /// @dev Seizes collateral of a single token up to `remainingValueToSeize`.
    /// @param borrower Borrower whose collateral is seized.
    /// @param tokenAddress Address of the collateral token.
    /// @param remainingValueToSeize Remaining debt value to cover.
    /// @return seizedValueAdded Value (price-denominated) that was seized.
    /// @return amountSeized Token units that were removed or transferred.
    function _seizeFromToken(address borrower, address tokenAddress, uint256 remainingValueToSeize)
        internal
        returns (uint256 seizedValueAdded, uint256 amountSeized)
    {
        uint256 collateralAmount = collateralBalances[borrower][tokenAddress];
        if (collateralAmount == 0 || remainingValueToSeize == 0) {
            return (0, 0);
        }

        uint256 tokenPrice = _getLatestPrice(supportedCollateralTokens[tokenAddress].priceFeed);
        uint256 collateralDecimals = ERC20(tokenAddress).decimals();
        uint256 value = (collateralAmount * tokenPrice) / (10 ** collateralDecimals);
        if (value == 0) {
            return (0, 0);
        }

        if (value >= remainingValueToSeize) {
            // calculate token amount that equals remainingValueToSeize
            amountSeized = (remainingValueToSeize * (10 ** collateralDecimals)) / tokenPrice;
            // rounding; ensure not to exceed collateralAmount because of rounding
            if (amountSeized > collateralAmount) {
                amountSeized = collateralAmount;
            }
        } else {
            amountSeized = collateralAmount;
        }

        // Update storage and transfer to msg.sender (liquidator)
        collateralBalances[borrower][tokenAddress] -= amountSeized;
        lockedCollateral[borrower][tokenAddress] = 0;
        totalCollateral -= amountSeized;

        require(IERC20(tokenAddress).transfer(msg.sender, amountSeized), "Collateral transfer failed");

        seizedValueAdded = (amountSeized * tokenPrice) / (10 ** collateralDecimals);
    }

    /// @notice Returns the price-denominated value of a borrower's active principal.
    /// @param _user Borrower to query.
    /// @return Value of the outstanding principal, or zero when no loan is active.
    function getLoanValue(address _user) public view returns (uint256) {
        Loan memory loan = loans[_user];
        if (!loan.isActive) {
            return 0;
        }
        uint256 loanAmount = loan.principal;
        uint256 tokenPrice = _getLatestPrice(lendingTokenPriceFeed);
        uint256 lendingDecimals = ERC20(address(lendingToken)).decimals();
        return (loanAmount * tokenPrice) / (10 ** lendingDecimals);
    }

    /// @notice Calculates the health factor of a borrower's loan.
    /// @dev A value below 100 means the loan is liquidatable; accounts without a loan return the maximum value.
    /// @param _borrower Borrower to query.
    /// @return Health factor scaled by 100.
    function calculateHealthFactor(address _borrower) public view returns (uint256) {
        if (!initialized) return type(uint256).max;

        Loan memory loan = loans[_borrower];
        if (!loan.isActive) return type(uint256).max;

        uint256 totalDebtValue = getLoanValue(_borrower);
        if (totalDebtValue == 0) return type(uint256).max;

        uint256 collateralValue = getCollateralValue(_borrower);
        uint256 liquidationValue = (collateralValue * liquidationThreshold) / 100;

        return (liquidationValue * 100) / totalDebtValue;
    }

    /// @notice Returns the full loan record and health information for an account.
    /// @param _user Borrower to query.
    /// @return principal Outstanding principal.
    /// @return originationFee Origination fee charged when the loan was taken.
    /// @return totalDebt Principal plus origination fee.
    /// @return collateralAmount Collateral locked for the loan.
    /// @return healthFactor Health factor scaled by 100, or the maximum value when no loan is active.
    /// @return isActive Whether the account currently has an active loan.
    function getLoanDetails(address _user)
        external
        view
        returns (
            uint256 principal,
            uint256 originationFee,
            uint256 totalDebt,
            uint256 collateralAmount,
            uint256 healthFactor,
            bool isActive
        )
    {
        if (!initialized) {
            return (0, 0, 0, 0, type(uint256).max, false);
        }

        Loan memory userLoan = loans[_user];
        uint256 totalDebtAmount = userLoan.principal + userLoan.originationFee;
        uint256 healthFactorValue = userLoan.isActive ? calculateHealthFactor(_user) : type(uint256).max;

        return (
            userLoan.principal,
            userLoan.originationFee,
            totalDebtAmount,
            userLoan.collateralAmount,
            healthFactorValue,
            userLoan.isActive
        );
    }

    /// @notice Returns aggregate market statistics.
    /// @return totalCollateralAmount Total collateral deposited across all accounts.
    /// @return totalBorrowedAmount Total principal currently borrowed.
    /// @return availableLiquidity Lending token balance available in the vault.
    /// @return utilizationRate Percentage of liquidity currently borrowed, scaled by 100.
    function getContractStats()
        external
        view
        returns (
            uint256 totalCollateralAmount,
            uint256 totalBorrowedAmount,
            uint256 availableLiquidity,
            uint256 utilizationRate
        )
    {
        uint256 liquidity = vault.getAvailableLiquidity();
        uint256 utilization = totalBorrowed == 0 ? 0 : (totalBorrowed * 100) / (totalBorrowed + liquidity);

        return (totalCollateral, totalBorrowed, liquidity, utilization);
    }

    /// @notice Reports whether the market parameters have been initialized.
    /// @return True once `initialize` has been called.
    function isInitialized() external view returns (bool) {
        return initialized;
    }

    /// @notice Transfers tokens accidentally sent to this contract to the owner.
    /// @dev Only callable by the owner.
    /// @param _token Address of the ERC-20 token to recover.
    /// @param _amount Amount of tokens to transfer.
    function emergencyWithdraw(IERC20 _token, uint256 _amount) external onlyOwner {
        require(_token.transfer(owner(), _amount), "Emergency withdrawal failed");
    }
}
