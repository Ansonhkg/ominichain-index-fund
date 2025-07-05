import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("💰 Checking asset prices...");

  // Load deployment data
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => f.endsWith(".json"));
  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment files found. Deploy contracts first with: bun run deploy:flow");
    process.exit(1);
  }

  const latestFile = deploymentFiles.sort().pop()!;
  const deployment = JSON.parse(fs.readFileSync(`./deployments/${latestFile}`, "utf8"));

  // Get PriceOracle contract
  const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);

  console.log("\n📈 Current Asset Prices:");
  console.log("=".repeat(40));

  try {
    const ethPrice = await priceOracle.getPrice("ETH");
    console.log(`ETH:  $${ethers.formatUnits(ethPrice, 18)}`);

    const flowPrice = await priceOracle.getPrice("FLOW");
    console.log(`FLOW: $${ethers.formatUnits(flowPrice, 18)}`);

    const usdcPrice = await priceOracle.getPrice("USDC");
    console.log(`USDC: $${ethers.formatUnits(usdcPrice, 18)}`);

    console.log("=".repeat(40));

    // Check if prices are stale
    console.log("\n🕒 Price Staleness Check:");
    const ethStale = await priceOracle.isPriceStale("ETH");
    const flowStale = await priceOracle.isPriceStale("FLOW");
    const usdcStale = await priceOracle.isPriceStale("USDC");

    console.log(`ETH:  ${ethStale ? "❌ STALE" : "✅ FRESH"}`);
    console.log(`FLOW: ${flowStale ? "❌ STALE" : "✅ FRESH"}`);
    console.log(`USDC: ${usdcStale ? "❌ STALE" : "✅ FRESH"}`);

    if (ethStale || flowStale || usdcStale) {
      console.log("\n⚠️  Some prices are stale! Consider updating them.");
    }

  } catch (error) {
    console.error("❌ Error fetching prices:", error);
    process.exit(1);
  }

  console.log("\n✅ Price check completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });