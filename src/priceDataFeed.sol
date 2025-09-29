// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from
    "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract PriceFeed {
    AggregatorV3Interface internal DaiPrice;
    AggregatorV3Interface internal ShibPrice;

    constructor() {
        DaiPrice = AggregatorV3Interface(0x773616E4d11A78F511299002da57A0a94577F1f4);
        ShibPrice = AggregatorV3Interface(0x8dD1CD88F43aF196ae478e91b9F5E4Ac69A97C61);
    }

    function getDaiLastestPrice() public view returns (int256) {
        (, int256 answer,,,) = DaiPrice.latestRoundData();
        return answer;
    }

    function getShibLastestPrice() public view returns (int256) {
        (, int256 answer,,,) = ShibPrice.latestRoundData();
        return answer;
    }
}
