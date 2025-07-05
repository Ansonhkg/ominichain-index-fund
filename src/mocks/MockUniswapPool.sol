// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUniswapPool
 * @dev Mock Uniswap V3 pool with realistic constant product formula (x * y = k)
 * Implements price impact, slippage, and fees like a real AMM
 */
contract MockUniswapPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token0; // USDC
    IERC20 public immutable token1; // WETH
    uint24 public immutable fee;   // Pool fee (3000 = 0.3%)
    
    uint256 public reserve0; // USDC reserves
    uint256 public reserve1; // WETH reserves
    
    uint256 private constant FEE_DENOMINATOR = 1000000; // 1M for precise fee calculation
    uint256 private constant PRECISION = 1e18;
    
    // Events matching Uniswap V3
    event Swap(
        address indexed sender,
        address indexed recipient,
        int256 amount0,
        int256 amount1,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tick
    );
    
    event Mint(
        address sender,
        address indexed owner,
        int24 indexed tickLower,
        int24 indexed tickUpper,
        uint128 amount,
        uint256 amount0,
        uint256 amount1
    );

    constructor(
        address _token0,
        address _token1,
        uint24 _fee,
        address _owner
    ) Ownable(_owner) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
        fee = _fee;
    }

    /**
     * @dev Add liquidity to the pool (simplified version)
     * @param amount0 Amount of token0 (USDC) to add
     * @param amount1 Amount of token1 (WETH) to add
     */
    function addLiquidity(uint256 amount0, uint256 amount1) external {
        require(amount0 > 0 && amount1 > 0, "MockPool: Invalid amounts");
        
        token0.safeTransferFrom(msg.sender, address(this), amount0);
        token1.safeTransferFrom(msg.sender, address(this), amount1);
        
        reserve0 += amount0;
        reserve1 += amount1;
        
        emit Mint(msg.sender, msg.sender, -887220, 887220, uint128(amount1), amount0, amount1);
    }
    
    /**
     * @dev Swap exact input for output using constant product formula
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token  
     * @param amountIn Amount of tokens to swap in
     * @param amountOutMinimum Minimum amount of tokens to receive
     * @param recipient Address to receive output tokens
     * @return amountOut Amount of tokens received
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient
    ) external returns (uint256 amountOut) {
        require(amountIn > 0, "MockPool: Invalid input amount");
        require(
            (tokenIn == address(token0) && tokenOut == address(token1)) ||
            (tokenIn == address(token1) && tokenOut == address(token0)),
            "MockPool: Invalid token pair"
        );
        
        bool zeroForOne = tokenIn == address(token0);
        
        if (zeroForOne) {
            // Swapping token0 (USDC) for token1 (WETH)
            amountOut = getAmountOut(amountIn, reserve0, reserve1);
            require(amountOut >= amountOutMinimum, "MockPool: Insufficient output amount");
            require(amountOut <= reserve1, "MockPool: Insufficient liquidity");
            
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenOut).safeTransfer(recipient, amountOut);
            
            reserve0 += amountIn;
            reserve1 -= amountOut;
            
            emit Swap(
                msg.sender,
                recipient,
                int256(amountIn),
                -int256(amountOut),
                0, // sqrtPriceX96 (simplified)
                0, // liquidity (simplified)
                0  // tick (simplified)
            );
        } else {
            // Swapping token1 (WETH) for token0 (USDC)
            amountOut = getAmountOut(amountIn, reserve1, reserve0);
            require(amountOut >= amountOutMinimum, "MockPool: Insufficient output amount");
            require(amountOut <= reserve0, "MockPool: Insufficient liquidity");
            
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenOut).safeTransfer(recipient, amountOut);
            
            reserve1 += amountIn;
            reserve0 -= amountOut;
            
            emit Swap(
                msg.sender,
                recipient,
                -int256(amountOut),
                int256(amountIn),
                0, // sqrtPriceX96 (simplified)
                0, // liquidity (simplified)
                0  // tick (simplified)
            );
        }
    }
    
    /**
     * @dev Calculate output amount using constant product formula with fees
     * Implementation of (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
     * Adjusted for our fee structure
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view returns (uint256 amountOut) {
        require(amountIn > 0, "MockPool: Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "MockPool: Insufficient liquidity");
        
        // Apply fee: subtract fee from amountIn
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - fee) / FEE_DENOMINATOR;
        
        // Constant product formula: x * y = k
        // amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /**
     * @dev Quote exact input swap (view function for quoter)
     */
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(
            (tokenIn == address(token0) && tokenOut == address(token1)) ||
            (tokenIn == address(token1) && tokenOut == address(token0)),
            "MockPool: Invalid token pair"
        );
        
        if (tokenIn == address(token0)) {
            return getAmountOut(amountIn, reserve0, reserve1);
        } else {
            return getAmountOut(amountIn, reserve1, reserve0);
        }
    }
    
    /**
     * @dev Get current reserves
     */
    function getReserves() external view returns (uint256, uint256) {
        return (reserve0, reserve1);
    }
    
    /**
     * @dev Get current price (token1 per token0)
     * Returns price with 18 decimals
     */
    function getPrice() external view returns (uint256) {
        if (reserve0 == 0) return 0;
        // Price = reserve1 / reserve0, adjusted for decimals
        // USDC has 6 decimals, WETH has 18 decimals
        return (reserve1 * 1e6 * PRECISION) / (reserve0 * 1e18);
    }
    
    /**
     * @dev Emergency function to set reserves (for testing)
     */
    function setReserves(uint256 _reserve0, uint256 _reserve1) external onlyOwner {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
    }
    
    /**
     * @dev Emergency withdraw function
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}