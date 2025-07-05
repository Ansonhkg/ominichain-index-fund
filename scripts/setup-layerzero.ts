import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🌉 Setting up LayerZero configuration...");

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

  // Check if we have LayerZero OFT or SimpleIndexToken
  const tokenAddress = deployment.contracts.IndexToken || deployment.contracts.SimpleIndexToken;
  const isOFT = !!deployment.contracts.IndexToken;

  if (!isOFT) {
    console.log("ℹ️  Current deployment uses SimpleIndexToken (no LayerZero)");
    console.log("🚀 LayerZero setup will be available when IndexToken OFT is deployed");
    console.log("\n📋 Next steps for LayerZero integration:");
    console.log("1. Deploy IndexToken (OFT) instead of SimpleIndexToken");
    console.log("2. Configure peers on target chains");
    console.log("3. Set trusted remotes for cross-chain messaging");
    console.log("4. Configure gas limits and message libraries");
    return;
  }

  const indexToken = await ethers.getContractAt("IndexToken", tokenAddress);

  console.log("\n1. Checking LayerZero endpoint...");
  // For now, just display the configuration that would be needed
  console.log("📋 LayerZero V2 Configuration:");
  console.log("Endpoint Address: 0x1a44076050125825900e736c501f859c50fe728c");
  console.log("Flow Testnet EID: TBD (to be confirmed)");
  console.log("Flow Mainnet EID: TBD (to be confirmed)");

  console.log("\n2. Future LayerZero setup tasks:");
  console.log("• Configure peer chains");
  console.log("• Set trusted remotes");
  console.log("• Configure gas limits");
  console.log("• Set message libraries");

  console.log("\n✅ LayerZero structure is ready for multi-chain expansion!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });