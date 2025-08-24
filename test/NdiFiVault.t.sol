// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {NdiFiVault} from "../src/NdiFiVault.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
//you didn't use the Ownable contract you imported or is there another reason this is here??

// Simple mintable ERC20
contract MockERC20 is ERC20 {
    constructor() ERC20("MockDaiToken", "MDT") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract NdiFiVaultTest is Test {
    NdiFiVault public vault;
    MockERC20 public mockDai;
    address public admin;
    address public user;
    address public attacker;

    function setUp() public {
        admin = address(this);
        user = address(0x1); // use mkaddr instead : mkaddr(user);
        attacker = address(0xdeadbeef);

        mockDai = new MockERC20();
        vault = new NdiFiVault(address(mockDai), admin);
        mockDai.mint(user, 1000 ether);
        mockDai.mint(address(this), 1000 ether);
    }

    // -----------------------------------
    // Zero address on deposit/mint/withdraw/redeem
    // -----------------------------------
    function testRevert_DepositToZeroAddress() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 100 ether);
        vm.expectRevert("invalidAddress()");
        vault.deposit(1 ether, address(0));
    }

    function testRevert_DepositZeroAmount() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 100 ether);
        vm.expectRevert("invalidDepositAmount()");
        vault.deposit(0, user);
    }

    function testRevert_WithdrawToZeroAddress() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 10 ether);
        vault.deposit(10 ether, user);

        vm.expectRevert("invalidAddress()");
        vault.withdraw(1 ether, address(0), user);
    }

    function testRevert_WithdrawFromZeroAddress() public {
        //function name: withdraw from or withdraw to??
        vm.startPrank(user);
        mockDai.approve(address(vault), 10 ether);
        vault.deposit(10 ether, user);

        vm.expectRevert("invalidAddress()");
        vault.withdraw(1 ether, user, address(0)); // we can withdraw from address zero because address 0 can't even deposit...
    }

    function testRevert_MintZeroShares() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 10 ether);
        vm.expectRevert("invalidDepositAmount()");
        vault.mint(0, user);
    }

    function testRevert_MintToZeroAddress() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 10 ether);
        vm.expectRevert("invalidAddress()");
        vault.mint(1 ether, address(0));
    }

    function testRevert_RedeemZeroShares() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 10 ether);
        vault.deposit(10 ether, user);
        vm.expectRevert("invalidAmount()");
        vault.redeem(0, user, user);
    }

    function testRevert_RedeemToZeroAddress() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 10 ether);
        vault.deposit(10 ether, user);
        vm.expectRevert("invalidAddress()");
        vault.redeem(1 ether, address(0), user);
    }

    // ----------------------------------
    // Cap Exceeded
    // ----------------------------------

    function testRevertStakingCapExceeded() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), type(uint256).max);
        vm.expectRevert(NdiFiVault.stakingCapExceeded.selector);
        vault.deposit(100_001 * 1e18, user);
    }

    // ----------------------------------
    // Pausing behaviour: all fails if paused
    // ----------------------------------
    function testPauseVaultBlocksCoreOps() public {
        vm.startPrank(admin);
        vault.pauseVault();
        vm.stopPrank();

        vm.startPrank(user);
        mockDai.approve(address(vault), 10 ether);

        vm.expectRevert("underMaintenance()");
        vault.deposit(10 ether, user);

        // Deposit one so user has shares
        vm.stopPrank();
        vault.unpauseVault();
        vm.startPrank(user);
        vault.deposit(10 ether, user);
        vault.approve(address(vault), 10 ether);

        vm.stopPrank();
        vault.pauseVault();
        vm.startPrank(user);

        vm.expectRevert("underMaintenance()");
        vault.withdraw(1 ether, user, user);

        vm.expectRevert("underMaintenance()");
        vault.mint(1 ether, user);

        vm.expectRevert("underMaintenance()");
        vault.redeem(1 ether, user, user);
    }

    // ----------------------------------
    // OnlyOwner tests
    // ----------------------------------
    function testOnlyOwnerModifiers() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        vault.pauseVault();

        vm.expectRevert();
        vault.unpauseVault();

        mockDai.mint(address(vault), 1 ether);
        vm.expectRevert();
        vault.emergencyWithdraw(attacker, attacker);

        vm.expectRevert();
        vault.setStakingCap(1 ether);
        vm.stopPrank();
    }

    // ----------------------------------
    // Emergency Withdraw/ emergencyRedeem works as intended
    // ----------------------------------
    function testEmergencyWithdrawTransfersAllFunds() public {
        // Deposit to vault as user
        vm.startPrank(user);
        mockDai.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user);
        vm.stopPrank();

        uint256 before = mockDai.balanceOf(admin);

        vault.emergencyWithdraw(admin, admin);

        assertEq(mockDai.balanceOf(address(vault)), 0);
        assertEq(mockDai.balanceOf(admin), before + 100 ether);
    }

    function testEmergencyRedeemTransfersUserShares() public {
        // User deposits and transfers shares to ADMIN
        vm.startPrank(user);
        mockDai.approve(address(vault), 100 * 1e18);
        console.log("mockdai balance:", mockDai.balanceOf(user));
        vault.deposit(100 * 1e18, user);
        console.log("mockDai balance after deposit:", mockDai.balanceOf(user));
        console.log("vault balance of dai", mockDai.balanceOf(address(vault)));
        vault.approve(admin, type(uint256).max);
        vm.stopPrank();

        vm.prank(admin);
        vault.emergencyRedeem(user, user);

        assertEq(mockDai.balanceOf(user), 1000 * 1e18);
        assertEq(vault.balanceOf(user), 0);
    }

    // ----------------------------------
    // setStakingCap edge
    // ----------------------------------
    function testRevert_setStakingCapZero() public {
        vm.expectRevert("invalidAmount()");
        vault.setStakingCap(0);
    }

    function testSetStakingCapLargeValue() public {
        uint256 before = vault.stakingCap();
        console.log("vault staking cap: ", before);
        vm.prank(admin);
        vault.setStakingCap(type(uint256).max);
        assertEq(vault.stakingCap(), type(uint256).max);
        // try depositing
        mockDai.approve(address(vault), type(uint256).max);
        vm.prank(admin);
        vault.deposit(1000 * 1e18, admin);
    }

    // ----------------------------------
    // Invariant: deposit->withdraw roundtrip maintains asset parity
    // ----------------------------------
    function testRoundtripDepositWithdraw() public {
        uint256 amount = 100 ether;
        vm.startPrank(user);
        mockDai.approve(address(vault), amount);
        vault.deposit(amount, user);

        assertEq(vault.maxWithdraw(user), amount);
        vault.withdraw(amount, user, user);
        assertEq(mockDai.balanceOf(user), 1000 ether, "user should get back all DAI");
        vm.stopPrank();
    }

    // ----------------------------------
    // Invariant: mint->redeem roundtrip maintains shares/assets
    // ----------------------------------
    function testRoundtripMintRedeem() public {
        uint256 amount = 123 ether;
        vm.startPrank(user);
        mockDai.approve(address(vault), amount);
        uint256 shares = vault.mint(amount, user);
        vault.redeem(shares, user, user);
        uint256 daiReturned = mockDai.balanceOf(user);
        assertApproxEqAbs(daiReturned, 1000 ether, 1e6, "user should get back nearly all DAI");
        vm.stopPrank();
    }

    // ----------------------------------
    // Can't deposit if underlying not approved
    // ----------------------------------
    function testRevert_DepositWithoutApprove() public {
        vm.startPrank(user);
        vm.expectRevert();
        vault.deposit(10 ether, user);
        vm.stopPrank();
    }

    // ----------------------------------
    // Can't redeposit more than allowance
    // ----------------------------------
    function testRevert_DepositMoreThanAllowance() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 5 ether);
        vm.expectRevert();
        vault.deposit(10 ether, user);
        vm.stopPrank();
    }

    // ----------------------------------
    // Misc: Can't set zero DAI address at construction
    // ----------------------------------
    function testRevert_ZeroAssetOnDeploy() public {
        vm.expectRevert("invalidAddress()");
        new NdiFiVault(address(0), admin);
    }

    // ----------------------------------
    // Additional Edge Cases
    // ----------------------------------

    function testRevert_EmergencyWithdrawToZeroAddress() public {
        vm.expectRevert("invalidAddress()");
        vault.emergencyWithdraw(address(0), admin);
    }

    function testRevert_EmergencyWithdrawByNonOwner() public {
        vm.startPrank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.emergencyWithdraw(attacker, attacker);
    }

    function testEmergencyWithdrawWithZeroBalance() public {
        uint256 before = mockDai.balanceOf(admin);
        vault.emergencyWithdraw(admin, admin);
        assertEq(mockDai.balanceOf(admin), before);
    }

    function testRevert_EmergencyRedeemToZeroAddress() public {
        vm.expectRevert("invalidAddress()");
        vault.emergencyRedeem(user, address(0));
    }

    function testRevert_EmergencyRedeemByNonOwner() public {
        vm.startPrank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.emergencyRedeem(user, attacker);
    }

    function testRevert_SetStakingCapByNonOwner() public {
        vm.startPrank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.setStakingCap(1 ether);
    }

    function testRevert_SetStakingCapBelowTotalAssets() public {
        vm.startPrank(user);
        mockDai.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user);
        vm.stopPrank();

        vm.startPrank(admin);
        vault.setStakingCap(50 ether);
        vm.stopPrank();

        vm.startPrank(user);
        mockDai.approve(address(vault), 1 ether);
        vm.expectRevert("stakingCapExceeded()");
        vault.deposit(1 ether, user);
    }
}
