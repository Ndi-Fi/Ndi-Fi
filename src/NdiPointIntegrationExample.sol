// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./NdiPoint.sol";

/**
 * @title NdiPointIntegrationExample
 * @dev Example contract showing how to integrate NdiPoint with other DeFi protocols
 * @dev This is a demonstration contract for educational purposes
 */
contract NdiPointIntegrationExample {
    NdiPoint public immutable ndiPoint;
    address public owner;

    // Staking related variables
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public lastRewardUpdate;
    uint256 public rewardRate = 100; // 100 NDI points per day per token staked

    // Lending related variables
    mapping(address => uint256) public lentAmount;
    mapping(address => uint256) public borrowedAmount;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event LendingReward(address indexed user, uint256 amount, string activity);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _ndiPoint) {
        ndiPoint = NdiPoint(_ndiPoint);
        owner = msg.sender;
    }

    /**
     * @dev Simulate staking tokens and earning NDI points
     */
    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        // Update rewards before changing stake
        _updateRewards(msg.sender);

        // Update staked balance
        stakedBalance[msg.sender] += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @dev Simulate unstaking tokens
     */
    function unstake(uint256 amount) external {
        require(stakedBalance[msg.sender] >= amount, "Insufficient staked balance");

        // Update rewards before changing stake
        _updateRewards(msg.sender);

        // Update staked balance
        stakedBalance[msg.sender] -= amount;

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @dev Claim accumulated staking rewards
     */
    function claimStakingRewards() external {
        uint256 rewards = calculatePendingRewards(msg.sender);
        require(rewards > 0, "No rewards to claim");

        lastRewardUpdate[msg.sender] = block.timestamp;

        // Distribute NDI points as rewards
        ndiPoint.distributeReward(msg.sender, rewards, "Staking rewards");

        emit RewardsClaimed(msg.sender, rewards);
    }

    /**
     * @dev Simulate lending activity and reward users
     */
    function lend(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        lentAmount[msg.sender] += amount;

        // Calculate lending reward (1% of lent amount in NDI points)
        uint256 reward = (amount * 1 * 10 ** 18) / 100; // 1% reward in NDI points

        ndiPoint.distributeReward(msg.sender, reward, "Lending incentive");

        emit LendingReward(msg.sender, reward, "Lending");
    }

    /**
     * @dev Simulate borrowing activity and reward users
     */
    function borrow(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        borrowedAmount[msg.sender] += amount;

        // Calculate borrowing reward (0.5% of borrowed amount in NDI points)
        uint256 reward = (amount * 5 * 10 ** 17) / 100; // 0.5% reward in NDI points

        ndiPoint.distributeReward(msg.sender, reward, "Borrowing incentive");

        emit LendingReward(msg.sender, reward, "Borrowing");
    }

    /**
     * @dev Batch reward distribution for multiple users (weekly distribution example)
     */
    function distributeWeeklyRewards(address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        require(users.length == amounts.length, "Array length mismatch");

        ndiPoint.distributeRewards(users, amounts, "Weekly platform rewards");
    }

    /**
     * @dev Calculate pending staking rewards for a user
     */
    function calculatePendingRewards(address user) public view returns (uint256) {
        if (stakedBalance[user] == 0) {
            return 0;
        }

        uint256 timeDiff = block.timestamp - lastRewardUpdate[user];
        uint256 dailyReward = (stakedBalance[user] * rewardRate * 10 ** 18) / 1e18;

        return (dailyReward * timeDiff) / 1 days;
    }

    /**
     * @dev Update reward calculation for a user
     */
    function _updateRewards(address user) internal {
        if (stakedBalance[user] > 0) {
            uint256 pendingRewards = calculatePendingRewards(user);
            if (pendingRewards > 0) {
                ndiPoint.distributeReward(user, pendingRewards, "Auto staking rewards");
            }
        }
        lastRewardUpdate[user] = block.timestamp;
    }

    /**
     * @dev Get user's total activity summary
     */
    function getUserActivitySummary(address user)
        external
        view
        returns (uint256 staked, uint256 lent, uint256 borrowed, uint256 pendingRewards, uint256 ndiBalance)
    {
        staked = stakedBalance[user];
        lent = lentAmount[user];
        borrowed = borrowedAmount[user];
        pendingRewards = calculatePendingRewards(user);
        ndiBalance = ndiPoint.balanceOf(user);
    }

    /**
     * @dev Update reward rate (only owner)
     */
    function setRewardRate(uint256 newRate) external onlyOwner {
        rewardRate = newRate;
    }
}
