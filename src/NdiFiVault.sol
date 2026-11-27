// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title NdiFiVault
/// @notice ERC-4626 vault that holds protocol liquidity and funds Ndi-Fi loans.
/// @dev Deposits are capped by `stakingCap` and can be paused by the owner.
contract NdiFiVault is ERC4626, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Maximum amount of underlying assets that may be deposited in the vault.
    uint256 public stakingCap = 100_000 * 1e18; //100,000 Dai

    /// @notice Whether deposits, withdrawals, mints and redeems are currently paused.
    bool public maintenanceOngoing;

    /// @notice Contract allowed to call `withdrawForLoan`.
    address public authorizedLendingContract;

    /// @dev Thrown when a user action is attempted during maintenance.
    error underMaintenance();

    /// @dev Thrown when a deposit would exceed `stakingCap`.
    error stakingCapExceeded();

    /// @dev Reserved for owner-only actions.
    error onlyOwnerAction();

    /// @dev Thrown when a required address is the zero address.
    error invalidAddress();

    /// @dev Thrown when a deposit amount is zero.
    error invalidDepositAmount();

    /// @dev Reserved for invalid withdrawal amounts.
    error invalidWithdrawAmount();

    /// @dev Thrown when an amount is zero or exceeds the available balance.
    error invalidAmount();

    /// @dev Thrown when the caller is not the authorized lending contract.
    error unauthorizedCaller();

    /// @notice Emitted when assets are deposited into the vault.
    /// @param amount Amount of underlying assets deposited.
    event deposited(uint256 amount);

    /// @notice Emitted when the owner performs an emergency asset withdrawal.
    event withdrawSuccessful();

    /// @notice Emitted when vault shares are redeemed.
    event redeemed();

    /// @notice Emitted when vault shares are minted.
    /// @param shares Number of shares minted.
    event minted(uint256 shares);

    /// @notice Emitted when the lending contract withdraws funds for a loan.
    /// @param borrower Address receiving the loan proceeds.
    /// @param amount Amount of underlying assets withdrawn.
    event LendingTokensWithdrawn(address indexed borrower, uint256 amount);

    /// @notice Emitted when the authorized lending contract is changed.
    /// @param oldContract Previously authorized lending contract.
    /// @param newContract Newly authorized lending contract.
    event LendingContractUpdated(address indexed oldContract, address indexed newContract);

    modifier notUnderMaintenance() {
        if (maintenanceOngoing == true) revert underMaintenance();
        _;
    }

    modifier onlyAuthorizedLending() {
        if (msg.sender != authorizedLendingContract) revert unauthorizedCaller();
        _;
    }

    /// @notice Deploys the vault for a single underlying asset.
    /// @param DaiTokenAddress Address of the underlying ERC-20 asset.
    /// @param initialOwner Address receiving owner privileges.
    constructor(address DaiTokenAddress, address initialOwner)
        ERC4626(IERC20(DaiTokenAddress))
        ERC20("NDITOKEN", "NDI")
        Ownable(initialOwner)
    {
        if (DaiTokenAddress == address(0)) revert invalidAddress();
    }

    // core functions
    /// @notice Deposits underlying assets and mints vault shares to `receiver`.
    /// @dev Reverts during maintenance, for zero amounts, for a zero receiver, or when the cap is exceeded.
    /// @param amount Amount of underlying assets to deposit.
    /// @param receiver Address receiving the vault shares.
    /// @return Number of vault shares minted.
    function deposit(uint256 amount, address receiver) public override notUnderMaintenance returns (uint256) {
        if (amount <= 0) revert invalidDepositAmount();
        if (receiver == address(0)) revert invalidAddress();

        if (super.totalAssets() + amount > stakingCap) {
            revert stakingCapExceeded();
        }

        return super.deposit(amount, receiver);
    }

    /// @notice Burns vault shares owned by `_owner` and sends underlying assets to `receiver`.
    /// @dev Reverts during maintenance or when either address is zero.
    /// @param assets Amount of underlying assets to withdraw.
    /// @param receiver Address receiving the underlying assets.
    /// @param _owner Address whose shares are burned.
    /// @return Number of vault shares burned.
    function withdraw(uint256 assets, address receiver, address _owner)
        public
        override
        notUnderMaintenance
        returns (uint256)
    {
        if (receiver == address(0) || _owner == address(0)) {
            revert invalidAddress();
        }

        return super.withdraw(assets, receiver, _owner);
    }

    /// @notice Mints `shares` to `receiver` and pulls the required underlying assets.
    /// @dev Reverts during maintenance, for zero shares, or for a zero receiver.
    /// @param shares Number of vault shares to mint.
    /// @param receiver Address receiving the vault shares.
    /// @return Amount of underlying assets deposited.
    function mint(uint256 shares, address receiver) public override notUnderMaintenance returns (uint256) {
        if (receiver == address(0)) revert invalidAddress();
        if (shares <= 0) revert invalidDepositAmount();

        emit minted(shares);
        return super.mint(shares, receiver);
    }

    /// @notice Burns `shares` owned by `_owner` and sends the resulting assets to `receiver`.
    /// @dev Reverts during maintenance, for zero shares, or for a zero receiver.
    /// @param shares Number of vault shares to redeem.
    /// @param receiver Address receiving the underlying assets.
    /// @param _owner Address whose shares are burned.
    /// @return Amount of underlying assets returned.
    function redeem(uint256 shares, address receiver, address _owner)
        public
        override
        notUnderMaintenance
        returns (uint256)
    {
        if (receiver == address(0)) revert invalidAddress();
        if (shares <= 0) revert invalidAmount();

        emit redeemed();

        return super.redeem(shares, receiver, _owner);
    }

    //ADMIN FUNCTIONS
    /// @notice Pauses deposits, withdrawals, mints and redeems.
    /// @dev Only callable by the owner.
    function pauseVault() public onlyOwner {
        maintenanceOngoing = true;
    }

    /// @notice Resumes deposits, withdrawals, mints and redeems.
    /// @dev Only callable by the owner.
    function unpauseVault() public onlyOwner {
        maintenanceOngoing = false;
    }

    /// @notice Transfers the entire underlying balance to `_initialOwner` in an emergency.
    /// @dev Only callable by the owner; emits `withdrawSuccessful` when a balance exists.
    /// @param to Recipient used for the zero-address check.
    /// @param _initialOwner Address receiving the recovered assets.
    function emergencyWithdraw(address to, address _initialOwner) public onlyOwner {
        if (to == address(0)) revert invalidAddress();
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        if (balance > 0) {
            IERC20(asset()).safeTransfer(_initialOwner, balance);
            emit withdrawSuccessful();
        }
    }

    /// @notice Forcefully redeems all shares owned by `from` and sends assets to `to`.
    /// @dev Only callable by the owner.
    /// @param from Address whose shares are redeemed.
    /// @param to Address receiving the redeemed assets.
    function emergencyRedeem(address from, address to) public onlyOwner {
        if (to == address(0)) revert invalidAddress();
        uint256 shares = super.balanceOf(from);

        if (shares > 0) {
            uint256 assets = super.previewRedeem(shares);
            _withdraw(msg.sender, from, to, assets, shares);
        }
    }

    /// @notice Sets the maximum amount of underlying assets that can be deposited.
    /// @dev Only callable by the owner; the cap must be greater than zero.
    /// @param newCap New staking cap, in underlying token units.
    function setStakingCap(uint256 newCap) public onlyOwner {
        if (newCap <= 0) revert invalidAmount();
        stakingCap = newCap;
    }

    /// @notice Set authorized lending contract that can withdraw tokens for loans
    /// @dev Only callable by the owner.
    /// @param _lendingContract Address of the authorized lending contract
    function setAuthorizedLendingContract(address _lendingContract) external onlyOwner {
        if (_lendingContract == address(0)) revert invalidAddress();
        address oldContract = authorizedLendingContract;
        authorizedLendingContract = _lendingContract;
        emit LendingContractUpdated(oldContract, _lendingContract);
    }

    /// @notice Withdraw lending tokens for loan distribution (only callable by authorized lending contract)
    /// @param _to Address to receive the tokens (borrower)
    /// @param _amount Amount of tokens to withdraw
    function withdrawForLoan(address _to, uint256 _amount) external onlyAuthorizedLending notUnderMaintenance {
        if (_to == address(0)) revert invalidAddress();
        if (_amount <= 0) revert invalidAmount();

        uint256 availableAssets = IERC20(asset()).balanceOf(address(this));
        if (_amount > availableAssets) revert invalidAmount();

        IERC20(asset()).safeTransfer(_to, _amount);
        emit LendingTokensWithdrawn(_to, _amount);
    }

    /// @notice Get available lending token balance in the vault
    /// @return Available balance for lending
    function getAvailableLiquidity() external view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }
}
