import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔍 Debugging rebalance conditions...\n");

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

  try {
    // Check all conditions step by step
    console.log("📊 Portfolio Analysis:");
    
    const ethBalance = await indexVault.ethBalance();
    const usdcBalance = await indexVault.usdcBalance();
    const flowBalance = await indexVault.flowBalance();
    
    console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
    console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    console.log(`FLOW Balance: ${ethers.formatEther(flowBalance)} FLOW`);

    const portfolioValue = await indexVault.getPortfolioValue();
    console.log(`\n💰 Portfolio Value: $${ethers.formatUnits(portfolioValue, 6)}`);

    if (portfolioValue === 0n) {
      console.log("❌ Portfolio value is 0 - this will cause rebalance to revert");
      return;
    }

    // Check prices
    console.log("\n💹 Asset Prices:");
    const ethPrice = await priceOracle.getPrice("ETH");
    const flowPrice = await priceOracle.getPrice("FLOW");
    console.log(`ETH: $${ethers.formatUnits(ethPrice, 18)}`);
    console.log(`FLOW: $${ethers.formatUnits(flowPrice, 18)}`);

    // Check allocations
    const ethValue = (ethBalance * ethPrice) / ethers.parseUnits("1", 18);
    const flowValue = (flowBalance * flowPrice) / ethers.parseUnits("1", 18);
    
    console.log("\n📊 Current Values:");
    console.log(`ETH Value: $${ethers.formatUnits(ethValue, 6)}`);
    console.log(`USDC Value: $${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`FLOW Value: $${ethers.formatUnits(flowValue, 6)}`);

    // Calculate percentages
    const ethPercent = portfolioValue > 0n ? (ethValue * 100n) / portfolioValue : 0n;
    const usdcPercent = portfolioValue > 0n ? (usdcBalance * 100n) / portfolioValue : 0n;
    const flowPercent = portfolioValue > 0n ? (flowValue * 100n) / portfolioValue : 0n;

    console.log("\n📈 Current Allocations:");
    console.log(`ETH: ${ethPercent}% (target: 40%)`);
    console.log(`USDC: ${usdcPercent}% (target: 30%)`);
    console.log(`FLOW: ${flowPercent}% (target: 30%)`);

    // Check rebalance conditions
    const rebalanceInfo = await indexVault.getRebalanceInfo();
    console.log("\n⚖️  Rebalance Info:");
    console.log(`Should Rebalance: ${rebalanceInfo.shouldRebalanceNow}`);
    console.log(`Time Since Last: ${rebalanceInfo.timeSinceLastRebalance} seconds`);
    console.log(`Total Portfolio Value: $${ethers.formatUnits(rebalanceInfo.totalValue, 6)}`);

    // Calculate target values
    const targetEthValue = (portfolioValue * 40n) / 100n;
    const targetUsdcValue = (portfolioValue * 30n) / 100n;
    const targetFlowValue = (portfolioValue * 30n) / 100n;

    console.log("\n🎯 Target Values:");
    console.log(`ETH Target: $${ethers.formatUnits(targetEthValue, 6)}`);
    console.log(`USDC Target: $${ethers.formatUnits(targetUsdcValue, 6)}`);
    console.log(`FLOW Target: $${ethers.formatUnits(targetFlowValue, 6)}`);

    // Check what swaps would be needed
    console.log("\n🔄 Required Actions:");
    if (ethValue < targetEthValue) {
      const usdcToSpend = targetEthValue - ethValue;
      console.log(`Buy ETH: Spend $${ethers.formatUnits(usdcToSpend, 6)} USDC`);
    }
    if (ethValue > targetEthValue) {
      const ethToSell = (ethValue - targetEthValue) * ethers.parseUnits("1", 18) / ethPrice;
      console.log(`Sell ETH: ${ethers.formatEther(ethToSell)} ETH`);
    }

    // Check if we have enough funds for swaps
    const usdcNeeded = targetEthValue > ethValue ? targetEthValue - ethValue : 0n;
    if (usdcNeeded > usdcBalance) {
      console.log(`⚠️  Need $${ethers.formatUnits(usdcNeeded, 6)} USDC but only have $${ethers.formatUnits(usdcBalance, 6)}`);
    }

  } catch (error: any) {
    console.error("❌ Error analyzing portfolio:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });