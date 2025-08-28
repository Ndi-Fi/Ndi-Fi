// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NdiPoint.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NdiPointEdgeTest is Test {
    NdiPoint token;
    address admin;
    address user = makeAddr("User");
    address other = makeAddr("Other");

    function setUp() public {
        admin = makeAddr("Admin");
        token = new NdiPoint(admin);
    }

    function testRevertZeroInitialOwner() public {
        vm.expectRevert("NdiPoint: initial owner cannot be zero address");
        new NdiPoint(address(0));
    }

    function testMintToZero() public {
        vm.prank(admin);
        vm.expectRevert("NdiPoint: cannot mint to zero address");
        token.mint(address(0), 1);
    }

    function testMintExceedMaxSupply() public {
        vm.prank(admin);
        uint256 huge = NdiPoint.MAX_SUPPLY() - token.totalSupply() + 1;
        vm.expectRevert("NdiPoint: minting would exceed max supply");
        token.mint(user, huge);
    }

    function testDistributeRewards_invalidInputs() public {
        address ;
        uint256 ;
        vm.prank(admin);
        vm.expectRevert("NdiPoint: arrays length mismatch");
        token.distributeRewards(rec, amt, "test");
    }

    function testDistributeRewards_empty() public {
        address ;
        uint256 ;
        vm.prank(admin);
        vm.expectRevert("NdiPoint: empty arrays");
        token.distributeRewards(rec, amt, "test");
    }

    function testDistributeRewards_zeroRecipient() public {
        address ;
        uint256 ;
        rec[0] = address(0);
        amt[0] = 1;
        vm.prank(admin);
        vm.expectRevert("NdiPoint: cannot distribute to zero address");
        token.distributeRewards(rec, amt, "test");
    }

    function testDistributeReward_zeroAmount() public {
        vm.prank(admin);
        vm.expectRevert("NdiPoint: amount must be greater than zero");
        token.distributeReward(user, 0, "test");
    }

    function testPauseUnpause() public {
        vm.prank(admin);
        token.pause();
        vm.expectRevert(); // paused state blocks transfers
        token.transfer(admin, 1);
        vm.prank(admin);
        token.unpause();
        token.transfer(admin, 0); // should now succeed
    }

    function testBurnMoreThanBalance() public {
        vm.prank(user);
        vm.expectRevert(); // only you can burn, then fails for insufficient
        token.burn(1);
    }

    function testRecoverTokens_invalid() public {
        vm.prank(admin);
        vm.expectRevert("NdiPoint: cannot recover own tokens");
        token.recoverTokens(address(token), user, 1);
    }

    function invariant_TotalSupplyNeverExceedsMax() public view {
        assert(token.totalSupply() <= NdiPoint.MAX_SUPPLY());
    }

    function testMetadataImmutability() public {
        assertEq(token.name(), "Ndi-Point");
        assertEq(token.symbol(), "NDI");
        assertEq(token.decimals(), 18);
    }
}
