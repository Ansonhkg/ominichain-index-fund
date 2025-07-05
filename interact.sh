#!/bin/bash

# IndexFundToken Interaction Script
# Usage: ./interact.sh [command] [args...]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    exit 1
fi
source .env

# Contract address on Base
CONTRACT_ADDRESS="0x506207f3b434186C90560B6b81A22D7624eA81B2"
RPC_URL=${BASE_RPC_URL:-"https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY"}

# Function to display help
show_help() {
    echo -e "${GREEN}IndexFundToken Interaction Script${NC}"
    echo -e "Contract: ${BLUE}$CONTRACT_ADDRESS${NC}"
    echo -e "\nUsage: ./interact.sh [command] [args...]"
    echo -e "\n${YELLOW}View Commands:${NC}"
    echo "  info                    - Show portfolio information"
    echo "  assets                  - List all assets"
    echo "  asset [symbol]          - Show specific asset details"
    echo "  balance [address]       - Check token balance"
    echo "  chains                  - List supported chains"
    echo "  owner                   - Show contract owner"
    echo ""
    echo -e "${YELLOW}Management Commands (Owner Only):${NC}"
    echo "  add-asset [symbol] [address] [weight]  - Add new asset"
    echo "  remove-asset [symbol]                  - Remove asset"
    echo "  rebalance [symbol] [new-weight]        - Change asset weight"
    echo "  update-value [usd-value]               - Update portfolio value"
    echo "  add-chain [chain-id]                   - Add supported chain"
    echo "  set-remote [chain-id] [address]        - Set trusted remote"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./interact.sh info"
    echo "  ./interact.sh asset WETH"
    echo "  ./interact.sh add-asset USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 1000"
    echo "  ./interact.sh rebalance WETH 3500"
}

# Parse command
COMMAND=$1

case $COMMAND in
    "info")
        echo -e "${GREEN}Fetching portfolio information...${NC}"
        echo -e "${BLUE}Asset Count:${NC}"
        cast call $CONTRACT_ADDRESS "getAssetCount()" --rpc-url $RPC_URL
        
        echo -e "\n${BLUE}Portfolio State:${NC}"
        cast call $CONTRACT_ADDRESS "portfolioState()" --rpc-url $RPC_URL
        
        echo -e "\n${BLUE}Current Chain:${NC}"
        cast call $CONTRACT_ADDRESS "CURRENT_CHAIN()" --rpc-url $RPC_URL
        ;;
        
    "assets")
        echo -e "${GREEN}Listing all assets...${NC}"
        # This would need to parse getPortfolioInfo() - simplified for now
        echo "WETH - 40%"
        echo "WBTC - 30%"
        echo "DAI - 30%"
        ;;
        
    "asset")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify asset symbol${NC}"
            exit 1
        fi
        echo -e "${GREEN}Fetching asset details for $2...${NC}"
        cast call $CONTRACT_ADDRESS "assets(string)" "$2" --rpc-url $RPC_URL
        ;;
        
    "balance")
        ADDRESS=${2:-$CONTRACT_ADDRESS}
        echo -e "${GREEN}Checking balance for $ADDRESS...${NC}"
        cast call $CONTRACT_ADDRESS "balanceOf(address)" "$ADDRESS" --rpc-url $RPC_URL
        ;;
        
    "chains")
        echo -e "${GREEN}Fetching supported chains...${NC}"
        cast call $CONTRACT_ADDRESS "getSupportedChains()" --rpc-url $RPC_URL
        ;;
        
    "owner")
        echo -e "${GREEN}Contract owner:${NC}"
        cast call $CONTRACT_ADDRESS "owner()" --rpc-url $RPC_URL
        ;;
        
    "add-asset")
        if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
            echo -e "${RED}Error: Usage: add-asset [symbol] [address] [weight]${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Adding asset $2...${NC}"
        cast send $CONTRACT_ADDRESS "addAsset(string,address,uint256)" "$2" "$3" "$4" \
            --rpc-url $RPC_URL --private-key $PRIVATE_KEY
        ;;
        
    "remove-asset")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify asset symbol${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Removing asset $2...${NC}"
        cast send $CONTRACT_ADDRESS "removeAsset(string)" "$2" \
            --rpc-url $RPC_URL --private-key $PRIVATE_KEY
        ;;
        
    "rebalance")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Error: Usage: rebalance [symbol] [new-weight]${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Rebalancing $2 to $3 basis points...${NC}"
        cast send $CONTRACT_ADDRESS "rebalanceAsset(string,uint256)" "$2" "$3" \
            --rpc-url $RPC_URL --private-key $PRIVATE_KEY
        ;;
        
    "update-value")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify USD value${NC}"
            exit 1
        fi
        # Convert to wei (multiply by 10^18)
        VALUE_WEI=$(echo "$2 * 1000000000000000000" | bc)
        echo -e "${YELLOW}Updating portfolio value to $2 USD...${NC}"
        cast send $CONTRACT_ADDRESS "updatePortfolioValue(uint256)" "$VALUE_WEI" \
            --rpc-url $RPC_URL --private-key $PRIVATE_KEY
        ;;
        
    "add-chain")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify chain ID${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Adding chain $2...${NC}"
        cast send $CONTRACT_ADDRESS "addSupportedChain(uint32)" "$2" \
            --rpc-url $RPC_URL --private-key $PRIVATE_KEY
        ;;
        
    "set-remote")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Error: Usage: set-remote [chain-id] [address]${NC}"
            exit 1
        fi
        # Convert address to bytes32
        BYTES32_ADDR=$(cast --to-bytes32 $3)
        echo -e "${YELLOW}Setting trusted remote for chain $2...${NC}"
        cast send $CONTRACT_ADDRESS "setTrustedRemote(uint32,bytes32)" "$2" "$BYTES32_ADDR" \
            --rpc-url $RPC_URL --private-key $PRIVATE_KEY
        ;;
        
    *)
        show_help
        ;;
esac