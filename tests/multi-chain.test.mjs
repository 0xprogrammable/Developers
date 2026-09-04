import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createChainManifestHandler } from "../api/v2/manifests/[chainId].js";
import { createLaunchesHandler } from "../api/v2/launches.js";
import { createTokenListHandler } from "../api/v2/token-list.js";
import {
  developerManifestForChain,
  developerManifestIndex,
} from "../server/chain-manifests.js";
import {
  getV2DatasetForChain,
  mergeRouterCustomRecords,
  serviceStatusV2,
} from "../server/v2-dataset.js";
import { canonicalSha256 } from "../server/canonical.js";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";
import { validateManifestSemantics } from "../scripts/lib/semantics.mjs";

function mockResponse() {
  return {
    headers: new Map(),
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

async function call(handler, query, url) {
  const response = mockResponse();
  await handler({ method: "GET", query, headers: {}, url }, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    body: response.body ? JSON.parse(response.body) : null,
  };
}

function record(chainId, launchId, address) {
  return {
    chainId,
    launchId,
    token: { address },
    sortKey: `0000000000000001:0000000000:0000000000:${address}`,
  };
}

function finalizeRobinhoodChainBinding(live, hash, sha) {
  const binding = live.robinhoodCustomLaunchBinding;
  binding.state = "finalized-live";
  for (const [contract, startBlock] of [
    ["programmableLaunchStampRouter", "50000000"],
    ["permitAuthority", "50000000"],
    ["graphFactory", "50000000"],
  ]) {
    binding.chainBindings[contract].provenance = "deployment-block";
    binding.chainBindings[contract].startBlock = startBlock;
  }
  binding.profileBinding.serverBusinessProfile.profileDigest =
    live.customLaunchV4.profile.profileDigest;
  binding.profileBinding.admission.descriptorSha256 =
    live.customLaunchV4.profile.admissionDescriptorDigest;
  binding.profileBinding.admission.businessPolicySha256 =
    live.customLaunchV4.profile.admissionPolicyDigest;
  binding.profileBinding.admission.bindingSha256 =
    live.customLaunchV4.profile.admissionBindingDigest;
  binding.deployment = {
    transactionHash: live.launchStampRouter.deploymentEvidence
      .deploymentTransactionHash,
    blockNumber: live.launchStampRouter.deploymentEvidence
      .deploymentBlockNumber,
    blockHash: live.launchStampRouter.deploymentEvidence.deploymentBlockHash,
    startBlock: live.launchStampRouter.startBlock,
    finalizedBlockNumber: live.launchStampRouter.deploymentEvidence
      .finalizedBlockNumber,
    finalizedBlockHash: live.launchStampRouter.deploymentEvidence
      .finalizedBlockHash,
    finalityEvidence: null,
  };
  const contractBindings = Object.fromEntries(
    Object.entries(binding.chainBindings).map(([contract, value]) => [
      contract,
      { address: value.address, runtimeCodeHash: value.runtimeCodeHash },
    ]),
  );
  const ethereumFinalityWithoutDigest = {
    schemaVersion:
      "programmable.robinhood-l2-checkpoint-ethereum-finality.v1",
    profile: structuredClone(live.customLaunchV4.profile),
    l2Checkpoint: {
      blockNumber: binding.deployment.blockNumber,
      blockHash: binding.deployment.blockHash,
    },
    batchNumber: "123",
    l2Providers: [
      { providerId: "quicknode", trustDomain: "quicknode.com", l1Confirmations: "12" },
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
    postingTransactionHash: hash("b"),
    postingBlockNumber: "19000000",
    postingBlockHash: hash("c"),
    postingLogIndex: "7",
    ethereumFinalizedCheckpoint: {
      blockNumber: "19000012",
      blockHash: hash("d"),
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
    blockNumber: binding.deployment.blockNumber,
    blockHash: binding.deployment.blockHash,
    proxyRuntimeCodeHash: contractBindings.permitAuthority.runtimeCodeHash,
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
    primaryProvider: safeProvider("quicknode", "quicknode.com"),
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
  const externalEvidence = ({ contract, transactionHash, startBlock }) => {
    const previousBlockNumber = (BigInt(startBlock) - 1n).toString(10);
    const previousBlockHash = hash("b");
    const previousBlockRuntimeCodeHash =
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
    const providerReadback = (providerId, trustDomain) => {
      const withoutDigest = {
        providerId,
        trustDomain,
        transactionHash,
        rawTransactionDigest: sha("b"),
        transactionDigest: sha("c"),
        previousBlockNumber,
        previousBlockHash,
        previousBlockRuntimeCodeHash,
        blockNumber: startBlock,
        blockHash: hash("a"),
        runtimeCodeHash: contractBindings[contract].runtimeCodeHash,
        transactionReceiptDigest: sha("a"),
      };
      return {
        ...withoutDigest,
        evidenceDigest: canonicalSha256(
          "programmable.custom-launch-deployment-provider-readback.v2",
          withoutDigest,
        ),
      };
    };
    const withoutDigest = {
      schemaVersion: "programmable.custom-launch-deployment-evidence.v1",
      contract,
      kind: "exact-observed-deployment",
      address: contractBindings[contract].address,
      runtimeCodeHash: contractBindings[contract].runtimeCodeHash,
      transactionHash,
      previousBlockNumber,
      previousBlockHash,
      previousBlockRuntimeCodeHash,
      startBlock,
      blockHash: hash("a"),
      registrySource: structuredClone(registrySource),
      providerReadbacks: [
        providerReadback("quicknode", "quicknode.com"),
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
      transactionHash: binding.deployment.transactionHash,
      transactionResponseDigest: sha("a"),
      transactionReceiptDigest: sha("b"),
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
      preDeploymentBlockNumber:
        (BigInt(binding.deployment.blockNumber) - 1n).toString(10),
      preDeploymentBlockHash: hash("b"),
      preDeploymentRuntimeCodeHash:
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
      deploymentBlockNumber: binding.deployment.blockNumber,
      deploymentBlockHash: binding.deployment.blockHash,
      deploymentRuntimeCodeHash: runtimeCodeHash,
    };
    return {
      ...withoutDigest,
      evidenceDigest: canonicalSha256(withoutDigest.schemaVersion, withoutDigest),
    };
  };
  const atomicResult = (contract, contractBinding) => {
    const withoutDigest = {
      contract,
      ...contractBinding,
      previousBlockRuntimeCodeHash:
        "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
      providerReadbacks: [
        atomicTransitionReadback(
          "quicknode", "quicknode.com", contract, contractBinding.address,
          contractBinding.runtimeCodeHash,
        ),
        atomicTransitionReadback(
          "alchemy", "alchemy.com", contract, contractBinding.address,
          contractBinding.runtimeCodeHash,
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
    transactionHash: binding.deployment.transactionHash,
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
    blockNumber: binding.deployment.blockNumber,
    blockHash: binding.deployment.blockHash,
    receiptLogs: atomicReceiptLogs,
    receiptLogsDigest: canonicalSha256(
      "programmable.robinhood-atomic-root-deployment-receipt-logs.v1",
      atomicReceiptLogs,
    ),
    providerReadbacks: [
      atomicReadback("quicknode", "quicknode.com"),
      atomicReadback("alchemy", "alchemy.com"),
    ],
    resultingContracts: [
      atomicResult("permitAuthority", contractBindings.permitAuthority),
      atomicResult("graphFactory", contractBindings.graphFactory),
      atomicResult(
        "programmableLaunchStampRouter",
        contractBindings.programmableLaunchStampRouter,
      ),
    ],
    ethereumFinalityEvidence: structuredClone(ethereumFinalityEvidence),
    sourceVerification: {
      sourcifyProviderMatchCoveredContracts: [
        "programmableLaunchStampRouter",
        "graphFactory",
      ],
      exactByteSourceBuildTransactionCoveredContracts: [
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
      safeConfigurationWithoutDigest.schemaVersion,
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
      blockHash: hash("e"),
      runtimeCodeHash: contractBindings.permit2.runtimeCodeHash,
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
    address: contractBindings.permit2.address,
    startBlock: "0",
    genesisSourceUrl:
      "https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-genesis.json",
    genesisSourceDigest:
      "sha256:353e6f6441b47695b41cee0c3645cde8dd7492d2f7f574bfb6aa4371e41bb6ba",
    allocRuntimeCodeBytes: 9152,
    providerReadbacks: [
      genesisReadback("quicknode", "quicknode.com"),
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
    address: contractBindings.permitAuthority.address,
    transactionHash: binding.deployment.transactionHash,
    blockNumber: binding.chainBindings.permitAuthority.startBlock,
    blockHash: binding.deployment.blockHash,
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
  binding.chainDeployment = {
    schemaVersion: "programmable.custom-launch-chain-deployment.v1",
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    chainId: "4663",
    caip2: "eip155:4663",
    finality: structuredClone(live.customLaunchV4.finalityPolicy),
    foundationSourceCommitment: binding.foundationSourceCommitment,
    deploymentEvidence: atomicDeploymentEvidence,
    permit2GenesisProvenance,
    permitAuthoritySourceProvenance,
    externalRootDeploymentEvidence: externalRoots.map(externalEvidence),
    contracts: contractBindings,
  };
  binding.publication = {
    schemaVersion:
      "programmable.finalized-custom-launch-publication-binding.v1",
    finalizedFeedUrl:
      "https://api.programmable.market/v4/chains/4663/finalized-custom-launches",
    chainDeploymentDescriptorDigest:
      live.customLaunchV4.chainDeploymentDescriptorDigest,
    routerEventEvidenceDigest: canonicalSha256(
      "programmable.router-event-evidence.v1",
      live.launchStampRouter.events,
    ),
    routerGetterEvidenceDigest: canonicalSha256(
      "programmable.router-getter-evidence.v1",
      live.launchStampRouter.getters,
    ),
    evidenceDigest: null,
  };
  binding.deployment.finalityEvidence = canonicalSha256(
    "programmable.robinhood-custom-launch-deployment-finality.v1",
    {
      chainDeploymentDescriptorDigest:
        binding.publication.chainDeploymentDescriptorDigest,
      transactionHash: binding.deployment.transactionHash,
      blockNumber: binding.deployment.blockNumber,
      blockHash: binding.deployment.blockHash,
      finalizedBlockNumber: binding.deployment.finalizedBlockNumber,
      finalizedBlockHash: binding.deployment.finalizedBlockHash,
      finalityPolicy: binding.chainDeployment.finality,
      canaryEvidence: live.launchStampRouter.canaryEvidence,
    },
  );
  const { evidenceDigest: _ignored, ...publicationWithoutDigest } =
    binding.publication;
  binding.publication.evidenceDigest = canonicalSha256(
    binding.publication.schemaVersion,
    publicationWithoutDigest,
  );
}

function syntheticLiveRobinhood(manifest) {
  const live = structuredClone(manifest);
  // The full hosted release fixture is independent from the direct-chain release.
  delete live.directChainIntegration;
  const hash = (character) => `0x${character.repeat(64)}`;
  const sha = (character) => `sha256:${character.repeat(64)}`;
  live.customLaunchV4.status = "live";
  live.customLaunchV4.chainDeploymentDescriptorDigest = hash("1");
  live.customLaunchV4.profile = {
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
    profileDigest:
      "sha256:484b1dc6e9091804fabc230f2b3a7504940fa00264f8e66e82a66a951e71f1a0",
  };
  live.customLaunchV4.finalityPolicy = {
    schemaVersion: "programmable.custom-launch-finality-policy-ref.v1",
    policyId: "robinhood-stage-finality-v1",
    policyRevision: 1,
    policyDigest:
      "sha256:537d531423d1285a3808556a57303ec68f1e6bdeea3c9aaf6320f9e5a0e47153",
  };
  const router = live.launchStampRouter;
  Object.assign(router, {
    status: "live",
    address: "0x34965F2A2ee9254522232C32F02056E92BE0C98a",
    startBlock: "50000000",
    runtimeCodeHash:
      "0x1dbbdaaad901ea3c6134dca0d4872a4789b3c071bf8ccfb44edd65d26d817388",
    artifact: {
      sourceRepository: "https://github.com/programmablehq/PROGRAMMABLE",
      sourceCommit: "53926119030772040eca34b4796a36353c9da2d2",
      sourceTree: "d9118605665cf047ec32214c7dc51608e9a362f0",
      sourcePath:
        "contracts/src/robinhood-custom-launch/ProgrammableLaunchStampRouterV1.sol",
      artifactPath:
        "contracts/out/ProgrammableLaunchStampRouterV1.sol/ProgrammableLaunchStampRouterV1.json",
    },
    deploymentEvidence: {
      verificationStatus: "finalized-verified",
      address: "0x34965F2A2ee9254522232C32F02056E92BE0C98a",
      deploymentTransactionHash: hash("2"),
      deploymentBlockNumber: "50000000",
      deploymentBlockHash: hash("3"),
      finalizedBlockNumber: "50000012",
      finalizedBlockHash: hash("4"),
      finalityDepth: 0,
      runtimeCodeBytes: 1,
      runtimeCodeKeccak256:
        "0x1dbbdaaad901ea3c6134dca0d4872a4789b3c071bf8ccfb44edd65d26d817388",
      runtimeCodeSha256: sha("2"),
      observedBindings: {
        chainId: 4663,
        permitAuthority: "0xeD617CE7f82e2AB589aDeFFD319D1D872Bc8De06",
        permitAuthorityRuntimeCodeHash:
          "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
        graphFactory: "0x0B6b3F40f84Df25D3bd69238f937096177DD09Bd",
        graphFactoryRuntimeCodeHash:
          "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
        poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
        poolManagerRuntimeCodeHash:
          "0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626",
      },
      getterBundleSha256: sha("3"),
      evidenceSha256: sha("4"),
    },
    canaryEvidence: {
      finality: "finalized",
      transactionHash: hash("5"),
      blockNumber: "50000020",
      blockHash: hash("6"),
      launchId: hash("7"),
    },
    classicCanaryEvidence: null,
    finalityConfirmations: 1,
    bindings: {
      permitAuthority: "0xeD617CE7f82e2AB589aDeFFD319D1D872Bc8De06",
      permitAuthorityRuntimeCodeHash:
        "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
      graphFactory: "0x0B6b3F40f84Df25D3bd69238f937096177DD09Bd",
      graphFactoryRuntimeCodeHash:
        "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
      poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
      poolManagerRuntimeCodeHash:
        "0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626",
    },
  });
  finalizeRobinhoodChainBinding(live, hash, sha);
  return live;
}

describe("chain-bound Developer read model", () => {
  test("publishes exact per-chain manifests while retaining the Ethereum alias", async () => {
    const [ethereum, robinhood, index] = await Promise.all([
      developerManifestForChain(),
      developerManifestForChain(4663),
      developerManifestIndex(),
    ]);

    assert.equal(ethereum.chainId, 1);
    assert.equal(ethereum.caip2, "eip155:1");
    assert.deepEqual(ethereum.supportedChainIds, [1, 4663]);
    assert.equal(robinhood.chainId, 4663);
    assert.equal(robinhood.caip2, "eip155:4663");
    assert.equal(robinhood.customLaunchV4.status, "planned");
    assert.equal(
      robinhood.customLaunchV4.chainDeploymentDescriptorDigest,
      null,
    );
    assert.equal(
      robinhood.customLaunchV4.foundationSourceCommitment,
      "0xe87f5edc2dc839bd87a26a80cb53f14b021e603a1753d27aae3a02862058d730",
    );
    assert.deepEqual(robinhood.customLaunchV4.releaseIdentity.policySource, {
      schemaVersion: "programmable.custom-launch-policy-source.v1",
      repository: "programmablehq/Launch-Policy",
      repositoryId: 1320171831,
      protectedBranch: "main",
      verifiedMergeCommit: "987215867472229690e30e11000c626d58f46e16",
      verifiedTree: "284fb19f05cdf9b5b60b8bacfbd480f6b98decd3",
      artifacts: {
        descriptor: {
          path: "policy/custom-launch-admission-v4.json",
          digest:
            "sha256:99b4ccabdaaf143bad28a8f6af441a1b93e1f113d0179236328b7fa594d1f948",
        },
        businessPolicy: {
          path: "policy/launch-policy.v1.json",
          digest:
            "sha256:31e6b286ca839b31cb1edfe30c05d9f334892f3d84377961dc10b93959c7e216",
        },
        generatedBinding: {
          path: ".programmable/custom-launch-admission.v4.json",
          digest:
            "sha256:f31643e6e9ff6d5409d59a2fc3ac7fb5ac9cfcb3af08e95c9478bc95ddfa66a2",
        },
        schema: {
          path: "policy/schemas/custom-launch-admission-v4.schema.json",
          digest:
            "sha256:a28a6de6208d6ba7b65b4b706174509570955ba9ce9714624bcb2046ab7beae7",
        },
      },
    });
    assert.equal(robinhood.customLaunchV4.profile, null);
    assert.equal(robinhood.customLaunchV4.finalityPolicy, null);
    assert.equal(robinhood.launchStampRouter.status, "live");
    assert.equal(robinhood.launchStampRouter.supportsFutureClassic, false);
    assert.equal(robinhood.launchStampRouter.address,
      "0x34965F2A2ee9254522232C32F02056E92BE0C98a");
    assert.equal(robinhood.launchStampRouter.startBlock, "50469365");
    assert.equal(robinhood.launchStampRouter.runtimeCodeHash,
      "0x1dbbdaaad901ea3c6134dca0d4872a4789b3c071bf8ccfb44edd65d26d817388");
    assert.equal(robinhood.launchStampRouter.deploymentEvidence.verificationStatus,
      "finalized-verified");
    assert.equal(robinhood.directChainIntegration.status, "live");
    assert.equal(robinhood.directChainIntegration.publicWrites, false);
    assert.deepEqual(robinhood.deployments, []);
    assert.deepEqual(index.map(({ chainId, status }) => ({ chainId, status })), [
      { chainId: 1, status: "live" },
      { chainId: 4663, status: "live" },
    ]);

    const registry = await createSchemaRegistry("v2");
    const validateManifest = registry.validator("manifest.schema.json");
    assertValid(validateManifest, ethereum, "Ethereum per-chain manifest");
    assertValid(validateManifest, robinhood, "Robinhood per-chain manifest");
  });

  test("serves live direct-chain discovery while the hosted read model stays unavailable", async () => {
    const manifestHandler = createChainManifestHandler();
    const manifestResponse = await call(
      manifestHandler,
      { chainId: "4663" },
      "/api/v2/manifests/4663",
    );
    assert.equal(manifestResponse.status, 200);
    assert.equal(manifestResponse.body.chainId, 4663);
    assert.equal(
      manifestResponse.headers.get("x-programmable-status"),
      "ready",
    );

    const dataset = await getV2DatasetForChain(4663);
    assert.deepEqual(dataset.records, []);
    assert.equal(dataset.status.status, "unavailable");
    assert.equal(dataset.status.chainId, 4663);
    assert.equal(dataset.status.customRegistryPublication.status, "planned");
    assert.equal(dataset.status.errors[0].code, "CHAIN_READ_MODEL_PLANNED");

    const manifest = await developerManifestForChain(4663);
    const status = serviceStatusV2(dataset.status, manifest);
    assert.equal(status.chainId, 4663);
    assert.equal(status.caip2, "eip155:4663");
    assert.equal(status.custom.status, "live");
    assert.equal(status.directChainIntegration.indexing, "direct-chain");
    assert.equal(status.service, "degraded");
    assert.equal(status.feeds.launches, "unavailable");

    const registry = await createSchemaRegistry("v2");
    assertValid(
      registry.validator("status.schema.json"),
      status,
      "Robinhood direct-chain status",
    );
  });

  test("chain-discriminates exact Ethereum and Robinhood Router activation tuples", async () => {
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator("manifest.schema.json");
    const ethereum = await developerManifestForChain(1);
    const plannedRobinhood = await developerManifestForChain(4663);
    const liveRobinhood = syntheticLiveRobinhood(plannedRobinhood);
    assertValid(validate, ethereum, "exact Ethereum Router tuple");
    assertValid(validate, liveRobinhood, "exact Robinhood Router tuple");
    const liveFindings = validateManifestSemantics(liveRobinhood);
    assert.equal(
      liveFindings.some((finding) =>
        finding.code === "ROBINHOOD_CUSTOM_LAUNCH_FINALIZED_BINDING"),
      false,
      JSON.stringify(liveFindings),
    );

    const syntacticLive = structuredClone(liveRobinhood);
    syntacticLive.robinhoodCustomLaunchBinding = structuredClone(
      plannedRobinhood.robinhoodCustomLaunchBinding,
    );
    syntacticLive.robinhoodCustomLaunchBinding.state = "prepared-not-broadcast";
    assert.equal(validate(syntacticLive), false);

    const semanticSubstitution = structuredClone(liveRobinhood);
    semanticSubstitution.robinhoodCustomLaunchBinding.chainBindings
      .programmableLaunchStampRouter.startBlock = "50000002";
    assertValid(
      validate,
      semanticSubstitution,
      "structurally valid Robinhood evidence substitution",
    );
    assert.equal(
      validateManifestSemantics(semanticSubstitution).some((finding) =>
        finding.code === "ROBINHOOD_CUSTOM_LAUNCH_FINALIZED_BINDING"),
      true,
    );

    const externalReadbackSubstitution = structuredClone(liveRobinhood);
    const externalEvidence = externalReadbackSubstitution
      .robinhoodCustomLaunchBinding.chainDeployment
      .externalRootDeploymentEvidence[0];
    externalEvidence.providerReadbacks[1].rawTransactionDigest =
      `sha256:${"d".repeat(64)}`;
    for (const readback of externalEvidence.providerReadbacks) {
      const { evidenceDigest: _digest, ...withoutDigest } = readback;
      readback.evidenceDigest = canonicalSha256(
        "programmable.custom-launch-deployment-provider-readback.v2",
        withoutDigest,
      );
    }
    {
      const { evidenceDigest: _digest, ...withoutDigest } = externalEvidence;
      externalEvidence.evidenceDigest = canonicalSha256(
        externalEvidence.schemaVersion,
        withoutDigest,
      );
    }
    assertValid(
      validate,
      externalReadbackSubstitution,
      "structurally valid external-root provider disagreement",
    );
    assert.equal(
      validateManifestSemantics(externalReadbackSubstitution).some((finding) =>
        finding.code === "ROBINHOOD_CUSTOM_LAUNCH_FINALIZED_BINDING"),
      true,
    );

    const ethereumOnRobinhood = structuredClone(plannedRobinhood);
    ethereumOnRobinhood.launchStampRouter = structuredClone(
      ethereum.launchStampRouter,
    );
    assert.equal(validate(ethereumOnRobinhood), false);

    const robinhoodOnEthereum = structuredClone(ethereum);
    robinhoodOnEthereum.launchStampRouter = structuredClone(
      liveRobinhood.launchStampRouter,
    );
    assert.equal(validate(robinhoodOnEthereum), false);

    for (const mutate of [
      (router) => { router.address = "0x1111111111111111111111111111111111111111"; },
      (router) => { router.artifact.sourceTree = "f".repeat(40); },
      (router) => { router.bindings.poolManager = "0x1111111111111111111111111111111111111111"; },
      (router) => { router.deploymentEvidence.observedBindings.chainId = 1; },
      (router) => { router.classicCanaryEvidence = {}; },
    ]) {
      const substituted = structuredClone(liveRobinhood);
      mutate(substituted.launchStampRouter);
      assert.equal(validate(substituted), false);
    }
  });

  test("isolates chain filters and unsupported-chain failures", async () => {
    const launches = await call(
      createLaunchesHandler(),
      { chainId: "4663" },
      "/api/v2/launches?chainId=4663",
    );
    assert.equal(launches.status, 200);
    assert.equal(launches.body.status, "unavailable");
    assert.deepEqual(launches.body.items, []);

    const tokens = await call(
      createTokenListHandler(),
      { chainId: "4663" },
      "/api/v2/token-list?chainId=4663",
    );
    assert.equal(tokens.status, 200);
    assert.equal(tokens.body.status, "unavailable");
    assert.deepEqual(tokens.body.tokens, []);

    const unsupportedManifest = await call(
      createChainManifestHandler(),
      { chainId: "8453" },
      "/api/v2/manifests/8453",
    );
    assert.equal(unsupportedManifest.status, 404);
    assert.equal(unsupportedManifest.body.code, "chain-not-supported");

    const unsupportedFeed = await call(
      createLaunchesHandler(),
      { chainId: "8453" },
      "/api/v2/launches?chainId=8453",
    );
    assert.equal(unsupportedFeed.status, 400);
    assert.equal(unsupportedFeed.body.code, "chain-not-supported");
  });

  test("keys token identity by chain and address", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const base = {
      records: [record(1, "ethereum-launch", address)],
      status: {},
    };
    const merged = mergeRouterCustomRecords(base, {
      records: [record(4663, "ethereum-launch", address)],
      status: "current",
      generatedAt: "2026-08-29T00:00:00.000Z",
      asOfBlock: "1",
      asOfBlockHash: `0x${"1".repeat(64)}`,
      sourceIdentityCommitment: `sha256:${"1".repeat(64)}`,
      snapshotSha256: `sha256:${"2".repeat(64)}`,
      verifiedIdentityCount: 1,
    });
    assert.equal(merged.records.length, 2);

    assert.throws(
      () => mergeRouterCustomRecords(base, {
        records: [record(1, "same-chain-launch", address)],
      }),
      /identity conflicts/u,
    );
  });
});
