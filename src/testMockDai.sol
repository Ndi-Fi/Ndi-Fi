// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @title MockDAI
/// @notice Test-only ERC-20 token used to exercise lending flows locally.
contract MockDAI is ERC20 {
    /// @notice Deploys the mock token and mints one million tokens to the deployer.
    constructor() ERC20("Mock DAI", "DAI") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals()); // 1M DAI to deployer
    }

    /// @notice Mints mock tokens to any address for local testing.
    /// @param to Address receiving the minted tokens.
    /// @param amount Amount of tokens to mint.
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
