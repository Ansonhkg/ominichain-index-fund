import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("📊 Portfolio Status Report");
  console.log("=".repeat(50));

  // Load deployment data
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => f.includes("baseSepolia"));
  if (deploymentFiles.length === 0) {
    console.error("❌ No Base Sepolia deployment found");
    process.exit(1);
  }

  const latestFile = deploymentFiles.sort().pop()!;
  const deployment = JSON.parse(fs.readFileSync(`./deployments/${latestFile}`, "utf8"));

  // Get contract instances
  const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);
  const indexToken = await ethers.getContractAt("IndexToken", deployment.contracts.IndexToken);
  const indexVault = await ethers.getContractAt("IndexVaultV2", deployment.contracts.IndexVaultV2);

  try {
    console.log("\n💰 Current Asset Prices:");
    const ethPrice = await priceOracle.getPrice("ETH");
    const flowPrice = await priceOracle.getPrice("FLOW");
    console.log(`ETH:  $${ethers.formatUnits(ethPrice, 18)}`);
    console.log(`FLOW: $${ethers.formatUnits(flowPrice, 18)}`);
    console.log(`USDC: $1.00 (stablecoin)`);

    console.log("\n🏦 Portfolio Overview:");
    const totalSupply = await indexToken.totalSupply();
    const portfolioValue = await indexVault.getPortfolioValue();
    
    console.log(`INDEX Supply:     ${ethers.formatUnits(totalSupply, 18)} INDEX`);
    console.log(`Portfolio Value:  $${ethers.formatUnits(portfolioValue, 6)}`);
    
    if (totalSupply > 0n) {
      const pricePerIndex = (portfolioValue * ethers.parseUnits("1", 12)) / totalSupply;
      console.log(`Price per INDEX:  $${ethers.formatUnits(pricePerIndex, 6)}`);
    }

    // Get vault balances
    const ethBalance = await indexVault.ethBalance();
    const usdcBalance = await indexVault.usdcBalance();
    const flowBalance = await indexVault.flowBalance();

    console.log("\n📈 Asset Allocation:");
    console.log(`ETH Balance:  ${ethers.formatEther(ethBalance)} ETH`);
    console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    console.log(`FLOW Balance: ${ethers.formatEther(flowBalance)} FLOW`);

    if (portfolioValue > 0n) {
      const ethValue = (ethBalance * ethPrice) / ethers.parseUnits("1", 18);
      const flowValue = (flowBalance * flowPrice) / ethers.parseUnits("1", 18);
      
      const ethPercent = (ethValue * 100n) / portfolioValue;
      const usdcPercent = (usdcBalance * 100n) / portfolioValue;
      const flowPercent = (flowValue * 100n) / portfolioValue;

      console.log("\n📊 Current Allocations:");
      console.log(`ETH:  ${ethPercent}% (target: 40%)`);
      console.log(`USDC: ${usdcPercent}% (target: 30%)`);
      console.log(`FLOW: ${flowPercent}% (target: 30%)`);
    }

    // Check rebalance status
    const rebalanceInfo = await indexVault.getRebalanceInfo();
    console.log("\n⚖️ Rebalance Status:");
    console.log(`Should Rebalance: ${rebalanceInfo.shouldRebalanceNow ? "Yes ⚠️" : "No ✅"}`);
    console.log(`Time Since Last: ${rebalanceInfo.timeSinceLastRebalance} seconds`);

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });