import {
  CUSTOM_REGISTRY_GENERATION_2,
  deriveGen2ApprovalBindingHash,
  deriveGen2FeePolicyHash,
  deriveGen2RegisteredRecordCommitment,
  deriveGen2RegisteredRecordComponentHashes,
  deriveGen2RegistrationBindingHash,
  deriveGen2ReviewDeploymentBindingHash,
  GEN2_FEE_POLICY_KIND,
  REGISTRY_GEN2_BINDING_FIELDS,
  validateGen2PartnerFactoryAuthorization,
} from "./custom-registry-gen2.js";
import { canonicalSha256 } from "./canonical.js";
import {
  publicRegistryFees,
  publicRegistryLaunchStatus,
  publicRegistryMarket,
  publicRegistryPrimaryToken,
} from "./registry-v3.js";

export const REGISTRY_V4_PRODUCER_SCHEMA =
  "programmable.custom-launch-registry-record.v4";
export const REGISTRY_V4_PROJECTION_SCHEMA =
  "programmable.custom-launch-projection-record.v4";
export const REGISTRY_V4_ENVELOPE_SCHEMA =
  "programmable.custom-launch-projection-envelope.v4";
export const REGISTRY_V4_FEED_SOURCE_ID =
  "programmable-custom-launch-registry-v4";
export const REGISTRY_V4_PRODUCER_ENVELOPE_DOMAIN =
  "programmable.custom-launch-registry-envelope-digest.v4";

const ZERO_HASH = `0x${"0".repeat(64)}`;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-f]{64}$/;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/;

const GEN2_RELEASE = Object.freeze({
  registryContractId: "ProgrammableCustomRegistryV2",
  contractIntegrationAbiVersion: 1,
  registryReleaseSourceCommit:
    "e01f36a6d69136f674c203f83cca3ebdde0e0ded",
  registryEventSetId: "programmable.custom-registry-event-set.v2",
  registryEventSetHash:
    "sha256:bcff2958529fecaa7ef8c4c654389829bfb7dd61a3246f0d681cf7db0a42a58c",
  registryEventSetBytesSha256:
    "sha256:0c6c32e0db5eb55b8e0bd148a6206e0c0ab8605cda75338f3a556e75cd3eff1a",
  feePolicyDomain: "programmable.custom-fee-policy.v2",
});

const GEN2_CONTRACTS = Object.freeze({
  registry: Object.freeze({
    contractId: "ProgrammableCustomRegistryV2",
    abiSha256:
      "sha256:7c5fe7d25cc874a319c3621435c31cd8f531a7abfcd7d5073fc163d10d60524f",
  }),
  partnerFactoryRegistry: Object.freeze({
    contractId: "ProgrammableCustomPartnerFactoryRegistryV2",
    abiSha256:
      "sha256:054b5d2740314335d202e37d405273cbb9d0922398cbc2909e7cb7cee845061e",
  }),
  feePolicyVerifier: Object.freeze({
    contractId: "ProgrammableCustomFeePolicyVerifierV2",
    abiSha256:
      "sha256:0bc9bdda4a1e78e2c498568ddfa164b35c3cb5c297f563dd4771935e75304f62",
  }),
  atomicRegistrar: Object.freeze({
    contractId: "ProgrammableCustomAtomicRegistrarV2",
    abiSha256:
      "sha256:a053f14e59c3c54a0dad47e6e772ba411c7659a46eab3313a6c124260ebcff1f",
  }),
});

const GEN2_EVENT_BINDINGS = Object.freeze([
  ["registry", "approvalAuthorized", "0xb4fff32917416e7b84b1f40456921599cddfdcc057c9ad278706c5828b18c50b"],
  ["partnerFactoryRegistry", "partnerFactoryAuthorized", "0xa968119f9132089f6f4d7916a6da989971801f5f68b79eec527cb75cf38e6a02"],
  ["partnerFactoryRegistry", "partnerFactorySourceBound", "0xa939cc58afcf4fd66ae17957681f0bdd0f80452cde7742b88762bd115536de78"],
  ["partnerFactoryRegistry", "partnerFactoryRevoked", "0x704a05fde9f9d27fc692382126f225677f07d52ed9394af1b16e61fe4d2bb4ce"],
  ["registry", "registered", "0x8ee074138114415a92a0797b4f1f4c6353f8bd15d8031433abf0cc42c2dc274a"],
  ["registry", "provenance", "0x9593acf43b1c8e03c6742d49b67008f3c05841d3cfa43389d12f98e8b9c66cb9"],
  ["registry", "review", "0xb5db50dfea0e7ff29b1ddee247a008e857b05d2b4bc2b780de5717b7f1881b63"],
  ["registry", "attribution", "0x3608f2041bbe91aa3792101210bc2e29c23543fb4e0206daa2b1a99e7235c182"],
  ["registry", "feePolicy", "0xb889df8572071d751e87d3e2a46c54093a55a9bc5a4697440cd29c90255dc5bf"],
  ["registry", "feeScope", "0xfb69ef55bd117e822ea39d795bd1506dc489a1ce2c1ccd3ad4c781ef04598336"],
  ["registry", "feeEvidence", "0xe647c474a92f722808930d32d310f47d0e3a4faf393255e0dea4b272588babb0"],
  ["atomicRegistrar", "atomicExecuted", "0x95c51eef01e507ea45d10fa0c9939e8f78f574f9008ec761ba00c12031433098"],
  ["registry", "finalized", "0xab930c1c165bba36257b8079ae38b6869f604910f6ffa40c956e31eb1b8ce38f"],
  ["registry", "corrected", "0xa13c4392e0c64159cee078ced2b7157bc99993da4517b87fd0bd26b137600b78"],
  ["registry", "revoked", "0x195a188d2c49d5e643afbcfd959edbf2ed1d6cd9216c5d99f3ad08c1010a9744"],
].map(([emitterRole, id, topic0]) => ({ emitterRole, id, topic0 })));

const EVENT_TOPIC = Object.freeze(Object.fromEntries(
  GEN2_EVENT_BINDINGS.map(({ id, topic0 }) => [id, topic0]),
));

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function authorizationMatchesPreimage(authorization, preimage) {
  if (!authorization) return false;
  try {
    return validateGen2PartnerFactoryAuthorization(authorization) &&
      authorization.chainId === preimage.chainId &&
      authorization.registryGeneration === preimage.registryGeneration &&
      authorization.configurationHash === preimage.configurationHash &&
      authorization.providerId === preimage.providerId &&
      authorization.modelId === preimage.modelId &&
      authorization.modelVersion === preimage.modelVersion &&
      authorization.templateId === preimage.templateId &&
      authorization.templateVersion === preimage.templateVersion &&
      authorization.modelRepositoryId === preimage.repositoryId &&
      authorization.modelSourceCommitId === preimage.commitId &&
      authorization.launchRuntimeCodeSetHash === preimage.runtimeCodeSetHash &&
      authorization.permissionsHash === preimage.permissionsHash &&
      authorization.feePolicyHash === preimage.feePolicyHash;
  } catch {
    return false;
  }
}

function factoryBindingMatches(record, policy) {
  const preimage = record.registeredRecordPreimage;
  const authorization = record.partnerFactoryAuthorization ?? null;
  if (policy.kind === GEN2_FEE_POLICY_KIND.NativeCustom) {
    return authorization === null && preimage.providerId === ZERO_HASH;
  }
  if (policy.kind === GEN2_FEE_POLICY_KIND.NoQualifyingMarket) {
    return preimage.providerId === ZERO_HASH
      ? authorization === null
      : authorizationMatchesPreimage(authorization, preimage);
  }
  return policy.kind === GEN2_FEE_POLICY_KIND.PartnerTemplate &&
    preimage.providerId !== ZERO_HASH &&
    authorizationMatchesPreimage(authorization, preimage);
}

export function validateRegistryContractRecordV4(record) {
  try {
    const chainId = record?.registryOrigin?.chainId ?? record?.chainId;
    const registryGeneration = record?.registryOrigin?.registryGeneration ??
      record?.registryGeneration;
    if (record?.schemaVersion !== REGISTRY_V4_PRODUCER_SCHEMA ||
      registryGeneration !== CUSTOM_REGISTRY_GENERATION_2 ||
      String(chainId) !== record.registeredRecordPreimage?.chainId ||
      registryGeneration !==
        record.registeredRecordPreimage?.registryGeneration ||
      !record.registeredRecordPreimage ||
      Object.keys(record.registeredRecordPreimage).length !==
        REGISTRY_GEN2_BINDING_FIELDS.length ||
      !REGISTRY_GEN2_BINDING_FIELDS.every((field) =>
        Object.hasOwn(record.registeredRecordPreimage, field))) return false;

    const preimage = record.registeredRecordPreimage;
    const policy = record.onchainFeePolicy ?? record.feePolicy;
    const feePolicyHash = deriveGen2FeePolicyHash(policy);
    if (feePolicyHash !== preimage.feePolicyHash ||
      deriveGen2ApprovalBindingHash(preimage) !== preimage.approvalBindingHash ||
      deriveGen2ReviewDeploymentBindingHash(preimage) !==
        preimage.reviewDeploymentBindingHash) return false;

    const components = deriveGen2RegisteredRecordComponentHashes(preimage);
    const commitment = deriveGen2RegisteredRecordCommitment(preimage);
    if (!equalJson(components, record.registeredRecordComponentHashes) ||
      commitment !== record.registeredRecordCommitment ||
      deriveGen2RegistrationBindingHash(preimage) !==
        record.registrationBindingHash ||
      !factoryBindingMatches(record, policy)) return false;

    if (policy.kind === GEN2_FEE_POLICY_KIND.NoQualifyingMarket) {
      return preimage.marketPathId === ZERO_HASH;
    }
    return preimage.providerId === policy.providerId &&
      preimage.modelId === policy.modelId &&
      preimage.modelVersion === policy.modelVersion &&
      preimage.templateId === policy.templateId &&
      preimage.templateVersion === policy.templateVersion &&
      preimage.marketPathId === policy.marketPathId;
  } catch {
    return false;
  }
}

export function deriveRegistryProducerEnvelopeDigestV4(record) {
  const {
    schemaVersion: _schemaVersion,
    envelopeDigest: _envelopeDigest,
    ...preimage
  } = record;
  return canonicalSha256(REGISTRY_V4_PRODUCER_ENVELOPE_DOMAIN, preimage);
}

function trustRootMatches(record, projection) {
  const origin = record.registryOrigin;
  const projected = projection.origin;
  const releaseContracts = origin?.releaseContracts;
  if (!exactKeys(releaseContracts, Object.keys(GEN2_CONTRACTS)) ||
    !equalJson(origin.eventBindings, GEN2_EVENT_BINDINGS) ||
    !Object.entries(GEN2_RELEASE).every(([field, value]) =>
      origin[field] === value && projected[field] === value) ||
    !equalJson(projected.releaseContracts, releaseContracts) ||
    projected.registryAddress?.toLowerCase() !==
      origin.registryAddress?.toLowerCase() ||
    projected.registryStartBlock !== origin.registryStartBlock ||
    projected.registryRuntimeCodeHash !== releaseContracts.registry.runtimeCodeHash ||
    !["registered", "finalized", "corrected", "revoked"].includes(
      projected.operation,
    ) ||
    projected.eventTopic0 !== EVENT_TOPIC[projected.operation] ||
    projected.registryWriter?.toLowerCase() === ZERO_ADDRESS) return false;

  const addresses = new Set();
  for (const [role, expected] of Object.entries(GEN2_CONTRACTS)) {
    const contract = releaseContracts[role];
    if (!exactKeys(contract, [
      "address", "runtimeCodeHash", "startBlock", "contractId", "abiSha256",
    ]) || contract.contractId !== expected.contractId ||
      contract.abiSha256 !== expected.abiSha256 ||
      !ADDRESS.test(contract.address) ||
      contract.address.toLowerCase() === ZERO_ADDRESS ||
      addresses.has(contract.address.toLowerCase()) ||
      !HASH32.test(contract.runtimeCodeHash) ||
      contract.runtimeCodeHash === ZERO_HASH ||
      !DECIMAL.test(contract.startBlock)) return false;
    addresses.add(contract.address.toLowerCase());
  }
  if (releaseContracts.registry.address.toLowerCase() !==
      origin.registryAddress.toLowerCase() ||
    releaseContracts.registry.startBlock !== origin.registryStartBlock ||
    origin.registryAbiSha256 !== GEN2_CONTRACTS.registry.abiSha256) return false;

  const companions = [
    "provenance", "review", "attribution", "feePolicy", "feeScope",
    "feeEvidence",
  ].map((kind) => ({ kind, topic0: EVENT_TOPIC[kind] }));
  return equalJson(
    projected.registrationCompanions,
    projected.operation === "registered" ? companions : [],
  );
}

function proofMatches(record, projection) {
  const preimage = record.registeredRecordPreimage;
  const origin = projection.origin;
  const contracts = record.registryOrigin.releaseContracts;
  if (preimage.providerId === ZERO_HASH) {
    const proof = record.atomicExecutionProof;
    const atomic = contracts.atomicRegistrar;
    return record.partnerFactoryAuthorization === null && proof !== null &&
      proof.emitterRole === "atomicRegistrar" &&
      proof.emitterAddress.toLowerCase() === atomic.address.toLowerCase() &&
      proof.observedRuntimeCodeHash === atomic.runtimeCodeHash &&
      proof.topic0 === EVENT_TOPIC.atomicExecuted &&
      proof.transactionHash === origin.transactionHash &&
      proof.blockNumber === origin.blockNumber &&
      proof.blockHash === origin.blockHash &&
      proof.launchId === `0x${record.launchId.slice("sha256:".length)}` &&
      proof.deployed.toLowerCase() === preimage.primaryContract.toLowerCase() &&
      HASH32.test(proof.requestHash) && proof.requestHash !== ZERO_HASH &&
      proof.registeredRecordCommitment === record.registeredRecordCommitment &&
      proof.registrationBindingHash === record.registrationBindingHash &&
      origin.registryWriter.toLowerCase() === atomic.address.toLowerCase();
  }

  const authorization = record.partnerFactoryAuthorization;
  const partnerRegistry = contracts.partnerFactoryRegistry;
  const authorized = authorization?.authorizedEvent;
  const sourceBound = authorization?.sourceBoundEvent;
  return record.atomicExecutionProof === null && authorization !== null &&
    authorization.revoked === false &&
    origin.registryWriter.toLowerCase() === authorization.factory.toLowerCase() &&
    authorized.emitterRole === "partnerFactoryRegistry" &&
    sourceBound.emitterRole === "partnerFactoryRegistry" &&
    authorized.emitterAddress.toLowerCase() ===
      partnerRegistry.address.toLowerCase() &&
    sourceBound.emitterAddress.toLowerCase() ===
      partnerRegistry.address.toLowerCase() &&
    authorized.observedRuntimeCodeHash === partnerRegistry.runtimeCodeHash &&
    sourceBound.observedRuntimeCodeHash === partnerRegistry.runtimeCodeHash &&
    authorized.topic0 === EVENT_TOPIC.partnerFactoryAuthorized &&
    sourceBound.topic0 === EVENT_TOPIC.partnerFactorySourceBound &&
    BigInt(authorized.blockNumber) <= BigInt(origin.blockNumber) &&
    BigInt(sourceBound.blockNumber) <= BigInt(origin.blockNumber) &&
    BigInt(authorization.stateObservedAtBlock) >=
      BigInt(sourceBound.blockNumber) &&
    BigInt(authorization.stateObservedAtBlock) <= BigInt(origin.blockNumber);
}

function publicProjectionMatches(record, projection) {
  const publicProjection = projection.publicProjection;
  const directMappings = {
    platformId: record.platformId,
    category: record.category,
    publicLabel: record.publicLabel,
    launchId: record.launchId,
    projectId: record.projectId,
    chainId: record.registryOrigin.chainId,
    caip2: record.registryOrigin.caip2,
    model: record.model,
    template: record.template,
    partner: record.partner,
    launchingWallet: record.launchingWallet,
    launchIdentity: record.launchIdentity,
    advertisesToken: record.advertisesToken,
    assets: record.discoverableAssets,
    assetIdentitySetHash: record.assetIdentitySetHash,
    markets: record.discoverableMarkets,
    marketSetHash: record.marketSetHash,
    mechanisms: record.mechanisms,
    capabilities: record.capabilities,
    feePolicy: record.feePolicy,
    onchainFeePolicy: record.onchainFeePolicy,
    verifiedReview: record.verifiedReview,
    postLaunchAuthorityInventory: record.postLaunchAuthorityInventory,
    finality: record.finality,
    lifecycle: record.lifecycle,
    presentationVersion: record.presentationVersion,
    presentationBindingHash: record.presentationBindingHash,
    presentation: record.presentation,
    extensions: record.extensions,
  };
  return exactKeys(publicProjection, Object.keys(directMappings)) &&
    equalJson(publicProjection, directMappings);
}

export function validateRegistryProjectionEnvelopeV4(envelope) {
  try {
    if (!exactKeys(envelope, [
      "schemaVersion", "sourceId", "producerSchemaVersion",
      "projectionSchemaVersion", "projectionDigest", "rawRecordHash",
      "rawRecord", "projection",
    ]) || envelope?.schemaVersion !== REGISTRY_V4_ENVELOPE_SCHEMA ||
      envelope.sourceId !== REGISTRY_V4_FEED_SOURCE_ID ||
      envelope.producerSchemaVersion !== REGISTRY_V4_PRODUCER_SCHEMA ||
      envelope.projectionSchemaVersion !== REGISTRY_V4_PROJECTION_SCHEMA ||
      !envelope.rawRecord || !envelope.projection ||
      envelope.rawRecord.schemaVersion !== REGISTRY_V4_PRODUCER_SCHEMA ||
      envelope.projection.schemaVersion !== REGISTRY_V4_PROJECTION_SCHEMA ||
      envelope.projection.platformId !== "programmable" ||
      envelope.projection.category !== "custom" ||
      envelope.projection.origin?.registryGeneration !==
        CUSTOM_REGISTRY_GENERATION_2 ||
      envelope.projection.lifecycle?.registryGeneration !==
        CUSTOM_REGISTRY_GENERATION_2 ||
      envelope.rawRecord.registryOrigin?.registryGeneration !==
        CUSTOM_REGISTRY_GENERATION_2 ||
      envelope.rawRecord.lifecycle?.registryGeneration !==
        CUSTOM_REGISTRY_GENERATION_2 ||
      envelope.rawRecord.envelopeDigest !==
        deriveRegistryProducerEnvelopeDigestV4(envelope.rawRecord) ||
      !validateRegistryContractRecordV4(envelope.rawRecord) ||
      envelope.rawRecordHash !==
        canonicalSha256(REGISTRY_V4_PRODUCER_SCHEMA, envelope.rawRecord) ||
      envelope.projectionDigest !==
        canonicalSha256(REGISTRY_V4_PROJECTION_SCHEMA, envelope.projection) ||
      !equalJson(envelope.projection.rawProducerRecord, envelope.rawRecord) ||
      envelope.projection.producerBinding?.schemaVersion !==
        REGISTRY_V4_PRODUCER_SCHEMA ||
      envelope.projection.producerBinding?.envelopeDigest !==
        envelope.rawRecord.envelopeDigest ||
      envelope.projection.producerBinding?.rawRecordHash !==
        envelope.rawRecordHash ||
      envelope.projection.launchId !== envelope.rawRecord.launchId ||
      envelope.projection.projectId !== envelope.rawRecord.projectId ||
      !equalJson(
        envelope.projection.registeredRecordPreimage,
        envelope.rawRecord.registeredRecordPreimage,
      ) ||
      !equalJson(
        envelope.projection.registeredRecordComponentHashes,
        envelope.rawRecord.registeredRecordComponentHashes,
      ) ||
      envelope.projection.registeredRecordCommitment !==
        envelope.rawRecord.registeredRecordCommitment ||
      envelope.projection.registrationBindingHash !==
        envelope.rawRecord.registrationBindingHash ||
      envelope.projection.origin.registryAddress?.toLowerCase() !==
        envelope.rawRecord.registryOrigin.registryAddress?.toLowerCase() ||
      envelope.projection.origin.registryStartBlock !==
        envelope.rawRecord.registryOrigin.registryStartBlock ||
      envelope.projection.origin.registryEventSetHash !==
        envelope.rawRecord.registryOrigin.registryEventSetHash ||
      envelope.rawRecord.registryOrigin.registeredRecordHash !==
        envelope.rawRecord.registeredRecordCommitment ||
      envelope.rawRecord.registryOrigin.registrationBindingHashRaw !==
        envelope.rawRecord.registrationBindingHash ||
      !trustRootMatches(envelope.rawRecord, envelope.projection) ||
      !proofMatches(envelope.rawRecord, envelope.projection) ||
      !publicProjectionMatches(envelope.rawRecord, envelope.projection)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateRegistryCustomFeedItemV4(item) {
  try {
    const keys = [
      "generation",
      "projectionKey",
      "schemaVersion",
      "sourceId",
      "producerSchemaVersion",
      "projectionSchemaVersion",
      "projectionDigest",
      "rawRecordHash",
      "rawRecord",
      "projection",
    ].sort();
    if (!item || Object.keys(item).sort().join("\0") !== keys.join("\0") ||
      !/^[1-9][0-9]*$/.test(item.generation ?? "") ||
      item.projectionKey !==
        `custom:${item.rawRecord?.registryOrigin?.caip2}:${item.projection?.launchId}`) {
      return false;
    }
    const { generation: _generation, projectionKey: _projectionKey, ...envelope } =
      item;
    return validateRegistryProjectionEnvelopeV4(envelope);
  } catch {
    return false;
  }
}

function safeInteger(value) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function generationContractSet(releaseContracts) {
  return Object.fromEntries(Object.entries(releaseContracts).map(
    ([role, contract]) => [role, {
      address: contract.address,
      runtimeCodeKeccak256: contract.runtimeCodeHash,
    }],
  ));
}

export function normalizeRegistryCustomItemV4(item) {
  if (!validateRegistryCustomFeedItemV4(item)) {
    throw new TypeError("Registry custom v4 launch item is invalid");
  }
  const {
    generation,
    projectionKey,
    ...envelope
  } = item;
  const projection = envelope.projection;
  const record = projection.publicProjection;
  const raw = envelope.rawRecord;
  const origin = projection.origin;
  const chainId = safeInteger(record.chainId);
  const blockNumber = safeInteger(origin.blockNumber);
  const transactionIndex = safeInteger(
    origin.transactionIndex ?? raw.finality.transactionIndex,
  );
  const logIndex = safeInteger(origin.logIndex ?? raw.finality.logIndex);
  if (chainId === null || blockNumber === null || transactionIndex === null ||
    logIndex === null) {
    throw new TypeError("Registry custom v4 chain position is unsafe");
  }
  const revoked = projection.lifecycle.status === "revoked" ||
    raw.verifiedReview.status === "revoked";
  const programmableVerified = !revoked &&
    projection.lifecycle.status === "finalized" &&
    projection.registryFinality.status === "finalized" &&
    raw.verifiedReview.status === "verified";
  const publicRecord = {
    ...record,
    rawProducerRecord: raw,
    lifecycle: projection.lifecycle,
    registryFinality: projection.registryFinality,
    programmableVerified,
  };
  const presentation = record.presentation === null
    ? null
    : {
        description: record.presentation.description,
        image: record.presentation.image,
        website: record.presentation.website,
        x: record.presentation.x,
        telegram: record.presentation.telegram,
        discord: record.presentation.discord,
        github: record.presentation.github,
        docs: record.presentation.docs,
        trustStatus: "creator-declared",
      };
  const registryEvidence = {
    generation,
    projectionKey,
    rawRecordHash: envelope.rawRecordHash,
    registryRuntimeCodeHash: origin.registryRuntimeCodeHash,
    registryWriter: origin.registryWriter,
    operation: origin.operation,
    eventTopic0: origin.eventTopic0,
    registryFinality: structuredClone(projection.registryFinality),
    projectionLifecycle: structuredClone(projection.lifecycle),
    programmableVerified,
    registryGenerationContractSet: generationContractSet(
      origin.releaseContracts,
    ),
  };
  return {
    schemaVersion: "2.0.0",
    platformId: "programmable",
    origin: "programmable",
    launchFamily: "custom",
    publicLabel: "Programmable Custom",
    launchId: record.launchId,
    registryRecordSchemaVersion: envelope.producerSchemaVersion,
    producerEnvelopeDigest: raw.envelopeDigest,
    registeredRecordHash: raw.registryOrigin.registeredRecordHash,
    registeredRecordPreimage: structuredClone(
      projection.registeredRecordPreimage,
    ),
    registeredRecordComponentHashes: structuredClone(
      projection.registeredRecordComponentHashes,
    ),
    registeredRecordCommitment: projection.registeredRecordCommitment,
    registrationBindingHash: projection.registrationBindingHash,
    projectionDigest: envelope.projectionDigest,
    registryV4Envelope: structuredClone(envelope),
    category: "custom",
    chainId,
    caip2: record.caip2,
    projectId: record.projectId,
    model: structuredClone(record.model),
    template: structuredClone(record.template),
    partner: structuredClone(record.partner),
    builder: null,
    token: publicRegistryPrimaryToken(publicRecord),
    assets: structuredClone(record.assets),
    launch: {
      status: publicRegistryLaunchStatus(publicRecord),
      origin: "programmable-custom-registry-v4",
      modelId: record.model.id,
      modelVersion: record.model.version,
      publicSubmission: true,
      creatorAddress: null,
      transactionHash: origin.transactionHash,
      blockNumber: origin.blockNumber,
      blockHash: origin.blockHash,
      transactionIndex,
      logIndex,
      timestamp: origin.onchainTimestamp,
      finality: projection.registryFinality.status,
      launchWallet: record.launchingWallet.value,
      observedAt: projection.registryFinality.observedAt,
      confirmedAt: null,
      finalizedAt: null,
      orphanedAt: null,
      revokedAt: record.lifecycle.revokedAt,
    },
    verification: {
      sourceId: REGISTRY_V4_FEED_SOURCE_ID,
      launcherAddress: null,
      registryAddress: origin.registryAddress,
      provenanceStatus: revoked ? "revoked" : "verified",
      sourceUrl: null,
      registryGeneration: origin.registryGeneration,
      registryEventTopic: origin.eventTopic0,
      registryLogIndex: logIndex,
      approvalMatch: revoked ? "revoked" : "matched",
      runtimeMatch: revoked ? "revoked" : "matched",
      metadataTrust: "onchain-verified",
    },
    approvalBinding: structuredClone(raw.approvalBinding),
    deploymentBinding: structuredClone(raw.deploymentBinding),
    verifiedReview: structuredClone(record.verifiedReview),
    feePolicy: structuredClone(record.feePolicy),
    onchainFeePolicy: structuredClone(record.onchainFeePolicy),
    finalityPolicy: structuredClone(raw.finalityPolicy),
    finalityEvidence: structuredClone(record.finality),
    presentation,
    registryOrigin: structuredClone(raw.registryOrigin),
    launchingWallet: structuredClone(record.launchingWallet),
    postLaunchAuthorityInventory: structuredClone(
      record.postLaunchAuthorityInventory,
    ),
    postLaunchAuthorityInventoryHash: raw.postLaunchAuthorityInventoryHash,
    launchIdentity: structuredClone(record.launchIdentity),
    advertisesToken: record.advertisesToken,
    assetIdentitySetHash: record.assetIdentitySetHash,
    marketSetHash: record.marketSetHash,
    lifecycle: structuredClone(record.lifecycle),
    presentationVersion: record.presentationVersion,
    presentationBindingHash: record.presentationBindingHash,
    capabilities: structuredClone(record.capabilities),
    mechanisms: structuredClone(record.mechanisms),
    markets: record.markets.map((market) =>
      publicRegistryMarket(publicRecord, market, programmableVerified)),
    fees: publicRegistryFees(record.feePolicy, revoked),
    extensions: {
      "programmable/registry-v4": registryEvidence,
    },
    sortKey: `${String(blockNumber).padStart(16, "0")}:${String(
      transactionIndex,
    ).padStart(10, "0")}:${String(logIndex).padStart(10, "0")}:${
      record.launchId.slice("sha256:".length)}`,
  };
}
