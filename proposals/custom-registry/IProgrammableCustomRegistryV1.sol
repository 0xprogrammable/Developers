// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Prelaunch review interface. This is not a deployed ABI.
interface IProgrammableCustomRegistryV1 {
    event ProgrammableCustomTemplateConfigured(
        bytes32 indexed providerId,
        bytes32 indexed templateId,
        bytes32 indexed templateVersion,
        address factory,
        bytes32 factoryRuntimeCodeHash,
        bytes32 implementationRuntimeCodeHash,
        bytes32 reviewCommitment,
        bool active
    );

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

    function isApprovedTemplate(bytes32 providerId, bytes32 templateId, bytes32 templateVersion)
        external
        view
        returns (bool);

    function registeredToken(bytes32 launchId) external view returns (address token);
}
