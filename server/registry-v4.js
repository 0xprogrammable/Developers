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

export const REGISTRY_V4_PRODUCER_SCHEMA =
  "programmable.custom-launch-registry-contract-record.v4";

const ZERO_HASH = `0x${"0".repeat(64)}`;

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function factoryBindingMatches(record) {
  const preimage = record.registeredRecordPreimage;
  const policy = record.feePolicy;
  const authorization = record.partnerFactoryAuthorization;
  if (policy.kind !== GEN2_FEE_POLICY_KIND.PartnerTemplate) {
    return authorization === null && preimage.providerId === ZERO_HASH;
  }
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

export function validateRegistryContractRecordV4(record) {
  try {
    if (record?.schemaVersion !== REGISTRY_V4_PRODUCER_SCHEMA ||
      record?.registryGeneration !== CUSTOM_REGISTRY_GENERATION_2 ||
      String(record.chainId) !== record.registeredRecordPreimage?.chainId ||
      record.registryGeneration !==
        record.registeredRecordPreimage?.registryGeneration ||
      !record.registeredRecordPreimage ||
      Object.keys(record.registeredRecordPreimage).length !==
        REGISTRY_GEN2_BINDING_FIELDS.length ||
      !REGISTRY_GEN2_BINDING_FIELDS.every((field) =>
        Object.hasOwn(record.registeredRecordPreimage, field))) return false;

    const preimage = record.registeredRecordPreimage;
    const feePolicyHash = deriveGen2FeePolicyHash(record.feePolicy);
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
      !factoryBindingMatches(record)) return false;

    if (record.feePolicy.kind === GEN2_FEE_POLICY_KIND.NoQualifyingMarket) {
      return preimage.marketPathId === ZERO_HASH;
    }
    return preimage.providerId === record.feePolicy.providerId &&
      preimage.modelId === record.feePolicy.modelId &&
      preimage.modelVersion === record.feePolicy.modelVersion &&
      preimage.templateId === record.feePolicy.templateId &&
      preimage.templateVersion === record.feePolicy.templateVersion &&
      preimage.marketPathId === record.feePolicy.marketPathId;
  } catch {
    return false;
  }
}
