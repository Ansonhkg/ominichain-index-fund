import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("⏰ Fixing rebalance time constraints...\n");

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

  try {
    // Check current rebalance settings
    const rebalanceInfo = await indexVault.getRebalanceInfo();
    console.log("📊 Current Rebalance Settings:");
    console.log(`Should Rebalance: ${rebalanceInfo.shouldRebalanceNow}`);
    console.log(`Time Since Last: ${rebalanceInfo.timeSinceLastRebalance} seconds`);
    
    // Check rebalance interval (it's likely 1 hour = 3600 seconds)
    console.log("\n⏱️  Setting rebalance interval to 0 (allow immediate rebalancing)...");
    const tx1 = await indexVault.setRebalanceInterval(0);
    await tx1.wait();
    console.log("✅ Rebalance interval set to 0");

    // Check if rebalancing is now allowed
    const shouldRebalanceNow = await indexVault.shouldRebalance();
    console.log(`\n🔍 Should Rebalance Now: ${shouldRebalanceNow}`);

    if (shouldRebalanceNow) {
      console.log("\n⚖️  Executing rebalance...");
      const tx2 = await indexVault.rebalance();
      const receipt = await tx2.wait();
      console.log(`✅ Rebalance executed! TX: ${receipt.hash}`);

      // Check results
      console.log("\n📊 After Rebalance:");
      const ethBalance = await indexVault.ethBalance();
      const usdcBalance = await indexVault.usdcBalance();
      console.log(`ETH: ${ethers.formatEther(ethBalance)} ETH`);
      console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

      if (ethBalance > 0n) {
        console.log("\n🎉 Success! ETH was purchased through Uniswap!");
      } else {
        console.log("\n⚠️  No ETH purchased - might be a Uniswap liquidity issue on testnet");
      }
    } else {
      console.log("\n❌ Still can't rebalance - checking other conditions...");
      
      // Manual calculation
      const totalValue = await indexVault.getPortfolioValue();
      const usdcBalance = await indexVault.usdcBalance();
      const currentUsdcPercent = (usdcBalance * 100n) / totalValue;
      
      console.log(`Current USDC: ${currentUsdcPercent}% (target: 30%)`);
      console.log(`Deviation: ${currentUsdcPercent - 30n}%`);
      console.log("REBALANCE_THRESHOLD: 5%");
      
      if (currentUsdcPercent - 30n > 5n) {
        console.log("✅ Deviation > threshold, should rebalance");
      } else {
        console.log("❌ Deviation <= threshold, won't rebalance");
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    
    if (error.message.includes("Ownable")) {
      console.log("💡 Only the contract owner can change rebalance settings");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });