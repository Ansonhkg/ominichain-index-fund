// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockWETH
 * @dev Mock Wrapped Ether contract for testing
 * Implements the IWETH9 interface for compatibility with IndexVaultV2
 */
contract MockWETH is ERC20 {
    event Deposit(address indexed dst, uint wad);
    event Withdrawal(address indexed src, uint wad);

    constructor() ERC20("Mock Wrapped Ether", "WETH") {}

    /**
     * @dev Deposit ETH and get WETH tokens
     */
    function deposit() external payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw ETH by burning WETH tokens
     * Note: In a mock environment, we simulate ETH availability
     */
    function withdraw(uint256 wad) external {
        require(balanceOf(msg.sender) >= wad, "MockWETH: Insufficient balance");
        _burn(msg.sender, wad);
        
        // For mock testing, we simulate ETH transfer without actually transferring
        // In a real environment, this would transfer actual ETH
        // Try to send ETH if available, but don't fail if not
        if (address(this).balance >= wad) {
            (bool success, ) = payable(msg.sender).call{value: wad}("");
            // Don't revert if transfer fails in mock environment
        }
        
        emit Withdrawal(msg.sender, wad);
    }
    
    /**
     * @dev Fund the contract with ETH for withdrawals (testing only)
     */
    function fundWithETH() external payable {
        // This function allows funding the contract with ETH for testing
    }

    /**
     * @dev Mint WETH to an address (for testing purposes)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Get ETH balance for funding the contract
     */
    receive() external payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Allow contract to hold ETH for withdrawals
     */
    fallback() external payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }
}