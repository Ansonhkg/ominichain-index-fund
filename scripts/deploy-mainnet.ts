import { ethers, network } from "hardhat";
import * as fs from "fs";
import { getNetworkAddresses, getLayerZeroEndpointId } from "../config/addresses";

interface DeploymentResult {
  networkName: string;
  chainId: number;
  contracts: {
    PriceOracle?: string;
    IndexToken: string;
    IndexVaultV2?: string;
  };
  externalContracts: {
    USDC: string;
    WETH: string;
    SwapRouter: string;
    QuoterV2: string;
    LayerZeroEndpoint: string;
  };
  layerZeroEndpointId: number;
  timestamp: number;
  gasUsed: bigint;
  deployer: string;
}

async function main() {
  console.log(`🚀 MAINNET DEPLOYMENT - ${network.name.toUpperCase()}`);
  console.log("=".repeat(80));
  console.log("🌐 Network:", network.name);
  console.log("📅 Date:", new Date().toISOString());
  console.log("=".repeat(80));

  const [deployer] = await ethers.getSigners();
  console.log("👤 Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  WARNING: Low ETH balance. Consider funding the account.");
  }

  // Get network configuration
  let networkConfig;
  try {
    networkConfig = getNetworkAddresses(network.name);
    console.log("✅ Network configuration loaded");
  } catch (error) {
    console.error("❌ Network not supported:", network.name);
    process.exit(1);
  }

  const layerZeroEndpointId = getLayerZeroEndpointId(network.name);
  console.log("🔗 LayerZero Endpoint ID:", layerZeroEndpointId);

  let totalGasUsed = 0n;
  const deploymentResult: DeploymentResult = {
    networkName: network.name,
    chainId: networkConfig.chainId,
    contracts: {
      IndexToken: "",
    },
    externalContracts: {
      USDC: networkConfig.usdc,
      WETH: networkConfig.weth,
      SwapRouter: networkConfig.uniswapV3.swapRouter,
      QuoterV2: networkConfig.uniswapV3.quoterV2,
      LayerZeroEndpoint: networkConfig.layerZeroEndpoint,
    },
    layerZeroEndpointId,
    timestamp: Date.now(),
    gasUsed: 0n,
    deployer: deployer.address
  };

  console.log("\\n📊 USING REAL MAINNET CONTRACTS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💵 USDC:           ", networkConfig.usdc);
  console.log("💎 WETH:           ", networkConfig.weth);
  console.log("🔄 SwapRouter:     ", networkConfig.uniswapV3.swapRouter);
  console.log("📊 QuoterV2:       ", networkConfig.uniswapV3.quoterV2);
  console.log("🌐 LayerZero:      ", networkConfig.layerZeroEndpoint);

  try {
    // 1. Deploy PriceOracle (only on Flare or Base)
    if (network.name === "flareMainnet" || network.name === "baseMainnet") {
      console.log("\\n1. 🔮 Deploying PriceOracle...");
      
      const ftsoRegistry = network.name === "flareMainnet" 
        ? (networkConfig as any).ftsoRegistry 
        : (networkConfig as any).flareContractRegistry;
        
      const PriceOracle = await ethers.getContractFactory("PriceOracle");
      const priceOracle = await PriceOracle.deploy(deployer.address, ftsoRegistry);
      await priceOracle.waitForDeployment();
      
      const priceOracleAddress = await priceOracle.getAddress();
      const deployTx = priceOracle.deploymentTransaction();
      const gasUsed = deployTx ? await deployTx.wait().then(r => r?.gasUsed || 0n) : 0n;
      totalGasUsed += gasUsed;
      
      deploymentResult.contracts.PriceOracle = priceOracleAddress;
      console.log("✅ PriceOracle deployed to:", priceOracleAddress);
      console.log("⛽ Gas used:", gasUsed.toString());
    }

    // 2. Deploy IndexToken (LayerZero OFT)
    console.log("\\n2. 🪙 Deploying IndexToken (LayerZero OFT)...");
    
    const IndexToken = await ethers.getContractFactory("IndexToken");
    const indexToken = await IndexToken.deploy(
      networkConfig.layerZeroEndpoint,
      deployer.address
    );
    await indexToken.waitForDeployment();
    
    const indexTokenAddress = await indexToken.getAddress();
    const deployTx2 = indexToken.deploymentTransaction();
    const gasUsed2 = deployTx2 ? await deployTx2.wait().then(r => r?.gasUsed || 0n) : 0n;
    totalGasUsed += gasUsed2;
    
    deploymentResult.contracts.IndexToken = indexTokenAddress;
    console.log("✅ IndexToken deployed to:", indexTokenAddress);
    console.log("⛽ Gas used:", gasUsed2.toString());

    // 3. Deploy IndexVaultV2 (only on Base - primary chain)
    if (network.name === "baseMainnet" && deploymentResult.contracts.PriceOracle) {
      console.log("\\n3. 🏦 Deploying IndexVaultV2...");
      
      const IndexVaultV2 = await ethers.getContractFactory("IndexVaultV2");
      const indexVault = await IndexVaultV2.deploy(
        indexTokenAddress,
        deploymentResult.contracts.PriceOracle,
        networkConfig.usdc,
        networkConfig.uniswapV3.swapRouter,
        networkConfig.uniswapV3.quoterV2,
        networkConfig.weth,
        deployer.address
      );
      await indexVault.waitForDeployment();
      
      const indexVaultAddress = await indexVault.getAddress();
      const deployTx3 = indexVault.deploymentTransaction();
      const gasUsed3 = deployTx3 ? await deployTx3.wait().then(r => r?.gasUsed || 0n) : 0n;
      totalGasUsed += gasUsed3;
      
      deploymentResult.contracts.IndexVaultV2 = indexVaultAddress;
      console.log("✅ IndexVaultV2 deployed to:", indexVaultAddress);
      console.log("⛽ Gas used:", gasUsed3.toString());

      // 4. Configure contracts
      console.log("\\n4. ⚙️ Configuring contracts...");
      
      await indexToken.setVault(indexVaultAddress);
      console.log("✅ IndexToken vault set");
      
      if (deploymentResult.contracts.PriceOracle) {
        const priceOracle = await ethers.getContractAt("PriceOracle", deploymentResult.contracts.PriceOracle);
        await priceOracle.addPriceUpdater(deployer.address);
        console.log("✅ PriceOracle price updater added");
      }
    }

    // 5. Verify external contract connectivity
    console.log("\\n5. 🔍 Verifying external contract connectivity...");
    
    // Check USDC
    try {
      const usdc = await ethers.getContractAt("IERC20", networkConfig.usdc);
      const usdcSymbol = await usdc.symbol();
      console.log("✅ USDC connected:", usdcSymbol);
    } catch (error) {
      console.warn("⚠️  USDC connection failed:", (error as Error).message);
    }
    
    // Check LayerZero endpoint
    try {
      const endpoint = await ethers.getContractAt("ILayerZeroEndpointV2", networkConfig.layerZeroEndpoint);
      const endpointId = await endpoint.eid();
      console.log("✅ LayerZero endpoint connected, EID:", endpointId.toString());
    } catch (error) {
      console.warn("⚠️  LayerZero endpoint connection failed:", (error as Error).message);
    }

    deploymentResult.gasUsed = totalGasUsed;

    // Save deployment result
    const filename = `./deployments/${network.name}-mainnet-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentResult, null, 2));
    
    console.log("\\n✅ MAINNET DEPLOYMENT COMPLETE!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🌐 Network:        ", network.name);
    console.log("⛽ Total Gas Used: ", totalGasUsed.toString());
    console.log("💰 Estimated Cost: ", ethers.formatEther(totalGasUsed * 30n * 1000000000n), "ETH"); // Rough estimate
    console.log("📄 Deployment saved to:", filename);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (network.name === "baseMainnet") {
      console.log("\\n🎯 NEXT STEPS:");
      console.log("1. Deploy on Flow: npm run deploy:flow:mainnet");
      console.log("2. Deploy on Flare: npm run deploy:flare:mainnet");  
      console.log("3. Set up cross-chain connections: npm run setup:crosschain");
      console.log("4. Test with small amounts: npm run test:mainnet");
    }

  } catch (error) {
    console.error("\\n❌ Deployment failed:", (error as Error).message);
    console.error("📄 Partial deployment saved for debugging");
    
    const errorFilename = `./deployments/${network.name}-mainnet-failed-${Date.now()}.json`;
    fs.writeFileSync(errorFilename, JSON.stringify({
      ...deploymentResult,
      error: (error as Error).message,
      gasUsed: totalGasUsed
    }, null, 2));
    
    process.exit(1);
  }

  console.log("\\n" + "=".repeat(80));
  console.log("🎉 DEPLOYMENT SUCCESS! Ready for production use.");
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });