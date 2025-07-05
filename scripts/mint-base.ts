import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🧪 Testing INDEX token minting on Base Sepolia...");

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

  // Get contract instances
  const usdc = await ethers.getContractAt("IERC20", deployment.externalContracts.USDC);
  const indexVault = await ethers.getContractAt("IndexVaultV2", deployment.contracts.IndexVaultV2);
  const indexToken = await ethers.getContractAt("IndexToken", deployment.contracts.IndexToken);

  // First, we need to get some USDC
  // On Base Sepolia, we can try to mint from a faucet or use existing balance
  const usdcBalance = await usdc.balanceOf(signer.address);
  console.log("\n📊 Current balances:");
  console.log("USDC balance:", ethers.formatUnits(usdcBalance, 6), "USDC");
  console.log("INDEX balance:", ethers.formatUnits(await indexToken.balanceOf(signer.address), 18), "INDEX");

  if (usdcBalance === 0n) {
    console.log("\n❌ You need USDC to mint INDEX tokens!");
    console.log("Options:");
    console.log("1. Get Base Sepolia USDC from a faucet");
    console.log("2. Swap ETH for USDC on Base Sepolia testnet");
    console.log("3. Bridge USDC from another testnet");
    console.log("\nUSDC Contract:", deployment.externalContracts.USDC);
    return;
  }

  const depositAmount = ethers.parseUnits("1", 6); // 10 USDC
  
  if (usdcBalance < depositAmount) {
    console.log(`\n⚠️ Not enough USDC. You have ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    return;
  }

  // Calculate expected INDEX tokens
  const expectedIndex = await indexVault.calculateIndexTokens(depositAmount);
  console.log("\n💰 Deposit details:");
  console.log("Depositing:", ethers.formatUnits(depositAmount, 6), "USDC");
  console.log("Expected INDEX:", ethers.formatUnits(expectedIndex, 18), "INDEX");

  // Approve USDC
  console.log("\n🔒 Approving USDC...");
  const currentAllowance = await usdc.allowance(signer.address, deployment.contracts.IndexVaultV2);
  if (currentAllowance < depositAmount) {
    const approveTx = await usdc.approve(deployment.contracts.IndexVaultV2, depositAmount);
    await approveTx.wait();
    console.log("✅ USDC approved");
  } else {
    console.log("✅ USDC already approved");
  }

  // Deposit and mint
  console.log("\n💸 Depositing USDC to mint INDEX...");
  const depositTx = await indexVault.deposit(depositAmount);
  const receipt = await depositTx.wait();
  console.log("✅ Transaction confirmed:", receipt!.hash);

  // Check final balances
  console.log("\n📊 After minting:");
  console.log("USDC balance:", ethers.formatUnits(await usdc.balanceOf(signer.address), 6), "USDC");
  console.log("INDEX balance:", ethers.formatUnits(await indexToken.balanceOf(signer.address), 18), "INDEX");

  // Check portfolio value
  const portfolioValue = await indexVault.getPortfolioValue();
  console.log("\n🏦 Portfolio Status:");
  console.log("Total Portfolio Value:", ethers.formatUnits(portfolioValue, 6), "USD");
  console.log("INDEX Token Supply:", ethers.formatUnits(await indexToken.totalSupply(), 18), "INDEX");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });