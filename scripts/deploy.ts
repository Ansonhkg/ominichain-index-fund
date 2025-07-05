import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("Starting deployment on Flow EVM...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy PriceOracle with Flare contract registry
  console.log("\n1. Deploying PriceOracle...");
  const FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"; // Flare testnet contract registry
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(deployer.address, FLARE_CONTRACT_REGISTRY);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("PriceOracle deployed to:", priceOracleAddress);

  // Deploy IndexToken with LayerZero endpoint
  console.log("\n2. Deploying IndexToken...");
  const LAYERZERO_ENDPOINT_FLOW_TESTNET = "0x1a44076050125825900e736c501f859c50fe728c"; // LayerZero V2 endpoint
  const IndexToken = await ethers.getContractFactory("IndexToken");
  const indexToken = await IndexToken.deploy(LAYERZERO_ENDPOINT_FLOW_TESTNET, deployer.address);
  await indexToken.waitForDeployment();
  const indexTokenAddress = await indexToken.getAddress();
  console.log("IndexToken deployed to:", indexTokenAddress);

  // Deploy a mock USDC for testing (in production, use actual USDC)
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
  console.log("IndexToken vault set to IndexVault");

  // Save deployment addresses
  const deployment = {
    network: "flowTestnet",
    chainId: 545,
    contracts: {
      PriceOracle: priceOracleAddress,
      IndexToken: indexTokenAddress,
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
    `./deployments/flow-testnet-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
