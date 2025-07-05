// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockLayerZeroEndpoint {
    mapping(uint32 => bool) public supportedEids;
    mapping(address => bool) public delegates;
    
    constructor() {
        supportedEids[1] = true; // Mock endpoint ID
    }
    
    function isValidReceiveLibrary(address, uint32) external pure returns (bool) {
        return true;
    }
    
    function getReceiveLibrary(address, uint32) external pure returns (address, bool) {
        return (address(0), false);
    }
    
    function setDelegate(address _delegate) external {
        delegates[msg.sender] = _delegate != address(0);
    }
    
    function quote(
        uint32,
        address,
        bytes calldata,
        bytes calldata,
        bool
    ) external pure returns (uint256, uint256) {
        return (0, 0);
    }
    
    function send(
        uint32,
        address,
        bytes calldata,
        address,
        address,
        bytes calldata
    ) external payable returns (bytes32) {
        return bytes32(0);
    }
}