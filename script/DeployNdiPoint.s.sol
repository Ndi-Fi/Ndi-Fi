// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/NdiPoint.sol";

/**
 * @title Deploy NdiPoint
 * @dev Deployment script for the NdiPoint ERC20 token
 */
contract DeployNdiPoint is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying NdiPoint with deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the NdiPoint contract
        NdiPoint ndiPoint = new NdiPoint(deployer);

        vm.stopBroadcast();

        console.log("NdiPoint deployed at:", address(ndiPoint));
        console.log("Token name:", ndiPoint.name());
        console.log("Token symbol:", ndiPoint.symbol());
        console.log("Total supply:", ndiPoint.totalSupply());
        console.log("Max supply:", ndiPoint.maxSupply());
        console.log("Deployer balance:", ndiPoint.balanceOf(deployer));

        // Log roles
        console.log("DEFAULT_ADMIN_ROLE granted to:", deployer);
        console.log("MINTER_ROLE granted to:", deployer);
        console.log("PAUSER_ROLE granted to:", deployer);
        console.log("REWARD_DISTRIBUTOR_ROLE granted to:", deployer);
    }
}
