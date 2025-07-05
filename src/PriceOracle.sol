// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPriceOracle } from "./interfaces/IPriceOracle.sol";

interface IFtsoV2Interface {
    function getFeedById(bytes21 feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp);
    function getFeedByIdInWei(bytes21 feedId) external view returns (uint256 value, uint64 timestamp);
}

interface IContractRegistry {
    function getFtsoV2() external view returns (IFtsoV2Interface);
}

contract PriceOracle is IPriceOracle, Ownable {
    mapping(string => uint256) public prices;
    mapping(string => uint256) public lastUpdateTime;
    mapping(string => bytes21) public feedIds;
    mapping(address => bool) public priceUpdaters;
    
    uint256 public constant PRICE_STALENESS_THRESHOLD = 900; // 15 minutes for production
    uint256 public constant MIN_PRICE_CHANGE_THRESHOLD = 5; // 5% minimum change to update
    
    IContractRegistry public immutable contractRegistry;
    
    event PriceUpdated(string asset, uint256 price, uint256 timestamp);
    event PriceUpdaterAdded(address updater);
    event PriceUpdaterRemoved(address updater);
    
    constructor(address _owner, address _contractRegistry) Ownable(_owner) {
        contractRegistry = IContractRegistry(_contractRegistry);
        
        // Initialize Feed IDs for Flare FTSO
        feedIds["ETH"] = bytes21(0x014554482f55534400000000000000000000000000); // ETH/USD
        feedIds["FLR"] = bytes21(0x01464c522f55534400000000000000000000000000); // FLR/USD
        feedIds["BTC"] = bytes21(0x014254432f55534400000000000000000000000000); // BTC/USD
        feedIds["USDC"] = bytes21(0x015553444300000000000000000000000000000000); // USDC placeholder
        
        // Initialize with default prices as fallback
        prices["ETH"] = 3000 * 1e18; // $3000
        prices["FLOW"] = 1 * 1e18; // $1 (using FLR as proxy)
        prices["USDC"] = 1 * 1e18; // $1
        
        lastUpdateTime["ETH"] = block.timestamp;
        lastUpdateTime["FLOW"] = block.timestamp;
        lastUpdateTime["USDC"] = block.timestamp;
    }
    
    function getPrice(string memory asset) external view override returns (uint256) {
        // Try to get live price from Flare FTSO first
        if (feedIds[asset].length > 0) {
            try this.getFlarePriceForAsset(asset) returns (uint256 livePrice) {
                if (livePrice > 0) {
                    return livePrice;
                }
            } catch {
                // Fall back to stored price if FTSO fails
            }
        }
        
        // Use stored price as fallback
        require(prices[asset] > 0, "PriceOracle: Asset not supported");
        require(block.timestamp - lastUpdateTime[asset] <= PRICE_STALENESS_THRESHOLD, "PriceOracle: Price is stale");
        return prices[asset];
    }
    
    function getFlarePriceForAsset(string memory asset) external view returns (uint256) {
        bytes21 feedId = feedIds[asset];
        require(feedId.length > 0, "PriceOracle: Feed ID not set for asset");
        
        IFtsoV2Interface ftsoV2 = contractRegistry.getFtsoV2();
        (uint256 value, int8 decimals, uint64 timestamp) = ftsoV2.getFeedById(feedId);
        
        // Ensure price is recent (within last 5 minutes)
        require(block.timestamp - timestamp <= 300, "PriceOracle: FTSO price too old");
        
        // Convert to 18 decimals
        if (decimals >= 0) {
            return value * (10 ** (18 - uint8(decimals)));
        } else {
            return value / (10 ** uint8(-decimals));
        }
    }
    
    function updatePrice(string memory asset, uint256 price) external override {
        require(priceUpdaters[msg.sender] || msg.sender == owner(), "PriceOracle: Not authorized");
        require(price > 0, "PriceOracle: Invalid price");
        
        // Check if price change is significant enough
        uint256 currentPrice = prices[asset];
        if (currentPrice > 0) {
            uint256 priceDiff = price > currentPrice ? price - currentPrice : currentPrice - price;
            uint256 percentChange = (priceDiff * 100) / currentPrice;
            
            // Only update if change is significant or price is stale
            if (percentChange < MIN_PRICE_CHANGE_THRESHOLD && !isPriceStale(asset)) {
                return; // Skip update for minor price changes
            }
        }
        
        prices[asset] = price;
        lastUpdateTime[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }
    
    function updateMultiplePrices(
        string[] memory assets,
        uint256[] memory _prices
    ) external {
        require(priceUpdaters[msg.sender] || msg.sender == owner(), "PriceOracle: Not authorized");
        require(assets.length == _prices.length, "PriceOracle: Array length mismatch");
        
        for (uint i = 0; i < assets.length; i++) {
            require(_prices[i] > 0, "PriceOracle: Invalid price");
            
            // Check if price change is significant enough
            uint256 currentPrice = prices[assets[i]];
            if (currentPrice > 0) {
                uint256 priceDiff = _prices[i] > currentPrice ? _prices[i] - currentPrice : currentPrice - _prices[i];
                uint256 percentChange = (priceDiff * 100) / currentPrice;
                
                // Only update if change is significant or price is stale
                if (percentChange < MIN_PRICE_CHANGE_THRESHOLD && !isPriceStale(assets[i])) {
                    continue; // Skip update for minor price changes
                }
            }
            
            prices[assets[i]] = _prices[i];
            lastUpdateTime[assets[i]] = block.timestamp;
            emit PriceUpdated(assets[i], _prices[i], block.timestamp);
        }
    }
    
    function setFeedId(string memory asset, bytes21 feedId) external onlyOwner {
        feedIds[asset] = feedId;
    }
    
    function isPriceStale(string memory asset) public view returns (bool) {
        return block.timestamp - lastUpdateTime[asset] > PRICE_STALENESS_THRESHOLD;
    }
    
    function addPriceUpdater(address updater) external onlyOwner {
        require(updater != address(0), "PriceOracle: Invalid updater address");
        priceUpdaters[updater] = true;
        emit PriceUpdaterAdded(updater);
    }
    
    function removePriceUpdater(address updater) external onlyOwner {
        priceUpdaters[updater] = false;
        emit PriceUpdaterRemoved(updater);
    }
    
    function validatePriceUpdate(string memory asset, uint256 price) external view returns (bool shouldUpdate, string memory reason) {
        if (price == 0) {
            return (false, "Invalid price");
        }
        
        uint256 currentPrice = prices[asset];
        if (currentPrice == 0) {
            return (true, "First price update");
        }
        
        if (isPriceStale(asset)) {
            return (true, "Price is stale");
        }
        
        uint256 priceDiff = price > currentPrice ? price - currentPrice : currentPrice - price;
        uint256 percentChange = (priceDiff * 100) / currentPrice;
        
        if (percentChange >= MIN_PRICE_CHANGE_THRESHOLD) {
            return (true, "Significant price change");
        }
        
        return (false, "Price change not significant enough");
    }
}