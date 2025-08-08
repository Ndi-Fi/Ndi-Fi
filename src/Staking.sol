// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {NDIFIVault} from "./NDI-FIVAULT.sol";

// contract TokenStaking is Ownable, ReentrancyGuard {
//     ERC20 public immutable stakeToken; // Token X
//     ERC20 public immutable rewardToken;
//     NDIFIVault public immutable vault;

//     uint256 public immutable apy;
//     uint256 public immutable minStake;
//     uint256 public immutable maxStake;
//     uint256 public immutable minDuration;

//     struct StakeInfo {
//         uint256 amount;
//         uint256 timestamp;
//         bool withdrawn;
//     }

//     mapping(address => StakeInfo) public stakes;

//     event Staked(address indexed user, uint256 amount);
//     event Withdrawn(address indexed user, uint256 stakedAmount, uint256 rewardAmount);

//     error BelowMinimumStake();
//     error AboveMaximumStake();
//     error AlreadyStaked();
//     error NotStaked();
//     error StakeLocked();
//     error AlreadyWithdrawn();

//     constructor(
//         address _stakeToken,
//         address _rewardToken,
//         address _vault,
//         address initialOwner,
//         uint256 _apy,
//         uint256 _minStake,
//         uint256 _maxStake,
//         uint256 _minDuration
//     ) Ownable(initialOwner) {
//         stakeToken = ERC20(_stakeToken);
//         rewardToken = ERC20(_rewardToken);
//         vault = _vault;

//         apy = _apy;
//         minStake = _minStake;
//         maxStake = _maxStake;
//         minDuration = _minDuration;
//     }

//     function stake(uint256 amount) external nonReentrant {
//         if (amount < minStake) revert BelowMinimumStake();
//         if (amount > maxStake) revert AboveMaximumStake();
//         if (stakes[msg.sender].amount > 0) revert AlreadyStaked();

//         stakes[msg.sender] = StakeInfo({amount: amount, timestamp: block.timestamp, withdrawn: false});

//         // Transfer tokens to vault
//         vault.depositFrom(msg.sender, amount);

//         emit Staked(msg.sender, amount);
//     }

//     function calculateReward(address user) public view returns (uint256) {
//         StakeInfo memory s = stakes[user];
//         if (s.amount == 0) return 0;

//         uint256 timeElapsed = block.timestamp - s.timestamp;
//         uint256 reward = (s.amount * apy * timeElapsed) / (100 * 365 days);
//         return reward;
//     }

//     function withdraw() external nonReentrant {
//         StakeInfo storage s = stakes[msg.sender];

//         if (s.amount == 0) revert NotStaked();
//         if (s.withdrawn) revert AlreadyWithdrawn();
//         if (block.timestamp < s.timestamp + minDuration) revert StakeLocked();

//         s.withdrawn = true;

//         // Send stake back from vault
//         vault.releaseTo(msg.sender, s.amount);

//         // Calculate and send reward
//         uint256 reward = calculateReward(msg.sender);
//         require(rewardToken.transfer(msg.sender, reward), "Reward transfer failed");

//         emit Withdrawn(msg.sender, s.amount, reward);
//     }
// }
