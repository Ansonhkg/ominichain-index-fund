// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IndexToken } from "./IndexToken.sol";
import { IPriceOracle } from "./interfaces/IPriceOracle.sol";

contract IndexVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IndexToken public indexToken;
    IPriceOracle public priceOracle;
    IERC20 public usdc;
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant ALLOCATION_ETH = 40;
    uint256 public constant ALLOCATION_USDC = 30;
    uint256 public constant ALLOCATION_FLOW = 30;
    
    mapping(address => uint256) public userDeposits;
    uint256 public totalDeposits;
    
    uint256 public ethBalance;
    uint256 public usdcBalance;
    uint256 public flowBalance;
    
    event Deposit(address indexed user, uint256 usdcAmount, uint256 indexMinted);
    event Rebalanced(uint256 timestamp);
    
    constructor(
        address _indexToken,
        address _priceOracle,
        address _usdc,
        address _owner
    ) Ownable(_owner) {
        indexToken = IndexToken(_indexToken);
        priceOracle = IPriceOracle(_priceOracle);
        usdc = IERC20(_usdc);
    }
    
    function deposit(uint256 _usdcAmount) external nonReentrant {
        require(_usdcAmount > 0, "IndexVault: Amount must be greater than 0");
        
        usdc.safeTransferFrom(msg.sender, address(this), _usdcAmount);
        
        uint256 indexToMint = calculateIndexTokens(_usdcAmount);
        
        userDeposits[msg.sender] += _usdcAmount;
        totalDeposits += _usdcAmount;
        
        usdcBalance += _usdcAmount;
        
        indexToken.mint(msg.sender, indexToMint);
        
        emit Deposit(msg.sender, _usdcAmount, indexToMint);
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
    
    function rebalance() external onlyOwner {
        uint256 totalValue = getPortfolioValue();
        
        uint256 targetEthValue = (totalValue * ALLOCATION_ETH) / 100;
        uint256 targetUsdcValue = (totalValue * ALLOCATION_USDC) / 100;
        uint256 targetFlowValue = (totalValue * ALLOCATION_FLOW) / 100;
        
        emit Rebalanced(block.timestamp);
    }
    
    function updateBalances(uint256 _ethBalance, uint256 _usdcBalance, uint256 _flowBalance) external onlyOwner {
        ethBalance = _ethBalance;
        usdcBalance = _usdcBalance;
        flowBalance = _flowBalance;
    }
    
    receive() external payable {
        ethBalance += msg.value;
    }
}