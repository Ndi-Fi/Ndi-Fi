// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";

/// @title NdiFiStaking
/// @notice Staking contract that deposits stake tokens into an ERC-4626 vault and pays rewards in a separate token.
/// @dev Withdrawals are subject to a `WITHDRAW_WAIT` delay after `requestWithdrawal` is called.
contract NdiStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice ERC-20 token accepted as a stake.
    IERC20 public immutable stakeToken;

    /// @notice ERC-20 token used to pay rewards; must support minting or transferring from this contract.
    IERC20 public immutable rewardToken;

    /// @notice ERC-4626 vault that receives staked assets.
    IERC4626 public immutable vault;

    /// @notice Annual percentage rate used to calculate rewards, expressed as a percentage.
    uint256 public immutable apy;

    /// @notice Minimum amount that can be staked.
    uint256 public immutable minStake;

    /// @notice Maximum amount that can be staked.
    uint256 public immutable maxStake;

    /// @notice Minimum staking duration before rewards can be claimed, in seconds.
    uint256 public immutable minDuration;

    /// @notice Mandatory waiting period between requesting and executing a withdrawal.
    uint256 public constant WITHDRAW_WAIT = 21 days;

    /// @notice Active or historical stake record for an account.
    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 rewardsClaimed;
        bool withdrawn;
    }

    /// @notice Pending withdrawal request created by `requestWithdrawal`.
    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestedAt;
        bool exists;
    }

    /// @notice Stake records by account.
    mapping(address => StakeInfo) public stakes;

    /// @notice Pending withdrawal requests by account.
    mapping(address => WithdrawalRequest) public withdrawalRequests;

    /// @notice Total amount of stake tokens currently staked.
    uint256 public totalStaked;

    /// @notice Emitted when an account stakes tokens.
    /// @param user Account that staked.
    /// @param amount Amount of tokens staked.
    event Staked(address indexed user, uint256 amount);

    /// @notice Emitted when an account claims staking rewards.
    /// @param user Account that claimed rewards.
    /// @param reward Amount of reward tokens claimed.
    event RewardClaimed(address indexed user, uint256 reward);

    /// @notice Emitted when an account requests a withdrawal.
    /// @param user Account requesting the withdrawal.
    /// @param amount Amount of stake tokens requested for withdrawal.
    event WithdrawalRequested(address indexed user, uint256 amount);

    /// @notice Emitted when an account completes a withdrawal.
    /// @param user Account that withdrew.
    /// @param stakedAmount Amount of stake tokens withdrawn.
    /// @param rewardAmount Amount of reward tokens paid at withdrawal.
    event Withdrawn(address indexed user, uint256 stakedAmount, uint256 rewardAmount);

    /// @notice Emitted when the owner skims vault profits.
    /// @param to Address receiving the profits.
    /// @param amount Amount of underlying assets withdrawn.
    event ProfitsSkimmed(address to, uint256 amount);

    /// @notice Deploys the staking contract.
    /// @param _stakeToken Address of the ERC-20 token accepted as a stake.
    /// @param _rewardToken Address of the ERC-20 token used for rewards.
    /// @param _vault Address of the ERC-4626 vault whose asset must be `_stakeToken`.
    /// @param initialOwner Address receiving owner privileges.
    /// @param _apy Reward percentage rate.
    /// @param _minStake Minimum stake amount.
    /// @param _maxStake Maximum stake amount.
    /// @param _minDuration Minimum staking duration in seconds.
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

    /// @notice Stakes tokens and deposits them into the vault on behalf of this contract.
    /// @dev Requires prior ERC-20 approval; an account may only have one active stake.
    /// @param amount Amount of stake tokens to deposit.
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

    /// @notice Calculates rewards accrued but not yet claimed by an account.
    /// @param user Account whose rewards are queried.
    /// @return Amount of reward tokens currently claimable.
    function pendingRewards(address user) public view returns (uint256) {
        StakeInfo storage s = stakes[user];
        if (s.amount == 0 || s.withdrawn) return 0;
        uint256 elapsed = block.timestamp - s.timestamp;
        uint256 totalRewards = (s.amount * apy * elapsed) / (100 * 365 days);
        return totalRewards > s.rewardsClaimed ? totalRewards - s.rewardsClaimed : 0;
    }

    /// @notice Claims all pending rewards for the caller.
    /// @dev Reward tokens are transferred from this contract to the caller.
    function claimRewards() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount > 0 && !s.withdrawn, "No active stake");

        uint256 reward = pendingRewards(msg.sender);
        require(reward > 0, "No rewards");

        // Transfer reward tokens from contract to user
        rewardToken.safeTransfer(msg.sender, reward);

        s.rewardsClaimed += reward;
        emit RewardClaimed(msg.sender, reward);
    }

    /// @notice Requests a withdrawal and starts the mandatory waiting period.
    /// @dev Only one request may be pending per account.
    function requestWithdrawal() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount > 0 && !s.withdrawn, "No active stake");
        require(!withdrawalRequests[msg.sender].exists, "Already requested");

        withdrawalRequests[msg.sender] =
            WithdrawalRequest({amount: s.amount, requestedAt: block.timestamp, exists: true});

        emit WithdrawalRequested(msg.sender, s.amount);
    }

    /// @notice Completes a previously requested withdrawal after the waiting period.
    /// @dev Redeems all vault shares held by this contract and pays any pending rewards.
    function executeWithdrawal() external nonReentrant {
        WithdrawalRequest storage req = withdrawalRequests[msg.sender];
        require(req.exists, "No withdrawal requested");
        require(block.timestamp >= req.requestedAt + WITHDRAW_WAIT, "Too early");

        StakeInfo storage s = stakes[msg.sender];
        require(!s.withdrawn, "Already withdrawn");

        // Calculate reward BEFORE marking as withdrawn
        uint256 reward = pendingRewards(msg.sender);

        // Store values before withdrawal
        uint256 stakedAmount = s.amount;

        // Mark as withdrawn
        s.withdrawn = true;

        // Withdraw principal from vault by redeeming all shares owned by this contract
        uint256 sharesToRedeem = vault.balanceOf(address(this));
        vault.redeem(sharesToRedeem, msg.sender, address(this));

        if (reward > 0) {
            rewardToken.safeTransfer(msg.sender, reward);
            s.rewardsClaimed += reward;
        }

        totalStaked -= stakedAmount;

        delete withdrawalRequests[msg.sender];

        emit Withdrawn(msg.sender, stakedAmount, reward);

        // Don't delete stake info - just mark it as withdrawn with amount = 0
        // This allows external contracts to verify the withdrawal status
        s.amount = 0;
        // s.withdrawn is already set to true above
    }

    /// @notice Returns vault profits that exceed the recorded total staked amount.
    /// @return Amount of underlying assets attributable to profits.
    function getProfits() public view returns (uint256) {
        uint256 totalAssets = vault.convertToAssets(vault.balanceOf(address(this)));
        return totalAssets > totalStaked ? totalAssets - totalStaked : 0;
    }

    /// @notice Sends accumulated vault profits to a recipient.
    /// @dev Only callable by the owner.
    /// @param to Address receiving the profits.
    function skimProfits(address to) external onlyOwner nonReentrant {
        uint256 profit = getProfits();
        require(profit > 0, "No profits");
        vault.withdraw(profit, to, address(this));
        emit ProfitsSkimmed(to, profit);
    }
}
