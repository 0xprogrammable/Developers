import { keccak256 } from "./keccak.js";

export const CUSTOM_REGISTRY_GENERATION_2 = "2";
export const PROGRAMMABLE_FEE_RECIPIENT =
  "0x4957f49620aff3adbbe8195a4f633e49cc93376c";
export const PARTNER_STATUS_ACTIVE_ID = keccakText(
  "programmable.partner-status.active.v1",
);

export const REGISTRY_GEN2_CONTRACT_ROLES = Object.freeze([
  "registry",
  "partnerFactoryRegistry",
  "feePolicyVerifier",
  "atomicRegistrar",
]);

export const REGISTRY_GEN2_BINDING_FIELDS = Object.freeze([
  "chainId",
  "registryGeneration",
  "launchId",
  "projectId",
  "approvalId",
  "approvalBindingHash",
  "repositoryId",
  "commitId",
  "sourceCommitment",
  "buildCommitment",
  "artifactSetHash",
  "deploymentConfigurationHash",
  "configurationHash",
  "permissionsHash",
  "deploymentId",
  "deploymentSetHash",
  "runtimeCodeSetHash",
  "primaryContract",
  "primaryRuntimeCodeHash",
  "launchWallet",
  "modelId",
  "modelVersion",
  "templateId",
  "templateVersion",
  "providerId",
  "builderAttributionHash",
  "originHash",
  "assetSetHash",
  "marketSetHash",
  "marketPathId",
  "capabilitySetHash",
  "reviewPolicyHash",
  "securityReviewHash",
  "reviewResultId",
  "reviewDeploymentBindingHash",
  "feePolicyHash",
  "finalityPolicyHash",
]);

export const GEN2_FEE_POLICY_KIND = Object.freeze({
  NativeCustom: 0,
  PartnerTemplate: 1,
  NoQualifyingMarket: 2,
});

const HASH32 = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const ZERO_HASH = `0x${"0".repeat(64)}`;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;

const REGISTERED_RECORD_DOMAIN = keccakText(
  "programmable.custom-registered-record.v1",
);
const IDENTITY_DOMAIN = keccakText(
  "programmable.custom-launch-identity.v1",
);
const APPROVAL_BINDING_DOMAIN = keccakText(
  "programmable.custom-approval-binding.v1",
);
const REVIEW_DEPLOYMENT_BINDING_DOMAIN = keccakText(
  "programmable.custom-review-deployment-binding.v1",
);
const PARTNER_CONFIGURATION_DOMAIN = keccakText(
  "programmable.custom-partner-configuration.v2",
);
const FEE_POLICY_DOMAIN = keccakText("programmable.custom-fee-policy.v2");

function keccakText(value) {
  return keccak256(new TextEncoder().encode(value));
}

function bytes32Word(value) {
  if (!HASH32.test(value ?? "")) throw new TypeError("ABI bytes32 is invalid");
  return Buffer.from(value.slice(2), "hex");
}

function addressWord(value) {
  if (!ADDRESS.test(value ?? "")) throw new TypeError("ABI address is invalid");
  return Buffer.concat([Buffer.alloc(12), Buffer.from(value.slice(2), "hex")]);
}

function uintWord(value, bits = 256) {
  const normalized = String(value);
  if (!DECIMAL.test(normalized)) throw new TypeError("ABI integer is invalid");
  const parsed = BigInt(normalized);
  if (parsed >= (1n << BigInt(bits))) throw new TypeError("ABI integer overflows");
  return Buffer.from(parsed.toString(16).padStart(64, "0"), "hex");
}

function boolWord(value) {
  if (typeof value !== "boolean") throw new TypeError("ABI Boolean is invalid");
  return uintWord(value ? 1 : 0, 8);
}

function hashWords(words) {
  return keccak256(Uint8Array.from(Buffer.concat(words)));
}

function nonzeroHash(value, field) {
  if (!HASH32.test(value ?? "") || value === ZERO_HASH) {
    throw new TypeError(`${field} must be a nonzero bytes32`);
  }
}

