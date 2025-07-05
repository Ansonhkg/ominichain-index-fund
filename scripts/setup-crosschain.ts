import { ethers, network } from "hardhat";
import * as fs from "fs";
import { getLayerZeroEndpointId } from "../config/addresses";

interface CrossChainConfig {
  chainName: string;
  deploymentFile: string;
  indexTokenAddress: string;
  layerZeroEndpointId: number;
}

async function main() {
  console.log("🌉 CROSS-CHAIN SETUP - LayerZero Peer Connections");
  console.log("=".repeat(70));
  console.log("🌐 Current Network:", network.name);
  console.log("📅 Date:", new Date().toISOString());
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("👤 Setup account:", deployer.address);

  // Find all mainnet deployment files
  const deploymentFiles = fs.readdirSync("./deployments").filter(f => 
    f.includes("mainnet") && f.endsWith(".json") && !f.includes("failed")
  );

  if (deploymentFiles.length === 0) {
    console.error("❌ No mainnet deployment files found. Deploy contracts first.");
    process.exit(1);
  }

  console.log(`\\n📁 Found ${deploymentFiles.length} deployment files:`);
  deploymentFiles.forEach(f => console.log(`   📄 ${f}`));

  const chainConfigs: CrossChainConfig[] = [];

  // Load deployment configurations
  for (const file of deploymentFiles) {
    try {
      const deployment = JSON.parse(fs.readFileSync(`./deployments/${file}`, "utf8"));
      
      chainConfigs.push({
        chainName: deployment.networkName,
        deploymentFile: file,
        indexTokenAddress: deployment.contracts.IndexToken,
        layerZeroEndpointId: deployment.layerZeroEndpointId
      });
      
      console.log(`✅ Loaded config for ${deployment.networkName}`);
    } catch (error) {
      console.warn(`⚠️  Failed to load ${file}:`, (error as Error).message);
    }
  }

  if (chainConfigs.length < 2) {
    console.error("❌ Need at least 2 deployed chains for cross-chain setup");
    process.exit(1);
  }

  console.log("\\n🔗 SETTING UP CROSS-CHAIN CONNECTIONS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Find current network config
  const currentChainConfig = chainConfigs.find(c => c.chainName === network.name);
  if (!currentChainConfig) {
    console.error(`❌ Current network ${network.name} not found in deployments`);
    process.exit(1);
  }

  // Get IndexToken contract for current chain
  const indexToken = await ethers.getContractAt("IndexToken", currentChainConfig.indexTokenAddress);
  console.log(`🪙 Connected to IndexToken on ${network.name}:`, currentChainConfig.indexTokenAddress);

  let connectionsSetUp = 0;

  // Set up peer connections to all other chains
  for (const peerConfig of chainConfigs) {
    if (peerConfig.chainName === network.name) continue; // Skip self

    console.log(`\\n🌉 Setting up connection: ${network.name} → ${peerConfig.chainName}`);
    console.log(`   📍 Peer Endpoint ID: ${peerConfig.layerZeroEndpointId}`);
    console.log(`   🪙 Peer IndexToken: ${peerConfig.indexTokenAddress}`);

    try {
      // Set peer for the remote chain
      const setPeerTx = await indexToken.setPeer(
        peerConfig.layerZeroEndpointId,
        ethers.zeroPadValue(peerConfig.indexTokenAddress, 32)
      );
      await setPeerTx.wait();

      console.log(`✅ Peer connection established: ${network.name} → ${peerConfig.chainName}`);
      console.log(`   📄 Transaction: ${setPeerTx.hash}`);
      
      connectionsSetUp++;

    } catch (error) {
      console.error(`❌ Failed to set peer for ${peerConfig.chainName}:`, (error as Error).message);
    }
  }

  // Verify peer connections
  console.log("\\n🔍 VERIFYING PEER CONNECTIONS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  for (const peerConfig of chainConfigs) {
    if (peerConfig.chainName === network.name) continue;

    try {
      const peer = await indexToken.peers(peerConfig.layerZeroEndpointId);
      const expectedPeer = ethers.zeroPadValue(peerConfig.indexTokenAddress, 32);
      
      if (peer.toLowerCase() === expectedPeer.toLowerCase()) {
        console.log(`✅ ${peerConfig.chainName}: Peer verified`);
      } else {
        console.warn(`⚠️  ${peerConfig.chainName}: Peer mismatch`);
        console.log(`   Expected: ${expectedPeer}`);
        console.log(`   Actual:   ${peer}`);
      }
    } catch (error) {
      console.error(`❌ Failed to verify peer for ${peerConfig.chainName}:`, (error as Error).message);
    }
  }

  // Save cross-chain configuration
  const crossChainConfig = {
    setupNetwork: network.name,
    timestamp: Date.now(),
    deployer: deployer.address,
    connectionsSetUp,
    totalPossibleConnections: chainConfigs.length - 1,
    chainConfigs,
    peerConnections: chainConfigs
      .filter(c => c.chainName !== network.name)
      .map(c => ({
        targetChain: c.chainName,
        endpointId: c.layerZeroEndpointId,
        indexTokenAddress: c.indexTokenAddress
      }))
  };

  const configFilename = `./deployments/crosschain-setup-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(configFilename, JSON.stringify(crossChainConfig, null, 2));

  console.log("\\n✅ CROSS-CHAIN SETUP COMPLETE!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🌐 Network: ${network.name}`);
  console.log(`🔗 Connections Set Up: ${connectionsSetUp}/${chainConfigs.length - 1}`);
  console.log(`📄 Configuration saved: ${configFilename}`);

  if (connectionsSetUp === chainConfigs.length - 1) {
    console.log("\\n🎯 NEXT STEPS:");
    console.log("1. Repeat this setup on other networks:");
    
    for (const config of chainConfigs) {
      if (config.chainName !== network.name) {
        const scriptName = config.chainName.replace("Mainnet", "").toLowerCase();
        console.log(`   npm run setup:crosschain:${scriptName}`);
      }
    }
    
    console.log("2. Test cross-chain transfer: npm run test:crosschain");
    console.log("3. Set up price feed synchronization: npm run setup:pricefeeds");
  } else {
    console.warn("⚠️  Some connections failed. Check errors above and retry.");
  }

  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });