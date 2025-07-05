# ❗️ This project is not completed - Omni Index Fund

A cross-chain index fund token built with LayerZero V2, deployed on Base with automatic portfolio synchronization capabilities.

## 🎯 Deployed Contract

- **Network**: Base Mainnet
- **Address**: `0x506207f3b434186C90560B6b81A22D7624eA81B2`
- **Explorer**: https://basescan.org/address/0x506207f3b434186C90560B6b81A22D7624eA81B2

## 🚀 Quick Start

### Verify Contract on Basescan

```bash
# Get API key from https://basescan.org/apis
echo "BASESCAN_API_KEY=your_api_key_here" >> .env
./verify-base.sh
```

### Interact with Contract

```bash
./interact.sh info
```

## 📋 Features

- **Cross-chain Portfolio Management**: Manage index fund assets across multiple chains
- **LayerZero V2 Integration**: Secure cross-chain messaging and state synchronization  
- **Base Deployment**: Live on Base mainnet with Basescan verification
- **Automatic Rebalancing**: Portfolio weights stay synchronized across all chains
- **Conflict Resolution**: Built-in mechanisms to handle cross-chain state conflicts
- **Gas Optimized**: Efficient cross-chain operations with minimal gas costs

## 🔧 Development

Built with Foundry - a blazing fast, portable and modular toolkit for Ethereum application development.

### Build

```shell
forge build
```

### Test

```shell
forge test
```

### Deploy to Other Networks

```shell
./deploy.sh arbitrum
./deploy.sh polygon
```

## 📚 Documentation

- **BASE_VERIFICATION.md** - Simple Base verification guide
- **USAGE_GUIDE.md** - How to interact with your deployed contract
- **QUICK_FIX.md** - Troubleshooting common issues

## 🏗️ Architecture

The IndexFundToken uses LayerZero's Omnichain Fungible Token (OFT) standard to maintain a synchronized index fund portfolio across multiple blockchain networks. When portfolio changes occur on one chain, they are automatically propagated to all connected chains through LayerZero's messaging protocol.
