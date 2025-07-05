// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceOracle {
    function getPrice(string memory asset) external view returns (uint256);
    function updatePrice(string memory asset, uint256 price) external;
}