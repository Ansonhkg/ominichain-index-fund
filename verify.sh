#!/bin/bash

# Manual Contract Verification Script
# Usage: ./verify.sh [network] [contract_address]
# Example: ./verify.sh base 0x506207f3b434186C90560B6b81A22D7624eA81B2

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please copy .env.example to .env and add your API keys"
    exit 1
fi

# Source environment variables
source .env

# Get parameters
NETWORK=${1:-base}
CONTRACT_ADDRESS=${2:-0x506207f3b434186C90560B6b81A22D7624eA81B2}

echo -e "${GREEN}Verifying contract on $NETWORK...${NC}"
echo "Contract Address: $CONTRACT_ADDRESS"

# Set RPC URL and check API keys based on network
case $NETWORK in
    "mainnet"|"ethereum")
        RPC_URL=${ETHEREUM_RPC_URL:-"https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="ETHERSCAN_API_KEY"
        EXPLORER_NAME="Etherscan"
        ;;
    "base")
        RPC_URL=${BASE_RPC_URL:-"https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="BASESCAN_API_KEY"
        EXPLORER_NAME="Basescan"
        ;;
    "arbitrum")
        RPC_URL=${ARBITRUM_RPC_URL:-"https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="ARBISCAN_API_KEY"
        EXPLORER_NAME="Arbiscan"
        ;;
    "polygon")
        RPC_URL=${POLYGON_RPC_URL:-"https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="POLYGONSCAN_API_KEY"
        EXPLORER_NAME="Polygonscan"
        ;;
    "optimism")
        RPC_URL=${OPTIMISM_RPC_URL:-"https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="OPTIMISMSCAN_API_KEY"
        EXPLORER_NAME="Optimismscan"
        ;;
    "bsc")
        RPC_URL=${BSC_RPC_URL:-"https://bsc-dataseed.binance.org/"}
        REQUIRED_API_KEY="BSCSCAN_API_KEY"
        EXPLORER_NAME="BscScan"
        ;;
    "sepolia")
        RPC_URL=${SEPOLIA_RPC_URL:-"https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="ETHERSCAN_API_KEY"
        EXPLORER_NAME="Etherscan"
        ;;
    "base-sepolia")
        RPC_URL=${BASE_SEPOLIA_RPC_URL:-"https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="BASESCAN_API_KEY"
        EXPLORER_NAME="Basescan"
        ;;
    *)
        echo -e "${RED}Error: Unknown network $NETWORK${NC}"
        echo "Supported networks: mainnet, base, arbitrum, polygon, optimism, bsc, sepolia, base-sepolia"
        exit 1
        ;;
esac

# Check API key
API_KEY_VALUE=$(eval echo \$$REQUIRED_API_KEY)
if [ -z "$API_KEY_VALUE" ]; then
    echo -e "${RED}Error: $REQUIRED_API_KEY required for $NETWORK verification${NC}"
    echo -e "${YELLOW}Please add $REQUIRED_API_KEY to your .env file${NC}"
    echo -e "${YELLOW}Get your API key from: https://${EXPLORER_NAME,,}.org/apis${NC}"
    exit 1
fi

echo -e "${GREEN}✓ $EXPLORER_NAME API key found${NC}"

# Verify the contract
echo -e "${YELLOW}Verifying IndexFundToken contract...${NC}"

forge verify-contract \
    --chain-id $(cast chain-id --rpc-url "$RPC_URL") \
    --num-of-optimizations 200 \
    --watch \
    --constructor-args $(cast abi-encode "constructor(string,string,address,address)" "OmniFund Index" "OMNI" "0x1a44076050125825900e736c501f859c50fE728c" "0xf91369b5145438a06a020f3d5a6a9f3979515bb1") \
    --compiler-version "0.8.22" \
    $CONTRACT_ADDRESS \
    src/IndexFundToken.sol:IndexFundToken \
    --rpc-url "$RPC_URL"

echo -e "${GREEN}✓ Verification complete!${NC}"
echo -e "${YELLOW}Check your contract on the block explorer:${NC}"

case $NETWORK in
    "mainnet"|"ethereum")
        echo "https://etherscan.io/address/$CONTRACT_ADDRESS#code"
        ;;
    "base")
        echo "https://basescan.org/address/$CONTRACT_ADDRESS#code"
        ;;
    "arbitrum")
        echo "https://arbiscan.io/address/$CONTRACT_ADDRESS#code"
        ;;
    "polygon")
        echo "https://polygonscan.com/address/$CONTRACT_ADDRESS#code"
        ;;
    "optimism")
        echo "https://optimistic.etherscan.io/address/$CONTRACT_ADDRESS#code"
        ;;
    "bsc")
        echo "https://bscscan.com/address/$CONTRACT_ADDRESS#code"
        ;;
    "sepolia")
        echo "https://sepolia.etherscan.io/address/$CONTRACT_ADDRESS#code"
        ;;
    "base-sepolia")
        echo "https://base-sepolia.basescan.org/address/$CONTRACT_ADDRESS#code"
        ;;
esac 