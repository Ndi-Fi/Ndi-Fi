// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {NdiStaking} from "../src/NdiFiStaking.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";

contract MockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockVault is ERC4626 {
    constructor(IERC20 asset) ERC20("MockVault", "MVLT") ERC4626(asset) {}
}

contract TestStakingSetup {
    MockToken public stakeToken;
    MockToken public rewardToken;
    MockVault public vault;
    NdiStaking public staking;

    constructor() {
    
        stakeToken = new MockToken("StakeToken", "STK");
        rewardToken = new MockToken("RewardToken", "RWD");

       
        stakeToken.mint(msg.sender, 1_000_000 ether);
        rewardToken.mint(address(this), 1_000_000 ether);

       
        vault = new MockVault(stakeToken);

       
        staking = new NdiStaking(
            address(stakeToken),
            address(rewardToken),
            address(vault),
            msg.sender,       
            1000,            
            1 ether,          
            1000 ether,       
            1 days            
        );

       
        stakeToken.approve(address(vault), type(uint256).max);
    }
}
