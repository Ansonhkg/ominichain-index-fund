import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔮 Setting up oracle configuration...");

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

  const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);

  console.log("\n1. Setting up Feed IDs for Flare FTSO...");
  
  // Set feed IDs for assets
  const feedIds = {
    "ETH": "0x014554482f55534400000000000000000000000000", // ETH/USD
    "FLR": "0x01464c522f55534400000000000000000000000000", // FLR/USD  
    "BTC": "0x014254432f55534400000000000000000000000000", // BTC/USD
  };

  for (const [asset, feedId] of Object.entries(feedIds)) {
    try {
      console.log(`Setting feed ID for ${asset}...`);
      const tx = await priceOracle.setFeedId(asset, feedId);
      await tx.wait();
      console.log(`✅ ${asset} feed ID set`);
    } catch (error) {
      console.log(`⚠️  ${asset} feed ID might already be set`);
    }
  }

  console.log("\n2. Updating initial prices...");
  const assets = ["ETH", "FLOW", "USDC"];
  const prices = [
    ethers.parseEther("3200"), // ETH = $3200
    ethers.parseEther("0.85"),  // FLOW = $0.85 (using FLR as proxy)
    ethers.parseEther("1")      // USDC = $1
  ];

  try {
    const tx = await priceOracle.updateMultiplePrices(assets, prices);
    await tx.wait();
    console.log("✅ Initial prices set");
  } catch (error) {
    console.log("⚠️  Prices might already be set");
  }

  console.log("\n✅ Oracle setup complete!");
  console.log("💡 Prices are fresh for 1 minute (demo mode)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });