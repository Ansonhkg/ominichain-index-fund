import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔍 Testing Uniswap integration on Base Sepolia...\n");

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

  // Check Uniswap contracts exist
  console.log("🔗 Checking Uniswap contracts on Base Sepolia:");
  console.log(`SwapRouter: ${deployment.externalContracts.UniswapV3SwapRouter}`);
  console.log(`QuoterV2: ${deployment.externalContracts.UniswapV3QuoterV2}`);
  console.log(`WETH: ${deployment.externalContracts.WETH}`);
  console.log(`USDC: ${deployment.externalContracts.USDC}`);

  const provider = ethers.provider;
  
  // Check if contracts have code
  for (const [name, address] of Object.entries(deployment.externalContracts)) {
    if (typeof address === 'string') {
      const code = await provider.getCode(address);
      console.log(`${name}: ${code !== "0x" ? "✅ Deployed" : "❌ No code"}`);
    }
  }

  // Test quoter (this should work even if pools don't exist)
  try {
    console.log("\n💱 Testing Uniswap QuoterV2...");
    
    const quoterABI = [
      "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
    ];
    
    const quoter = new ethers.Contract(
      deployment.externalContracts.UniswapV3QuoterV2,
      quoterABI,
      signer
    );

    // Try to quote 0.1 USDC for WETH
    const usdcAmount = ethers.parseUnits("0.1", 6); // 0.1 USDC
    const fee = 3000; // 0.3% fee tier
    
    console.log(`Quoting ${ethers.formatUnits(usdcAmount, 6)} USDC for WETH...`);
    
    const expectedWeth = await quoter.quoteExactInputSingle.staticCall(
      deployment.externalContracts.USDC,
      deployment.externalContracts.WETH,
      fee,
      usdcAmount,
      0
    );
    
    console.log(`Expected WETH: ${ethers.formatEther(expectedWeth)} WETH`);
    
    if (expectedWeth > 0n) {
      console.log("✅ Uniswap pools exist and have liquidity!");
    } else {
      console.log("⚠️  No liquidity or price available");
    }

  } catch (error: any) {
    console.error("❌ Quoter failed:", error.message);
    
    if (error.message.includes("Pool does not exist")) {
      console.log("💡 USDC/WETH pool doesn't exist on Base Sepolia");
    } else if (error.message.includes("SPL")) {
      console.log("💡 No liquidity in the pool");
    }
  }

  // Check our vault's setup
  console.log("\n🏦 Checking IndexVault setup:");
  const indexVault = await ethers.getContractAt("IndexVaultV2", deployment.contracts.IndexVaultV2);
  
  try {
    const usdcBalance = await indexVault.usdcBalance();
    console.log(`Vault USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    
    // Check if vault has the right addresses
    console.log("\n🔗 Vault contract addresses:");
    // These are public variables in the contract
    console.log("Checking if vault is properly configured...");
    
  } catch (error: any) {
    console.error("❌ Vault check failed:", error.message);
  }

  console.log("\n💡 Recommendations:");
  console.log("1. Use Base Mainnet instead of Sepolia for real Uniswap liquidity");
  console.log("2. Or provide liquidity to Base Sepolia pools first");
  console.log("3. Or test with a DEX that has more testnet liquidity");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });