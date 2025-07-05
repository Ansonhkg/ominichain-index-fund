import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("⚡ Force executing rebalance for testing...\n");

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

  console.log("📊 Before rebalance:");
  const ethBalance = await indexVault.ethBalance();
  const usdcBalance = await indexVault.usdcBalance();
  console.log(`ETH: ${ethers.formatEther(ethBalance)} ETH`);
  console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  try {
    // Step 1: Lower the rebalance threshold temporarily
    console.log("\n🔧 Lowering rebalance threshold for testing...");
    
    // Check if we're the owner
    const owner = await indexVault.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error(`❌ Only owner (${owner}) can modify settings`);
      return;
    }

    // Note: We can't change the threshold as it's hardcoded as constant
    // So we'll update the balances manually to trigger rebalancing logic
    
    console.log("\n⚖️  Attempting to force rebalance by calling rebalance() directly...");
    const tx = await indexVault.rebalance();
    const receipt = await tx.wait();
    console.log(`✅ Force rebalance executed! TX: ${receipt.hash}`);

    // Check new balances
    console.log("\n📊 After rebalance:");
    const newEthBalance = await indexVault.ethBalance();
    const newUsdcBalance = await indexVault.usdcBalance();
    console.log(`ETH: ${ethers.formatEther(newEthBalance)} ETH`);
    console.log(`USDC: ${ethers.formatUnits(newUsdcBalance, 6)} USDC`);

    if (newEthBalance > ethBalance) {
      console.log("\n🎉 Success! ETH balance increased - swap executed!");
    } else {
      console.log("\n⚠️  No ETH acquired - check Uniswap liquidity on testnet");
    }

  } catch (error: any) {
    console.error("\n❌ Force rebalance failed:", error.message);
    
    if (error.message.includes("No portfolio value")) {
      console.log("💡 Portfolio value might be 0 - try depositing more USDC first");
    } else if (error.message.includes("Router") || error.message.includes("swap")) {
      console.log("💡 Uniswap swap failed - this is common on testnets");
      console.log("   - Low liquidity in testnet pools");
      console.log("   - Consider testing with larger amounts");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });