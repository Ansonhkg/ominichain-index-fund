// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {IndexFundToken} from "../src/IndexFundToken.sol";

/**
 * @title IndexFundToken Deployment Script
 * @dev Deploys IndexFundToken with proper LayerZero configuration for different networks
 * 
 * Usage:
 * forge script script/IndexFundToken.s.sol:IndexFundTokenScript --rpc-url <RPC_URL> --broadcast --verify
 * 
 * Networks supported:
 * - Ethereum Mainnet (LayerZero EID: 30101)
 * - Polygon (LayerZero EID: 30109)
 * - BSC (LayerZero EID: 30102)
 * - Arbitrum (LayerZero EID: 30110)
 * - Optimism (LayerZero EID: 30111)
 * - Base (LayerZero EID: 30184)
 */
contract IndexFundTokenScript is Script {
    IndexFundToken public indexFundToken;
    
    // LayerZero V2 Endpoint addresses (same across all chains)
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // LayerZero Chain IDs (EndpointV2 IDs)
    mapping(uint256 => uint32) public chainIdToLzEid;
    mapping(string => uint256) public networkNameToChainId;
    
    function setUp() public {
        // Map chain IDs to LayerZero Endpoint IDs
        chainIdToLzEid[1] = 30101;      // Ethereum Mainnet
        chainIdToLzEid[137] = 30109;    // Polygon
        chainIdToLzEid[56] = 30102;     // BSC
        chainIdToLzEid[42161] = 30110;  // Arbitrum
        chainIdToLzEid[10] = 30111;     // Optimism
        chainIdToLzEid[8453] = 30184;   // Base
        
        // For testnets
        chainIdToLzEid[11155111] = 40161; // Sepolia
        chainIdToLzEid[80001] = 40109;    // Mumbai
        chainIdToLzEid[97] = 40102;       // BSC Testnet
        chainIdToLzEid[421614] = 40231;   // Arbitrum Sepolia
        chainIdToLzEid[11155420] = 40232; // Optimism Sepolia
        chainIdToLzEid[84532] = 40245;    // Base Sepolia
        
        // Network names for easier reference
        networkNameToChainId["mainnet"] = 1;
        networkNameToChainId["polygon"] = 137;
        networkNameToChainId["bsc"] = 56;
        networkNameToChainId["arbitrum"] = 42161;
        networkNameToChainId["optimism"] = 10;
        networkNameToChainId["base"] = 8453;
        networkNameToChainId["sepolia"] = 11155111;
        networkNameToChainId["mumbai"] = 80001;
        networkNameToChainId["bsc-testnet"] = 97;
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying IndexFundToken...");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        
        // Get LayerZero Endpoint ID for current chain
        uint32 currentLzEid = chainIdToLzEid[block.chainid];
        require(currentLzEid != 0, "Unsupported chain");
        
        console.log("LayerZero Endpoint ID:", currentLzEid);
        console.log("LayerZero Endpoint Address:", LZ_ENDPOINT);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the IndexFundToken
        indexFundToken = new IndexFundToken(
            "OmniFund Index Token",  // name
            "OMNI",                  // symbol
            LZ_ENDPOINT,             // LayerZero V2 endpoint
            deployer,                // delegate (owner)
            currentLzEid             // current chain LayerZero EID
        );

        console.log("IndexFundToken deployed at:", address(indexFundToken));
        
        // Initialize with some sample assets if this is the first deployment
        _initializeSamplePortfolio();
        
        vm.stopBroadcast();
        
        // Log deployment info
        _logDeploymentInfo();
    }
    
    /**
     * @dev Initialize the fund with sample assets (only for demo/testing)
     */
    function _initializeSamplePortfolio() internal {
        console.log("Initializing sample portfolio...");
        
        // Example assets with mock addresses (replace with real token addresses)
        address weth = _getMockTokenAddress("WETH");
        address wbtc = _getMockTokenAddress("WBTC");
        address dai = _getMockTokenAddress("DAI");
        
        // Add sample assets with target allocations
        try indexFundToken.addAsset("WETH", weth, 4000) { // 40%
            console.log("Added WETH with 40% allocation");
        } catch {
            console.log("WETH already exists or error occurred");
        }
        
        try indexFundToken.addAsset("WBTC", wbtc, 3000) { // 30%
            console.log("Added WBTC with 30% allocation");
        } catch {
            console.log("WBTC already exists or error occurred");
        }
        
        try indexFundToken.addAsset("DAI", dai, 3000) { // 30%
            console.log("Added DAI with 30% allocation");
        } catch {
            console.log("DAI already exists or error occurred");
        }
        
        // Set initial portfolio value
        try indexFundToken.updatePortfolioValue(1000000 * 1e18) { // $1M USD
            console.log("Set initial portfolio value to $1M");
        } catch {
            console.log("Error setting portfolio value");
        }
    }
    
    /**
     * @dev Get mock token address for testing (replace with real addresses)
     */
    function _getMockTokenAddress(string memory symbol) internal view returns (address) {
        // On mainnet, use real token addresses
        if (block.chainid == 1) { // Ethereum Mainnet
            if (keccak256(bytes(symbol)) == keccak256(bytes("WETH"))) {
                return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
            } else if (keccak256(bytes(symbol)) == keccak256(bytes("WBTC"))) {
                return 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
            } else if (keccak256(bytes(symbol)) == keccak256(bytes("DAI"))) {
                return 0x6B175474E89094C44Da98b954EedeAC495271d0F;
            }
        }
        
        // For other chains or testnets, generate deterministic mock addresses
        return address(uint160(uint256(keccak256(abi.encodePacked(symbol, block.chainid)))));
    }
    
    /**
     * @dev Log important deployment information
     */
    function _logDeploymentInfo() internal view {
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("Contract Address:", address(indexFundToken));
        console.log("Owner:", indexFundToken.owner());
        console.log("Current Chain LZ EID:", indexFundToken.CURRENT_CHAIN());
        console.log("Asset Count:", indexFundToken.getAssetCount());
        
        (,, IndexFundToken.PortfolioState memory state) = indexFundToken.getPortfolioInfo();
        console.log("Portfolio Value:", state.totalValue);
        console.log("Portfolio Nonce:", state.nonce);
        
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Deploy to other chains using the same script");
        console.log("2. Configure cross-chain connections:");
        console.log("   - addSupportedChain(chainId)");
        console.log("   - setTrustedRemote(chainId, remoteAddress)");
        console.log("3. Test cross-chain synchronisation");
        
        console.log("\n=== LAYER ZERO CONFIGURATION ===");
        console.log("To connect this contract to other chains:");
        console.log("1. Deploy on target chains");
        console.log("2. Call addSupportedChain(targetChainLzEid)");
        console.log("3. Call setTrustedRemote(targetChainLzEid, abi.encodePacked(remoteAddress))");
        
        console.log("\n=== SUPPORTED CHAIN IDs ===");
        console.log("Ethereum Mainnet: 30101");
        console.log("Polygon: 30109");
        console.log("BSC: 30102");
        console.log("Arbitrum: 30110");
        console.log("Optimism: 30111");
        console.log("Base: 30184");
    }
}

/**
 * @title Multi-Chain Configuration Script
 * @dev Helper script to configure cross-chain connections after deployment
 */
contract ConfigureIndexFundScript is Script {
    IndexFundToken public indexFundToken;
    
    function run() public {
        address contractAddress = vm.envAddress("CONTRACT_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        indexFundToken = IndexFundToken(contractAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Add supported chains (modify as needed)
        _configureSupportedChains();
        
        vm.stopBroadcast();
    }
    
    function _configureSupportedChains() internal {
        uint32 currentChain = indexFundToken.CURRENT_CHAIN();
        
        // Example: Add other chains (modify based on your deployment)
        uint32[] memory targetChains = new uint32[](5);
        targetChains[0] = 30101; // Ethereum
        targetChains[1] = 30109; // Polygon
        targetChains[2] = 30102; // BSC
        targetChains[3] = 30110; // Arbitrum
        targetChains[4] = 30184; // Base
        
        for (uint i = 0; i < targetChains.length; i++) {
            if (targetChains[i] != currentChain) {
                try indexFundToken.addSupportedChain(targetChains[i]) {
                    console.log("Added supported chain:", targetChains[i]);
                } catch {
                    console.log("Chain already supported or error:", targetChains[i]);
                }
            }
        }
    }
}
