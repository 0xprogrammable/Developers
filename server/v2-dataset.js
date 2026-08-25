import { readFile } from "node:fs/promises";

import { API_V2_SCHEMA_VERSION } from "./constants.js";
import { gen2ContractSetMatchesEvidence } from "./custom-registry-gen2.js";
import { feedStatus, getDataset } from "./dataset.js";
import {
  CUSTOM_REGISTRY_GENESIS_CANARY,
  CUSTOM_REGISTRY_GENESIS_CANARY_SORT_KEY,
  isExactCustomRegistryGenesisCanary,
} from "./genesis-canary.js";
import {
  REGISTRY_V4_PRODUCER_SCHEMA,
  validateRegistryProjectionEnvelopeV4,
} from "./registry-v4.js";

let manifestPromise = null;

const GEN1_OPERATION_AUTHORITIES = Object.freeze({
  registered: Object.freeze({
    role: "writer",
    roleHash:
      "0x38a7c92332f0fbaba4dce6b9f3eea9c1ebabcd169e98906ab9a73f4ed8a6e4f8",
  }),
  finalized: Object.freeze({
    role: "finalizer",
    roleHash:
      "0xe55e8ef6452e74c26a3f53152c87f1ccda401f3155e8946d061b3dd85334736b",
  }),
});

function canonicalRegistryDeployments(manifest) {
  if (!Array.isArray(manifest?.registryGenerations)) return [];
  return manifest.registryGenerations.filter(
    (registry) =>
      (registry.status === "live" || registry.status === "retired") &&
      Number.isSafeInteger(registry.chainId) &&
      registry.caip2 === `eip155:${registry.chainId}` &&
      typeof registry.address === "string" &&
      typeof registry.startBlock === "string" &&
      typeof registry.generation === "string" &&
      typeof registry.registryEventSetHash === "string",
  );
}

function generationWriterEvidenceMatches(record, registry, evidence) {
  if (registry.generation !== "2") {
    const expected = GEN1_OPERATION_AUTHORITIES[evidence?.operation];
    const authority = registry.operationAuthorities?.[evidence?.operation];
    if (!expected || authority?.role !== expected.role ||
      authority.roleHash !== expected.roleHash ||
      !Array.isArray(authority.addresses) ||
      !authority.addresses.some((address) =>
        address.toLowerCase() === evidence?.registryWriter?.toLowerCase())) {
      return false;
    }
    return evidence.operation !== "registered" ||
      (Array.isArray(registry.authorizedWriters) &&
        registry.authorizedWriters.some((writer) =>
          writer.toLowerCase() === evidence.registryWriter.toLowerCase()));
  }
  const writerSet = evidence?.authorizedWriterSetEvidence;
  if (!writerSet || writerSet.eventCaller !== null ||
    writerSet.callerIdentityStatus !== "not-emitted-by-registry-abi" ||
    !Array.isArray(writerSet.authorizedAddresses) ||
    writerSet.authorizedAddresses.length === 0) return false;
  if (evidence.operation === "registered") {
    if (writerSet.operationRole === "atomicRegistrar") {
      const atomic = registry.contractSet?.atomicRegistrar?.address;
      return writerSet.authorizationBasis ===
          "atomic-registrar-runtime-and-same-transaction-event" &&
        typeof atomic === "string" && writerSet.authorizedAddresses.length === 1 &&
        writerSet.authorizedAddresses[0].toLowerCase() === atomic.toLowerCase();
    }
    const factory = record.registryV4Envelope?.rawRecord
      ?.partnerFactoryAuthorization?.factory;
    return writerSet.operationRole === "providerFactory" &&
      writerSet.authorizationBasis === "partner-factory-state-and-registry-runtime" &&
      typeof factory === "string" && writerSet.authorizedAddresses.length === 1 &&
      writerSet.authorizedAddresses[0].toLowerCase() === factory.toLowerCase();
  }
  const expectedRole = {
    finalized: "finalizer",
    corrected: "corrector",
    revoked: "revoker",
  }[evidence.operation];
  return writerSet.operationRole === expectedRole &&
    writerSet.authorizationBasis === "registry-role-guard-and-manifest-allowlist" &&
    Array.isArray(registry.authorizedWriters) &&
    writerSet.authorizedAddresses.every((address) =>
      registry.authorizedWriters.some((writer) =>
        writer.toLowerCase() === address.toLowerCase()));
}

