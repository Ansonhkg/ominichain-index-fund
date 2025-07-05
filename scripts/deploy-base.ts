import { ethers, network } from "hardhat";
import { getNetworkAddresses } from "../config/addresses";
import * as fs from "fs";

async function main() {
  console.log(`🚀 Starting deployment on ${network.name}...`);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Get network-specific addresses
  const addresses = getNetworkAddresses(network.name);
  console.log(`📍 Using ${network.name} configuration:`, {
    chainId: addresses.chainId,
    usdc: addresses.usdc,
    layerZeroEndpoint: addresses.layerZeroEndpoint,
    uniswapV3Router: addresses.uniswapV3.swapRouter
  });

  // 1. Deploy PriceOracle with real Flare Contract Registry
  console.log("\n1. 🔮 Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(
    deployer.address, 
    addresses.flareContractRegistry
  );
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("✅ PriceOracle deployed to:", priceOracleAddress);

  // 2. Deploy IndexToken with LayerZero OFT
  console.log("\n2. 🪙 Deploying IndexToken (LayerZero OFT)...");
  const IndexToken = await ethers.getContractFactory("IndexToken");
  const indexToken = await IndexToken.deploy(
    addresses.layerZeroEndpoint,
    deployer.address
  );
  await indexToken.waitForDeployment();
  const indexTokenAddress = await indexToken.getAddress();
  console.log("✅ IndexToken deployed to:", indexTokenAddress);

  // 3. Deploy Enhanced IndexVaultV2 with Uniswap V3
  console.log("\n3. 🏦 Deploying IndexVaultV2 with Uniswap V3...");
  const IndexVaultV2 = await ethers.getContractFactory("IndexVaultV2");
  const indexVault = await IndexVaultV2.deploy(
    indexTokenAddress,
    priceOracleAddress,
    addresses.usdc,
    addresses.uniswapV3.swapRouter,
    addresses.uniswapV3.quoterV2,
    addresses.weth,
    deployer.address
  );
  await indexVault.waitForDeployment();
  const indexVaultAddress = await indexVault.getAddress();
  console.log("✅ IndexVaultV2 deployed to:", indexVaultAddress);

  // 4. Configure contracts
  console.log("\n4. ⚙️ Configuring contracts...");
  
  // Set vault in IndexToken
  console.log("Setting vault in IndexToken...");
  await indexToken.setVault(indexVaultAddress);
  
  // Add deployer as price updater for automation
  console.log("Adding deployer as price updater...");
  await priceOracle.addPriceUpdater(deployer.address);
  
  console.log("✅ Configuration complete!");

  // 5. Initial setup for testing
  console.log("\n5. 🧪 Setting up for testing...");
  
  // Set some initial prices if this is testnet
  if (network.name.includes("Sepolia") || network.name.includes("testnet")) {
    console.log("Setting initial prices for testnet...");
    const ethPrice = ethers.parseUnits("3000", 18); // $3000
    const flowPrice = ethers.parseUnits("0.5", 18);  // $0.5 (demo price)
    
    await priceOracle.updateMultiplePrices(
      ["ETH", "FLOW"],
      [ethPrice, flowPrice]
    );
    console.log("✅ Initial prices set");
  }

  // 6. Save deployment info
  const deployment = {
    network: network.name,
    chainId: addresses.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PriceOracle: priceOracleAddress,
      IndexToken: indexTokenAddress,
      IndexVaultV2: indexVaultAddress
    },
    externalContracts: {
      USDC: addresses.usdc,
      WETH: addresses.weth,
      LayerZeroEndpoint: addresses.layerZeroEndpoint,
      UniswapV3SwapRouter: addresses.uniswapV3.swapRouter,
      UniswapV3QuoterV2: addresses.uniswapV3.quoterV2,
      FlareContractRegistry: addresses.flareContractRegistry
    },
    configuration: {
      priceOracleUpdater: deployer.address,
      indexTokenVault: indexVaultAddress,
      stalenessThreshold: "900", // 15 minutes
      minPriceChangeThreshold: "5" // 5%
    }
  };

  console.log("\n✅ Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔮 PriceOracle:      ", priceOracleAddress);
  console.log("🪙 IndexToken (OFT): ", indexTokenAddress);  
  console.log("🏦 IndexVaultV2:     ", indexVaultAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💰 USDC:             ", addresses.usdc);
  console.log("🔄 Uniswap Router:   ", addresses.uniswapV3.swapRouter);
  console.log("🌉 LayerZero:        ", addresses.layerZeroEndpoint);
  console.log("🔥 Flare Registry:   ", addresses.flareContractRegistry);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  // Write deployment to file
  const filename = `./deployments/${network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  console.log("📄 Deployment saved to:", filename);

  console.log("\n🎯 Next Steps:");
  console.log("1. Test deployment: bun run test:base");
  console.log("2. Setup price updater: bun run flare:check --network", network.name);
  console.log("3. Test minting: bun run mint:test --network", network.name);
  console.log("4. Verify contracts: bun run verify:base");

  // Return deployment info for use in tests
  return deployment;
}

// Run deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

export { main as deployBase };