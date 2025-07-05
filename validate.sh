#!/bin/bash

# IndexFundToken Environment Validation Script
# Usage: ./validate.sh [network]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== IndexFundToken Environment Validation ===${NC}"

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

# Set RPC URL based on network
case $NETWORK in
    "mainnet"|"ethereum")
        RPC_URL=${ETHEREUM_RPC_URL:-"https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        ;;
    "base")
        RPC_URL=${BASE_RPC_URL:-"https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        ;;
    "arbitrum")
        RPC_URL=${ARBITRUM_RPC_URL:-"https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        ;;
    "polygon")
        RPC_URL=${POLYGON_RPC_URL:-"https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        ;;
    "optimism")
        RPC_URL=${OPTIMISM_RPC_URL:-"https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}
        ;;
    "bsc")
        RPC_URL=${BSC_RPC_URL:-"https://bsc-dataseed.binance.org/"}
        ;;
    "sepolia")
        RPC_URL=${SEPOLIA_RPC_URL:-"https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"}
        ;;
    "base-sepolia")
        RPC_URL=${BASE_SEPOLIA_RPC_URL:-"https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY"}
        ;;
    *)
        echo -e "${RED}Error: Unknown network $NETWORK${NC}"
        echo "Supported networks: mainnet, base, arbitrum, polygon, optimism, bsc, sepolia, base-sepolia"
        exit 1
        ;;
esac

echo -e "${YELLOW}Validating for network: $NETWORK${NC}"
echo -e "${YELLOW}Using RPC URL: $RPC_URL${NC}"

# Build contracts first
echo -e "${YELLOW}Building contracts...${NC}"
if ! forge build; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "${YELLOW}Running validation...${NC}"
echo

# Run validation
if forge script script/ValidateEnv.s.sol:ValidateEnvScript --rpc-url "$RPC_URL"; then
    echo
    echo -e "${GREEN}=== VALIDATION PASSED ===${NC}"
    echo -e "${GREEN}✓ Environment is ready for deployment${NC}"
    echo -e "${GREEN}✓ You can now run: ./deploy.sh $NETWORK${NC}"
else
    echo
    echo -e "${RED}=== VALIDATION FAILED ===${NC}"
    echo -e "${RED}✗ Please fix the issues above before deployment${NC}"
    echo -e "${YELLOW}Common fixes:${NC}"
    echo -e "  • Add '0x' prefix to PRIVATE_KEY in .env"
    echo -e "  • Ensure PRIVATE_KEY is 64 or 66 characters long"
    echo -e "  • Check for invalid characters in PRIVATE_KEY"
    echo -e "  • Make sure wallet has sufficient funds for deployment"
    exit 1
fi 