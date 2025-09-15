// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract NdiFiVault is ERC4626, Ownable {
    using SafeERC20 for IERC20;

    uint256 public stakingCap = 100_000 * 1e18; //100,000 Dai
    bool public maintenanceOngoing;
    address public authorizedLendingContract;

    error underMaintenance();
    error stakingCapExceeded();
    error onlyOwnerAction();
    error invalidAddress();
    error invalidDepositAmount();
    error invalidWithdrawAmount();
    error invalidAmount();
    error unauthorizedCaller();

    event deposited(uint256 amount);
    event withdrawSuccessful();
    event redeemed();
    event minted(uint256 shares);
    event LendingTokensWithdrawn(address indexed borrower, uint256 amount);
    event LendingContractUpdated(address indexed oldContract, address indexed newContract);

    modifier notUnderMaintenance() {
        if (maintenanceOngoing == true) revert underMaintenance();
        _;
    }

    modifier onlyAuthorizedLending() {
        if (msg.sender != authorizedLendingContract) revert unauthorizedCaller();
        _;
    }

    constructor(address DaiTokenAddress, address initialOwner)
        ERC4626(IERC20(DaiTokenAddress))
        ERC20("NDITOKEN", "NDI")
        Ownable(initialOwner)
    {
        if (DaiTokenAddress == address(0)) revert invalidAddress();
    }

    // core functions
    function deposit(uint256 amount, address receiver) public override notUnderMaintenance returns (uint256) {
        if (amount <= 0) revert invalidDepositAmount();
        if (receiver == address(0)) revert invalidAddress();

        if (super.totalAssets() + amount > stakingCap) {
            revert stakingCapExceeded();
        }

        return super.deposit(amount, receiver);
    }

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

    function mint(uint256 shares, address receiver) public override notUnderMaintenance returns (uint256) {
        if (receiver == address(0)) revert invalidAddress();
        if (shares <= 0) revert invalidDepositAmount();

        emit minted(shares);
        return super.mint(shares, receiver);
    }

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
    function pauseVault() public onlyOwner {
        maintenanceOngoing = true;
    }

    function unpauseVault() public onlyOwner {
        maintenanceOngoing = false;
    }

    function emergencyWithdraw(address to, address _initialOwner) public onlyOwner {
        if (to == address(0)) revert invalidAddress();
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        if (balance > 0) {
            IERC20(asset()).safeTransfer(_initialOwner, balance);
            emit withdrawSuccessful();
        }
    }

    //Redeeming users shares  forcefully
    function emergencyRedeem(address from, address to) public onlyOwner {
        if (to == address(0)) revert invalidAddress();
        uint256 shares = super.balanceOf(from);

        if (shares > 0) {
            uint256 assets = super.previewRedeem(shares);
            _withdraw(msg.sender, from, to, assets, shares);
        }
    }

    function setStakingCap(uint256 newCap) public onlyOwner {
        if (newCap <= 0) revert invalidAmount();
        stakingCap = newCap;
    }

    /// @notice Set authorized lending contract that can withdraw tokens for loans
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
