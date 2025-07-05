import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("📄 Extracting ABIs...");

  const artifactsDir = "./artifacts/contracts";
  const abiDir = "./abis";

  // Create abis directory if it doesn't exist
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  // Contracts to extract
  const contracts = [
    "IndexToken.sol/IndexToken.json",
    "SimpleIndexToken.sol/SimpleIndexToken.json",
    "IndexVault.sol/IndexVault.json",
    "PriceOracle.sol/PriceOracle.json",
    "MockUSDC.sol/MockUSDC.json",
    "MockLayerZeroEndpoint.sol/MockLayerZeroEndpoint.json"
  ];

  for (const contractPath of contracts) {
    const fullPath = path.join(artifactsDir, contractPath);
    
    if (fs.existsSync(fullPath)) {
      const artifact = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      const contractName = path.basename(contractPath, ".json");
      
      // Extract ABI
      const abiPath = path.join(abiDir, `${contractName}.json`);
      fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
      
      console.log(`✅ Extracted ABI: ${contractName}`);
    } else {
      console.log(`⚠️  Artifact not found: ${contractPath}`);
    }
  }

  console.log(`\n📦 ABIs extracted to: ${abiDir}/`);
  console.log("✅ ABI extraction complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });