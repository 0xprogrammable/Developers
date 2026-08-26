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
import {
  carryRouterCustomTrust,
  isRouterStampedCustom,
  isTrustedRouterStampedCustomRecord,
  readRouterCustomRecords,
} from "./router-custom.js";

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
  return isRouterStampedCustom(record, manifest) ||
    isRegisteredCustom(record, manifest);
}

function classification(record) {
  const isClassic = record.category === "classic";
  const isRouterCustom = !isClassic &&
    isTrustedRouterStampedCustomRecord(record);
  return {
    namespace: "programmable",
    category: record.category,
    label: isClassic ? "Programmable Classic" : "Programmable Custom",
    basis: isClassic
      ? "recognized-classic-launcher-event"
      : isRouterCustom
        ? "canonical-launch-stamp-router"
        : "programmable-custom-registry-event",
  };
}

export function projectV2Record(record) {
  const isClassic = record.category === "classic";
  return carryRouterCustomTrust(record, {
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
  });
}

export function publicLaunchV2(record) {
  const {
    sortKey: _sortKey,
    registryV4Envelope: _registryV4Envelope,
    ...publicRecord
  } = record;
  return carryRouterCustomTrust(record, publicRecord);
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
        isRouterStampedCustom(record, manifest) ||
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

export function mergeRouterCustomRecords(dataset, routerCustom) {
  const existingLaunchIds = new Set(
    dataset.records.map((record) => record.launchId.toLowerCase()),
  );
  const existingTokens = new Set(
    dataset.records
      .map((record) => record.token?.address?.toLowerCase())
      .filter(Boolean),
  );
  for (const record of routerCustom.records) {
    if (
      existingLaunchIds.has(record.launchId.toLowerCase()) ||
      existingTokens.has(record.token.address.toLowerCase())
    ) {
      throw new Error("Router Custom identity conflicts with another public source");
    }
  }
  const records = [...routerCustom.records, ...dataset.records]
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey));
  return {
    ...dataset,
    records,
    status: {
      ...dataset.status,
      routerCustom: {
        source: "canonical-launch-stamp-router",
        status: routerCustom.status,
        generatedAt: routerCustom.generatedAt,
        asOfBlock: routerCustom.asOfBlock,
        asOfBlockHash: routerCustom.asOfBlockHash,
        sourceIdentityCommitment: routerCustom.sourceIdentityCommitment,
        snapshotSha256: routerCustom.snapshotSha256,
        verifiedIdentityCount: routerCustom.verifiedIdentityCount,
        publishedIdentityCount: routerCustom.records.length,
      },
    },
  };
}

export async function getV2Dataset() {
  const [dataset, manifest] = await Promise.all([
    getDataset(),
    developerManifestV2(),
  ]);
  const seeded = seedCustomRegistryBaseline(dataset);
  const routerCustom = await readRouterCustomRecords(manifest);
  return projectV2Dataset(
    mergeRouterCustomRecords(seeded, routerCustom),
    manifest,
  );
}

