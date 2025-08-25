// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.19;

// import {Test, console} from "forge-std/Test.sol";
// import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
// // import {TokenStaking} from "../src/Staking.sol";

// //STEP 1: We will create a Mock ERC20 token for testing. It will simulate a real ERC20 Token
// contract MockToken is ERC20 {
//     constructor(string memory name, string memory symbol) ERC20(name, symbol) {
//         _mint(msg.sender, 1000000 * 10 ** 18); //create 1million tokens
//     }

//     function mint(address to, uint256 amount) external {
//         _mint(to, amount); //Allow minting more token for tests
//     }
// }
// //STEP 2: Our test contract

// contract TokenStakingTest is Test {
//     TokenStaking public stakingContract;
//     MockToken public stakeToken;
//     MockToken public rewardToken;

//     address public owner = makeAddr("owner");
//     address public alice = makeAddr("alice");
//     address public bob = makeAddr("bob");

//     // Contract settings
//     uint256 public constant APY = 10; // 10% per year
//     uint256 public constant MIN_STAKE = 100 * 10 ** 18; // 100 tokens minimum
//     uint256 public constant MAX_STAKE = 10000 * 10 ** 18; // 10, 000 tokens maximum
//     uint256 public constant MIN_DURATION = 7 days; // 1 week lock period

//     function setUp() public {
//         console.log("=== Setting up test environment ===");

//         // 1. Create tokens
//         vm.prank(owner); //Next transaction will be from 'owner'
//         stakeToken = new MockToken("Stake Token", "STK");

//         vm.prank(owner);
//         rewardToken = new MockToken("Reward Token", "RWD");

//         // 2. Deploy staking contract
//         vm.prank(owner);
//         stakingContract = new TokenStaking(
//             address(stakeToken),
//             address(rewardToken),
//             owner, // contract owner
//             APY, // 10% APY
//             MIN_STAKE, // 100 token minimum
//             MAX_STAKE, // 10,000 token maximum
//             MIN_DURATION // 7 days lock
//         );

//         // 3. Give Alice and Bob some tokens to play with
//         vm.prank(owner);
//         stakeToken.mint(alice, 5000 * 10 ** 18); // Give Alice 5,000 tokens

//         vm.prank(owner);
//         stakeToken.mint(bob, 5000 * 10 ** 18); // Give Bob 5,000 tokens

//         // 4. Give staking contract some reward tokens
//         vm.prank(owner);
//         rewardToken.transfer(address(stakingContract), 100000 * 10 ** 18);

//         // 5. Allow staking contract to spend ALice's and Bob's tokens
//         vm.prank(alice);
//         stakeToken.approve(address(stakingContract), type(uint256).max);

//         vm.prank(bob);
//         stakeToken.approve(address(stakingContract), type(uint256).max);

//         console.log("Setup complete!");
//     }

//     // STEP 4: OUr first test
//     function testAliceCanStake1000TOkens() public {
//         console.log("=== Testing: Alice stakes 1000 tokens ===");

//         // Check Alice's balance before
//         uint256 aliceBalanceBefore = stakeToken.balanceOf(alice);

//         // Alice stakes 1000 tokens
//         uint256 stakeAmount = 1000 * 10 ** 18;
//         vm.prank(alice); // Next transaction is from Alice
//         stakingContract.stake(stakeAmount);

//         // Check what happened
//         (uint256 stakedAmount, uint256 timestamp, bool withdrawn) = stakingContract.stakes(alice);

//         console.log("Alice staked:", stakedAmount / 10 ** 18, "tokens");
//         console.log("Stake timestamp:", timestamp);
//         console.log("Already withdrawn?", withdrawn);

//         // Verify it worked correctly
//         assertEq(stakedAmount, stakeAmount, "Staked amount should match");
//         assertEq(timestamp, block.timestamp, "Timestamp should be current time");
//         assertFalse(withdrawn, "should not be marked as withdrawn");
//     }

//     // STEP 5: Test error case
//     function testAliceCannotStakeTooLittle() public {
//         console.log("=== Testing: Alice tries to stake too little ===");

//         uint256 tooLittle = 50 * 10 ** 18; // only 50 tokens (minimum is 100)

//         vm.prank(alice);
//         // We expect this to fail with BelowMinimumStake error
//         vm.expectRevert(TokenStaking.BelowMinimumStake.selector);
//         stakingContract.stake(tooLittle);
//     }

//     // STEP 6: Test reward calculation
//     function testRewardCalculationAfterOneWeek() public {
//         console.log("=== Testing: Reward calculation after 1 week ===");

//         // Alice stakes 1000 tokens
//         uint256 stakeAmount = 1000 * 10 ** 18;
//         vm.prank(alice);
//         stakingContract.stake(stakeAmount);

//         // Fast forward time by 1 week
//         vm.warp(block.timestamp + 7 days);

//         // Calculate expected reward
//         // Formula: (amount * apy * time) ÷ (100 × 365 days)
//         uint256 expectedReward = (stakeAmount * APY * 7 days) / (100 * 365 days);

//         // Get actual reward from contract
//         uint256 actualReward = stakingContract.calculateReward(alice);

//         console.log("Expected reward:", expectedReward / 10 ** 18, "tokens");
//         console.log("Actual reward:", actualReward / 10 ** 18, "tokens");

//         assertEq(actualReward, expectedReward, "Reward calculation should be correct");
//     }

//     // STEP 7: Test complete withdrawal process
//     function test_AliceCanWithdrawAfterLockPeriod() public {
//         console.log("=== Testing: Complete stake and withdraw process ===");

//         // Alice stakes
//         uint256 stakeAmount = 1000 * 10 ** 18;
//         vm.prank(alice);
//         stakingContract.stake(stakeAmount);

//         // Wait for lock period + extra time
//         vm.warp(block.timestamp + MIN_DURATION + 3 days); // 7 days + 3 days = 10 days total

//         // Check reward before withdrawal
//         uint256 expectedReward = stakingContract.calculateReward(alice);
//         uint256 aliceRewardBalanceBefore = rewardToken.balanceOf(alice);

//         // Alice withdraws
//         vm.prank(alice);
//         stakingContract.withdraw();

//         // 5. Check results
//         (,, bool withdrawn) = stakingContract.stakes(alice);
//         uint256 aliceRewardBalanceAfter = rewardToken.balanceOf(alice);

//         assertTrue(withdrawn, "Should be marked as withdrawn");
//         assertEq(
//             aliceRewardBalanceAfter, aliceRewardBalanceBefore + expectedReward, "Alice should receive correct reward"
//         );

//         console.log("Alice received", (aliceRewardBalanceAfter - aliceRewardBalanceBefore) / 10 ** 18, "reward tokens");
//         console.log("Withdrawal successful!");
//     }
// }
