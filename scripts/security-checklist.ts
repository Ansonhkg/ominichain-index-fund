import { ethers, network } from "hardhat";
import * as fs from "fs";

interface SecurityCheck {
  category: string;
  check: string;
  status: "PASS" | "FAIL" | "WARNING" | "MANUAL";
  details: string;
  recommendation?: string;
}

interface SecurityReport {
  network: string;
  timestamp: number;
  deployer: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  manualChecks: number;
  checks: SecurityCheck[];
  overallStatus: "SAFE" | "CAUTION" | "UNSAFE";
}

async function main() {
  console.log("🔒 SECURITY CHECKLIST FOR MAINNET DEPLOYMENT");
  console.log("=".repeat(60));
  console.log("🌐 Network:", network.name);
  console.log("📅 Date:", new Date().toISOString());

  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);

  const checks: SecurityCheck[] = [];

  // Helper function to add checks
  function addCheck(category: string, check: string, status: SecurityCheck["status"], details: string, recommendation?: string) {
    checks.push({ category, check, status, details, recommendation });
  }

  console.log("\\n🔍 PERFORMING SECURITY CHECKS...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // 1. ENVIRONMENT CHECKS
  console.log("\\n🌍 ENVIRONMENT SECURITY:");
  
  // Check if we're on mainnet
  const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
  const isMainnet = ["8453", "747", "14"].includes(chainId.toString()); // Base, Flow, Flare mainnets
  addCheck(
    "Environment",
    "Deploying to Mainnet",
    isMainnet ? "PASS" : "FAIL",
    `Chain ID: ${chainId}, Is Mainnet: ${isMainnet}`,
    isMainnet ? undefined : "This should only run on mainnet networks"
  );

  // Check private key security
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    addCheck("Environment", "Private Key Security", "FAIL", "No valid private key set", "Set a secure private key in environment variables");
  } else if (privateKey.length !== 66) {
    addCheck("Environment", "Private Key Format", "FAIL", "Invalid private key format", "Ensure private key is 64 hex characters plus 0x prefix");
  } else {
    addCheck("Environment", "Private Key Security", "PASS", "Valid private key format", "Ensure key is stored securely");
  }

  // 2. ACCOUNT SECURITY
  console.log("\\n👤 ACCOUNT SECURITY:");
  
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceETH = parseFloat(ethers.formatEther(balance));
  
  if (balanceETH < 0.01) {
    addCheck("Account", "Sufficient Balance", "FAIL", `Balance: ${balanceETH} ETH`, "Fund account with sufficient ETH for deployment");
  } else if (balanceETH < 0.1) {
    addCheck("Account", "Sufficient Balance", "WARNING", `Balance: ${balanceETH} ETH`, "Consider adding more ETH for safety margin");
  } else {
    addCheck("Account", "Sufficient Balance", "PASS", `Balance: ${balanceETH} ETH`, undefined);
  }

  // Check if deployer is a known address (could be compromised)
  const knownTestAddresses = [
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Hardhat test address
    "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"  // Another common test address
  ];
  
  if (knownTestAddresses.includes(deployer.address.toLowerCase())) {
    addCheck("Account", "Address Security", "FAIL", "Using known test address", "Use a fresh, secure address for mainnet");
  } else {
    addCheck("Account", "Address Security", "PASS", "Using unique address", undefined);
  }

  // 3. CONTRACT SECURITY
  console.log("\\n📜 CONTRACT SECURITY:");

  // Check for test/debug code
  const contractFiles = [
    "./contracts/IndexToken.sol",
    "./contracts/IndexVaultV2.sol", 
    "./contracts/PriceOracle.sol"
  ];

  for (const file of contractFiles) {
    try {
      const content = fs.readFileSync(file, "utf8");
      
      // Check for test/debug patterns
      const debugPatterns = [
        /console\.log/gi,
        /debug/gi,
        /test.*only/gi,
        /\/\/.*TODO/gi,
        /\/\/.*FIXME/gi,
        /\/\/.*HACK/gi
      ];
      
      let foundIssues = [];
      for (const pattern of debugPatterns) {
        if (pattern.test(content)) {
          foundIssues.push(pattern.source);
        }
      }
      
      if (foundIssues.length > 0) {
        addCheck("Contract", `Debug Code Check: ${file}`, "WARNING", `Found: ${foundIssues.join(", ")}`, "Remove debug code before mainnet");
      } else {
        addCheck("Contract", `Debug Code Check: ${file}`, "PASS", "No debug code found", undefined);
      }
      
    } catch (error) {
      addCheck("Contract", `File Check: ${file}`, "WARNING", "Could not read file", "Ensure all contract files exist");
    }
  }

  // 4. DEPENDENCY SECURITY
  console.log("\\n📦 DEPENDENCY SECURITY:");
  
  try {
    const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));
    
    // Check for known secure versions
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // OpenZeppelin version check
    const ozVersion = dependencies["@openzeppelin/contracts"];
    if (ozVersion && ozVersion.includes("5.0")) {
      addCheck("Dependencies", "OpenZeppelin Version", "PASS", `Using version: ${ozVersion}`, undefined);
    } else {
      addCheck("Dependencies", "OpenZeppelin Version", "WARNING", `Version: ${ozVersion || "not found"}`, "Use latest stable OpenZeppelin version");
    }
    
    // LayerZero version check
    const lzVersion = dependencies["@layerzerolabs/oft-evm"];
    if (lzVersion) {
      addCheck("Dependencies", "LayerZero Version", "PASS", `Using version: ${lzVersion}`, undefined);
    } else {
      addCheck("Dependencies", "LayerZero Version", "WARNING", "LayerZero OFT not found", "Ensure LayerZero dependency is included");
    }
    
  } catch (error) {
    addCheck("Dependencies", "Package.json Check", "FAIL", "Could not read package.json", "Ensure package.json exists and is valid");
  }

  // 5. NETWORK SECURITY
  console.log("\\n🌐 NETWORK SECURITY:");
  
  // Check RPC URL security
  const rpcUrl = network.config.url;
  if (rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1")) {
    addCheck("Network", "RPC URL Security", "FAIL", "Using local RPC", "Use secure mainnet RPC for deployment");
  } else if (rpcUrl.startsWith("https://")) {
    addCheck("Network", "RPC URL Security", "PASS", "Using HTTPS RPC", undefined);
  } else {
    addCheck("Network", "RPC URL Security", "WARNING", "Non-HTTPS RPC", "Use HTTPS RPC endpoints for security");
  }

  // 6. MANUAL CHECKS
  console.log("\\n✅ MANUAL VERIFICATION REQUIRED:");
  
  addCheck("Manual", "Code Audit", "MANUAL", "Professional audit recommended", "Have contracts audited by security firm");
  addCheck("Manual", "Multisig Setup", "MANUAL", "Consider multisig for admin functions", "Use multisig wallet for contract ownership");
  addCheck("Manual", "Emergency Procedures", "MANUAL", "Emergency response plan needed", "Prepare incident response procedures");
  addCheck("Manual", "Insurance Coverage", "MANUAL", "Consider smart contract insurance", "Evaluate insurance options");
  addCheck("Manual", "Legal Compliance", "MANUAL", "Regulatory compliance check", "Consult legal team on regulations");

  // Generate report
  const passed = checks.filter(c => c.status === "PASS").length;
  const failed = checks.filter(c => c.status === "FAIL").length;
  const warnings = checks.filter(c => c.status === "WARNING").length;
  const manual = checks.filter(c => c.status === "MANUAL").length;

  let overallStatus: SecurityReport["overallStatus"] = "SAFE";
  if (failed > 0) overallStatus = "UNSAFE";
  else if (warnings > 2) overallStatus = "CAUTION";

  const report: SecurityReport = {
    network: network.name,
    timestamp: Date.now(),
    deployer: deployer.address,
    totalChecks: checks.length,
    passed,
    failed,
    warnings,
    manualChecks: manual,
    checks,
    overallStatus
  };

  // Display results
  console.log("\\n📊 SECURITY REPORT SUMMARY:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`⚠️  WARNINGS: ${warnings}`);
  console.log(`📋 MANUAL: ${manual}`);
  console.log(`🎯 OVERALL STATUS: ${overallStatus}`);

  if (failed > 0) {
    console.log("\\n❌ CRITICAL ISSUES FOUND:");
    checks.filter(c => c.status === "FAIL").forEach(check => {
      console.log(`   ${check.category}: ${check.check}`);
      console.log(`   Issue: ${check.details}`);
      if (check.recommendation) {
        console.log(`   Fix: ${check.recommendation}`);
      }
      console.log("");
    });
  }

  if (warnings > 0) {
    console.log("\\n⚠️  WARNINGS:");
    checks.filter(c => c.status === "WARNING").forEach(check => {
      console.log(`   ${check.category}: ${check.check} - ${check.details}`);
    });
  }

  // Save report
  if (!fs.existsSync("./reports")) {
    fs.mkdirSync("./reports");
  }
  const filename = `./reports/security-checklist-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));

  console.log("\\n🔒 SECURITY RECOMMENDATIONS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. 🛡️  Run full test suite before deployment");
  console.log("2. 🔍 Have contracts professionally audited");
  console.log("3. 🗝️  Use hardware wallet for deployment");
  console.log("4. 🚨 Set up monitoring and alerting");
  console.log("5. 📝 Prepare incident response procedures");
  console.log("6. 💰 Start with small test amounts");
  console.log("7. 🔄 Implement timelock for admin functions");

  console.log(`\\n📄 Security report saved: ${filename}`);

  if (overallStatus === "UNSAFE") {
    console.log("\\n🚨 DEPLOYMENT NOT RECOMMENDED - Fix critical issues first!");
    process.exit(1);
  } else if (overallStatus === "CAUTION") {
    console.log("\\n⚠️  PROCEED WITH CAUTION - Address warnings before deployment");
  } else {
    console.log("\\n✅ SECURITY CHECKS PASSED - Ready for deployment!");
  }

  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });