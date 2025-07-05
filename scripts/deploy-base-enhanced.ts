import { ethers, network } from "hardhat";
import { getNetworkAddresses, shouldUseMocks, MOCK_POOL_CONFIG } from "../config/addresses";
import * as fs from "fs";

interface DeploymentResult {
  network: string;
  chainId: number;
  timestamp: string;
  deployer: string;
  contracts: {
    PriceOracle: string;
    IndexToken: string;
    IndexVaultV2: string;
  };
  externalContracts: {
    USDC: string;
    WETH: string;
    LayerZeroEndpoint: string;
    UniswapV3SwapRouter: string;
    UniswapV3QuoterV2: string;
    FlareContractRegistry: string;
  };
  mockContracts?: {
    MockWETH: string;
    MockUSDC: string;
    MockSwapRouter: string;
    MockQuoterV2: string;
    MockFactory: string;
    MockPool: string;
  };
  configuration: any;
  usingMocks: boolean;
}

async function deployMockContracts(deployer: any) {
  console.log("\n🧪 Deploying mock Uniswap contracts...");

  // Deploy MockWETH
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const mockWETH = await MockWETH.deploy();
  await mockWETH.waitForDeployment();
  const mockWETHAddress = await mockWETH.getAddress();
  console.log("✅ MockWETH deployed to:", mockWETHAddress);

  // Deploy MockUSDC  
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✅ MockUSDC deployed to:", mockUSDCAddress);

  // Deploy MockFactory
  const MockFactory = await ethers.getContractFactory("MockUniswapFactory");
  const mockFactory = await MockFactory.deploy();
  await mockFactory.waitForDeployment();
  const mockFactoryAddress = await mockFactory.getAddress();
  console.log("✅ MockFactory deployed to:", mockFactoryAddress);

  // Deploy MockSwapRouter
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const mockRouter = await MockSwapRouter.deploy();
  await mockRouter.waitForDeployment();
  const mockRouterAddress = await mockRouter.getAddress();
  console.log("✅ MockSwapRouter deployed to:", mockRouterAddress);

  // Deploy MockQuoterV2
  const MockQuoterV2 = await ethers.getContractFactory("MockQuoterV2");
  const mockQuoter = await MockQuoterV2.deploy();
  await mockQuoter.waitForDeployment();
  const mockQuoterAddress = await mockQuoter.getAddress();
  console.log("✅ MockQuoterV2 deployed to:", mockQuoterAddress);

  // Create and setup pool
  console.log("🏊 Creating USDC/WETH pool...");
  
  const [token0Address, token1Address] = mockUSDCAddress < mockWETHAddress 
    ? [mockUSDCAddress, mockWETHAddress]
    : [mockWETHAddress, mockUSDCAddress];
    
  await mockFactory.createPool(token0Address, token1Address, MOCK_POOL_CONFIG.fee);
  const mockPoolAddress = await mockFactory.getPool(token0Address, token1Address, MOCK_POOL_CONFIG.fee);
  
  // Register pool
  await mockRouter.registerPool(token0Address, token1Address, MOCK_POOL_CONFIG.fee, mockPoolAddress);
  await mockQuoter.registerPool(token0Address, token1Address, MOCK_POOL_CONFIG.fee, mockPoolAddress);
  
  // Add liquidity
  const usdcAmount = ethers.parseUnits(MOCK_POOL_CONFIG.initialLiquidity.usdc, 6);
  const wethAmount = ethers.parseUnits(MOCK_POOL_CONFIG.initialLiquidity.weth, 18);
  
  await mockUSDC.mint(deployer.address, usdcAmount);
  await mockWETH.mint(deployer.address, wethAmount);
  
  const mockPool = await ethers.getContractAt("MockUniswapPool", mockPoolAddress);
  await mockUSDC.approve(mockPoolAddress, usdcAmount);
  await mockWETH.approve(mockPoolAddress, wethAmount);
  
  await mockPool.addLiquidity(
    token0Address === mockUSDCAddress ? usdcAmount : wethAmount,
    token1Address === mockWETHAddress ? wethAmount : usdcAmount
  );
  
  console.log("✅ Mock pool setup complete with liquidity");

  return {
    MockWETH: mockWETHAddress,
    MockUSDC: mockUSDCAddress,
    MockSwapRouter: mockRouterAddress,
    MockQuoterV2: mockQuoterAddress,
    MockFactory: mockFactoryAddress,
    MockPool: mockPoolAddress,
  };
}

async function testUniswapLiquidity(usdcAddress: string, routerAddress: string, quoterAddress: string) {
  console.log("\n🔍 Testing Uniswap liquidity...");
  
  try {
    const quoter = await ethers.getContractAt("IQuoterV2", quoterAddress);
    const testAmount = ethers.parseUnits("100", 6); // 100 USDC
    
    // Try to get a quote
    const quote = await quoter.quoteExactInputSingle.staticCall(
      usdcAddress,
      "0x4200000000000000000000000000000000000006", // WETH on Base
      3000, // 0.3% fee
      testAmount,
      0
    );
    
    if (quote > 0) {
      console.log("✅ Real Uniswap pool has liquidity");
      return true;
    }
  } catch (error) {
    console.log("⚠️  Real Uniswap pool unavailable or insufficient liquidity");
  }
  
  return false;
}

