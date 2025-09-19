// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {NdiFiVault} from "./NdiFiVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from
    "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract NdiFiLending is Ownable, ReentrancyGuard, Pausable {
    struct Loan {
        uint256 principal; // Original borrowed amount
        uint256 originationFee; // One-time origination fee
        uint256 collateralAmount; // Actual collateral locked for this loan
        uint256 startTime; // Loan start timestamp
        bool isActive; // Loan status
    }

    struct CollateralToken {
        address tokenAddress;
        AggregatorV3Interface priceFeed;
    }

    mapping(address => CollateralToken) public supportedCollateralTokens;
    address[] public supportedCollateralTokenAddresses;

    IERC20 public immutable lendingToken;
    NdiFiVault public immutable vault;
    AggregatorV3Interface internal lendingTokenPriceFeed;

    uint256 public collateralFactor; // Percentage (e.g., 75 = 75%)
    uint256 public liquidationThreshold; // Threshold for liquidation (e.g., 85%)
    uint256 public originationFeeRate; // One-time origination fee rate in basis points (charged at loan origination)
    uint256 public liquidationPenalty; // Liquidation penalty in basis points

    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    uint256 public constant BASIS_POINTS = 10000;

    mapping(address => mapping(address => uint256)) public collateralBalances;
    mapping(address => mapping(address => uint256)) public lockedCollateral;
    mapping(address => Loan) public loans;

    uint256 public totalCollateral;
    uint256 public totalBorrowed;

    // Initialization tracking
    bool private initialized;

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event LoanTaken(address indexed user, uint256 principal, uint256 collateralLocked);
    event LoanRepaid(address indexed user, uint256 amount, uint256 originationFee);
    event LoanLiquidated(
        address indexed borrower, address indexed liquidator, uint256 collateralSeized, uint256 debtRepaid
    );
    event OriginationFeeRateUpdated(uint256 oldRate, uint256 newRate);
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

    constructor(IERC20 _lendingToken, NdiFiVault _vault, AggregatorV3Interface _lendingTokenPriceFeed)
        Ownable(msg.sender)
    {
        require(address(_lendingToken) != address(0), "Invalid lending token");
        require(address(_vault) != address(0), "Invalid vault address");

        lendingToken = _lendingToken;
        vault = _vault;
        lendingTokenPriceFeed = _lendingTokenPriceFeed;
    }

    function addCollateralToken(address _tokenAddress, address _priceFeedAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_priceFeedAddress != address(0), "Invalid price feed address");
        require(supportedCollateralTokens[_tokenAddress].tokenAddress == address(0), "Token already supported");

        supportedCollateralTokens[_tokenAddress] =
            CollateralToken({tokenAddress: _tokenAddress, priceFeed: AggregatorV3Interface(_priceFeedAddress)});
        supportedCollateralTokenAddresses.push(_tokenAddress);
    }

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

    function setCollateralFactor(uint256 _newFactor) external onlyOwner onlyInitialized {
        require(_newFactor <= 100 && _newFactor > 0, "Invalid collateral factor");
        require(_newFactor < liquidationThreshold, "Must be less than liquidation threshold");
        collateralFactor = _newFactor;
    }

    function setLiquidationThreshold(uint256 _newThreshold) external onlyOwner onlyInitialized {
        require(_newThreshold <= 100 && _newThreshold > collateralFactor, "Invalid liquidation threshold");
        liquidationThreshold = _newThreshold;
    }

    function setOriginationFeeRate(uint256 _newRate) external onlyOwner onlyInitialized {
        require(_newRate <= 1000, "Origination fee too high");
        uint256 oldRate = originationFeeRate;
        originationFeeRate = _newRate;
        emit OriginationFeeRateUpdated(oldRate, _newRate);
    }

    function setLiquidationPenalty(uint256 _newPenalty) external onlyOwner onlyInitialized {
        require(_newPenalty <= 2000, "Liquidation penalty too high");
        liquidationPenalty = _newPenalty;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

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
    /// @dev Seize collateral of a single token up to `remainingValueToSeize`.
    /// @return seizedValueAdded value (price-denominated) that was seized
    /// @return amountSeized token units that were removed/transferred

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

    function isInitialized() external view returns (bool) {
        return initialized;
    }

    function emergencyWithdraw(IERC20 _token, uint256 _amount) external onlyOwner {
        require(_token.transfer(owner(), _amount), "Emergency withdrawal failed");
    }
}
