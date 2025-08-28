// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/YourERC20Token.sol";

contract ERC20EdgeTest is Test {
    YourERC20Token token;
    address alice;
    address bob;

    function setUp() public {
        token = new YourERC20Token("TestToken", "TT", 18, 1000 ether);
        alice = makeAddr("Alice");
        bob = makeAddr("Bob");
        token.transfer(alice, 100 ether);
        token.transfer(bob, 100 ether);
    }

    function testTransferToZeroReverts(uint256 amount) public {
        vm.prank(alice);
        vm.expectRevert("ERC20: transfer to the zero address");
        token.transfer(address(0), amount);
    }

    function testFuzzTransfer(uint256 amount, address to) public {
        vm.assume(to != address(0)); // avoid zero-address
        token.transfer(alice, 50 ether); // setup
        vm.prank(alice);
        // ensure we don't exceed balances
        amount = bound(amount, 0, token.balanceOf(alice));
        uint256 pre = token.balanceOf(to);
        token.transfer(to, amount);
        assertEq(token.balanceOf(to), pre + amount);
    }

    function invariant_TotalSupplyUnchanged() public view {
        assertEq(token.totalSupply(), 1000 ether);
    }
}
