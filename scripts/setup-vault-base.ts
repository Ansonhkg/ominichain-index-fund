import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔧 Setting up IndexVaultV2 for swapping...\n");

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

  // Get contract instance
  const indexVault = await ethers.getContractAt("IndexVaultV2", deployment.contracts.IndexVaultV2);

  // On Base, FLOW token might not exist, so we'll skip it for now
  // In production, you'd set the actual FLOW token address when available
  console.log("ℹ️  FLOW token not available on Base Sepolia");
  console.log("ℹ️  Portfolio will rebalance between ETH (40%) and USDC (60%)\n");

  // Check current state
  console.log("📊 Current Portfolio State:");
  const ethBalance = await indexVault.ethBalance();
  const usdcBalance = await indexVault.usdcBalance();
  const flowBalance = await indexVault.flowBalance();
  
  console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
  console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  console.log(`FLOW Balance: ${ethers.formatEther(flowBalance)} FLOW`);

  // Check if we should rebalance
  const shouldRebalance = await indexVault.shouldRebalance();
  console.log(`\n⚖️  Should Rebalance: ${shouldRebalance ? "Yes" : "No"}`);

  if (!shouldRebalance) {
    console.log("\n💡 To force a rebalance:");
    console.log("1. The portfolio needs significant funds");
    console.log("2. Current allocation must deviate >5% from targets");
    console.log("3. Or enough time must pass since last rebalance");
    
    // Force rebalance by updating the interval
    console.log("\n🔄 Setting rebalance interval to 0 to allow immediate rebalancing...");
    const tx = await indexVault.setRebalanceInterval(0);
    await tx.wait();
    console.log("✅ Rebalance interval updated");
  }

  console.log("\n✅ Vault setup complete!");
  console.log("\nNext steps:");
  console.log("1. Deposit more USDC to increase portfolio value");
  console.log("2. Run 'bun run rebalance:base' to execute swaps");
  console.log("3. Check portfolio with 'bun run portfolio:base'");
}