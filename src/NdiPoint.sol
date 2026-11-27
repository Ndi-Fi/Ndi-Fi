// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NdiPoint
 * @notice ERC-20 reward points token used across the Ndi-Fi protocol.
 * @dev Implements standard ERC-20 transfers, burnable and pausable balances, role-based minting,
 * EIP-2612 gasless approvals, reentrancy protection, reward distribution and staking integration.
 */
contract NdiPoint is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ERC20Permit, ReentrancyGuard {
    // Role definitions
    /// @notice Role that may pause and unpause token transfers.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Role that may mint new tokens.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Role that may distribute reward tokens.
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    // Token configuration
    /// @notice Maximum total supply, capped at one billion tokens.
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens max supply

    /// @notice Supply minted to the initial owner at deployment.
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10 ** 18; // 100 million initial supply

    // Reward and staking related variables
    /// @notice Timestamp of the most recent reward distribution to an account.
    mapping(address => uint256) public lastRewardClaim;

    /// @notice Whether an external contract is authorized to interact with this token.
    mapping(address => bool) public isAuthorizedContract;

    // Events
    /// @notice Emitted when reward points are minted to a recipient.
    /// @param recipient Account receiving the reward.
    /// @param amount Amount of points distributed.
    /// @param reason Human-readable reason for the distribution.
    event RewardDistributed(address indexed recipient, uint256 amount, string reason);

    /// @notice Emitted when an external contract's authorization changes.
    /// @param contractAddress Contract whose authorization changed.
    /// @param authorized New authorization status.
    event ContractAuthorized(address indexed contractAddress, bool authorized);

    /// @notice Emitted when accidentally sent ERC-20 tokens are recovered.
    /// @param token Address of the recovered token.
    /// @param to Address receiving the recovered tokens.
    /// @param amount Amount of tokens recovered.
    event TokensRecovered(address indexed token, address indexed to, uint256 amount);

    /**
     * @dev Constructor that sets up the token with initial parameters
     * @param initialOwner The address that will be granted the DEFAULT_ADMIN_ROLE
     */
    constructor(address initialOwner) ERC20("Ndi-Point", "NDI") ERC20Permit("Ndi-Point") {
        require(initialOwner != address(0), "NdiPoint: initial owner cannot be zero address");

        // Grant roles to the initial owner
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(PAUSER_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, initialOwner);

        // Mint initial supply to the initial owner
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @dev Mints new tokens to a specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "NdiPoint: cannot mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "NdiPoint: minting would exceed max supply");
        _mint(to, amount);
    }

    /**
     * @dev Distributes rewards to multiple recipients
     * @param recipients Array of addresses to receive rewards
     * @param amounts Array of amounts corresponding to each recipient
     * @param reason Reason for the reward distribution
     */
    function distributeRewards(address[] calldata recipients, uint256[] calldata amounts, string calldata reason)
        external
        onlyRole(REWARD_DISTRIBUTOR_ROLE)
        nonReentrant
    {
        require(recipients.length == amounts.length, "NdiPoint: arrays length mismatch");
        require(recipients.length > 0, "NdiPoint: empty arrays");

        uint256 totalAmount = 0;

        // Calculate total amount needed
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(totalSupply() + totalAmount <= MAX_SUPPLY, "NdiPoint: reward distribution would exceed max supply");

        // Distribute rewards
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "NdiPoint: cannot distribute to zero address");
            require(amounts[i] > 0, "NdiPoint: amount must be greater than zero");

            _mint(recipients[i], amounts[i]);
            lastRewardClaim[recipients[i]] = block.timestamp;

            emit RewardDistributed(recipients[i], amounts[i], reason);
        }
    }

    /**
     * @dev Distributes a single reward to a recipient
     * @param recipient Address to receive the reward
     * @param amount Amount of tokens to reward
     * @param reason Reason for the reward
     */
    function distributeReward(address recipient, uint256 amount, string calldata reason)
        external
        onlyRole(REWARD_DISTRIBUTOR_ROLE)
    {
        require(recipient != address(0), "NdiPoint: cannot distribute to zero address");
        require(amount > 0, "NdiPoint: amount must be greater than zero");
        require(totalSupply() + amount <= MAX_SUPPLY, "NdiPoint: reward distribution would exceed max supply");

        _mint(recipient, amount);
        lastRewardClaim[recipient] = block.timestamp;

        emit RewardDistributed(recipient, amount, reason);
    }

    /**
     * @dev Authorizes or deauthorizes a contract to interact with this token
     * @param contractAddress The contract address to authorize/deauthorize
     * @param authorized Whether the contract should be authorized
     */
    function setContractAuthorization(address contractAddress, bool authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(contractAddress != address(0), "NdiPoint: cannot authorize zero address");
        isAuthorizedContract[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }

    /**
     * @dev Pauses all token transfers
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Recovers ERC20 tokens sent to this contract by mistake
     * @param tokenAddress The address of the token to recover
     * @param to The address to send the recovered tokens to
     * @param amount The amount of tokens to recover
     */
    function recoverTokens(address tokenAddress, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddress != address(this), "NdiPoint: cannot recover own tokens");
        require(to != address(0), "NdiPoint: cannot recover to zero address");

        IERC20(tokenAddress).transfer(to, amount);
        emit TokensRecovered(tokenAddress, to, amount);
    }

    /**
     * @notice Returns the maximum supply of tokens
     * @return The maximum number of tokens that can ever exist
     */
    function maxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @notice Returns the remaining mintable supply
     * @return The number of tokens that can still be minted
     */
    function remainingSupply() public view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @dev Checks if an address has claimed rewards recently
     * @param account The address to check
     * @return The timestamp of the last reward claim
     */
    function getLastRewardClaim(address account) external view returns (uint256) {
        return lastRewardClaim[account];
    }

    // The following functions are overrides required by Solidity

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