export function isV2DatasetPublishable(dataset, category = null) {
  const classicReady = Boolean(
    dataset?.status?.coverage?.status === "complete" &&
      dataset.status.coverage.checkpoint,
  );
  if (!classicReady) return false;
  if (category === "classic") return true;
  const router = dataset.status.routerCustom;
  if (router && (
    router.status !== "current" ||
    !Number.isSafeInteger(router.verifiedIdentityCount) ||
    !Number.isSafeInteger(router.publishedIdentityCount) ||
    router.verifiedIdentityCount !== router.publishedIdentityCount
  )) return false;
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
  const router = dataset.status.routerCustom;
  const routerCoverageIncomplete = category !== "classic" && Boolean(
    router && (
      router.status !== "current" ||
      !Number.isSafeInteger(router.verifiedIdentityCount) ||
      !Number.isSafeInteger(router.publishedIdentityCount) ||
      router.verifiedIdentityCount !== router.publishedIdentityCount
    )
  );

  if (
    !classicCoverageReady || customPublicationIncomplete ||
    routerCoverageIncomplete || classic === "unavailable"
  ) {
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
  const router = status.routerCustom;
  const routerReady = Boolean(
    router?.status === "current" &&
      Number.isSafeInteger(router.verifiedIdentityCount) &&
      Number.isSafeInteger(router.publishedIdentityCount) &&
      router.verifiedIdentityCount === router.publishedIdentityCount,
  );
  const customFeed = customLive
    ? status.customRegistryPublication?.publicationReady === true
      ? routesAvailable && (!router || routerReady)
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
          ? "Approved Custom Registry launches and finalized canonical-Router Custom identities are discoverable. Custom Launch API V2 and V3 are public on Ethereum Mainnet; V1 POST remains read-only, and legacy Registry and GitHub submission intake are closed."
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
        profileRevision: 3,
        profileVersion: "2.0.0",
        publicCategory: "custom",
        registryRelationship: "independent-from-custom-registry-generation-2",
        releaseStage: "production",
        status: "live",
        activationStatus: "production",
        productionLaunchAuthorized: true,
        guideUrl:
          "https://raw.githubusercontent.com/0xprogrammable/developers/main/docs/guides/custom-fee-enforced-launch-profile-v2.md",
        api: {
          apiVersion: "2",
          availability: "public",
          publiclyRoutable: true,
          collectionPath: "/v2/custom-launches",
          singleResourcePath: "/v2/custom-launches/{requestId}",
          openApiUrl: "https://programmable.market/openapi/custom-launch-v2.json",
          walletBoundary: "separate-wallet-signature",
          listReconciliation: "bounded-opportunistic-for-pending-records",
          recommendedPollingPath: "single-resource",
          retryPolicy: {
            httpStatuses: [429, 503],
            retryAfter: "honor",
            requestBytes: "exact-idempotency-bound-replay",
          },
        },
        cli: {
          packageName: "@programmable/launch",
          version: "2.0.1",
          distributionStatus: "github-release",
          releaseUrl:
            "https://github.com/0xprogrammable/PROGRAMMABLE/releases/tag/programmable-launch-v2.0.1",
          packageAssetUrl:
            "https://github.com/0xprogrammable/PROGRAMMABLE/releases/download/programmable-launch-v2.0.1/programmable-launch-2.0.1.tgz",
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
          status: "pinned-production",
          launchProfileHash:
            "sha256:fd2d738117c4c69304efb49c75d402d2e8b8968832fd2e27548c3d9814c5c9ee",
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
                "sha256:788d188b7f8fa86ecf49db7c0371c70a147f8ef99e4d617597feb2cdef2a9995",
              creationBytecodeHash:
                "0x0167ff8e72e4739491a8fbf1647cc4f583986f3a43ce16ae5289dd149b9a040c",
              runtimeTemplateCodeHash:
                "0x2c1d5986b9356fb81dbc37051b13effec4ad1e403fcb0d4c5cb236610ee2522d",
              runtimeCodeHash:
                "0xf2cbc21a3f07c05909d664ba8d8b66fe6576eb8a5d016faa53e31e73ed6acbd4",
            },
            {
              role: "feeHook",
              contractName: "ProgrammableIsolatedAfterSwapFeeHookV2",
              standardJsonInputSha256:
                "sha256:fad58023346d0d09d5508a4493854bcf0bb3d360e966a411d715a6a971aac803",
              creationBytecodeHash:
                "0x6cd2dbd66351cf83194fb942ace4b4f4356c9499d567619b15a922d5cad730b3",
              runtimeTemplateCodeHash:
                "0x0a461fa65d04305fa2e583d9a6fba369b3b2ff66aa5856f56d0782c2ff72e19c",
              runtimeCodeHash:
                "0x0a461fa65d04305fa2e583d9a6fba369b3b2ff66aa5856f56d0782c2ff72e19c",
            },
            {
              role: "poolInitializer",
              contractName: "ProgrammableFeePoolInitializerV2",
              standardJsonInputSha256:
                "sha256:ebda2869af9fb1dcd567913768cd37547ccb68171e07e5aff645ea6053f3414c",
              creationBytecodeHash:
                "0xf6e047132a68eb0692f314975b45af88c6dd873ab7ecaa7b0c3c84a490b9454c",
              runtimeTemplateCodeHash:
                "0x4df0f570bc27f05baa99ad297e4b7666d15f3101f43ba2e2863ce026432f43e4",
              runtimeCodeHash:
                "0x4df0f570bc27f05baa99ad297e4b7666d15f3101f43ba2e2863ce026432f43e4",
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
            "0x0a461fa65d04305fa2e583d9a6fba369b3b2ff66aa5856f56d0782c2ff72e19c",
          actualVaultRuntimeCodeHash:
            "0xf2cbc21a3f07c05909d664ba8d8b66fe6576eb8a5d016faa53e31e73ed6acbd4",
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
          requiredHookFlagsStatus: "pinned-production",
          separateComponents: [
            "liquidity-provider-fee",
            "protocol-fee",
            "creator-fee",
            "network-gas",
          ],
        },
        evidenceStatus: {
          profileArtifacts: "exact-pinned-production",
          securityReview: "internal-review-complete",
          successfulSimulation: "pinned-mainnet-block-permit-authorized-router-transaction",
          onchainDeployment: "no-public-rev3-canary",
          onchainFeeReadback: "configuration-bound-no-accrual-receipt",
          finalizedCanary: "not-yet-proven",
          sourceExactMatch: "not-yet-proven-for-rev3-canary",
          securityAudit: "not-independently-audited",
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
          "fee-path-configuration-bound",
          "dual-rpc-finality-enforced",
          "source-verification-worker-enabled",
          "global-v2-admission-cap-enforced",
        ],
      },
    ...(manifest?.directNativeHookGraphProfileV1
      ? {
          directNativeHookGraphProfileV1:
            manifest.directNativeHookGraphProfileV1,
        }
      : {}),
    ...(manifest?.directNativeHookGraphProfileV2
      ? {
          directNativeHookGraphProfileV2:
            manifest.directNativeHookGraphProfileV2,
        }
      : {}),
    ...(manifest?.directNativeHookGraphProfileV3
      ? {
          directNativeHookGraphProfileV3:
            manifest.directNativeHookGraphProfileV3,
        }
      : {}),
    feeds: {
      manifest: "ready",
      launches: feeds,
      tokenList: feeds,
    },
    source: status.source,
    chain: status.chain,
    coverage: status.coverage,
    customRegistry: status.customRegistry,
    ...(router ? { routerCustom: router } : {}),
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
