// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NdiPoint.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract NdiPointTest is Test {
    NdiPoint public ndiPoint;
    address public owner;
    address public user1;
    address public user2;
    address public minter;
    address public rewardDistributor;
    address public pauser;

    event RewardDistributed(address indexed recipient, uint256 amount, string reason);
    event ContractAuthorized(address indexed contractAddress, bool authorized);

    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        minter = makeAddr("minter");
        rewardDistributor = makeAddr("rewardDistributor");
        pauser = makeAddr("pauser");

        vm.prank(owner);
        ndiPoint = new NdiPoint(owner);

        // Grant roles
        vm.startPrank(owner);
        ndiPoint.grantRole(ndiPoint.MINTER_ROLE(), minter);
        ndiPoint.grantRole(ndiPoint.REWARD_DISTRIBUTOR_ROLE(), rewardDistributor);
        ndiPoint.grantRole(ndiPoint.PAUSER_ROLE(), pauser);
        vm.stopPrank();
    }

    function testInitialState() public {
        assertEq(ndiPoint.name(), "Ndi-Point");
        assertEq(ndiPoint.symbol(), "NDI");
        assertEq(ndiPoint.decimals(), 18);
        assertEq(ndiPoint.totalSupply(), 100_000_000 * 10 ** 18);
        assertEq(ndiPoint.maxSupply(), 1_000_000_000 * 10 ** 18);
        assertEq(ndiPoint.balanceOf(owner), 100_000_000 * 10 ** 18);
        assertTrue(ndiPoint.hasRole(ndiPoint.DEFAULT_ADMIN_ROLE(), owner));
    }

    function testMinting() public {
        uint256 mintAmount = 1000 * 10 ** 18;

        vm.prank(minter);
        ndiPoint.mint(user1, mintAmount);

        assertEq(ndiPoint.balanceOf(user1), mintAmount);
        assertEq(ndiPoint.totalSupply(), 100_000_000 * 10 ** 18 + mintAmount);
    }

    function testMintingFailsWithoutRole() public {
        uint256 mintAmount = 1000 * 10 ** 18;

        vm.prank(user1);
        vm.expectRevert();
        ndiPoint.mint(user2, mintAmount);
    }

    function testMintingFailsAtMaxSupply() public {
        uint256 excessiveAmount = ndiPoint.maxSupply() + 1;

        vm.prank(minter);
        vm.expectRevert("NdiPoint: minting would exceed max supply");
        ndiPoint.mint(user1, excessiveAmount);
    }

    function testRewardDistribution() public {
        uint256 rewardAmount = 500 * 10 ** 18;
        string memory reason = "Staking rewards";

        vm.prank(rewardDistributor);
        vm.expectEmit(true, false, false, true);
        emit RewardDistributed(user1, rewardAmount, reason);
        ndiPoint.distributeReward(user1, rewardAmount, reason);

        assertEq(ndiPoint.balanceOf(user1), rewardAmount);
        assertGt(ndiPoint.getLastRewardClaim(user1), 0);
    }

    function testBatchRewardDistribution() public {
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = user2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 10 ** 18;
        amounts[1] = 200 * 10 ** 18;

        string memory reason = "Batch rewards";

        vm.prank(rewardDistributor);
        ndiPoint.distributeRewards(recipients, amounts, reason);

        assertEq(ndiPoint.balanceOf(user1), amounts[0]);
        assertEq(ndiPoint.balanceOf(user2), amounts[1]);
    }

    function testRewardDistributionFailsWithoutRole() public {
        uint256 rewardAmount = 500 * 10 ** 18;

        vm.prank(user1);
        vm.expectRevert();
        ndiPoint.distributeReward(user2, rewardAmount, "test");
    }

    function testBurning() public {
        uint256 burnAmount = 1000 * 10 ** 18;

        vm.startPrank(owner);
        ndiPoint.transfer(user1, burnAmount);
        vm.stopPrank();

        vm.prank(user1);
        ndiPoint.burn(burnAmount);

        assertEq(ndiPoint.balanceOf(user1), 0);
    }

    function testPausingAndUnpausing() public {
        uint256 transferAmount = 1000 * 10 ** 18;

        // Transfer should work normally
        vm.prank(owner);
        ndiPoint.transfer(user1, transferAmount);

        // Pause the contract
        vm.prank(pauser);
        ndiPoint.pause();

        // Transfer should fail when paused
        vm.prank(user1);
        vm.expectRevert();
        ndiPoint.transfer(user2, transferAmount);

        // Unpause the contract
        vm.prank(pauser);
        ndiPoint.unpause();

        // Transfer should work again
        vm.prank(user1);
        ndiPoint.transfer(user2, transferAmount);
        assertEq(ndiPoint.balanceOf(user2), transferAmount);
    }

    function testContractAuthorization() public {
        address testContract = makeAddr("testContract");

        assertFalse(ndiPoint.isAuthorizedContract(testContract));

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit ContractAuthorized(testContract, true);
        ndiPoint.setContractAuthorization(testContract, true);

        assertTrue(ndiPoint.isAuthorizedContract(testContract));

        vm.prank(owner);
        ndiPoint.setContractAuthorization(testContract, false);
        assertFalse(ndiPoint.isAuthorizedContract(testContract));
    }

    function testRemaiingSupply() public {
        uint256 expectedRemaining = ndiPoint.maxSupply() - ndiPoint.totalSupply();
        assertEq(ndiPoint.remainingSupply(), expectedRemaining);

        // Mint some tokens and check again
        uint256 mintAmount = 1000 * 10 ** 18;
        vm.prank(minter);
        ndiPoint.mint(user1, mintAmount);

        assertEq(ndiPoint.remainingSupply(), expectedRemaining - mintAmount);
    }

    function testPermitFunctionality() public {
        uint256 permitAmount = 1000 * 10 ** 18;
        uint256 deadline = block.timestamp + 1 hours;

        // This would require proper signature creation for a full test
        // For now, we just test that the permit function exists
        bytes32 domainSeparator = ndiPoint.DOMAIN_SEPARATOR();
        assertGt(uint256(domainSeparator), 0);
    }

    function testCannotMintToZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert("NdiPoint: cannot mint to zero address");
        ndiPoint.mint(address(0), 1000 * 10 ** 18);
    }

    function testCannotDistributeRewardToZeroAddress() public {
        vm.prank(rewardDistributor);
        vm.expectRevert("NdiPoint: cannot distribute to zero address");
        ndiPoint.distributeReward(address(0), 1000 * 10 ** 18, "test");
    }

    function testCannotDistributeZeroAmount() public {
        vm.prank(rewardDistributor);
        vm.expectRevert("NdiPoint: amount must be greater than zero");
        ndiPoint.distributeReward(user1, 0, "test");
    }

    function testBatchRewardArrayLengthMismatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = user2;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 10 ** 18;

        vm.prank(rewardDistributor);
        vm.expectRevert("NdiPoint: arrays length mismatch");
        ndiPoint.distributeRewards(recipients, amounts, "test");
    }

    function testCannotRecoverOwnTokens() public {
        vm.prank(owner);
        vm.expectRevert("NdiPoint: cannot recover own tokens");
        ndiPoint.recoverTokens(address(ndiPoint), owner, 1000);
    }

    function testTransferFunctionality() public {
        uint256 transferAmount = 1000 * 10 ** 18;

        vm.prank(owner);
        ndiPoint.transfer(user1, transferAmount);

        assertEq(ndiPoint.balanceOf(user1), transferAmount);
        assertEq(ndiPoint.balanceOf(owner), 100_000_000 * 10 ** 18 - transferAmount);
    }

    function testApproveAndTransferFrom() public {
        uint256 approveAmount = 1000 * 10 ** 18;
        uint256 transferAmount = 500 * 10 ** 18;

        // Owner approves user1 to spend tokens
        vm.prank(owner);
        ndiPoint.approve(user1, approveAmount);

        assertEq(ndiPoint.allowance(owner, user1), approveAmount);

        // User1 transfers from owner to user2
        vm.prank(user1);
        ndiPoint.transferFrom(owner, user2, transferAmount);

        assertEq(ndiPoint.balanceOf(user2), transferAmount);
        assertEq(ndiPoint.allowance(owner, user1), approveAmount - transferAmount);
    }
}
