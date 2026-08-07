import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { canonicalSha256 } from "../server/canonical.js";
import { keccak256 } from "../server/keccak.js";
import {
  deriveOnchainFeePolicyHashV1,
  derivePublicFeePolicyBindingV1,
  deriveRegisteredRecordComponentHashesV1,
  deriveRegisteredRecordCommitmentV1,
  deriveRegistrationBindingHashV1,
  deriveVerifiedReviewEvidenceHashV1,
  normalizeRegistryCustomItemV3,
  validateRegistryCustomFeedItemV3,
  validateRegisteredRecordBindingsV1,
} from "../server/registry-v3.js";
import goldenRecord from
  "../fixtures/v2/custom-launch-registry-record-v3.golden.json" with { type: "json" };
import registryAbi from
  "../abis/candidates/programmable-custom-registry-v1.json" with { type: "json" };
import registryEventSet from
  "../fixtures/v2/custom-registry-event-set-v1.candidate.json" with { type: "json" };

function projectionItem(producerValue = goldenRecord) {
  const producer = structuredClone(producerValue);
  const feePolicy = structuredClone(producer.feePolicy);
  feePolicy.programmableRecipient.value =
    feePolicy.programmableRecipient.value.toLowerCase();
  if (feePolicy.partnerRecipient !== null) {
    feePolicy.partnerRecipient.value =
      feePolicy.partnerRecipient.value.toLowerCase();
  }
  const review = producer.verifiedReview;
  const record = {
    schemaVersion: "programmable.custom-launch-projection-record.v3",
    platformId: "programmable",
    category: "custom",
    publicLabel: "Programmable Custom",
    launchId: producer.launchId,
    projectId: producer.projectId,
    caip2: producer.registryOrigin.caip2,
    chainId: producer.registryOrigin.chainId,
    model: structuredClone(producer.model),
    template: structuredClone(producer.template),
    partner: structuredClone(producer.partner),
    builderAttribution: null,
    origin: {
      kind: "programmable-custom-registry-v3",
      registryLaunchIdRaw: producer.registryOrigin.registryLaunchIdRaw,
      registryProjectIdRaw: `0x${producer.projectId.slice(7)}`,
      registryGeneration: producer.registryOrigin.registryGeneration,
      registryAddress: producer.registryOrigin.registryAddress.toLowerCase(),
      registryRuntimeCodeHash: `0x${"9".repeat(64)}`,
      registryWriter: "0x7777777777777777777777777777777777777777",
      operation: "finalized",
      eventTopic0:
        "0xab930c1c165bba36257b8079ae38b6869f604910f6ffa40c956e31eb1b8ce38f",
      transactionHash: producer.registryOrigin.registrationTransactionHash,
      blockNumber: producer.registryOrigin.registrationBlockNumber,
      blockHash: producer.registryOrigin.registrationBlockHash,
      transactionIndex: Number(
        producer.registryOrigin.registrationTransactionIndex,
      ),
      logIndex: Number(producer.registryOrigin.registrationLogIndex),
      onchainTimestamp: producer.finality.onchainTimestamp,
      registeredRecordHash: producer.registeredRecordCommitment,
      latestOnchainRecordHash: producer.registeredRecordCommitment,
      previousOnchainRecordHash: null,
      eventBinding: {},
    },
    rawProducerRecord: producer,
    producerBinding: {
      schemaVersion: producer.schemaVersion,
      envelopeDigest: producer.envelopeDigest,
      rawRecordHash: canonicalSha256(producer.schemaVersion, producer),
    },
    approvalBinding: Object.fromEntries([
      "applicationId", "projectId", "approvalId", "repositoryId",
      "repositoryUri", "commitObjectId", "treeObjectId", "sourceCommitment",
      "buildCommitment", "artifactSetHash", "configurationCommitment",
      "launchWalletBindingHash", "chainProfileHash", "decisionReceiptDigest",
    ].map((field) => [field, producer.approvalBinding[field]])),
    deploymentBinding: {
      launchArtifactCommitmentHash:
        producer.deploymentBinding.launchArtifactCommitmentHash,
      artifactManifestHash: producer.deploymentBinding.artifactManifestHash,
      artifactOutputSetHash: producer.deploymentBinding.artifactOutputSetHash,
      deploymentCalldataHash: producer.deploymentBinding.deploymentCalldataHash,
      contracts: producer.deploymentBinding.contracts.map((contract) => ({
        address: contract.address.value.toLowerCase(),
        runtimeCodeHash: contract.runtimeCodeKeccak256,
        role: contract.role,
      })),
      runtimeMatch: true,
      verificationEvidenceHash:
        producer.deploymentBinding.verificationEvidenceHash,
    },
    launch: {
      creator: null,
      launchWallet: producer.launchingWallet.value.toLowerCase(),
      transactionHash: producer.finality.transactionHash,
      blockNumber: producer.finality.blockNumber,
      blockHash: producer.finality.blockHash,
      transactionIndex: Number(producer.finality.transactionIndex),
      logIndex: Number(producer.finality.logIndex),
      onchainTimestamp: producer.finality.onchainTimestamp,
    },
    assets: [],
    markets: [],
    capabilities: structuredClone(producer.capabilities),
    mechanisms: structuredClone(producer.mechanisms),
    feePolicy,
    securityReview: {
      status: review.status === "verified" ? "reviewed" : review.status,
      policyVersion: review.policyVersion,
      policyCommitment: review.policyCommitment,
      repositoryUri: producer.approvalBinding.repositoryUri,
      commitObjectId: review.commitObjectId,
      sourceCommitment: review.sourceCommitment,
      buildCommitment: review.buildCommitment,
      artifactSetHash: review.artifactSetHash,
      runtimeCodeHashes: [...review.runtimeCodeKeccak256],
      configurationCommitment: review.configurationCommitment,
      authorities: structuredClone(
        producer.postLaunchAuthorityInventory.authorities,
      ),
      upgradeability: {
        kind: review.upgradeability,
        evidenceHash: review.upgradeabilityEvidenceHash,
      },
      pause: {
        authority: review.pauseAuthority,
        evidenceHash: review.pauseAuthorityEvidenceHash,
      },
      custody: {
        kind: review.custody,
        evidenceHash: review.custodyEvidenceHash,
      },
      dependencies: structuredClone(review.dependencies),
      findings: structuredClone(review.findings),
      reviewedAt: review.reviewedAt,
      reviewerType: review.reviewerType,
      deploymentBindingHash: review.deploymentBindingHash,
      supersededBy: review.supersededBy,
      revokedAt: review.revokedAt,
      revocationEvidenceHash: review.revocationEvidenceHash,
    },
    programmableVerified: true,
    presentation: {
      description: null, image: null, website: null, x: null, telegram: null,
      discord: null, github: null, docs: null, extensions: {},
    },
    finality: {
      ...producer.finality,
      transactionIndex: Number(producer.finality.transactionIndex),
      logIndex: Number(producer.finality.logIndex),
    },
    registryFinality: {
      status: "finalized",
      observedAt: producer.finality.observedAt,
      confirmedAt: producer.finality.confirmedAt,
      finalizedAt: producer.finality.finalizedAt,
      orphanedAt: null,
      canonicalHeadBlock: producer.finality.blockNumber,
      canonicalHeadHash: producer.finality.blockHash,
    },
    lifecycle: {
      status: "finalized",
      registryGeneration: producer.registryOrigin.registryGeneration,
      registeredAt: producer.lifecycle.registeredAt,
      correctedAt: null,
      revokedAt: null,
      revocationEvidenceHash: null,
      supersedesProjectionDigest: null,
      supersededByProjectionDigest: null,
    },
  };
  return {
    generation: "1",
    projectionKey: `custom:${record.caip2}:${record.launchId}`,
    projectionDigest: canonicalSha256(record.schemaVersion, record),
    record,
  };
}

function resealProjectionItem(item) {
  const producer = item.record.rawProducerRecord;
  const {
    schemaVersion: _schemaVersion,
    envelopeDigest: _envelopeDigest,
    ...envelopePreimage
  } = producer;
  producer.envelopeDigest = canonicalSha256(
    "programmable.custom-launch-registry-envelope-digest.v3",
    envelopePreimage,
  );
  item.record.producerBinding.envelopeDigest = producer.envelopeDigest;
  item.record.producerBinding.rawRecordHash = canonicalSha256(
    producer.schemaVersion,
    producer,
  );
  item.projectionDigest = canonicalSha256(
    item.record.schemaVersion,
    item.record,
  );
}

describe("Canonical Custom Registry v3 seam", () => {
  test("pins the non-live Registry candidate ABI to its ordered event set", () => {
    assert.equal(registryEventSet.events.length, 10);
    assert.equal(
      registryEventSet.eventSetHash,
      canonicalSha256(registryEventSet.domain, {
        events: registryEventSet.events,
      }),
    );
    const abiEvents = new Map(
      registryAbi
        .filter((entry) => entry.type === "event")
        .map((entry) => [entry.name, entry]),
    );
    for (const event of registryEventSet.events) {
      const eventName = event.signature.slice(0, event.signature.indexOf("("));
      const abiEvent = abiEvents.get(eventName);
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
  });

  test("matches the Solidity ABI registered-record and identity golden vector", () => {
    const commitment = deriveRegisteredRecordCommitmentV1({
      scopeAndApprovalHash: `0x${"11".repeat(32)}`,
      sourceAndDeploymentHash: `0x${"22".repeat(32)}`,
      attributionHash: `0x${"33".repeat(32)}`,
      reviewHash: `0x${"44".repeat(32)}`,
      feePolicyHash: `0x${"55".repeat(32)}`,
      finalityPolicyHash: `0x${"66".repeat(32)}`,
    });
    assert.equal(
      commitment,
      "0xb3d24d3567fbeb2096654435c358ef31de250a2753fd7c5dbd7eb3bbc3bd67a0",
    );
    assert.equal(
      deriveRegistrationBindingHashV1(commitment),
      "0x8f1132fb9f4edb9150c045a6a04ed5a9bf00a7d19b730f118a20ab4243260d1d",
    );
  });

  test("changes the immutable commitment when any component is substituted", () => {
    const components = {
      scopeAndApprovalHash: `0x${"11".repeat(32)}`,
      sourceAndDeploymentHash: `0x${"22".repeat(32)}`,
      attributionHash: `0x${"33".repeat(32)}`,
      reviewHash: `0x${"44".repeat(32)}`,
      feePolicyHash: `0x${"55".repeat(32)}`,
      finalityPolicyHash: `0x${"66".repeat(32)}`,
    };
    const canonical = deriveRegisteredRecordCommitmentV1(components);
    for (const field of Object.keys(components)) {
      assert.notEqual(
        deriveRegisteredRecordCommitmentV1({
          ...components,
          [field]: `0x${"77".repeat(32)}`,
        }),
        canonical,
        field,
      );
    }
  });

  test("recomputes the public security review from every immutable field", () => {
    const review = structuredClone(goldenRecord.verifiedReview);
    const immutableHash = deriveVerifiedReviewEvidenceHashV1(review);
    assert.equal(immutableHash, review.reviewEvidenceHash);
    const mutations = [
      ["upgradeability", (value) => { value.upgradeability = "proxy"; }],
      ["pause authority", (value) => { value.pauseAuthority = "bounded"; }],
      ["custody", (value) => { value.custody = "bounded"; }],
      ["authorities", (value) => {
        value.authoritiesEvidenceHash = `sha256:${"1".repeat(64)}`;
      }],
      ["dependencies", (value) => { value.dependencies.push({
        id: "oracle-a",
        kind: "oracle",
        controller: null,
        runtimeCodeKeccak256: null,
        runtimeCodeSha256: null,
        evidenceHash: `sha256:${"2".repeat(64)}`,
        trustStatus: "disclosed",
      }); }],
      ["findings", (value) => { value.findings.push({
        id: "finding-a",
        severity: "high",
        status: "open",
        evidenceHash: `sha256:${"3".repeat(64)}`,
      }); }],
      ["reviewer type", (value) => { value.reviewerType = "hybrid"; }],
      ["runtime binding", (value) => {
        value.runtimeCodeKeccak256[0] = `0x${"4".repeat(64)}`;
      }],
      ["deployment binding", (value) => {
        value.deploymentBindingHash = `sha256:${"5".repeat(64)}`;
      }],
    ];
    for (const [name, mutate] of mutations) {
      const changed = structuredClone(review);
      mutate(changed);
      assert.notEqual(
        deriveVerifiedReviewEvidenceHashV1(changed),
        immutableHash,
        name,
      );
    }
  });

  test("keeps review lifecycle transitions outside the immutable review hash", () => {
    const review = structuredClone(goldenRecord.verifiedReview);
    const immutableHash = deriveVerifiedReviewEvidenceHashV1(review);
    review.status = "revoked";
    review.supersededBy = null;
    review.revokedAt = "2026-08-06T11:00:00.000Z";
    review.revocationEvidenceHash = `sha256:${"6".repeat(64)}`;
    assert.equal(deriveVerifiedReviewEvidenceHashV1(review), immutableHash);
  });

  test("matches the canonical public and onchain no-market fee vectors", () => {
    const publicPolicy = {
      accrual: null,
      basis: null,
      chargeMode: "none-no-qualifying-market",
      claim: null,
      claimIsolationEvidenceHash: `sha256:${"5".repeat(64)}`,
      claimRights: {
        crossPartyClaimingProhibited: true,
        evidenceHash: `sha256:${"1".repeat(64)}`,
        independentlyClaimable: false,
        partner: null,
        programmable: null,
      },
      currency: null,
      mode: "no-qualifying-market",
      normalProgrammableTenBpsApplied: false,
      partnerRecipient: null,
      partnerShareBps: 0,
      programmableRecipient: {
        namespace: "eip155-address",
        value: "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
      },
      programmableShareBps: 0,
      recipientControlEvidenceHash: `sha256:${"4".repeat(64)}`,
      rounding: null,
      schemaVersion: "programmable.custom-launch-fee-policy.v3",
      totalFeeBps: 0,
      verificationAuthorityHash: `sha256:${"2".repeat(64)}`,
      verificationEvidenceHash: `sha256:${"3".repeat(64)}`,
      verificationStatus: "not_applicable",
      verifiedMarketIds: [],
    };
    const publicPolicyBindingHash = derivePublicFeePolicyBindingV1(publicPolicy);
    assert.equal(
      publicPolicyBindingHash,
      "sha256:6ce49c7599693b5ff58a3c3d3858a2f2866a966d98cd0c06edb4f70a39e4bbaa",
    );
    const zeroBytes32 = `0x${"0".repeat(64)}`;
    const zeroAddress = `0x${"0".repeat(40)}`;
    const zeroLeg = {
      shareBps: 0,
      recipient: zeroAddress,
      currency: zeroAddress,
      chargeModeId: zeroBytes32,
      basisId: zeroBytes32,
      roundingId: zeroBytes32,
      accrualId: zeroBytes32,
      claimId: zeroBytes32,
      claimRightId: zeroBytes32,
      controlEvidenceHash: zeroBytes32,
    };
    assert.equal(
      deriveOnchainFeePolicyHashV1({
        kind: 2,
        partnerId: zeroBytes32,
        partnerStatusId: zeroBytes32,
        templateId: zeroBytes32,
        templateVersion: zeroBytes32,
        partnerRepositoryId: zeroBytes32,
        partnerCommitId: zeroBytes32,
        partnerRuntimeCodeSetHash: zeroBytes32,
        totalFeeBps: 0,
        nativeCustomFeeBps: 0,
        partner: zeroLeg,
        programmable: zeroLeg,
        activationVersion: zeroBytes32,
        activationBlock: "0",
        paused: false,
        retired: false,
        publicPolicyBindingHash: `0x${publicPolicyBindingHash.slice(7)}`,
        claimIsolationEvidenceHash:
          "0x303e820706c10bce1cf7cec787adec9a2985c363d325c397243c2d757a96a6f8",
        accountingSafetyEvidenceHash:
          "0xd0aa31a74060c406089ac5a97522b9d19872ec6d5e5383af86c8634340192bde",
        verificationEvidenceHash:
          "0x3e1c94a30db033439e3293ee180583ee824c51d0130c00249e6cf5ca2b149fa3",
      }),
      "0xdaf327c769377d80e700eafc75601c07fedc5c69176443f8aedbb2726b25eaae",
    );

    const semanticMutations = [
      ["charge mode", (value) => { value.chargeMode = "substituted"; }],
      ["basis", (value) => { value.basis = "substituted"; }],
      ["currency", (value) => { value.currency = "substituted"; }],
      ["accrual", (value) => { value.accrual = "substituted"; }],
      ["claim", (value) => { value.claim = "substituted"; }],
      ["rounding", (value) => { value.rounding = "substituted"; }],
      ["recipient", (value) => {
        value.programmableRecipient.value =
          "0x1111111111111111111111111111111111111111";
      }],
      ["share", (value) => { value.programmableShareBps = 1; }],
      ["claim rights", (value) => {
        value.claimRights.crossPartyClaimingProhibited = false;
      }],
      ["markets", (value) => { value.verifiedMarketIds.push("fake-market"); }],
      ["verification", (value) => {
        value.verificationEvidenceHash = `sha256:${"9".repeat(64)}`;
      }],
    ];
    for (const [name, mutate] of semanticMutations) {
      const changed = structuredClone(publicPolicy);
      mutate(changed);
      assert.notEqual(
        derivePublicFeePolicyBindingV1(changed),
        publicPolicyBindingHash,
        name,
      );
    }
  });

  test("rejects self-consistent substitution of every Registry preimage word", async () => {
    assert.equal(validateRegisteredRecordBindingsV1(goldenRecord), true);
    const baseline = projectionItem();
    assert.equal(validateRegistryCustomFeedItemV3(baseline), true);
    const normalized = normalizeRegistryCustomItemV3(baseline);
    assert.equal(
      normalized.registeredRecordCommitment,
      goldenRecord.registeredRecordCommitment,
    );
    assert.equal(
      normalized.feePolicy.publicPolicyBindingHash,
      goldenRecord.feePolicy.publicPolicyBindingHash,
    );
    assert.equal(normalized.token, null);
    assert.deepEqual(normalized.markets, []);
    const { createSchemaRegistry } = await import("../scripts/lib/schema.mjs");
    const { registryOriginMatchesManifest } = await import(
      "../server/v2-dataset.js"
    );
    const schemas = await createSchemaRegistry("v2");
    const validateLaunch = schemas.validator("launch.schema.json");
    const { sortKey: _sortKey, ...publicNormalized } = normalized;
    assert.equal(
      validateLaunch(publicNormalized),
      true,
      JSON.stringify(validateLaunch.errors),
    );
    const registryEvidence =
      normalized.extensions["programmable/registry-v3"];
    const manifest = {
      registryGenerations: [{
        chainId: normalized.chainId,
        caip2: normalized.caip2,
        generation: normalized.registryOrigin.registryGeneration,
        status: "live",
        address: normalized.registryOrigin.registryAddress,
        runtimeCodeKeccak256: registryEvidence.registryRuntimeCodeHash,
        startBlock: normalized.registryOrigin.registryStartBlock,
        endBlock: null,
        authorizedWriters: [registryEvidence.registryWriter],
        registryEventSetHash: normalized.registryOrigin.registryEventSetHash,
        events: {
          [registryEvidence.operation]: {
            topic0: registryEvidence.eventTopic0,
          },
        },
      }],
    };
    assert.equal(registryOriginMatchesManifest(normalized, manifest), true);
    const manifestMutations = [
      ["chain", (value) => { value.chainId = 8453; }],
      ["address", (value) => {
        value.address = "0x8888888888888888888888888888888888888888";
      }],
      ["runtime", (value) => {
        value.runtimeCodeKeccak256 = `0x${"8".repeat(64)}`;
      }],
      ["writer", (value) => {
        value.authorizedWriters = [
          "0x8888888888888888888888888888888888888888",
        ];
      }],
      ["event", (value) => {
        value.events.finalized.topic0 = `0x${"8".repeat(64)}`;
      }],
      ["event set", (value) => {
        value.registryEventSetHash = `sha256:${"8".repeat(64)}`;
      }],
      ["start block", (value) => {
        value.startBlock = String(
          BigInt(normalized.registryOrigin.registrationBlockNumber) + 1n,
        );
      }],
    ];
    for (const [name, mutate] of manifestMutations) {
      const substituted = structuredClone(manifest);
      mutate(substituted.registryGenerations[0]);
      assert.equal(
        registryOriginMatchesManifest(normalized, substituted),
        false,
        name,
      );
    }
    const addressFields = new Set(["primaryContract", "launchWallet"]);
    const decimalFields = new Set(["chainId", "registryGeneration"]);
    const fields = Object.keys(goldenRecord.registeredRecordPreimage);
    assert.equal(fields.length, 34);
    for (const field of fields) {
      const item = projectionItem();
      const producer = item.record.rawProducerRecord;
      const current = producer.registeredRecordPreimage[field];
      producer.registeredRecordPreimage[field] = decimalFields.has(field)
        ? current === "2" ? "3" : "2"
        : addressFields.has(field)
          ? current.toLowerCase() ===
              "0x9999999999999999999999999999999999999999"
            ? "0x8888888888888888888888888888888888888888"
            : "0x9999999999999999999999999999999999999999"
          : current === `0x${"9".repeat(64)}`
            ? `0x${"8".repeat(64)}`
            : `0x${"9".repeat(64)}`;
      const components = deriveRegisteredRecordComponentHashesV1(
        producer.registeredRecordPreimage,
      );
      const commitment = deriveRegisteredRecordCommitmentV1(components);
      const registrationBinding = deriveRegistrationBindingHashV1(commitment);
      producer.registeredRecordComponentHashes = components;
      producer.registeredRecordCommitment = commitment;
      producer.registrationBindingHash = registrationBinding;
      producer.registryOrigin.registeredRecordHash = commitment;
      producer.registryOrigin.registrationBindingHashRaw = registrationBinding;
      item.record.origin.registeredRecordHash = commitment;
      item.record.origin.latestOnchainRecordHash = commitment;
      resealProjectionItem(item);
      assert.equal(
        validateRegistryCustomFeedItemV3(item),
        false,
        field,
      );
    }
  });

  test("rejects substituted normalized fee, review, and Verified projections", () => {
    const mutations = [
      ["fee basis", (record) => { record.feePolicy.basis = "fabricated"; }],
      ["fee binding", (record) => {
        record.feePolicy.publicPolicyBindingHash = `sha256:${"7".repeat(64)}`;
      }],
      ["upgradeability", (record) => {
        record.securityReview.upgradeability.kind = "proxy";
      }],
      ["pause", (record) => {
        record.securityReview.pause.authority = "bounded";
      }],
      ["custody", (record) => {
        record.securityReview.custody.kind = "bounded";
      }],
      ["authorities", (record) => {
        record.securityReview.authorities = [];
      }],
      ["dependencies", (record) => {
        record.securityReview.dependencies.push({ id: "fabricated" });
      }],
      ["findings", (record) => {
        record.securityReview.findings.push({ id: "fabricated" });
      }],
      ["reviewer type", (record) => {
        record.securityReview.reviewerType = "hybrid";
      }],
      ["runtime binding", (record) => {
        record.securityReview.runtimeCodeHashes[0] = `0x${"8".repeat(64)}`;
      }],
      ["deployment binding", (record) => {
        record.securityReview.deploymentBindingHash =
          `sha256:${"8".repeat(64)}`;
      }],
      ["Verified suppression", (record) => {
        record.programmableVerified = false;
      }],
    ];
    for (const [name, mutate] of mutations) {
      const item = projectionItem();
      mutate(item.record);
      resealProjectionItem(item);
      assert.equal(validateRegistryCustomFeedItemV3(item), false, name);
    }
  });
});
