import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("⚖️  Triggering portfolio rebalance...");

  // Load deployment data
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => f.endsWith(".json"));
  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment files found. Deploy contracts first with: bun run deploy:flow");
    process.exit(1);
  }

  const latestFile = deploymentFiles.sort().pop()!;
  const deployment = JSON.parse(fs.readFileSync(`./deployments/${latestFile}`, "utf8"));

  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);

  const indexVault = await ethers.getContractAt("IndexVault", deployment.contracts.IndexVault);

  console.log("\n📊 Pre-rebalance status:");
  try {
    const ethBalance = await indexVault.ethBalance();
    const usdcBalance = await indexVault.usdcBalance();
    const flowBalance = await indexVault.flowBalance();
    const portfolioValue = await indexVault.getPortfolioValue();

    console.log(`ETH:  ${ethers.formatUnits(ethBalance, 18)}`);
    console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`FLOW: ${ethers.formatUnits(flowBalance, 18)}`);
    console.log(`Total Value: $${ethers.formatUnits(portfolioValue, 6)}`);
  } catch (error) {
    console.log("⚠️  Could not fetch portfolio status (prices might be stale)");
  }

  console.log("\n🎯 Target allocations:");
  console.log("ETH:  40%");
  console.log("USDC: 30%");
  console.log("FLOW: 30%");

  console.log("\n⚖️  Executing rebalance...");
  try {
    const tx = await indexVault.rebalance();
    await tx.wait();
    console.log("✅ Rebalance transaction completed!");
    console.log("Transaction hash:", tx.hash);
  } catch (error) {
    console.error("❌ Rebalance failed:", error);
    process.exit(1);
  }

  console.log("\n📈 Post-rebalance status:");
  console.log("ℹ️  In MVP, rebalancing logic calculates targets but doesn't execute swaps yet");
  console.log("🚀 Production version will integrate with DEXs for automatic swapping");

  console.log("\n✅ Rebalance complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });