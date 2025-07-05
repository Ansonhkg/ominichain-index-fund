import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🧪 Testing INDEX token minting...");

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
  const mockUSDC = await ethers.getContractAt("MockUSDC", deployment.contracts.MockUSDC);
  const indexVault = await ethers.getContractAt("IndexVault", deployment.contracts.IndexVault);
  
  // Check if we have SimpleIndexToken or IndexToken
  const tokenAddress = deployment.contracts.SimpleIndexToken || deployment.contracts.IndexToken;
  const tokenContractName = deployment.contracts.SimpleIndexToken ? "SimpleIndexToken" : "IndexToken";
  const indexToken = await ethers.getContractAt(tokenContractName, tokenAddress);

  const depositAmount = ethers.parseUnits("100", 6); // 100 USDC

  console.log("\n📊 Before minting:");
  console.log("USDC balance:", ethers.formatUnits(await mockUSDC.balanceOf(signer.address), 6));
  console.log("INDEX balance:", ethers.formatUnits(await indexToken.balanceOf(signer.address), 18));

  // Approve USDC
  console.log("\n🔒 Approving USDC...");
  const approveTx = await mockUSDC.approve(deployment.contracts.IndexVault, depositAmount);
  await approveTx.wait();
  console.log("✅ USDC approved");

  // Deposit USDC and mint INDEX
  console.log("\n💰 Depositing USDC and minting INDEX...");
  const depositTx = await indexVault.deposit(depositAmount);
  await depositTx.wait();
  console.log("✅ Deposit completed");

  console.log("\n📊 After minting:");
  console.log("USDC balance:", ethers.formatUnits(await mockUSDC.balanceOf(signer.address), 6));
  console.log("INDEX balance:", ethers.formatUnits(await indexToken.balanceOf(signer.address), 18));
  console.log("Portfolio value:", ethers.formatUnits(await indexVault.getPortfolioValue(), 6));

  console.log("\n✅ Minting test completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });