import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import {
  deriveGen2ApprovalBindingHash,
  deriveGen2FeePolicyHash,
  deriveGen2PartnerConfigurationHash,
  deriveGen2RegisteredRecordCommitment,
  deriveGen2RegisteredRecordComponentHashes,
  deriveGen2RegistrationBindingHash,
  deriveGen2ReviewDeploymentBindingHash,
  GEN2_FEE_POLICY_KIND,
  PARTNER_STATUS_ACTIVE_ID,
  REGISTRY_GEN2_BINDING_FIELDS,
  validateGen2PartnerFactoryAuthorization,
} from "../server/custom-registry-gen2.js";
import {
  deriveRegistryPartnerFactoryAuthorizedAbiProofV4,
  deriveRegistryPartnerFactorySourceBoundAbiProofV4,
  normalizeRegistryCustomItemV4,
  REGISTRY_V4_PRODUCER_SCHEMA,
  validateRegistryContractRecordV4,
  validateRegistryCustomFeedItemV4,
  validateRegistryExecutionProofV4,
  validateRegistryProjectionEnvelopeV4,
} from "../server/registry-v4.js";
import {
  isV2DatasetPublishable,
  isV2PublicLaunch,
  projectV2Dataset,
  publicLaunchV2,
  registryOriginMatchesManifest,
} from "../server/v2-dataset.js";
import { createSchemaRegistry } from "../scripts/lib/schema.mjs";
import { validateManifestSemantics } from "../scripts/lib/semantics.mjs";
import atomicRegistrarAbi from
  "../abis/candidates/programmable-custom-atomic-registrar-v2.json" with { type: "json" };
import feePolicyVerifierAbi from
  "../abis/candidates/programmable-custom-fee-policy-verifier-v2.json" with { type: "json" };
import partnerFactoryRegistryAbi from
  "../abis/candidates/programmable-custom-partner-factory-registry-v2.json" with { type: "json" };
import registryAbi from
  "../abis/candidates/programmable-custom-registry-v2.json" with { type: "json" };
import registryEventSet from
  "../fixtures/v2/custom-registry-event-set-v2.candidate.json" with { type: "json" };
import registryReleaseCandidate from
  "../fixtures/v2/custom-registry-generation-2.release-candidate.json" with { type: "json" };
import registryV4Envelope from
  "../fixtures/v2/custom-launch-registry-projection-envelope-v4-gen2.json" with { type: "json" };
import { canonicalSha256 } from "../server/canonical.js";
import { keccak256 } from "../server/keccak.js";

const ZERO_HASH = `0x${"0".repeat(64)}`;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const PROGRAMMABLE_RECIPIENT =
  "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";

function hash(number) {
  return `0x${number.toString(16).padStart(64, "0")}`;
}

function address(number) {
  return `0x${number.toString(16).padStart(40, "0")}`;
}

function leg(shareBps, recipient, claimRightId) {
  return {
    shareBps: String(shareBps),
    recipient,
    currency: ZERO_ADDRESS,
    chargeModeId: hash(80),
    basisId: hash(81),
    roundingId: hash(82),
    accrualId: hash(83),
    claimId: hash(84),
    claimRightId,
    controlEvidenceHash: hash(85),
  };
}

function partnerPolicy(providerId = hash(24)) {
  return {
    kind: GEN2_FEE_POLICY_KIND.PartnerTemplate,
    providerId,
    partnerStatusId: PARTNER_STATUS_ACTIVE_ID,
    modelId: hash(20),
    modelVersion: hash(21),
    templateId: hash(22),
    templateVersion: hash(23),
    marketPathId: hash(25),
    partnerRepositoryId: hash(26),
    partnerCommitId: hash(27),
    partnerRuntimeCodeSetHash: hash(28),
    totalFeeBps: "20",
    nativeCustomFeeBps: "0",
    partner: leg(15, address(200), hash(86)),
    programmable: leg(5, PROGRAMMABLE_RECIPIENT, hash(87)),
    activationVersion: hash(88),
    activationBlock: "1",
    paused: false,
    retired: false,
    publicPolicyBindingHash: hash(89),
    claimIsolationEvidenceHash: hash(90),
    accountingSafetyEvidenceHash: hash(91),
    verificationEvidenceHash: hash(92),
  };
}

function zeroLeg() {
  return {
    shareBps: "0",
    recipient: ZERO_ADDRESS,
    currency: ZERO_ADDRESS,
    chargeModeId: ZERO_HASH,
    basisId: ZERO_HASH,
    roundingId: ZERO_HASH,
    accrualId: ZERO_HASH,
    claimId: ZERO_HASH,
    claimRightId: ZERO_HASH,
    controlEvidenceHash: ZERO_HASH,
  };
}

function noMarketPolicy() {
  return {
    kind: GEN2_FEE_POLICY_KIND.NoQualifyingMarket,
    providerId: ZERO_HASH,
    partnerStatusId: ZERO_HASH,
    modelId: ZERO_HASH,
    modelVersion: ZERO_HASH,
    templateId: ZERO_HASH,
    templateVersion: ZERO_HASH,
    marketPathId: ZERO_HASH,
    partnerRepositoryId: ZERO_HASH,
    partnerCommitId: ZERO_HASH,
    partnerRuntimeCodeSetHash: ZERO_HASH,
    totalFeeBps: "0",
    nativeCustomFeeBps: "0",
    partner: zeroLeg(),
    programmable: zeroLeg(),
    activationVersion: ZERO_HASH,
    activationBlock: "0",
    paused: false,
    retired: false,
    publicPolicyBindingHash: hash(89),
    claimIsolationEvidenceHash: hash(90),
    accountingSafetyEvidenceHash: hash(91),
    verificationEvidenceHash: hash(92),
  };
}

function partnerRecord() {
  const feePolicy = partnerPolicy();
  const feePolicyHash = deriveGen2FeePolicyHash(feePolicy);
  const authorization = {
    chainId: "1",
    registryGeneration: "2",
    configurationHash: ZERO_HASH,
    providerId: feePolicy.providerId,
    modelId: feePolicy.modelId,
    modelVersion: feePolicy.modelVersion,
    templateId: feePolicy.templateId,
    templateVersion: feePolicy.templateVersion,
    modelRepositoryId: hash(7),
    modelSourceCommitId: hash(8),
    factorySourceRepositoryId: hash(101),
    factorySourceCommitId: hash(102),
    factory: address(103),
    factoryRuntimeCodeHash: hash(104),
    launchRuntimeCodeSetHash: hash(17),
    permissionsHash: hash(14),
    feePolicyHash,
    validAfterBlock: "1",
    expiresAtBlock: "1000",
    evidenceHash: hash(105),
  };
  authorization.configurationHash = deriveGen2PartnerConfigurationHash(
    authorization,
  );
  const preimage = {
    chainId: "1",
    registryGeneration: "2",
    launchId: hash(1),
    projectId: hash(2),
    approvalId: hash(3),
    approvalBindingHash: ZERO_HASH,
    repositoryId: authorization.modelRepositoryId,
    commitId: authorization.modelSourceCommitId,
    sourceCommitment: hash(9),
    buildCommitment: hash(10),
    artifactSetHash: hash(11),
    deploymentConfigurationHash: hash(12),
    configurationHash: authorization.configurationHash,
    permissionsHash: authorization.permissionsHash,
    deploymentId: hash(15),
    deploymentSetHash: hash(16),
    runtimeCodeSetHash: authorization.launchRuntimeCodeSetHash,
    primaryContract: address(18),
    primaryRuntimeCodeHash: hash(19),
    launchWallet: address(19),
    modelId: feePolicy.modelId,
    modelVersion: feePolicy.modelVersion,
    templateId: feePolicy.templateId,
    templateVersion: feePolicy.templateVersion,
    providerId: feePolicy.providerId,
    builderAttributionHash: hash(29),
    originHash: hash(30),
    assetSetHash: hash(31),
    marketSetHash: hash(32),
    marketPathId: feePolicy.marketPathId,
    capabilitySetHash: hash(33),
    reviewPolicyHash: hash(34),
    securityReviewHash: hash(35),
    reviewResultId: hash(36),
    reviewDeploymentBindingHash: ZERO_HASH,
    feePolicyHash,
    finalityPolicyHash: hash(37),
  };
  preimage.approvalBindingHash = deriveGen2ApprovalBindingHash(preimage);
  preimage.reviewDeploymentBindingHash =
    deriveGen2ReviewDeploymentBindingHash(preimage);
  const registeredRecordCommitment =
    deriveGen2RegisteredRecordCommitment(preimage);
  return {
    $schema:
      "https://developers.programmable.family/schemas/v2/custom-launch-registry-record-v4.schema.json",
    schemaVersion: REGISTRY_V4_PRODUCER_SCHEMA,
    chainId: "1",
    registryGeneration: "2",
    registeredRecordPreimage: preimage,
    registeredRecordComponentHashes:
      deriveGen2RegisteredRecordComponentHashes(preimage),
    registeredRecordCommitment,
    registrationBindingHash: deriveGen2RegistrationBindingHash(preimage),
    feePolicy,
    partnerFactoryAuthorization: authorization,
  };
}

function partnerExecutionRecord() {
  const record = partnerRecord();
  const authorization = record.partnerFactoryAuthorization;
  const origin = registryV4Envelope.rawRecord.registryOrigin;
  const partnerRegistry = origin.releaseContracts.partnerFactoryRegistry;
  const topic = (id) => origin.eventBindings.find((event) => event.id === id).topic0;
  const transactionHash = hash(920);
  const blockHash = hash(921);
  const authorizedEvent = {
    emitterRole: "partnerFactoryRegistry",
    emitterAddress: partnerRegistry.address,
    observedRuntimeCodeHash: partnerRegistry.runtimeCodeHash,
    topic0: topic("partnerFactoryAuthorized"),
    indexedTopics: [],
    data: "0x",
    transactionHash,
    blockNumber: "90",
    blockHash,
    transactionIndex: 3,
    logIndex: 4,
    configurationHash: authorization.configurationHash,
    providerId: authorization.providerId,
    factory: authorization.factory,
    modelId: authorization.modelId,
    modelVersion: authorization.modelVersion,
    templateId: authorization.templateId,
    templateVersion: authorization.templateVersion,
    validAfterBlock: authorization.validAfterBlock,
    expiresAtBlock: authorization.expiresAtBlock,
    evidenceHash: authorization.evidenceHash,
  };
  Object.assign(
    authorizedEvent,
    deriveRegistryPartnerFactoryAuthorizedAbiProofV4(authorizedEvent),
  );
  const sourceBoundEvent = {
    emitterRole: "partnerFactoryRegistry",
    emitterAddress: partnerRegistry.address,
    observedRuntimeCodeHash: partnerRegistry.runtimeCodeHash,
    topic0: topic("partnerFactorySourceBound"),
    indexedTopics: [],
    data: "0x",
    transactionHash,
    blockNumber: "90",
    blockHash,
    transactionIndex: 3,
    logIndex: 5,
    configurationHash: authorization.configurationHash,
    modelRepositoryId: authorization.modelRepositoryId,
    modelSourceCommitId: authorization.modelSourceCommitId,
    factorySourceRepositoryId: authorization.factorySourceRepositoryId,
    factorySourceCommitId: authorization.factorySourceCommitId,
    factoryRuntimeCodeHash: authorization.factoryRuntimeCodeHash,
    launchRuntimeCodeSetHash: authorization.launchRuntimeCodeSetHash,
    permissionsHash: authorization.permissionsHash,
    feePolicyHash: authorization.feePolicyHash,
  };
  Object.assign(
    sourceBoundEvent,
    deriveRegistryPartnerFactorySourceBoundAbiProofV4(sourceBoundEvent),
  );
  return {
    ...record,
    atomicExecutionProof: null,
    registryOrigin: {
      registrationBlockNumber: "100",
      releaseContracts: structuredClone(origin.releaseContracts),
    },
    partnerFactoryAuthorization: {
      ...authorization,
      revoked: false,
      stateObservedAtBlock: "95",
      stateProofHash: `sha256:${"9".repeat(64)}`,
      authorizedEvent,
      sourceBoundEvent,
    },
  };
}

