import { ethers, network } from "hardhat";
import { getNetworkAddresses } from "../config/addresses";

async function main() {
  console.log("🧪 Testing Base configuration...");
  
  try {
    // Test network configuration
    console.log("Current network:", network.name);
    console.log("Network config:", network.config);
    
    // Test address configuration
    const addresses = getNetworkAddresses("baseSepolia");
    console.log("✅ Base Sepolia addresses loaded:", {
      chainId: addresses.chainId,
      usdc: addresses.usdc,
      weth: addresses.weth,
      layerZeroEndpoint: addresses.layerZeroEndpoint,
      swapRouter: addresses.uniswapV3.swapRouter,
      quoterV2: addresses.uniswapV3.quoterV2
    });
    
    // Test signer
    const [signer] = await ethers.getSigners();
    console.log("✅ Signer address:", signer.address);
    
    // Test if we can check balances (connectivity test)
    const balance = await ethers.provider.getBalance(signer.address);
    console.log("✅ Account balance:", ethers.formatEther(balance), "ETH");
    
    console.log("🎉 Configuration test passed! Ready for deployment.");
    
  } catch (error) {
    console.error("❌ Configuration test failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });