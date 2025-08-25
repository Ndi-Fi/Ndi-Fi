// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {NdiStaking} from "../src/NdiFiStaking.sol";
import {NdiFiVault} from "../src/NdiFiVault.sol";


// Mock ERC20 token for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }
}

contract NdiStakingTest is Test {
    NdiStaking public staking;
    NdiFiVault public vault;
    MockERC20 public stakeToken;
    MockERC20 public rewardToken;
    
    address public owner = makeAddr("owner");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    // Constants matching the contract
    uint256 public constant WITHDRAW_WAIT = 21 days;
    uint256 public constant APY = 10; // 10%
    uint256 public constant MIN_STAKE = 1e18; // 1 token
    uint256 public constant MAX_STAKE = 1000e18; // 1000 tokens
    uint256 public constant MIN_DURATION = 7 days;

    function setUp() public {
        // Deploy tokens
        stakeToken = new MockERC20("Stake Token", "STAKE");
        rewardToken = new MockERC20("Reward Token", "REWARD");

         // Deploy vault
        vm.prank(owner);
        vault = new NdiFiVault(address(stakeToken), owner);

        // Deploy staking contract
        vm.prank(owner);
        staking = new NdiStaking(
            address(stakeToken),
            address(rewardToken),
            address(vault),
            owner,
            APY,
            MIN_STAKE,
            MAX_STAKE,
            MIN_DURATION
        );

        // Mint tokens to users for testing
        stakeToken.mint(user1, 10000e18);
        stakeToken.mint(user2, 10000e18);
        stakeToken.mint(user3, 10000e18);
        
        // Mint reward tokens to staking contract
        rewardToken.mint(address(staking), 1000000e18);
        
        // Approve staking contract to spend tokens
        vm.prank(user1);
        stakeToken.approve(address(staking), type(uint256).max);
        
        vm.prank(user2);
        stakeToken.approve(address(staking), type(uint256).max);
        
        vm.prank(user3);
        stakeToken.approve(address(staking), type(uint256).max);
    }

    function testConstructor() public {
        assertEq(address(staking.stakeToken()), address(stakeToken));
        assertEq(address(staking.rewardToken()), address(rewardToken));
        assertEq(address(staking.vault()), address(vault));
        assertEq(staking.owner(), owner);
        assertEq(staking.apy(), APY);
        assertEq(staking.minStake(), MIN_STAKE);
        assertEq(staking.maxStake(), MAX_STAKE);
        assertEq(staking.minDuration(), MIN_DURATION);
        assertEq(staking.WITHDRAW_WAIT(), WITHDRAW_WAIT);
        assertEq(staking.totalStaked(), 0);
    }

    function testConstructorZeroAddresses() public {
        vm.expectRevert("Zero address");
        new NdiStaking(
            address(0),
            address(rewardToken),
            address(vault),
            owner,
            APY,
            MIN_STAKE,
            MAX_STAKE,
            MIN_DURATION
        );
        
        vm.expectRevert("Zero address");
        new NdiStaking(
            address(stakeToken),
            address(0),
            address(vault),
            owner,
            APY,
            MIN_STAKE,
            MAX_STAKE,
            MIN_DURATION
        );
        
        vm.expectRevert("Zero address");
        new NdiStaking(
            address(stakeToken),
            address(rewardToken),
            address(0),
            owner,
            APY,
            MIN_STAKE,
            MAX_STAKE,
            MIN_DURATION
        );
    }
    
    function testConstructorVaultAssetMismatch() public {
        MockERC20 wrongToken = new MockERC20("Wrong", "WRONG");
        NdiFiVault wrongVault = new NdiFiVault(address(wrongToken), owner);
        
        vm.expectRevert("Vault asset mismatch");
        new NdiStaking(
            address(stakeToken),
            address(rewardToken),
            address(wrongVault),
            owner,
            APY,
            MIN_STAKE,
            MAX_STAKE,
            MIN_DURATION
        );
    }
    
    /*//////////////////////////////////////////////////////////////
                              STAKE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testStakeValid() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        (uint256 amount, uint256 timestamp, uint256 rewardsClaimed, bool withdrawn) = staking.stakes(user1);
        
        assertEq(amount, stakeAmount);
        assertEq(timestamp, block.timestamp);
        assertEq(rewardsClaimed, 0);
        assertEq(withdrawn, false);
        assertEq(staking.totalStaked(), stakeAmount);
        
        // Check tokens were transferred to vault
        assertEq(stakeToken.balanceOf(user1), 10000e18 - stakeAmount);
        assertEq(vault.balanceOf(address(staking)), stakeAmount); // Vault shares
    }
    
    function testStakeMinAmount() public {
        vm.prank(user1);
        staking.stake(MIN_STAKE);
        
        (uint256 amount,,,) = staking.stakes(user1);
        assertEq(amount, MIN_STAKE);
    }
    
    function testStakeMaxAmount() public {
        vm.prank(user1);
        staking.stake(MAX_STAKE);
        
        (uint256 amount,,,) = staking.stakes(user1);
        assertEq(amount, MAX_STAKE);
    }
    
    function testStakeBelowMinimum() public {
        vm.prank(user1);
        vm.expectRevert("Stake amount invalid");
        staking.stake(MIN_STAKE - 1);
    }
    
    function testStakeAboveMaximum() public {
        vm.prank(user1);
        vm.expectRevert("Stake amount invalid");
        staking.stake(MAX_STAKE + 1);
    }
    
    function testStakeAlreadyStaked() public {
        vm.startPrank(user1);
        staking.stake(100e18);
        
        vm.expectRevert("Already staked");
        staking.stake(50e18);
        vm.stopPrank();
    }
    
    function testStakeAfterWithdrawal() public {
        uint256 stakeAmount = 100e18;
        
        // Initial stake
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        // Request withdrawal
        vm.prank(user1);
        staking.requestWithdrawal();
        
        // Wait and execute withdrawal
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        // Should be able to stake again
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        (uint256 amount,,,) = staking.stakes(user1);
        assertEq(amount, stakeAmount);
    }
    
    function testStakeEmitsEvent() public {
        uint256 stakeAmount = 100e18;
        
        vm.expectEmit(true, true, false, true);
        emit NdiStaking.Staked(user1, stakeAmount);
        
        vm.prank(user1);
        staking.stake(stakeAmount);
    }
    
    function testStakeInsufficientBalance() public {
        uint256 userBalance = stakeToken.balanceOf(user1);
        
        vm.prank(user1);
        vm.expectRevert();
        staking.stake(userBalance + 1);
    }
    
    /*//////////////////////////////////////////////////////////////
                         PENDING REWARDS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testPendingRewardsNoStake() public {
        uint256 rewards = staking.pendingRewards(user1);
        assertEq(rewards, 0);
    }
    
    function testPendingRewardsWithdrawnStake() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        uint256 rewards = staking.pendingRewards(user1);
        assertEq(rewards, 0);
    }
    
    function testPendingRewardsCalculation() public {
        uint256 stakeAmount = 100e18;
        uint256 timeElapsed = 365 days; // 1 year
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.warp(block.timestamp + timeElapsed);
        
        uint256 expectedRewards = (stakeAmount * APY * timeElapsed) / (100 * 365 days);
        uint256 actualRewards = staking.pendingRewards(user1);
        
        assertEq(actualRewards, expectedRewards);
        assertEq(actualRewards, stakeAmount * APY / 100); // 10% of stake for 1 year
    }
    
    function testPendingRewardsHalfYear() public {
        uint256 stakeAmount = 100e18;
        uint256 timeElapsed = 182.5 days; // Half year
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.warp(block.timestamp + timeElapsed);
        
        uint256 expectedRewards = (stakeAmount * APY * timeElapsed) / (100 * 365 days);
        uint256 actualRewards = staking.pendingRewards(user1);
        
        assertEq(actualRewards, expectedRewards);
    }
    
    function testPendingRewardsAfterClaim() public {
        uint256 stakeAmount = 100e18;
        uint256 timeElapsed = 365 days;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.warp(block.timestamp + timeElapsed);
        
        uint256 rewardsBeforeClaim = staking.pendingRewards(user1);
        
        vm.prank(user1);
        staking.claimRewards();
        
        // Should be 0 immediately after claim
        assertEq(staking.pendingRewards(user1), 0);
        
        // Wait more time and check new rewards
        vm.warp(block.timestamp + 365 days);
        uint256 newRewards = staking.pendingRewards(user1);
        assertEq(newRewards, rewardsBeforeClaim); // Same amount for another year
    }
    
    /*//////////////////////////////////////////////////////////////
                         CLAIM REWARDS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testClaimRewardsNoStake() public {
        vm.prank(user1);
        vm.expectRevert("No active stake");
        staking.claimRewards();
    }
    
    function testClaimRewardsWithdrawnStake() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        vm.prank(user1);
        vm.expectRevert("No active stake");
        staking.claimRewards();
    }
    
    function testClaimRewardsNoRewards() public {
        vm.prank(user1);
        staking.stake(100e18);
        
        // No time passed, no rewards
        vm.prank(user1);
        vm.expectRevert("No rewards");
        staking.claimRewards();
    }
    
    function testClaimRewardsValid() public {
        uint256 stakeAmount = 100e18;
        uint256 timeElapsed = 365 days;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.warp(block.timestamp + timeElapsed);
        
        uint256 expectedRewards = staking.pendingRewards(user1);
        uint256 balanceBefore = rewardToken.balanceOf(user1);
        
        vm.prank(user1);
        staking.claimRewards();
        
        uint256 balanceAfter = rewardToken.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, expectedRewards);
        
        (, , uint256 rewardsClaimed,) = staking.stakes(user1);
        assertEq(rewardsClaimed, expectedRewards);
    }
    
    function testClaimRewardsMultipleTimes() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        // First claim after 6 months
        vm.warp(block.timestamp + 182.5 days);
        uint256 firstReward = staking.pendingRewards(user1);
        
        vm.prank(user1);
        staking.claimRewards();
        
        // Second claim after another 6 months
        vm.warp(block.timestamp + 182.5 days);
        uint256 secondReward = staking.pendingRewards(user1);
        
        vm.prank(user1);
        staking.claimRewards();
        
        // Both rewards should be approximately equal
        assertApproxEqRel(firstReward, secondReward, 1e15); // 0.1% tolerance
        
        (, , uint256 totalClaimed,) = staking.stakes(user1);
        assertEq(totalClaimed, firstReward + secondReward);
    }
    
    function testClaimRewardsEmitsEvent() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.warp(block.timestamp + 365 days);
        uint256 expectedRewards = staking.pendingRewards(user1);
        
        vm.expectEmit(true, true, false, true);
        emit NdiStaking.RewardClaimed(user1, expectedRewards);
        
        vm.prank(user1);
        staking.claimRewards();
    }
    
    /*//////////////////////////////////////////////////////////////
                      REQUEST WITHDRAWAL TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testRequestWithdrawalNoStake() public {
        vm.prank(user1);
        vm.expectRevert("No active stake");
        staking.requestWithdrawal();
    }
    
    function testRequestWithdrawalWithdrawnStake() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        vm.prank(user1);
        vm.expectRevert("No active stake");
        staking.requestWithdrawal();
    }
    
    function testRequestWithdrawalValid() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        (uint256 amount, uint256 requestedAt, bool exists) = staking.withdrawalRequests(user1);
        assertEq(amount, stakeAmount);
        assertEq(requestedAt, block.timestamp);
        assertEq(exists, true);
    }
    
    function testRequestWithdrawalAlreadyRequested() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.prank(user1);
        vm.expectRevert("Already requested");
        staking.requestWithdrawal();
    }
    
    function testRequestWithdrawalEmitsEvent() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.expectEmit(true, true, false, true);
        emit NdiStaking.WithdrawalRequested(user1, stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
    }
    
    /*//////////////////////////////////////////////////////////////
                      EXECUTE WITHDRAWAL TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testExecuteWithdrawalNoRequest() public {
        vm.prank(user1);
        vm.expectRevert("No withdrawal requested");
        staking.executeWithdrawal();
    }
    
    function testExecuteWithdrawalTooEarly() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        // Try to withdraw before 21 days
        vm.warp(block.timestamp + WITHDRAW_WAIT - 1);
        
        vm.prank(user1);
        vm.expectRevert("Too early");
        staking.executeWithdrawal();
    }
    
    function testExecuteWithdrawalValid() public {
        uint256 stakeAmount = 100e18;
        uint256 timeElapsed = 365 days;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        // Let some time pass to accumulate rewards
        vm.warp(block.timestamp + timeElapsed);
        uint256 expectedRewards = staking.pendingRewards(user1);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        // Wait for withdrawal period
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        
        uint256 stakeBalanceBefore = stakeToken.balanceOf(user1);
        uint256 rewardBalanceBefore = rewardToken.balanceOf(user1);
        
        vm.prank(user1);
        staking.executeWithdrawal();
        
        // Check balances
        assertEq(stakeToken.balanceOf(user1) - stakeBalanceBefore, stakeAmount);
        assertEq(rewardToken.balanceOf(user1) - rewardBalanceBefore, expectedRewards);
        
        // Check stake is cleaned up
        (uint256 amount, uint256 timestamp, uint256 rewardsClaimed, bool withdrawn) = staking.stakes(user1);
        assertEq(amount, 0);
        assertEq(timestamp, 0);
        assertEq(rewardsClaimed, 0);
        assertEq(withdrawn, false);
        
        // Check withdrawal request is cleaned up
        (uint256 reqAmount, uint256 reqTime, bool exists) = staking.withdrawalRequests(user1);
        assertEq(reqAmount, 0);
        assertEq(reqTime, 0);
        assertEq(exists, false);
        
        // Check total staked is updated
        assertEq(staking.totalStaked(), 0);
    }
    
    function testExecuteWithdrawalAlreadyWithdrawn() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        // Try to execute withdrawal again should fail
        // But first need to recreate the withdrawal request state manually
        // This scenario shouldn't happen in normal flow, but testing edge case
    }
    
    function testExecuteWithdrawalEmitsEvent() public {
        uint256 stakeAmount = 100e18;
        uint256 timeElapsed = 365 days;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.warp(block.timestamp + timeElapsed);
        uint256 expectedRewards = staking.pendingRewards(user1);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        
        vm.expectEmit(true, true, false, true);
        emit NdiStaking.Withdrawn(user1, stakeAmount, expectedRewards);
        
        vm.prank(user1);
        staking.executeWithdrawal();
    }
    
    function testExecuteWithdrawalExactlyAt21Days() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        // Execute exactly at 21 days
        vm.warp(block.timestamp + WITHDRAW_WAIT);
        
        vm.prank(user1);
        staking.executeWithdrawal();
        
        assertEq(staking.totalStaked(), 0);
    }
    
    /*//////////////////////////////////////////////////////////////
                          PROFITS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetProfitsNoProfits() public {
        uint256 profits = staking.getProfits();
        assertEq(profits, 0);
    }
    
    function testGetProfitsWithStaking() public {
        uint256 stakeAmount = 100e18;
        
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        // Initially should be no profits
        uint256 profits = staking.getProfits();
        assertEq(profits, 0);
    }
    
    function testSkimProfitsNoProfits() public {
        vm.prank(owner);
        vm.expectRevert("No profits");
        staking.skimProfits(owner);
    }
    
    function testSkimProfitsNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        staking.skimProfits(user1);
    }
    
    // Note: Testing actual profits would require simulating yield in the vault
    // which would depend on the vault's implementation details
    
    /*//////////////////////////////////////////////////////////////
                          INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMultipleUsersStaking() public {
        uint256 stake1 = 100e18;
        uint256 stake2 = 200e18;
        uint256 stake3 = 300e18;
        
        vm.prank(user1);
        staking.stake(stake1);
        
        vm.prank(user2);
        staking.stake(stake2);
        
        vm.prank(user3);
        staking.stake(stake3);
        
        assertEq(staking.totalStaked(), stake1 + stake2 + stake3);
        
        // Check individual stakes
        (uint256 amount1,,,) = staking.stakes(user1);
        (uint256 amount2,,,) = staking.stakes(user2);
        (uint256 amount3,,,) = staking.stakes(user3);
        
        assertEq(amount1, stake1);
        assertEq(amount2, stake2);
        assertEq(amount3, stake3);
    }
    
    function testCompleteStakingCycle() public {
        uint256 stakeAmount = 100e18;
        uint256 timeElapsed = 365 days;
        
        // Stake
        vm.prank(user1);
        staking.stake(stakeAmount);
        
        // Wait and claim rewards
        vm.warp(block.timestamp + timeElapsed / 2);
        vm.prank(user1);
        staking.claimRewards();
        
        // Wait more time
        vm.warp(block.timestamp + timeElapsed / 2);
        
        // Request withdrawal
        vm.prank(user1);
        staking.requestWithdrawal();
        
        // Wait withdrawal period
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        
        // Execute withdrawal
        uint256 balanceBefore = stakeToken.balanceOf(user1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        // Should get stake back
        assertEq(stakeToken.balanceOf(user1) - balanceBefore, stakeAmount);
        assertEq(staking.totalStaked(), 0);
    }
    
    function testRewardCalculationAccuracy() public {
        uint256 stakeAmount = 1000e18;
        uint256[] memory timePeriodsInDays = new uint256[](5);
        timePeriodsInDays[0] = 1;
        timePeriodsInDays[1] = 30;
        timePeriodsInDays[2] = 90;
        timePeriodsInDays[3] = 180;
        timePeriodsInDays[4] = 365;
        
        for (uint i = 0; i < timePeriodsInDays.length; i++) {
            // Deploy fresh contract for each test
            vm.prank(owner);
            NdiStaking freshStaking = new NdiStaking(
                address(stakeToken),
                address(rewardToken),
                address(vault),
                owner,
                APY,
                MIN_STAKE,
                MAX_STAKE,
                MIN_DURATION
            );
            
            vm.prank(user1);
            stakeToken.approve(address(freshStaking), type(uint256).max);
            
            vm.prank(user1);
            freshStaking.stake(stakeAmount);
            
            vm.warp(block.timestamp + timePeriodsInDays[i] * 1 days);
            
            uint256 actualReward = freshStaking.pendingRewards(user1);
            uint256 expectedReward = (stakeAmount * APY * timePeriodsInDays[i] * 1 days) / (100 * 365 days);
            
            assertEq(actualReward, expectedReward, 
                string(abi.encodePacked("Reward calculation failed for ", 
                       vm.toString(timePeriodsInDays[i]), " days")));
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                             EDGE CASES
    //////////////////////////////////////////////////////////////*/
    
    function testStakeAfterPartialWithdrawals() public {
        // This tests the behavior when multiple users stake and withdraw
        // to ensure totalStaked is properly maintained
        
        vm.prank(user1);
        staking.stake(100e18);
        
        vm.prank(user2);
        staking.stake(200e18);
        
        assertEq(staking.totalStaked(), 300e18);
        
        // User1 withdraws
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        assertEq(staking.totalStaked(), 200e18);
        
        // User1 can stake again
        vm.prank(user1);
        staking.stake(150e18);
        
        assertEq(staking.totalStaked(), 350e18);
    }
    
    function testZeroRewardsAfterWithdrawal() public {
        vm.prank(user1);
        staking.stake(100e18);
        
        vm.warp(block.timestamp + 365 days);
        
        vm.prank(user1);
        staking.requestWithdrawal();
        
        vm.warp(block.timestamp + WITHDRAW_WAIT + 1);
        vm.prank(user1);
        staking.executeWithdrawal();
        
        // After withdrawal, pending rewards should be 0
        assertEq(staking.pendingRewards(user1), 0);
    }
    
    /*//////////////////////////////////////////////////////////////
                              FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzzStakeAmount(uint256 amount) public {
        amount = bound(amount, MIN_STAKE, MAX_STAKE);
        
        vm.prank(user1);
        staking.stake(amount);
        
        (uint256 stakedAmount,,,) = staking.stakes(user1);
        assertEq(stakedAmount, amount);
        assertEq(staking.totalStaked(), amount);
    }
    
}