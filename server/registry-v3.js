import { canonicalSha256, canonicalizeJson } from "./canonical.js";
import { keccak256 } from "./keccak.js";

export const REGISTRY_V3_FEED_SOURCE_ID =
  "programmable-custom-launch-registry-v3";
export const REGISTRY_V3_PRODUCER_SCHEMA =
  "programmable.custom-launch-registry-record.v3";
export const REGISTRY_V3_PROJECTION_SCHEMA =
  "programmable.custom-launch-projection-record.v3";
export const REGISTRY_V3_ENVELOPE_DOMAIN =
  "programmable.custom-launch-registry-envelope-digest.v3";

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HASH32 = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const PROGRAMMABLE_RECIPIENT =
  "0x4957f49620aff3adbbe8195a4f633e49cc93376c";
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const REGISTERED_RECORD_DOMAIN =
  "0x28abe59f7fbebf3f0e9741542b286792d25933e0ab011d6a0c7eb1179186aabb";
const IDENTITY_DOMAIN = "programmable.custom-launch-identity.v1";
const FEE_POLICY_DOMAIN = "programmable.custom-fee-policy.v1";
const PUBLIC_FEE_POLICY_BINDING_DOMAIN =
  "programmable.custom-launch-public-fee-policy-binding.v3";
const REVIEW_EVIDENCE_DOMAIN =
  "programmable.custom-launch-verified-review-evidence.v1";
const REVIEW_DEPENDENCY_SET_DOMAIN =
  "programmable.custom-launch-review-dependency-set.v1";
const REVIEW_FINDING_SET_DOMAIN =
  "programmable.custom-launch-review-finding-set.v1";
const DEPLOYMENT_BINDING_DOMAIN =
  "programmable.custom-launch-deployment-binding.v3";
const DEPLOYED_CONTRACT_SET_DOMAIN =
  "programmable.custom-launch-deployed-contract-set.v1";
const POST_LAUNCH_AUTHORITIES_DOMAIN =
  "programmable.custom-launch-post-launch-authorities.v3";
const ASSET_SET_HASH_DOMAIN =
  "programmable.discoverable-launch-asset-set-hash.v2";
const ASSET_SET_SCHEMA = "programmable.discoverable-launch-asset-set.v2";
const MARKET_SET_HASH_DOMAIN =
  "programmable.discoverable-launch-market-set-hash.v2";
const MARKET_SET_SCHEMA = "programmable.discoverable-launch-market-set.v2";
const FINALITY_POLICY_DOMAIN =
  "programmable.custom-launch-finality-policy.v1";
export const REGISTRY_STRUCTURED_FIELD_DOMAINS_V1 = Object.freeze({
  approvalId: "programmable.custom-launch-registry-approval-id.v1",
  repositoryId: "programmable.custom-launch-registry-repository-id.v1",
  commitId: "programmable.custom-launch-registry-commit-id.v1",
  deploymentId: "programmable.custom-launch-registry-deployment-id.v1",
  runtimeCodeSetHash: "programmable.custom-launch-registry-runtime-code-set.v1",
  modelId: "programmable.custom-launch-registry-model-id.v1",
  modelVersion: "programmable.custom-launch-registry-model-version.v1",
  templateId: "programmable.custom-launch-registry-template-id.v1",
  templateVersion: "programmable.custom-launch-registry-template-version.v1",
  partnerId: "programmable.custom-launch-registry-partner-id.v1",
  builderAttributionHash:
    "programmable.custom-launch-registry-builder-attribution.v1",
  originHash: "programmable.custom-launch-registry-origin.v1",
  capabilitySetHash: "programmable.custom-launch-registry-capability-set.v1",
  reviewResultId: "programmable.custom-launch-registry-review-result-id.v1",
});

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeDecimal(value, positive = false) {
  return typeof value === "string" && value.length <= 78 && DECIMAL.test(value) &&
    (!positive || value !== "0");
}

function safeInteger(value) {
  if (!safeDecimal(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function rawEnvelopeDigest(record) {
  const { schemaVersion: _schemaVersion, envelopeDigest: _digest, ...preimage } =
    record;
  return canonicalSha256(REGISTRY_V3_ENVELOPE_DOMAIN, preimage);
}

export function deriveVerifiedReviewEvidenceHashV1(value) {
  if (!object(value)) {
    throw new TypeError("verified review evidence input must be an object");
  }
  const {
    reviewEvidenceHash: _reviewEvidenceHash,
    status: _status,
    supersededBy: _supersededBy,
    revokedAt: _revokedAt,
    revocationEvidenceHash: _revocationEvidenceHash,
    ...immutableReview
  } = value;
  return canonicalSha256(REVIEW_EVIDENCE_DOMAIN, immutableReview);
}

export function derivePublicFeePolicyBindingV1(value) {
  if (!object(value)) {
    throw new TypeError("public fee policy binding input must be an object");
  }
  const {
    publicPolicyBindingHash: _publicPolicyBindingHash,
    verifiedAt: _verifiedAt,
    ...semanticPolicy
  } = value;
  return canonicalSha256(PUBLIC_FEE_POLICY_BINDING_DOMAIN, semanticPolicy);
}

export function deriveRegistryStructuredFieldV1(field, publicValue) {
  const domain = REGISTRY_STRUCTURED_FIELD_DOMAINS_V1[field];
  if (domain === undefined) {
    throw new TypeError("Registry structured field is unknown");
  }
  return `0x${canonicalSha256(domain, publicValue).slice("sha256:".length)}`;
}

export function deriveFinalityPolicyHashV1(value) {
  return `0x${canonicalSha256(FINALITY_POLICY_DOMAIN, value).slice(
    "sha256:".length,
  )}`;
}

function rawSha256Digest(value) {
  if (!DIGEST.test(value ?? "")) {
    throw new TypeError("SHA-256 digest is invalid");
  }
  return `0x${value.slice("sha256:".length)}`;
}

function verifiedReviewBindingsMatch(review, producer) {
  try {
    if (!object(review) || !object(producer?.approvalBinding) ||
      !object(producer?.deploymentBinding) ||
      !object(producer?.postLaunchAuthorityInventory)) return false;
    const deployed = producer.deploymentBinding.contracts;
    if (!Array.isArray(deployed) || deployed.length === 0 ||
      !Array.isArray(review.runtimeCodeKeccak256) ||
      !Array.isArray(review.runtimeCodeSha256) ||
      review.runtimeCodeKeccak256.length !== deployed.length ||
      review.runtimeCodeSha256.length !== deployed.length ||
      !Array.isArray(review.dependencies) || !Array.isArray(review.findings)) {
      return false;
    }
    const deployedKeccak = deployed.map((contract) =>
      contract.runtimeCodeKeccak256).sort();
    const deployedSha256 = deployed.map((contract) =>
      contract.runtimeCodeSha256).sort();
    const reviewedKeccak = [...review.runtimeCodeKeccak256].sort();
    const reviewedSha256 = [...review.runtimeCodeSha256].sort();
    const approval = producer.approvalBinding;
    return review.reviewEvidenceHash === deriveVerifiedReviewEvidenceHashV1(review) &&
      review.dependencySetHash === canonicalSha256(
        REVIEW_DEPENDENCY_SET_DOMAIN,
        review.dependencies,
      ) &&
      review.findingSetHash === canonicalSha256(
        REVIEW_FINDING_SET_DOMAIN,
        review.findings,
      ) &&
      review.deploymentBindingHash === canonicalSha256(
        DEPLOYMENT_BINDING_DOMAIN,
        producer.deploymentBinding,
      ) &&
      review.authoritiesEvidenceHash ===
        producer.postLaunchAuthorityInventoryHash &&
      review.policyVersion === approval.policyVersion &&
      review.policyCommitment === approval.policyCommitment &&
      review.repositoryId === approval.repositoryId &&
      review.commitObjectId === approval.commitObjectId &&
      review.sourceCommitment === approval.sourceCommitment &&
      review.buildCommitment === approval.buildCommitment &&
      review.artifactSetHash === approval.artifactSetHash &&
      review.configurationCommitment === approval.configurationCommitment &&
      reviewedKeccak.every((hash, index) =>
        HASH32.test(hash) && hash === deployedKeccak[index]) &&
      reviewedSha256.every((hash, index) =>
        DIGEST.test(hash) && hash === deployedSha256[index]);
  } catch {
    return false;
  }
}

function bytes32Word(value) {
  if (!HASH32.test(value ?? "")) throw new TypeError("ABI bytes32 is invalid");
  return Buffer.from(value.slice(2), "hex");
}

function addressWord(value) {
  if (!ADDRESS.test(value ?? "")) throw new TypeError("ABI address is invalid");
  return Buffer.concat([Buffer.alloc(12), Buffer.from(value.slice(2), "hex")]);
}

function uintWord(value, bits) {
  if (!safeDecimal(value)) throw new TypeError("ABI integer is invalid");
  const parsed = BigInt(value);
  if (parsed >= (1n << BigInt(bits))) throw new TypeError("ABI integer overflows");
  return Buffer.from(parsed.toString(16).padStart(64, "0"), "hex");
}

function boolWord(value) {
  if (typeof value !== "boolean") throw new TypeError("ABI Boolean is invalid");
  return uintWord(value ? "1" : "0", 8);
}

function keccakWords(words) {
  return keccak256(Uint8Array.from(Buffer.concat(words)));
}

export function deriveRegisteredRecordComponentHashesV1(value) {
  return {
    scopeAndApprovalHash: keccakWords([
      uintWord(value.chainId, 256),
      uintWord(value.registryGeneration, 64),
      bytes32Word(value.launchId),
      bytes32Word(value.projectId),
      bytes32Word(value.approvalId),
      bytes32Word(value.approvalBindingHash),
    ]),
    sourceAndDeploymentHash: keccakWords([
      bytes32Word(value.repositoryId),
      bytes32Word(value.commitId),
      bytes32Word(value.sourceCommitment),
      bytes32Word(value.buildCommitment),
      bytes32Word(value.artifactSetHash),
      bytes32Word(value.deploymentConfigurationHash),
      bytes32Word(value.deploymentId),
      bytes32Word(value.deploymentSetHash),
      bytes32Word(value.runtimeCodeSetHash),
      addressWord(value.primaryContract),
      bytes32Word(value.primaryRuntimeCodeHash),
      addressWord(value.launchWallet),
    ]),
    attributionHash: keccakWords([
      bytes32Word(value.modelId),
      bytes32Word(value.modelVersion),
      bytes32Word(value.templateId),
      bytes32Word(value.templateVersion),
      bytes32Word(value.partnerId),
      bytes32Word(value.builderAttributionHash),
      bytes32Word(value.originHash),
      bytes32Word(value.assetSetHash),
      bytes32Word(value.marketSetHash),
      bytes32Word(value.capabilitySetHash),
    ]),
    reviewHash: keccakWords([
      bytes32Word(value.reviewPolicyHash),
      bytes32Word(value.securityReviewHash),
      bytes32Word(value.reviewResultId),
      bytes32Word(value.reviewDeploymentBindingHash),
    ]),
    feePolicyHash: value.feePolicyHash,
    finalityPolicyHash: value.finalityPolicyHash,
  };
}

export function deriveRegisteredRecordCommitmentV1(components) {
  return keccakWords([
    bytes32Word(REGISTERED_RECORD_DOMAIN),
    bytes32Word(components.scopeAndApprovalHash),
    bytes32Word(components.sourceAndDeploymentHash),
    bytes32Word(components.attributionHash),
    bytes32Word(components.reviewHash),
    bytes32Word(components.feePolicyHash),
    bytes32Word(components.finalityPolicyHash),
  ]);
}

export function deriveRegistrationBindingHashV1(commitment) {
  const domain = keccak256(new TextEncoder().encode(IDENTITY_DOMAIN));
  return keccakWords([bytes32Word(domain), bytes32Word(commitment)]);
}

function feeLegHashV1(leg) {
  return keccakWords([
    uintWord(String(leg.shareBps), 16),
    addressWord(leg.recipient),
    addressWord(leg.currency),
    bytes32Word(leg.chargeModeId),
    bytes32Word(leg.basisId),
    bytes32Word(leg.roundingId),
    bytes32Word(leg.accrualId),
    bytes32Word(leg.claimId),
    bytes32Word(leg.claimRightId),
    bytes32Word(leg.controlEvidenceHash),
  ]);
}

export function deriveOnchainFeePolicyHashV1(value) {
  const attributionHash = keccakWords([
    uintWord(String(value.kind), 8),
    bytes32Word(value.partnerId),
    bytes32Word(value.partnerStatusId),
    bytes32Word(value.templateId),
    bytes32Word(value.templateVersion),
    bytes32Word(value.partnerRepositoryId),
    bytes32Word(value.partnerCommitId),
    bytes32Word(value.partnerRuntimeCodeSetHash),
  ]);
  const economicsHash = keccakWords([
    uintWord(String(value.totalFeeBps), 16),
    uintWord(String(value.nativeCustomFeeBps), 16),
    bytes32Word(feeLegHashV1(value.partner)),
    bytes32Word(feeLegHashV1(value.programmable)),
  ]);
  const lifecycleAndEvidenceHash = keccakWords([
    bytes32Word(value.activationVersion),
    uintWord(value.activationBlock, 64),
    boolWord(value.paused),
    boolWord(value.retired),
    bytes32Word(value.publicPolicyBindingHash),
    bytes32Word(value.claimIsolationEvidenceHash),
    bytes32Word(value.accountingSafetyEvidenceHash),
    bytes32Word(value.verificationEvidenceHash),
  ]);
  const domain = keccak256(new TextEncoder().encode(FEE_POLICY_DOMAIN));
  return keccakWords([
    bytes32Word(domain),
    bytes32Word(attributionHash),
    bytes32Word(economicsHash),
    bytes32Word(lifecycleAndEvidenceHash),
  ]);
}

function zeroFeeLeg(leg) {
  return leg?.shareBps === 0 && leg.recipient === ZERO_ADDRESS &&
    leg.currency === ZERO_ADDRESS && [
      leg.chargeModeId,
      leg.basisId,
      leg.roundingId,
      leg.accrualId,
      leg.claimId,
      leg.claimRightId,
      leg.controlEvidenceHash,
    ].every((value) => value === ZERO_BYTES32);
}

function activeFeeLeg(leg) {
  return Number.isInteger(leg?.shareBps) && leg.shareBps > 0 &&
    ADDRESS.test(leg.recipient) && leg.recipient !== ZERO_ADDRESS &&
    ADDRESS.test(leg.currency) && [
      leg.chargeModeId,
      leg.basisId,
      leg.roundingId,
      leg.accrualId,
      leg.claimId,
      leg.claimRightId,
      leg.controlEvidenceHash,
    ].every((value) => HASH32.test(value) && value !== ZERO_BYTES32);
}

function onchainFeePolicyIsExact(onchain, policy, partner) {
  if (!object(onchain) || onchain.paused !== false || onchain.retired !== false ||
    onchain.partner?.shareBps + onchain.programmable?.shareBps !==
      onchain.totalFeeBps ||
    onchain.claimIsolationEvidenceHash !==
      `0x${policy.claimIsolationEvidenceHash.slice("sha256:".length)}` ||
    onchain.accountingSafetyEvidenceHash !==
      `0x${policy.recipientControlEvidenceHash.slice("sha256:".length)}` ||
    onchain.verificationEvidenceHash !==
      `0x${policy.verificationEvidenceHash.slice("sha256:".length)}` ||
    policy.publicPolicyBindingHash !== derivePublicFeePolicyBindingV1(policy) ||
    onchain.publicPolicyBindingHash !==
      `0x${policy.publicPolicyBindingHash.slice("sha256:".length)}`) return false;
  if (policy.mode === "no-qualifying-market") {
    return onchain.kind === 2 && onchain.totalFeeBps === 0 &&
      onchain.nativeCustomFeeBps === 0 && zeroFeeLeg(onchain.partner) &&
      zeroFeeLeg(onchain.programmable) && [
        onchain.partnerId,
        onchain.partnerStatusId,
        onchain.templateId,
        onchain.templateVersion,
        onchain.partnerRepositoryId,
        onchain.partnerCommitId,
        onchain.partnerRuntimeCodeSetHash,
        onchain.activationVersion,
      ].every((value) => value === ZERO_BYTES32) &&
      onchain.activationBlock === "0";
  }
  if (!activeFeeLeg(onchain.programmable) ||
    onchain.programmable.recipient.toLowerCase() !== PROGRAMMABLE_RECIPIENT) {
    return false;
  }
  if (policy.mode === "native") {
    return partner === null && onchain.kind === 0 &&
      onchain.totalFeeBps === 10 && onchain.nativeCustomFeeBps === 10 &&
      onchain.programmable.shareBps === 10 && zeroFeeLeg(onchain.partner) &&
      onchain.activationBlock === "0";
  }
  return partner?.status === "active" && onchain.kind === 1 &&
    onchain.totalFeeBps === 20 && onchain.nativeCustomFeeBps === 0 &&
    onchain.partner.shareBps === 15 && onchain.programmable.shareBps === 5 &&
    activeFeeLeg(onchain.partner) && onchain.partner.recipient.toLowerCase() ===
      partner.recipient.value.toLowerCase() && onchain.activationBlock !== "0" &&
    onchain.partner.currency.toLowerCase() ===
      onchain.programmable.currency.toLowerCase() &&
    onchain.partner.chargeModeId === onchain.programmable.chargeModeId &&
    onchain.partner.basisId === onchain.programmable.basisId &&
    onchain.partner.roundingId === onchain.programmable.roundingId &&
    onchain.partner.claimRightId !== onchain.programmable.claimRightId;
}

export function validateRegisteredRecordBindingsV1(producer) {
  try {
    const preimage = producer.registeredRecordPreimage;
    const components = deriveRegisteredRecordComponentHashesV1(preimage);
    const commitment = deriveRegisteredRecordCommitmentV1(components);
    const registrationBinding = deriveRegistrationBindingHashV1(commitment);
    const zero = ZERO_BYTES32;
    const primary = producer.deploymentBinding.contracts.find((contract) =>
      contract.address.namespace === producer.launchIdentity.namespace &&
      contract.address.value.toLowerCase() ===
        producer.launchIdentity.value.toLowerCase(),
    );
    const expectedApprovalId = deriveRegistryStructuredFieldV1(
      "approvalId",
      producer.approvalBinding.approvalId,
    );
    const expectedRepositoryId = deriveRegistryStructuredFieldV1(
      "repositoryId",
      {
        repositoryId: producer.approvalBinding.repositoryId,
        repositoryUri: producer.approvalBinding.repositoryUri,
      },
    );
    const expectedCommitId = deriveRegistryStructuredFieldV1("commitId", {
      repositoryId: producer.approvalBinding.repositoryId,
      commitObjectId: producer.approvalBinding.commitObjectId,
      treeObjectId: producer.approvalBinding.treeObjectId,
    });
    const expectedDeploymentId = deriveRegistryStructuredFieldV1(
      "deploymentId",
      {
        launchArtifactCommitmentHash:
          producer.deploymentBinding.launchArtifactCommitmentHash,
        artifactManifestHash: producer.deploymentBinding.artifactManifestHash,
        deploymentCalldataHash:
          producer.deploymentBinding.deploymentCalldataHash,
      },
    );
    const expectedRuntimeCodeSetHash = deriveRegistryStructuredFieldV1(
      "runtimeCodeSetHash",
      producer.deploymentBinding.contracts.map((contract) => ({
        address: contract.address,
        runtimeCodeKeccak256: contract.runtimeCodeKeccak256,
        runtimeCodeSha256: contract.runtimeCodeSha256,
      })),
    );
    const expectedModelId = deriveRegistryStructuredFieldV1(
      "modelId",
      producer.model.id,
    );
    const expectedModelVersion = deriveRegistryStructuredFieldV1(
      "modelVersion",
      { modelId: producer.model.id, modelVersion: producer.model.version },
    );
    const expectedTemplateId = producer.template === null
      ? zero
      : deriveRegistryStructuredFieldV1("templateId", producer.template.id);
    const expectedTemplateVersion = producer.template === null
      ? zero
      : deriveRegistryStructuredFieldV1("templateVersion", {
          templateId: producer.template.id,
          templateVersion: producer.template.version,
        });
    const expectedPartnerId = producer.partner === null
      ? zero
      : deriveRegistryStructuredFieldV1("partnerId", producer.partner.id);
    const expectedBuilderAttributionHash = deriveRegistryStructuredFieldV1(
      "builderAttributionHash",
      {
        repositoryId: producer.approvalBinding.repositoryId,
        repositoryUri: producer.approvalBinding.repositoryUri,
      },
    );
    const expectedOriginHash = deriveRegistryStructuredFieldV1("originHash", {
      platformId: producer.platformId,
      origin: producer.origin,
      category: producer.category,
      launchFamily: producer.launchFamily,
    });
    const expectedCapabilitySetHash = deriveRegistryStructuredFieldV1(
      "capabilitySetHash",
      producer.capabilities,
    );
    const expectedReviewResultId = deriveRegistryStructuredFieldV1(
      "reviewResultId",
      {
        label: producer.verifiedReview.label,
        definition: producer.verifiedReview.definition,
        reviewerType: producer.verifiedReview.reviewerType,
      },
    );
    const expectedContractSetHash = canonicalSha256(
      DEPLOYED_CONTRACT_SET_DOMAIN,
      producer.deploymentBinding.contracts,
    );
    const expectedAuthorityInventoryHash = canonicalSha256(
      POST_LAUNCH_AUTHORITIES_DOMAIN,
      {
        schemaVersion: producer.postLaunchAuthorityInventory.schemaVersion,
        launchingWallet: producer.postLaunchAuthorityInventory.launchingWallet,
        authorities: producer.postLaunchAuthorityInventory.authorities,
      },
    );
    const expectedAssetSetHash = canonicalSha256(ASSET_SET_HASH_DOMAIN, {
      schemaVersion: ASSET_SET_SCHEMA,
      advertisesToken: producer.advertisesToken,
      assets: producer.discoverableAssets,
    });
    const expectedMarketSetHash = canonicalSha256(MARKET_SET_HASH_DOMAIN, {
      schemaVersion: MARKET_SET_SCHEMA,
      assetIdentitySetHash: producer.assetIdentitySetHash,
      markets: producer.discoverableMarkets,
    });
    return [
      "scopeAndApprovalHash",
      "sourceAndDeploymentHash",
      "attributionHash",
      "reviewHash",
      "feePolicyHash",
      "finalityPolicyHash",
    ].every((field) =>
      components[field] === producer.registeredRecordComponentHashes?.[field],
    ) &&
      producer.registeredRecordCommitment === commitment &&
      producer.registrationBindingHash === registrationBinding &&
      producer.registryOrigin.registeredRecordHash === commitment &&
      producer.registryOrigin.registrationBindingHashRaw === registrationBinding &&
      producer.deploymentBinding.contractSetHash === expectedContractSetHash &&
      producer.postLaunchAuthorityInventoryHash ===
        expectedAuthorityInventoryHash &&
      producer.postLaunchAuthorityInventory.postLaunchAuthorityInventoryHash ===
        expectedAuthorityInventoryHash &&
      producer.assetIdentitySetHash === expectedAssetSetHash &&
      producer.marketSetHash === expectedMarketSetHash &&
      preimage.feePolicyHash ===
        deriveOnchainFeePolicyHashV1(producer.onchainFeePolicy) &&
      onchainFeePolicyIsExact(
        producer.onchainFeePolicy,
        producer.feePolicy,
        producer.partner,
      ) &&
      preimage.chainId === producer.registryOrigin.chainId &&
      preimage.registryGeneration === producer.registryOrigin.registryGeneration &&
      preimage.launchId === producer.registryOrigin.registryLaunchIdRaw &&
      preimage.projectId === rawSha256Digest(producer.projectId) &&
      preimage.approvalId === expectedApprovalId &&
      preimage.approvalBindingHash ===
        producer.registryOrigin.registryApprovalBindingHashRaw &&
      preimage.approvalBindingHash ===
        rawSha256Digest(producer.approvalBinding.approvalBindingHash) &&
      preimage.repositoryId === expectedRepositoryId &&
      preimage.commitId === expectedCommitId &&
      preimage.sourceCommitment ===
        rawSha256Digest(producer.approvalBinding.sourceCommitment) &&
      preimage.buildCommitment ===
        rawSha256Digest(producer.approvalBinding.buildCommitment) &&
      preimage.artifactSetHash ===
        rawSha256Digest(producer.approvalBinding.artifactSetHash) &&
      preimage.deploymentConfigurationHash ===
        rawSha256Digest(producer.approvalBinding.configurationCommitment) &&
      preimage.deploymentId === expectedDeploymentId &&
      preimage.deploymentSetHash ===
        rawSha256Digest(producer.deploymentBinding.contractSetHash) &&
      preimage.runtimeCodeSetHash === expectedRuntimeCodeSetHash &&
      preimage.launchWallet.toLowerCase() ===
        producer.launchingWallet.value.toLowerCase() && primary !== undefined &&
      preimage.primaryContract.toLowerCase() ===
        primary.address.value.toLowerCase() &&
      preimage.primaryRuntimeCodeHash === primary.runtimeCodeKeccak256 &&
      preimage.modelId === expectedModelId &&
      preimage.modelVersion === expectedModelVersion &&
      preimage.templateId === expectedTemplateId &&
      preimage.templateVersion === expectedTemplateVersion &&
      preimage.partnerId === expectedPartnerId &&
      preimage.builderAttributionHash === expectedBuilderAttributionHash &&
      preimage.originHash === expectedOriginHash &&
      preimage.assetSetHash ===
        rawSha256Digest(producer.assetIdentitySetHash) &&
      preimage.marketSetHash ===
        rawSha256Digest(producer.marketSetHash) &&
      preimage.capabilitySetHash === expectedCapabilitySetHash &&
      preimage.reviewPolicyHash ===
        rawSha256Digest(producer.verifiedReview.policyCommitment) &&
      preimage.securityReviewHash ===
        rawSha256Digest(producer.verifiedReview.reviewEvidenceHash) &&
      preimage.reviewResultId === expectedReviewResultId &&
      preimage.reviewDeploymentBindingHash ===
        rawSha256Digest(producer.verifiedReview.deploymentBindingHash) &&
      preimage.finalityPolicyHash ===
        deriveFinalityPolicyHashV1(producer.finalityPolicy) &&
      producer.finalityPolicy.verificationAuthorityHash ===
        producer.finality.verificationAuthorityHash;
  } catch {
    return false;
  }
}

function runtimeBindingsMatch(projection, producer) {
  const projected = projection?.deploymentBinding?.contracts;
  const canonical = producer?.deploymentBinding?.contracts;
  if (!Array.isArray(projected) || !Array.isArray(canonical) ||
    projected.length !== canonical.length || projected.length === 0) return false;
  return projected.every((candidate) => canonical.some((binding) =>
    candidate.address?.toLowerCase() === binding.address?.value?.toLowerCase() &&
    candidate.role === binding.role &&
    candidate.runtimeCodeHash === binding.runtimeCodeKeccak256 &&
    HASH32.test(binding.runtimeCodeKeccak256) &&
    DIGEST.test(binding.runtimeCodeSha256),
  ));
}

function approvalBindingsMatch(projection, producer) {
  const left = projection?.approvalBinding;
  const right = producer?.approvalBinding;
  const fields = [
    "applicationId",
    "projectId",
    "approvalId",
    "repositoryId",
    "repositoryUri",
    "commitObjectId",
    "treeObjectId",
    "sourceCommitment",
    "buildCommitment",
    "artifactSetHash",
    "configurationCommitment",
    "launchWalletBindingHash",
    "chainProfileHash",
    "decisionReceiptDigest",
  ];
  return object(left) && object(right) &&
    fields.every((field) => left[field] === right[field]);
}

function finalityBindingsMatch(projection, producer) {
  const left = projection?.finality;
  const right = producer?.finality;
  if (!object(left) || !object(right)) return false;
  return left.transactionHash === right.transactionHash &&
    left.blockHash === right.blockHash &&
    left.blockNumber === right.blockNumber &&
    String(left.transactionIndex) === right.transactionIndex &&
    String(left.logIndex) === String(right.logIndex) &&
    left.onchainTimestamp === right.onchainTimestamp &&
    left.finalityEvidenceHash === right.finalityEvidenceHash &&
    left.verificationAuthorityHash === right.verificationAuthorityHash;
}

function projectedFeePolicyMatches(projection, producer) {
  try {
    const expected = structuredClone(producer.feePolicy);
    expected.programmableRecipient.value =
      expected.programmableRecipient.value.toLowerCase();
    if (expected.partnerRecipient !== null) {
      expected.partnerRecipient.value = expected.partnerRecipient.value.toLowerCase();
    }
    return canonicalizeJson(projection?.feePolicy) === canonicalizeJson(expected);
  } catch {
    return false;
  }
}

function projectedSecurityReviewMatches(projection, producer) {
  try {
    const review = producer.verifiedReview;
    const expected = {
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
    };
    return canonicalizeJson(projection?.securityReview) ===
      canonicalizeJson(expected);
  } catch {
    return false;
  }
}

function verifiedProjectionIsExact(record, producer) {
  if (typeof record?.programmableVerified !== "boolean") return false;
  const expected = ["finalized", "corrected"].includes(
    record.lifecycle?.status,
  ) && record.registryFinality?.status !== "orphaned" &&
    producer.verifiedReview.status === "verified" &&
    record.securityReview?.status === "reviewed" &&
    producer.deploymentBinding.runtimeMatch === "exact";
  return record.programmableVerified === expected;
}

function feePolicyIsExact(policy, partner) {
  if (!object(policy) || policy.schemaVersion !==
    "programmable.custom-launch-fee-policy.v3" ||
    policy.programmableRecipient?.namespace !== "eip155-address" ||
    policy.programmableRecipient?.value?.toLowerCase() !== PROGRAMMABLE_RECIPIENT ||
    policy.claimRights?.crossPartyClaimingProhibited !== true ||
    !Array.isArray(policy.verifiedMarketIds)) return false;
  if (policy.mode === "no-qualifying-market") {
    return policy.totalFeeBps === 0 &&
      policy.programmableShareBps === 0 && policy.partnerShareBps === 0 &&
      policy.partnerRecipient === null &&
      policy.chargeMode === "none-no-qualifying-market" &&
      policy.normalProgrammableTenBpsApplied === false &&
      policy.verificationStatus === "not_applicable" &&
      policy.verifiedMarketIds.length === 0;
  }
  if (policy.mode === "native") {
    return partner === null && policy.totalFeeBps === 10 &&
      policy.programmableShareBps === 10 && policy.partnerShareBps === 0 &&
      policy.partnerRecipient === null &&
      policy.chargeMode === "verified-official-market-path-only" &&
      policy.normalProgrammableTenBpsApplied === true &&
      policy.verificationStatus === "verified" &&
      policy.verifiedMarketIds.length > 0;
  }
  return policy.mode === "partner-template" && partner?.status === "active" &&
    partner.recipient?.namespace === "eip155-address" &&
    policy.totalFeeBps === 20 && policy.programmableShareBps === 5 &&
    policy.partnerShareBps === 15 &&
    policy.partnerRecipient?.namespace === "eip155-address" &&
    policy.partnerRecipient.value.toLowerCase() ===
      partner.recipient.value.toLowerCase() &&
    policy.chargeMode === "template-native-verified-market-path" &&
    policy.normalProgrammableTenBpsApplied === false &&
    policy.verificationStatus === "verified" &&
    policy.claimRights?.independentlyClaimable === true &&
    policy.verifiedMarketIds.length > 0;
}

export function validateRegistryCustomFeedItemV3(item) {
  if (!object(item) || Object.keys(item).sort().join("\0") !==
    ["generation", "projectionDigest", "projectionKey", "record"].sort().join("\0") ||
    !safeDecimal(item.generation, true) || !DIGEST.test(item.projectionDigest)) {
    return false;
  }
  const record = item.record;
  const producer = record?.rawProducerRecord;
  if (!object(record) || !object(producer) ||
    record.schemaVersion !== REGISTRY_V3_PROJECTION_SCHEMA ||
    producer.schemaVersion !== REGISTRY_V3_PRODUCER_SCHEMA ||
    record.platformId !== "programmable" || record.category !== "custom" ||
    record.publicLabel !== "Programmable Custom" ||
    producer.platformId !== "programmable" || producer.origin !== "programmable" ||
    producer.category !== "custom" || producer.launchFamily !== "custom" ||
    producer.publicLabel !== "Programmable Custom" ||
    record.launchId !== producer.launchId || record.projectId !== producer.projectId ||
    record.caip2 !== producer.registryOrigin?.caip2 ||
    record.chainId !== producer.registryOrigin?.chainId ||
    item.projectionKey !== `custom:${record.caip2}:${record.launchId}` ||
    item.projectionDigest !== canonicalSha256(REGISTRY_V3_PROJECTION_SCHEMA, record) ||
    record.producerBinding?.schemaVersion !== REGISTRY_V3_PRODUCER_SCHEMA ||
    record.producerBinding?.envelopeDigest !== producer.envelopeDigest ||
    record.producerBinding?.rawRecordHash !==
      canonicalSha256(REGISTRY_V3_PRODUCER_SCHEMA, producer) ||
    producer.envelopeDigest !== rawEnvelopeDigest(producer) ||
    producer.registryOrigin?.registryLaunchIdRaw !==
      `0x${producer.launchId.slice("sha256:".length)}` ||
    producer.registryOrigin?.launchIdEncoding !==
      "sha256-digest-raw-bytes32" ||
    producer.registryOrigin?.registeredRecordHash !==
      record.origin?.registeredRecordHash ||
    !validateRegisteredRecordBindingsV1(producer) ||
    producer.registryOrigin?.registryAddress?.toLowerCase() !==
      record.origin?.registryAddress?.toLowerCase() ||
    producer.registryOrigin?.registryGeneration !==
      record.origin?.registryGeneration ||
    record.origin?.registryLaunchIdRaw !==
      producer.registryOrigin?.registryLaunchIdRaw ||
    !HASH32.test(record.origin?.registeredRecordHash ?? "") ||
    !runtimeBindingsMatch(record, producer) ||
    !approvalBindingsMatch(record, producer) ||
    !finalityBindingsMatch(record, producer) ||
    !verifiedReviewBindingsMatch(producer.verifiedReview, producer) ||
    !projectedFeePolicyMatches(record, producer) ||
    !projectedSecurityReviewMatches(record, producer) ||
    !verifiedProjectionIsExact(record, producer) ||
    !feePolicyIsExact(producer.feePolicy, producer.partner)) return false;
  return true;
}

function primaryToken(record) {
  const primary = record.assets.find((asset) =>
    asset.role === "primary-token" && ADDRESS.test(asset.address ?? ""),
  );
  if (!record.rawProducerRecord.advertisesToken) return null;
  if (!primary) throw new TypeError("advertised Registry v3 token is unavailable");
  const metadataAvailable = primary.name !== null && primary.symbol !== null &&
    Number.isInteger(primary.decimals);
  return {
    address: primary.address,
    identityStatus: metadataAvailable ? "complete" : "partial",
    name: primary.name,
    symbol: primary.symbol,
    decimals: primary.decimals,
    totalSupplyRaw: primary.supply?.totalRaw ?? null,
    supplyStatus: primary.supply?.status === "unknown"
      ? "unavailable"
      : "available",
    supplyAsOfBlock: primary.supply?.observedAtBlock ?? null,
    metadata: {
      description: null,
      imageUrl: null,
      links: null,
      trustStatus: metadataAvailable ? "sanitized" : "unavailable",
    },
  };
}

function marketAddress(assets, assetId) {
  const address = assets.get(assetId)?.address;
  return ADDRESS.test(address ?? "") ? address : null;
}

function availability(value) {
  if (value === "supported") return "available";
  if (value === "unsupported") return "unavailable";
  return "unknown";
}

function publicMarket(record, market, verified) {
  const assets = new Map(record.assets.map((asset) => [asset.assetId, asset]));
  return {
    marketId: market.marketId,
    kind: market.kind,
    status: market.lifecycle === "retired" ? "closed" : market.lifecycle,
    baseTokenAddress: marketAddress(assets, market.baseAssetId),
    quoteTokenAddress: marketAddress(assets, market.quoteAssetId),
    protocol: null,
    poolId: market.poolId,
    poolAddress: market.poolAddress,
    hookAddress: market.hookAddress,
    marketContractAddress: market.marketContract,
    poolManagerAddress: market.poolManagerAddress,
    tickSpacing: market.tickSpacing,
    dynamicFee: market.dynamicFee,
    updatedAt: market.metrics.updatedAt,
    support: {
      discovery: "available",
      charting: availability(market.support.charting),
      quote: availability(market.support.quote),
      simulation: availability(market.support.simulation),
      execution: availability(market.support.execution),
    },
    adapter: market.adapter === null
      ? null
      : {
          kind: market.kind,
          version: market.adapter.version,
          adapterId: market.adapter.id,
          verificationStatus: verified ? "verified" : "prelaunch",
        },
    metrics: {
      price: { value: null, status: "unavailable" },
      liquidity: { value: null, status: "unavailable" },
      volume24h: { value: null, status: "unavailable" },
      updatedAt: market.metrics.updatedAt,
    },
    evidenceHash: market.evidenceHash,
  };
}

function publicFees(policy, revoked) {
  if (policy.mode === "no-qualifying-market") return [];
  const verificationStatus = revoked ? "revoked" : "verified";
  const fee = (share, rateBps, recipient) => ({
    kind: policy.mode === "partner-template"
      ? "partnership"
      : "programmable-platform",
    ratePpm: rateBps * 100,
    rateBps,
    recipient,
    chargeMode: "included",
    basis: policy.basis,
    assetAddress: null,
    verificationStatus,
    share,
    evidenceHash: policy.verificationEvidenceHash,
  });
  if (policy.mode === "native") {
    return [fee("programmable", 10, policy.programmableRecipient.value)];
  }
  return [
    fee("partner", 15, policy.partnerRecipient.value),
    fee("programmable", 5, policy.programmableRecipient.value),
  ];
}

function launchStatus(record) {
  if (record.lifecycle.status === "revoked") return "revoked";
  if (record.lifecycle.status === "orphaned") return "retired";
  if (record.registryFinality.status === "observed" ||
    record.registryFinality.status === "confirmed") return "observed";
  return "live";
}

export function normalizeRegistryCustomItemV3(item) {
  if (!validateRegistryCustomFeedItemV3(item)) {
    throw new TypeError("Registry custom v3 launch item is invalid");
  }
  const record = item.record;
  const raw = record.rawProducerRecord;
  const chainId = safeInteger(record.chainId);
  const blockNumber = safeInteger(record.origin.blockNumber);
  if (chainId === null || blockNumber === null) {
    throw new TypeError("Registry custom v3 chain position is unsafe");
  }
  const revoked = record.lifecycle.status === "revoked" ||
    raw.verifiedReview.status === "revoked";
  const token = primaryToken(record);
  const markets = record.markets.map((market) =>
    publicMarket(record, market, record.programmableVerified && !revoked),
  );
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
  return {
    schemaVersion: "2.0.0",
    platformId: "programmable",
    origin: "programmable",
    launchFamily: "custom",
    publicLabel: "Programmable Custom",
    launchId: record.launchId,
    registryRecordSchemaVersion: record.producerBinding.schemaVersion,
    producerEnvelopeDigest: record.producerBinding.envelopeDigest,
    registeredRecordHash: record.origin.registeredRecordHash,
    registeredRecordPreimage: structuredClone(raw.registeredRecordPreimage),
    registeredRecordComponentHashes: structuredClone(
      raw.registeredRecordComponentHashes,
    ),
    registeredRecordCommitment: raw.registeredRecordCommitment,
    registrationBindingHash: raw.registrationBindingHash,
    projectionDigest: item.projectionDigest,
    category: "custom",
    chainId,
    caip2: record.caip2,
    projectId: record.projectId,
    model: structuredClone(raw.model),
    template: structuredClone(raw.template),
    partner: structuredClone(raw.partner),
    builder: null,
    token,
    assets: structuredClone(raw.discoverableAssets),
    launch: {
      status: launchStatus(record),
      origin: "programmable-custom-registry-v3",
      modelId: raw.model.id,
      modelVersion: raw.model.version,
      publicSubmission: true,
      creatorAddress: record.launch.creator,
      transactionHash: record.launch.transactionHash,
      blockNumber: record.launch.blockNumber,
      blockHash: record.launch.blockHash,
      transactionIndex: record.launch.transactionIndex,
      logIndex: record.launch.logIndex,
      timestamp: record.launch.onchainTimestamp,
      finality: record.registryFinality.status,
      launchWallet: record.launch.launchWallet,
      observedAt: record.registryFinality.observedAt,
      confirmedAt: record.registryFinality.confirmedAt,
      finalizedAt: record.registryFinality.finalizedAt,
      orphanedAt: record.registryFinality.orphanedAt,
      revokedAt: record.lifecycle.revokedAt,
    },
    verification: {
      sourceId: REGISTRY_V3_FEED_SOURCE_ID,
      launcherAddress: null,
      registryAddress: record.origin.registryAddress,
      provenanceStatus: revoked ? "revoked" : "verified",
      sourceUrl: null,
      registryGeneration: record.origin.registryGeneration,
      registryEventTopic: record.origin.eventTopic0,
      registryLogIndex: record.origin.logIndex,
      approvalMatch: revoked ? "revoked" : "matched",
      runtimeMatch: revoked ? "revoked" : "matched",
      metadataTrust: "onchain-verified",
    },
    approvalBinding: structuredClone(raw.approvalBinding),
    deploymentBinding: structuredClone(raw.deploymentBinding),
    verifiedReview: structuredClone(raw.verifiedReview),
    feePolicy: structuredClone(raw.feePolicy),
    onchainFeePolicy: structuredClone(raw.onchainFeePolicy),
    finalityPolicy: structuredClone(raw.finalityPolicy),
    finalityEvidence: structuredClone(raw.finality),
    presentation,
    registryOrigin: structuredClone(raw.registryOrigin),
    launchingWallet: structuredClone(raw.launchingWallet),
    postLaunchAuthorityInventory: structuredClone(
      raw.postLaunchAuthorityInventory,
    ),
    postLaunchAuthorityInventoryHash: raw.postLaunchAuthorityInventoryHash,
    launchIdentity: structuredClone(raw.launchIdentity),
    advertisesToken: raw.advertisesToken,
    assetIdentitySetHash: raw.assetIdentitySetHash,
    marketSetHash: raw.marketSetHash,
    lifecycle: structuredClone(raw.lifecycle),
    presentationVersion: raw.presentationVersion,
    presentationBindingHash: raw.presentationBindingHash,
    capabilities: structuredClone(record.capabilities),
    mechanisms: structuredClone(record.mechanisms),
    markets,
    fees: publicFees(raw.feePolicy, revoked),
    extensions: {
      "programmable/registry-v3": {
        generation: item.generation,
        projectionKey: item.projectionKey,
        rawRecordHash: record.producerBinding.rawRecordHash,
        latestOnchainRecordHash: record.origin.latestOnchainRecordHash,
        previousOnchainRecordHash: record.origin.previousOnchainRecordHash,
        registryRuntimeCodeHash: record.origin.registryRuntimeCodeHash,
        registryWriter: record.origin.registryWriter,
        operation: record.origin.operation,
        eventTopic0: record.origin.eventTopic0,
        registryFinality: structuredClone(record.registryFinality),
        projectionLifecycle: structuredClone(record.lifecycle),
        programmableVerified: record.programmableVerified,
      },
    },
    sortKey: `${String(blockNumber).padStart(16, "0")}:${String(
      record.origin.transactionIndex,
    ).padStart(10, "0")}:${String(record.origin.logIndex).padStart(
      10,
      "0",
    )}:${record.launchId.slice("sha256:".length)}`,
  };
}
