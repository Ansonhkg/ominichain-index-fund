import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔄 Updating asset prices...");

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

  // Get PriceOracle contract
  const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);

  // Update prices with current market-like values
  const assets = ["ETH", "FLOW", "USDC"];
  const prices = [
    ethers.parseEther("3200"), // ETH = $3200
    ethers.parseEther("0.85"),  // FLOW = $0.85
    ethers.parseEther("1")      // USDC = $1
  ];

  console.log("\n📊 Updating prices:");
  console.log("ETH:  $3200");
  console.log("FLOW: $0.85");
  console.log("USDC: $1");

  try {
    const tx = await priceOracle.updateMultiplePrices(assets, prices);
    await tx.wait();
    console.log("\n✅ Prices updated successfully!");
    console.log("Transaction hash:", tx.hash);
  } catch (error) {
    console.error("❌ Error updating prices:", error);
    process.exit(1);
  }

  console.log("\n🎯 Prices are now fresh for 1 minute. Run other commands quickly!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });