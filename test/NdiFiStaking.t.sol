// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {NdiStaking} from "../src/NdiFiStaking.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {NdiFiVault} from "src/NdiFiVault.sol";

// Simple mintable ERC20
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
    address public staker = makeAddr("staker");

    function setUp() public {
        //deployed stake token
        stakeToken = new MockERC20("stake Token", "ST");
        //deploy reward token
        vm.prank(owner);
        rewardToken = new MockERC20("reward Token", "RT");
        //deploy vault
        vm.prank(owner);
        vault = new NdiFiVault(address(stakeToken), owner);
        stake = new NdiStaking(
            address(stakeToken), address(rewardToken), address(vault), owner, 15, 10 * 1e18, 1000 * 1e18, 20 days
        );
        //mint stake token to staker
        stakeToken.mint(staker, 100 * 1e18);

        //mint reward token to staking contract
        rewardToken.mint(address(stake), 1_000_000 * 1e18);
        //approve staking contract to spend token
        vm.prank(staker);
        stakeToken.approve(address(stake), 50 * 1e18);
    }

    function testStake() external {
        vm.prank(staker);
        stake.stake(10 * 1e18);

        assertEq(stake.totalStaked(), 10 * 1e18);
    }
}

