import { ethers, network } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("💰 Funding MockWETH with ETH for withdrawals...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  
  // Find latest deployment
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => 
    f.includes(network.name) && f.includes("enhanced")
  );
  
  if (deploymentFiles.length === 0) {
    console.error("❌ No enhanced deployment found. Run 'npm run deploy:enhanced' first.");
    return;
  }

  const latestFile = deploymentFiles.sort().pop()!;
  const deployment = JSON.parse(fs.readFileSync(`./deployments/${latestFile}`, "utf8"));
  
  if (!deployment.usingMocks) {
    console.log("ℹ️  Not using mocks, no need to fund MockWETH");
    return;
  }
  
  const mockWETHAddress = deployment.externalContracts.WETH;
  console.log("MockWETH address:", mockWETHAddress);
  
  const mockWETH = await ethers.getContractAt("MockWETH", mockWETHAddress);
  
  // Check current balance
  const currentBalance = await ethers.provider.getBalance(mockWETHAddress);
  console.log("Current MockWETH ETH balance:", ethers.formatEther(currentBalance), "ETH");
  
  if (currentBalance < ethers.parseEther("0.01")) {
    // Fund with 0.005 ETH (small amount for testing)
    const fundingAmount = ethers.parseEther("0.005");
    console.log("💰 Funding MockWETH with", ethers.formatEther(fundingAmount), "ETH...");
    
    const tx = await mockWETH.fundWithETH({ value: fundingAmount });
    await tx.wait();
    
    const newBalance = await ethers.provider.getBalance(mockWETHAddress);
    console.log("✅ MockWETH funded! New balance:", ethers.formatEther(newBalance), "ETH");
  } else {
    console.log("✅ MockWETH already has sufficient ETH balance");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });