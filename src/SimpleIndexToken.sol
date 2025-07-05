// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleIndexToken is ERC20, Ownable {
    address public vault;
    
    modifier onlyVault() {
        require(msg.sender == vault, "SimpleIndexToken: Only vault can call");
        _;
    }
    
    constructor(address _owner) ERC20("Index Fund Token", "INDEX") Ownable(_owner) {
    }
    
    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "SimpleIndexToken: Invalid vault address");
        vault = _vault;
    }
    
    function mint(address _to, uint256 _amount) external onlyVault {
        _mint(_to, _amount);
    }
    
    function burn(address _from, uint256 _amount) external onlyVault {
        _burn(_from, _amount);
    }
}