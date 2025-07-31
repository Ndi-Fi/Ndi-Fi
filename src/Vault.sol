// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract Vault is Ownable {
    ERC20 public immutable token;

    constructor(address _token) Ownable (msg.sender) {
        token = ERC20(_token);
    }

    function depositFrom(address from, uint256 amount) external onlyOwner {
        require(token.transferFrom(from, address(this), amount), "Transfer failed");
    }

    function releaseTo(address to, uint256 amount) external onlyOwner {
        require(token.transfer(to, amount), "Vault release failed");
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(token.transfer(to, amount), "Emergency withdrawal failed");
    }
}
