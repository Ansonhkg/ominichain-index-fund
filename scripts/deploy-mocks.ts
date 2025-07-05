import { ethers, network } from "hardhat";
import { getNetworkAddresses, shouldUseMocks, MOCK_POOL_CONFIG } from "../config/addresses";
import * as fs from "fs";

interface MockDeployment {
  network: string;
  chainId: number;
  timestamp: string;
  deployer: string;
  mockContracts: {
    MockWETH: string;
    MockUSDC: string;
    MockSwapRouter: string;
    MockQuoterV2: string;
    MockFactory: string;
    MockPool: string;
  };
  poolConfig: {
    token0: string; // USDC
    token1: string; // WETH
    fee: number;
    initialLiquidity: {
      usdc: string;
      weth: string;
    };
  };
}

async function main() {
  console.log(`🧪 Deploying mock Uniswap contracts on ${network.name}...`);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Check if we should deploy mocks for this network
  if (!shouldUseMocks(network.name)) {
    console.log("❌ Mocks not enabled for this network");
    console.log("Use --force flag or modify config to deploy mocks");
    return;
  }

  const addresses = getNetworkAddresses(network.name);
  console.log(`📍 Deploying mocks for ${network.name} (Chain ID: ${addresses.chainId})`);

  // 1. Deploy MockWETH
  console.log("\n1. 💰 Deploying MockWETH...");
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const mockWETH = await MockWETH.deploy();
  await mockWETH.waitForDeployment();
  const mockWETHAddress = await mockWETH.getAddress();
  console.log("✅ MockWETH deployed to:", mockWETHAddress);

  // 2. Deploy MockUSDC (reuse existing or deploy new)
  console.log("\n2. 💵 Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✅ MockUSDC deployed to:", mockUSDCAddress);

  // 3. Deploy MockUniswapFactory
  console.log("\n3. 🏭 Deploying MockUniswapFactory...");
  const MockFactory = await ethers.getContractFactory("MockUniswapFactory");
  const mockFactory = await MockFactory.deploy();
  await mockFactory.waitForDeployment();
  const mockFactoryAddress = await mockFactory.getAddress();
  console.log("✅ MockUniswapFactory deployed to:", mockFactoryAddress);

  // 4. Deploy MockSwapRouter
  console.log("\n4. 🔄 Deploying MockSwapRouter...");
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const mockRouter = await MockSwapRouter.deploy();
  await mockRouter.waitForDeployment();
  const mockRouterAddress = await mockRouter.getAddress();
  console.log("✅ MockSwapRouter deployed to:", mockRouterAddress);

  // 5. Deploy MockQuoterV2
  console.log("\n5. 📊 Deploying MockQuoterV2...");
  const MockQuoterV2 = await ethers.getContractFactory("MockQuoterV2");
  const mockQuoter = await MockQuoterV2.deploy();
  await mockQuoter.waitForDeployment();
  const mockQuoterAddress = await mockQuoter.getAddress();
  console.log("✅ MockQuoterV2 deployed to:", mockQuoterAddress);

  // 6. Create USDC/WETH pool
  console.log("\n6. 🏊 Creating USDC/WETH pool...");
  
  // Ensure correct token ordering (token0 < token1)
  const [token0Address, token1Address] = mockUSDCAddress < mockWETHAddress 
    ? [mockUSDCAddress, mockWETHAddress]
    : [mockWETHAddress, mockUSDCAddress];
    
  const poolTx = await mockFactory.createPool(
    token0Address,
    token1Address,
    MOCK_POOL_CONFIG.fee
  );
  await poolTx.wait();
  
  const mockPoolAddress = await mockFactory.getPool(token0Address, token1Address, MOCK_POOL_CONFIG.fee);
  console.log("✅ MockUniswapPool created at:", mockPoolAddress);

  // 7. Register pool in router and quoter
  console.log("\n7. 🔗 Registering pool in router and quoter...");
  await mockRouter.registerPool(token0Address, token1Address, MOCK_POOL_CONFIG.fee, mockPoolAddress);
  await mockQuoter.registerPool(token0Address, token1Address, MOCK_POOL_CONFIG.fee, mockPoolAddress);
  console.log("✅ Pool registered in router and quoter");

  // 8. Add initial liquidity to pool
  console.log("\n8. 💧 Adding initial liquidity...");
  
  const usdcAmount = ethers.parseUnits(MOCK_POOL_CONFIG.initialLiquidity.usdc, 6); // USDC has 6 decimals
  const wethAmount = ethers.parseUnits(MOCK_POOL_CONFIG.initialLiquidity.weth, 18); // WETH has 18 decimals
  
  // Mint tokens to deployer
  await mockUSDC.mint(deployer.address, usdcAmount);
  await mockWETH.mint(deployer.address, wethAmount);
  
  // Fund MockWETH with ETH for withdrawals
  const ethFunding = ethers.parseEther("100"); // 100 ETH for testing
  await mockWETH.fundWithETH({ value: ethFunding });
  console.log("✅ MockWETH funded with 100 ETH for withdrawals");
  
  // Add liquidity to pool
  const mockPool = await ethers.getContractAt("MockUniswapPool", mockPoolAddress);
  
  await mockUSDC.approve(mockPoolAddress, usdcAmount);
  await mockWETH.approve(mockPoolAddress, wethAmount);
  
  const liquidityTx = await mockPool.addLiquidity(
    token0Address === mockUSDCAddress ? usdcAmount : wethAmount,
    token1Address === mockWETHAddress ? wethAmount : usdcAmount
  );
  await liquidityTx.wait();
  
  const [reserve0, reserve1] = await mockPool.getReserves();
  console.log(`✅ Liquidity added:`);
  console.log(`   Token0 (${token0Address === mockUSDCAddress ? 'USDC' : 'WETH'}): ${ethers.formatUnits(reserve0, token0Address === mockUSDCAddress ? 6 : 18)}`);
  console.log(`   Token1 (${token1Address === mockWETHAddress ? 'WETH' : 'USDC'}): ${ethers.formatUnits(reserve1, token1Address === mockWETHAddress ? 18 : 6)}`);

  // 9. Test the pool functionality
  console.log("\n9. 🧪 Testing pool functionality...");
  
  const testSwapAmount = ethers.parseUnits("100", 6); // 100 USDC
  await mockUSDC.mint(deployer.address, testSwapAmount);
  
  const quotedAmount = await mockQuoter.quoteExactInputSingle(
    mockUSDCAddress,
    mockWETHAddress,
    MOCK_POOL_CONFIG.fee,
    testSwapAmount,
    0
  );
  
  console.log(`✅ Quote test: ${ethers.formatUnits(testSwapAmount, 6)} USDC → ${ethers.formatEther(quotedAmount)} WETH`);
  console.log(`   Implied price: ${ethers.formatUnits((testSwapAmount * ethers.parseUnits("1", 12)) / quotedAmount, 6)} USDC/WETH`);

  // Save deployment info
  const deployment: MockDeployment = {
    network: network.name,
    chainId: addresses.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    mockContracts: {
      MockWETH: mockWETHAddress,
      MockUSDC: mockUSDCAddress,
      MockSwapRouter: mockRouterAddress,
      MockQuoterV2: mockQuoterAddress,
      MockFactory: mockFactoryAddress,
      MockPool: mockPoolAddress,
    },
    poolConfig: {
      token0: token0Address,
      token1: token1Address,
      fee: MOCK_POOL_CONFIG.fee,
      initialLiquidity: MOCK_POOL_CONFIG.initialLiquidity,
    },
  };

  console.log("\n✅ Mock deployment complete!");
  console.log("\n📊 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💰 MockWETH:       ", mockWETHAddress);
  console.log("💵 MockUSDC:       ", mockUSDCAddress);
  console.log("🏭 MockFactory:    ", mockFactoryAddress);
  console.log("🔄 MockRouter:     ", mockRouterAddress);
  console.log("📊 MockQuoter:     ", mockQuoterAddress);
  console.log("🏊 USDC/WETH Pool: ", mockPoolAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  // Write deployment to file
  const deploymentFile = `./deployments/mocks-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log("📄 Deployment saved to:", deploymentFile);

  console.log("\n🎯 Next Steps:");
  console.log("1. Use these mock addresses in IndexVaultV2 deployment");
  console.log("2. Run tests with: bun run test:mocks");
  console.log("3. Demo rebalancing with: bun run demo:rebalance");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });