import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔍 Verifying contracts...");

  // Load deployment data
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => f.endsWith(".json"));
  if (deploymentFiles.length === 0) {
    console.error("❌ No deployment files found. Deploy contracts first with: bun run deploy:flow");
    process.exit(1);
  }

  const latestFile = deploymentFiles.sort().pop()!;
  const deployment = JSON.parse(fs.readFileSync(`./deployments/${latestFile}`, "utf8"));

  console.log("📋 Deployment found:", latestFile);
  console.log("🌐 Network:", deployment.network);
  console.log("⛓️  Chain ID:", deployment.chainId);

  console.log("\n📦 Contract Addresses:");
  for (const [name, address] of Object.entries(deployment.contracts)) {
    console.log(`${name}: ${address}`);
  }

  console.log("\n🔗 Verification Links (Flow EVM Testnet):");
  const baseUrl = "https://evm-testnet.flowscan.io/address";
  
  for (const [name, address] of Object.entries(deployment.contracts)) {
    console.log(`${name}: ${baseUrl}/${address}`);
  }

  console.log("\n✅ Verification info displayed!");
  console.log("📝 Manual verification can be done on Flow Explorer");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });