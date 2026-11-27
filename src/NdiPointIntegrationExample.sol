// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./NdiPoint.sol";

/**
 * @title NdiPointIntegrationExample
 * @notice Demonstration of how other protocols can award NdiPoint rewards for activity.
 * @dev This is a demonstration contract for educational purposes
 */
contract NdiPointIntegrationExample {
    /// @notice NdiPoint token used to pay out rewards.
    NdiPoint public immutable ndiPoint;

    /// @notice Account allowed to distribute weekly rewards and change the reward rate.
    address public owner;

    // Staking related variables
    /// @notice Simulated staked balance by account.
    mapping(address => uint256) public stakedBalance;

    /// @notice Timestamp of the last reward accounting update for an account.
    mapping(address => uint256) public lastRewardUpdate;

    /// @notice Reward points paid per staked token per day.
    uint256 public rewardRate = 100; // 100 NDI points per day per token staked

    // Lending related variables
    /// @notice Simulated lent amount by account.
    mapping(address => uint256) public lentAmount;

    /// @notice Simulated borrowed amount by account.
    mapping(address => uint256) public borrowedAmount;

    /// @notice Emitted when an account stakes in the example.
    /// @param user Account that staked.
    /// @param amount Amount staked.
    event Staked(address indexed user, uint256 amount);

    /// @notice Emitted when an account unstakes from the example.
    /// @param user Account that unstaked.
    /// @param amount Amount unstaked.
    event Unstaked(address indexed user, uint256 amount);

    /// @notice Emitted when staking rewards are claimed.
    /// @param user Account that claimed rewards.
    /// @param amount Amount of NdiPoint rewards claimed.
    event RewardsClaimed(address indexed user, uint256 amount);

    /// @notice Emitted when a lending or borrowing activity is rewarded.
    /// @param user Account that received the reward.
    /// @param amount Amount of NdiPoint rewards paid.
    /// @param activity Name of the activity that earned the reward.
    event LendingReward(address indexed user, uint256 amount, string activity);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    /// @notice Deploys the example and sets the deployer as owner.
    /// @param _ndiPoint Address of the NdiPoint token used for rewards.
    constructor(address _ndiPoint) {
        ndiPoint = NdiPoint(_ndiPoint);
        owner = msg.sender;
    }

    /**
     * @dev Simulate staking tokens and earning NDI points
     * @param amount Amount of tokens to stake
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
     * @param amount Amount of tokens to unstake
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
     * @param amount Amount of tokens lent
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
     * @param amount Amount of tokens borrowed
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
     * @param users Accounts receiving rewards
     * @param amounts Amounts corresponding to each user
     */
    function distributeWeeklyRewards(address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        require(users.length == amounts.length, "Array length mismatch");

        ndiPoint.distributeRewards(users, amounts, "Weekly platform rewards");
    }

    /**
     * @dev Calculate pending staking rewards for a user
     * @param user Account whose rewards are queried
     * @return Pending NdiPoint rewards for the account
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
     * @param user Account whose reward accounting is updated
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
     * @param user Account whose activity is queried
     * @return staked Simulated staked balance
     * @return lent Simulated lent amount
     * @return borrowed Simulated borrowed amount
     * @return pendingRewards NdiPoint rewards currently claimable
     * @return ndiBalance NdiPoint token balance of the account
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
     * @param newRate New number of reward points per staked token per day
     */
    function setRewardRate(uint256 newRate) external onlyOwner {
        rewardRate = newRate;
    }
}
