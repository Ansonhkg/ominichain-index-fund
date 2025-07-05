import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔧 Configuring vault...");

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

  // Get contract instances
  const tokenAddress = deployment.contracts.SimpleIndexToken || deployment.contracts.IndexToken;
  const tokenContractName = deployment.contracts.SimpleIndexToken ? "SimpleIndexToken" : "IndexToken";
  const indexToken = await ethers.getContractAt(tokenContractName, tokenAddress);
  const indexVault = await ethers.getContractAt("IndexVault", deployment.contracts.IndexVault);

  console.log("\n1. Setting vault address in token...");
  try {
    const tx1 = await indexToken.setVault(deployment.contracts.IndexVault);
    await tx1.wait();
    console.log("✅ Vault address set in token");
  } catch (error) {
    console.log("⚠️  Vault address might already be set");
  }

  console.log("\n2. Checking configuration...");
  const vaultAddress = await indexToken.vault();
  const owner = await indexToken.owner();
  
  console.log("Token vault address:", vaultAddress);
  console.log("Expected vault address:", deployment.contracts.IndexVault);
  console.log("Token owner:", owner);
  console.log("Deployer address:", signer.address);

  if (vaultAddress.toLowerCase() === deployment.contracts.IndexVault.toLowerCase()) {
    console.log("✅ Vault configuration is correct!");
  } else {
    console.log("❌ Vault configuration is incorrect!");
  }

  console.log("\n✅ Configuration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });