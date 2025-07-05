// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MockUniswapPool } from "./MockUniswapPool.sol";

/**
 * @title MockUniswapFactory
 * @dev Mock implementation of Uniswap V3 Factory for testing
 * Creates and manages MockUniswapPool instances
 */
contract MockUniswapFactory is Ownable {
    mapping(bytes32 => address) public pools; // poolKey => pool address
    mapping(uint24 => bool) public enabledFeeAmounts; // fee => enabled
    
    event PoolCreated(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        address pool
    );
    
    event FeeAmountEnabled(uint24 indexed fee);
    
    constructor() Ownable(msg.sender) {
        // Enable standard Uniswap fee tiers
        enabledFeeAmounts[500] = true;   // 0.05%
        enabledFeeAmounts[3000] = true;  // 0.3%
        enabledFeeAmounts[10000] = true; // 1%
        
        emit FeeAmountEnabled(500);
        emit FeeAmountEnabled(3000);
        emit FeeAmountEnabled(10000);
    }
    
    /**
     * @dev Create a new pool for the given tokens and fee tier
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee Pool fee tier
     * @return pool Address of the created pool
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool) {
        require(tokenA != tokenB, "MockFactory: Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "MockFactory: Zero address");
        require(enabledFeeAmounts[fee], "MockFactory: Fee not enabled");
        
        // Ensure token0 < token1 for consistent ordering
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        
        bytes32 poolKey = keccak256(abi.encodePacked(token0, token1, fee));
        require(pools[poolKey] == address(0), "MockFactory: Pool already exists");
        
        // Deploy new MockUniswapPool
        MockUniswapPool newPool = new MockUniswapPool(
            token0,
            token1,
            fee,
            owner()
        );
        
        pool = address(newPool);
        pools[poolKey] = pool;
        
        emit PoolCreated(token0, token1, fee, pool);
        
        return pool;
    }
    
    /**
     * @dev Get pool address for given token pair and fee
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee Pool fee tier
     * @return pool Pool address (zero if doesn't exist)
     */
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool) {
        // Ensure token0 < token1 for consistent ordering
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        
        bytes32 poolKey = keccak256(abi.encodePacked(token0, token1, fee));
        return pools[poolKey];
    }
    
    /**
     * @dev Enable a new fee amount
     * @param fee New fee tier to enable
     */
    function enableFeeAmount(uint24 fee) external onlyOwner {
        require(fee < 1000000, "MockFactory: Fee too high"); // Less than 100%
        require(!enabledFeeAmounts[fee], "MockFactory: Fee already enabled");
        
        enabledFeeAmounts[fee] = true;
        emit FeeAmountEnabled(fee);
    }
    
    /**
     * @dev Check if fee amount is enabled
     */
    function isFeeAmountEnabled(uint24 fee) external view returns (bool) {
        return enabledFeeAmounts[fee];
    }
    
    /**
     * @dev Get all enabled fee amounts (helper function)
     */
    function getEnabledFeeAmounts() external view returns (uint24[] memory) {
        // Return standard fee tiers for simplicity
        uint24[] memory fees = new uint24[](3);
        fees[0] = 500;
        fees[1] = 3000;
        fees[2] = 10000;
        return fees;
    }
}