# NdiPoint Token Documentation

## Overview

**NdiPoint** is a comprehensive ERC20 reward points token for the NDI-Fi ecosystem. It serves as the cornerstone of the reward system, enabling users to earn, accumulate, and utilize points across various DeFi activities within the platform.

## Token Details

- **Name**: Ndi-Point
- **Symbol**: NDI
- **Decimals**: 18
- **Initial Supply**: 100,000,000 NDI (100 million tokens)
- **Maximum Supply**: 1,000,000,000 NDI (1 billion tokens)
- **Standard**: ERC20 with extensions

## Key Features

### 1. **Multi-Role Access Control**
- **DEFAULT_ADMIN_ROLE**: Full administrative control
- **MINTER_ROLE**: Can mint new tokens within max supply limits
- **PAUSER_ROLE**: Can pause/unpause all token transfers
- **REWARD_DISTRIBUTOR_ROLE**: Can distribute rewards to users

### 2. **Reward Distribution System**
- Individual reward distribution with customizable reasons
- Batch reward distribution for efficiency
- Automatic tracking of last reward claim timestamps
- Built-in supply limit protection

### 3. **Security Features**
- **Pausable**: Emergency stop functionality
- **Burnable**: Users can burn their own tokens
- **Reentrancy Protection**: Prevents reentrancy attacks
- **Zero Address Protection**: Prevents operations with zero addresses

### 4. **Advanced ERC20 Features**
- **EIP-2612 Permit**: Gasless approvals using signatures
- **AccessControl**: Role-based permissions
- **Token Recovery**: Admin can recover mistakenly sent tokens

### 5. **Integration Ready**
- Contract authorization system for seamless DeFi integrations
- Staking contract compatibility
- Lending protocol integration points

## Contract Architecture

```solidity
NdiPoint
├── ERC20 (Base token functionality)
├── ERC20Burnable (Token burning capability)
├── ERC20Pausable (Emergency pause functionality)
├── AccessControl (Role-based permissions)
├── ERC20Permit (Gasless approvals)
└── ReentrancyGuard (Attack prevention)
```

## Core Functions

### Administrative Functions

#### `mint(address to, uint256 amount)`
- **Access**: MINTER_ROLE
- **Purpose**: Mint new tokens to a specified address
- **Constraints**: Cannot exceed max supply

#### `pause()` / `unpause()`
- **Access**: PAUSER_ROLE
- **Purpose**: Emergency stop/resume all token transfers

#### `setContractAuthorization(address contractAddress, bool authorized)`
- **Access**: DEFAULT_ADMIN_ROLE
- **Purpose**: Authorize contracts for special interactions

### Reward Distribution

#### `distributeReward(address recipient, uint256 amount, string reason)`
- **Access**: REWARD_DISTRIBUTOR_ROLE
- **Purpose**: Distribute rewards to individual users
- **Features**: Automatic timestamp tracking, reason logging

#### `distributeRewards(address[] recipients, uint256[] amounts, string reason)`
- **Access**: REWARD_DISTRIBUTOR_ROLE
- **Purpose**: Batch distribute rewards for efficiency
- **Features**: Gas optimization for multiple recipients

### User Functions

#### Standard ERC20 Functions
- `transfer(address to, uint256 amount)`
- `approve(address spender, uint256 amount)`
- `transferFrom(address from, address to, uint256 amount)`

#### Extended Functions
- `burn(uint256 amount)`: Burn tokens to reduce supply
- `permit(...)`: Gasless approval using signatures

### View Functions

#### `maxSupply()`
Returns the maximum supply (1 billion tokens)

#### `remainingSupply()`
Returns how many tokens can still be minted

#### `getLastRewardClaim(address account)`
Returns timestamp of last reward claim for an account

#### `isAuthorizedContract(address contractAddress)`
Checks if a contract is authorized for special interactions

## Events

### Standard ERC20 Events
- `Transfer(address indexed from, address indexed to, uint256 value)`
- `Approval(address indexed owner, address indexed spender, uint256 value)`

### Custom Events
- `RewardDistributed(address indexed recipient, uint256 amount, string reason)`
- `ContractAuthorized(address indexed contractAddress, bool authorized)`
- `TokensRecovered(address indexed token, address indexed to, uint256 amount)`

## Use Cases

### 1. **Staking Rewards**
Users earn NDI points for staking tokens in the platform

### 2. **Lending Incentives**
Borrowers and lenders receive points based on activity

### 3. **Liquidity Mining**
LP providers earn rewards proportional to their contribution

### 4. **Governance Participation**
Users earn points for participating in platform governance

### 5. **Trading Rewards**
Active traders receive rebates in NDI points

## Integration Examples

### Staking Contract Integration
```solidity
// In your staking contract
function distributeStakingRewards(address staker, uint256 amount) external {
    ndiPoint.distributeReward(staker, amount, "Staking rewards");
}
```

### Batch Reward Distribution
```solidity
function distributeBatchRewards(
    address[] memory users,
    uint256[] memory amounts
) external {
    ndiPoint.distributeRewards(users, amounts, "Weekly liquidity rewards");
}
```

## Deployment Guide

### Prerequisites
- Foundry installed
- Environment variables set
- Sufficient ETH for deployment

### Deployment Steps

1. **Set Environment Variables**
```bash
export PRIVATE_KEY=your_private_key
export RPC_URL=your_rpc_url
```

2. **Deploy Contract**
```bash
forge script script/DeployNdiPoint.s.sol --rpc-url $RPC_URL --broadcast --verify
```

3. **Verify Deployment**
```bash
forge verify-contract <deployed_address> src/NdiPoint.sol:NdiPoint --chain-id <chain_id>
```

## Testing

The contract includes comprehensive tests covering:
- Basic ERC20 functionality
- Role-based access controls
- Reward distribution mechanisms
- Security features (pausing, reentrancy protection)
- Edge cases and error conditions

### Run Tests
```bash
forge test --match-contract NdiPointTest -vv
```

## Security Considerations

### Implemented Protections
1. **Role-based access control** prevents unauthorized actions
2. **Reentrancy guard** protects against reentrancy attacks
3. **Zero address checks** prevent accidental burns
4. **Supply limits** prevent unlimited inflation
5. **Pausable functionality** enables emergency response

### Best Practices
1. Use multi-signature wallets for admin roles
2. Implement timelock for critical operations
3. Regular security audits before mainnet deployment
4. Monitor for unusual reward distribution patterns

## Gas Optimization

The contract is optimized for gas efficiency:
- Batch operations for multiple recipients
- Efficient storage patterns
- Optimized event emissions
- Minimal external calls

## Future Enhancements

Potential future features:
1. **Vesting schedules** for reward distribution
2. **Decay mechanisms** for time-based point reduction
3. **Exchange rate functions** for point-to-token conversions
4. **Governance voting** using point balances

## License

This contract is released under the MIT License, making it free for use and modification.

## Support

For technical support or questions:
- Review the comprehensive test suite
- Check the inline documentation
- Submit issues on the project repository

---

*This documentation covers the NdiPoint token implementation as of the latest version. Always refer to the source code for the most up-to-date functionality.*
