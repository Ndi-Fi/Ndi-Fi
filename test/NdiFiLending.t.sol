// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NdiFiLending} from "../src/NdiFiLending.sol";
import {NdiFiVault} from "../src/NdiFiVault.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from
    "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// Mock ERC20
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 d) ERC20(name, symbol) {
        _decimals = d;
        _mint(msg.sender, 1_000_000 ether);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

/// Mock price feed (Chainlink)
contract MockPriceFeed is AggregatorV3Interface {
    int256 public answer;

    constructor(int256 _answer) {
        answer = _answer;
    }

    function setAnswer(int256 _newAnswer) external {
        answer = _newAnswer;
    }

    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (0, answer, 0, 0, 0);
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "mock";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external pure returns (uint80, int256, uint256, uint256, uint80) {
        return (0, 0, 0, 0, 0);
    }
}

contract NdiFiLendingTest is Test {
    NdiFiLending lending;
    NdiFiVault vault;
    MockERC20 dai; // DAI as lending token
    MockERC20 weth; // Collateral 1
    MockERC20 usdc; // Collateral 2
    MockPriceFeed daiFeed;
    MockPriceFeed wethFeed;
    MockPriceFeed usdcFeed;

    address user = makeAddr("user");
    address owner = address(this);

    function setUp() public {
        // Deploy tokens
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // Deploy vault with DAI
        vault = new NdiFiVault(address(dai), owner);
        vm.prank(owner);

        // Price feeds (Chainlink-style, 8 decimals)
        daiFeed = new MockPriceFeed(1e8); // $1
        wethFeed = new MockPriceFeed(2000e8); // $2000
        usdcFeed = new MockPriceFeed(1e8); // $1

        // Deploy lending contract with DAI as lending token
        lending = new NdiFiLending(IERC20(address(dai)), vault, AggregatorV3Interface(address(daiFeed)));

        // Owner adds supported collateral tokens
        lending.addCollateralToken(address(weth), address(wethFeed));
        lending.addCollateralToken(address(usdc), address(usdcFeed));
        vault.setAuthorizedLendingContract(address(lending));

        // Fund vault with DAI liquidity
        dai.mint(address(vault), 500_000 * 1e18);

        // Initialize parameters
        lending.initialize(
            75, // collateral factor
            85, // liquidation threshold
            50, // origination fee = 0.5%
            500 // liquidation penalty = 5%
        );

        // Give user collateral
        weth.mint(user, 10 ether); // worth ~$20,000
        usdc.mint(user, 10_000e6); // worth ~$10,000

        // Approvals
        vm.startPrank(user);
        weth.approve(address(lending), type(uint256).max);
        usdc.approve(address(lending), type(uint256).max);
        dai.approve(address(lending), type(uint256).max);
        vm.stopPrank();
    }

    function testDepositCollateralAndBorrowDAI() public {
        vm.startPrank(user);
        lending.depositCollateral(address(weth), 5 ether); // ~$10,000 collateral
        lending.depositCollateral(address(usdc), 5000e6); // ~$5,000 collateral

        // Try borrowing 10k DAI -> should pass
        lending.takeLoan(10_000 ether);

        (uint256 principal,, uint256 totalDebt,, uint256 healthFactor, bool active) = lending.getLoanDetails(user);
        assertEq(principal, 10_000 ether);
        assertTrue(active);
        assertGt(healthFactor, 100);
        vm.stopPrank();
    }

    function testRepayLoan() public {
        vm.startPrank(user);
        lending.depositCollateral(address(weth), 1 ether);
        lending.takeLoan(1000 ether);

        (,, uint256 totalDebt,,,) = lending.getLoanDetails(user);
        dai.mint(user, totalDebt);

        lending.repayLoan(totalDebt);

        (,,,,, bool active) = lending.getLoanDetails(user);
        assertFalse(active);
        vm.stopPrank();
    }

    // function testLiquidationAfterPriceDrop() public {
    //     vm.startPrank(user);
    //     lending.depositCollateral(address(weth), 1 ether); // $2000 collateral
    //     lending.takeLoan(1500 ether); // Borrow ~ $1500
    //     dai.approve(address(lending), type(uint256).max);
    //     vm.stopPrank();

    //     // Drop WETH price drastically
    //     wethFeed.setAnswer(500e8); // $500

    //     // Liquidation should be possible now
    //     uint256 preBal = weth.balanceOf(address(this));
    //     lending.liquidateLoan(user);
    //     uint256 postBal = weth.balanceOf(address(this));

    //     assertGt(postBal, preBal);
    // }
}
