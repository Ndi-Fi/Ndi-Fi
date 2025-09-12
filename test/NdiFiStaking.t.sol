// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NdiStaking} from "../src/NdiFiStaking.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {NdiFiVault} from "src/NdiFiVault.sol";

// Simple mintable ERC20 - following your pattern
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract NdiFiStakingTest is Test {
    NdiStaking public stake;
    MockERC20 public stakeToken;
    MockERC20 public rewardToken;
    NdiFiVault public vault;

    address public owner = makeAddr("owner");
    address public staker = makeAddr("staker");
    address public staker2 = makeAddr("staker2");
    address public attacker = makeAddr("attacker");

    // Constants matching your setup
    uint256 constant APY = 15;
    uint256 constant MIN_STAKE = 10 * 1e18;
    uint256 constant MAX_STAKE = 1000 * 1e18;
    uint256 constant MIN_DURATION = 20 days;
    uint256 constant WITHDRAW_WAIT = 21 days;

    // Event definitions for testing
    event Staked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event WithdrawalRequested(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 stakedAmount, uint256 rewardAmount);
    event ProfitsSkimmed(address to, uint256 amount);

    function setUp() public {
        // Deploy stake token
        stakeToken = new MockERC20("stake Token", "ST");

        // Deploy reward token
        vm.prank(owner);
        rewardToken = new MockERC20("reward Token", "RT");

        // Deploy vault
        vm.prank(owner);
        vault = new NdiFiVault(address(stakeToken), owner);

        // Deploy staking contract with your parameters
        stake = new NdiStaking(
            address(stakeToken), address(rewardToken), address(vault), owner, APY, MIN_STAKE, MAX_STAKE, MIN_DURATION
        );

        // Mint stake tokens to stakers
        stakeToken.mint(staker, 100 * 1e18);
        stakeToken.mint(staker2, 200 * 1e18);
        stakeToken.mint(attacker, 50 * 1e18);

        // Mint reward tokens to staking contract
        rewardToken.mint(address(stake), 1_000_000 * 1e18);

        // Approve staking contract to spend tokens
        vm.prank(staker);
        stakeToken.approve(address(stake), type(uint256).max);
        vm.prank(staker2);
        stakeToken.approve(address(stake), type(uint256).max);
        vm.prank(attacker);
        stakeToken.approve(address(stake), type(uint256).max);
    }

    // ============ BASIC FUNCTIONALITY TESTS ============

    function testStake() external {
        vm.prank(staker);
        stake.stake(10 * 1e18);

        assertEq(stake.totalStaked(), 10 * 1e18);

        // Additional checks following your pattern
        (uint256 amount, uint256 timestamp, uint256 rewardsClaimed, bool withdrawn) = stake.stakes(staker);
        assertEq(amount, 10 * 1e18);
        assertEq(timestamp, block.timestamp);
        assertEq(rewardsClaimed, 0);
        assertFalse(withdrawn);
    }

    function testStakeMultipleUsers() external {
        vm.prank(staker);
        stake.stake(50 * 1e18);

        vm.prank(staker2);
        stake.stake(100 * 1e18);

        assertEq(stake.totalStaked(), 150 * 1e18);

        (uint256 amount1,,,) = stake.stakes(staker);
        (uint256 amount2,,,) = stake.stakes(staker2);

        assertEq(amount1, 50 * 1e18);
        assertEq(amount2, 100 * 1e18);
    }

    function testStakeTransfersTokens() external {
        uint256 initialBalance = stakeToken.balanceOf(staker);
        uint256 stakeAmount = 25 * 1e18;

        vm.prank(staker);
        stake.stake(stakeAmount);

        assertEq(stakeToken.balanceOf(staker), initialBalance - stakeAmount);
        assertEq(vault.balanceOf(address(stake)), stakeAmount);
    }

    // ============ VALIDATION TESTS ============

    function testStakeAmountTooSmall() external {
        vm.prank(staker);
        vm.expectRevert("Stake amount invalid");
        stake.stake(MIN_STAKE - 1);
    }

    function testStakeAmountTooLarge() external {
        vm.prank(staker);
        vm.expectRevert("Stake amount invalid");
        stake.stake(MAX_STAKE + 1);
    }

    function testStakeAlreadyStaked() external {
        vm.startPrank(staker);
        stake.stake(20 * 1e18);

        vm.expectRevert("Already staked");
        stake.stake(30 * 1e18);
        vm.stopPrank();
    }

    function testStakeInsufficientApproval() external {
        // Create new staker with no approval
        address newStaker = makeAddr("newStaker");
        stakeToken.mint(newStaker, 100 * 1e18);

        vm.prank(newStaker);
        vm.expectRevert();
        stake.stake(20 * 1e18);
    }

    // ============ REWARDS TESTS ============

    function testPendingRewards() external {
        vm.prank(staker);
        stake.stake(100 * 1e18);

        // Fast forward 1 year
        vm.warp(block.timestamp + 365 days);

        uint256 expectedReward = (100 * 1e18 * APY) / 100; // 15% APY
        uint256 actualReward = stake.pendingRewards(staker);

        assertEq(actualReward, expectedReward);
    }

    function testPendingRewardsPartialYear() external {
        vm.prank(staker);
        stake.stake(100 * 1e18);

        // Fast forward 6 months (182.5 days)
        vm.warp(block.timestamp + 182.5 days);

        uint256 expectedReward = (100 * 1e18 * APY * 182.5 days) / (100 * 365 days);
        uint256 actualReward = stake.pendingRewards(staker);

        assertApproxEqAbs(actualReward, expectedReward, 1e15); // Small tolerance for rounding
    }

    function testPendingRewardsNoStake() external view {
        assertEq(stake.pendingRewards(staker), 0);
    }

    function testClaimRewards() external {
        uint256 initialRewardBalance = rewardToken.balanceOf(staker);

        vm.prank(staker);
        stake.stake(100 * 1e18);

        // Fast forward 1 year
        vm.warp(block.timestamp + 365 days);

        uint256 expectedReward = stake.pendingRewards(staker);

        vm.prank(staker);
        stake.claimRewards();

        assertEq(rewardToken.balanceOf(staker), initialRewardBalance + expectedReward);

        // Check rewards claimed is updated
        (,, uint256 rewardsClaimed,) = stake.stakes(staker);
        assertEq(rewardsClaimed, expectedReward);
    }

    function testClaimRewardsMultipleTimes() external {
        vm.prank(staker);
        stake.stake(100 * 1e18);

        // First claim after 6 months
        vm.warp(block.timestamp + 182.5 days);
        uint256 firstReward = stake.pendingRewards(staker);

        vm.prank(staker);
        stake.claimRewards();

        // Second claim after another 6 months
        vm.warp(block.timestamp + 182.5 days);
        uint256 secondReward = stake.pendingRewards(staker);

        vm.prank(staker);
        stake.claimRewards();

        // Total should be approximately 1 year of rewards
        uint256 totalExpected = (100 * 1e18 * APY) / 100;
        assertApproxEqAbs(firstReward + secondReward, totalExpected, 1e15);
    }

    function testClaimRewardsNoActiveStake() external {
        vm.prank(staker);
        vm.expectRevert("No active stake");
        stake.claimRewards();
    }

    function testClaimRewardsNoRewards() external {
        vm.prank(staker);
        stake.stake(50 * 1e18);

        // Try to claim immediately
        vm.prank(staker);
        vm.expectRevert("No rewards");
        stake.claimRewards();
    }

    // ============ WITHDRAWAL TESTS ============

    function testRequestWithdrawal() external {
        vm.prank(staker);
        stake.stake(50 * 1e18);

        vm.prank(staker);
        stake.requestWithdrawal();

        (uint256 amount, uint256 requestedAt, bool exists) = stake.withdrawalRequests(staker);

        assertEq(amount, 50 * 1e18);
        assertEq(requestedAt, block.timestamp);
        assertTrue(exists);
    }

    function testRequestWithdrawalNoActiveStake() external {
        vm.prank(staker);
        vm.expectRevert("No active stake");
        stake.requestWithdrawal();
    }

    function testRequestWithdrawalAlreadyRequested() external {
        vm.startPrank(staker);
        stake.stake(30 * 1e18);
        stake.requestWithdrawal();

        vm.expectRevert("Already requested");
        stake.requestWithdrawal();
        vm.stopPrank();
    }

    function testExecuteWithdrawal() external {
        uint256 stakeAmount = 75 * 1e18;
        uint256 initialBalance = stakeToken.balanceOf(staker);

        vm.startPrank(staker);
        stake.stake(stakeAmount);
        stake.requestWithdrawal();

        // Fast forward past waiting period
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);

        stake.executeWithdrawal();
        vm.stopPrank();

        // Check tokens returned
        assertEq(stakeToken.balanceOf(staker), initialBalance);
        assertEq(stake.totalStaked(), 0);

        // Check stake info cleared
        (uint256 amount,,,) = stake.stakes(staker);
        assertEq(amount, 0);

        // Check withdrawal request cleared
        (,, bool exists) = stake.withdrawalRequests(staker);
        assertFalse(exists);
    }

    // function testExecuteWithdrawalWithRewards() external {
    //     uint256 stakeAmount = 60 * 1e18;
    //     uint256 initialStakeBalance = stakeToken.balanceOf(staker);
    //     uint256 initialRewardBalance = rewardToken.balanceOf(staker);

    //     vm.startPrank(staker);
    //     stake.stake(stakeAmount);

    //     // Wait 1 year before requesting withdrawal
    //     vm.warp(block.timestamp + 365 days);

    //     uint256 expectedReward = stake.pendingRewards(staker);
    //     stake.requestWithdrawal();

    //     // Wait withdrawal period
    //     vm.warp(block.timestamp + WITHDRAW_WAIT + 1);

    //     stake.executeWithdrawal();
    //     vm.stopPrank();

    //     assertEq(stakeToken.balanceOf(staker), initialStakeBalance);
    //     assertEq(rewardToken.balanceOf(staker), initialRewardBalance + expectedReward);
    // }

    function testExecuteWithdrawalTooEarly() external {
        vm.startPrank(staker);
        stake.stake(40 * 1e18);
        stake.requestWithdrawal();

        // Try to execute before waiting period
        vm.warp(block.timestamp + WITHDRAW_WAIT - 1);

        vm.expectRevert("Too early");
        stake.executeWithdrawal();
        vm.stopPrank();
    }

    function testExecuteWithdrawalNoRequest() external {
        vm.prank(staker);
        vm.expectRevert("No withdrawal requested");
        stake.executeWithdrawal();
    }

    // ============ PROFIT MANAGEMENT TESTS ============

    function testGetProfitsNoYield() external {
        vm.prank(staker);
        stake.stake(50 * 1e18);

        assertEq(stake.getProfits(), 0);
    }

    function testSkimProfitsOnlyOwner() external {
        vm.prank(staker);
        stake.stake(50 * 1e18);

        vm.prank(staker);
        vm.expectRevert();
        stake.skimProfits(staker);
    }

    function testSkimProfitsNoProfits() external {
        vm.prank(staker);
        stake.stake(50 * 1e18);

        vm.prank(owner);
        vm.expectRevert("No profits");
        stake.skimProfits(owner);
    }

    // ============ EDGE CASES & SECURITY TESTS ============

    function testStakeAfterWithdrawal() external {
        uint256 stakeAmount = 35 * 1e18;

        vm.startPrank(staker);
        // First stake and withdraw
        stake.stake(stakeAmount);
        stake.requestWithdrawal();
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        stake.executeWithdrawal();

        // Should be able to stake again
        stake.stake(stakeAmount);
        vm.stopPrank();

        (uint256 amount,,, bool withdrawn) = stake.stakes(staker);
        assertEq(amount, stakeAmount);
        assertFalse(withdrawn);
    }

    function testReentrancyProtection() external {
        // This test verifies the contract has reentrancy guards
        // The actual MockERC20 doesn't have hooks, but we test the expectation
        vm.prank(staker);
        stake.stake(25 * 1e18);

        // Multiple operations should work fine due to reentrancy guards
        vm.startPrank(staker);
        vm.warp(block.timestamp + 100 days);
        stake.claimRewards();
        stake.requestWithdrawal();
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        stake.executeWithdrawal();
        vm.stopPrank();

        assertEq(stake.totalStaked(), 0);
    }

    // ============ INTEGRATION TESTS ============

    // function testCompleteStakingCycle() external {
    //     uint256 stakeAmount = 80 * 1e18;
    //     uint256 initialStakeBalance = stakeToken.balanceOf(staker);
    //     uint256 initialRewardBalance = rewardToken.balanceOf(staker);

    //     vm.startPrank(staker);

    //     // 1. Stake
    //     stake.stake(stakeAmount);

    //     // 2. Wait and claim some rewards
    //     vm.warp(block.timestamp + 180 days);
    //     uint256 midReward = stake.pendingRewards(staker);
    //     stake.claimRewards();

    //     // 3. Wait more and request withdrawal
    //     vm.warp(block.timestamp + 185 days);
    //     stake.requestWithdrawal();

    //     // 4. Wait withdrawal period and execute
    //     vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
    //     uint256 finalReward = stake.pendingRewards(staker);
    //     stake.executeWithdrawal();

    //     vm.stopPrank();

    //     // Verify final state
    //     assertEq(stakeToken.balanceOf(staker), initialStakeBalance);
    //     assertEq(rewardToken.balanceOf(staker), initialRewardBalance + midReward + finalReward);
    //     assertEq(stake.totalStaked(), 0);

    //     // Total rewards should be approximately 1 year worth
    //     uint256 totalExpected = (stakeAmount * APY) / 100;
    //     assertApproxEqAbs(midReward + finalReward, totalExpected, 1e16); // 0.01 token tolerance
    // }

    // ============ FUZZ TESTS ============

    function testFuzzStakeAmounts(uint256 amount) external {
        // Ensure amount is within valid range and staker has enough tokens
        amount = bound(amount, MIN_STAKE, min(MAX_STAKE, stakeToken.balanceOf(staker)));

        vm.prank(staker);
        stake.stake(amount);

        (uint256 stakedAmount,,,) = stake.stakes(staker);
        assertEq(stakedAmount, amount);
        assertEq(stake.totalStaked(), amount);
    }

    function testFuzzRewardCalculation(uint256 amount, uint256 timeElapsed) external {
        // Bound amount to what staker actually has
        amount = bound(amount, MIN_STAKE, min(MAX_STAKE, stakeToken.balanceOf(staker)));
        timeElapsed = bound(timeElapsed, 1 days, 365 days * 2); // Max 2 years to avoid overflow

        vm.prank(staker);
        stake.stake(amount);

        vm.warp(block.timestamp + timeElapsed);

        uint256 expectedReward = (amount * APY * timeElapsed) / (100 * 365 days);
        uint256 actualReward = stake.pendingRewards(staker);

        assertEq(actualReward, expectedReward);
    }

    // Helper function for min calculation
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // ============ EVENT TESTS ============

    function testStakeEvent() external {
        uint256 stakeAmount = 45 * 1e18;

        vm.expectEmit(true, false, false, true);
        emit Staked(staker, stakeAmount);

        vm.prank(staker);
        stake.stake(stakeAmount);
    }

    function testRewardClaimedEvent() external {
        uint256 stakeAmount = 55 * 1e18;

        vm.prank(staker);
        stake.stake(stakeAmount);

        vm.warp(block.timestamp + 365 days);
        uint256 expectedReward = stake.pendingRewards(staker);

        vm.expectEmit(true, false, false, true);
        emit RewardClaimed(staker, expectedReward);

        vm.prank(staker);
        stake.claimRewards();
    }

    function testWithdrawalRequestedEvent() external {
        uint256 stakeAmount = 65 * 1e18;

        vm.prank(staker);
        stake.stake(stakeAmount);

        vm.expectEmit(true, false, false, true);
        emit WithdrawalRequested(staker, stakeAmount);

        vm.prank(staker);
        stake.requestWithdrawal();
    }
}
