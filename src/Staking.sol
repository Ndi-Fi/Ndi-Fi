// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract Staking {
    struct User {
        uint256 amount;
        bool withdraw;
    }
    mapping(address => User) public stakerInfo;
    mapping(address => User) public rewards;
    uint256 public totalStaked;

    function stake(uint256 amount) public {
        stakes[msg.sender] += amount;
        totalStaked += amount;
        // Logic to calculate rewards
    }

    function unstake(uint256 amount) public {
        require(stakes[msg.sender] >= amount, "Insufficient stake");
        stakes[msg.sender] -= amount;
        totalStaked -= amount;
        // Logic to transfer tokens back to user
    }

    function calculateRewards(address user) public view returns (uint256) {
        // Logic to calculate rewards based on user's stake
    }
}