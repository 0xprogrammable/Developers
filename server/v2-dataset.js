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
      Array.isArray(registry.authorizedWriters) &&
      registry.authorizedWriters.some((writer) =>
        writer.toLowerCase() === evidence?.registryWriter?.toLowerCase()) &&
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
    return manifest?.customRegistry?.status === "live"
      && manifest.customRegistry.address?.toLowerCase()
        === record.verification.registryAddress.toLowerCase()
      && manifest.customRegistry.generation
        === record.verification.registryGeneration;
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

export function projectV2Dataset(dataset, manifest = null) {
  const customRegistryLive = manifest?.customRegistry?.status === "live";
  const publicSubmissionsEnabled =
    manifest?.customRegistry?.publicSubmissionsEnabled === true;
  const customSourceReady = dataset.status?.customRegistry?.status === "ready";
  const records = dataset.records
    .filter((record) =>
      isV2PublicLaunch(record, manifest) &&
      (record.category !== "custom" || (customRegistryLive && customSourceReady)),
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
        sourceReady: customSourceReady,
        publishedRegistries: canonicalRegistryDeployments(manifest).length,
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
  const seeded = {
    ...dataset,
    records: [
      customRegistryGenesisCanaryRecord(),
      ...dataset.records.filter((record) =>
        record.launchId !== CUSTOM_REGISTRY_GENESIS_CANARY.launchId),
    ],
    status: {
      ...dataset.status,
      customRegistry: {
        ...dataset.status.customRegistry,
        configured: true,
        status: "ready",
        sourceId: "programmable-custom-registry-genesis-release-v1",
        completeness: "finalized-release-bound",
        freshness: "immutable",
        checkedAt: CUSTOM_REGISTRY_GENESIS_CANARY.launch.finalizedAt,
        latestAcceptedAt: CUSTOM_REGISTRY_GENESIS_CANARY.launch.finalizedAt,
        highWaterGeneration: "1",
        indexedAt: CUSTOM_REGISTRY_GENESIS_CANARY.launch.finalizedAt,
        launches: Math.max(1, dataset.status.customRegistry?.launches ?? 0),
      },
    },
  };
  return projectV2Dataset(seeded, manifest);
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
  if (category === "custom") return publication.sourceReady === true;
  return true;
}

export function feedStatusV2(dataset, category = null) {
  if (!isV2DatasetPublishable(dataset, category)) return "unavailable";
  const classic = feedStatus(dataset.status.status);
  const publication = dataset.status.customRegistryPublication;
  if (
    category !== "classic" &&
    publication?.status === "live" &&
    publication.sourceReady !== true
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
  const feeds = routesAvailable ? feedStatus(status.status) : "unavailable";
  const customLive = customRegistryStatus === "live";
  const customFeed = customLive
    ? status.customRegistry?.status === "ready"
      ? feeds
      : "unavailable"
    : "ready";
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
          ? "Approved Custom Registry launches are discoverable as Programmable Custom."
          : "Programmable Custom begins with approved Custom Registry launches. No registry deployment is published yet.",
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
