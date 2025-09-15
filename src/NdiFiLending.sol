// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import {NdiFiVault} from "./NdiFiVault.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract NdiFiLending is Ownable, ReentrancyGuard, Pausable {
    struct Loan {
        uint256 principal; // Original borrowed amount
        uint256 originationFee; // One-time origination fee
        uint256 collateralAmount; // Actual collateral locked for this loan
        uint256 startTime; // Loan start timestamp
        bool isActive; // Loan status
    }

    IERC20 public immutable collateralToken;
    IERC20 public immutable lendingToken;
    NdiFiVault public immutable vault;

    uint256 public collateralFactor; // Percentage (e.g., 75 = 75%)
    uint256 public liquidationThreshold; // Threshold for liquidation (e.g., 85%)
    uint256 public originationFeeRate; // One-time origination fee rate in basis points (charged at loan origination)
    uint256 public liquidationPenalty; // Liquidation penalty in basis points

    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    uint256 public constant BASIS_POINTS = 10000;

    mapping(address => uint256) public collateralBalances;
    mapping(address => Loan) public loans;
    // mapping(address => bool) public liquidators;

    uint256 public totalCollateral;
    uint256 public totalBorrowed;

    // Initialization tracking
    bool private initialized;

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event LoanTaken(address indexed user, uint256 principal, uint256 collateralLocked);
    event LoanRepaid(address indexed user, uint256 amount, uint256 originationFee);
    event LoanLiquidated(address indexed borrower, address indexed liquidator, uint256 collateralSeized, uint256 debtRepaid);
    event OriginationFeeRateUpdated(uint256 oldRate, uint256 newRate);
    event LiquidatorStatusChanged(address indexed liquidator, bool status);
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

    constructor(IERC20 _collateralToken, IERC20 _lendingToken, NdiFiVault _vault) Ownable(msg.sender) {
        require(address(_collateralToken) != address(0), "Invalid collateral token");
        require(address(_lendingToken) != address(0), "Invalid lending token");
        require(address(_vault) != address(0), "Invalid vault address");
        require(_collateralToken != _lendingToken, "Tokens must be different");

        collateralToken = _collateralToken;
        lendingToken = _lendingToken;
        vault = _vault;
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

    // function setLiquidatorStatus(address _liquidator, bool _status) external onlyOwner onlyInitialized {
    //     liquidators[_liquidator] = _status;
    //     emit LiquidatorStatusChanged(_liquidator, _status);
    // }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function depositCollateral(uint256 _amount) external whenNotPaused nonReentrant onlyInitialized {
        require(_amount > 0, "Amount must be greater than zero");

        require(collateralToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        collateralBalances[msg.sender] += _amount;
        totalCollateral += _amount;

        emit CollateralDeposited(msg.sender, _amount);
    }

    function withdrawCollateral(uint256 _amount) external whenNotPaused nonReentrant onlyInitialized {
        require(_amount > 0, "Amount must be greater than zero");
        require(collateralBalances[msg.sender] >= _amount, "Insufficient collateral");


        uint256 lockedCollateral = _getLockedCollateral(msg.sender);
        uint256 availableCollateral = collateralBalances[msg.sender] - lockedCollateral;
        require(_amount <= availableCollateral, "Cannot withdraw collateral locked for loan");

        collateralBalances[msg.sender] -= _amount;
        totalCollateral -= _amount;

        require(collateralToken.transfer(msg.sender, _amount), "Transfer failed");

        emit CollateralWithdrawn(msg.sender, _amount);
    }

    function takeLoan(uint256 _amount) external whenNotPaused nonReentrant onlyInitialized {
        require(collateralBalances[msg.sender] > 0, "No collateral deposited");
        require(_amount > 0, "Amount must be greater than zero");
        require(!loans[msg.sender].isActive, "Existing loan must be repaid first");
        
        // Calculate one-time origination fee
        uint256 originationFee = (_amount * originationFeeRate) / BASIS_POINTS;
        uint256 netLoanAmount = _amount - originationFee;
        
        // Check vault has sufficient liquidity
        require(vault.getAvailableLiquidity() >= netLoanAmount, "Insufficient vault liquidity");
        
        uint256 maxLoanAmount = (collateralBalances[msg.sender] * collateralFactor) / 100;
        require(_amount <= maxLoanAmount, "Loan exceeds collateral limit");
        
        uint256 requiredCollateral = (_amount * 100) / collateralFactor;
        
        loans[msg.sender] = Loan({
            principal: _amount,
            originationFee: originationFee,
            collateralAmount: requiredCollateral,
            startTime: block.timestamp,
            isActive: true
        });
        
        totalBorrowed += _amount;
        
        // Get lending tokens from vault and send net amount to borrower
        vault.withdrawForLoan(msg.sender, netLoanAmount);
        
        emit LoanTaken(msg.sender, _amount, requiredCollateral);
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
        uint256 collateralValue = loan.collateralAmount;
        uint256 penalty = (collateralValue * liquidationPenalty) / BASIS_POINTS;
        uint256 collateralToSeize = collateralValue + penalty;

        if (collateralToSeize > collateralBalances[_borrower]) {
            collateralToSeize = collateralBalances[_borrower];
        }

        require(lendingToken.transferFrom(msg.sender, address(this), totalDebt), "Debt repayment failed");

        collateralBalances[_borrower] -= collateralToSeize;
        totalCollateral -= collateralToSeize;
        totalBorrowed -= loan.principal;

        loan.isActive = false;
        loan.principal = 0;
        loan.originationFee = 0;

        require(collateralToken.transfer(msg.sender, collateralToSeize), "Collateral transfer failed");

        emit LoanLiquidated(_borrower, msg.sender, collateralToSeize, totalDebt);
    }

    function _getLockedCollateral(address _user) internal view returns (uint256) {
        Loan memory userLoan = loans[_user];
        if (!userLoan.isActive) return 0;
        return userLoan.collateralAmount;
    }

    function calculateHealthFactor(address _borrower) public view returns (uint256) {
        if (!initialized) return type(uint256).max;

        Loan memory loan = loans[_borrower];
        if (!loan.isActive) return type(uint256).max;

        uint256 totalDebt = loan.principal + loan.originationFee;
        if (totalDebt == 0) return type(uint256).max;

        uint256 collateralValue = loan.collateralAmount;
        uint256 liquidationValue = (collateralValue * liquidationThreshold) / 100;

        return (liquidationValue * 100) / totalDebt;
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



