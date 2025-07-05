import { ethers } from "hardhat";
import OpenAI from "openai";
import * as fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function getPortfolioData() {
  const deployment = await getLatestDeployment();
  
  const priceOracle = await ethers.getContractAt("PriceOracle", deployment.contracts.PriceOracle);
  
  // Check if we have SimpleIndexToken or IndexToken
  const tokenAddress = deployment.contracts.SimpleIndexToken || deployment.contracts.IndexToken;
  const tokenContractName = deployment.contracts.SimpleIndexToken ? "SimpleIndexToken" : "IndexToken";
  const indexToken = await ethers.getContractAt(tokenContractName, tokenAddress);
  
  const indexVault = await ethers.getContractAt("IndexVault", deployment.contracts.IndexVault);
  
  const ethPrice = await priceOracle.getPrice("ETH");
  const flowPrice = await priceOracle.getPrice("FLOW");
  const usdcPrice = await priceOracle.getPrice("USDC");
  
  const totalSupply = await indexToken.totalSupply();
  const portfolioValue = await indexVault.getPortfolioValue();
  
  const ethBalance = await indexVault.ethBalance();
  const usdcBalance = await indexVault.usdcBalance();
  const flowBalance = await indexVault.flowBalance();
  
  return {
    prices: {
      ETH: ethers.formatUnits(ethPrice, 18),
      FLOW: ethers.formatUnits(flowPrice, 18),
      USDC: ethers.formatUnits(usdcPrice, 18)
    },
    balances: {
      ETH: ethers.formatUnits(ethBalance, 18),
      USDC: ethers.formatUnits(usdcBalance, 6),
      FLOW: ethers.formatUnits(flowBalance, 18)
    },
    totalSupply: ethers.formatUnits(totalSupply, 18),
    portfolioValue: ethers.formatUnits(portfolioValue, 6),
    targetAllocations: {
      ETH: 40,
      USDC: 30,
      FLOW: 30
    }
  };
}

async function generateAnalysis(portfolioData: any) {
  const prompt = `
Analyze this multichain index fund portfolio and provide insights:

Portfolio Data:
- Total INDEX tokens: ${portfolioData.totalSupply}
- Total portfolio value: $${portfolioData.portfolioValue}

Current Prices:
- ETH: $${portfolioData.prices.ETH}
- FLOW: $${portfolioData.prices.FLOW}
- USDC: $${portfolioData.prices.USDC}

Current Balances:
- ETH: ${portfolioData.balances.ETH}
- USDC: ${portfolioData.balances.USDC}
- FLOW: ${portfolioData.balances.FLOW}

Target Allocations:
- ETH: ${portfolioData.targetAllocations.ETH}%
- USDC: ${portfolioData.targetAllocations.USDC}%
- FLOW: ${portfolioData.targetAllocations.FLOW}%

Please provide:
1. Current allocation percentages
2. Whether rebalancing is needed
3. Risk assessment
4. Recommendations for the next 24 hours
5. Any alerts or concerns

Keep the analysis concise and actionable.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a DeFi portfolio analyst specializing in multichain index funds. Provide clear, actionable insights."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 800,
    temperature: 0.3
  });

  return completion.choices[0].message.content;
}

async function main() {
  console.log("🔍 Starting AI Portfolio Monitor...");
  
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not found in environment variables");
    process.exit(1);
  }
  
  try {
    console.log("📊 Fetching portfolio data...");
    const portfolioData = await getPortfolioData();
    
    console.log("🤖 Generating AI analysis...");
    const analysis = await generateAnalysis(portfolioData);
    
    console.log("\n" + "=".repeat(60));
    console.log("📈 PORTFOLIO ANALYSIS REPORT");
    console.log("=".repeat(60));
    console.log(`⏰ Generated at: ${new Date().toLocaleString()}`);
    console.log("");
    console.log(analysis);
    console.log("=".repeat(60));
    
    // Save report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      portfolioData,
      analysis
    };
    
    const reportFileName = `./reports/portfolio-report-${Date.now()}.json`;
    if (!fs.existsSync("./reports")) {
      fs.mkdirSync("./reports");
    }
    
    fs.writeFileSync(reportFileName, JSON.stringify(reportData, null, 2));
    console.log(`💾 Report saved to: ${reportFileName}`);
    
  } catch (error) {
    console.error("❌ Error in portfolio monitoring:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main as monitorPortfolio };