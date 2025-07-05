// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IndexToken } from "./IndexToken.sol";
import { IPriceOracle } from "./interfaces/IPriceOracle.sol";
import { ISwapRouter, IQuoterV2, IWETH9 } from "./interfaces/IUniswapV3.sol";

contract IndexVaultV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IndexToken public indexToken;
    IPriceOracle public priceOracle;
    IERC20 public usdc;
    ISwapRouter public swapRouter;
    IQuoterV2 public quoter;
    IWETH9 public weth;
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant ALLOCATION_ETH = 40;
    uint256 public constant ALLOCATION_USDC = 30;
    uint256 public constant ALLOCATION_FLOW = 30;
    uint256 public constant MAX_SLIPPAGE = 300; // 3%
    uint256 public constant REBALANCE_THRESHOLD = 500; // 5% deviation triggers rebalance
    
    // Token addresses for different chains
    address public wethAddress;
    address public flowTokenAddress;
    
    // Pool fees for different pairs
    uint24 public constant POOL_FEE_LOW = 500;     // 0.05%
    uint24 public constant POOL_FEE_MEDIUM = 3000; // 0.3%
    uint24 public constant POOL_FEE_HIGH = 10000;  // 1%
    
    mapping(address => uint256) public userDeposits;
    uint256 public totalDeposits;
    
    uint256 public ethBalance;
    uint256 public usdcBalance;
    uint256 public flowBalance;
    
    // Rebalancing state
    uint256 public lastRebalanceTime;
    uint256 public rebalanceInterval = 1 hours;
    bool public autoRebalanceEnabled = true;
    
    event Deposit(address indexed user, uint256 usdcAmount, uint256 indexMinted);
    event Rebalanced(uint256 timestamp, uint256 totalValue);
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint24 fee
    );
    event RebalanceThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event AutoRebalanceToggled(bool enabled);
    
    constructor(
        address _indexToken,
        address _priceOracle,
        address _usdc,
        address _swapRouter,
        address _quoter,
        address _weth,
        address _owner
    ) Ownable(_owner) {
        indexToken = IndexToken(_indexToken);
        priceOracle = IPriceOracle(_priceOracle);
        usdc = IERC20(_usdc);
        swapRouter = ISwapRouter(_swapRouter);
        quoter = IQuoterV2(_quoter);
        weth = IWETH9(_weth);
        wethAddress = _weth;
    }
    
    function setFlowTokenAddress(address _flowToken) external onlyOwner {
        require(_flowToken != address(0), "IndexVaultV2: Invalid flow token address");
        flowTokenAddress = _flowToken;
    }
    
    function deposit(uint256 _usdcAmount) external nonReentrant {
        require(_usdcAmount > 0, "IndexVaultV2: Amount must be greater than 0");
        
        usdc.safeTransferFrom(msg.sender, address(this), _usdcAmount);
        
        uint256 indexToMint = calculateIndexTokens(_usdcAmount);
        
        userDeposits[msg.sender] += _usdcAmount;
        totalDeposits += _usdcAmount;
        
        usdcBalance += _usdcAmount;
        
        indexToken.mint(msg.sender, indexToMint);
        
        emit Deposit(msg.sender, _usdcAmount, indexToMint);
        
        // Auto-rebalance if enabled and conditions are met
        if (autoRebalanceEnabled && shouldRebalance()) {
            _rebalance();
        }
    }
    
    function calculateIndexTokens(uint256 _usdcAmount) public view returns (uint256) {
        if (indexToken.totalSupply() == 0) {
            return _usdcAmount * PRECISION / 1e6;
        }
        
        uint256 totalValue = getPortfolioValue();
        return (_usdcAmount * indexToken.totalSupply()) / totalValue;
    }
    
    function getPortfolioValue() public view returns (uint256) {
        uint256 ethPrice = priceOracle.getPrice("ETH");
        uint256 flowPrice = priceOracle.getPrice("FLOW");
        
        uint256 ethValue = (ethBalance * ethPrice) / PRECISION;
        uint256 flowValue = (flowBalance * flowPrice) / PRECISION;
        
        return ethValue + usdcBalance + flowValue;
    }
    
    function shouldRebalance() public view returns (bool) {
        // Check time-based condition
        if (block.timestamp < lastRebalanceTime + rebalanceInterval) {
            return false;
        }
        
        // Check deviation-based condition
        uint256 totalValue = getPortfolioValue();
        if (totalValue == 0) return false;
        
        uint256 ethPrice = priceOracle.getPrice("ETH");
        uint256 flowPrice = priceOracle.getPrice("FLOW");
        
        uint256 currentEthValue = (ethBalance * ethPrice) / PRECISION;
        uint256 currentFlowValue = (flowBalance * flowPrice) / PRECISION;
        
        uint256 currentEthPercent = (currentEthValue * 100) / totalValue;
        uint256 currentFlowPercent = (currentFlowValue * 100) / totalValue;
        uint256 currentUsdcPercent = (usdcBalance * 100) / totalValue;
        
        // Check if any allocation deviates by more than threshold
        return (
            _deviationExceedsThreshold(currentEthPercent, ALLOCATION_ETH) ||
            _deviationExceedsThreshold(currentFlowPercent, ALLOCATION_FLOW) ||
            _deviationExceedsThreshold(currentUsdcPercent, ALLOCATION_USDC)
        );
    }
    
    function _deviationExceedsThreshold(uint256 current, uint256 target) private pure returns (bool) {
        uint256 deviation = current > target ? current - target : target - current;
        return deviation > REBALANCE_THRESHOLD;
    }
    
    function rebalance() external onlyOwner {
        _rebalance();
    }
    
    function _rebalance() private {
        uint256 totalValue = getPortfolioValue();
        require(totalValue > 0, "IndexVaultV2: No portfolio value to rebalance");
        
        uint256 targetEthValue = (totalValue * ALLOCATION_ETH) / 100;
        uint256 targetUsdcValue = (totalValue * ALLOCATION_USDC) / 100;
        uint256 targetFlowValue = (totalValue * ALLOCATION_FLOW) / 100;
        
        uint256 ethPrice = priceOracle.getPrice("ETH");
        uint256 flowPrice = priceOracle.getPrice("FLOW");
        
        uint256 currentEthValue = (ethBalance * ethPrice) / PRECISION;
        uint256 currentFlowValue = (flowBalance * flowPrice) / PRECISION;
        
        // Execute swaps to reach target allocations
        _executeRebalanceSwaps(
            currentEthValue, targetEthValue, ethPrice,
            currentFlowValue, targetFlowValue, flowPrice,
            usdcBalance, targetUsdcValue
        );
        
        lastRebalanceTime = block.timestamp;
        emit Rebalanced(block.timestamp, totalValue);
    }
    
    function _executeRebalanceSwaps(
        uint256 currentEthValue, uint256 targetEthValue, uint256 ethPrice,
        uint256 currentFlowValue, uint256 targetFlowValue, uint256 flowPrice,
        uint256 currentUsdcValue, uint256 targetUsdcValue
    ) private {
        // ETH rebalancing
        if (currentEthValue > targetEthValue) {
            // Sell ETH
            uint256 ethToSell = ((currentEthValue - targetEthValue) * PRECISION) / ethPrice;
            if (ethToSell > 0 && ethToSell <= ethBalance) {
                _swapETHForUSDC(ethToSell);
            }
        } else if (currentEthValue < targetEthValue) {
            // Buy ETH
            uint256 usdcToSpend = targetEthValue - currentEthValue;
            if (usdcToSpend > 0 && usdcToSpend <= usdcBalance) {
                _swapUSDCForETH(usdcToSpend);
            }
        }
        
        // FLOW rebalancing (if Flow token is available)
        if (flowTokenAddress != address(0)) {
            if (currentFlowValue > targetFlowValue) {
                // Sell FLOW
                uint256 flowToSell = ((currentFlowValue - targetFlowValue) * PRECISION) / flowPrice;
                if (flowToSell > 0 && flowToSell <= flowBalance) {
                    _swapFlowForUSDC(flowToSell);
                }
            } else if (currentFlowValue < targetFlowValue) {
                // Buy FLOW
                uint256 usdcToSpend = targetFlowValue - currentFlowValue;
                if (usdcToSpend > 0 && usdcToSpend <= usdcBalance) {
                    _swapUSDCForFlow(usdcToSpend);
                }
            }
        }
    }
    
    function _swapETHForUSDC(uint256 ethAmount) private {
        // Convert ETH to WETH
        weth.deposit{value: ethAmount}();
        
        // Approve WETH for swapping
        IERC20(wethAddress).approve(address(swapRouter), ethAmount);
        
        // Calculate minimum amount out with slippage protection
        uint256 expectedUsdcOut = quoter.quoteExactInputSingle(
            wethAddress,
            address(usdc),
            POOL_FEE_MEDIUM,
            ethAmount,
            0
        );
        uint256 minAmountOut = (expectedUsdcOut * (10000 - MAX_SLIPPAGE)) / 10000;
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: wethAddress,
            tokenOut: address(usdc),
            fee: POOL_FEE_MEDIUM,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: ethAmount,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        uint256 amountOut = swapRouter.exactInputSingle(params);
        
        // Update balances
        ethBalance -= ethAmount;
        usdcBalance += amountOut;
        
        emit SwapExecuted(wethAddress, address(usdc), ethAmount, amountOut, POOL_FEE_MEDIUM);
    }
    
    function _swapUSDCForETH(uint256 usdcAmount) private {
        // Approve USDC for swapping
        usdc.approve(address(swapRouter), usdcAmount);
        
        // Calculate minimum amount out with slippage protection
        uint256 expectedWethOut = quoter.quoteExactInputSingle(
            address(usdc),
            wethAddress,
            POOL_FEE_MEDIUM,
            usdcAmount,
            0
        );
        uint256 minAmountOut = (expectedWethOut * (10000 - MAX_SLIPPAGE)) / 10000;
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(usdc),
            tokenOut: wethAddress,
            fee: POOL_FEE_MEDIUM,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: usdcAmount,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        uint256 amountOut = swapRouter.exactInputSingle(params);
        
        // Convert WETH to ETH
        weth.withdraw(amountOut);
        
        // Update balances
        usdcBalance -= usdcAmount;
        ethBalance += amountOut;
        
        emit SwapExecuted(address(usdc), wethAddress, usdcAmount, amountOut, POOL_FEE_MEDIUM);
    }
    
    function _swapFlowForUSDC(uint256 flowAmount) private {
        require(flowTokenAddress != address(0), "IndexVaultV2: Flow token not set");
        
        // Approve Flow token for swapping
        IERC20(flowTokenAddress).approve(address(swapRouter), flowAmount);
        
        // Calculate minimum amount out with slippage protection
        uint256 expectedUsdcOut = quoter.quoteExactInputSingle(
            flowTokenAddress,
            address(usdc),
            POOL_FEE_HIGH, // Higher fee for less liquid pairs
            flowAmount,
            0
        );
        uint256 minAmountOut = (expectedUsdcOut * (10000 - MAX_SLIPPAGE)) / 10000;
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: flowTokenAddress,
            tokenOut: address(usdc),
            fee: POOL_FEE_HIGH,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: flowAmount,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        uint256 amountOut = swapRouter.exactInputSingle(params);
        
        // Update balances
        flowBalance -= flowAmount;
        usdcBalance += amountOut;
        
        emit SwapExecuted(flowTokenAddress, address(usdc), flowAmount, amountOut, POOL_FEE_HIGH);
    }
    
    function _swapUSDCForFlow(uint256 usdcAmount) private {
        require(flowTokenAddress != address(0), "IndexVaultV2: Flow token not set");
        
        // Approve USDC for swapping
        usdc.approve(address(swapRouter), usdcAmount);
        
        // Calculate minimum amount out with slippage protection
        uint256 expectedFlowOut = quoter.quoteExactInputSingle(
            address(usdc),
            flowTokenAddress,
            POOL_FEE_HIGH,
            usdcAmount,
            0
        );
        uint256 minAmountOut = (expectedFlowOut * (10000 - MAX_SLIPPAGE)) / 10000;
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(usdc),
            tokenOut: flowTokenAddress,
            fee: POOL_FEE_HIGH,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: usdcAmount,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        uint256 amountOut = swapRouter.exactInputSingle(params);
        
        // Update balances
        usdcBalance -= usdcAmount;
        flowBalance += amountOut;
        
        emit SwapExecuted(address(usdc), flowTokenAddress, usdcAmount, amountOut, POOL_FEE_HIGH);
    }
    
    // Admin functions
    function setRebalanceInterval(uint256 _interval) external onlyOwner {
        rebalanceInterval = _interval;
    }
    
    function toggleAutoRebalance() external onlyOwner {
        autoRebalanceEnabled = !autoRebalanceEnabled;
        emit AutoRebalanceToggled(autoRebalanceEnabled);
    }
    
    function updateBalances(uint256 _ethBalance, uint256 _usdcBalance, uint256 _flowBalance) external onlyOwner {
        ethBalance = _ethBalance;
        usdcBalance = _usdcBalance;
        flowBalance = _flowBalance;
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }
    
    function getRebalanceInfo() external view returns (
        bool shouldRebalanceNow,
        uint256 timeSinceLastRebalance,
        uint256 currentEthPercent,
        uint256 currentUsdcPercent,
        uint256 currentFlowPercent,
        uint256 totalValue
    ) {
        shouldRebalanceNow = shouldRebalance();
        timeSinceLastRebalance = block.timestamp - lastRebalanceTime;
        
        totalValue = getPortfolioValue();
        if (totalValue > 0) {
            uint256 ethPrice = priceOracle.getPrice("ETH");
            uint256 flowPrice = priceOracle.getPrice("FLOW");
            
            uint256 currentEthValue = (ethBalance * ethPrice) / PRECISION;
            uint256 currentFlowValue = (flowBalance * flowPrice) / PRECISION;
            
            currentEthPercent = (currentEthValue * 100) / totalValue;
            currentFlowPercent = (currentFlowValue * 100) / totalValue;
            currentUsdcPercent = (usdcBalance * 100) / totalValue;
        }
    }
    
    receive() external payable {
        ethBalance += msg.value;
    }
}