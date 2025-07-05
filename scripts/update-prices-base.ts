import { ethers } from "hardhat";
import * as fs from "fs";
import { flareAPI } from "../services/flare-api";

async function main() {
  console.log("🔄 Updating prices from Flare FTSO...\n");

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

  // Get PriceOracle contract
  const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);

  try {
    // Fetch prices from Flare
    console.log("📡 Fetching prices from Flare...");
    const assets = ["ETH", "BTC", "FLOW"];
    const priceData = await flareAPI.getPrices(assets);

    for (const data of priceData) {
      const priceWei = ethers.parseUnits(data.price, 18);
      console.log(`${data.symbol}: $${data.price}`);

      // Update price
      const tx = await priceOracle.updatePrice(data.symbol, priceWei);
      await tx.wait();
      console.log(`✅ ${data.symbol} price updated`);
    }

    console.log("\n🎉 All prices updated successfully!");

    // Check if prices are fresh now
    console.log("\n🕒 Checking price freshness:");
    for (const asset of assets) {
      const isStale = await priceOracle.isPriceStale(asset);
      console.log(`${asset}: ${isStale ? "❌ STALE" : "✅ FRESH"}`);
    }

  } catch (error: any) {
    console.error("❌ Error updating prices:", error.message);
    
    // If we can't update due to permissions, suggest manual update
    if (error.message.includes("Only authorized")) {
      console.log("\n💡 You need to be added as a price updater. Ask the contract owner to run:");
      console.log(`   priceOracle.addPriceUpdater("${signer.address}")`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });