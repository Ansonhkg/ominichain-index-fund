// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IQuoterV2 } from "../interfaces/IUniswapV3.sol";
import { MockUniswapPool } from "./MockUniswapPool.sol";

/**
 * @title MockQuoterV2
 * @dev Mock implementation of Uniswap V3 QuoterV2 for testing
 * Provides price quotes without executing swaps
 */
contract MockQuoterV2 is IQuoterV2 {
    mapping(bytes32 => address) public pools; // poolKey => pool address
    
    /**
     * @dev Register a pool for a token pair and fee tier
     * @param token0 First token in the pair (lower address)
     * @param token1 Second token in the pair (higher address)
     * @param fee Pool fee tier
     * @param pool Address of the MockUniswapPool
     */
    function registerPool(
        address token0,
        address token1,
        uint24 fee,
        address pool
    ) external {
        // Ensure token0 < token1 for consistent ordering
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }
        
        bytes32 poolKey = keccak256(abi.encodePacked(token0, token1, fee));
        pools[poolKey] = pool;
    }
    
    /**
     * @dev Get pool address for a token pair and fee
     */
    function getPool(address token0, address token1, uint24 fee) public view returns (address) {
        // Ensure token0 < token1 for consistent ordering
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }
        
        bytes32 poolKey = keccak256(abi.encodePacked(token0, token1, fee));
        return pools[poolKey];
    }
    
    /**
     * @dev Quote exact input single swap
     * Implementation of IQuoterV2 interface
     */
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external view override returns (uint256 amountOut) {
        // Find the pool for this token pair and fee
        address poolAddress = getPool(tokenIn, tokenOut, fee);
        require(poolAddress != address(0), "MockQuoter: Pool not found");
        
        MockUniswapPool pool = MockUniswapPool(poolAddress);
        
        // Get quote from the pool
        amountOut = pool.quoteExactInputSingle(tokenIn, tokenOut, amountIn);
        
        return amountOut;
    }
    
    /**
     * @dev Quote exact output single swap
     * Implementation of IQuoterV2 interface
     */
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 sqrtPriceLimitX96
    ) external view override returns (uint256 amountIn) {
        // Find the pool for this token pair and fee
        address poolAddress = getPool(tokenIn, tokenOut, fee);
        require(poolAddress != address(0), "MockQuoter: Pool not found");
        
        MockUniswapPool pool = MockUniswapPool(poolAddress);
        (uint256 reserve0, uint256 reserve1) = pool.getReserves();
        
        // Determine which direction we're swapping
        bool zeroForOne = tokenIn == address(pool.token0());
        
        uint256 reserveIn = zeroForOne ? reserve0 : reserve1;
        uint256 reserveOut = zeroForOne ? reserve1 : reserve0;
        
        // Calculate required input using reverse constant product formula
        require(amountOut < reserveOut, "MockQuoter: Insufficient liquidity");
        
        // Reverse AMM formula: (reserveIn + amountIn) * (reserveOut - amountOut) = k
        // Where k = reserveIn * reserveOut
        // Solving for amountIn: amountIn = (amountOut * reserveIn) / (reserveOut - amountOut)
        uint256 numerator = amountOut * reserveIn;
        uint256 denominator = reserveOut - amountOut;
        uint256 amountInBeforeFee = numerator / denominator;
        
        // Add fee back (pool fee is applied to input)
        uint24 poolFee = pool.fee();
        uint256 feeMultiplier = 1000000; // 100%
        uint256 feeAdjustment = 1000000 - poolFee; // Subtract fee percentage
        
        amountIn = (amountInBeforeFee * feeMultiplier) / feeAdjustment;
        
        return amountIn;
    }
    
    /**
     * @dev Get current price from pool (additional helper function)
     * @param token0 First token address
     * @param token1 Second token address  
     * @param fee Pool fee tier
     * @return price Current price of token1 in terms of token0
     */
    function getPrice(
        address token0,
        address token1,
        uint24 fee
    ) external view returns (uint256 price) {
        address poolAddress = getPool(token0, token1, fee);
        if (poolAddress == address(0)) return 0;
        
        MockUniswapPool pool = MockUniswapPool(poolAddress);
        return pool.getPrice();
    }
    
    /**
     * @dev Check if pool exists for given parameters
     */
    function poolExists(
        address token0,
        address token1,
        uint24 fee
    ) external view returns (bool) {
        return getPool(token0, token1, fee) != address(0);
    }
}