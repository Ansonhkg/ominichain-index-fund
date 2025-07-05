// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingFee} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

/**
 * @title IndexFundToken - Cross-Chain Index Fund with State Synchronisation
 * @dev An omnichain index fund token that synchronises portfolio state across multiple chains
 *
 * Features:
 * - Cross-chain portfolio state synchronisation
 * - Multi-asset index management
 * - Rebalancing with automatic cross-chain updates
 * - Conflict resolution for concurrent updates
 */
contract IndexFundToken is OFT {
    // =============================================================
    //                           STRUCTS
    // =============================================================

    struct Asset {
        address tokenAddress;
        uint256 targetWeight; // Basis points (10000 = 100%)
        uint256 currentValue; // Current USD value
        bool isActive;
    }

    struct PortfolioState {
        uint256 totalValue; // Total portfolio value in USD
        uint256 lastUpdate; // Timestamp of last update
        uint32 sourceChain; // Chain that initiated the update
        uint256 nonce; // For conflict resolution
    }

    // =============================================================
    //                        STATE VARIABLES
    // =============================================================

    // Portfolio management
    mapping(string => Asset) public assets; // symbol => Asset
    string[] public assetSymbols; // List of all asset symbols
    PortfolioState public portfolioState;

    // Cross-chain configuration
    uint32[] public supportedChains; // Supported LayerZero chain IDs
    mapping(uint32 => bool) public isSupportedChain;
    mapping(uint32 => bytes32) public trustedRemotes;

    // Synchronisation state
    mapping(bytes32 => bool) public processedMessages; // Prevent replay attacks
    mapping(string => uint256) public pendingUpdates; // Track pending updates

    // Constants
    uint256 public constant MAX_ASSETS = 50;
    uint256 public constant BASIS_POINTS = 10000;
    uint32 public immutable CURRENT_CHAIN;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event AssetAdded(
        string indexed symbol,
        address tokenAddress,
        uint256 targetWeight
    );
    event AssetRemoved(string indexed symbol);
    event AssetRebalanced(
        string indexed symbol,
        uint256 oldWeight,
        uint256 newWeight
    );
    event PortfolioSynced(
        uint32 indexed sourceChain,
        uint256 totalValue,
        uint256 nonce
    );
    event ChainAdded(uint32 indexed chainId);
    event ChainRemoved(uint32 indexed chainId);
    event StateConflictResolved(
        uint256 localNonce,
        uint256 remoteNonce,
        uint32 winningChain
    );

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate,
        uint32 _currentChain
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {
        CURRENT_CHAIN = _currentChain;
        portfolioState.nonce = 1;
        portfolioState.sourceChain = _currentChain;
        portfolioState.lastUpdate = block.timestamp;
    }

    // =============================================================
    //                    PORTFOLIO MANAGEMENT
    // =============================================================

    /**
     * @dev Add a new asset to the index
     * @param symbol Asset symbol (e.g., "ETH", "BTC")
     * @param tokenAddress Address of the token contract
     * @param targetWeight Target weight in basis points
     */
    function addAsset(
        string memory symbol,
        address tokenAddress,
        uint256 targetWeight
    ) external onlyOwner {
        require(bytes(symbol).length > 0, "Invalid symbol");
        require(tokenAddress != address(0), "Invalid token address");
        require(
            targetWeight > 0 && targetWeight <= BASIS_POINTS,
            "Invalid weight"
        );
        require(!assets[symbol].isActive, "Asset already exists");
        require(assetSymbols.length < MAX_ASSETS, "Too many assets");

        // Validate total weights don't exceed 100%
        uint256 totalWeight = targetWeight;
        for (uint i = 0; i < assetSymbols.length; i++) {
            totalWeight += assets[assetSymbols[i]].targetWeight;
        }
        require(totalWeight <= BASIS_POINTS, "Total weight exceeds 100%");

        assets[symbol] = Asset({
            tokenAddress: tokenAddress,
            targetWeight: targetWeight,
            currentValue: 0,
            isActive: true
        });

        assetSymbols.push(symbol);

        emit AssetAdded(symbol, tokenAddress, targetWeight);

        // Sync to all chains
        _syncAssetUpdate("ADD_ASSET", symbol, tokenAddress, targetWeight);
    }

    /**
     * @dev Remove an asset from the index
     * @param symbol Asset symbol to remove
     */
    function removeAsset(string memory symbol) external onlyOwner {
        require(assets[symbol].isActive, "Asset not found");

        assets[symbol].isActive = false;

        // Remove from array
        for (uint i = 0; i < assetSymbols.length; i++) {
            if (keccak256(bytes(assetSymbols[i])) == keccak256(bytes(symbol))) {
                assetSymbols[i] = assetSymbols[assetSymbols.length - 1];
                assetSymbols.pop();
                break;
            }
        }

        emit AssetRemoved(symbol);

        // Sync to all chains
        _syncAssetUpdate("REMOVE_ASSET", symbol, address(0), 0);
    }

    /**
     * @dev Rebalance an asset's target weight
     * @param symbol Asset symbol
     * @param newWeight New target weight in basis points
     */
    function rebalanceAsset(
        string memory symbol,
        uint256 newWeight
    ) external onlyOwner {
        require(assets[symbol].isActive, "Asset not found");
        require(newWeight > 0 && newWeight <= BASIS_POINTS, "Invalid weight");

        // Validate total weights
        uint256 totalWeight = newWeight;
        for (uint i = 0; i < assetSymbols.length; i++) {
            if (keccak256(bytes(assetSymbols[i])) != keccak256(bytes(symbol))) {
                totalWeight += assets[assetSymbols[i]].targetWeight;
            }
        }
        require(totalWeight <= BASIS_POINTS, "Total weight exceeds 100%");

        uint256 oldWeight = assets[symbol].targetWeight;
        assets[symbol].targetWeight = newWeight;

        emit AssetRebalanced(symbol, oldWeight, newWeight);

        // Sync to all chains
        _syncAssetUpdate(
            "REBALANCE_ASSET",
            symbol,
            assets[symbol].tokenAddress,
            newWeight
        );
    }

    /**
     * @dev Update portfolio value (typically called by oracle or admin)
     * @param newTotalValue New total portfolio value in USD
     */
    function updatePortfolioValue(uint256 newTotalValue) external onlyOwner {
        portfolioState.totalValue = newTotalValue;
        portfolioState.lastUpdate = block.timestamp;
        portfolioState.nonce++;
        portfolioState.sourceChain = CURRENT_CHAIN;

        emit PortfolioSynced(
            CURRENT_CHAIN,
            newTotalValue,
            portfolioState.nonce
        );

        // Sync to all chains
        _syncPortfolioState();
    }

    // =============================================================
    //                   CROSS-CHAIN MESSAGING
    // =============================================================

    /**
     * @dev Sync asset update to all supported chains
     */
    function _syncAssetUpdate(
        string memory action,
        string memory symbol,
        address tokenAddress,
        uint256 weight
    ) internal {
        if (supportedChains.length == 0) return; // No chains to sync to

        bytes memory message = abi.encode(
            action,
            symbol,
            tokenAddress,
            weight,
            block.timestamp,
            portfolioState.nonce
        );

        _broadcastMessage(message);
    }

    /**
     * @dev Sync portfolio state to all supported chains
     */
    function _syncPortfolioState() internal {
        if (supportedChains.length == 0) return; // No chains to sync to

        bytes memory message = abi.encode(
            "UPDATE_PORTFOLIO",
            portfolioState.totalValue,
            portfolioState.lastUpdate,
            portfolioState.sourceChain,
            portfolioState.nonce
        );

        _broadcastMessage(message);
    }

    /**
     * @dev Broadcast message to all supported chains
     * @param message Encoded message to broadcast
     */
    function _broadcastMessage(bytes memory message) internal {
        bytes memory options = _getMessagingOptions();
        uint256 totalFee = msg.value;
        uint256 feePerChain = totalFee / supportedChains.length;

        for (uint i = 0; i < supportedChains.length; i++) {
            if (supportedChains[i] != CURRENT_CHAIN) {
                _lzSend(
                    supportedChains[i],
                    message,
                    options,
                    MessagingFee(feePerChain, 0),
                    payable(msg.sender)
                );
            }
        }
    }

    /**
     * @dev Manual sync trigger for emergency situations
     * @param targetChain Specific chain to sync to (0 for all chains)
     */
    function manualSync(uint32 targetChain) external payable onlyOwner {
        bytes memory message = abi.encode(
            "FULL_SYNC",
            portfolioState.totalValue,
            portfolioState.lastUpdate,
            portfolioState.sourceChain,
            portfolioState.nonce
        );

        if (targetChain == 0) {
            _broadcastMessage(message);
        } else {
            require(isSupportedChain[targetChain], "Unsupported chain");
            _lzSend(
                targetChain,
                message,
                _getMessagingOptions(),
                MessagingFee(msg.value, 0),
                payable(msg.sender)
            );
        }
    }

    // =============================================================
    //                    MESSAGE HANDLING
    // =============================================================

    /**
     * @dev Handle incoming LayerZero messages
     */
    function _lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address /* executor */,
        bytes calldata /* extraData */
    ) internal override {
        // Prevent replay attacks
        require(!processedMessages[guid], "Message already processed");
        processedMessages[guid] = true;

        // Verify message comes from trusted remote
        require(
            trustedRemotes[origin.srcEid] != bytes32(0),
            "Untrusted remote"
        );

        _handleMessage(message, origin.srcEid);
    }

    /**
     * @dev Process received message based on action type
     */
    function _handleMessage(
        bytes calldata message,
        uint32 sourceChain
    ) internal {
        string memory action = abi.decode(message, (string));

        if (keccak256(bytes(action)) == keccak256(bytes("ADD_ASSET"))) {
            _handleAddAsset(message);
        } else if (
            keccak256(bytes(action)) == keccak256(bytes("REMOVE_ASSET"))
        ) {
            _handleRemoveAsset(message);
        } else if (
            keccak256(bytes(action)) == keccak256(bytes("REBALANCE_ASSET"))
        ) {
            _handleRebalanceAsset(message);
        } else if (
            keccak256(bytes(action)) == keccak256(bytes("UPDATE_PORTFOLIO"))
        ) {
            _handlePortfolioUpdate(message, sourceChain);
        } else if (keccak256(bytes(action)) == keccak256(bytes("FULL_SYNC"))) {
            _handleFullSync(message, sourceChain);
        }
    }

    function _handleAddAsset(bytes calldata message) internal {
        (
            ,
            string memory symbol,
            address tokenAddress,
            uint256 weight,
            ,
            uint256 nonce
        ) = abi.decode(
                message,
                (string, string, address, uint256, uint256, uint256)
            );

        // Only process if not already active and nonce is valid
        if (!assets[symbol].isActive && nonce >= portfolioState.nonce) {
            assets[symbol] = Asset({
                tokenAddress: tokenAddress,
                targetWeight: weight,
                currentValue: 0,
                isActive: true
            });

            assetSymbols.push(symbol);
            emit AssetAdded(symbol, tokenAddress, weight);
        }
    }

    function _handleRemoveAsset(bytes calldata message) internal {
        (
            ,
            string memory symbol,
            ,
            ,
            ,
            uint256 nonce
        ) = abi.decode(
                message,
                (string, string, address, uint256, uint256, uint256)
            );

        // Only process if currently active and nonce is valid
        if (assets[symbol].isActive && nonce >= portfolioState.nonce) {
            assets[symbol].isActive = false;

            // Remove from array
            for (uint i = 0; i < assetSymbols.length; i++) {
                if (
                    keccak256(bytes(assetSymbols[i])) ==
                    keccak256(bytes(symbol))
                ) {
                    assetSymbols[i] = assetSymbols[assetSymbols.length - 1];
                    assetSymbols.pop();
                    break;
                }
            }

            emit AssetRemoved(symbol);
        }
    }

    function _handleRebalanceAsset(bytes calldata message) internal {
        (
            ,
            string memory symbol,
            ,
            uint256 newWeight,
            ,
            uint256 nonce
        ) = abi.decode(
                message,
                (string, string, address, uint256, uint256, uint256)
            );

        // Only process if asset exists and nonce is valid
        if (assets[symbol].isActive && nonce >= portfolioState.nonce) {
            uint256 oldWeight = assets[symbol].targetWeight;
            assets[symbol].targetWeight = newWeight;
            emit AssetRebalanced(symbol, oldWeight, newWeight);
        }
    }

    function _handlePortfolioUpdate(
        bytes calldata message,
        uint32 /* sourceChain */
    ) internal {
        (
            ,
            uint256 totalValue,
            uint256 lastUpdate,
            uint32 msgSourceChain,
            uint256 nonce
        ) = abi.decode(message, (string, uint256, uint256, uint32, uint256));

        // Conflict resolution: use highest nonce, break ties with timestamp
        bool shouldUpdate = false;

        if (nonce > portfolioState.nonce) {
            shouldUpdate = true;
        } else if (
            nonce == portfolioState.nonce &&
            lastUpdate > portfolioState.lastUpdate
        ) {
            shouldUpdate = true;
            emit StateConflictResolved(
                portfolioState.nonce,
                nonce,
                msgSourceChain
            );
        }

        if (shouldUpdate) {
            portfolioState.totalValue = totalValue;
            portfolioState.lastUpdate = lastUpdate;
            portfolioState.sourceChain = msgSourceChain;
            portfolioState.nonce = nonce;

            emit PortfolioSynced(msgSourceChain, totalValue, nonce);
        }
    }

    function _handleFullSync(
        bytes calldata message,
        uint32 sourceChain
    ) internal {
        // Full sync always overwrites local state (emergency use only)
        _handlePortfolioUpdate(message, sourceChain);
    }

    // =============================================================
    //                 CHAIN MANAGEMENT
    // =============================================================

    /**
     * @dev Add a supported chain for synchronisation
     * @param chainId LayerZero chain ID
     */
    function addSupportedChain(uint32 chainId) external onlyOwner {
        require(!isSupportedChain[chainId], "Chain already supported");
        require(chainId != CURRENT_CHAIN, "Cannot add current chain");

        supportedChains.push(chainId);
        isSupportedChain[chainId] = true;

        emit ChainAdded(chainId);
    }

    /**
     * @dev Remove a supported chain
     * @param chainId LayerZero chain ID
     */
    function removeSupportedChain(uint32 chainId) external onlyOwner {
        require(isSupportedChain[chainId], "Chain not supported");

        // Remove from array
        for (uint i = 0; i < supportedChains.length; i++) {
            if (supportedChains[i] == chainId) {
                supportedChains[i] = supportedChains[
                    supportedChains.length - 1
                ];
                supportedChains.pop();
                break;
            }
        }

        isSupportedChain[chainId] = false;
        delete trustedRemotes[chainId];

        emit ChainRemoved(chainId);
    }

    /**
     * @dev Set trusted remote address for a chain
     * @param chainId LayerZero chain ID
     * @param remoteAddress Remote contract address (bytes32)
     */
    function setTrustedRemote(
        uint32 chainId,
        bytes32 remoteAddress
    ) external onlyOwner {
        require(isSupportedChain[chainId], "Chain not supported");
        trustedRemotes[chainId] = remoteAddress;
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @dev Get complete portfolio information
     */
    function getPortfolioInfo()
        external
        view
        returns (
            string[] memory symbols,
            Asset[] memory assetData,
            PortfolioState memory state
        )
    {
        Asset[] memory assets_array = new Asset[](assetSymbols.length);

        for (uint i = 0; i < assetSymbols.length; i++) {
            assets_array[i] = assets[assetSymbols[i]];
        }

        return (assetSymbols, assets_array, portfolioState);
    }

    /**
     * @dev Get supported chains
     */
    function getSupportedChains() external view returns (uint32[] memory) {
        return supportedChains;
    }

    /**
     * @dev Get asset count
     */
    function getAssetCount() external view returns (uint256) {
        return assetSymbols.length;
    }

    /**
     * @dev Calculate messaging fee for sync operations
     * @param targetChain Target chain (0 for all chains)
     */
    function estimateSyncFee(
        uint32 targetChain
    ) external view returns (MessagingFee memory fee) {
        bytes memory message = abi.encode(
            "UPDATE_PORTFOLIO",
            portfolioState.totalValue,
            portfolioState.lastUpdate,
            portfolioState.sourceChain,
            portfolioState.nonce
        );

        if (targetChain == 0) {
            // Estimate for all chains
            MessagingFee memory totalFee = MessagingFee(0, 0);
            for (uint i = 0; i < supportedChains.length; i++) {
                if (supportedChains[i] != CURRENT_CHAIN) {
                    MessagingFee memory chainFee = _quote(
                        supportedChains[i],
                        message,
                        _getMessagingOptions(),
                        false
                    );
                    totalFee.nativeFee += chainFee.nativeFee;
                    totalFee.lzTokenFee += chainFee.lzTokenFee;
                }
            }
            return totalFee;
        } else {
            return _quote(targetChain, message, _getMessagingOptions(), false);
        }
    }

    // =============================================================
    //                    INTERNAL HELPERS
    // =============================================================

    /**
     * @dev Get messaging options for LayerZero
     */
    function _getMessagingOptions() internal pure returns (bytes memory) {
        // Set gas limit for destination execution
        return
            abi.encodePacked(
                uint16(1), // version
                uint128(200000) // gas limit
            );
    }
}
