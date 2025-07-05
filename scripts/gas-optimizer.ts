import { ethers, network } from "hardhat";

interface GasEstimate {
  operation: string;
  estimatedGas: bigint;
  estimatedCostETH: string;
  estimatedCostUSD: string;
}

interface GasOptimizationReport {
  network: string;
  gasPrice: bigint;
  ethPriceUSD: number;
  estimates: GasEstimate[];
  totalEstimatedCost: string;
  timestamp: number;
}

async function main() {
  console.log("⛽ GAS OPTIMIZATION ANALYSIS");
  console.log("=".repeat(50));
  console.log("🌐 Network:", network.name);
  console.log("📅 Date:", new Date().toISOString());

  const [deployer] = await ethers.getSigners();
  console.log("👤 Account:", deployer.address);

  // Get current gas price
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice || 0n;
  console.log("⛽ Current Gas Price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

  // Mock ETH price (in production, fetch from an oracle)
  const ethPriceUSD = 2500; // $2500 per ETH
  console.log("💰 ETH Price (assumed):", `$${ethPriceUSD}`);

  const estimates: GasEstimate[] = [];

  // Helper function to calculate costs
  function calculateCosts(operation: string, gasEstimate: bigint): GasEstimate {
    const costWei = gasEstimate * gasPrice;
    const costETH = ethers.formatEther(costWei);
    const costUSD = (parseFloat(costETH) * ethPriceUSD).toFixed(2);
    
    return {
      operation,
      estimatedGas: gasEstimate,
      estimatedCostETH: costETH,
      estimatedCostUSD: costUSD
    };
  }

  console.log("\\n📊 GAS ESTIMATES FOR MAINNET OPERATIONS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // 1. Contract Deployment Estimates
    console.log("\\n🏗️  CONTRACT DEPLOYMENTS:");
    
    // PriceOracle deployment
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracleGas = await PriceOracle.getDeployTransaction(
      deployer.address,
      "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019" // Mock FTSO registry
    ).then(tx => ethers.provider.estimateGas(tx));
    estimates.push(calculateCosts("Deploy PriceOracle", priceOracleGas));

    // IndexToken deployment  
    const IndexToken = await ethers.getContractFactory("IndexToken");
    const indexTokenGas = await IndexToken.getDeployTransaction(
      "0x1a44076050125825900e736c501f859c50fE728c", // LayerZero endpoint
      deployer.address
    ).then(tx => ethers.provider.estimateGas(tx));
    estimates.push(calculateCosts("Deploy IndexToken (OFT)", indexTokenGas));

    // IndexVaultV2 deployment
    const IndexVaultV2 = await ethers.getContractFactory("IndexVaultV2");
    const vaultGas = await IndexVaultV2.getDeployTransaction(
      ethers.ZeroAddress, // Placeholder addresses
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      deployer.address
    ).then(tx => ethers.provider.estimateGas(tx));
    estimates.push(calculateCosts("Deploy IndexVaultV2", vaultGas));

    // 2. Configuration Operations
    console.log("\\n⚙️  CONFIGURATION OPERATIONS:");
    
    // Basic function call estimates (approximate)
    estimates.push(calculateCosts("Set Vault (IndexToken)", 50000n));
    estimates.push(calculateCosts("Add Price Updater", 45000n));
    estimates.push(calculateCosts("Set LayerZero Peer", 55000n));
    estimates.push(calculateCosts("Update Price (single)", 35000n));
    estimates.push(calculateCosts("Update Multiple Prices", 80000n));

    // 3. User Operations
    console.log("\\n👤 USER OPERATIONS:");
    estimates.push(calculateCosts("Deposit USDC (first time)", 180000n));
    estimates.push(calculateCosts("Deposit USDC (subsequent)", 120000n));
    estimates.push(calculateCosts("Withdraw INDEX", 150000n));
    estimates.push(calculateCosts("Cross-chain Transfer", 200000n));

    // 4. Vault Operations
    console.log("\\n🏦 VAULT OPERATIONS:");
    estimates.push(calculateCosts("Portfolio Rebalance (small)", 300000n));
    estimates.push(calculateCosts("Portfolio Rebalance (large)", 500000n));
    estimates.push(calculateCosts("Single Swap (USDC→ETH)", 150000n));
    estimates.push(calculateCosts("Emergency Pause", 30000n));

    // Display results
    console.log("\\n📊 DETAILED GAS ESTIMATES:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Operation".padEnd(30) + "Gas".padEnd(12) + "ETH".padEnd(12) + "USD");
    console.log("-".repeat(65));

    let totalCostETH = 0;
    for (const estimate of estimates) {
      console.log(
        estimate.operation.padEnd(30) +
        estimate.estimatedGas.toString().padEnd(12) +
        estimate.estimatedCostETH.padEnd(12) +
        `$${estimate.estimatedCostUSD}`
      );
      totalCostETH += parseFloat(estimate.estimatedCostETH);
    }

    console.log("-".repeat(65));
    console.log(`TOTAL ESTIMATED COST:`.padEnd(42) + `${totalCostETH.toFixed(6)} ETH`.padEnd(12) + `$${(totalCostETH * ethPriceUSD).toFixed(2)}`);

    // Create optimization report
    const report: GasOptimizationReport = {
      network: network.name,
      gasPrice,
      ethPriceUSD,
      estimates,
      totalEstimatedCost: `${totalCostETH.toFixed(6)} ETH ($${(totalCostETH * ethPriceUSD).toFixed(2)})`,
      timestamp: Date.now()
    };

    // Save report
    const filename = `./reports/gas-analysis-${network.name}-${Date.now()}.json`;
    const fs = require("fs");
    if (!fs.existsSync("./reports")) {
      fs.mkdirSync("./reports");
    }
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));

    console.log("\\n💡 GAS OPTIMIZATION RECOMMENDATIONS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("1. 🕐 Deploy during low gas periods (weekends, late nights UTC)");
    console.log("2. 📦 Batch multiple configuration operations in single transaction");
    console.log("3. ⚡ Use gas price optimization (monitor gas tracker)");
    console.log("4. 🔄 Implement gas price alerts for automated operations");
    console.log("5. 💰 Consider gas rebates for high-value users");

    if (gasPrice > ethers.parseUnits("50", "gwei")) {
      console.log("\\n⚠️  WARNING: Current gas price is HIGH. Consider waiting for lower fees.");
    } else if (gasPrice < ethers.parseUnits("20", "gwei")) {
      console.log("\\n✅ Good gas price for deployment and operations!");
    }

    console.log(`\\n📄 Detailed report saved: ${filename}`);

  } catch (error) {
    console.error("❌ Gas estimation failed:", (error as Error).message);
  }

  console.log("\\n" + "=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });