import { ethers } from "hardhat";
import * as fs from "fs";

interface DeploymentData {
  contracts: {
    PriceOracle: string;
    IndexToken?: string;
    SimpleIndexToken?: string;
    IndexVault: string;
    MockUSDC: string;
  };
}

async function getLatestDeployment(): Promise<DeploymentData> {
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => f.endsWith(".json"));
  if (deploymentFiles.length === 0) {
    throw new Error("No deployment files found");
  }
  
  const latestFile = deploymentFiles.sort().pop()!;
  const deploymentData = JSON.parse(fs.readFileSync(`./deployments/${latestFile}`, "utf8"));
  return deploymentData;
}

async function main() {
  console.log("📊 Portfolio Status Report");
  console.log("=".repeat(50));
  
  try {
    const deployment = await getLatestDeployment();
    
    const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);
    
    // Check if we have SimpleIndexToken or IndexToken
    const tokenAddress = deployment.contracts.SimpleIndexToken || deployment.contracts.IndexToken;
    const tokenContractName = deployment.contracts.SimpleIndexToken ? "SimpleIndexToken" : "IndexToken";
    const indexToken = await ethers.getContractAt(tokenContractName, tokenAddress);
    
    const indexVault = await ethers.getContractAt("IndexVault", deployment.contracts.IndexVault);
    
    console.log("\n💰 Current Asset Prices:");
    try {
      const ethPrice = await priceOracle.getPrice("ETH");
      const flowPrice = await priceOracle.getPrice("FLOW");
      const usdcPrice = await priceOracle.getPrice("USDC");
      
      console.log(`ETH:  $${ethers.formatUnits(ethPrice, 18)}`);
      console.log(`FLOW: $${ethers.formatUnits(flowPrice, 18)}`);
      console.log(`USDC: $${ethers.formatUnits(usdcPrice, 18)}`);
    } catch (error) {
      console.log("⚠️  Prices are stale, update them with: bun run price:update");
    }
    
    console.log("\n🏦 Portfolio Overview:");
    const totalSupply = await indexToken.totalSupply();
    console.log(`Total INDEX Supply: ${ethers.formatUnits(totalSupply, 18)}`);
    
    try {
      const portfolioValue = await indexVault.getPortfolioValue();
      console.log(`Portfolio Value: $${ethers.formatUnits(portfolioValue, 6)}`);
      
      if (totalSupply > 0) {
        const pricePerToken = portfolioValue * ethers.parseUnits("1", 18) / totalSupply;
        console.log(`INDEX Token Price: $${ethers.formatUnits(pricePerToken, 6)}`);
      }
    } catch (error) {
      console.log("⚠️  Portfolio value calculation failed (stale prices)");
    }
    
    console.log("\n📈 Asset Holdings:");
    const ethBalance = await indexVault.ethBalance();
    const usdcBalance = await indexVault.usdcBalance();
    const flowBalance = await indexVault.flowBalance();
    
    console.log(`ETH:  ${ethers.formatUnits(ethBalance, 18)}`);
    console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`FLOW: ${ethers.formatUnits(flowBalance, 18)}`);
    
    console.log("\n🎯 Target Allocations:");
    console.log("ETH:  40%");
    console.log("USDC: 30%");
    console.log("FLOW: 30%");
    
    console.log("\n📋 Contract Addresses:");
    console.log(`Price Oracle: ${deployment.contracts.PriceOracle}`);
    console.log(`INDEX Token: ${tokenAddress}`);
    console.log(`Vault: ${deployment.contracts.IndexVault}`);
    console.log(`Mock USDC: ${deployment.contracts.MockUSDC}`);
    
    console.log("\n⚡ Quick Commands:");
    console.log("• Update prices: bun run price:update");
    console.log("• Test minting:  bun run mint:test");
    console.log("• Check prices:  bun run price:check");
    
    console.log("\n✅ Portfolio status check complete!");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });