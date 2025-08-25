// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";

contract NdiStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakeToken;
    IERC20 public immutable rewardToken; // Must support minting
    IERC4626 public immutable vault;

    uint256 public immutable apy;
    uint256 public immutable minStake;
    uint256 public immutable maxStake;
    uint256 public immutable minDuration;
    uint256 public constant WITHDRAW_WAIT = 21 days;

    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 rewardsClaimed;
        bool withdrawn;
    }

    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestedAt;
        bool exists;
    }

    mapping(address => StakeInfo) public stakes;
    mapping(address => WithdrawalRequest) public withdrawalRequests;

    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event WithdrawalRequested(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 stakedAmount, uint256 rewardAmount);
    event ProfitsSkimmed(address to, uint256 amount);

    constructor(
        address _stakeToken,
        address _rewardToken,
        address _vault,
        address initialOwner,
        uint256 _apy,
        uint256 _minStake,
        uint256 _maxStake,
        uint256 _minDuration
    ) Ownable(initialOwner) {
        require(_stakeToken != address(0) && _rewardToken != address(0) && _vault != address(0), "Zero address");
        stakeToken = IERC20(_stakeToken);
        rewardToken = IERC20(_rewardToken);
        vault = IERC4626(_vault);

        apy = _apy;
        minStake = _minStake;
        maxStake = _maxStake;
        minDuration = _minDuration;

        require(vault.asset() == _stakeToken, "Vault asset mismatch");
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount >= minStake && amount <= maxStake, "Stake amount invalid");
        require(stakes[msg.sender].amount == 0 || stakes[msg.sender].withdrawn, "Already staked");

        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        stakeToken.forceApprove(address(vault), amount);
        vault.deposit(amount, address(this));

        stakes[msg.sender] =
            StakeInfo({amount: amount, timestamp: block.timestamp, rewardsClaimed: 0, withdrawn: false});

        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function pendingRewards(address user) public view returns (uint256) {
        StakeInfo storage s = stakes[user];
        if (s.amount == 0 || s.withdrawn) return 0;
        uint256 elapsed = block.timestamp - s.timestamp;
        uint256 totalRewards = (s.amount * apy * elapsed) / (100 * 365 days);
        return totalRewards > s.rewardsClaimed ? totalRewards - s.rewardsClaimed : 0;
    }

    function claimRewards() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount > 0 && !s.withdrawn, "No active stake");

        uint256 reward = pendingRewards(msg.sender);
        require(reward > 0, "No rewards");

        // Assuming rewardToken supports minting to this contract
        ERC20(address(rewardToken)).transfer(msg.sender, reward);

        s.rewardsClaimed += reward;
        emit RewardClaimed(msg.sender, reward);
    }

    // New: request withdrawal — starts the waiting period
    function requestWithdrawal() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount > 0 && !s.withdrawn, "No active stake");
        require(!withdrawalRequests[msg.sender].exists, "Already requested");

        withdrawalRequests[msg.sender] =
            WithdrawalRequest({amount: s.amount, requestedAt: block.timestamp, exists: true});

        emit WithdrawalRequested(msg.sender, s.amount);
    }

    // Withdraw after 21-day wait
    function executeWithdrawal() external nonReentrant {
        WithdrawalRequest storage req = withdrawalRequests[msg.sender];
        require(req.exists, "No withdrawal requested");
        require(block.timestamp >= req.requestedAt + WITHDRAW_WAIT, "Too early");

        StakeInfo storage s = stakes[msg.sender];
        require(!s.withdrawn, "Already withdrawn");

        s.withdrawn = true;

        // Withdraw principal from vault
        vault.withdraw(s.amount, msg.sender, address(this));

        uint256 reward = pendingRewards(msg.sender);
        if (reward > 0) {
            ERC20(address(rewardToken)).transfer(msg.sender, reward);
        }

        totalStaked -= s.amount;

        delete withdrawalRequests[msg.sender];
        delete stakes[msg.sender];

        emit Withdrawn(msg.sender, s.amount, reward);
    }

    function getProfits() public view returns (uint256) {
        uint256 totalAssets = vault.convertToAssets(vault.balanceOf(address(this)));
        return totalAssets > totalStaked ? totalAssets - totalStaked : 0;
    }

    function skimProfits(address to) external onlyOwner nonReentrant {
        uint256 profit = getProfits();
        require(profit > 0, "No profits");
        vault.withdraw(profit, to, address(this));
        emit ProfitsSkimmed(to, profit);
    }
}
