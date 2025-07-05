// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract IndexToken is OFT {
    address public vault;
    
    modifier onlyVault() {
        require(msg.sender == vault, "IndexToken: Only vault can call");
        _;
    }
    
    constructor(
        address _layerZeroEndpoint,
        address _owner
    ) OFT("Index Fund Token", "INDEX", _layerZeroEndpoint, _owner) Ownable(_owner) {
    }
    
    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "IndexToken: Invalid vault address");
        vault = _vault;
    }
    
    function mint(address _to, uint256 _amount) external onlyVault {
        _mint(_to, _amount);
    }
    
    function burn(address _from, uint256 _amount) external onlyVault {
        _burn(_from, _amount);
    }
}