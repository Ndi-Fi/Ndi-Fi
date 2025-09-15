// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NdiFiLending} from "../src/NdiFiLending.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

// Simple mintable ERC20
contract MockERC20 is ERC20 {
    constructor() ERC20("MockDaiToken", "MDT") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract NdiFiLendingTest is Test {
    function test_NdiFiLending() public pure {
        assertTrue(true, "NdiFiLending contract test placeholder");
    }
}