export function registryOriginMatchesManifest(record, manifest) {
  const origin = record?.registryOrigin;
  const evidence = record?.extensions?.["programmable/registry-v4"] ??
    record?.extensions?.["programmable/registry-v3"];
  if (!origin) return false;
  return canonicalRegistryDeployments(manifest).some(
    (registry) => {
      const event = registry.events?.[evidence?.operation];
      const generation2Matches = registry.generation !== "2" ||
        (event?.emitterRole === "registry" &&
          gen2ContractSetMatchesEvidence(registry, evidence));
      return String(registry.chainId) === origin.chainId &&
      registry.caip2 === origin.caip2 &&
      registry.address.toLowerCase() === origin.registryAddress.toLowerCase() &&
      registry.startBlock === origin.registryStartBlock &&
      registry.generation === origin.registryGeneration &&
      registry.registryEventSetHash === origin.registryEventSetHash &&
      evidence?.registryRuntimeCodeHash === registry.runtimeCodeKeccak256 &&
      generationWriterEvidenceMatches(record, registry, evidence) &&
      event?.topic0 === evidence?.eventTopic0 &&
      BigInt(origin.registrationBlockNumber) >= BigInt(registry.startBlock) &&
      (registry.endBlock === null ||
        BigInt(origin.registrationBlockNumber) <= BigInt(registry.endBlock)) &&
      generation2Matches;
    },
  );
}

function isRegisteredCustom(record, manifest) {
  if (isExactCustomRegistryGenesisCanary(record)) {
    return canonicalRegistryDeployments(manifest).some((registry) =>
      registry.generation === record.verification.registryGeneration &&
      registry.address.toLowerCase() ===
        record.verification.registryAddress.toLowerCase());
  }
  const registryGeneration = record?.registryOrigin?.registryGeneration;
  const v3Binding = record?.registryRecordSchemaVersion ===
      "programmable.custom-launch-registry-record.v3" &&
    registryGeneration === "1";
  const v4Envelope = record?.registryV4Envelope;
  const v4Binding = record?.registryRecordSchemaVersion ===
      REGISTRY_V4_PRODUCER_SCHEMA &&
    registryGeneration === "2" &&
    validateRegistryProjectionEnvelopeV4(v4Envelope) &&
    v4Envelope.rawRecord.envelopeDigest === record.producerEnvelopeDigest &&
    v4Envelope.projectionDigest === record.projectionDigest &&
    v4Envelope.rawRecord.registeredRecordCommitment ===
      record.registeredRecordCommitment &&
    v4Envelope.rawRecord.registrationBindingHash ===
      record.registrationBindingHash;
  return Boolean(
    (v3Binding || v4Binding) &&
      /^0x[0-9a-f]{64}$/.test(record.registeredRecordHash ?? "") &&
      /^sha256:[0-9a-f]{64}$/.test(record.projectionDigest ?? "") &&
      record.platformId === "programmable" &&
      record.publicLabel === "Programmable Custom" &&
    record?.category === "custom" &&
      record.launch?.publicSubmission === true &&
      record.launch?.transactionHash &&
      record.launch?.blockNumber !== null &&
      record.launch?.logIndex !== null &&
      record.verification?.registryAddress &&
      ["verified", "revoked"].includes(record.verification?.provenanceStatus) &&
      record.approvalBinding &&
      record.deploymentBinding?.runtimeMatch === "exact" &&
      record.verifiedReview &&
      record.feePolicy &&
      record.finalityEvidence &&
      record.lifecycle &&
      registryOriginMatchesManifest(record, manifest),
  );
}

export function isV2PublicLaunch(record, manifest = null) {
  if (record?.category === "classic") {
    return record.launch?.modelId === "classic";
  }
  return isRegisteredCustom(record, manifest);
}

function classification(record) {
  const isClassic = record.category === "classic";
  return {
    namespace: "programmable",
    category: record.category,
    label: isClassic ? "Programmable Classic" : "Programmable Custom",
    basis: isClassic
      ? "recognized-classic-launcher-event"
      : "programmable-custom-registry-event",
  };
}

export function projectV2Record(record) {
  const isClassic = record.category === "classic";
  return {
    ...record,
    schemaVersion: API_V2_SCHEMA_VERSION,
    platformId: "programmable",
    publicLabel: isClassic ? "Programmable Classic" : "Programmable Custom",
    caip2: record.caip2 ?? `eip155:${record.chainId}`,
    projectId: record.projectId ?? null,
    model: record.model ?? {
      id: record.launch.modelId,
      version: record.launch.modelVersion,
    },
    extensions: {
      ...record.extensions,
      "programmable/classification": classification(record),
    },
  };
}

export function publicLaunchV2(record) {
  const {
    sortKey: _sortKey,
    registryV4Envelope: _registryV4Envelope,
    ...publicRecord
  } = record;
  return publicRecord;
}

export function customRegistryGenesisCanaryRecord() {
  return {
    ...CUSTOM_REGISTRY_GENESIS_CANARY,
    sortKey: CUSTOM_REGISTRY_GENESIS_CANARY_SORT_KEY,
  };
}

function activeRegistryGeneration(manifest) {
  const generations = canonicalRegistryDeployments(manifest)
    .filter((registry) =>
      registry.status === "live" && /^[1-9][0-9]*$/.test(registry.generation))
    .map((registry) => BigInt(registry.generation));
  return generations.length === 0
    ? null
    : generations.reduce((highest, generation) =>
        generation > highest ? generation : highest);
}

function registrySourceCoverage(dataset, manifest, generation) {
  const source = dataset.status?.customRegistry;
  const expectedSourceId = generation === 1n
    ? "programmable-custom-launch-registry-v3"
    : generation === 2n
      ? "programmable-custom-launch-registry-v4"
      : null;
  if (source?.configured !== true || source.status !== "ready" ||
    source.completeness !== "complete" ||
    source.freshness !== "current" ||
    typeof source.highWaterGeneration !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(source.highWaterGeneration) ||
    expectedSourceId === null || source.sourceId !== expectedSourceId ||
    source.expectedSourceId !== expectedSourceId ||
    !Number.isSafeInteger(source.launches) || source.launches < 0) {
    return { ready: false, applicants: [] };
  }
  const extensionId = generation === 1n
    ? "programmable/registry-v3"
    : "programmable/registry-v4";
  const accepted = dataset.records.filter((record) =>
    !isExactCustomRegistryGenesisCanary(record) &&
    record?.registryOrigin?.registryGeneration === String(generation) &&
    typeof record.extensions?.[extensionId]?.generation === "string" &&
    /^[1-9][0-9]*$/.test(
      record.extensions[extensionId].generation,
    ) &&
    isV2PublicLaunch(record, manifest));
  const ready = accepted.length === source.launches && accepted.every((record) =>
    BigInt(record.extensions[extensionId].generation) <=
      BigInt(source.highWaterGeneration));
  return { ready, applicants: ready ? accepted : [] };
}

export function seedCustomRegistryBaseline(dataset) {
  return {
    ...dataset,
    records: [
      customRegistryGenesisCanaryRecord(),
      ...dataset.records.filter((record) =>
        record.launchId !== CUSTOM_REGISTRY_GENESIS_CANARY.launchId),
    ],
  };
}

export function projectV2Dataset(dataset, manifest = null) {
  const customRegistryLive = manifest?.customRegistry?.status === "live";
  const publicSubmissionsEnabled =
    manifest?.customRegistry?.publicSubmissionsEnabled === true;
  const activeGeneration = activeRegistryGeneration(manifest);
  const requiresLiveSource = activeGeneration !== null && activeGeneration >= 2n;
  const baselineReady = activeGeneration === 1n && dataset.records.some((record) =>
    isExactCustomRegistryGenesisCanary(record) &&
    isRegisteredCustom(record, manifest));
  const sourceCoverage = activeGeneration === null
    ? { ready: false, applicants: [] }
    : registrySourceCoverage(dataset, manifest, activeGeneration);
  const customSourceReady = sourceCoverage.ready;
  const customPublicationReady = customRegistryLive &&
    (baselineReady || customSourceReady);
  const records = dataset.records
    .filter((record) =>
      isV2PublicLaunch(record, manifest) &&
      (record.category !== "custom" ||
        (customRegistryLive &&
          (isExactCustomRegistryGenesisCanary(record)
            ? baselineReady
            : customSourceReady))),
    )
    .map(projectV2Record);
  const counts = {
    total: records.length,
    classic: records.filter((record) => record.category === "classic").length,
    custom: records.filter((record) => record.category === "custom").length,
  };
  return {
    records,
    status: {
      ...dataset.status,
      schemaVersion: API_V2_SCHEMA_VERSION,
      customRegistryPublication: {
        status: customRegistryLive ? "live" : "prelaunch",
        publicSubmissionsEnabled,
        publicationReady: customPublicationReady,
        baselineReady,
        sourceConfigured: dataset.status?.customRegistry?.configured === true,
        sourceReady: customSourceReady,
        sourceCurrent:
          dataset.status?.customRegistry?.configured === true &&
          dataset.status?.customRegistry?.status === "ready" &&
          dataset.status?.customRegistry?.completeness === "complete" &&
          dataset.status?.customRegistry?.freshness === "current" &&
          dataset.status?.customRegistry?.sourceId ===
            dataset.status?.customRegistry?.expectedSourceId,
        expectedSourceId:
          dataset.status?.customRegistry?.expectedSourceId ??
          (activeGeneration === 1n
            ? "programmable-custom-launch-registry-v3"
            : activeGeneration === 2n
              ? "programmable-custom-launch-registry-v4"
              : null),
        observedSourceId: dataset.status?.customRegistry?.sourceId ?? null,
        activeGeneration: activeGeneration === null
          ? null
          : activeGeneration.toString(),
        requiresLiveSource,
        publishedRegistries: canonicalRegistryDeployments(manifest).length,
        baselineLaunches: records.filter(isExactCustomRegistryGenesisCanary).length,
        applicantLaunches: sourceCoverage.applicants.length,
      },
      supportedChainIds: Array.isArray(manifest?.chains)
        ? manifest.chains
            .filter((chain) => chain.status === "live")
            .map((chain) => chain.chainId)
        : [dataset.status.chainId].filter(Number.isSafeInteger),
      counts,
    },
  };
}

export async function getV2Dataset() {
  const [dataset, manifest] = await Promise.all([
    getDataset(),
    developerManifestV2(),
  ]);
  return projectV2Dataset(seedCustomRegistryBaseline(dataset), manifest);
}

export function isV2DatasetPublishable(dataset, category = null) {
  const classicReady = Boolean(
    dataset?.status?.coverage?.status === "complete" &&
      dataset.status.coverage.checkpoint,
  );
  if (!classicReady) return false;
  if (category === "classic") return true;
  const publication = dataset.status.customRegistryPublication;
  if (publication?.status !== "live") return true;
  if (publication.requiresLiveSource === true &&
    publication.sourceReady !== true) return false;
  if (category === "custom") return publication.publicationReady === true;
  return true;
}

export function feedStatusV2(dataset, category = null) {
  const classic = feedStatus(dataset.status.status);
  const publication = dataset.status.customRegistryPublication;
  const selectedRecords = dataset.records.filter((record) =>
    category === null || record.category === category);
  const classicCoverageReady = Boolean(
    dataset.status.coverage?.status === "complete" &&
      dataset.status.coverage?.checkpoint,
  );
  const customPublicationIncomplete =
    category !== "classic" &&
    publication?.status === "live" &&
    publication.publicationReady !== true;

  if (!classicCoverageReady || customPublicationIncomplete || classic === "unavailable") {
    return selectedRecords.length > 0 ? "degraded" : "unavailable";
  }
  if (
    category !== "classic" &&
    publication?.status === "live" &&
    publication.publicationReady !== true
  ) {
    return "degraded";
  }
  return classic;
}

export function serviceStatusV2(status, manifestOrStatus = "prelaunch") {
  const manifest =
    manifestOrStatus && typeof manifestOrStatus === "object"
      ? manifestOrStatus
      : null;
  const customRegistryStatus = manifest?.customRegistry?.status ?? manifestOrStatus;
  const routesAvailable = Boolean(
    status.coverage?.status === "complete" && status.coverage?.checkpoint,
  );
  const publishedRecords = Number.isSafeInteger(status.counts?.total)
    ? status.counts.total
    : 0;
  const publishedClassic = Number.isSafeInteger(status.counts?.classic)
    ? status.counts.classic
    : 0;
  const publishedCustom = Number.isSafeInteger(status.counts?.custom)
    ? status.counts.custom
    : 0;
  const classicFeed = routesAvailable
    ? feedStatus(status.status)
    : publishedClassic > 0
      ? "degraded"
      : "unavailable";
  const customLive = customRegistryStatus === "live";
  const customFeed = customLive
    ? status.customRegistryPublication?.publicationReady === true
      ? routesAvailable
        ? feedStatus(status.status)
        : publishedCustom > 0
          ? "degraded"
          : "unavailable"
      : publishedCustom > 0
        ? "degraded"
        : "unavailable"
    : "ready";
  const feeds = classicFeed === "ready" && customFeed === "ready"
    ? "ready"
    : publishedRecords > 0
      ? "degraded"
      : "unavailable";
  return {
    schemaVersion: API_V2_SCHEMA_VERSION,
    apiVersion: "2",
    service:
      feeds === "ready" && customFeed === "ready" ? "operational" : "degraded",
    checkedAt: status.generatedAt,
    chainId: status.chainId,
    chains: manifest?.chains ?? [
      {
        chainId: status.chainId,
        caip2: `eip155:${status.chainId}`,
        status: "live",
      },
    ],
    classic: {
      status: "live",
      note: "Current and historical Programmable Classic launches are discoverable.",
    },
    custom: {
      status: customLive ? "live" : "prelaunch",
      note:
        customLive
          ? "Approved Custom Registry launches are discoverable. Custom Launch API V1 reads and status remain live, but POST is read-only; legacy Registry and GitHub submission intake are closed."
          : "Programmable Custom begins with approved Custom Registry launches. No registry deployment is published yet.",
    },
    customLaunchApi: {
      status: "live",
      scope: "provenance-only",
      feeEnforcement: "not-established-by-api",
      writeStatus: "read-only",
      postResponse: {
        httpStatus: 409,
        code: "CUSTOM_LAUNCH_V1_READ_ONLY",
        retryable: false,
      },
      readyzUrl: "https://api.programmable.market/readyz",
      guideUrl: "https://programmable.market/developers/custom-launch-api-v1.md",
      openApiUrl: "https://programmable.market/openapi/custom-launch-v1.json",
      apiKeyManagementUrl: "https://programmable.market/developers/api-keys",
      walletBoundary: "separate-wallet-signature",
    },
    customFeeEnforcedLaunchProfileV2:
      manifest?.customFeeEnforcedLaunchProfileV2 ?? {
        schemaVersion: "programmable.custom-fee-enforced-launch-profile.v2",
        profileId:
          "programmable.fee-enforced-isolated-after-swap.zero-delta.v1",
        profileRevision: 1,
        profileVersion: "2.0.0-rc.1",
        publicCategory: "custom",
        registryRelationship: "independent-from-custom-registry-generation-2",
        releaseStage: "release-candidate",
        status: "unavailable",
        activationStatus: "canary",
        productionLaunchAuthorized: false,
        guideUrl:
          "https://raw.githubusercontent.com/0xprogrammable/developers/main/docs/guides/custom-fee-enforced-launch-profile-v2.md",
        api: {
          apiVersion: "2",
          availability: "dark-release-candidate",
          publiclyRoutable: false,
          collectionPath: "/v2/custom-launches",
          singleResourcePath: "/v2/custom-launches/{requestId}",
          openApiUrl: "https://programmable.market/openapi/custom-launch-v2.json",
          walletBoundary: "separate-wallet-signature",
          listReconciliation: "bounded-opportunistic-for-pending-records",
          recommendedPollingPath: "single-resource",
          heldResponse: {
            httpStatus: 503,
            retryAfter: "required",
            retryable: true,
          },
        },
        cli: {
          packageName: "@programmable/launch",
          version: "2.0.0-rc.1",
          distributionStatus: "github-release-candidate",
          releaseUrl:
            "https://github.com/0xprogrammable/PROGRAMMABLE/releases/tag/programmable-launch-v2.0.0-rc.1",
          packageAssetUrl:
            "https://github.com/0xprogrammable/PROGRAMMABLE/releases/download/programmable-launch-v2.0.0-rc.1/programmable-launch-2.0.0-rc.1.tgz",
          commands: ["pack", "validate", "submit", "status"],
        },
        requestContract: {
          configSchema: "programmable.launch-pack-config.v2",
          createRequestSchema: "programmable.custom-launch-create-request.v2",
          attestationSchema: "programmable.agent-launch-attestation.v2",
          targetRoles: [
            "token",
            "customModule",
            "feeVault",
            "feeHook",
            "poolInitializer",
          ],
          verificationBundleRequired: true,
          runtimeImmutablesRequired: true,
          launchProfileHashRequired: true,
          launchIntentHashRequired: true,
        },
        moduleSemantics: {
          mode: "isolated-external-module",
          callback: "afterSwap",
          arbitraryCallbacks: false,
          maximumCustomReturnDelta: 0,
          customDeltaAccount: "0x0000000000000000000000000000000000000000",
        },
        finalArtifactLiterals: {
          status: "pinned-release-candidate",
          launchProfileHash:
            "sha256:c2c8df0ce28ef4eea1d5124bc366c634675873d095e9978bc7e968792a4c738d",
          contractPolicyId:
            "0xb7ff874d418bc714d0ec6c36a2df03ea6251bc8b6eb125adc4f5b6b4899d2517",
        },
        artifactCommitments: {
          compiler: {
            version: "0.8.26+commit.8a97fa7a",
            evmVersion: "cancun",
            optimizer: { enabled: true, runs: 1000 },
            viaIR: false,
            metadata: { bytecodeHash: "ipfs", appendCBOR: true },
            settingsHash:
              "0xd8985cd6554daab2848a8df4d90f9d5e0d81f15d062ee04bcd8414f292ccaf43",
          },
          components: [
            {
              role: "token",
              contractName: "ProgrammableLaunchTokenV2",
              standardJsonInputSha256:
                "sha256:72af5d9faedef9188f1d9e20e2d8a37557e2bb14d44be54ce3aacb11c71ef877",
              creationBytecodeHash:
                "0x71660c7252993788cbab7c257ce654622c5661611623c4cb288f68f157d1b25d",
              runtimeTemplateCodeHash:
                "0xf98eb029ee9c1face4b56fafd83612be8b813bf15a402a959ac107de8b203eef",
              runtimeCodeHash:
                "0xf98eb029ee9c1face4b56fafd83612be8b813bf15a402a959ac107de8b203eef",
            },
            {
              role: "feeVault",
              contractName: "ProgrammableFeeVaultV2",
              standardJsonInputSha256:
                "sha256:af2508146771a53b2c44b0be2b108a4dc3d692148595cae2ce63f1bf815667a3",
              creationBytecodeHash:
                "0x053476bd624631357dfe15ec172bd046f6a4621003d3293a16fb87dce1ba70bd",
              runtimeTemplateCodeHash:
                "0x8a55169728ba90b1fdb275b06c6b6be0467282327c73e9324c08c78e5f62c359",
              runtimeCodeHash:
                "0xf9638e198b83c2ada6cfb34d108d2b0a8356fb4679847bd1d5f3127dee1f24d5",
            },
            {
              role: "feeHook",
              contractName: "ProgrammableIsolatedAfterSwapFeeHookV2",
              standardJsonInputSha256:
                "sha256:58b041ccea068f16f6b9a93e57c7b29578bdfc93a72306ced57800145f0db019",
              creationBytecodeHash:
                "0x1a54813e879edb214d24e97b1f50575f290503f46ea35c1fe40b45114983cdf9",
              runtimeTemplateCodeHash:
                "0xe2bbc60d8e8fbe2fa16576f02785445063acf342cdeb1acfea1539d7cb96f067",
              runtimeCodeHash:
                "0xe2bbc60d8e8fbe2fa16576f02785445063acf342cdeb1acfea1539d7cb96f067",
            },
            {
              role: "poolInitializer",
              contractName: "ProgrammableFeePoolInitializerV2",
              standardJsonInputSha256:
                "sha256:3c2b96af0fc57aea1925fe4ccf6efb937f70df4358bba8889d8406c00607695f",
              creationBytecodeHash:
                "0x690a30ab2f5ee0c42856a9627cb46d79b5ebc4fa0a2f4c75c3a6f3e077cbbbeb",
              runtimeTemplateCodeHash:
                "0xe7210ee2a0edac8fe7e90387445d9c0ca26b7fa342e6828371d2db5969ae3c4d",
              runtimeCodeHash:
                "0xe7210ee2a0edac8fe7e90387445d9c0ca26b7fa342e6828371d2db5969ae3c4d",
            },
          ],
        },
        requiredBindings: {
          exactPoolId: "per-launch-required",
          initialSqrtPriceX96: "per-launch-required",
          authorizedInitializer: "per-launch-required",
          canonicalPoolManager: {
            address: "0x000000000004444c5dc75cB358380D2e3dE08A90",
            runtimeCodeHash:
              "0x785f1014552b7ce7d5fb7d0c970ca60edee94fd00425d7ca21609acac7ce1293",
          },
          actualHookRuntimeCodeHash:
            "0xe2bbc60d8e8fbe2fa16576f02785445063acf342cdeb1acfea1539d7cb96f067",
          actualVaultRuntimeCodeHash:
            "0xf9638e198b83c2ada6cfb34d108d2b0a8356fb4679847bd1d5f3127dee1f24d5",
          compositionHash: "per-launch-required",
        },
        feeSemantics: {
          ratePpm: 1000,
          rateBps: 10,
          denominatorPpm: 1_000_000,
          chargeMode: "additive",
          basis: "gross-unspecified-pool-currency-amount",
          assetMode: "unspecified-pool-currency-per-swap",
          exactInputFeeAsset: "output-currency",
          exactOutputFeeAsset: "input-currency",
          scope: "exact-bound-pool",
          appliesOn: "successful-swaps-only",
          recipient: "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
          settlementMode: "pool-manager-erc6909-claims-in-sealed-vault",
          claimAuthority:
            "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
          claimSurface: "fixed-reward-wallet-only",
          requiredHookFlags: "0x2044",
          requiredHookFlagsStatus: "pinned-release-candidate",
          separateComponents: [
            "liquidity-provider-fee",
            "protocol-fee",
            "creator-fee",
            "network-gas",
          ],
        },
        evidenceStatus: {
          profileArtifacts: "exact-pinned-release-candidate",
          securityReview: "release-blockers-open",
          successfulSimulation: "unavailable",
          onchainDeployment: "unavailable",
          onchainFeeReadback: "unavailable",
          finalizedCanary: "unavailable",
          sourceExactMatch: "unavailable",
          securityAudit: "not-claimed",
          genericTradability: "not-claimed",
          genericClaiming: "not-available",
          buybacks: "not-available",
        },
        activationRequirements: [
          "cli-published",
          "backend-route-public",
          "profile-artifacts-pinned",
          "security-review-release-blockers-closed",
          "canonical-pool-manager-runtime-bound",
          "hook-vault-runtime-identities-bound",
          "pool-initialization-front-run-protected",
          "exact-pool-id-enforced",
          "composition-hash-bound",
          "successful-pinned-simulation",
          "onchain-deployment-finalized",
          "onchain-fee-readback-confirmed",
          "finalized-canary",
          "source-exact-match",
        ],
      },
    feeds: {
      manifest: "ready",
      launches: feeds,
      tokenList: feeds,
    },
    source: status.source,
    chain: status.chain,
    coverage: status.coverage,
    customRegistry: status.customRegistry,
    // Keep the publication gate visible to status consumers.  The projected
    // dataset already computes this independently from the source snapshot;
    // dropping it here makes a Gen1 canary look indistinguishable from a
    // fully configured applicant feed.
    customRegistryPublication: status.customRegistryPublication ?? null,
    counts: status.counts,
    errors: status.errors,
  };
}

export async function developerManifestV2() {
  manifestPromise ??= readFile(
    new URL("../deployments/ethereum-v2.json", import.meta.url),
    "utf8",
  ).then((source) => JSON.parse(source));
  return structuredClone(await manifestPromise);
}
