#!/bin/bash

# IndexFundToken Deployment Script
# Usage: ./deploy.sh [network] [--verify|--dry-run]
# Examples:
#   ./deploy.sh base              # Deploy to Base without verification
#   ./deploy.sh base --verify     # Deploy to Base with verification
#   ./deploy.sh base --dry-run    # Simulate deployment without broadcasting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please copy .env.example to .env and add your private key"
    exit 1
fi

# Source environment variables
source .env

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set in .env!${NC}"
    exit 1
fi

# Get network from argument
NETWORK=${1:-sepolia}

echo -e "${GREEN}Deploying IndexFundToken to $NETWORK...${NC}"

# Set RPC URL and check API keys based on network
case $NETWORK in
    "mainnet"|"ethereum")
        RPC_URL=${ETHEREUM_RPC_URL:-"https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        VERIFY_FLAG="--verify"
        ;;
    "base")
        RPC_URL=${BASE_RPC_URL:-"https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        REQUIRED_API_KEY="BASESCAN_API_KEY"
        EXPLORER_NAME="Basescan"
        ;;
    "arbitrum")
        RPC_URL=${ARBITRUM_RPC_URL:-"https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        VERIFY_FLAG="--verify"
        ;;
    "polygon")
        RPC_URL=${POLYGON_RPC_URL:-"https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        VERIFY_FLAG="--verify"
        ;;
    "optimism")
        RPC_URL=${OPTIMISM_RPC_URL:-"https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        VERIFY_FLAG="--verify"
        ;;
    "bsc")
        RPC_URL=${BSC_RPC_URL:-"https://bsc-dataseed.binance.org/"}
        VERIFY_FLAG="--verify"
        ;;
    "sepolia")
        RPC_URL=${SEPOLIA_RPC_URL:-"https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"}
        VERIFY_FLAG="--verify"
        ;;
    "base-sepolia")
        RPC_URL=${BASE_SEPOLIA_RPC_URL:-"https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY"}
        VERIFY_FLAG="--verify"
        ;;
    *)
        echo -e "${RED}Error: Unknown network $NETWORK${NC}"
        echo "Supported networks: mainnet, base, arbitrum, polygon, optimism, bsc, sepolia, base-sepolia"
        exit 1
        ;;
esac

# Check API key if verification is requested
if [ "$2" == "--verify" ]; then
    API_KEY_VALUE=$(eval echo \$$REQUIRED_API_KEY)
    if [ -z "$API_KEY_VALUE" ]; then
        echo -e "${RED}Error: $REQUIRED_API_KEY required for $NETWORK verification${NC}"
        echo -e "${YELLOW}Please add $REQUIRED_API_KEY to your .env file${NC}"
        echo -e "${YELLOW}Get your API key from: https://${EXPLORER_NAME,,}.io${NC}"
        echo ""
        echo -e "${YELLOW}Add to .env file:${NC}"
        echo -e "${YELLOW}$REQUIRED_API_KEY=your_api_key_here${NC}"
        echo ""
        echo -e "${YELLOW}Or deploy without verification:${NC}"
        echo -e "${YELLOW}./deploy.sh $NETWORK${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ $EXPLORER_NAME API key found${NC}"
fi

# Check if RPC URL contains placeholder
if [[ $RPC_URL == *"YOUR_API_KEY"* ]]; then
    echo -e "${YELLOW}Warning: RPC URL contains placeholder. Please set ${NETWORK}_RPC_URL in .env${NC}"
    echo -e "Attempting deployment with default RPC..."
fi

# Run deployment
echo -e "${YELLOW}Running deployment script...${NC}"
echo "Network: $NETWORK"
echo "RPC URL: $RPC_URL"

# Validate environment first
echo -e "${YELLOW}Validating environment...${NC}"
if ! forge script script/ValidateEnv.s.sol:ValidateEnvScript --rpc-url "$RPC_URL"; then
    echo -e "${RED}Environment validation failed!${NC}"
    echo "Please fix the issues above before proceeding."
    echo -e "${YELLOW}Most common fix: Add '0x' prefix to PRIVATE_KEY in .env file${NC}"
    exit 1
fi

# Build first
echo -e "${YELLOW}Building contracts...${NC}"
forge build

# Deploy
if [ "$2" == "--dry-run" ]; then
    echo -e "${YELLOW}Dry run mode - not broadcasting${NC}"
    forge script script/IndexFundToken.s.sol:IndexFundTokenScript \
        --rpc-url "$RPC_URL"
elif [ "$2" == "--verify" ]; then
    echo -e "${YELLOW}Deploying with verification enabled${NC}"
    forge script script/IndexFundToken.s.sol:IndexFundTokenScript \
        --rpc-url "$RPC_URL" \
        --broadcast \
        --verify
else
    echo -e "${YELLOW}Deploying without verification${NC}"
    forge script script/IndexFundToken.s.sol:IndexFundTokenScript \
        --rpc-url "$RPC_URL" \
        --broadcast
fi

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${YELLOW}Check the output above for the deployed contract address${NC}"
echo -e "${YELLOW}Save this address for cross-chain configuration${NC}"