function zeroLeg(leg) {
  return String(leg?.shareBps) === "0" && leg?.recipient === ZERO_ADDRESS &&
    leg?.currency === ZERO_ADDRESS && leg?.chargeModeId === ZERO_HASH &&
    leg?.basisId === ZERO_HASH && leg?.roundingId === ZERO_HASH &&
    leg?.accrualId === ZERO_HASH && leg?.claimId === ZERO_HASH &&
    leg?.claimRightId === ZERO_HASH && leg?.controlEvidenceHash === ZERO_HASH;
}

function validateActiveLeg(leg, field) {
  if (String(leg?.shareBps) === "0" || leg?.recipient === ZERO_ADDRESS) {
    throw new TypeError(`${field} is inactive`);
  }
  for (const key of [
    "chargeModeId",
    "basisId",
    "roundingId",
    "accrualId",
    "claimId",
    "claimRightId",
    "controlEvidenceHash",
  ]) nonzeroHash(leg?.[key], `${field}.${key}`);
  addressWord(leg.currency);
}

function feeLegHash(leg) {
  return hashWords([
    uintWord(leg.shareBps, 16),
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

export function validateGen2FeePolicy(policy) {
  for (const key of [
    "publicPolicyBindingHash",
    "claimIsolationEvidenceHash",
    "accountingSafetyEvidenceHash",
    "verificationEvidenceHash",
  ]) nonzeroHash(policy?.[key], key);
  if (policy.paused || policy.retired) throw new TypeError("fee policy is inactive");

  if (policy.kind === GEN2_FEE_POLICY_KIND.NoQualifyingMarket) {
    const zeroFields = [
      "providerId",
      "partnerStatusId",
      "modelId",
      "modelVersion",
      "templateId",
      "templateVersion",
      "marketPathId",
      "partnerRepositoryId",
      "partnerCommitId",
      "partnerRuntimeCodeSetHash",
      "activationVersion",
    ];
    if (zeroFields.some((field) => policy[field] !== ZERO_HASH) ||
      String(policy.totalFeeBps) !== "0" ||
      String(policy.nativeCustomFeeBps) !== "0" ||
      String(policy.activationBlock) !== "0" ||
      !zeroLeg(policy.partner) || !zeroLeg(policy.programmable)) {
      throw new TypeError("no-qualifying-market policy must contain zero economics");
    }
    return true;
  }

  validateActiveLeg(policy.programmable, "programmable");
  if (policy.programmable.recipient.toLowerCase() !== PROGRAMMABLE_FEE_RECIPIENT) {
    throw new TypeError("Programmable recipient is not canonical");
  }
  if ((policy.modelId === ZERO_HASH) !== (policy.modelVersion === ZERO_HASH) ||
    (policy.templateId === ZERO_HASH) !== (policy.templateVersion === ZERO_HASH) ||
    policy.modelId === ZERO_HASH || policy.templateId === ZERO_HASH ||
    policy.marketPathId === ZERO_HASH) {
    throw new TypeError("model, template, and market path must be exact nonzero pairs");
  }
  if (Number(policy.partner.shareBps) + Number(policy.programmable.shareBps) !==
    Number(policy.totalFeeBps)) {
    throw new TypeError("fee shares do not equal the total");
  }

  if (policy.kind === GEN2_FEE_POLICY_KIND.NativeCustom) {
    if (policy.providerId !== ZERO_HASH || policy.partnerStatusId !== ZERO_HASH ||
      policy.partnerRepositoryId !== ZERO_HASH || policy.partnerCommitId !== ZERO_HASH ||
      policy.partnerRuntimeCodeSetHash !== ZERO_HASH ||
      String(policy.totalFeeBps) !== "10" ||
      String(policy.nativeCustomFeeBps) !== "10" ||
      String(policy.programmable.shareBps) !== "10" ||
      policy.activationVersion !== ZERO_HASH || String(policy.activationBlock) !== "0" ||
      !zeroLeg(policy.partner)) {
      throw new TypeError("Native Custom must be exactly 10 bps without a provider overlay");
    }
    return true;
  }

  if (policy.kind !== GEN2_FEE_POLICY_KIND.PartnerTemplate) {
    throw new TypeError("fee policy kind is unknown");
  }
  for (const key of [
    "providerId",
    "templateId",
    "templateVersion",
    "partnerRepositoryId",
    "partnerCommitId",
    "partnerRuntimeCodeSetHash",
    "activationVersion",
  ]) nonzeroHash(policy[key], key);
  if (policy.partnerStatusId !== PARTNER_STATUS_ACTIVE_ID ||
    String(policy.totalFeeBps) !== "20" ||
    String(policy.nativeCustomFeeBps) !== "0" ||
    String(policy.partner.shareBps) !== "15" ||
    String(policy.programmable.shareBps) !== "5" ||
    String(policy.activationBlock) === "0") {
    throw new TypeError("provider fee must be exactly 20 bps split 15/5 with no 10 bps overlay");
  }
  validateActiveLeg(policy.partner, "partner");
  if (policy.partner.recipient.toLowerCase() === policy.programmable.recipient.toLowerCase() ||
    policy.partner.currency.toLowerCase() !== policy.programmable.currency.toLowerCase() ||
    policy.partner.chargeModeId !== policy.programmable.chargeModeId ||
    policy.partner.basisId !== policy.programmable.basisId ||
    policy.partner.roundingId !== policy.programmable.roundingId) {
    throw new TypeError("provider shares must have distinct recipients and one fee basis");
  }
  if (policy.partner.claimRightId === policy.programmable.claimRightId) {
    throw new TypeError("provider claim rights are not isolated");
  }
  return true;
}

export function deriveGen2FeePolicyHash(policy) {
  validateGen2FeePolicy(policy);
  const attributionHash = hashWords([
    uintWord(policy.kind, 8),
    bytes32Word(policy.providerId),
    bytes32Word(policy.partnerStatusId),
    bytes32Word(policy.modelId),
    bytes32Word(policy.modelVersion),
    bytes32Word(policy.templateId),
    bytes32Word(policy.templateVersion),
    bytes32Word(policy.marketPathId),
    bytes32Word(policy.partnerRepositoryId),
    bytes32Word(policy.partnerCommitId),
    bytes32Word(policy.partnerRuntimeCodeSetHash),
  ]);
  const economicsHash = hashWords([
    uintWord(policy.totalFeeBps, 16),
    uintWord(policy.nativeCustomFeeBps, 16),
    bytes32Word(feeLegHash(policy.partner)),
    bytes32Word(feeLegHash(policy.programmable)),
  ]);
  const lifecycleAndEvidenceHash = hashWords([
    bytes32Word(policy.activationVersion),
    uintWord(policy.activationBlock, 64),
    boolWord(policy.paused),
    boolWord(policy.retired),
    bytes32Word(policy.publicPolicyBindingHash),
    bytes32Word(policy.claimIsolationEvidenceHash),
    bytes32Word(policy.accountingSafetyEvidenceHash),
    bytes32Word(policy.verificationEvidenceHash),
  ]);
  return hashWords([
    bytes32Word(FEE_POLICY_DOMAIN),
    bytes32Word(attributionHash),
    bytes32Word(economicsHash),
    bytes32Word(lifecycleAndEvidenceHash),
  ]);
}

export function deriveGen2RegisteredRecordComponentHashes(value) {
  return {
    scopeAndApprovalHash: hashWords([
      uintWord(value.chainId),
      uintWord(value.registryGeneration, 64),
      bytes32Word(value.launchId),
      bytes32Word(value.projectId),
      bytes32Word(value.approvalId),
      bytes32Word(value.approvalBindingHash),
    ]),
    sourceAndDeploymentHash: hashWords([
      bytes32Word(value.repositoryId),
      bytes32Word(value.commitId),
      bytes32Word(value.sourceCommitment),
      bytes32Word(value.buildCommitment),
      bytes32Word(value.artifactSetHash),
      bytes32Word(value.deploymentConfigurationHash),
      bytes32Word(value.configurationHash),
      bytes32Word(value.permissionsHash),
      bytes32Word(value.deploymentId),
      bytes32Word(value.deploymentSetHash),
      bytes32Word(value.runtimeCodeSetHash),
      addressWord(value.primaryContract),
      bytes32Word(value.primaryRuntimeCodeHash),
      addressWord(value.launchWallet),
    ]),
    attributionHash: hashWords([
      bytes32Word(value.modelId),
      bytes32Word(value.modelVersion),
      bytes32Word(value.templateId),
      bytes32Word(value.templateVersion),
      bytes32Word(value.providerId),
      bytes32Word(value.builderAttributionHash),
      bytes32Word(value.originHash),
      bytes32Word(value.assetSetHash),
      bytes32Word(value.marketSetHash),
      bytes32Word(value.marketPathId),
      bytes32Word(value.capabilitySetHash),
    ]),
    reviewHash: hashWords([
      bytes32Word(value.reviewPolicyHash),
      bytes32Word(value.securityReviewHash),
      bytes32Word(value.reviewResultId),
      bytes32Word(value.reviewDeploymentBindingHash),
    ]),
    feePolicyHash: value.feePolicyHash,
    finalityPolicyHash: value.finalityPolicyHash,
  };
}

export function deriveGen2RegisteredRecordCommitment(value) {
  const components = deriveGen2RegisteredRecordComponentHashes(value);
  return hashWords([
    bytes32Word(REGISTERED_RECORD_DOMAIN),
    bytes32Word(components.scopeAndApprovalHash),
    bytes32Word(components.sourceAndDeploymentHash),
    bytes32Word(components.attributionHash),
    bytes32Word(components.reviewHash),
    bytes32Word(components.feePolicyHash),
    bytes32Word(components.finalityPolicyHash),
  ]);
}

export function deriveGen2RegistrationBindingHash(value) {
  return hashWords([
    bytes32Word(IDENTITY_DOMAIN),
    bytes32Word(deriveGen2RegisteredRecordCommitment(value)),
  ]);
}

export function deriveGen2ApprovalBindingHash(value) {
  const sourceHash = hashWords([
    bytes32Word(value.repositoryId),
    bytes32Word(value.commitId),
    bytes32Word(value.sourceCommitment),
    bytes32Word(value.buildCommitment),
    bytes32Word(value.artifactSetHash),
    bytes32Word(value.deploymentConfigurationHash),
    bytes32Word(value.configurationHash),
    bytes32Word(value.permissionsHash),
  ]);
  const deploymentExpectationHash = hashWords([
    bytes32Word(value.deploymentId),
    bytes32Word(value.deploymentSetHash),
    bytes32Word(value.runtimeCodeSetHash),
    addressWord(value.primaryContract),
    bytes32Word(value.primaryRuntimeCodeHash),
  ]);
  const attributionHash = hashWords([
    bytes32Word(value.modelId),
    bytes32Word(value.modelVersion),
    bytes32Word(value.templateId),
    bytes32Word(value.templateVersion),
    bytes32Word(value.providerId),
    bytes32Word(value.builderAttributionHash),
    bytes32Word(value.originHash),
    bytes32Word(value.marketPathId),
  ]);
  const scopeHash = hashWords([
    uintWord(value.chainId),
    uintWord(value.registryGeneration, 64),
    bytes32Word(value.launchId),
    bytes32Word(value.projectId),
    bytes32Word(value.approvalId),
  ]);
  const controlHash = hashWords([
    addressWord(value.launchWallet),
    bytes32Word(value.feePolicyHash),
    bytes32Word(value.reviewPolicyHash),
  ]);
  return hashWords([
    bytes32Word(APPROVAL_BINDING_DOMAIN),
    bytes32Word(scopeHash),
    bytes32Word(sourceHash),
    bytes32Word(deploymentExpectationHash),
    bytes32Word(attributionHash),
    bytes32Word(controlHash),
  ]);
}

export function deriveGen2ReviewDeploymentBindingHash(value) {
  return hashWords([
    bytes32Word(REVIEW_DEPLOYMENT_BINDING_DOMAIN),
    bytes32Word(value.approvalBindingHash),
    bytes32Word(value.deploymentId),
    bytes32Word(value.deploymentSetHash),
    bytes32Word(value.runtimeCodeSetHash),
    addressWord(value.primaryContract),
    bytes32Word(value.primaryRuntimeCodeHash),
    bytes32Word(value.deploymentConfigurationHash),
    bytes32Word(value.configurationHash),
    bytes32Word(value.permissionsHash),
    bytes32Word(value.feePolicyHash),
  ]);
}

export function deriveGen2PartnerConfigurationHash(value) {
  if (String(value.registryGeneration) !== CUSTOM_REGISTRY_GENERATION_2) {
    throw new TypeError("partner configuration must bind Registry generation 2");
  }
  const modelHash = hashWords([
    bytes32Word(value.providerId),
    bytes32Word(value.modelId),
    bytes32Word(value.modelVersion),
    bytes32Word(value.templateId),
    bytes32Word(value.templateVersion),
    bytes32Word(value.modelRepositoryId),
    bytes32Word(value.modelSourceCommitId),
  ]);
  const factoryHash = hashWords([
    bytes32Word(value.factorySourceRepositoryId),
    bytes32Word(value.factorySourceCommitId),
    uintWord(value.chainId),
    uintWord(value.registryGeneration, 64),
    addressWord(value.factory),
    bytes32Word(value.factoryRuntimeCodeHash),
    bytes32Word(value.launchRuntimeCodeSetHash),
  ]);
  return hashWords([
    bytes32Word(PARTNER_CONFIGURATION_DOMAIN),
    bytes32Word(modelHash),
    bytes32Word(factoryHash),
    bytes32Word(value.permissionsHash),
    bytes32Word(value.feePolicyHash),
  ]);
}

export function validateGen2PartnerFactoryAuthorization(value) {
  if (String(value?.registryGeneration) !== CUSTOM_REGISTRY_GENERATION_2 ||
    !DECIMAL.test(String(value?.chainId)) || String(value.chainId) === "0" ||
    value.factory?.toLowerCase() === ZERO_ADDRESS) return false;
  for (const field of [
    "configurationHash",
    "providerId",
    "modelId",
    "modelVersion",
    "templateId",
    "templateVersion",
    "modelRepositoryId",
    "modelSourceCommitId",
    "factorySourceRepositoryId",
    "factorySourceCommitId",
    "factoryRuntimeCodeHash",
    "launchRuntimeCodeSetHash",
    "permissionsHash",
    "feePolicyHash",
    "evidenceHash",
  ]) {
    try {
      nonzeroHash(value[field], field);
    } catch {
      return false;
    }
  }
  try {
    addressWord(value.factory);
    const validAfter = BigInt(value.validAfterBlock);
    const expiresAt = BigInt(value.expiresAtBlock);
    return validAfter > 0n && expiresAt > 0n && validAfter <= expiresAt &&
      value.configurationHash === deriveGen2PartnerConfigurationHash(value);
  } catch {
    return false;
  }
}

export function gen2ContractSetMatchesEvidence(generation, evidence) {
  if (generation?.generation !== CUSTOM_REGISTRY_GENERATION_2 ||
    !generation.contractSet || !evidence?.registryGenerationContractSet ||
    generation.contractSet.registry?.address?.toLowerCase() !==
      generation.address?.toLowerCase() ||
    generation.contractSet.registry?.runtimeCodeKeccak256 !==
      generation.runtimeCodeKeccak256) return false;
  return REGISTRY_GEN2_CONTRACT_ROLES.every((role) => {
    const official = generation.contractSet[role];
    const observed = evidence.registryGenerationContractSet[role];
    return ADDRESS.test(official?.address ?? "") &&
      HASH32.test(official?.runtimeCodeKeccak256 ?? "") &&
      observed?.address?.toLowerCase() === official.address.toLowerCase() &&
      observed?.runtimeCodeKeccak256 === official.runtimeCodeKeccak256;
  });
}
