// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockDAI is ERC20 {
    constructor() ERC20("Mock DAI", "DAI") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals()); // 1M DAI to deployer
    }

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
