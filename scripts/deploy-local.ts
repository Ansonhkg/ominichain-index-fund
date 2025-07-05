import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("Starting local deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy Mock LayerZero Endpoint for local testing
  console.log("\n1. Deploying Mock LayerZero Endpoint...");
  const MockLayerZeroEndpoint = await ethers.getContractFactory("MockLayerZeroEndpoint");
  const mockEndpoint = await MockLayerZeroEndpoint.deploy();
  await mockEndpoint.waitForDeployment();
  const mockEndpointAddress = await mockEndpoint.getAddress();
  console.log("Mock LayerZero Endpoint deployed to:", mockEndpointAddress);

  // Deploy PriceOracle with mock registry for local testing
  console.log("\n2. Deploying PriceOracle...");
  const mockRegistry = ethers.Wallet.createRandom().address; // Mock registry for local testing
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(deployer.address, mockRegistry);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("PriceOracle deployed to:", priceOracleAddress);

  // Deploy IndexToken with mock endpoint
  console.log("\n3. Deploying IndexToken...");
  const IndexToken = await ethers.getContractFactory("IndexToken");
  const indexToken = await IndexToken.deploy(mockEndpointAddress, deployer.address);
  await indexToken.waitForDeployment();
  const indexTokenAddress = await indexToken.getAddress();
  console.log("IndexToken deployed to:", indexTokenAddress);

  // Deploy MockUSDC
  console.log("\n4. Deploying Mock USDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("Mock USDC deployed to:", usdcAddress);

  // Deploy IndexVault
  console.log("\n5. Deploying IndexVault...");
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
  console.log("\n6. Configuring contracts...");
  await indexToken.setVault(indexVaultAddress);
  console.log("IndexToken vault set to IndexVault");

  // Save deployment addresses
  const deployment = {
    network: "localhost",
    chainId: 31337,
    contracts: {
      MockLayerZeroEndpoint: mockEndpointAddress,
      PriceOracle: priceOracleAddress,
      IndexToken: indexTokenAddress,
      IndexVault: indexVaultAddress,
      MockUSDC: usdcAddress
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  console.log("\n✅ Local deployment complete!");
  console.log("\nDeployment summary:");
  console.log(JSON.stringify(deployment, null, 2));

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  // Write deployment to file
  fs.writeFileSync(
    `./deployments/localhost-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n🎯 Ready for testing!");
  console.log("Run: bun run mint:test (after updating the script for localhost)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });