// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Prelaunch review interface. This is not a deployed ABI.
interface IProgrammableCustomRegistryV1 {
    event ProgrammableCustomLaunchRegistered(
        bytes32 indexed launchId,
        bytes32 indexed providerId,
        address indexed token,
        address factory,
        address hook,
        bytes32 marketId,
        bytes32 templateId,
        bytes32 templateVersion,
        bytes32 configurationHash,
        address creator
    );
}
