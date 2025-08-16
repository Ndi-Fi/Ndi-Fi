// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Staking.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TokenStakingTest is Test {
    TokenStaking staking;
    MockToken stakeToken;
    MockToken rewardToken;

    address owner = address(0xABCD);
    address user = address(0x1234);

    uint256 apy = 10; // 10% APY
    uint256 minStake = 100 ether;
    uint256 maxStake = 1000 ether;
    uint256 minDuration = 30 days;

    function setUp() public {
        stakeToken = new MockToken("StakeToken", "STK");
        rewardToken = new MockToken("RewardToken", "RWD");

        staking = new TokenStaking(
            address(stakeToken),
            address(rewardToken),
            owner,
            apy,
            minStake,
            maxStake,
            minDuration
        );

        
        stakeToken.mint(user, 1000 ether);

        
        rewardToken.mint(address(staking), 100 ether);

    
        vm.startPrank(user);
        stakeToken.approve(address(staking), type(uint256).max);
        vm.stopPrank();
    }

    function test_RevertWhen_StakeTooSmall() public {
        vm.startPrank(user);
        vm.expectRevert(TokenStaking.BelowMinimumStake.selector);
        staking.stake(50 ether);
        vm.stopPrank();
    }

    function test_RevertWhen_StakeTooBig() public {
        vm.startPrank(user);
        vm.expectRevert(TokenStaking.AboveMaximumStake.selector);
        staking.stake(2000 ether);
        vm.stopPrank();
    }

    function test_RevertWhen_WithdrawTooEarly() public {
        vm.startPrank(user);
        staking.stake(200 ether);
        vm.expectRevert(TokenStaking.StakeLocked.selector);
        staking.withdraw();
        vm.stopPrank();
    }

    function testWithdrawWithReward() public {
        vm.startPrank(user);
        staking.stake(200 ether);
        vm.warp(block.timestamp + minDuration + 1 days); 
        staking.withdraw();
        vm.stopPrank();

        uint256 rewardBalance = rewardToken.balanceOf(user);
        assertGt(rewardBalance, 0, "Reward should be greater than zero");
    }
}
