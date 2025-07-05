#!/bin/bash

# Base Contract Verification Script
# Usage: ./verify-base.sh [contract_address]
# Example: ./verify-base.sh 0x506207f3b434186C90560B6b81A22D7624eA81B2

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please copy .env.example to .env and add your BASESCAN_API_KEY"
    exit 1
fi

# Source environment variables
source .env

# Your deployed contract address (default)
CONTRACT_ADDRESS=${1:-0x506207f3b434186C90560B6b81A22D7624eA81B2}

echo -e "${GREEN}🔍 Verifying IndexFundToken on Base...${NC}"
echo "Contract Address: $CONTRACT_ADDRESS"

# Check if BASESCAN_API_KEY is set
if [ -z "$BASESCAN_API_KEY" ]; then
    echo -e "${RED}Error: BASESCAN_API_KEY required for Base verification${NC}"
    echo -e "${YELLOW}Please add BASESCAN_API_KEY to your .env file${NC}"
    echo -e "${YELLOW}Get your API key from: https://basescan.org/apis${NC}"
    echo ""
    echo -e "${YELLOW}Add to .env file:${NC}"
    echo -e "${YELLOW}BASESCAN_API_KEY=your_api_key_here${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Basescan API key found${NC}"

# Base RPC URL
RPC_URL=${BASE_RPC_URL:-"https://base.llamarpc.com"}

# Verify the contract
echo -e "${YELLOW}📋 Verifying contract on Basescan...${NC}"

forge verify-contract \
    --chain-id 8453 \
    --num-of-optimizations 200 \
    --watch \
    --constructor-args $(cast abi-encode "constructor(string,string,address,address)" "OmniFund Index" "OMNI" "0x1a44076050125825900e736c501f859c50fE728c" "0xf91369b5145438a06a020f3d5a6a9f3979515bb1") \
    --compiler-version "0.8.22" \
    $CONTRACT_ADDRESS \
    src/IndexFundToken.sol:IndexFundToken \
    --rpc-url "$RPC_URL"

echo -e "${GREEN}✅ Verification complete!${NC}"
echo -e "${YELLOW}🌐 Check your verified contract on Basescan:${NC}"
echo "https://basescan.org/address/$CONTRACT_ADDRESS#code"
echo ""
echo -e "${GREEN}🎉 Your contract is now verified and ready to use!${NC}" 