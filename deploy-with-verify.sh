#!/bin/bash

# IndexFundToken Deployment Script WITH Verification
# Usage: ./deploy-with-verify.sh [network]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== IndexFundToken Deployment WITH Verification ===${NC}"

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

echo -e "${GREEN}Deploying IndexFundToken to $NETWORK with verification...${NC}"

# Check for API keys based on network
case $NETWORK in
    "mainnet"|"ethereum"|"sepolia")
        if [ -z "$ETHERSCAN_API_KEY" ]; then
            echo -e "${RED}Error: ETHERSCAN_API_KEY required for $NETWORK verification${NC}"
            echo "Please add ETHERSCAN_API_KEY to your .env file"
            exit 1
        fi
        ;;
    "base"|"base-sepolia")
        if [ -z "$BASESCAN_API_KEY" ]; then
            echo -e "${RED}Error: BASESCAN_API_KEY required for $NETWORK verification${NC}"
            echo "Please add BASESCAN_API_KEY to your .env file"
            exit 1
        fi
        ;;
    "arbitrum")
        if [ -z "$ARBISCAN_API_KEY" ]; then
            echo -e "${RED}Error: ARBISCAN_API_KEY required for $NETWORK verification${NC}"
            echo "Please add ARBISCAN_API_KEY to your .env file"
            exit 1
        fi
        ;;
    "polygon")
        if [ -z "$POLYGONSCAN_API_KEY" ]; then
            echo -e "${RED}Error: POLYGONSCAN_API_KEY required for $NETWORK verification${NC}"
            echo "Please add POLYGONSCAN_API_KEY to your .env file"
            exit 1
        fi
        ;;
    "optimism")
        if [ -z "$OPTIMISMSCAN_API_KEY" ]; then
            echo -e "${RED}Error: OPTIMISMSCAN_API_KEY required for $NETWORK verification${NC}"
            echo "Please add OPTIMISMSCAN_API_KEY to your .env file"
            exit 1
        fi
        ;;
    "bsc")
        if [ -z "$BSCSCAN_API_KEY" ]; then
            echo -e "${RED}Error: BSCSCAN_API_KEY required for $NETWORK verification${NC}"
            echo "Please add BSCSCAN_API_KEY to your .env file"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}Error: Unknown network $NETWORK${NC}"
        echo "Supported networks: mainnet, base, arbitrum, polygon, optimism, bsc, sepolia, base-sepolia"
        exit 1
        ;;
esac

# Use the main deployment script with verify flag
echo -e "${YELLOW}Running deployment with verification...${NC}"
./deploy.sh $NETWORK --verify

echo -e "${GREEN}Deployment with verification complete!${NC}"
echo -e "${YELLOW}Your contract should be verified on the block explorer${NC}" 