async function main() {
  console.log(`🚀 Starting enhanced deployment on ${network.name}...`);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const addresses = getNetworkAddresses(network.name);
  const useMocks = shouldUseMocks(network.name);
  
  console.log(`📍 Network configuration:`, {
    chainId: addresses.chainId,
    useMocks,
    uniswapRouter: addresses.uniswapV3.swapRouter
  });

  // 1. Deploy PriceOracle
  console.log("\n1. 🔮 Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(
    deployer.address, 
    addresses.flareContractRegistry
  );
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("✅ PriceOracle deployed to:", priceOracleAddress);

  // 2. Deploy IndexToken
  console.log("\n2. 🪙 Deploying IndexToken (LayerZero OFT)...");
  const IndexToken = await ethers.getContractFactory("IndexToken");
  const indexToken = await IndexToken.deploy(
    addresses.layerZeroEndpoint,
    deployer.address
  );
  await indexToken.waitForDeployment();
  const indexTokenAddress = await indexToken.getAddress();
  console.log("✅ IndexToken deployed to:", indexTokenAddress);

  // 3. Decide whether to use mocks or real Uniswap
  let usdcAddress = addresses.usdc;
  let wethAddress = addresses.weth;
  let routerAddress = addresses.uniswapV3.swapRouter;
  let quoterAddress = addresses.uniswapV3.quoterV2;
  let mockContracts;
  let usingMocks = false;

  if (useMocks) {
    // Test real liquidity first
    const hasRealLiquidity = await testUniswapLiquidity(addresses.usdc, addresses.uniswapV3.swapRouter, addresses.uniswapV3.quoterV2);
    
    if (!hasRealLiquidity) {
      console.log("\n🧪 Deploying mock contracts due to insufficient real liquidity...");
      mockContracts = await deployMockContracts(deployer);
      
      // Use mock addresses
      usdcAddress = mockContracts.MockUSDC;
      wethAddress = mockContracts.MockWETH;
      routerAddress = mockContracts.MockSwapRouter;
      quoterAddress = mockContracts.MockQuoterV2;
      usingMocks = true;
    } else {
      console.log("✅ Using real Uniswap contracts with sufficient liquidity");
    }
  }

  // 4. Deploy IndexVaultV2
  console.log("\n4. 🏦 Deploying IndexVaultV2...");
  const IndexVaultV2 = await ethers.getContractFactory("IndexVaultV2");
  const indexVault = await IndexVaultV2.deploy(
    indexTokenAddress,
    priceOracleAddress,
    usdcAddress,
    routerAddress,
    quoterAddress,
    wethAddress,
    deployer.address
  );
  await indexVault.waitForDeployment();
  const indexVaultAddress = await indexVault.getAddress();
  console.log("✅ IndexVaultV2 deployed to:", indexVaultAddress);

  // 5. Configure contracts
  console.log("\n5. ⚙️ Configuring contracts...");
  await indexToken.setVault(indexVaultAddress);
  await priceOracle.addPriceUpdater(deployer.address);
  console.log("✅ Configuration complete!");

  // 6. Set initial prices for testing
  if (network.name.includes("Sepolia") || network.name.includes("testnet")) {
    console.log("\n6. 🧪 Setting initial prices...");
    const ethPrice = ethers.parseUnits("3000", 18);
    const flowPrice = ethers.parseUnits("0.5", 18);
    
    await priceOracle.updateMultiplePrices(
      ["ETH", "FLOW"],
      [ethPrice, flowPrice]
    );
    console.log("✅ Initial prices set");
  }

  // 7. Test functionality if using mocks
  if (usingMocks && mockContracts) {
    console.log("\n7. 🧪 Testing mock functionality...");
    
    // Give deployer some mock USDC
    const mockUSDC = await ethers.getContractAt("MockUSDC", mockContracts.MockUSDC);
    const testAmount = ethers.parseUnits("10", 6); // 10 USDC
    await mockUSDC.mint(deployer.address, testAmount);
    
    // Test deposit
    await mockUSDC.approve(indexVaultAddress, testAmount);
    await indexVault.deposit(testAmount);
    
    const indexBalance = await indexToken.balanceOf(deployer.address);
    console.log(`✅ Test successful: Deposited 10 USDC, received ${ethers.formatEther(indexBalance)} INDEX`);
  }

  // Save deployment
  const deployment: DeploymentResult = {
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
      USDC: usdcAddress,
      WETH: wethAddress,
      LayerZeroEndpoint: addresses.layerZeroEndpoint,
      UniswapV3SwapRouter: routerAddress,
      UniswapV3QuoterV2: quoterAddress,
      FlareContractRegistry: addresses.flareContractRegistry
    },
    mockContracts,
    configuration: {
      priceOracleUpdater: deployer.address,
      indexTokenVault: indexVaultAddress,
      stalenessThreshold: "900",
      minPriceChangeThreshold: "5"
    },
    usingMocks
  };

  console.log("\n✅ Enhanced deployment complete!");
  console.log("\n📊 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔮 PriceOracle:    ", priceOracleAddress);
  console.log("🪙 IndexToken:     ", indexTokenAddress);
  console.log("🏦 IndexVaultV2:   ", indexVaultAddress);
  console.log("💰 USDC:           ", usdcAddress, usingMocks ? "(MOCK)" : "");
  console.log("🔄 SwapRouter:     ", routerAddress, usingMocks ? "(MOCK)" : "");
  console.log("📊 QuoterV2:       ", quoterAddress, usingMocks ? "(MOCK)" : "");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (usingMocks) {
    console.log("🧪 Using MOCK contracts for DEX functionality");
    console.log("🎯 Ready for testing and demonstration!");
  }

  // Save deployment
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  const deploymentFile = `./deployments/${network.name}-enhanced-${Date.now()}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log("📄 Deployment saved to:", deploymentFile);

  console.log("\n🎯 Next Steps:");
  console.log("1. Update prices: bun run price:update:base");
  console.log("2. Test minting: bun run mint:base");
  console.log("3. Test rebalancing: bun run rebalance:base");
  console.log("4. Check portfolio: bun run portfolio:base");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });