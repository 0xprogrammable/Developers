import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { developerManifestForChain } from "../server/chain-manifests.js";
import { canonicalSha256 } from "../server/canonical.js";
import {
  activeFinalizedV4Binding,
  finalizedV4FeedTestOnly,
  isTrustedFinalizedCustomV4Record,
  readFinalizedCustomLaunchesV4,
  resetFinalizedV4FeedForTest,
} from "../server/finalized-v4-feed.js";
import {
  projectV2Record,
  publicLaunchV2,
} from "../server/v2-dataset.js";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";

const ROUTER = "0x34965F2A2ee9254522232C32F02056E92BE0C98a";
const WALLET = "0x4444444444444444444444444444444444444444";
const FACTORY = "0x0B6b3F40f84Df25D3bd69238f937096177DD09Bd";
const AUTHORITY = "0xeD617CE7f82e2AB589aDeFFD319D1D872Bc8De06";
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const OTHER = "0x8888888888888888888888888888888888888888";
const POSITION_MANAGER = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";
const STATE_VIEW = "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b";
const V4_QUOTER = "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94";
const UNIVERSAL_ROUTER = "0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99";
const ROUTER_RUNTIME =
  "0x1dbbdaaad901ea3c6134dca0d4872a4789b3c071bf8ccfb44edd65d26d817388";
const FACTORY_RUNTIME =
  "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8";
const AUTHORITY_RUNTIME =
  "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c";
const POOL_MANAGER_RUNTIME =
  "0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626";
const POSITION_MANAGER_RUNTIME =
  "0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2";
const STATE_VIEW_RUNTIME =
  "0x7d9c591e0956fd89d98feb4ffcfe8bf1f7a62bd485edd979fa21d104b49878a6";
const V4_QUOTER_RUNTIME =
  "0xd707b1da8cb165e5ea35a3b4450d971eb562ec171e23492aa117036b78a868f6";
const UNIVERSAL_ROUTER_RUNTIME =
  "0xbe8e8191bb42d843c2e948a5a55772eaab864ce01e54dcd47c9d089170b302d5";
const LAUNCH_ID = `0x${"a".repeat(64)}`;
const HASH_B = `0x${"b".repeat(64)}`;
const HASH_C = `0x${"c".repeat(64)}`;
const HASH_D = `0x${"d".repeat(64)}`;
const HASH_E = `0x${"e".repeat(64)}`;
const HASH_F = `0x${"f".repeat(64)}`;
const SHA_1 = `sha256:${"1".repeat(64)}`;
const SHA_2 = `sha256:${"2".repeat(64)}`;
const SHA_3 = `sha256:${"3".repeat(64)}`;
const SHA_4 = `sha256:${"4".repeat(64)}`;
const SHA_5 = `sha256:${"5".repeat(64)}`;
const SHA_6 = `sha256:${"6".repeat(64)}`;

function projectMetadata() {
  return {
    schemaVersion: "programmable.project-metadata.v1",
    token: { name: "Robinhood Fixture", symbol: "RHF" },
    presentation: {
      schemaVersion: "programmable.launch-presentation-draft.v1",
      description: "A finalized chain-scoped fixture.",
      image: {
        uri: "https://fixture.example/project.png",
        contentSha256: SHA_6,
        mediaType: "image/png",
        byteLength: 1_024,
        width: 512,
        height: 512,
      },
      links: [
        { kind: "website", uri: "https://fixture.example/" },
        { kind: "x", uri: "https://x.com/fixture" },
      ],
    },
    tokenMetadataBinding: {
      schemaVersion: "programmable.project-token-metadata-binding.v1",
      tokenTargetId: "token",
      declarationBinding: "request-and-launch-id",
      standardReadModel: { name: true, symbol: true },
      name: {
        staticSource: "constructor-argument",
        argumentIndex: 0,
        argumentName: "name_",
      },
      symbol: {
        staticSource: "constructor-argument",
        argumentIndex: 1,
        argumentName: "symbol_",
      },
      postDeploymentReadback: "required",
    },
  };
}

function exactSourceVerification(manifest = { chainId: 4663, caip2: "eip155:4663" }) {
  return {
    schemaVersion: "programmable.source-verification-status.v4",
    chainId: String(manifest.chainId),
    caip2: manifest.caip2,
    chainDeploymentId: manifest.customLaunchV4?.chainDeploymentId ??
      "robinhood-mainnet-custom-launch-v1",
    status: "exact_match",
    components: [
      {
        targetId: "hook",
        address: "0x1111111111111111111111111111111111111111",
        status: "exact_match",
        exactMatchProvider: "sourcify-v2",
        evidenceDigest: SHA_1,
        updatedAt: "2026-08-29T15:02:00.000Z",
      },
      {
        targetId: "token",
        address: "0x2222222222222222222222222222222222222222",
        status: "exact_match",
        exactMatchProvider: "sourcify-v2",
        evidenceDigest: SHA_2,
        updatedAt: "2026-08-29T15:03:00.000Z",
      },
    ],
    updatedAt: "2026-08-29T15:03:00.000Z",
  };
}

function queuedSourceVerification() {
  const value = exactSourceVerification();
  value.status = "queued";
  value.components[1] = {
    targetId: "token",
    address: "0x2222222222222222222222222222222222222222",
    status: "queued",
    exactMatchProvider: null,
    evidenceDigest: null,
    updatedAt: "2026-08-29T15:04:00.000Z",
    nextAttemptAt: "2026-08-29T15:09:00.000Z",
  };
  value.updatedAt = "2026-08-29T15:04:00.000Z";
  return value;
}

function nonExactSourceVerificationComponent(
  component,
  status,
  updatedAt,
  nextAttemptAt,
) {
  return {
    targetId: component.targetId,
    address: component.address,
    status,
    exactMatchProvider: null,
    evidenceDigest: null,
    updatedAt,
    ...(nextAttemptAt === undefined ? {} : { nextAttemptAt }),
  };
}

async function liveManifest(chainId = 4663) {
  const manifest = await developerManifestForChain(4663);
  const caip2 = `eip155:${chainId}`;
  const sourceUrl =
    `https://api.programmable.market/v4/chains/${chainId}/finalized-custom-launches`;
  manifest.chainId = chainId;
  manifest.caip2 = caip2;
  manifest.network.caip2 = caip2;
  manifest.supportedChainIds = [chainId];
  manifest.chains = [{
    chainId,
    caip2,
    name: `Synthetic chain ${chainId}`,
    status: "live",
    manifestUrl:
      `https://developers.programmable.family/api/v2/manifests/${chainId}`,
    readModelStatus: "ready",
    finalizedFeedUrl: sourceUrl,
  }];
  const profileWithoutDigest = {
    schemaVersion: "programmable.custom-launch-profile-ref.v4",
    structuralProfileId: "programmable.custom-launch.robinhood-mainnet.v1",
    businessProfileId: "robinhood-production-launch",
    admissionDescriptorDigest:
      "sha256:99b4ccabdaaf143bad28a8f6af441a1b93e1f113d0179236328b7fa594d1f948",
    admissionPolicyDigest:
      "sha256:31e6b286ca839b31cb1edfe30c05d9f334892f3d84377961dc10b93959c7e216",
    admissionSchemaDigest:
      "sha256:a28a6de6208d6ba7b65b4b706174509570955ba9ce9714624bcb2046ab7beae7",
    admissionBindingDigest:
      "sha256:f31643e6e9ff6d5409d59a2fc3ac7fb5ac9cfcb3af08e95c9478bc95ddfa66a2",
    profileRevision: 1,
    profileVersion: "4.0.0",
  };
  const profile = {
    ...profileWithoutDigest,
    profileDigest: canonicalSha256(
      "programmable.custom-launch-profile-ref.v4",
      profileWithoutDigest,
    ),
  };
  const finalityPolicy = {
    schemaVersion: "programmable.custom-launch-finality-policy-ref.v1",
    policyId: "ethereum-finalized",
    policyRevision: 1,
    policyDigest: SHA_2,
  };
  Object.assign(manifest.customLaunchV4, {
    status: "live",
    chainId,
    caip2,
    chainDeploymentId: chainId === 4663
      ? "robinhood-mainnet-custom-launch-v1"
      : `synthetic-chain-${chainId}-custom-launch-v1`,
    chainDeploymentDescriptorDigest: HASH_E,
    profile,
    finalityPolicy,
  });
  Object.assign(manifest.customLaunchV4.api, {
    status: "live",
    capabilitiesPath: `/v4/chains/${chainId}/capabilities`,
    preflightPath: `/v4/chains/${chainId}/custom-launches/preflight`,
    collectionPath: `/v4/chains/${chainId}/custom-launches`,
    resourcePath: `/v4/chains/${chainId}/custom-launches/{launchId}`,
    finalizedLaunchesPath:
      `/v4/chains/${chainId}/finalized-custom-launches`,
  });
  Object.assign(manifest.launchStampRouter, {
    status: "live",
    address: ROUTER,
    startBlock: "50000000",
    runtimeCodeHash: ROUTER_RUNTIME,
    artifact: {
      sourceRepository: "https://github.com/programmablehq/PROGRAMMABLE",
      sourceCommit: "1".repeat(40),
      sourceTree: "2".repeat(40),
      sourcePath: "contracts/ProgrammableLaunchStampRouterV1.sol",
      artifactPath:
        "out/ProgrammableLaunchStampRouterV1.sol/ProgrammableLaunchStampRouterV1.json",
    },
    deploymentEvidence: {
      verificationStatus: "finalized-verified",
      address: ROUTER,
      deploymentTransactionHash: HASH_C,
      deploymentBlockNumber: "50000000",
      deploymentBlockHash: HASH_D,
      finalizedBlockNumber: "50000012",
      finalizedBlockHash: HASH_E,
      runtimeCodeKeccak256: ROUTER_RUNTIME,
    },
    canaryEvidence: {
      finality: "finalized",
      transactionHash: HASH_D,
      blockNumber: "50000020",
      blockHash: HASH_E,
      launchId: LAUNCH_ID,
    },
    bindings: {
      permitAuthority: AUTHORITY,
      permitAuthorityRuntimeCodeHash: AUTHORITY_RUNTIME,
      graphFactory: FACTORY,
      graphFactoryRuntimeCodeHash: FACTORY_RUNTIME,
      poolManager: POOL_MANAGER,
      poolManagerRuntimeCodeHash: POOL_MANAGER_RUNTIME,
    },
  });
  manifest.extensions["programmable/read-model-v1"] = {
    status: "live",
    source: "backend-finalized-custom-launches",
    finalizedFeedUrl: sourceUrl,
    lastKnownGoodScope: "chain-id",
    absenceAuthoritative: true,
    activationRequirements: [],
  };
  return manifest;
}

function chainDeploymentFor(manifest) {
  const contract = (address, runtimeCodeHash) => ({ address, runtimeCodeHash });
  const contracts = {
    programmableLaunchStampRouter: contract(ROUTER, ROUTER_RUNTIME),
    permitAuthority: contract(AUTHORITY, AUTHORITY_RUNTIME),
    graphFactory: contract(FACTORY, FACTORY_RUNTIME),
    poolManager: contract(POOL_MANAGER, POOL_MANAGER_RUNTIME),
    positionManager: contract(POSITION_MANAGER, POSITION_MANAGER_RUNTIME),
    stateView: contract(STATE_VIEW, STATE_VIEW_RUNTIME),
    v4Quoter: contract(V4_QUOTER, V4_QUOTER_RUNTIME),
    permit2: contract(
      "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      "0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca",
    ),
    universalRouter: contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_RUNTIME),
  };
  const ethereumFinalityWithoutDigest = {
    schemaVersion:
      "programmable.robinhood-l2-checkpoint-ethereum-finality.v1",
    profile: structuredClone(manifest.customLaunchV4.profile),
    l2Checkpoint: { blockNumber: "50000000", blockHash: HASH_D },
    batchNumber: "123",
    l2Providers: [
      { providerId: "drpc", trustDomain: "drpc.org", l1Confirmations: "12" },
      {
        providerId: "alchemy",
        trustDomain: "alchemy.com",
        l1Confirmations: "12",
      },
    ],
    ethereumProviders: [
      { providerId: "drpc", trustDomain: "drpc.org" },
      { providerId: "quicknode", trustDomain: "quicknode.com" },
    ],
    rollup: "0x23A19d23e89166adedbDcB432518AB01e4272D94",
    sequencerInbox: "0xBd0D173EEb87D57A09521c24388a12789F33ba96",
    postingTransactionHash: HASH_B,
    postingBlockNumber: "19000000",
    postingBlockHash: HASH_C,
    postingLogIndex: "7",
    ethereumFinalizedCheckpoint: {
      blockNumber: "19000012",
      blockHash: HASH_D,
      tag: "finalized",
    },
    observedAt: "2026-08-29T15:00:00.000Z",
  };
  const ethereumFinalityEvidence = {
    ...ethereumFinalityWithoutDigest,
    evidenceDigest: canonicalSha256(
      ethereumFinalityWithoutDigest.schemaVersion,
      ethereumFinalityWithoutDigest,
    ),
  };
  const safeProvider = (providerId, trustDomain) => {
    const withoutDigest = { providerId, trustDomain };
    return {
      ...withoutDigest,
      evidenceDigest: canonicalSha256(
        "programmable.safe-configuration-provider-evidence.v1",
        withoutDigest,
      ),
    };
  };
  const safeConfigurationWithoutDigest = {
    schemaVersion: "programmable.safe-configuration-evidence.v1",
    finalized: true,
    blockNumber: "50000000",
    blockHash: HASH_D,
    proxyRuntimeCodeHash:
      "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
    singleton: {
      address: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
      runtimeCodeHash:
        "0x1fe2df852ba3299d6534ef416eefa406e56ced995bca886ab7a553e6d0c5e1c4",
      version: "1.4.1",
      sourceCommitment:
        "sha256:4591dc35029cba2a869f91919cb3cf7e7c68f26727cc68e4b03d99cdf1bc2ebb",
    },
    fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
    fallbackHandlerRuntimeCodeHash:
      "0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9",
    owners: [
      "0x032b1c7b96793717F0BD2f11eb86cd10CdefC4a3",
      "0x2Bb333d48DFAF1596D9036671d2E43168994249E",
    ],
    threshold: 1,
    nonce: "0",
    modules: [],
    modulesNext: "0x0000000000000000000000000000000000000001",
    guard: null,
    singletonSlot:
      "0x00000000000000000000000041675c099f32341bf84bfc5382af534df5c7461a",
    fallbackHandlerSlot:
      "0x000000000000000000000000fd0732dc9e303f09fcef3a7388ad10a83459ec99",
    guardSlot: `0x${"0".repeat(64)}`,
    primaryProvider: safeProvider("drpc", "drpc.org"),
    secondaryProvider: safeProvider("alchemy", "alchemy.com"),
    ethereumFinalityEvidence,
  };
  const registrySource = {
    repository: "Uniswap/contracts",
    commit: "4cfc406c8e34da3ce04e60657a7825075b64fd22",
    path: "deployments/json/4663.json",
    rawUrl:
      "https://raw.githubusercontent.com/Uniswap/contracts/4cfc406c8e34da3ce04e60657a7825075b64fd22/deployments/json/4663.json",
    sha256:
      "sha256:21964cefbfc24b0ee89e7427acf74d223ce5a50aeb4216a9bac361a6148dea15",
  };
  const externalRoots = [
    {
      contract: "poolManager",
      transactionHash:
        "0x4fb28d4935866f462582c6c931c6f2705e55f5be5eb178c7d8d9329a95c44c41",
      startBlock: "9070",
    },
    {
      contract: "positionManager",
      transactionHash:
        "0x228c18ada6cb46b4fbcc18f4ec1519953415393e256fa8349aafbd5a2db037c8",
      startBlock: "9073",
    },
    {
      contract: "stateView",
      transactionHash:
        "0x3d61e2c9eeb482385b1aa436b9e8f812167ea579cc390e4f93bc5abde00582f4",
      startBlock: "9075",
    },
    {
      contract: "v4Quoter",
      transactionHash:
        "0x6bf436d72a17f87284ddcab43094689bd320dfb39b535213b9a0b669fabc4ab4",
      startBlock: "9074",
    },
    {
      contract: "universalRouter",
      transactionHash:
        "0xdfb76494e158d8dea4376160315239271636a18515207fd4526e574bc7eeb456",
      startBlock: "3347899",
    },
  ];
  const externalEvidence = ({ contract: contractName, transactionHash, startBlock }) => {
    const providerReadback = (providerId, trustDomain) => {
      const withoutDigest = {
        providerId,
        trustDomain,
        transactionHash,
        blockNumber: startBlock,
        blockHash: HASH_E,
        runtimeCodeHash: contracts[contractName].runtimeCodeHash,
        transactionReceiptDigest: SHA_4,
      };
      return {
        ...withoutDigest,
        evidenceDigest: canonicalSha256(
          "programmable.custom-launch-deployment-provider-readback.v1",
          withoutDigest,
        ),
      };
    };
    const withoutDigest = {
      schemaVersion: "programmable.custom-launch-deployment-evidence.v1",
      contract: contractName,
      kind: "exact-observed-deployment",
      address: contracts[contractName].address,
      runtimeCodeHash: contracts[contractName].runtimeCodeHash,
      transactionHash,
      startBlock,
      blockHash: HASH_E,
      registrySource: structuredClone(registrySource),
      providerReadbacks: [
        providerReadback("drpc", "drpc.org"),
        providerReadback("alchemy", "alchemy.com"),
      ],
    };
    return {
      ...withoutDigest,
      evidenceDigest: canonicalSha256(withoutDigest.schemaVersion, withoutDigest),
    };
  };
  const atomicReadback = (providerId, trustDomain) => {
    const withoutDigest = {
      providerId,
      trustDomain,
      transactionHash: HASH_C,
      transactionResponseDigest: SHA_3,
      transactionReceiptDigest: SHA_4,
    };
    return {
      ...withoutDigest,
      evidenceDigest: canonicalSha256(
        "programmable.robinhood-atomic-root-deployment-provider-readback.v1",
        withoutDigest,
      ),
    };
  };
  const atomicReceiptLogs = [];
  const atomicTransitionReadback = (
    providerId,
    trustDomain,
    contract,
    address,
    runtimeCodeHash,
  ) => {
    const withoutDigest = {
      schemaVersion:
        "programmable.robinhood-atomic-root-runtime-transition-provider-readback.v1",
      providerId,
      trustDomain,
      contract,
      address,
      preDeploymentBlockNumber: "49999999",
      preDeploymentBlockHash: HASH_B,
      preDeploymentRuntimeCodeHash:
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
      deploymentBlockNumber: "50000000",
      deploymentBlockHash: HASH_D,
      deploymentRuntimeCodeHash: runtimeCodeHash,
    };
    return {
      ...withoutDigest,
      evidenceDigest: canonicalSha256(withoutDigest.schemaVersion, withoutDigest),
    };
  };
  const atomicResult = (contract, address, runtimeCodeHash) => {
    const withoutDigest = {
      contract,
      address,
      runtimeCodeHash,
      previousBlockRuntimeCodeHash:
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
      providerReadbacks: [
        atomicTransitionReadback(
          "drpc", "drpc.org", contract, address, runtimeCodeHash,
        ),
        atomicTransitionReadback(
          "alchemy", "alchemy.com", contract, address, runtimeCodeHash,
        ),
      ],
    };
    return {
      ...withoutDigest,
      stateEvidenceDigest: canonicalSha256(
        "programmable.robinhood-atomic-root-deployment-result-state.v1",
        withoutDigest,
      ),
    };
  };
  const atomicDeploymentWithoutDigest = {
    schemaVersion:
      "programmable.robinhood-atomic-root-deployment-evidence.v1",
    deploymentId: "robinhood-mainnet-custom-launch-v1",
    chainId: "4663",
    coveredContracts: [
      "programmableLaunchStampRouter",
      "graphFactory",
      "permitAuthority",
    ],
    transactionHash: HASH_C,
    from: "0x032b1c7b96793717F0BD2f11eb86cd10CdefC4a3",
    to: "0xcA11bde05977b3631167028862bE2a173976CA11",
    valueWei: "0",
    selector: "0x82ad56cb",
    calldataHash:
      "0x3ba04469085b17e12843a94c154a335c9c384837f8f6531f179cb4915fd237d9",
    calldataBytes: 33412,
    nonce: "7",
    transactionIndex: "3",
    receiptStatus: "1",
    blockNumber: "50000000",
    blockHash: HASH_D,
    receiptLogs: atomicReceiptLogs,
    receiptLogsDigest: canonicalSha256(
      "programmable.robinhood-atomic-root-deployment-receipt-logs.v1",
      atomicReceiptLogs,
    ),
    providerReadbacks: [
      atomicReadback("drpc", "drpc.org"),
      atomicReadback("alchemy", "alchemy.com"),
    ],
    resultingContracts: [
      atomicResult("permitAuthority", AUTHORITY, AUTHORITY_RUNTIME),
      atomicResult("graphFactory", FACTORY, FACTORY_RUNTIME),
      atomicResult(
        "programmableLaunchStampRouter", ROUTER, ROUTER_RUNTIME,
      ),
    ],
    ethereumFinalityEvidence: structuredClone(ethereumFinalityEvidence),
    sourceVerification: {
      sourcifyExactMatchCoveredContracts: [
        "programmableLaunchStampRouter",
        "graphFactory",
      ],
      officialSourcePinnedCoveredContracts: ["permitAuthority"],
    },
  };
  const atomicDeploymentEvidence = {
    ...atomicDeploymentWithoutDigest,
    evidenceDigest: canonicalSha256(
      atomicDeploymentWithoutDigest.schemaVersion,
      atomicDeploymentWithoutDigest,
    ),
  };
  safeConfigurationWithoutDigest.atomicRootStateEvidenceDigest =
    atomicDeploymentEvidence.resultingContracts[0].stateEvidenceDigest;
  const safeConfigurationEvidence = {
    ...safeConfigurationWithoutDigest,
    evidenceDigest: canonicalSha256(
      "programmable.safe-configuration-evidence.v1",
      safeConfigurationWithoutDigest,
    ),
  };
  const genesisReadback = (providerId, trustDomain) => {
    const withoutDigest = {
      schemaVersion:
        "programmable.custom-launch-genesis-provider-readback.v1",
      providerId,
      trustDomain,
      blockNumber: "0",
      blockHash: HASH_B,
      runtimeCodeHash:
        "0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca",
    };
    return {
      ...withoutDigest,
      evidenceDigest: canonicalSha256(
        withoutDigest.schemaVersion,
        withoutDigest,
      ),
    };
  };
  const permit2GenesisWithoutDigest = {
    schemaVersion: "programmable.custom-launch-genesis-provenance.v1",
    kind: "genesis-predeploy",
    address: contracts.permit2.address,
    startBlock: "0",
    genesisSourceUrl:
      "https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-genesis.json",
    genesisSourceDigest:
      "sha256:353e6f6441b47695b41cee0c3645cde8dd7492d2f7f574bfb6aa4371e41bb6ba",
    allocRuntimeCodeBytes: 9152,
    providerReadbacks: [
      genesisReadback("drpc", "drpc.org"),
      genesisReadback("alchemy", "alchemy.com"),
    ],
  };
  const permit2GenesisProvenance = {
    ...permit2GenesisWithoutDigest,
    evidenceDigest: canonicalSha256(
      permit2GenesisWithoutDigest.schemaVersion,
      permit2GenesisWithoutDigest,
    ),
  };
  const permitAuthoritySourceWithoutDigest = {
    schemaVersion: "programmable.custom-launch-deployment-evidence.v1",
    kind: "official-source-pinned",
    address: AUTHORITY,
    transactionHash: HASH_C,
    blockNumber: "50000000",
    blockHash: HASH_D,
    sourceCommitment:
      "sha256:4591dc35029cba2a869f91919cb3cf7e7c68f26727cc68e4b03d99cdf1bc2ebb",
    configurationEvidence: safeConfigurationEvidence,
  };
  const permitAuthoritySourceProvenance = {
    ...permitAuthoritySourceWithoutDigest,
    evidenceDigest: canonicalSha256(
      permitAuthoritySourceWithoutDigest.schemaVersion,
      permitAuthoritySourceWithoutDigest,
    ),
  };
  return {
    schemaVersion: "programmable.custom-launch-chain-deployment.v1",
    chainDeploymentId: manifest.customLaunchV4.chainDeploymentId,
    chainId: String(manifest.chainId),
    caip2: manifest.caip2,
    finality: structuredClone(manifest.customLaunchV4.finalityPolicy),
    foundationSourceCommitment:
      manifest.customLaunchV4.foundationSourceCommitment,
    deploymentEvidence: atomicDeploymentEvidence,
    permit2GenesisProvenance,
    permitAuthoritySourceProvenance,
    externalRootDeploymentEvidence: externalRoots.map(externalEvidence),
    contracts,
  };
}

function promotionAnchorFor(manifest) {
  return {
    chainId: manifest.chainId,
    caip2: manifest.caip2,
    chainDeploymentId: manifest.customLaunchV4.chainDeploymentId,
    chainDeploymentDescriptorDigest:
      manifest.customLaunchV4.chainDeploymentDescriptorDigest,
    foundationSourceCommitment:
      manifest.customLaunchV4.foundationSourceCommitment,
    chainDeployment: chainDeploymentFor(manifest),
    profile: structuredClone(manifest.customLaunchV4.profile),
    finalityPolicy: structuredClone(manifest.customLaunchV4.finalityPolicy),
    router: {
      address: manifest.launchStampRouter.address,
      runtimeCodeHash: manifest.launchStampRouter.runtimeCodeHash,
      startBlock: manifest.launchStampRouter.startBlock,
      abiSha256: manifest.launchStampRouter.abiSha256,
      artifact: structuredClone(manifest.launchStampRouter.artifact),
      deploymentEvidence: structuredClone(
        manifest.launchStampRouter.deploymentEvidence,
      ),
      canaryEvidence: structuredClone(manifest.launchStampRouter.canaryEvidence),
    },
    bindings: structuredClone(manifest.launchStampRouter.bindings),
  };
}

function resourceFor(manifest, overrides = {}) {
  const metadata = projectMetadata();
  const metadataDigest = canonicalSha256(
    "programmable.project-metadata.v1",
    metadata,
  );
  const commitments = {
    sourceBuild: SHA_3,
    graph: SHA_4,
    metadata: metadataDigest,
    verification: SHA_5,
    fundingPermit: SHA_6,
    launchIntent: SHA_1,
  };
  const chainDeployment = chainDeploymentFor(manifest);
  return {
    schemaVersion: "programmable.finalized-custom-launch-metadata.v4",
    apiVersion: "v4",
    launchId: "123e4567-e89b-42d3-a456-426614174000",
    chainId: String(manifest.chainId),
    caip2: manifest.caip2,
    chainDeploymentId: manifest.customLaunchV4.chainDeploymentId,
    chainDeploymentDescriptorDigest:
      manifest.customLaunchV4.chainDeploymentDescriptorDigest,
    chainDeployment,
    profile: structuredClone(manifest.customLaunchV4.profile),
    commitments,
    projectMetadata: metadata,
    funding: {
      schemaVersion: "programmable.custom-launch-funding-intent.v2",
      mode: "none",
      valueWei: "0",
    },
    liquidityModel: {
      schemaVersion: "programmable.custom-launch-liquidity-model.v1",
      model: "none-empty-pool",
      declaredLaunchState: "pool-not-initialized",
      targetIds: [],
    },
    sourceVerification: exactSourceVerification(manifest),
    onchain: {
      schemaVersion: "programmable.custom-launch-onchain-evidence.v2",
      apiVersion: "v4",
      chainId: String(manifest.chainId),
      caip2: manifest.caip2,
      chainDeploymentId: manifest.customLaunchV4.chainDeploymentId,
      chainDeploymentDescriptorDigest:
        manifest.customLaunchV4.chainDeploymentDescriptorDigest,
      chainDeployment,
      profile: structuredClone(manifest.customLaunchV4.profile),
      router: ROUTER,
      routerRuntimeCodeHash: ROUTER_RUNTIME,
      routerLaunchId: LAUNCH_ID,
      transactionHash: HASH_C,
      blockNumber: "50000025",
      blockHash: HASH_D,
      logIndex: 7,
      checkpointType: "ethereum_finalized",
      finalityPolicy: structuredClone(manifest.customLaunchV4.finalityPolicy),
      commitments,
      evidenceDigest: SHA_2,
      terminal: true,
      observedAt: "2026-08-29T15:00:00.000Z",
    },
    createdAt: "2026-08-29T14:00:00.000Z",
    finalizedAt: "2026-08-29T15:00:00.000Z",
    ...overrides,
  };
}

function pageFor(manifest, overrides = {}) {
  return {
    schemaVersion: "programmable.custom-launch-list.v4",
    apiVersion: "v4",
    chainId: String(manifest.chainId),
    caip2: manifest.caip2,
    generatedAt: "2026-08-29T15:01:00.000Z",
    quality: {
      status: "ready",
      sourceRowCount: 1,
      publishedRowCount: 1,
      quarantinedRowCount: 0,
    },
    launches: [resourceFor(manifest)],
    nextCursor: null,
    ...overrides,
  };
}

beforeEach(() => resetFinalizedV4FeedForTest());

describe("Router-backed finalized V4 feed", () => {
  test("keeps the checked Robinhood lane planned and performs no source read", async () => {
    const manifest = await developerManifestForChain(4663);
    let calls = 0;
    const result = await readFinalizedCustomLaunchesV4(manifest, {
      force: true,
      loadPage: async () => {
        calls += 1;
        throw new Error("must not run");
      },
    });
    assert.equal(activeFinalizedV4Binding(manifest), null);
    assert.equal(calls, 0);
    assert.equal(result.status, "unavailable");
    assert.equal(result.error.code, "CHAIN_READ_MODEL_PLANNED");
  });

  test("accepts only terminal Ethereum-finalized resources and projects V2", async () => {
    const manifest = await liveManifest();
    const result = await finalizedV4FeedTestOnly.read(
      manifest,
      promotionAnchorFor(manifest),
      {
      force: true,
      loadPage: async () => pageFor(manifest),
      },
    );
    assert.equal(result.status, "current", JSON.stringify(result.error));
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].chainId, 4663);
    assert.equal(result.records[0].launchId, LAUNCH_ID);
    assert.equal(result.records[0].token, null);
    assert.deepEqual(result.records[0].markets, []);
    assert.equal(result.records[0].launch.creatorAddress, null);
    assert.equal(result.records[0].launch.launchWallet, null);
    assert.equal(result.records[0].verification.approvalMatch, "unavailable");
    assert.equal(result.records[0].verification.provenanceStatus, "verified");
    assert.equal(result.records[0].launch.finality, "finalized");
    assert.deepEqual(
      result.records[0].extensions["programmable/backend-finalized-v4"]
        .sourceVerification,
      exactSourceVerification(manifest),
    );
    assert.equal(isTrustedFinalizedCustomV4Record(result.records[0]), true);
    assert.match(result.sourceIdentityCommitment, /^sha256:[0-9a-f]{64}$/u);

    const publicRecord = publicLaunchV2(projectV2Record(result.records[0]));
    const registry = await createSchemaRegistry("v2");
    assertValid(
      registry.validator("launch.schema.json"),
      publicRecord,
      "projected finalized V4 launch",
    );
    assertValid(
      registry.validator("custom-launch-source-verification-v4.schema.json"),
      publicRecord.extensions["programmable/backend-finalized-v4"]
        .sourceVerification,
      "projected finalized V4 source verification",
    );

    const validateSourceVerification = registry.validator(
      "custom-launch-source-verification-v4.schema.json",
    );
    const falseAggregate = queuedSourceVerification();
    falseAggregate.status = "exact_match";
    assert.equal(validateSourceVerification(falseAggregate), false);
    const missingNextAttempt = queuedSourceVerification();
    delete missingNextAttempt.components[1].nextAttemptAt;
    assert.equal(validateSourceVerification(missingNextAttempt), false);
    const nullNextAttempt = queuedSourceVerification();
    nullNextAttempt.components[1].nextAttemptAt = null;
    assert.equal(validateSourceVerification(nullNextAttempt), false);
    const nonCanonicalTimestamp = exactSourceVerification();
    nonCanonicalTimestamp.components[1].updatedAt = "2026-08-29T15:03:00Z";
    nonCanonicalTimestamp.updatedAt = "2026-08-29T15:03:00Z";
    assert.equal(validateSourceVerification(nonCanonicalTimestamp), false);
  });

  test("keeps queued source verification separate from Router provenance and finality", async () => {
    const manifest = await liveManifest();
    const page = pageFor(manifest);
    page.launches[0].sourceVerification = queuedSourceVerification();
    const result = await finalizedV4FeedTestOnly.read(
      manifest,
      promotionAnchorFor(manifest),
      { force: true, loadPage: async () => page },
    );

    assert.equal(result.status, "current", JSON.stringify(result.error));
    const record = result.records[0];
    assert.equal(record.launch.finality, "finalized");
    assert.equal(record.verification.provenanceStatus, "verified");
    assert.equal(
      record.extensions["programmable/backend-finalized-v4"]
        .sourceVerification.status,
      "queued",
    );
    assert.equal(
      record.extensions["programmable/backend-finalized-v4"]
        .sourceVerification.components[1].exactMatchProvider,
      null,
    );
  });

  test("rejects internally consistent extended-year source-verification timestamps", async () => {
    const manifest = await liveManifest();
    const page = pageFor(manifest);
    const sourceVerification = queuedSourceVerification();
    sourceVerification.components[0].updatedAt =
      "+010000-01-01T00:00:00.000Z";
    sourceVerification.components[1].updatedAt =
      "+010000-01-01T00:00:01.000Z";
    sourceVerification.components[1].nextAttemptAt =
      "+010000-01-01T00:00:02.000Z";
    sourceVerification.updatedAt = "+010000-01-01T00:00:01.000Z";
    page.launches[0].sourceVerification = sourceVerification;

    const registry = await createSchemaRegistry("v2");
    assert.equal(
      registry.validator("custom-launch-source-verification-v4.schema.json")(
        sourceVerification,
      ),
      false,
    );
    const result = await finalizedV4FeedTestOnly.read(
      manifest,
      promotionAnchorFor(manifest),
      { force: true, loadPage: async () => page },
    );
    assert.equal(result.status, "unavailable");
    assert.deepEqual(result.records, []);
  });

  test("matches backend precedence for mixed verification states", async () => {
    const manifest = await liveManifest();
    const cases = [
      {
        aggregate: "retrying",
        components: [
          ["queued", "2026-08-29T15:04:00.000Z", "2026-08-29T15:09:00.000Z"],
          ["retrying", "2026-08-29T15:05:00.000Z", "2026-08-29T15:10:00.000Z"],
        ],
        updatedAt: "2026-08-29T15:05:00.000Z",
      },
      {
        aggregate: "needs_attention",
        components: [
          ["needs_attention", "2026-08-29T15:06:00.000Z", undefined],
          ["queued", "2026-08-29T15:05:00.000Z", "2026-08-29T15:10:00.000Z"],
        ],
        updatedAt: "2026-08-29T15:06:00.000Z",
      },
    ];
    const registry = await createSchemaRegistry("v2");
    const validateSourceVerification = registry.validator(
      "custom-launch-source-verification-v4.schema.json",
    );

    for (const testCase of cases) {
      const page = pageFor(manifest);
      const sourceVerification = exactSourceVerification(manifest);
      sourceVerification.status = testCase.aggregate;
      sourceVerification.components = sourceVerification.components.map(
        (component, index) => nonExactSourceVerificationComponent(
          component,
          ...testCase.components[index],
        ),
      );
      sourceVerification.updatedAt = testCase.updatedAt;
      page.launches[0].sourceVerification = sourceVerification;

      const result = await finalizedV4FeedTestOnly.read(
        manifest,
        promotionAnchorFor(manifest),
        { force: true, loadPage: async () => page },
      );
      assert.equal(result.status, "current", JSON.stringify(result.error));
      assert.equal(
        result.records[0].extensions["programmable/backend-finalized-v4"]
          .sourceVerification.status,
        testCase.aggregate,
      );
      assert.equal(validateSourceVerification(sourceVerification), true);
    }
  });

  test("rejects malformed, cross-chain or overstated source-verification readback", async () => {
    const manifest = await liveManifest();
    const anchor = promotionAnchorFor(manifest);
    const mutations = [
      (resource) => { delete resource.sourceVerification; },
      (resource) => { resource.sourceVerification.chainId = "1"; },
      (resource) => { resource.sourceVerification.status = "queued"; },
      (resource) => { resource.sourceVerification.updatedAt = "2026-08-29T15:02:00.000Z"; },
      (resource) => { resource.sourceVerification.components.reverse(); },
      (resource) => {
        resource.sourceVerification.components[0].address =
          "0x111111111111111111111111111111111111111A";
      },
      (resource) => {
        resource.sourceVerification.components[0].exactMatchProvider =
          "blockscout";
      },
      (resource) => {
        resource.sourceVerification.components[0].evidenceDigest = null;
      },
      (resource) => {
        resource.sourceVerification.components[0].nextAttemptAt =
          "2026-08-29T15:09:00.000Z";
      },
      (resource) => {
        resource.sourceVerification.components[0].error = "provider secret";
      },
      (resource) => {
        resource.sourceVerification.error = "provider secret";
      },
      (resource) => {
        resource.sourceVerification = queuedSourceVerification();
        delete resource.sourceVerification.components[1].nextAttemptAt;
      },
      (resource) => {
        resource.sourceVerification = queuedSourceVerification();
        resource.sourceVerification.components[1].nextAttemptAt = null;
      },
    ];
    for (const mutate of mutations) {
      const page = pageFor(manifest);
      mutate(page.launches[0]);
      const result = await finalizedV4FeedTestOnly.read(manifest, anchor, {
        force: true,
        loadPage: async () => page,
      });
      assert.equal(result.status, "unavailable");
      assert.deepEqual(result.records, []);
    }
  });

  test("accepts only the minimized finalized public DTO and never republishes private fields", async () => {
    const manifest = await liveManifest();
    const anchor = promotionAnchorFor(manifest);
    const prohibited = new Set([
      "actionRequired", "controller", "credentialId", "failure",
      "partnerAttribution", "preparedArtifact", "rawRequestSha256",
      "requestHash", "requestId", "routeId", "simulationReceipt",
      "walletHandoffUrl", "walletTransaction",
      "walletTransactionPreimageHash",
    ]);
    const privateMutations = [
      (resource) => { resource.schemaVersion = "programmable.custom-launch.v4"; },
      (resource) => {
        resource.requestId = "123e4567-e89b-42d3-a456-426614174001";
      },
      (resource) => { resource.routeId = "custom-launch:create:v4"; },
      (resource) => {
        resource.controller = { namespace: manifest.caip2, address: WALLET };
      },
      (resource) => { resource.requestHash = SHA_1; },
      (resource) => { resource.walletTransactionPreimageHash = SHA_2; },
      (resource) => {
        resource.walletTransaction = { calldata: "0xdeadbeef", from: WALLET };
      },
      (resource) => {
        resource.partnerAttribution = { partnerId: "private-partner" };
      },
      (resource) => { resource.onchain.walletTransactionPreimageHash = SHA_2; },
    ];
    for (const mutate of privateMutations) {
      const page = pageFor(manifest);
      mutate(page.launches[0]);
      const result = await finalizedV4FeedTestOnly.read(manifest, anchor, {
        force: true,
        loadPage: async () => page,
      });
      assert.equal(result.status, "unavailable");
      assert.deepEqual(result.records, []);
    }

    const accepted = await finalizedV4FeedTestOnly.read(manifest, anchor, {
      force: true,
      loadPage: async () => pageFor(manifest),
    });
    assert.equal(accepted.status, "current", JSON.stringify(accepted.error));
    const visit = (value) => {
      if (value === null || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        assert.equal(prohibited.has(key), false, `private key leaked: ${key}`);
        visit(child);
      }
    };
    visit(accepted.records[0]);
  });

  test("requires truthful per-contract provenance and exact provider identities", async () => {
    const manifest = await liveManifest();
    const anchor = promotionAnchorFor(manifest);
    const registry = await createSchemaRegistry("v2");
    const validateDeployment = registry.validator(
      "custom-launch-chain-deployment-v4.schema.json",
    );
    assertValid(
      validateDeployment,
      chainDeploymentFor(manifest),
      "exact public V4 chain deployment",
    );

    const mutations = [
      (deployment) => {
        deployment.deploymentEvidence.from = OTHER;
      },
      (deployment) => {
        deployment.deploymentEvidence.calldataHash = HASH_F;
      },
      (deployment) => {
        deployment.deploymentEvidence.resultingContracts[0]
          .providerReadbacks[0].providerId = "drpc-robinhood";
      },
      (deployment) => {
        deployment.deploymentEvidence.resultingContracts[0]
          .providerReadbacks[0].preDeploymentRuntimeCodeHash = HASH_F;
      },
      (deployment) => {
        deployment.permit2GenesisProvenance.startBlock = "1";
      },
      (deployment) => {
        deployment.permit2GenesisProvenance.genesisSourceDigest = SHA_1;
      },
      (deployment) => {
        deployment.permitAuthoritySourceProvenance.configurationEvidence
          .primaryProvider.providerId = "drpc-robinhood";
      },
      (deployment) => {
        deployment.permitAuthoritySourceProvenance.configurationEvidence
          .secondaryProvider.trustDomain = "alchemy";
      },
      (deployment) => {
        deployment.permitAuthoritySourceProvenance.configurationEvidence
          .fallbackHandlerRuntimeCodeHash = HASH_F;
      },
      (deployment) => {
        deployment.externalRootDeploymentEvidence[0].startBlock = "0";
      },
      (deployment) => {
        deployment.externalRootDeploymentEvidence[0].contract =
          "positionManager";
      },
      (deployment) => {
        deployment.externalRootDeploymentEvidence[4].address =
          "0x0000000000000000000000000000000000000001";
      },
      (deployment) => {
        deployment.externalRootDeploymentEvidence[0].registrySource.sha256 =
          SHA_1;
      },
      (deployment) => {
        deployment.externalRootDeploymentEvidence[0].providerReadbacks[0]
          .providerId = "drpc-robinhood";
      },
    ];
    for (const mutate of mutations) {
      const page = pageFor(manifest);
      mutate(page.launches[0].chainDeployment);
      page.launches[0].onchain.chainDeployment =
        structuredClone(page.launches[0].chainDeployment);
      assert.equal(validateDeployment(page.launches[0].chainDeployment), false);
      const result = await finalizedV4FeedTestOnly.read(manifest, anchor, {
        force: true,
        loadPage: async () => page,
      });
      assert.equal(result.status, "unavailable");
      assert.deepEqual(result.records, []);
    }

    for (const mutate of [
      (deployment) => {
        deployment.deploymentEvidence.evidenceDigest = SHA_1;
      },
      (deployment) => {
        deployment.deploymentEvidence.receiptLogsDigest = SHA_1;
      },
      (deployment) => {
        deployment.deploymentEvidence.resultingContracts[0]
          .providerReadbacks[0].evidenceDigest = SHA_1;
      },
      (deployment) => {
        deployment.deploymentEvidence.resultingContracts[0]
          .stateEvidenceDigest = SHA_1;
      },
      (deployment) => {
        deployment.permitAuthoritySourceProvenance.configurationEvidence
          .atomicRootStateEvidenceDigest = SHA_1;
      },
      (deployment) => {
        deployment.permitAuthoritySourceProvenance.evidenceDigest = SHA_1;
      },
      (deployment) => {
        deployment.externalRootDeploymentEvidence[0].providerReadbacks[0]
          .evidenceDigest = SHA_1;
      },
      (deployment) => {
        deployment.externalRootDeploymentEvidence[0].evidenceDigest = SHA_1;
      },
    ]) {
      const page = pageFor(manifest);
      mutate(page.launches[0].chainDeployment);
      page.launches[0].onchain.chainDeployment =
        structuredClone(page.launches[0].chainDeployment);
      assert.equal(validateDeployment(page.launches[0].chainDeployment), true);
      const result = await finalizedV4FeedTestOnly.read(manifest, anchor, {
        force: true,
        loadPage: async () => page,
      });
      assert.equal(result.status, "unavailable");
      assert.deepEqual(result.records, []);
    }
  });

  test("uses only the same chain and deployment binding as last-known-good", async () => {
    const chain4663 = await liveManifest(4663);
    const chain4664 = await liveManifest(4664);
    const anchor4663 = promotionAnchorFor(chain4663);
    const anchor4664 = promotionAnchorFor(chain4664);
    const first4663 = await finalizedV4FeedTestOnly.read(chain4663, anchor4663, {
      force: true,
      loadPage: async () => pageFor(chain4663),
    });
    const first4664 = await finalizedV4FeedTestOnly.read(chain4664, anchor4664, {
      force: true,
      loadPage: async () => pageFor(chain4664),
    });
    assert.notEqual(
      first4663.sourceIdentityCommitment,
      first4664.sourceIdentityCommitment,
    );

    const stale4663 = await finalizedV4FeedTestOnly.read(chain4663, anchor4663, {
      force: true,
      loadPage: async () => { throw new Error("provider unavailable"); },
    });
    assert.equal(stale4663.status, "last-known-good");
    assert.equal(stale4663.records[0].chainId, 4663);
    assert.equal(stale4663.lastKnownGood, true);

    const changedBinding = structuredClone(chain4663);
    changedBinding.customLaunchV4.chainDeploymentDescriptorDigest = HASH_F;
    const unavailable = await finalizedV4FeedTestOnly.read(
      changedBinding,
      anchor4663,
      {
      force: true,
      loadPage: async () => { throw new Error("provider unavailable"); },
      },
    );
    assert.equal(unavailable.status, "unavailable");
    assert.deepEqual(unavailable.records, []);
  });

  test("rejects partial quality and nonterminal finality before publication", async () => {
    const manifest = await liveManifest();
    const anchor = promotionAnchorFor(manifest);
    const partial = pageFor(manifest);
    partial.quality.status = "partial";
    const partialResult = await finalizedV4FeedTestOnly.read(manifest, anchor, {
      force: true,
      loadPage: async () => partial,
    });
    assert.equal(partialResult.status, "unavailable");

    const nonterminal = pageFor(manifest);
    nonterminal.launches[0].onchain.terminal = false;
    const finalityResult = await finalizedV4FeedTestOnly.read(manifest, anchor, {
      force: true,
      loadPage: async () => nonterminal,
    });
    assert.equal(finalityResult.status, "unavailable");
  });

  test("never promotes a merely well-shaped live manifest", async () => {
    const manifest = await liveManifest();
    let sourceCalls = 0;
    const productionResult = await readFinalizedCustomLaunchesV4(manifest, {
      force: true,
      loadPage: async () => {
        sourceCalls += 1;
        return pageFor(manifest);
      },
    });
    assert.equal(activeFinalizedV4Binding(manifest), null);
    assert.equal(productionResult.status, "unavailable");
    assert.equal(sourceCalls, 0);

    const exact = promotionAnchorFor(manifest);
    for (const mutate of [
      (anchor) => { anchor.chainId = 1; },
      (anchor) => { anchor.caip2 = "eip155:1"; },
      (anchor) => { anchor.chainDeploymentId = "synthetic-other-deployment"; },
      (anchor) => { anchor.chainDeploymentDescriptorDigest = null; },
      (anchor) => { anchor.chainDeploymentDescriptorDigest = HASH_F; },
      (anchor) => {
        anchor.profile.businessProfileId = "synthetic-other-profile";
      },
      (anchor) => {
        anchor.profile.structuralProfileId = "synthetic-other-structure";
      },
      (anchor) => { anchor.profile.admissionBindingDigest = SHA_6; },
      (anchor) => { anchor.profile.profileDigest = null; },
      (anchor) => { anchor.finalityPolicy.policyId = "synthetic-other-finality"; },
      (anchor) => { anchor.finalityPolicy.policyDigest = SHA_6; },
      (anchor) => { anchor.foundationSourceCommitment = HASH_F; },
      (anchor) => { anchor.chainDeployment = null; },
      (anchor) => {
        anchor.chainDeployment.contracts.programmableLaunchStampRouter.address =
          OTHER;
      },
      (anchor) => {
        anchor.chainDeployment.contracts.permitAuthority.runtimeCodeHash =
          HASH_F;
      },
      (anchor) => { anchor.router.address = OTHER; },
      (anchor) => { anchor.router.startBlock = null; },
      (anchor) => { anchor.router.runtimeCodeHash = HASH_F; },
      (anchor) => { anchor.router.abiSha256 = SHA_6; },
      (anchor) => { anchor.router.artifact.sourceCommit = "f".repeat(40); },
      (anchor) => {
        anchor.router.deploymentEvidence.deploymentTransactionHash = HASH_F;
      },
      (anchor) => {
        anchor.router.deploymentEvidence.finalizedBlockHash = HASH_F;
      },
      (anchor) => { anchor.router.canaryEvidence.blockHash = HASH_F; },
      (anchor) => { anchor.bindings.permitAuthority = OTHER; },
      (anchor) => { anchor.bindings.graphFactory = OTHER; },
      (anchor) => { anchor.bindings.graphFactoryRuntimeCodeHash = HASH_F; },
      (anchor) => { anchor.bindings.poolManager = OTHER; },
      (anchor) => { anchor.bindings.poolManagerRuntimeCodeHash = HASH_F; },
    ]) {
      const incorrect = structuredClone(exact);
      mutate(incorrect);
      assert.equal(
        finalizedV4FeedTestOnly.bindingAgainstPromotionAnchor(
          manifest,
          incorrect,
        ),
        null,
      );
    }
  });
});