function resealContractRecord(record) {
  const preimage = record.registeredRecordPreimage;
  preimage.approvalBindingHash = deriveGen2ApprovalBindingHash(preimage);
  preimage.reviewDeploymentBindingHash =
    deriveGen2ReviewDeploymentBindingHash(preimage);
  record.registeredRecordComponentHashes =
    deriveGen2RegisteredRecordComponentHashes(preimage);
  record.registeredRecordCommitment =
    deriveGen2RegisteredRecordCommitment(preimage);
  record.registrationBindingHash = deriveGen2RegistrationBindingHash(preimage);
  return record;
}

function noMarketProviderRecord() {
  const record = partnerRecord();
  record.feePolicy = noMarketPolicy();
  const feePolicyHash = deriveGen2FeePolicyHash(record.feePolicy);
  record.registeredRecordPreimage.feePolicyHash = feePolicyHash;
  record.registeredRecordPreimage.marketPathId = ZERO_HASH;
  record.partnerFactoryAuthorization.feePolicyHash = feePolicyHash;
  record.partnerFactoryAuthorization.configurationHash =
    deriveGen2PartnerConfigurationHash(record.partnerFactoryAuthorization);
  record.registeredRecordPreimage.configurationHash =
    record.partnerFactoryAuthorization.configurationHash;
  return resealContractRecord(record);
}

const GEN2_EVENT_EMITTERS = {
  approvalAuthorized: "registry",
  partnerFactoryAuthorized: "partnerFactoryRegistry",
  partnerFactorySourceBound: "partnerFactoryRegistry",
  partnerFactoryRevoked: "partnerFactoryRegistry",
  registered: "registry",
  provenance: "registry",
  review: "registry",
  attribution: "registry",
  feePolicy: "registry",
  feeScope: "registry",
  feeEvidence: "registry",
  atomicExecuted: "atomicRegistrar",
  finalized: "registry",
  corrected: "registry",
  revoked: "registry",
};

function gen2Generation() {
  const contractSet = {
    registry: {
      address: address(301),
      runtimeCodeKeccak256: hash(301),
      abiUrl: "https://developers.programmable.family/abis/programmable-custom-registry-v2.json",
    },
    partnerFactoryRegistry: {
      address: address(302),
      runtimeCodeKeccak256: hash(302),
      abiUrl: "https://developers.programmable.family/abis/programmable-custom-partner-factory-registry-v2.json",
    },
    feePolicyVerifier: {
      address: address(303),
      runtimeCodeKeccak256: hash(303),
      abiUrl: "https://developers.programmable.family/abis/programmable-custom-fee-policy-verifier-v2.json",
    },
    atomicRegistrar: {
      address: address(304),
      runtimeCodeKeccak256: hash(304),
      abiUrl: "https://developers.programmable.family/abis/programmable-custom-atomic-registrar-v2.json",
    },
  };
  const events = Object.fromEntries(
    Object.entries(GEN2_EVENT_EMITTERS).map(([id, emitterRole], index) => [
      id,
      {
        signature: `${id}(bytes32)`,
        topic0: hash(400 + index),
        emitterRole,
      },
    ]),
  );
  return {
    chainId: 1,
    caip2: "eip155:1",
    generation: "2",
    status: "live",
    address: contractSet.registry.address,
    runtimeCodeKeccak256: contractSet.registry.runtimeCodeKeccak256,
    startBlock: "1",
    endBlock: null,
    authorizedWriters: [address(305)],
    registryEventSetHash: `sha256:${"4".repeat(64)}`,
    events,
    abiUrl: contractSet.registry.abiUrl,
    contractSet,
    finalityConfirmations: 2,
  };
}

function v4FeedItem(envelope = registryV4Envelope) {
  return {
    generation: "1",
    projectionKey:
      `custom:${envelope.rawRecord.registryOrigin.caip2}:${envelope.projection.launchId}`,
    ...structuredClone(envelope),
  };
}

