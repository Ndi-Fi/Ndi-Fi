//SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract NDIFIVault is ERC4626, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    IERC20 public immutable DAI;
    uint256 public stakingCap = 100_000 * 1e18; //100,000 Dai
    bool public isPaused;
    address public initialOwner;

    error stakingPaused();
    error stakingCapExceeded();
    error onlyOwnerAction();
    error InvalidAddress();
    error invalidDepositAmount();
    error invalidWithdrawAmount();
    error invalidAmount();

    event deposited(uint256 amount);
    event withdrawSuccessful();
    event redeemed();
    event minted(uint256 shares);

    modifier onlyWhenNotPaused() {
        if (isPaused == true) revert stakingPaused();
        _;
    }

    modifier withinStakingCap(uint256 amount) {
        if (super.totalAssets() + amount > stakingCap) {
            revert stakingCapExceeded();
        }
        _;
    }

    constructor(address DaiTokenAddress, string memory name, string memory symbol)
        ERC4626(IERC20(DaiTokenAddress))
        ERC20(name, symbol)
        Ownable(initialOwner)
    {
        name = "BTOKEN";
        symbol = "BTK";

        if (DaiTokenAddress == address(0)) revert InvalidAddress();

        DAI = IERC20(DaiTokenAddress);
    }

    // core functions
    function deposit(uint256 amount, address receiver)
        public
        override
        onlyWhenNotPaused
        withinStakingCap(amount)
        returns (uint256)
    {
        if (amount <= 0) revert invalidDepositAmount();
        if (receiver == address(0)) revert InvalidAddress();
        if (amount > DAI.balanceOf(msg.sender)) revert invalidDepositAmount();
        if (amount > DAI.allowance(msg.sender, address(this))) {
            revert invalidDepositAmount();
        }

        emit deposited(amount);
        return super.deposit(amount, receiver);
    }

    function withdraw(uint256 amount, address receiver, address _owner)
        public
        override
        onlyWhenNotPaused
        returns (uint256)
    {
        if (receiver == address(0) || _owner == address(0)) {
            revert InvalidAddress();
        }
        if (amount > super.balanceOf(_owner)) revert invalidWithdrawAmount();

        emit withdrawSuccessful();

        return super.withdraw(amount, receiver, _owner);
    }

    function mint(uint256 shares, address receiver) public override onlyWhenNotPaused returns (uint256) {
        if (receiver == address(0)) revert InvalidAddress();
        if (shares <= 0) revert invalidDepositAmount();
        if (shares > DAI.balanceOf(msg.sender)) revert invalidDepositAmount();
        if (shares > DAI.allowance(msg.sender, address(this))) {
            revert invalidDepositAmount();
        }

        emit minted(shares);
        return super.mint(shares, receiver);
    }

    function redeem(uint256 shares, address receiver, address _owner)
        public
        override
        onlyWhenNotPaused
        returns (uint256)
    {
        if (receiver == address(0)) revert InvalidAddress();
        if (shares <= 0) revert invalidAmount();

        emit redeemed();

        return super.redeem(shares, receiver, _owner);
    }

    //VIEW FUNCTIONS
    function totalAssets() public view override returns (uint256) {
        return super.totalAssets();
    }

    function previewWithdraw(uint256 DaiAsset) public view override returns (uint256) {
        return super.previewWithdraw(DaiAsset);
    }

    function previewDeposit(uint256 DaiAsset) public view override returns (uint256) {
        return super.previewDeposit(DaiAsset);
    }

    function previewMint(uint256 shares) public view override returns (uint256) {
        return super.previewMint(shares);
    }

    function previewRedeem(uint256 shares) public view override returns (uint256) {
        return super.previewRedeem(shares);
    }

    //ADMIN FUNCTIONS
    function pauseVault() public onlyOwner {
        isPaused = true;
    }

    function unpauseVault() public onlyOwner {
        isPaused = false;
    }

    function emergencyWithdraw() public onlyOwner {
        uint256 balance = DAI.balanceOf(address(this));
        if (balance > 0) {
            DAI.safeTransfer(initialOwner, balance);
            emit withdrawSuccessful();
        }
    }

    function emergencyRedeem() public onlyOwner {
        uint256 shares = super.balanceOf(address(this));
        if (shares > 0) {
            super.redeem(shares, initialOwner, address(this));
            emit redeemed();
        }
    }

    function setStakingCap(uint256 newCap) public onlyOwner {
        if (newCap <= 0) revert invalidAmount();
        stakingCap = newCap;
    }
}
