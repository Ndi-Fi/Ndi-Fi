// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NdiStaking} from "../src/NdiFiStaking.sol";
import {NdiFiVault} from "../src/NdiFiVault.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";


contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract NdiFiStakingTest is Test {
    NdiStaking public stake;
    MockERC20 public stakeToken;
    MockERC20 public rewardToken;
    NdiFiVault public vault;

    address public owner = makeAddr("owner");
    address public staker1 = makeAddr("staker1");
    address public staker2 = makeAddr("staker2");
    address public attacker = makeAddr("attacker");

    uint256 constant APY = 15;
    uint256 constant MIN_STAKE = 10 * 1e18;
    uint256 constant MAX_STAKE = 1000 * 1e18;
    uint256 constant MIN_DURATION = 20 days;
    uint256 constant WITHDRAW_WAIT = 21 days;

    function setUp() public {
        
        stakeToken = new MockERC20("Stake Token", "ST");
        rewardToken = new MockERC20("Reward Token", "RT");

       
        vm.prank(owner);
        vault = new NdiFiVault(address(stakeToken), owner);

        // Deploy staking contract
        stake = new NdiStaking(
            address(stakeToken),
            address(rewardToken),
            address(vault),
            owner,
            APY,
            MIN_STAKE,
            MAX_STAKE,
            MIN_DURATION
        );

        // Setup initial balances
        stakeToken.mint(staker1, 2000 * 1e18);
        stakeToken.mint(staker2, 2000 * 1e18);
        rewardToken.mint(address(stake), 1_000_000 * 1e18);

        // Approve staking contract
        vm.prank(staker1);
        stakeToken.approve(address(stake), type(uint256).max);
        vm.prank(staker2);
        stakeToken.approve(address(stake), type(uint256).max);
    }



    function testStake_SuccessfulStake() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        assertEq(stake.totalStaked(), 100 * 1e18);
        assertEq(stakeToken.balanceOf(address(vault)), 100 * 1e18);
        (uint256 amount, uint256 timestamp, uint256 rewardsClaimed, bool withdrawn) = stake.stakes(staker1);
        assertEq(amount, 100 * 1e18);
        assertEq(rewardsClaimed, 0);
        assertFalse(withdrawn);
    }

    function testStake_BelowMinimumAmount() public {
        vm.prank(staker1);
        vm.expectRevert("Stake amount invalid");
        stake.stake(5 * 1e18);
    }

    function testStake_AboveMaximumAmount() public {
        vm.prank(staker1);
        vm.expectRevert("Stake amount invalid");
        stake.stake(2000 * 1e18);
    }

    function testStake_AlreadyStaked() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker1);
        vm.expectRevert("Already staked");
        stake.stake(50 * 1e18);
    }

    function testStake_AfterWithdrawal() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        // Request and execute withdrawal
        vm.prank(staker1);
        stake.requestWithdrawal();

        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);

        vm.prank(staker1);
        stake.executeWithdrawal();

       
        vm.prank(staker1);
        stake.stake(50 * 1e18);

        assertEq(stake.totalStaked(), 50 * 1e18);
    }


    function testPendingRewards_CalculatesCorrectly() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

       
        vm.warp(block.timestamp + 365 days);

        uint256 expectedRewards = (100 * 1e18 * APY * 365 days) / (100 * 365 days);
        uint256 actualRewards = stake.pendingRewards(staker1);

        assertEq(actualRewards, expectedRewards);
    }

    function testPendingRewards_NoRewardsForInactiveStake() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

      
        vm.prank(staker1);
        stake.requestWithdrawal();
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(staker1);
        stake.executeWithdrawal();

        assertEq(stake.pendingRewards(staker1), 0);
    }

    function testPendingRewards_AfterPartialClaim() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        // Fast forward 182.5 days
        vm.warp(block.timestamp + 182 days + 12 hours);

        uint256 firstClaim = stake.pendingRewards(staker1);
        vm.prank(staker1);
        stake.claimRewards();

        // Fast forward another 182.5 days
        vm.warp(block.timestamp + 182 days + 12 hours);

        uint256 secondClaim = stake.pendingRewards(staker1);
        assertEq(firstClaim, secondClaim); // Should be same amount
    }

   

    function testClaimRewards_SuccessfulClaim() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.warp(block.timestamp + 365 days);

        uint256 rewardBalanceBefore = rewardToken.balanceOf(staker1);
        vm.prank(staker1);
        stake.claimRewards();

        uint256 rewardBalanceAfter = rewardToken.balanceOf(staker1);
        assertGt(rewardBalanceAfter, rewardBalanceBefore);

        (,, uint256 rewardsClaimed,) = stake.stakes(staker1);
        assertGt(rewardsClaimed, 0);
    }

    function testClaimRewards_NoRewardsAvailable() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker1);
        vm.expectRevert("No rewards");
        stake.claimRewards();
    }

    function testClaimRewards_NoActiveStake() public {
        vm.prank(staker1);
        vm.expectRevert("No active stake");
        stake.claimRewards();
    }

   
    function testRequestWithdrawal_SuccessfulRequest() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker1);
        stake.requestWithdrawal();

        (uint256 amount, uint256 requestedAt, bool exists) = stake.withdrawalRequests(staker1);
        assertEq(amount, 100 * 1e18);
        assertEq(requestedAt, block.timestamp);
        assertTrue(exists);
    }

    function testRequestWithdrawal_NoActiveStake() public {
        vm.prank(staker1);
        vm.expectRevert("No active stake");
        stake.requestWithdrawal();
    }

    function testRequestWithdrawal_AlreadyRequested() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker1);
        stake.requestWithdrawal();

        vm.prank(staker1);
        vm.expectRevert("Already requested");
        stake.requestWithdrawal();
    }

    

    function testExecuteWithdrawal_SuccessfulWithdrawal() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker1);
        stake.requestWithdrawal();

        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);

        uint256 balanceBefore = stakeToken.balanceOf(staker1);
        uint256 vaultSharesBefore = vault.balanceOf(address(stake));

        vm.prank(staker1);
        stake.executeWithdrawal();

        uint256 balanceAfter = stakeToken.balanceOf(staker1);
        uint256 vaultSharesAfter = vault.balanceOf(address(stake));

        (uint256 amount,,, bool withdrawn) = stake.stakes(staker1);

        // Debug output
        console.log("Balance before:", balanceBefore);
        console.log("Balance after:", balanceAfter);
        console.log("Vault shares before:", vaultSharesBefore);
        console.log("Vault shares after:", vaultSharesAfter);
        console.log("Total staked:", stake.totalStaked());
        console.log("User stake amount:", amount);
        console.log("Withdrawn flag:", withdrawn);

        // Check that user received tokens back (allowing for ERC4626 precision)
        assertGt(balanceAfter, balanceBefore);
        assertLt(balanceAfter - balanceBefore, 100 * 1e18 + 1000); // Should not exceed original + small buffer
        assertEq(stake.totalStaked(), 0);
        assertEq(amount, 0);
        assertTrue(withdrawn);
        assertEq(vaultSharesAfter, 0); // All shares should be redeemed
    }

    function testExecuteWithdrawal_TooEarly() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker1);
        stake.requestWithdrawal();

        vm.warp(block.timestamp + WITHDRAW_WAIT - 1 hours);

        vm.prank(staker1);
        vm.expectRevert("Too early");
        stake.executeWithdrawal();
    }

    function testExecuteWithdrawal_NoRequest() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker1);
        vm.expectRevert("No withdrawal requested");
        stake.executeWithdrawal();
    }

    function testExecuteWithdrawal_IncludesRewards() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.warp(block.timestamp + 365 days);

        vm.prank(staker1);
        stake.requestWithdrawal();

        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);

        uint256 rewardBalanceBefore = rewardToken.balanceOf(staker1);
        vm.prank(staker1);
        stake.executeWithdrawal();

        uint256 rewardBalanceAfter = rewardToken.balanceOf(staker1);
        assertGt(rewardBalanceAfter, rewardBalanceBefore);
    }

   

    function testGetProfits_WithGains() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        // Simulate vault gains by minting more tokens to vault
        stakeToken.mint(address(vault), 10 * 1e18);

        uint256 profits = stake.getProfits();
        assertApproxEqAbs(profits, 10 * 1e18, 1); // Allow 1 wei tolerance for precision
    }

    function testGetProfits_NoProfits() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        uint256 profits = stake.getProfits();
        assertEq(profits, 0);
    }

    function testGetProfits_WithLosses() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        // Simulate vault losses by burning tokens from vault
        vm.prank(address(vault));
        stakeToken.transfer(attacker, 10 * 1e18);

        uint256 profits = stake.getProfits();
        assertEq(profits, 0); // Losses don't create negative profits
    }

    

    function testSkimProfits_SuccessfulSkim() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        // Add profits to vault
        stakeToken.mint(address(vault), 10 * 1e18);

        uint256 ownerBalanceBefore = stakeToken.balanceOf(owner);
        vm.prank(owner);
        stake.skimProfits(owner);

        uint256 ownerBalanceAfter = stakeToken.balanceOf(owner);
        assertApproxEqAbs(ownerBalanceAfter - ownerBalanceBefore, 10 * 1e18, 1); // Allow 1 wei tolerance
    }

    function testSkimProfits_NoProfits() public {
        vm.prank(owner);
        vm.expectRevert("No profits");
        stake.skimProfits(owner);
    }

    function testSkimProfits_OnlyOwner() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);
        stakeToken.mint(address(vault), 10 * 1e18);

        vm.prank(attacker);
        vm.expectRevert();
        stake.skimProfits(attacker);
    }

   

    function testFullStakeClaimWithdrawCycle() public {
        // Stake
        vm.prank(staker1);
        stake.stake(100 * 1e18);
        assertEq(stake.totalStaked(), 100 * 1e18);

        // Wait and claim rewards
        vm.warp(block.timestamp + 365 days);
        uint256 pending = stake.pendingRewards(staker1);
        assertGt(pending, 0);

        vm.prank(staker1);
        stake.claimRewards();

        // Request withdrawal
        vm.prank(staker1);
        stake.requestWithdrawal();

        // Wait 21 days
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);

        // Execute withdrawal
        uint256 balanceBefore = stakeToken.balanceOf(staker1);
        vm.prank(staker1);
        stake.executeWithdrawal();

        uint256 balanceAfter = stakeToken.balanceOf(staker1);
        // Check that user received tokens back (allowing for ERC4626 precision)
        assertGt(balanceAfter, balanceBefore);
        assertLt(balanceAfter - balanceBefore, 100 * 1e18 + 1000); // Should not exceed original + small buffer
        assertEq(stake.totalStaked(), 0);
    }

    function testMultipleStakers() public {
        // Both stakers stake
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        vm.prank(staker2);
        stake.stake(200 * 1e18);

        assertEq(stake.totalStaked(), 300 * 1e18);

        // Fast forward time
        vm.warp(block.timestamp + 365 days);

        // Both claim rewards
        vm.prank(staker1);
        stake.claimRewards();

        vm.prank(staker2);
        stake.claimRewards();

        // Check rewards are proportional
        uint256 rewards1 = rewardToken.balanceOf(staker1);
        uint256 rewards2 = rewardToken.balanceOf(staker2);

        // staker2 should have roughly 2x rewards of staker1
        assertApproxEqRel(rewards2, rewards1 * 2, 0.01e18); 
    }

    

    function testReentrancyProtection() public {

        vm.prank(staker1);
        stake.stake(100 * 1e18);

    }

    function testZeroAddressProtection() public {
       
        vm.prank(staker1);
        vm.expectRevert("Stake amount invalid");
        stake.stake(0);
    }

    function testTimeManipulation() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

        // Test that rewards calculation handles time correctly
        vm.warp(block.timestamp + 1 days);
        uint256 rewards1 = stake.pendingRewards(staker1);

        vm.warp(block.timestamp + 1 days);
        uint256 rewards2 = stake.pendingRewards(staker1);

        assertGt(rewards2, rewards1);
    }


    function testVaultMaintenanceMode() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

    
        vm.prank(owner);
        vault.pauseVault();


        vm.prank(staker1);
        stake.requestWithdrawal();

       
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(staker1);
        vm.expectRevert(); 
        stake.executeWithdrawal();
    }

    function testVaultStakingCap() public {
        // Set low staking cap on vault
        vm.prank(owner);
        vault.setStakingCap(50 * 1e18);


        vm.prank(staker1);
        vm.expectRevert();
        stake.stake(100 * 1e18);
    }

    function testVaultDepositWithdraw() public {
        vm.prank(staker1);
        stake.stake(100 * 1e18);

    
        assertEq(vault.balanceOf(address(stake)), 100 * 1e18);

   
        vm.prank(staker1);
        stake.requestWithdrawal();
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(staker1);
        stake.executeWithdrawal();

      
        assertEq(vault.balanceOf(address(stake)), 0);
    }
}