function v4Manifest(envelope = registryV4Envelope) {
  const origin = envelope.projection.origin;
  const contractSet = Object.fromEntries(Object.entries(origin.releaseContracts)
    .map(([role, contract]) => [role, {
      address: contract.address,
      runtimeCodeKeccak256: contract.runtimeCodeHash,
    }]));
  return {
    registryGenerations: [{
      status: "live",
      chainId: Number(envelope.rawRecord.registryOrigin.chainId),
      caip2: envelope.rawRecord.registryOrigin.caip2,
      address: origin.registryAddress,
      runtimeCodeKeccak256: origin.registryRuntimeCodeHash,
      startBlock: origin.registryStartBlock,
      endBlock: null,
      generation: origin.registryGeneration,
      registryEventSetHash: origin.registryEventSetHash,
      authorizedWriters: [
        ...origin.authorizedWriterSetEvidence.authorizedAddresses,
      ],
      events: {
        [origin.operation]: {
          emitterRole: "registry",
          topic0: origin.eventTopic0,
        },
      },
      contractSet,
    }],
  };
}

describe("Registry generation 2 contract parity", () => {
  test("pins the final Contract RC ABIs and canonical 15-event set", async () => {
    const artifacts = {
      registry: {
        abi: registryAbi,
        file: "../abis/candidates/programmable-custom-registry-v2.json",
        sha256: "7c5fe7d25cc874a319c3621435c31cd8f531a7abfcd7d5073fc163d10d60524f",
      },
      partnerFactoryRegistry: {
        abi: partnerFactoryRegistryAbi,
        file: "../abis/candidates/programmable-custom-partner-factory-registry-v2.json",
        sha256: "054b5d2740314335d202e37d405273cbb9d0922398cbc2909e7cb7cee845061e",
      },
      feePolicyVerifier: {
        abi: feePolicyVerifierAbi,
        file: "../abis/candidates/programmable-custom-fee-policy-verifier-v2.json",
        sha256: "0bc9bdda4a1e78e2c498568ddfa164b35c3cb5c297f563dd4771935e75304f62",
      },
      atomicRegistrar: {
        abi: atomicRegistrarAbi,
        file: "../abis/candidates/programmable-custom-atomic-registrar-v2.json",
        sha256: "a053f14e59c3c54a0dad47e6e772ba411c7659a46eab3313a6c124260ebcff1f",
      },
    };
    for (const [role, artifact] of Object.entries(artifacts)) {
      const bytes = await readFile(new URL(artifact.file, import.meta.url));
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        artifact.sha256,
        role,
      );
    }
    const eventBytes = await readFile(new URL(
      "../fixtures/v2/custom-registry-event-set-v2.candidate.json",
      import.meta.url,
    ));
    assert.equal(
      createHash("sha256").update(eventBytes).digest("hex"),
      "0c6c32e0db5eb55b8e0bd148a6206e0c0ab8605cda75338f3a556e75cd3eff1a",
    );
    assert.equal(registryEventSet.events.length, 15);
    assert.equal(
      registryEventSet.eventSetHash,
      "sha256:bcff2958529fecaa7ef8c4c654389829bfb7dd61a3246f0d681cf7db0a42a58c",
    );
    assert.equal(
      registryEventSet.eventSetHash,
      canonicalSha256(registryEventSet.domain, { events: registryEventSet.events }),
    );
    for (const event of registryEventSet.events) {
      const abiEvent = artifacts[event.emitter].abi.find((entry) =>
        entry.type === "event" &&
        entry.name === event.signature.slice(0, event.signature.indexOf("("))
      );
      assert.ok(abiEvent, event.id);
      const signature = `${abiEvent.name}(${abiEvent.inputs
        .map(({ type }) => type)
        .join(",")})`;
      assert.equal(signature, event.signature, event.id);
      assert.equal(
        keccak256(new TextEncoder().encode(signature)),
        event.topic0,
        event.id,
      );
    }

    const tuple = registryAbi.find((entry) =>
      entry.type === "function" &&
      entry.name === "computeRegisteredRecordCommitment"
    ).inputs[0].components;
    const expectedFixedFields = REGISTRY_GEN2_BINDING_FIELDS
      .filter((field) => field !== "feePolicyHash")
      .concat("registeredRecordCommitment");
    assert.equal(tuple.length, 38);
    assert.deepEqual(
      tuple.slice(0, 37).map(({ name }) => name),
      expectedFixedFields,
    );
    assert.equal(tuple[37].name, "feePolicy");
    assert.equal(tuple[37].type, "tuple");
    assert.ok(feePolicyVerifierAbi.some((entry) =>
      entry.type === "function" && entry.name === "verify"));
    assert.equal(registryReleaseCandidate.status, "release_candidate");
    assert.equal(registryReleaseCandidate.registryGeneration, 2);
    assert.equal(registryReleaseCandidate.contractIntegrationAbiVersion, 1);
    assert.equal(registryReleaseCandidate.minimumSupportedPublicApiVersion, 2);
    assert.equal(registryReleaseCandidate.registryRecordProducerVersion, 4);
    assert.equal(
      registryReleaseCandidate.release.artifactSetHash,
      "sha256:1b89c9f5ac64cd0d3193039d02a1bafaafd31da272c84575e5d5aa6ff6c7474f",
    );
    const publicReleaseCandidateBytes = await readFile(new URL(
      "../fixtures/v2/custom-registry-generation-2.release-candidate.json",
      import.meta.url,
    ));
    assert.equal(
      createHash("sha256").update(publicReleaseCandidateBytes).digest("hex"),
      "ab460890036d37fadb07770a52225a8bff49f8506b40fcf46bf857792bae1af0",
    );
    assert.equal(
      registryReleaseCandidate.release.publicSubmissionsEnabled,
      false,
    );
    assert.ok(Object.values(registryReleaseCandidate.contracts).every(
      (contract) => contract.address === null && contract.startBlock === null &&
        contract.deploymentTransactionHash === null &&
        contract.runtimeCodeHash === null && contract.sourceVerified === false,
    ));
  });

  test("validates the explicit v4 producer schema and all exact bindings", async () => {
    assert.equal(REGISTRY_GEN2_BINDING_FIELDS.length, 37);
    assert.equal(validateRegistryContractRecordV4(partnerRecord()), true);
    assert.equal(
      validateRegistryContractRecordV4(registryV4Envelope.rawRecord),
      true,
    );
    assert.equal(validateRegistryProjectionEnvelopeV4(registryV4Envelope), true);
    const schemas = await createSchemaRegistry("v2");
    const validate = schemas.validator(
      "custom-launch-registry-record-v4.schema.json",
    );
    assert.equal(
      validate(registryV4Envelope.rawRecord),
      true,
      JSON.stringify(validate.errors),
    );
    assert.equal(
      registryV4Envelope.rawRecordHash,
      "sha256:ec5379c7cc828075c2c05c258aebc87c0ac5951205aeb40d8661501c6b901f3f",
    );
    assert.equal(
      registryV4Envelope.projectionDigest,
      "sha256:0a20b4b7acfa55f2238b3901759a88eee0247346e9597d2e9d71274f918f5172",
    );
  });

  test("ingests the exact Read Model v4 envelope without re-deriving public fields", async () => {
    const item = v4FeedItem();
    assert.equal(validateRegistryCustomFeedItemV4(item), true);
    const normalized = normalizeRegistryCustomItemV4(item);
    assert.deepEqual(normalized.assets, item.projection.publicProjection.assets);
    assert.deepEqual(normalized.capabilities,
      item.projection.publicProjection.capabilities);
    assert.equal(normalized.registryRecordSchemaVersion,
      "programmable.custom-launch-registry-record.v4");
    assert.equal(normalized.registryOrigin.registryGeneration, "2");
    assert.equal(normalized.launch.finality, "observed");
    assert.equal(normalized.launch.confirmedAt, null);
    assert.deepEqual(
      normalized.extensions["programmable/registry-v4"].eventIndexedTopics,
      item.projection.origin.eventIndexedTopics,
    );
    assert.deepEqual(
      normalized.extensions["programmable/registry-v4"].eventPayload,
      item.projection.origin.eventPayload,
    );
    assert.equal(
      normalized.extensions["programmable/registry-v4"].latestRecordHash,
      item.projection.origin.latestRecordHash,
    );
    assert.equal(
      normalized.extensions["programmable/registry-v4"].transitionCheckpoint,
      null,
    );
    assert.deepEqual(
      normalized.extensions["programmable/registry-v4"]
        .authorizedWriterSetEvidence,
      item.projection.origin.authorizedWriterSetEvidence,
    );
    assert.equal(
      normalized.extensions["programmable/registry-v4"]
        .authorizedWriterSetEvidence.eventCaller,
      null,
    );
    assert.equal(
      Object.hasOwn(
        normalized.extensions["programmable/registry-v4"],
        "registryWriter",
      ),
      false,
    );
    assert.deepEqual(
      normalized.extensions["programmable/registry-v4"].atomicExecutionProof,
      item.rawRecord.atomicExecutionProof,
    );
    assert.equal(
      Object.hasOwn(
        normalized.extensions["programmable/registry-v4"].atomicExecutionProof,
        "requestHash",
      ),
      false,
    );
    assert.equal(isV2PublicLaunch(normalized, v4Manifest()), true);
    const schemas = await createSchemaRegistry("v2");
    const validate = schemas.validator("launch.schema.json");
    assert.equal(
      validate(publicLaunchV2(normalized)),
      true,
      JSON.stringify(validate.errors),
    );
  });

  test("fails closed on malformed v4 trust roots, proofs and public projections", () => {
    for (const [name, mutate] of [
      ["runtime", (value) => {
        value.rawRecord.registryOrigin.releaseContracts.registry
          .runtimeCodeHash = hash(980);
      }],
      ["atomic proof", (value) => {
        value.rawRecord.atomicExecutionProof.indexedTopics[0] = hash(981);
      }],
      ["atomic data", (value) => {
        value.rawRecord.atomicExecutionProof.data = "0x00";
      }],
      ["atomic log order", (value) => {
        value.rawRecord.atomicExecutionProof.logIndex -= 1;
      }],
      ["old atomic proof field", (value) => {
        value.rawRecord.atomicExecutionProof.requestHash = hash(981);
      }],
      ["event topic", (value) => {
        value.projection.origin.eventTopic0 = hash(982);
      }],
      ["indexed event proof", (value) => {
        value.projection.origin.eventIndexedTopics[0] = hash(983);
      }],
      ["event data proof", (value) => {
        value.projection.origin.eventData = `${value.projection.origin.eventData.slice(0, -2)}00`;
      }],
      ["event payload", (value) => {
        value.projection.origin.eventPayload.approvalId = hash(984);
      }],
      ["event payload extension", (value) => {
        value.projection.origin.eventPayload.untrusted = true;
      }],
      ["forged caller", (value) => {
        value.projection.origin.authorizedWriterSetEvidence.eventCaller =
          address(999);
      }],
      ["old registry writer claim", (value) => {
        value.projection.origin.registryWriter = address(999);
      }],
      ["forged authorized set", (value) => {
        value.projection.origin.authorizedWriterSetEvidence
          .authorizedAddresses[0] = address(999);
      }],
      ["latest revision", (value) => {
        value.projection.origin.latestRecordRevision = "2";
      }],
      ["latest record hash", (value) => {
        value.projection.origin.latestRecordHash = hash(985);
      }],
      ["registration transition checkpoint", (value) => {
        value.projection.origin.transitionSequence = "1";
        value.projection.origin.transitionCheckpoint = {
          chainId: "1",
          caip2: "eip155:1",
          registryGeneration: "2",
          registryAddress: value.projection.origin.registryAddress,
          lastTransitionSequence: "0",
        };
      }],
      ["public projection", (value) => {
        value.projection.publicProjection.model.id = "forged-model";
      }],
    ]) {
      const changed = structuredClone(registryV4Envelope);
      mutate(changed);
      const {
        schemaVersion: _schemaVersion,
        envelopeDigest: _envelopeDigest,
        ...producerPreimage
      } = changed.rawRecord;
      void _schemaVersion;
      void _envelopeDigest;
      changed.rawRecord.envelopeDigest = canonicalSha256(
        "programmable.custom-launch-registry-envelope-digest.v4",
        producerPreimage,
      );
      changed.rawRecordHash = canonicalSha256(
        changed.producerSchemaVersion,
        changed.rawRecord,
      );
      changed.projection.rawProducerRecord = structuredClone(changed.rawRecord);
      changed.projection.producerBinding.envelopeDigest =
        changed.rawRecord.envelopeDigest;
      changed.projection.producerBinding.rawRecordHash = changed.rawRecordHash;
      changed.projectionDigest = canonicalSha256(
        changed.projectionSchemaVersion,
        changed.projection,
      );
      assert.equal(validateRegistryProjectionEnvelopeV4(changed), false, name);
    }
  });

  test("binds both provider-factory logs to exact raw ABI data and order", () => {
    const baseline = partnerExecutionRecord();
    assert.equal(validateRegistryExecutionProofV4(baseline), true);
    for (const [name, mutate] of [
      ["authorized topic", (value) => {
        value.partnerFactoryAuthorization.authorizedEvent.indexedTopics[0] =
          hash(990);
      }],
      ["authorized data", (value) => {
        value.partnerFactoryAuthorization.authorizedEvent.data = "0x00";
      }],
      ["source-bound topic", (value) => {
        value.partnerFactoryAuthorization.sourceBoundEvent.indexedTopics[1] =
          hash(991);
      }],
      ["source-bound data", (value) => {
        value.partnerFactoryAuthorization.sourceBoundEvent.data = "0x00";
      }],
      ["log order", (value) => {
        value.partnerFactoryAuthorization.sourceBoundEvent.logIndex += 1;
      }],
    ]) {
      const changed = structuredClone(baseline);
      mutate(changed);
      assert.equal(validateRegistryExecutionProofV4(changed), false, name);
    }
  });

  test("requires head block minus observed block to meet the full finality depth", () => {
    function atDepth(depth) {
      const changed = structuredClone(registryV4Envelope);
      const finality = changed.projection.registryFinality;
      finality.status = "finalized";
      finality.canonicalHeadBlock = String(
        BigInt(finality.blockNumber) + BigInt(depth),
      );
      finality.confirmedAt = finality.observedAt;
      finality.finalizedAt = finality.observedAt;
      changed.projection.publicProjection.finality = structuredClone(finality);
      changed.projectionDigest = canonicalSha256(
        changed.projectionSchemaVersion,
        changed.projection,
      );
      return changed;
    }
    assert.equal(validateRegistryProjectionEnvelopeV4(atDepth(63)), false);
    assert.equal(validateRegistryProjectionEnvelopeV4(atDepth(64)), true);
  });

  test("keeps v3 on Gen1 and v4 on Gen2 without cross-generation acceptance", () => {
    const v4 = normalizeRegistryCustomItemV4(v4FeedItem());
    const manifestV4 = v4Manifest();
    assert.equal(isV2PublicLaunch(v4, manifestV4), true);

    const v3 = structuredClone(v4);
    delete v3.registryV4Envelope;
    v3.registryRecordSchemaVersion =
      "programmable.custom-launch-registry-record.v3";
    v3.registryOrigin.registryGeneration = "1";
    v3.extensions["programmable/registry-v3"] =
      v3.extensions["programmable/registry-v4"];
    delete v3.extensions["programmable/registry-v4"];
    const manifestV3 = structuredClone(manifestV4);
    manifestV3.registryGenerations[0].generation = "1";
    v3.extensions["programmable/registry-v3"].registryWriter =
      manifestV3.registryGenerations[0].authorizedWriters[0];
    assert.equal(isV2PublicLaunch(v3, manifestV3), true);

    const v4OnGen1 = structuredClone(v4);
    v4OnGen1.registryOrigin.registryGeneration = "1";
    assert.equal(isV2PublicLaunch(v4OnGen1, manifestV3), false);

    const v3OnGen2 = structuredClone(v3);
    v3OnGen2.registryOrigin.registryGeneration = "2";
    assert.equal(isV2PublicLaunch(v3OnGen2, manifestV4), false);

    const malformedV4 = structuredClone(v4);
    malformedV4.registryV4Envelope.projectionDigest =
      `sha256:${"0".repeat(64)}`;
    assert.equal(isV2PublicLaunch(malformedV4, manifestV4), false);
  });

  test("requires complete current high-water coverage after Gen2 activation", () => {
    const record = normalizeRegistryCustomItemV4(v4FeedItem());
    const manifest = v4Manifest();
    manifest.customRegistry = {
      status: "live",
      publicSubmissionsEnabled: false,
      generation: "2",
    };
    manifest.chains = [{ chainId: 1, status: "live" }];
    const source = {
      configured: true,
      status: "ready",
      sourceId: "programmable-custom-launch-registry-v4",
      completeness: "complete",
      freshness: "current",
      highWaterGeneration: "1",
    };
    const dataset = (customRegistry = source) => ({
      records: [record],
      status: {
        schemaVersion: "1.0.0",
        status: "ready",
        generatedAt: "2026-08-07T10:00:00.000Z",
        chainId: 1,
        coverage: {
          status: "complete",
          checkpoint: {
            blockNumber: 21_000_100,
            blockHash: hash(999),
            finality: "finalized",
          },
        },
        customRegistry,
        counts: { total: 1, classic: 0, custom: 1 },
        errors: [],
      },
    });
    const ready = projectV2Dataset(dataset(), manifest);
    assert.equal(ready.status.customRegistryPublication.activeGeneration, "2");
    assert.equal(ready.status.customRegistryPublication.requiresLiveSource, true);
    assert.equal(ready.status.customRegistryPublication.sourceReady, true);
    assert.equal(isV2DatasetPublishable(ready), true);

    for (const [name, change] of [
      ["missing", { ...source, status: "unavailable" }],
      ["stale", { ...source, freshness: "stale" }],
      ["incomplete", { ...source, completeness: "incomplete" }],
      ["high-water", { ...source, highWaterGeneration: "0" }],
    ]) {
      const blocked = projectV2Dataset(dataset(change), manifest);
      assert.equal(
        blocked.status.customRegistryPublication.sourceReady,
        false,
        name,
      );
      assert.equal(isV2DatasetPublishable(blocked), false, name);
      assert.equal(isV2DatasetPublishable(blocked, "classic"), true, name);
    }
  });

  test("changes the commitment for every one of the 37 preimage words", () => {
    const baseline = partnerRecord().registeredRecordPreimage;
    const commitment = deriveGen2RegisteredRecordCommitment(baseline);
    const addressFields = new Set(["primaryContract", "launchWallet"]);
    const decimalFields = new Set(["chainId", "registryGeneration"]);
    for (const field of REGISTRY_GEN2_BINDING_FIELDS) {
      const changed = structuredClone(baseline);
      changed[field] = addressFields.has(field)
        ? address(999)
        : decimalFields.has(field)
          ? field === "registryGeneration" ? "3" : "8453"
          : hash(999);
      assert.notEqual(
        deriveGen2RegisteredRecordCommitment(changed),
        commitment,
        field,
      );
    }
  });

  test("enforces provider-neutral 20 = 15 + 5 without a native overlay", () => {
    assert.match(deriveGen2FeePolicyHash(partnerPolicy(hash(500))), /^0x/);
    assert.match(deriveGen2FeePolicyHash(partnerPolicy(hash(501))), /^0x/);
    const mutations = [
      ["zero provider", (value) => { value.providerId = ZERO_HASH; }],
      ["wrong total", (value) => { value.totalFeeBps = "21"; }],
      ["wrong partner share", (value) => { value.partner.shareBps = "14"; }],
      ["wrong Programmable share", (value) => {
        value.programmable.shareBps = "6";
      }],
      ["native overlay", (value) => { value.nativeCustomFeeBps = "10"; }],
      ["shared recipient", (value) => {
        value.partner.recipient = PROGRAMMABLE_RECIPIENT;
      }],
      ["different basis", (value) => { value.partner.basisId = hash(700); }],
      ["shared claim right", (value) => {
        value.partner.claimRightId = value.programmable.claimRightId;
      }],
      ["paused", (value) => { value.paused = true; }],
    ];
    for (const [name, mutate] of mutations) {
      const changed = partnerPolicy();
      mutate(changed);
      assert.throws(() => deriveGen2FeePolicyHash(changed), undefined, name);
    }
  });

  test("keeps no-market economics at zero while authenticating provider attribution", () => {
    const providerRecord = noMarketProviderRecord();
    assert.notEqual(providerRecord.registeredRecordPreimage.providerId, ZERO_HASH);
    assert.equal(providerRecord.feePolicy.providerId, ZERO_HASH);
    assert.equal(validateRegistryContractRecordV4(providerRecord), true);

    const directRecord = noMarketProviderRecord();
    directRecord.registeredRecordPreimage.providerId = ZERO_HASH;
    directRecord.partnerFactoryAuthorization = null;
    resealContractRecord(directRecord);
    assert.equal(validateRegistryContractRecordV4(directRecord), true);

    const missingAuthorization = noMarketProviderRecord();
    missingAuthorization.partnerFactoryAuthorization = null;
    assert.equal(validateRegistryContractRecordV4(missingAuthorization), false);

    const fakeProvider = noMarketProviderRecord();
    fakeProvider.partnerFactoryAuthorization.providerId = hash(950);
    fakeProvider.partnerFactoryAuthorization.configurationHash =
      deriveGen2PartnerConfigurationHash(fakeProvider.partnerFactoryAuthorization);
    assert.equal(validateRegistryContractRecordV4(fakeProvider), false);

    const wrongFactoryFee = noMarketProviderRecord();
    wrongFactoryFee.partnerFactoryAuthorization.feePolicyHash = hash(951);
    wrongFactoryFee.partnerFactoryAuthorization.configurationHash =
      deriveGen2PartnerConfigurationHash(
        wrongFactoryFee.partnerFactoryAuthorization,
      );
    assert.equal(validateRegistryContractRecordV4(wrongFactoryFee), false);

    const wrongConfiguration = noMarketProviderRecord();
    wrongConfiguration.partnerFactoryAuthorization.configurationHash = hash(952);
    assert.equal(validateRegistryContractRecordV4(wrongConfiguration), false);
  });

  test("binds provider factory configuration to chain and Registry generation", () => {
    const record = partnerRecord();
    const authorization = record.partnerFactoryAuthorization;
    const baseline = deriveGen2PartnerConfigurationHash(authorization);
    assert.equal(validateGen2PartnerFactoryAuthorization(authorization), true);
    for (const [name, mutate] of [
      ["chain", (value) => { value.chainId = "8453"; }],
      ["provider", (value) => { value.providerId = hash(800); }],
      ["factory", (value) => { value.factory = address(801); }],
      ["factory runtime", (value) => { value.factoryRuntimeCodeHash = hash(802); }],
      ["launch runtime", (value) => { value.launchRuntimeCodeSetHash = hash(803); }],
      ["permissions", (value) => { value.permissionsHash = hash(804); }],
      ["fee", (value) => { value.feePolicyHash = hash(805); }],
    ]) {
      const changed = structuredClone(authorization);
      mutate(changed);
      assert.notEqual(deriveGen2PartnerConfigurationHash(changed), baseline, name);
    }
    const wrongGeneration = structuredClone(authorization);
    wrongGeneration.registryGeneration = "1";
    assert.throws(() => deriveGen2PartnerConfigurationHash(wrongGeneration));
    for (const mutate of [
      (value) => { value.factory = ZERO_ADDRESS; },
      (value) => { value.evidenceHash = ZERO_HASH; },
      (value) => { value.validAfterBlock = "0"; },
      (value) => { value.expiresAtBlock = "0"; },
      (value) => { value.validAfterBlock = "1001"; },
    ]) {
      const invalid = structuredClone(authorization);
      mutate(invalid);
      assert.equal(validateGen2PartnerFactoryAuthorization(invalid), false);
    }
  });

  test("fails publication closed without the exact four-contract Gen2 set", async () => {
    const generation = gen2Generation();
    const manifest = JSON.parse(await readFile(
      new URL("../deployments/ethereum-v2.json", import.meta.url),
      "utf8",
    ));
    manifest.customRegistry.status = "live";
    manifest.customRegistry.publicSubmissionsEnabled = true;
    manifest.customRegistry.address = generation.address;
    manifest.customRegistry.startBlock = generation.startBlock;
    manifest.customRegistry.generation = "2";
    manifest.customRegistry.eventSignature = generation.events.registered.signature;
    manifest.customRegistry.eventTopic = generation.events.registered.topic0;
    manifest.customRegistry.abiUrl = generation.abiUrl;
    manifest.customRegistry.finalityConfirmations = 2;
    manifest.registryGenerations = [generation];
    assert.deepEqual(validateManifestSemantics(manifest), []);
    const schemas = await createSchemaRegistry("v2");
    const validateManifest = schemas.validator("manifest.schema.json");
    assert.equal(
      validateManifest(manifest),
      true,
      JSON.stringify(validateManifest.errors),
    );

    const record = {
      registryOrigin: {
        chainId: "1",
        caip2: "eip155:1",
        registryAddress: generation.address,
        registryStartBlock: "1",
        registryGeneration: "2",
        registryEventSetHash: generation.registryEventSetHash,
        registrationBlockNumber: "2",
      },
      extensions: {
        "programmable/registry-v4": {
          registryRuntimeCodeHash: generation.runtimeCodeKeccak256,
          authorizedWriterSetEvidence: {
            operationRole: "atomicRegistrar",
            authorizedAddresses: [generation.contractSet.atomicRegistrar.address],
            eventCaller: null,
            callerIdentityStatus: "not-emitted-by-registry-abi",
            authorizationBasis:
              "atomic-registrar-runtime-and-same-transaction-event",
          },
          operation: "registered",
          eventTopic0: generation.events.registered.topic0,
          registryGenerationContractSet: structuredClone(generation.contractSet),
        },
      },
    };
    assert.equal(registryOriginMatchesManifest(record, manifest), true);

    for (const [name, mutate] of [
      ["missing factory Registry", (value) => {
        delete value.contractSet.partnerFactoryRegistry;
      }],
      ["wrong Registry runtime", (value) => {
        value.contractSet.registry.runtimeCodeKeccak256 = hash(900);
      }],
      ["wrong event emitter", (value) => {
        value.events.registered.emitterRole = "atomicRegistrar";
      }],
    ]) {
      const changed = structuredClone(generation);
      mutate(changed);
      const changedManifest = structuredClone(manifest);
      changedManifest.registryGenerations = [changed];
      assert.ok(validateManifestSemantics(changedManifest).length > 0, name);
    }

    const wrongEvidence = structuredClone(record);
    wrongEvidence.extensions["programmable/registry-v4"]
      .registryGenerationContractSet.partnerFactoryRegistry.runtimeCodeKeccak256 =
        hash(901);
    assert.equal(registryOriginMatchesManifest(wrongEvidence, manifest), false);
  });
});
