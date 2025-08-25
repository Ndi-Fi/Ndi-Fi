// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NdiPoint
 * @dev ERC20 Token for NDI-REWARD POINTS system
 * @dev This contract implements a reward points token with the following features:
 * - ERC20 standard functionality
 * - Burnable tokens
 * - Pausable functionality for emergency stops
 * - Role-based access control for minting
 * - EIP-2612 permit functionality for gasless approvals
 * - Reentrancy protection
 * - Reward distribution mechanism
 * - Staking integration points
 */
contract NdiPoint is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ERC20Permit, ReentrancyGuard {
    // Role definitions
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    // Token configuration
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens max supply
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100 million initial supply

    // Reward and staking related variables
    mapping(address => uint256) public lastRewardClaim;
    mapping(address => bool) public isAuthorizedContract;
    
    // Events
    event RewardDistributed(address indexed recipient, uint256 amount, string reason);
    event ContractAuthorized(address indexed contractAddress, bool authorized);
    event TokensRecovered(address indexed token, address indexed to, uint256 amount);

    /**
     * @dev Constructor that sets up the token with initial parameters
     * @param initialOwner The address that will be granted the DEFAULT_ADMIN_ROLE
     */
    constructor(address initialOwner) 
        ERC20("Ndi-Point", "NDI") 
        ERC20Permit("Ndi-Point") 
    {
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
    function distributeRewards(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyRole(REWARD_DISTRIBUTOR_ROLE) nonReentrant {
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
    function distributeReward(
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyRole(REWARD_DISTRIBUTOR_ROLE) {
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
    function setContractAuthorization(address contractAddress, bool authorized) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
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
    function recoverTokens(
        address tokenAddress,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddress != address(this), "NdiPoint: cannot recover own tokens");
        require(to != address(0), "NdiPoint: cannot recover to zero address");
        
        IERC20(tokenAddress).transfer(to, amount);
        emit TokensRecovered(tokenAddress, to, amount);
    }

    /**
     * @dev Returns the maximum supply of tokens
     */
    function maxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @dev Returns the remaining mintable supply
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

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
