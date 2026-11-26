// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NdiPoint} from "../src/NdiPoint.sol";
import {NdiPointIntegrationExample} from "../src/NdiPointIntegrationExample.sol";

/**
 * @title NdiPointIntegrationTest
 * @notice Runnable integration tests for NdiPointIntegrationExample.
 *
 * Run with:
 *   forge test --match-path test/NdiPointIntegration.t.sol -v
 *
 * These tests mirror the walkthrough in docs/NdiPointIntegration.md and cover:
 *   - Deployment and role setup
 *   - Staking and time-accrued reward claims
 *   - Activity-based rewards (lending, borrowing)
 *   - Batch weekly reward distribution
 *   - EIP-2612 permit approval
 *   - Common error conditions
 */
contract NdiPointIntegrationTest is Test {
    NdiPoint public ndiPoint;
    NdiPointIntegrationExample public integration;

    address public owner;
    address public alice;
    address public bob;
    uint256 internal aliceKey;

    // Mirrors the constant in NdiPointIntegrationExample
    uint256 constant REWARD_RATE = 100; // 100 NDI points per day per staked unit

    function setUp() public {
        owner = makeAddr("owner");
        (alice, aliceKey) = makeAddrAndKey("alice");
        bob = makeAddr("bob");

        // Deploy NdiPoint with owner
        vm.prank(owner);
        ndiPoint = new NdiPoint(owner);

        // Deploy integration contract (owner field set to deployer inside constructor)
        vm.prank(owner);
        integration = new NdiPointIntegrationExample(address(ndiPoint));

        // Grant REWARD_DISTRIBUTOR_ROLE to the integration contract.
        // Use startPrank so the prank is not consumed by the role getter staticcall.
        vm.startPrank(owner);
        ndiPoint.grantRole(ndiPoint.REWARD_DISTRIBUTOR_ROLE(), address(integration));
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Role and deployment checks
    // -------------------------------------------------------------------------

    function test_RoleGranted() public view {
        assertTrue(
            ndiPoint.hasRole(ndiPoint.REWARD_DISTRIBUTOR_ROLE(), address(integration)),
            "Integration contract must hold REWARD_DISTRIBUTOR_ROLE"
        );
    }

    function test_InitialState() public view {
        assertEq(integration.rewardRate(), REWARD_RATE);
        assertEq(address(integration.ndiPoint()), address(ndiPoint));
        assertEq(integration.owner(), owner);
    }

    // -------------------------------------------------------------------------
    // Staking and time-accrued rewards
    // -------------------------------------------------------------------------

    function test_StakeAndClaimRewards() public {
        uint256 stakeAmount = 100 * 1e18;

        // Alice stakes
        vm.prank(alice);
        integration.stake(stakeAmount);

        assertEq(integration.stakedBalance(alice), stakeAmount);

        // Advance time by 1 day
        vm.warp(block.timestamp + 1 days);

        // Contract formula: (stakedBalance * rewardRate * 1e18 / 1e18) * timeDiff / 1 days
        //   = stakeAmount * rewardRate * timeDiff / 1 days
        //   = 100e18 * 100 * 1 day / 1 day = 100e18 * 100 = 10_000e18 NDI points
        uint256 dailyReward = (stakeAmount * REWARD_RATE * 1e18) / 1e18;
        uint256 expected = (dailyReward * 1 days) / 1 days;

        uint256 pending = integration.calculatePendingRewards(alice);
        assertEq(pending, expected, "Pending rewards should match formula");

        uint256 balanceBefore = ndiPoint.balanceOf(alice);

        vm.prank(alice);
        integration.claimStakingRewards();

        assertEq(ndiPoint.balanceOf(alice) - balanceBefore, expected, "Claimed amount should match pending rewards");
        // After claiming, pending resets to 0 (same block)
        assertEq(integration.calculatePendingRewards(alice), 0);
    }

    function test_UnstakeClearsAccruedRewards() public {
        uint256 stakeAmount = 200 * 1e18;

        vm.prank(alice);
        integration.stake(stakeAmount);

        vm.warp(block.timestamp + 2 days);

        uint256 pending = integration.calculatePendingRewards(alice);
        assertGt(pending, 0, "Should have accrued rewards after 2 days");

        uint256 balanceBefore = ndiPoint.balanceOf(alice);

        // Unstaking triggers _updateRewards internally, paying out pending rewards
        vm.prank(alice);
        integration.unstake(stakeAmount);

        assertGt(ndiPoint.balanceOf(alice) - balanceBefore, 0, "Unstake should pay accrued rewards");
        assertEq(integration.stakedBalance(alice), 0);
    }

    function test_NoPendingRewardsWithNoStake() public view {
        assertEq(integration.calculatePendingRewards(alice), 0);
    }

    // -------------------------------------------------------------------------
    // Activity-based rewards
    // -------------------------------------------------------------------------

    function test_LendingReward() public {
        // The integration contract formula: reward = (amount * 1e18) / 100
        // Use amount = 100 → reward = (100 * 1e18) / 100 = 1e18 (stays within MAX_SUPPLY)
        uint256 lendAmount = 100;
        uint256 expectedReward = (lendAmount * 1e18) / 100; // 1e18

        uint256 balanceBefore = ndiPoint.balanceOf(alice);

        vm.prank(alice);
        integration.lend(lendAmount);

        assertEq(ndiPoint.balanceOf(alice) - balanceBefore, expectedReward, "Lending reward should follow contract formula");
        assertEq(integration.lentAmount(alice), lendAmount);
    }

    function test_BorrowingReward() public {
        // The integration contract formula: reward = (amount * 5e17) / 100
        // Use amount = 200 → reward = (200 * 5e17) / 100 = 1e18 (stays within MAX_SUPPLY)
        uint256 borrowAmount = 200;
        uint256 expectedReward = (borrowAmount * 5e17) / 100; // 1e18

        uint256 balanceBefore = ndiPoint.balanceOf(alice);

        vm.prank(alice);
        integration.borrow(borrowAmount);

        assertEq(ndiPoint.balanceOf(alice) - balanceBefore, expectedReward, "Borrowing reward should follow contract formula");
        assertEq(integration.borrowedAmount(alice), borrowAmount);
    }

    function test_LendingRevertOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert("Amount must be greater than zero");
        integration.lend(0);
    }

    function test_BorrowingRevertOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert("Amount must be greater than zero");
        integration.borrow(0);
    }

    // -------------------------------------------------------------------------
    // Batch reward distribution
    // -------------------------------------------------------------------------

    function test_WeeklyRewardDistribution() public {
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 1e18;
        amounts[1] = 200 * 1e18;

        vm.prank(owner);
        integration.distributeWeeklyRewards(users, amounts);

        assertEq(ndiPoint.balanceOf(alice), amounts[0], "Alice should receive her weekly reward");
        assertEq(ndiPoint.balanceOf(bob), amounts[1], "Bob should receive his weekly reward");
    }

    function test_WeeklyRewardRevertsOnArrayMismatch() public {
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 1e18;

        vm.prank(owner);
        vm.expectRevert("Array length mismatch");
        integration.distributeWeeklyRewards(users, amounts);
    }

    function test_WeeklyRewardRevertsForNonOwner() public {
        address[] memory users = new address[](1);
        users[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 1e18;

        vm.prank(alice);
        vm.expectRevert("Not authorized");
        integration.distributeWeeklyRewards(users, amounts);
    }

    // -------------------------------------------------------------------------
    // EIP-2612 permit
    // -------------------------------------------------------------------------

    function test_PermitAllowsGaslessApproval() public {
        uint256 approveAmount = 500 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;

        // Build the EIP-712 digest manually
        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                alice,
                address(integration),
                approveAmount,
                ndiPoint.nonces(alice),
                deadline
            )
        );

        bytes32 domainSeparator = ndiPoint.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, permitHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, digest);

        // Before permit: no allowance
        assertEq(ndiPoint.allowance(alice, address(integration)), 0);

        // Execute permit
        ndiPoint.permit(alice, address(integration), approveAmount, deadline, v, r, s);

        // After permit: allowance is set without a separate approve tx
        assertEq(ndiPoint.allowance(alice, address(integration)), approveAmount);
    }

    function test_PermitDomainSeparatorIsNonZero() public view {
        bytes32 domainSeparator = ndiPoint.DOMAIN_SEPARATOR();
        assertGt(uint256(domainSeparator), 0, "Domain separator should be non-zero");
    }

    // -------------------------------------------------------------------------
    // User activity summary
    // -------------------------------------------------------------------------

    function test_UserActivitySummary() public {
        uint256 stakeAmt = 50 * 1e18;
        // Use small amounts so the lending/borrowing reward formula stays within MAX_SUPPLY
        uint256 lendAmt = 100;
        uint256 borrowAmt = 200;

        vm.startPrank(alice);
        integration.stake(stakeAmt);
        integration.lend(lendAmt);
        integration.borrow(borrowAmt);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        (uint256 staked, uint256 lent, uint256 borrowed, uint256 pending, uint256 ndiBalance) =
            integration.getUserActivitySummary(alice);

        assertEq(staked, stakeAmt);
        assertEq(lent, lendAmt);
        assertEq(borrowed, borrowAmt);
        assertGt(pending, 0, "Should have pending staking rewards after 1 day");
        // ndiBalance includes lending + borrowing rewards already minted
        assertGt(ndiBalance, 0);
    }

    // -------------------------------------------------------------------------
    // Error conditions
    // -------------------------------------------------------------------------

    function test_ClaimRevertsWithNoStake() public {
        vm.prank(alice);
        vm.expectRevert("No rewards to claim");
        integration.claimStakingRewards();
    }

    function test_UnstakeRevertsInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert("Insufficient staked balance");
        integration.unstake(1 * 1e18);
    }

    function test_RewardDistributionRevertsWithoutRole() public {
        // Revoke the role using startPrank to avoid prank being consumed by role getter
        vm.startPrank(owner);
        ndiPoint.revokeRole(ndiPoint.REWARD_DISTRIBUTOR_ROLE(), address(integration));
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(); // AccessControl revert
        integration.lend(100);
    }
}
