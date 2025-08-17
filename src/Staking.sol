// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Vault.sol";
import "./NdiToken.sol";

// Function stake
// Function withdraw
// Function claim
// Function getBalance
// Struct StakeInfo {amount, timestamp, bool claimed{}

// Stakes[] public listOfStakes;



contract StakingContract is Initializable {
    DAIVault public vault;
    IERC20Upgradeable public dai;
    NdiToken public rewardToken;

    mapping(address => uint256) public staked;
    mapping(address => uint256) public stakeTimestamp;

    function initialize(
        address _vault,
        address _dai,
        address _rewardToken
    ) public initializer {
        vault = DAIVault(_vault);
        dai = IERC20Upgradeable(_dai);
        rewardToken = NdiToken(_rewardToken);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Zero stake");

        dai.transferFrom(msg.sender, address(this), amount);
        dai.approve(address(vault), amount);
        vault.deposit(amount, address(this)); // stake DAI to vault

        staked[msg.sender] += amount;
        stakeTimestamp[msg.sender] = block.timestamp;
    }

    function claimRewards() external {
        uint256 reward = calculateRewards(msg.sender);
        require(reward > 0, "No rewards");
        rewardToken.mint(msg.sender, reward);
    }

    function unstake() external {
        uint256 amount = staked[msg.sender];
        require(amount > 0, "Nothing staked");

        vault.withdraw(amount, msg.sender, address(this));
        staked[msg.sender] = 0;
    }

    function calculateRewards(address user) public view returns (uint256) {
        // Simple example: 1 token per second per 100 DAI
        uint256 duration = block.timestamp - stakeTimestamp[user];
        return (staked[user] * duration) / (100 * 1e18);
    }
}