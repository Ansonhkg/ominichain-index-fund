// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ISwapRouter } from "../interfaces/IUniswapV3.sol";
import { MockUniswapPool } from "./MockUniswapPool.sol";

/**
 * @title MockSwapRouter
 * @dev Mock implementation of Uniswap V3 SwapRouter for testing
 * Routes swaps to the appropriate MockUniswapPool
 */
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;
    
    mapping(bytes32 => address) public pools; // poolKey => pool address
    
    event PoolRegistered(address indexed token0, address indexed token1, uint24 fee, address pool);
    
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
        
        emit PoolRegistered(token0, token1, fee, pool);
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
     * @dev Execute exact input single swap
     * Implementation of ISwapRouter interface
     */
    function exactInputSingle(ExactInputSingleParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountOut) 
    {
        require(block.timestamp <= params.deadline, "MockRouter: Transaction too old");
        
        // Find the pool for this token pair and fee
        address poolAddress = getPool(params.tokenIn, params.tokenOut, params.fee);
        require(poolAddress != address(0), "MockRouter: Pool not found");
        
        MockUniswapPool pool = MockUniswapPool(poolAddress);
        
        // Transfer tokens from caller to this contract first
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        
        // Approve pool to spend our tokens
        IERC20(params.tokenIn).approve(poolAddress, params.amountIn);
        
        // Execute the swap through the pool
        amountOut = pool.swap(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            params.amountOutMinimum,
            params.recipient
        );
        
        return amountOut;
    }
    
    /**
     * @dev Execute exact output single swap
     * Implementation of ISwapRouter interface
     */
    function exactOutputSingle(ExactOutputSingleParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountIn) 
    {
        require(block.timestamp <= params.deadline, "MockRouter: Transaction too old");
        
        // Find the pool for this token pair and fee
        address poolAddress = getPool(params.tokenIn, params.tokenOut, params.fee);
        require(poolAddress != address(0), "MockRouter: Pool not found");
        
        // For simplicity, we'll calculate the required input amount and execute
        // This is a simplified implementation - real Uniswap is more complex
        MockUniswapPool pool = MockUniswapPool(poolAddress);
        
        // Calculate required input amount (simplified reverse calculation)
        uint256 estimatedInput = _calculateRequiredInput(
            pool,
            params.tokenIn,
            params.tokenOut,
            params.amountOut
        );
        
        require(estimatedInput <= params.amountInMaximum, "MockRouter: Too much requested");
        
        // Execute swap with calculated input amount
        uint256 actualAmountOut = pool.swap(
            params.tokenIn,
            params.tokenOut,
            estimatedInput,
            params.amountOut, // Use exact amount out as minimum
            params.recipient
        );
        
        require(actualAmountOut >= params.amountOut, "MockRouter: Insufficient output");
        
        return estimatedInput;
    }
    
    /**
     * @dev Calculate required input amount for exact output (simplified)
     * This is an approximation - real Uniswap uses complex math
     */
    function _calculateRequiredInput(
        MockUniswapPool pool,
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) private view returns (uint256) {
        (uint256 reserve0, uint256 reserve1) = pool.getReserves();
        
        // Determine which direction we're swapping
        bool zeroForOne = tokenIn == address(pool.token0());
        
        uint256 reserveIn = zeroForOne ? reserve0 : reserve1;
        uint256 reserveOut = zeroForOne ? reserve1 : reserve0;
        
        // Reverse constant product formula to find required input
        // k = reserveIn * reserveOut
        // After swap: (reserveIn + amountIn) * (reserveOut - amountOut) = k
        // Solving for amountIn with fees (simplified)
        
        uint256 numerator = amountOut * reserveIn;
        uint256 denominator = reserveOut - amountOut;
        uint256 amountInBeforeFee = numerator / denominator;
        
        // Add fee back (simplified)
        uint24 fee = pool.fee();
        uint256 feeMultiplier = 1000000 + fee; // Add fee back
        uint256 amountIn = (amountInBeforeFee * feeMultiplier) / 1000000;
        
        return amountIn;
    }
}