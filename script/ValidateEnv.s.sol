// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";

/**
 * @title Environment Validation Script
 * @dev Validates environment variables before deployment
 *
 * Usage:
 * forge script script/ValidateEnv.s.sol:ValidateEnvScript --rpc-url <RPC_URL>
 */
contract ValidateEnvScript is Script {
    function run() public view {
        console.log("=== ENVIRONMENT VALIDATION ===");

        bool allValid = true;

        // Check if PRIVATE_KEY exists and is valid
        try vm.envString("PRIVATE_KEY") returns (string memory privateKeyStr) {
            console.log("[PASS] PRIVATE_KEY found in environment");

            // Check if it's a valid hex string
            if (bytes(privateKeyStr).length == 0) {
                console.log("[FAIL] PRIVATE_KEY is empty");
                allValid = false;
            } else if (
                bytes(privateKeyStr).length != 64 &&
                bytes(privateKeyStr).length != 66
            ) {
                console.log(
                    "[FAIL] PRIVATE_KEY has invalid length. Expected 64 chars (without 0x) or 66 chars (with 0x)"
                );
                console.log("  Current length:", bytes(privateKeyStr).length);
                allValid = false;
            } else {
                // Check if it starts with 0x
                bool hasPrefix = bytes(privateKeyStr).length == 66 &&
                    bytes(privateKeyStr)[0] == 0x30 &&
                    bytes(privateKeyStr)[1] == 0x78;

                if (!hasPrefix && bytes(privateKeyStr).length == 64) {
                    console.log("[FAIL] PRIVATE_KEY missing '0x' prefix");
                    console.log(
                        "  Please add '0x' prefix to your private key in .env file"
                    );
                    allValid = false;
                } else if (hasPrefix) {
                    console.log("[PASS] PRIVATE_KEY format is valid");

                    // Try to parse as uint256
                    try vm.envUint("PRIVATE_KEY") returns (uint256) {
                        console.log("[PASS] PRIVATE_KEY can be parsed as uint256");
                    } catch {
                        console.log("[FAIL] PRIVATE_KEY cannot be parsed as uint256");
                        console.log(
                            "  Check for invalid characters (only 0-9, a-f, A-F allowed)"
                        );
                        allValid = false;
                    }
                } else {
                    console.log("[PASS] PRIVATE_KEY format appears valid");
                }
            }
        } catch {
            console.log("[FAIL] PRIVATE_KEY not found in environment");
            console.log("  Please create a .env file with PRIVATE_KEY=0x...");
            allValid = false;
        }

        // Check chain support
        uint256 chainId = block.chainid;
        console.log("Current Chain ID:", chainId);

        uint32 lzEid = _getLzEid(chainId);
        if (lzEid == 0) {
            console.log("[FAIL] Current chain not supported by LayerZero");
            console.log(
                "  Supported chains: 1, 137, 56, 42161, 10, 8453, 11155111, 80001, 97, 421614, 11155420, 84532"
            );
            allValid = false;
        } else {
            console.log("[PASS] Chain supported - LayerZero EID:", lzEid);
        }

        // Check if deployment would succeed
        if (allValid) {
            console.log("\n=== VALIDATION RESULT ===");
            console.log("[PASS] All validations passed!");
            console.log("[PASS] Ready for deployment");

            // Show deployer address
            try vm.envUint("PRIVATE_KEY") returns (uint256 privateKey) {
                address deployer = vm.addr(privateKey);
                console.log("[INFO] Deployer address:", deployer);
                console.log(
                    "  Make sure this address has sufficient funds for deployment"
                );
            } catch {}
        } else {
            console.log("\n=== VALIDATION RESULT ===");
            console.log("[FAIL] Validation failed!");
            console.log("[FAIL] Please fix the issues above before deployment");
        }
    }

    function _getLzEid(uint256 chainId) internal pure returns (uint32) {
        if (chainId == 1) return 30101; // Ethereum Mainnet
        if (chainId == 137) return 30109; // Polygon
        if (chainId == 56) return 30102; // BSC
        if (chainId == 42161) return 30110; // Arbitrum
        if (chainId == 10) return 30111; // Optimism
        if (chainId == 8453) return 30184; // Base
        if (chainId == 11155111) return 40161; // Sepolia
        if (chainId == 80001) return 40109; // Mumbai
        if (chainId == 97) return 40102; // BSC Testnet
        if (chainId == 421614) return 40231; // Arbitrum Sepolia
        if (chainId == 11155420) return 40232; // Optimism Sepolia
        if (chainId == 84532) return 40245; // Base Sepolia
        return 0;
    }
}
