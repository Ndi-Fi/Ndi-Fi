// PURPOSE OF THIS CONTRACT
// We want a library that:
// 1. Calculates Deposit fee (when staking or lending into the vault)
// 2. Calculates Withdrawal fees
// 3. Calculates Performance fees (on staking reward or lending yield)
// 4. Possibly include a penalty fee (for early withdrawals) 

// This way we don't hardcode logic in any contract. You just import feeLib and call it's functions. This makes upgrades and auditing easier

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

//Math Lbrary for fee calculation in staking/lending contract
//Fees are represented in basis points (bps) 10000 = 100%
library FeeLib {

    // This is a constant number = 10,000 to represent 100%
    // So, when we calculate percentage we divide by it
    uint256 internal constant BPS_DENOMINATOR = 10_000; //100%


    // This function says, if someone gives a fee bigger than 100% (10,000bps), don't allow it
    // Instead, return max 100%. clamp is a safety check 
    // Clamp is a computer/Math term, it means restricting a number within a range
    // If the fee is bigger than 10,000 bps (i.e., 100%), it automatically gets clamped (cut down) to 10,000.   
    function clampBps(uint256 bps) internal pure returns (uint16) {
        if (bps > BPS_DENOMINATOR) return uint16(BPS_DENOMINATOR);
        return uint16(bps);
    } 

    // Calculate fee from amount using bps
    // This one says: Take amount (like 100 tokens)
    // Take bps (like 500 bps = 5%), Multiply them, then divide by 10,000
    // That gives the fee
    function percentOf(uint256 amount, uint256 bps) internal pure returns (uint256) {
        if (amount == 0 || bps == 0) return 0;
        return (amount * bps) / BPS_DENOMINATOR;
    }

    // Apply deposit fee, return (fee, netAmount)
    function calcDeposit(uint256 assets, uint16 depositFeeBps) internal pure returns (uint256 fee, uint256 netAssets) {
        fee = percentOf(assets, depositFeeBps);
        unchecked { netAssets = assets - fee; }
    }

    // Apply withdrawal fee, return (fee, netPayout)
    function calcWithdrawal(uint256 assets, uint16 withdrawalFeeBps) internal pure returns (uint256 fee, uint256 payout) {
        fee = percentOf(assets, withdrawalFeeBps);
        unchecked { payout = assets - fee; }
    }

    // Apply performance fee on rewards, return (fee, netReward)
    function calcPerformance(uint256 reward, uint16 performanceFeeBps) internal pure returns (uint256 fee, uint256 netReward) {
        fee = percentOf(reward, performanceFeeBps);
        unchecked { netReward = reward - fee; }
    }

    // // Early withdrawal penalty that linearly decreases over time
    // function calcLinearPenalty(
    //     uint256 amount,
    //     uint256 start,
    //     uint256 minDuration,
    //     uint256 nowTs,
    //     uint16 maxPenaltyBps
    // ) internal pure returns (uint256 penalty) {
    //     if (minDuration == 0 || nowTs >= start + minDuration)
    // }
}