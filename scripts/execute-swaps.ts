import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("💱 Executing portfolio swaps on Base Sepolia...\n");

  // Load deployment data
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => f.includes("baseSepolia"));
  if (deploymentFiles.length === 0) {
    console.error("❌ No Base Sepolia deployment found");
    process.exit(1);
  }

  const latestFile = deploymentFiles.sort().pop()!;
  const deployment = JSON.parse(fs.readFileSync(`./deployments/${latestFile}`, "utf8"));

  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);

  // Get contracts
  const indexVault = await ethers.getContractAt("IndexVaultV2", deployment.contracts.IndexVaultV2);
  const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);

  // Get current state
  console.log("📊 Current Portfolio:");
  const ethBalance = await indexVault.ethBalance();
  const usdcBalance = await indexVault.usdcBalance();
  const totalValue = await indexVault.getPortfolioValue();
  
  console.log(`Total Value: $${ethers.formatUnits(totalValue, 6)}`);
  console.log(`ETH: ${ethers.formatEther(ethBalance)} ETH`);
  console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  // Get prices
  const ethPrice = await priceOracle.getPrice("ETH");
  console.log(`\n💰 ETH Price: $${ethers.formatUnits(ethPrice, 18)}`);

  // Calculate target allocations
  const targetEthValue = (totalValue * 40n) / 100n; // 40% ETH
  const targetUsdcValue = (totalValue * 60n) / 100n; // 60% USDC (30% + 30% FLOW)
  
  console.log("\n🎯 Target Allocations:");
  console.log(`ETH: $${ethers.formatUnits(targetEthValue, 6)} (40%)`);
  console.log(`USDC: $${ethers.formatUnits(targetUsdcValue, 6)} (60%)`);

  // Since we have 100% USDC, we need to buy ETH
  const usdcToSwap = targetEthValue; // Need to spend this much USDC for ETH
  
  if (usdcToSwap > usdcBalance) {
    console.log("\n⚠️  Not enough USDC to reach target allocation");
    console.log(`Need: $${ethers.formatUnits(usdcToSwap, 6)} USDC`);
    console.log(`Have: $${ethers.formatUnits(usdcBalance, 6)} USDC`);
    return;
  }

  console.log(`\n🔄 Swapping ${ethers.formatUnits(usdcToSwap, 6)} USDC for ETH...`);

  // Manual swap execution (since rebalance might not trigger due to threshold)
  try {
    // First, let's try calling rebalance
    const shouldRebalance = await indexVault.shouldRebalance();
    console.log(`Should rebalance: ${shouldRebalance}`);

    if (!shouldRebalance) {
      console.log("\n⚠️  Rebalance threshold not met (needs >5% deviation)");
      console.log("With only $1, the deviation might not be significant enough");
      console.log("\n💡 Options:");
      console.log("1. Deposit more funds to make rebalancing worthwhile");
      console.log("2. Manually execute swaps through the vault owner");
      console.log("3. Adjust rebalance threshold in the contract");
    } else {
      console.log("\n⚖️  Executing rebalance...");
      const tx = await indexVault.rebalance();
      const receipt = await tx.wait();
      console.log(`✅ Rebalance executed! TX: ${receipt.hash}`);

      // Check new balances
      const newEthBalance = await indexVault.ethBalance();
      const newUsdcBalance = await indexVault.usdcBalance();
      
      console.log("\n📊 New Portfolio:");
      console.log(`ETH: ${ethers.formatEther(newEthBalance)} ETH`);
      console.log(`USDC: ${ethers.formatUnits(newUsdcBalance, 6)} USDC`);
    }

  } catch (error: any) {
    console.error("\n❌ Swap failed:", error.message);
    
    if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
      console.log("\n💡 The Uniswap pool might not have enough liquidity on testnet");
      console.log("Consider:");
      console.log("1. Using a different DEX");
      console.log("2. Providing liquidity to the pool");
      console.log("3. Testing on mainnet fork");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });