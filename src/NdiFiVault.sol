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

    error underMaintenance();
    error stakingCapExceeded();
    error onlyOwnerAction();
    error invalidAddress();
    error invalidDepositAmount();
    error invalidWithdrawAmount();
    error invalidAmount();

    event deposited(uint256 amount);
    event withdrawSuccessful();
    event redeemed();
    event minted(uint256 shares);

    modifier notUnderMaintenance() {
        if (maintenanceOngoing == true) revert underMaintenance();
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
}
