#!/bin/bash

# Check Wallet Balance Script
# Usage: ./check-balance.sh [network]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Wallet Balance Checker ===${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create .env file with PRIVATE_KEY"
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
NETWORK=${1:-base}

# Set RPC URL and currency based on network
case $NETWORK in
    "mainnet"|"ethereum")
        RPC_URL=${ETHEREUM_RPC_URL:-"https://eth-mainnet.g.alchemy.com/v2/demo"}
        CURRENCY="ETH"
        ;;
    "base")
        RPC_URL=${BASE_RPC_URL:-"https://base-mainnet.g.alchemy.com/v2/demo"}
        CURRENCY="ETH"
        ;;
    "arbitrum")
        RPC_URL=${ARBITRUM_RPC_URL:-"https://arb-mainnet.g.alchemy.com/v2/demo"}
        CURRENCY="ETH"
        ;;
    "polygon")
        RPC_URL=${POLYGON_RPC_URL:-"https://polygon-mainnet.g.alchemy.com/v2/demo"}
        CURRENCY="MATIC"
        ;;
    "optimism")
        RPC_URL=${OPTIMISM_RPC_URL:-"https://opt-mainnet.g.alchemy.com/v2/demo"}
        CURRENCY="ETH"
        ;;
    "bsc")
        RPC_URL=${BSC_RPC_URL:-"https://bsc-dataseed.binance.org/"}
        CURRENCY="BNB"
        ;;
    "sepolia")
        RPC_URL=${SEPOLIA_RPC_URL:-"https://eth-sepolia.g.alchemy.com/v2/demo"}
        CURRENCY="ETH"
        ;;
    "base-sepolia")
        RPC_URL=${BASE_SEPOLIA_RPC_URL:-"https://base-sepolia.g.alchemy.com/v2/demo"}
        CURRENCY="ETH"
        ;;
    *)
        echo -e "${RED}Error: Unknown network $NETWORK${NC}"
        exit 1
        ;;
esac

echo -e "${YELLOW}Network: $NETWORK${NC}"
echo -e "${YELLOW}RPC URL: $RPC_URL${NC}"

# Get deployer address from private key
DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
echo -e "${YELLOW}Deployer Address: $DEPLOYER${NC}"

# Check balance
echo -e "${YELLOW}Checking balance...${NC}"

if BALANCE=$(cast balance --rpc-url "$RPC_URL" "$DEPLOYER" 2>/dev/null); then
    # Convert balance to human readable format
    BALANCE_ETH=$(cast --to-unit "$BALANCE" ether)
    
    echo -e "${GREEN}✓ Balance: $BALANCE_ETH $CURRENCY${NC}"
    
    # Check if balance is sufficient for deployment
    # Estimated need: 0.0000054 ETH (from your deployment log)
    REQUIRED="0.00001"  # Adding some buffer
    
    # Compare balances (using bc if available, otherwise basic comparison)
    if command -v bc >/dev/null 2>&1; then
        if (( $(echo "$BALANCE_ETH >= $REQUIRED" | bc -l) )); then
            echo -e "${GREEN}✓ Sufficient balance for deployment${NC}"
            echo -e "${GREEN}✓ Ready to deploy!${NC}"
        else
            echo -e "${RED}✗ Insufficient balance for deployment${NC}"
            echo -e "${YELLOW}  Required: ~$REQUIRED $CURRENCY${NC}"
            echo -e "${YELLOW}  Current:  $BALANCE_ETH $CURRENCY${NC}"
            echo -e "${YELLOW}  Need:     $(echo "$REQUIRED - $BALANCE_ETH" | bc -l) $CURRENCY more${NC}"
        fi
    else
        echo -e "${YELLOW}Note: Install 'bc' for precise balance comparison${NC}"
        echo -e "${YELLOW}Required for deployment: ~$REQUIRED $CURRENCY${NC}"
    fi
    
    echo
    echo -e "${BLUE}=== Faucet Links (for testnets) ===${NC}"
    case $NETWORK in
        "sepolia")
            echo -e "${YELLOW}Sepolia Faucet: https://sepoliafaucet.com/${NC}"
            echo -e "${YELLOW}Alchemy Faucet: https://sepoliafaucet.net/${NC}"
            ;;
        "base-sepolia")
            echo -e "${YELLOW}Base Sepolia Faucet: https://faucet.quicknode.com/base/sepolia${NC}"
            echo -e "${YELLOW}Coinbase Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet${NC}"
            ;;
        *)
            echo -e "${YELLOW}For mainnet, you need to buy $CURRENCY from an exchange${NC}"
            ;;
    esac
    
else
    echo -e "${RED}✗ Failed to check balance${NC}"
    echo -e "${YELLOW}Possible issues:${NC}"
    echo -e "  • RPC URL not working: $RPC_URL"
    echo -e "  • Network connectivity issues"
    echo -e "  • Invalid private key format"
    
    echo
    echo -e "${YELLOW}Try with a different RPC:${NC}"
    case $NETWORK in
        "base")
            echo -e "  • https://mainnet.base.org"
            echo -e "  • https://base.blockpi.network/v1/rpc/public"
            ;;
        "sepolia")
            echo -e "  • https://sepolia.infura.io/v3/your-key"
            echo -e "  • https://ethereum-sepolia-rpc.publicnode.com"
            ;;
    esac
fi

echo
echo -e "${BLUE}=== Next Steps ===${NC}"
if [ "$BALANCE_ETH" != "" ] && command -v bc >/dev/null 2>&1 && (( $(echo "$BALANCE_ETH >= $REQUIRED" | bc -l) )); then
    echo -e "${GREEN}1. Your wallet has sufficient funds${NC}"
    echo -e "${GREEN}2. Try deployment again:${NC}"
    echo -e "   ./deploy.sh $NETWORK"
else
    echo -e "${YELLOW}1. Fund your wallet with $CURRENCY${NC}"
    echo -e "${YELLOW}2. Wait for transaction confirmation${NC}"
    echo -e "${YELLOW}3. Check balance again: ./check-balance.sh $NETWORK${NC}"
    echo -e "${YELLOW}4. Try deployment: ./deploy.sh $NETWORK${NC}"
fi 