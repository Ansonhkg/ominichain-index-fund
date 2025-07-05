import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("Starting simplified deployment on Flow EVM...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy PriceOracle with fallback mode (no Flare for now)
  console.log("\n1. Deploying PriceOracle...");
  const mockRegistry = ethers.Wallet.createRandom().address; // Mock registry for testing
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(deployer.address, mockRegistry);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("PriceOracle deployed to:", priceOracleAddress);

  // Deploy SimpleIndexToken (without LayerZero)
  console.log("\n2. Deploying SimpleIndexToken...");
  const SimpleIndexToken = await ethers.getContractFactory("SimpleIndexToken");
  const indexToken = await SimpleIndexToken.deploy(deployer.address);
  await indexToken.waitForDeployment();
  const indexTokenAddress = await indexToken.getAddress();
  console.log("SimpleIndexToken deployed to:", indexTokenAddress);

  // Deploy MockUSDC
  console.log("\n3. Deploying Mock USDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("Mock USDC deployed to:", usdcAddress);

  // Deploy IndexVault
  console.log("\n4. Deploying IndexVault...");
  const IndexVault = await ethers.getContractFactory("IndexVault");
  const indexVault = await IndexVault.deploy(
    indexTokenAddress,
    priceOracleAddress,
    usdcAddress,
    deployer.address
  );
  await indexVault.waitForDeployment();
  const indexVaultAddress = await indexVault.getAddress();
  console.log("IndexVault deployed to:", indexVaultAddress);

  // Configure contracts
  console.log("\n5. Configuring contracts...");
  await indexToken.setVault(indexVaultAddress);
  console.log("SimpleIndexToken vault set to IndexVault");

  // Save deployment addresses
  const deployment = {
    network: "flowTestnet",
    chainId: 545,
    contracts: {
      PriceOracle: priceOracleAddress,
      SimpleIndexToken: indexTokenAddress,
      IndexVault: indexVaultAddress,
      MockUSDC: usdcAddress
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  console.log("\n✅ Deployment complete!");
  console.log("\nDeployment summary:");
  console.log(JSON.stringify(deployment, null, 2));

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  // Write deployment to file
  fs.writeFileSync(
    `./deployments/flow-simple-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n🎯 Ready for testing!");
  console.log("Run: bun run mint:test");
  console.log("Run: bun run price:check");
  console.log("Run: bun run monitor");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });