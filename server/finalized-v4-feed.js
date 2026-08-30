import { readBoundedJson } from "./bounded-body.js";
import { canonicalSha256, canonicalizeJson } from "./canonical.js";
import { keccak256 } from "./keccak.js";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/u;
const LOWERCASE_ADDRESS = /^0x[0-9a-f]{40}$/u;
const HASH32 = /^0x[0-9a-fA-F]{64}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const DECIMAL = /^(0|[1-9][0-9]*)$/u;
const SOURCE_VERIFICATION_TARGET_ID =
  /^[A-Za-z0-9][A-Za-z0-9._:@/+\-]{0,255}$/u;
const SOURCE_VERIFICATION_INSTANT =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CURSOR = /^[A-Za-z0-9._~-]{1,1024}$/u;
const PROHIBITED_TEXT =
  /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const LIST_SCHEMA = "programmable.custom-launch-list.v4";
const RESOURCE_SCHEMA = "programmable.finalized-custom-launch-metadata.v4";
const ONCHAIN_SCHEMA = "programmable.custom-launch-onchain-evidence.v2";
const CHAIN_DEPLOYMENT_SCHEMA =
  "programmable.custom-launch-chain-deployment.v1";
const DEPLOYMENT_EVIDENCE_SCHEMA =
  "programmable.custom-launch-deployment-evidence.v1";
const EXTERNAL_DEPLOYMENT_PROVIDER_READBACK_SCHEMA =
  "programmable.custom-launch-deployment-provider-readback.v2";
const ATOMIC_DEPLOYMENT_EVIDENCE_SCHEMA =
  "programmable.robinhood-atomic-root-deployment-evidence.v1";
const ATOMIC_ROOT_TRANSITION_READBACK_SCHEMA =
  "programmable.robinhood-atomic-root-runtime-transition-provider-readback.v1";
const ATOMIC_ROOT_RESULT_STATE_SCHEMA =
  "programmable.robinhood-atomic-root-deployment-result-state.v1";
const GENESIS_PROVENANCE_SCHEMA =
  "programmable.custom-launch-genesis-provenance.v1";
const GENESIS_PROVIDER_READBACK_SCHEMA =
  "programmable.custom-launch-genesis-provider-readback.v1";
const SAFE_CONFIGURATION_EVIDENCE_SCHEMA =
  "programmable.safe-configuration-evidence.v1";
const ETHEREUM_FINALITY_EVIDENCE_SCHEMA =
  "programmable.robinhood-l2-checkpoint-ethereum-finality.v1";
const PROFILE_SCHEMA = "programmable.custom-launch-profile-ref.v4";
const FINALITY_SCHEMA =
  "programmable.custom-launch-finality-policy-ref.v1";
const FUNDING_SCHEMA = "programmable.custom-launch-funding-intent.v2";
const LIQUIDITY_SCHEMA = "programmable.custom-launch-liquidity-model.v1";
const SOURCE_VERIFICATION_SCHEMA =
  "programmable.source-verification-status.v4";
const RESPONSE_BYTES = 4 * 1_024 * 1_024;
const REQUEST_TIMEOUT_MS = 6_000;
const MAXIMUM_PAGES = 400;
const CACHE_MS = 15_000;
const TRUSTED_FINALIZED_V4_RECORD = Symbol("trusted-finalized-v4-record");
const ROBINHOOD_FOUNDATION_SOURCE_COMMITMENT =
  "0xe87f5edc2dc839bd87a26a80cb53f14b021e603a1753d27aae3a02862058d730";
const EMPTY_RUNTIME_CODE_HASH =
  "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
const SAFE_SOURCE_SUBJECT = Object.freeze({
  schemaVersion: "programmable.safe-source-commitment.v1",
  repository: "safe-global/safe-deployments",
  commit: "0974182c16c57ca6fe2b9bba8cffb8a7e55fb83c",
  version: "1.4.1",
  proxy: Object.freeze({
    sourceIdentity: "SafeProxy",
    address: "0xeD617CE7f82e2AB589aDeFFD319D1D872Bc8De06",
    runtimeCodeHash:
      "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
  }),
  singleton: Object.freeze({
    sourceIdentity: "Safe",
    address: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
    runtimeCodeHash:
      "0x1fe2df852ba3299d6534ef416eefa406e56ced995bca886ab7a553e6d0c5e1c4",
  }),
  fallbackHandler: Object.freeze({
    sourceIdentity: "CompatibilityFallbackHandler",
    address: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
    runtimeCodeHash:
      "0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9",
  }),
  sourcifyExactMatchClaimed: false,
});
const SAFE_SOURCE_COMMITMENT = canonicalSha256(
  SAFE_SOURCE_SUBJECT.schemaVersion,
  SAFE_SOURCE_SUBJECT,
);
if (SAFE_SOURCE_COMMITMENT !==
  "sha256:4591dc35029cba2a869f91919cb3cf7e7c68f26727cc68e4b03d99cdf1bc2ebb") {
  throw new Error("Safe source commitment constant is inconsistent");
}
const ROBINHOOD_UNISWAP_REGISTRY_SOURCE = Object.freeze({
  repository: "Uniswap/contracts",
  commit: "4cfc406c8e34da3ce04e60657a7825075b64fd22",
  path: "deployments/json/4663.json",
  rawUrl:
    "https://raw.githubusercontent.com/Uniswap/contracts/4cfc406c8e34da3ce04e60657a7825075b64fd22/deployments/json/4663.json",
  sha256:
    "sha256:21964cefbfc24b0ee89e7427acf74d223ce5a50aeb4216a9bac361a6148dea15",
});
const ROBINHOOD_UNISWAP_EXTERNAL_ROOTS = Object.freeze([
  Object.freeze({
    contract: "poolManager",
    address: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
    runtimeCodeHash:
      "0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626",
    transactionHash:
      "0x4fb28d4935866f462582c6c931c6f2705e55f5be5eb178c7d8d9329a95c44c41",
    startBlock: "9070",
  }),
  Object.freeze({
    contract: "positionManager",
    address: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
    runtimeCodeHash:
      "0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2",
    transactionHash:
      "0x228c18ada6cb46b4fbcc18f4ec1519953415393e256fa8349aafbd5a2db037c8",
    startBlock: "9073",
  }),
  Object.freeze({
    contract: "stateView",
    address: "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b",
    runtimeCodeHash:
      "0x7d9c591e0956fd89d98feb4ffcfe8bf1f7a62bd485edd979fa21d104b49878a6",
    transactionHash:
      "0x3d61e2c9eeb482385b1aa436b9e8f812167ea579cc390e4f93bc5abde00582f4",
    startBlock: "9075",
  }),
  Object.freeze({
    contract: "v4Quoter",
    address: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
    runtimeCodeHash:
      "0xd707b1da8cb165e5ea35a3b4450d971eb562ec171e23492aa117036b78a868f6",
    transactionHash:
      "0x6bf436d72a17f87284ddcab43094689bd320dfb39b535213b9a0b669fabc4ab4",
    startBlock: "9074",
  }),
  Object.freeze({
    contract: "universalRouter",
    address: "0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99",
    runtimeCodeHash:
      "0xbe8e8191bb42d843c2e948a5a55772eaab864ce01e54dcd47c9d089170b302d5",
    transactionHash:
      "0xdfb76494e158d8dea4376160315239271636a18515207fd4526e574bc7eeb456",
    startBlock: "3347899",
  }),
]);
const ROBINHOOD_V4_RELEASE_IDENTITY = Object.freeze({
  policySource: Object.freeze({
    schemaVersion: "programmable.custom-launch-policy-source.v1",
    repository: "programmablehq/Launch-Policy",
    repositoryId: 1_320_171_831,
    protectedBranch: "main",
    verifiedMergeCommit: "987215867472229690e30e11000c626d58f46e16",
    verifiedTree: "284fb19f05cdf9b5b60b8bacfbd480f6b98decd3",
    artifacts: Object.freeze({
      descriptor: Object.freeze({
        path: "policy/custom-launch-admission-v4.json",
        digest:
          "sha256:99b4ccabdaaf143bad28a8f6af441a1b93e1f113d0179236328b7fa594d1f948",
      }),
      businessPolicy: Object.freeze({
        path: "policy/launch-policy.v1.json",
        digest:
          "sha256:31e6b286ca839b31cb1edfe30c05d9f334892f3d84377961dc10b93959c7e216",
      }),
      generatedBinding: Object.freeze({
        path: ".programmable/custom-launch-admission.v4.json",
        digest:
          "sha256:f31643e6e9ff6d5409d59a2fc3ac7fb5ac9cfcb3af08e95c9478bc95ddfa66a2",
      }),
      schema: Object.freeze({
        path: "policy/schemas/custom-launch-admission-v4.schema.json",
        digest:
          "sha256:a28a6de6208d6ba7b65b4b706174509570955ba9ce9714624bcb2046ab7beae7",
      }),
    }),
  }),
});

// These are preparation trust roots, not deployment evidence. Promotion stays
// impossible until a reviewed release replaces the three null finalized
// values and pins the complete artifact, receipt and canary objects below.
const ROBINHOOD_FINALIZED_V4_PROMOTION_ANCHOR = Object.freeze({
  chainId: 4663,
  caip2: "eip155:4663",
  chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
  chainDeploymentDescriptorDigest: null,
  chainDeployment: null,
  foundationSourceCommitment: ROBINHOOD_FOUNDATION_SOURCE_COMMITMENT,
  profile: Object.freeze({
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
  }),
  finalityPolicy: Object.freeze({
    schemaVersion: FINALITY_SCHEMA,
    policyId: "robinhood-stage-finality-v1",
    policyRevision: 1,
    policyDigest:
      "sha256:537d531423d1285a3808556a57303ec68f1e6bdeea3c9aaf6320f9e5a0e47153",
  }),
  router: Object.freeze({
    address: "0x34965F2A2ee9254522232C32F02056E92BE0C98a",
    runtimeCodeHash:
      "0x1dbbdaaad901ea3c6134dca0d4872a4789b3c071bf8ccfb44edd65d26d817388",
    startBlock: null,
    abiSha256:
      "sha256:bb4e728e9f9c850eb01f928e8a798ac206a82e241a8d93b3b3c686635c88ed86",
    artifact: null,
    deploymentEvidence: null,
    canaryEvidence: null,
  }),
  bindings: Object.freeze({
    permitAuthority: "0xeD617CE7f82e2AB589aDeFFD319D1D872Bc8De06",
    permitAuthorityRuntimeCodeHash:
      "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
    graphFactory: "0x0B6b3F40f84Df25D3bd69238f937096177DD09Bd",
    graphFactoryRuntimeCodeHash:
      "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
    poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
    poolManagerRuntimeCodeHash:
      "0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626",
  }),
});

const lastKnownGoodByChain = new Map();
const currentCacheByChain = new Map();
const inFlightByChain = new Map();

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function sameHex(left, right) {
  return typeof left === "string" && typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase();
}

function isChecksummedAddress(value) {
  if (!ADDRESS.test(value ?? "")) return false;
  const lower = value.slice(2).toLowerCase();
  const digest = keccak256(new TextEncoder().encode(lower)).slice(2);
  let expected = "0x";
  for (let index = 0; index < lower.length; index += 1) {
    expected += Number.parseInt(digest[index], 16) >= 8
      ? lower[index].toUpperCase()
      : lower[index];
  }
  return value === expected;
}

function safeInstant(value) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? value
    : null;
}

function safeSourceVerificationInstant(value) {
  return typeof value === "string" && SOURCE_VERIFICATION_INSTANT.test(value)
    ? safeInstant(value)
    : null;
}

function safeText(value, maximum, allowEmpty = false) {
  return typeof value === "string" && value.length <= maximum &&
      (allowEmpty || value.length > 0) && value.trim() === value &&
      value.normalize("NFC") === value && !PROHIBITED_TEXT.test(value)
    ? value
    : null;
}

function canonicalHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0 &&
      parsed.username === "" && parsed.password === "" &&
      (parsed.href === value || (
        parsed.origin === value && parsed.pathname === "/" &&
        parsed.search === "" && parsed.hash === ""
      ));
  } catch {
    return false;
  }
}

function canonicalPublicImageUri(value) {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    return ["https:", "ipfs:", "ar:"].includes(parsed.protocol) &&
      parsed.username === "" && parsed.password === "" &&
      parsed.href === value;
  } catch {
    return false;
  }
}

function validProfile(value) {
  if (!(
    exactKeys(value, [
      "admissionBindingDigest", "admissionDescriptorDigest",
      "admissionPolicyDigest", "admissionSchemaDigest", "businessProfileId",
      "profileDigest", "profileRevision", "profileVersion", "schemaVersion",
      "structuralProfileId",
    ]) && value.schemaVersion === PROFILE_SCHEMA &&
      value.structuralProfileId ===
        "programmable.custom-launch.robinhood-mainnet.v1" &&
      value.businessProfileId === "robinhood-production-launch" &&
      value.admissionDescriptorDigest ===
        "sha256:99b4ccabdaaf143bad28a8f6af441a1b93e1f113d0179236328b7fa594d1f948" &&
      value.admissionPolicyDigest ===
        "sha256:31e6b286ca839b31cb1edfe30c05d9f334892f3d84377961dc10b93959c7e216" &&
      value.admissionSchemaDigest ===
        "sha256:a28a6de6208d6ba7b65b4b706174509570955ba9ce9714624bcb2046ab7beae7" &&
      value.admissionBindingDigest ===
        "sha256:f31643e6e9ff6d5409d59a2fc3ac7fb5ac9cfcb3af08e95c9478bc95ddfa66a2" &&
      value.profileRevision === 1 && value.profileVersion === "4.0.0" &&
      value.profileDigest ===
        "sha256:484b1dc6e9091804fabc230f2b3a7504940fa00264f8e66e82a66a951e71f1a0"
  )) return false;
  const { profileDigest, ...withoutDigest } = value;
  return canonicalSha256(PROFILE_SCHEMA, withoutDigest) === profileDigest;
}

function validFinalityPolicy(value) {
  return Boolean(
    exactKeys(value, [
      "policyDigest", "policyId", "policyRevision", "schemaVersion",
    ]) && value.schemaVersion === FINALITY_SCHEMA &&
      safeText(value.policyId, 128) !== null &&
      Number.isSafeInteger(value.policyRevision) &&
      value.policyRevision >= 1 && SHA256.test(value.policyDigest ?? ""),
  );
}

function profileMatches(left, right) {
  return validProfile(left) && validProfile(right) &&
    canonicalizeJson(left) === canonicalizeJson(right);
}

function finalityMatches(left, right) {
  return validFinalityPolicy(left) && validFinalityPolicy(right) &&
    canonicalizeJson(left) === canonicalizeJson(right);
}

function exactDeploymentEvidence(value, router) {
  return Boolean(
    value && value.verificationStatus === "finalized-verified" &&
      sameHex(value.address, router.address) &&
      HASH32.test(value.deploymentTransactionHash ?? "") &&
      DECIMAL.test(value.deploymentBlockNumber ?? "") &&
      HASH32.test(value.deploymentBlockHash ?? "") &&
      DECIMAL.test(value.finalizedBlockNumber ?? "") &&
      HASH32.test(value.finalizedBlockHash ?? "") &&
      sameHex(value.runtimeCodeKeccak256, router.runtimeCodeHash),
  );
}

function exactFinalizedCanary(value) {
  return Boolean(
    value?.finality === "finalized" &&
      HASH32.test(value.transactionHash ?? "") &&
      DECIMAL.test(value.blockNumber ?? "") &&
      HASH32.test(value.blockHash ?? "") && HASH32.test(value.launchId ?? ""),
  );
}

function promotionAnchorReady(anchor) {
  return Boolean(
    anchor && Number.isSafeInteger(anchor.chainId) && anchor.chainId >= 1 &&
      anchor.caip2 === `eip155:${anchor.chainId}` &&
      safeText(anchor.chainDeploymentId, 128) !== null &&
      HASH32.test(anchor.chainDeploymentDescriptorDigest ?? "") &&
      HASH32.test(anchor.foundationSourceCommitment ?? "") &&
      validProfile(anchor.profile) && validFinalityPolicy(anchor.finalityPolicy) &&
      validChainDeployment(anchor.chainDeployment, {
        chainId: anchor.chainId,
        caip2: anchor.caip2,
        chainDeploymentId: anchor.chainDeploymentId,
        foundationSourceCommitment: anchor.foundationSourceCommitment,
        finalityPolicy: anchor.finalityPolicy,
        profile: anchor.profile,
        chainDeployment: anchor.chainDeployment,
        routerStartBlock: anchor.router.startBlock,
        routerDeploymentEvidence: anchor.router.deploymentEvidence,
      }) &&
      ADDRESS.test(anchor.router?.address ?? "") &&
      HASH32.test(anchor.router?.runtimeCodeHash ?? "") &&
      DECIMAL.test(anchor.router?.startBlock ?? "") &&
      BigInt(anchor.router?.startBlock ?? "0") > 0n &&
      SHA256.test(anchor.router?.abiSha256 ?? "") &&
      anchor.router?.artifact !== null &&
      exactDeploymentEvidence(anchor.router?.deploymentEvidence, anchor.router) &&
      exactFinalizedCanary(anchor.router?.canaryEvidence) &&
      ADDRESS.test(anchor.bindings?.permitAuthority ?? "") &&
      HASH32.test(anchor.bindings?.permitAuthorityRuntimeCodeHash ?? "") &&
      ADDRESS.test(anchor.bindings?.graphFactory ?? "") &&
      HASH32.test(anchor.bindings?.graphFactoryRuntimeCodeHash ?? "") &&
      ADDRESS.test(anchor.bindings?.poolManager ?? "") &&
      HASH32.test(anchor.bindings?.poolManagerRuntimeCodeHash ?? "") &&
      sameHex(
        anchor.chainDeployment.contracts.programmableLaunchStampRouter.address,
        anchor.router.address,
      ) && sameHex(
        anchor.chainDeployment.contracts.programmableLaunchStampRouter
          .runtimeCodeHash,
        anchor.router.runtimeCodeHash,
      ) && sameHex(
        anchor.chainDeployment.contracts.permitAuthority.address,
        anchor.bindings.permitAuthority,
      ) && sameHex(
        anchor.chainDeployment.contracts.permitAuthority.runtimeCodeHash,
        anchor.bindings.permitAuthorityRuntimeCodeHash,
      ) && sameHex(
        anchor.chainDeployment.contracts.graphFactory.address,
        anchor.bindings.graphFactory,
      ) && sameHex(
        anchor.chainDeployment.contracts.graphFactory.runtimeCodeHash,
        anchor.bindings.graphFactoryRuntimeCodeHash,
      ) && sameHex(
        anchor.chainDeployment.contracts.poolManager.address,
        anchor.bindings.poolManager,
      ) && sameHex(
        anchor.chainDeployment.contracts.poolManager.runtimeCodeHash,
        anchor.bindings.poolManagerRuntimeCodeHash,
      ),
  );
}

function bindingAgainstPromotionAnchor(manifest, anchor) {
  if (!promotionAnchorReady(anchor)) return null;
  const chainId = manifest?.chainId;
  const caip2 = `eip155:${chainId}`;
  const profile = manifest?.customLaunchV4?.profile;
  const finalityPolicy = manifest?.customLaunchV4?.finalityPolicy;
  const descriptorDigest =
    manifest?.customLaunchV4?.chainDeploymentDescriptorDigest;
  const router = manifest?.launchStampRouter;
  const permitAuthority = router?.bindings?.permitAuthority;
  const permitAuthorityRuntimeCodeHash =
    router?.bindings?.permitAuthorityRuntimeCodeHash;
  const graphFactory = router?.bindings?.graphFactory;
  const graphFactoryRuntimeCodeHash =
    router?.bindings?.graphFactoryRuntimeCodeHash;
  const poolManager = router?.bindings?.poolManager;
  const poolManagerRuntimeCodeHash =
    router?.bindings?.poolManagerRuntimeCodeHash;
  const api = manifest?.customLaunchV4?.api;
  const readModel = manifest?.extensions?.["programmable/read-model-v1"];
  const chain = manifest?.chains?.find((entry) => entry.chainId === chainId);
  if (
    !Number.isSafeInteger(chainId) || chainId < 1 || manifest.caip2 !== caip2 ||
    chainId !== anchor.chainId || manifest.caip2 !== anchor.caip2 ||
    manifest.customLaunchV4?.chainDeploymentId !==
      anchor.chainDeploymentId ||
    !sameHex(descriptorDigest, anchor.chainDeploymentDescriptorDigest) ||
    manifest.customLaunchV4?.foundationSourceCommitment !==
      anchor.foundationSourceCommitment ||
    canonicalizeJson(manifest.customLaunchV4?.releaseIdentity) !==
      canonicalizeJson(ROBINHOOD_V4_RELEASE_IDENTITY) ||
    !profileMatches(profile, anchor.profile) ||
    !finalityMatches(finalityPolicy, anchor.finalityPolicy) ||
    chain?.status !== "live" || chain.readModelStatus !== "ready" ||
    manifest.customLaunchV4?.status !== "live" || api?.status !== "live" ||
    readModel?.status !== "live" || readModel.absenceAuthoritative !== true ||
    readModel.lastKnownGoodScope !== "chain-id" ||
    router?.status !== "live" ||
    !sameHex(router.address, anchor.router.address) ||
    router.startBlock !== anchor.router.startBlock ||
    !sameHex(router.runtimeCodeHash, anchor.router.runtimeCodeHash) ||
    router.abiSha256 !== anchor.router.abiSha256 ||
    canonicalizeJson(router.artifact) !==
      canonicalizeJson(anchor.router.artifact) ||
    canonicalizeJson(router.deploymentEvidence) !==
      canonicalizeJson(anchor.router.deploymentEvidence) ||
    canonicalizeJson(router.canaryEvidence) !==
      canonicalizeJson(anchor.router.canaryEvidence) ||
    !canonicalHttpsUrl(router.artifact?.sourceRepository) ||
    !/^[0-9a-f]{40}$/u.test(router.artifact?.sourceCommit ?? "") ||
    !/^[0-9a-f]{40}$/u.test(router.artifact?.sourceTree ?? "") ||
    safeText(router.artifact?.sourcePath, 512) === null ||
    safeText(router.artifact?.artifactPath, 512) === null ||
    !exactDeploymentEvidence(router.deploymentEvidence, router) ||
    !exactFinalizedCanary(router.canaryEvidence) ||
    !sameHex(permitAuthority, anchor.bindings.permitAuthority) ||
    !sameHex(
      permitAuthorityRuntimeCodeHash,
      anchor.bindings.permitAuthorityRuntimeCodeHash,
    ) ||
    !sameHex(graphFactory, anchor.bindings.graphFactory) ||
    !sameHex(
      graphFactoryRuntimeCodeHash,
      anchor.bindings.graphFactoryRuntimeCodeHash,
    ) ||
    !sameHex(poolManager, anchor.bindings.poolManager) ||
    !sameHex(
      poolManagerRuntimeCodeHash,
      anchor.bindings.poolManagerRuntimeCodeHash,
    ) ||
    api.version !== "4.0.0" || !canonicalHttpsUrl(api.baseUrl) ||
    api.finalizedLaunchesPath !==
      `/v4/chains/${chainId}/finalized-custom-launches`
  ) {
    return null;
  }
  const sourceUrl = `${api.baseUrl}${api.finalizedLaunchesPath}`;
  if (
    chain.finalizedFeedUrl !== sourceUrl ||
    readModel.finalizedFeedUrl !== sourceUrl
  ) {
    return null;
  }
  const binding = {
    chainId,
    caip2,
    chainDeploymentId: manifest.customLaunchV4.chainDeploymentId,
    chainDeploymentDescriptorDigest: descriptorDigest.toLowerCase(),
    foundationSourceCommitment: anchor.foundationSourceCommitment,
    chainDeployment: structuredClone(anchor.chainDeployment),
    profile: structuredClone(profile),
    finalityPolicy: structuredClone(finalityPolicy),
    router: router.address.toLowerCase(),
    routerRuntimeCodeHash: router.runtimeCodeHash.toLowerCase(),
    routerStartBlock: router.startBlock,
    routerDeploymentEvidence: structuredClone(router.deploymentEvidence),
    permitAuthority: permitAuthority.toLowerCase(),
    permitAuthorityRuntimeCodeHash:
      permitAuthorityRuntimeCodeHash.toLowerCase(),
    graphFactory: graphFactory.toLowerCase(),
    graphFactoryRuntimeCodeHash: graphFactoryRuntimeCodeHash.toLowerCase(),
    poolManager: poolManager.toLowerCase(),
    poolManagerRuntimeCodeHash: poolManagerRuntimeCodeHash.toLowerCase(),
    sourceUrl,
    canaryBoundary: {
      blockNumber: router.canaryEvidence.blockNumber,
      blockHash: router.canaryEvidence.blockHash.toLowerCase(),
    },
  };
  return Object.freeze({
    ...binding,
    bindingKey: canonicalSha256(
      "programmable.custom-launch-v4-read-binding.v1",
      binding,
    ),
  });
}

export function activeFinalizedV4Binding(manifest) {
  return bindingAgainstPromotionAnchor(
    manifest,
    manifest?.chainId === 4663
      ? ROBINHOOD_FINALIZED_V4_PROMOTION_ANCHOR
      : null,
  );
}

function canonicalStaticBinding(value) {
  if (!exactKeys(value, ["argumentIndex", "argumentName", "staticSource"])) {
    return false;
  }
  if (value.staticSource === "not-deterministically-extractable") {
    return value.argumentIndex === null && value.argumentName === null;
  }
  return ["constructor-argument", "initializer-argument"].includes(
    value.staticSource,
  ) && Number.isSafeInteger(value.argumentIndex) && value.argumentIndex >= 0 &&
    safeText(value.argumentName, 256) !== null;
}

function canonicalTokenMetadataBinding(value) {
  return Boolean(
    exactKeys(value, [
      "declarationBinding", "name", "postDeploymentReadback",
      "schemaVersion", "standardReadModel", "symbol", "tokenTargetId",
    ]) &&
      value.schemaVersion ===
        "programmable.project-token-metadata-binding.v1" &&
      safeText(value.tokenTargetId, 128) !== null &&
      value.declarationBinding === "request-and-launch-id" &&
      exactKeys(value.standardReadModel, ["name", "symbol"]) &&
      typeof value.standardReadModel.name === "boolean" &&
      typeof value.standardReadModel.symbol === "boolean" &&
      canonicalStaticBinding(value.name) && canonicalStaticBinding(value.symbol) &&
      value.postDeploymentReadback === "required",
  );
}

function canonicalPresentationImage(value) {
  return Boolean(
    exactKeys(value, [
      "byteLength", "contentSha256", "height", "mediaType", "uri", "width",
    ]) && canonicalPublicImageUri(value.uri) &&
      SHA256.test(value.contentSha256 ?? "") &&
      ["image/png", "image/gif"].includes(
        value.mediaType,
      ) && Number.isSafeInteger(value.byteLength) && value.byteLength >= 1 &&
      value.byteLength <= 5_242_880 &&
      Number.isSafeInteger(value.width) && value.width >= 1 &&
      value.width <= 8_192 && Number.isSafeInteger(value.height) &&
      value.height >= 1 && value.height <= 8_192 &&
      value.width * value.height <= 4_194_304,
  );
}

function canonicalPresentation(value) {
  if (!exactKeys(value, ["description", "image", "links", "schemaVersion"]) ||
    value.schemaVersion !== "programmable.launch-presentation-draft.v1" ||
    safeText(value.description, 4_096, true) === null ||
    Buffer.byteLength(value.description, "utf8") < 20 ||
    Buffer.byteLength(value.description, "utf8") > 4_096 ||
    (value.description.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 8 ||
    !canonicalPresentationImage(value.image) || !Array.isArray(value.links) ||
    value.links.length > 32) {
    return false;
  }
  const seen = new Set();
  const counts = new Map();
  let previous = null;
  for (const link of value.links) {
    if (!exactKeys(link, ["kind", "uri"]) ||
      ![
        "website", "documentation", "x", "telegram", "discord", "github",
        "other",
      ].includes(link.kind) || !canonicalHttpsUrl(link.uri)) {
      return false;
    }
    const key = `${link.kind}\u0000${link.uri}`;
    if (seen.has(key) || (previous !== null && Buffer.compare(
      Buffer.from(previous, "utf8"),
      Buffer.from(key, "utf8"),
    ) >= 0)) return false;
    seen.add(key);
    counts.set(link.kind, (counts.get(link.kind) ?? 0) + 1);
    if (link.kind === "x" &&
      !/^https:\/\/x\.com\/[A-Za-z0-9_]{1,64}$/u.test(link.uri)) {
      return false;
    }
    previous = key;
  }
  return counts.get("website") === 1 && counts.get("x") === 1;
}

function canonicalProjectMetadata(value, expectedDigest) {
  if (!exactKeys(value, [
    "presentation", "schemaVersion", "token", "tokenMetadataBinding",
  ]) || value.schemaVersion !== "programmable.project-metadata.v1" ||
    !exactKeys(value.token, ["name", "symbol"]) ||
    safeText(value.token.name, 64) === null ||
    safeText(value.token.symbol, 16) === null ||
    !canonicalPresentation(value.presentation) ||
    !canonicalTokenMetadataBinding(value.tokenMetadataBinding)) {
    return false;
  }
  return canonicalSha256("programmable.project-metadata.v1", value) ===
    expectedDigest;
}

function projectedPresentation(projectMetadata) {
  const presentation = projectMetadata.presentation;
  const description = presentation.description.length > 0
    ? presentation.description
    : null;
  const links = {};
  const ambiguous = new Set();
  const mapped = new Map([
    ["website", "website"], ["documentation", "docs"], ["x", "x"],
    ["telegram", "telegram"], ["discord", "discord"], ["github", "github"],
  ]);
  for (const link of presentation.links) {
    const key = mapped.get(link.kind);
    if (!key) continue;
    if (Object.hasOwn(links, key)) {
      delete links[key];
      ambiguous.add(key);
    } else if (!ambiguous.has(key)) {
      links[key] = link.uri;
    }
  }
  return {
    description,
    image: presentation.image?.uri ?? null,
    website: links.website ?? null,
    x: links.x ?? null,
    telegram: links.telegram ?? null,
    discord: links.discord ?? null,
    github: links.github ?? null,
    docs: links.docs ?? null,
    trustStatus: "creator-declared",
  };
}

function validCommitments(value) {
  return exactKeys(value, [
    "fundingPermit", "graph", "launchIntent", "metadata", "sourceBuild",
    "verification",
  ]) && Object.values(value).every((digest) => SHA256.test(digest ?? ""));
}

function validContractBinding(value) {
  return exactKeys(value, ["address", "runtimeCodeHash"]) &&
    ADDRESS.test(value.address ?? "") && HASH32.test(value.runtimeCodeHash ?? "") &&
    !/^0x0{40}$/iu.test(value.address) && !/^0x0{64}$/iu.test(value.runtimeCodeHash);
}

function positiveDecimal(value) {
  return DECIMAL.test(value ?? "") && BigInt(value) > 0n;
}

function nonzeroHash32(value) {
  return HASH32.test(value ?? "") && !/^0x0{64}$/iu.test(value);
}

function validSafeProvider(value, providerId, trustDomain) {
  if (!exactKeys(value, ["evidenceDigest", "providerId", "trustDomain"]) ||
    value.providerId !== providerId || value.trustDomain !== trustDomain ||
    !SHA256.test(value.evidenceDigest ?? "")) {
    return false;
  }
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(
    "programmable.safe-configuration-provider-evidence.v1",
    withoutDigest,
  ) === evidenceDigest;
}

function validEthereumFinalityEvidence(value, profile) {
  if (!exactKeys(value, [
    "batchNumber", "ethereumFinalizedCheckpoint", "ethereumProviders",
    "evidenceDigest", "l2Checkpoint", "l2Providers", "observedAt",
    "postingBlockHash", "postingBlockNumber", "postingLogIndex",
    "postingTransactionHash", "profile", "rollup", "schemaVersion",
    "sequencerInbox",
  ]) || value.schemaVersion !== ETHEREUM_FINALITY_EVIDENCE_SCHEMA ||
    !profileMatches(value.profile, profile) ||
    !exactKeys(value.l2Checkpoint, ["blockHash", "blockNumber"]) ||
    !positiveDecimal(value.l2Checkpoint.blockNumber) ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(value.l2Checkpoint.blockHash ?? "") ||
    !positiveDecimal(value.batchNumber) ||
    !Array.isArray(value.l2Providers) || value.l2Providers.length !== 2 ||
    !exactKeys(value.l2Providers[0], [
      "l1Confirmations", "providerId", "trustDomain",
    ]) || value.l2Providers[0].providerId !== "quicknode" ||
    value.l2Providers[0].trustDomain !== "quicknode.com" ||
    !positiveDecimal(value.l2Providers[0].l1Confirmations) ||
    !exactKeys(value.l2Providers[1], [
      "l1Confirmations", "providerId", "trustDomain",
    ]) || value.l2Providers[1].providerId !== "alchemy" ||
    value.l2Providers[1].trustDomain !== "alchemy.com" ||
    !positiveDecimal(value.l2Providers[1].l1Confirmations) ||
    !Array.isArray(value.ethereumProviders) ||
    canonicalizeJson(value.ethereumProviders) !== canonicalizeJson([
      { providerId: "drpc", trustDomain: "drpc.org" },
      { providerId: "quicknode", trustDomain: "quicknode.com" },
    ]) || value.rollup !== "0x23A19d23e89166adedbDcB432518AB01e4272D94" ||
    value.sequencerInbox !== "0xBd0D173EEb87D57A09521c24388a12789F33ba96" ||
    !isChecksummedAddress(value.rollup) ||
    !isChecksummedAddress(value.sequencerInbox) ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(
      value.postingTransactionHash ?? "",
    ) || !positiveDecimal(value.postingBlockNumber) ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(value.postingBlockHash ?? "") ||
    !DECIMAL.test(value.postingLogIndex ?? "") ||
    !exactKeys(value.ethereumFinalizedCheckpoint, [
      "blockHash", "blockNumber", "tag",
    ]) || !positiveDecimal(value.ethereumFinalizedCheckpoint.blockNumber) ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(
      value.ethereumFinalizedCheckpoint.blockHash ?? "",
    ) || value.ethereumFinalizedCheckpoint.tag !== "finalized" ||
    safeInstant(value.observedAt) === null ||
    !SHA256.test(value.evidenceDigest ?? "") ||
    BigInt(value.ethereumFinalizedCheckpoint.blockNumber) <
      BigInt(value.postingBlockNumber)) {
    return false;
  }
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(ETHEREUM_FINALITY_EVIDENCE_SCHEMA, withoutDigest) ===
    evidenceDigest;
}

function validSafeConfigurationEvidence(value, profile) {
  if (!exactKeys(value, [
    "blockHash", "blockNumber", "evidenceDigest", "fallbackHandler",
    "fallbackHandlerRuntimeCodeHash", "fallbackHandlerSlot", "finalized",
    "ethereumFinalityEvidence", "guard", "guardSlot", "modules",
    "modulesNext", "nonce", "owners", "primaryProvider",
    "proxyRuntimeCodeHash", "schemaVersion", "secondaryProvider",
    "singleton", "singletonSlot", "threshold", "atomicRootStateEvidenceDigest",
  ]) || value.schemaVersion !== SAFE_CONFIGURATION_EVIDENCE_SCHEMA ||
    value.finalized !== true || !positiveDecimal(value.blockNumber) ||
    !nonzeroHash32(value.blockHash) ||
    value.proxyRuntimeCodeHash !==
      "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c" ||
    !exactKeys(value.singleton, [
      "address", "runtimeCodeHash", "sourceCommitment", "version",
    ]) || value.singleton.address !==
      "0x41675C099F32341bf84BFc5382aF534df5C7461a" ||
    value.singleton.runtimeCodeHash !==
      "0x1fe2df852ba3299d6534ef416eefa406e56ced995bca886ab7a553e6d0c5e1c4" ||
    value.singleton.version !== "1.4.1" ||
    value.singleton.sourceCommitment !== SAFE_SOURCE_COMMITMENT ||
    value.fallbackHandler !==
      "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99" ||
    value.fallbackHandlerRuntimeCodeHash !==
      "0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9" ||
    canonicalizeJson(value.owners) !== canonicalizeJson([
      "0x032b1c7b96793717F0BD2f11eb86cd10CdefC4a3",
      "0x2Bb333d48DFAF1596D9036671d2E43168994249E",
    ]) || value.threshold !== 1 || value.nonce !== "0" ||
    canonicalizeJson(value.modules) !== "[]" || value.guard !== null ||
    value.modulesNext !==
      "0x0000000000000000000000000000000000000001" ||
    value.singletonSlot !==
      "0x00000000000000000000000041675c099f32341bf84bfc5382af534df5c7461a" ||
    value.fallbackHandlerSlot !==
      "0x000000000000000000000000fd0732dc9e303f09fcef3a7388ad10a83459ec99" ||
    value.guardSlot !== `0x${"0".repeat(64)}` ||
    !validSafeProvider(value.primaryProvider, "quicknode", "quicknode.com") ||
    !validSafeProvider(value.secondaryProvider, "alchemy", "alchemy.com") ||
    !SHA256.test(value.atomicRootStateEvidenceDigest ?? "") ||
    !validEthereumFinalityEvidence(value.ethereumFinalityEvidence, profile) ||
    !SHA256.test(value.evidenceDigest ?? "")) {
    return false;
  }
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(SAFE_CONFIGURATION_EVIDENCE_SCHEMA, withoutDigest) ===
    evidenceDigest;
}

function validAtomicProviderReadback(
  value,
  providerId,
  trustDomain,
  transactionHash,
) {
  if (!exactKeys(value, [
    "evidenceDigest", "providerId", "transactionHash",
    "transactionReceiptDigest", "transactionResponseDigest", "trustDomain",
  ]) || value.providerId !== providerId ||
    value.trustDomain !== trustDomain ||
    value.transactionHash !== transactionHash ||
    !SHA256.test(value.transactionResponseDigest ?? "") ||
    !SHA256.test(value.transactionReceiptDigest ?? "") ||
    !SHA256.test(value.evidenceDigest ?? "")) return false;
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(
    "programmable.robinhood-atomic-root-deployment-provider-readback.v1",
    withoutDigest,
  ) === evidenceDigest;
}

function validAtomicRootTransitionReadback(
  value,
  providerId,
  trustDomain,
  contract,
  address,
  runtimeCodeHash,
  deploymentBlockNumber,
  deploymentBlockHash,
) {
  if (!exactKeys(value, [
    "address", "contract", "deploymentBlockHash", "deploymentBlockNumber",
    "deploymentRuntimeCodeHash", "evidenceDigest", "preDeploymentBlockHash",
    "preDeploymentBlockNumber", "preDeploymentRuntimeCodeHash", "providerId",
    "schemaVersion", "trustDomain",
  ]) || value.schemaVersion !== ATOMIC_ROOT_TRANSITION_READBACK_SCHEMA ||
    value.providerId !== providerId || value.trustDomain !== trustDomain ||
    value.contract !== contract || value.address !== address ||
    value.preDeploymentBlockNumber !==
      (BigInt(deploymentBlockNumber) - 1n).toString(10) ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(
      value.preDeploymentBlockHash ?? "",
    ) || value.preDeploymentRuntimeCodeHash !==
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" ||
    value.deploymentBlockNumber !== deploymentBlockNumber ||
    value.deploymentBlockHash !== deploymentBlockHash ||
    value.deploymentRuntimeCodeHash !== runtimeCodeHash ||
    !SHA256.test(value.evidenceDigest ?? "")) return false;
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(
    ATOMIC_ROOT_TRANSITION_READBACK_SCHEMA,
    withoutDigest,
  ) === evidenceDigest;
}

function validAtomicResult(
  value,
  contract,
  address,
  runtimeCodeHash,
  deploymentBlockNumber,
  deploymentBlockHash,
) {
  if (!exactKeys(value, [
    "address", "contract", "previousBlockRuntimeCodeHash", "providerReadbacks",
    "runtimeCodeHash", "stateEvidenceDigest",
  ]) || value.contract !== contract || value.address !== address ||
    value.runtimeCodeHash !== runtimeCodeHash ||
    value.previousBlockRuntimeCodeHash !==
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" ||
    !Array.isArray(value.providerReadbacks) ||
    value.providerReadbacks.length !== 2 ||
    !validAtomicRootTransitionReadback(
      value.providerReadbacks[0], "quicknode", "quicknode.com", contract, address,
      runtimeCodeHash, deploymentBlockNumber, deploymentBlockHash,
    ) || !validAtomicRootTransitionReadback(
      value.providerReadbacks[1], "alchemy", "alchemy.com", contract, address,
      runtimeCodeHash, deploymentBlockNumber, deploymentBlockHash,
    ) || value.providerReadbacks[0].preDeploymentBlockHash !==
      value.providerReadbacks[1].preDeploymentBlockHash ||
    !SHA256.test(value.stateEvidenceDigest ?? "")) return false;
  const { stateEvidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(
    ATOMIC_ROOT_RESULT_STATE_SCHEMA,
    withoutDigest,
  ) === stateEvidenceDigest;
}

function validProgrammableDeploymentEvidence(value, binding) {
  if (!exactKeys(value, [
    "blockHash", "blockNumber", "calldataBytes", "calldataHash", "chainId",
    "coveredContracts", "deploymentId", "ethereumFinalityEvidence",
    "evidenceDigest", "from", "nonce", "providerReadbacks", "receiptLogs",
    "receiptLogsDigest", "receiptStatus", "resultingContracts", "schemaVersion",
    "selector", "sourceVerification", "to", "transactionHash",
    "transactionIndex", "valueWei",
  ]) || value.schemaVersion !== ATOMIC_DEPLOYMENT_EVIDENCE_SCHEMA ||
    value.deploymentId !== "robinhood-mainnet-custom-launch-v1" ||
    value.chainId !== "4663" || canonicalizeJson(value.coveredContracts) !==
      canonicalizeJson([
        "programmableLaunchStampRouter", "graphFactory", "permitAuthority",
      ]) || !nonzeroHash32(value.transactionHash) ||
    ![
      "0x032b1c7b96793717F0BD2f11eb86cd10CdefC4a3",
      "0x2Bb333d48DFAF1596D9036671d2E43168994249E",
    ].includes(value.from) ||
    value.to !== "0xcA11bde05977b3631167028862bE2a173976CA11" ||
    value.valueWei !== "0" || value.selector !== "0x82ad56cb" ||
    value.calldataHash !==
      "0x3ba04469085b17e12843a94c154a335c9c384837f8f6531f179cb4915fd237d9" ||
    value.calldataBytes !== 33_412 || !DECIMAL.test(value.nonce ?? "") ||
    !DECIMAL.test(value.transactionIndex ?? "") || value.receiptStatus !== "1" ||
    !positiveDecimal(value.blockNumber) ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(value.blockHash ?? "") ||
    !Array.isArray(value.receiptLogs) || value.receiptLogs.length > 1_024) {
    return false;
  }
  let previousLogIndex = -1n;
  for (const log of value.receiptLogs) {
    if (!exactKeys(log, ["address", "data", "logIndex", "topics"]) ||
      !ADDRESS.test(log.address ?? "") || !Array.isArray(log.topics) ||
      log.topics.length > 4 || log.topics.some((topic) =>
        !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(topic ?? "")) ||
      !/^0x(?:[0-9a-f]{2})*$/u.test(log.data ?? "") ||
      !DECIMAL.test(log.logIndex ?? "") ||
      BigInt(log.logIndex) <= previousLogIndex) return false;
    previousLogIndex = BigInt(log.logIndex);
  }
  if (canonicalSha256(
    "programmable.robinhood-atomic-root-deployment-receipt-logs.v1",
    value.receiptLogs,
  ) !== value.receiptLogsDigest ||
    !Array.isArray(value.providerReadbacks) ||
    value.providerReadbacks.length !== 2 ||
    !validAtomicProviderReadback(
      value.providerReadbacks[0], "quicknode", "quicknode.com", value.transactionHash,
    ) || !validAtomicProviderReadback(
      value.providerReadbacks[1],
      "alchemy",
      "alchemy.com",
      value.transactionHash,
    ) || !Array.isArray(value.resultingContracts) ||
    value.resultingContracts.length !== 3 || !validAtomicResult(
      value.resultingContracts[0],
      "permitAuthority",
      "0xeD617CE7f82e2AB589aDeFFD319D1D872Bc8De06",
      "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
      value.blockNumber,
      value.blockHash,
    ) || !validAtomicResult(
      value.resultingContracts[1],
      "graphFactory",
      "0x0B6b3F40f84Df25D3bd69238f937096177DD09Bd",
      "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
      value.blockNumber,
      value.blockHash,
    ) || !validAtomicResult(
      value.resultingContracts[2],
      "programmableLaunchStampRouter",
      "0x34965F2A2ee9254522232C32F02056E92BE0C98a",
      "0x1dbbdaaad901ea3c6134dca0d4872a4789b3c071bf8ccfb44edd65d26d817388",
      value.blockNumber,
      value.blockHash,
    ) || !validEthereumFinalityEvidence(
      value.ethereumFinalityEvidence,
      binding.profile,
    ) || value.ethereumFinalityEvidence.l2Checkpoint.blockNumber !==
      value.blockNumber || value.ethereumFinalityEvidence.l2Checkpoint.blockHash !==
      value.blockHash || !exactKeys(value.sourceVerification, [
      "officialSourcePinnedCoveredContracts",
      "sourcifyExactMatchCoveredContracts",
    ]) || canonicalizeJson(
      value.sourceVerification.sourcifyExactMatchCoveredContracts,
    ) !== canonicalizeJson([
      "programmableLaunchStampRouter", "graphFactory",
    ]) || canonicalizeJson(
      value.sourceVerification.officialSourcePinnedCoveredContracts,
    ) !== canonicalizeJson(["permitAuthority"]) ||
    !SHA256.test(value.evidenceDigest ?? "")) return false;
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(ATOMIC_DEPLOYMENT_EVIDENCE_SCHEMA, withoutDigest) ===
    evidenceDigest;
}

function validGenesisProviderReadback(value, providerId, trustDomain) {
  if (!exactKeys(value, [
    "blockHash", "blockNumber", "evidenceDigest", "providerId",
    "runtimeCodeHash", "schemaVersion", "trustDomain",
  ]) || value.schemaVersion !== GENESIS_PROVIDER_READBACK_SCHEMA ||
    value.providerId !== providerId || value.trustDomain !== trustDomain ||
    value.blockNumber !== "0" ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(value.blockHash ?? "") ||
    value.runtimeCodeHash !==
      "0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca" ||
    !SHA256.test(value.evidenceDigest ?? "")) return false;
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(GENESIS_PROVIDER_READBACK_SCHEMA, withoutDigest) ===
    evidenceDigest;
}

function validPermit2GenesisProvenance(value, contracts) {
  if (!exactKeys(value, [
    "address", "allocRuntimeCodeBytes", "evidenceDigest",
    "genesisSourceDigest", "genesisSourceUrl", "kind", "providerReadbacks",
    "schemaVersion", "startBlock",
  ]) || value.schemaVersion !== GENESIS_PROVENANCE_SCHEMA ||
    value.kind !== "genesis-predeploy" || value.startBlock !== "0" ||
    value.address !== "0x000000000022D473030F116dDEE9F6B43aC78BA3" ||
    value.genesisSourceUrl !==
      "https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-genesis.json" ||
    value.genesisSourceDigest !==
      "sha256:353e6f6441b47695b41cee0c3645cde8dd7492d2f7f574bfb6aa4371e41bb6ba" ||
    value.allocRuntimeCodeBytes !== 9_152 ||
    !Array.isArray(value.providerReadbacks) ||
    value.providerReadbacks.length !== 2 ||
    !validGenesisProviderReadback(
      value.providerReadbacks[0],
      "quicknode",
      "quicknode.com",
    ) || !validGenesisProviderReadback(
      value.providerReadbacks[1],
      "alchemy",
      "alchemy.com",
    ) || value.providerReadbacks[0].blockHash !==
      value.providerReadbacks[1].blockHash ||
    !SHA256.test(value.evidenceDigest ?? "") ||
    !sameHex(value.address, contracts.permit2.address) ||
    contracts.permit2.runtimeCodeHash !==
      "0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca") {
    return false;
  }
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(GENESIS_PROVENANCE_SCHEMA, withoutDigest) ===
    evidenceDigest;
}

function validPermitAuthoritySourceProvenance(value, contracts, profile) {
  if (!exactKeys(value, [
    "address", "blockHash", "blockNumber", "configurationEvidence",
    "evidenceDigest", "kind", "schemaVersion", "sourceCommitment",
    "transactionHash",
  ]) || value.schemaVersion !== DEPLOYMENT_EVIDENCE_SCHEMA ||
    value.kind !== "official-source-pinned" ||
    !sameHex(value.address, contracts.permitAuthority.address) ||
    !nonzeroHash32(value.transactionHash) ||
    !positiveDecimal(value.blockNumber) || !nonzeroHash32(value.blockHash) ||
    value.sourceCommitment !== SAFE_SOURCE_COMMITMENT ||
    !SHA256.test(value.evidenceDigest ?? "") ||
    !validSafeConfigurationEvidence(value.configurationEvidence, profile) ||
    !sameHex(
      value.configurationEvidence.proxyRuntimeCodeHash,
      contracts.permitAuthority.runtimeCodeHash,
    )) return false;
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(DEPLOYMENT_EVIDENCE_SCHEMA, withoutDigest) ===
    evidenceDigest;
}

function validExternalRootProviderReadback(
  value,
  providerId,
  trustDomain,
  expected,
) {
  const expectedPreviousBlockNumber = (BigInt(expected.startBlock) - 1n).toString(10);
  if (!exactKeys(value, [
    "blockHash", "blockNumber", "evidenceDigest", "previousBlockHash",
    "previousBlockNumber", "previousBlockRuntimeCodeHash", "providerId",
    "rawTransactionDigest", "runtimeCodeHash", "transactionDigest",
    "transactionHash", "transactionReceiptDigest", "trustDomain",
  ]) || value.providerId !== providerId || value.trustDomain !== trustDomain ||
    !sameHex(value.transactionHash, expected.transactionHash) ||
    !SHA256.test(value.rawTransactionDigest ?? "") ||
    !SHA256.test(value.transactionDigest ?? "") ||
    value.previousBlockNumber !== expectedPreviousBlockNumber ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(value.previousBlockHash ?? "") ||
    value.previousBlockRuntimeCodeHash !== EMPTY_RUNTIME_CODE_HASH ||
    value.blockNumber !== expected.startBlock ||
    !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(value.blockHash ?? "") ||
    value.runtimeCodeHash !== expected.runtimeCodeHash ||
    !SHA256.test(value.transactionReceiptDigest ?? "") ||
    !SHA256.test(value.evidenceDigest ?? "")) return false;
  const { evidenceDigest, ...withoutDigest } = value;
  return canonicalSha256(
    EXTERNAL_DEPLOYMENT_PROVIDER_READBACK_SCHEMA,
    withoutDigest,
  ) === evidenceDigest;
}

function validExternalRootDeploymentEvidence(value, contracts) {
  if (!Array.isArray(value) ||
    value.length !== ROBINHOOD_UNISWAP_EXTERNAL_ROOTS.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    const evidence = value[index];
    const expected = ROBINHOOD_UNISWAP_EXTERNAL_ROOTS[index];
    const expectedPreviousBlockNumber = (BigInt(expected.startBlock) - 1n).toString(10);
    if (!exactKeys(evidence, [
      "address", "blockHash", "contract", "evidenceDigest", "kind",
      "previousBlockHash", "previousBlockNumber", "previousBlockRuntimeCodeHash",
      "providerReadbacks", "registrySource", "runtimeCodeHash", "schemaVersion",
      "startBlock", "transactionHash",
    ]) || evidence.schemaVersion !== DEPLOYMENT_EVIDENCE_SCHEMA ||
      evidence.kind !== "exact-observed-deployment" ||
      evidence.contract !== expected.contract ||
      !sameHex(evidence.address, expected.address) ||
      evidence.runtimeCodeHash !== expected.runtimeCodeHash ||
      evidence.transactionHash !== expected.transactionHash ||
      evidence.previousBlockNumber !== expectedPreviousBlockNumber ||
      !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(evidence.previousBlockHash ?? "") ||
      evidence.previousBlockRuntimeCodeHash !== EMPTY_RUNTIME_CODE_HASH ||
      evidence.startBlock !== expected.startBlock ||
      !sameHex(evidence.address, contracts[evidence.contract]?.address) ||
      !sameHex(
        evidence.runtimeCodeHash,
        contracts[evidence.contract]?.runtimeCodeHash,
      ) || !/^0x(?!0{64}$)[0-9a-f]{64}$/u.test(evidence.blockHash ?? "") ||
      canonicalizeJson(evidence.registrySource) !==
        canonicalizeJson(ROBINHOOD_UNISWAP_REGISTRY_SOURCE) ||
      !Array.isArray(evidence.providerReadbacks) ||
      evidence.providerReadbacks.length !== 2 ||
      !validExternalRootProviderReadback(
        evidence.providerReadbacks[0], "quicknode", "quicknode.com", expected,
      ) || !validExternalRootProviderReadback(
        evidence.providerReadbacks[1], "alchemy", "alchemy.com", expected,
      ) || evidence.providerReadbacks.some((readback) =>
        readback.previousBlockNumber !== evidence.previousBlockNumber ||
        readback.previousBlockHash !== evidence.previousBlockHash ||
        readback.blockHash !== evidence.blockHash) ||
      evidence.providerReadbacks[0].rawTransactionDigest !==
        evidence.providerReadbacks[1].rawTransactionDigest ||
      evidence.providerReadbacks[0].transactionDigest !==
        evidence.providerReadbacks[1].transactionDigest ||
      evidence.providerReadbacks[0].transactionReceiptDigest !==
        evidence.providerReadbacks[1].transactionReceiptDigest ||
      !SHA256.test(evidence.evidenceDigest ?? "")) {
      return false;
    }
    const { evidenceDigest, ...withoutDigest } = evidence;
    if (canonicalSha256(DEPLOYMENT_EVIDENCE_SCHEMA, withoutDigest) !==
      evidenceDigest) return false;
  }
  return true;
}

function validChainDeployment(value, binding) {
  if (!exactKeys(value, [
    "caip2", "chainDeploymentId", "chainId", "contracts",
    "deploymentEvidence", "externalRootDeploymentEvidence", "finality",
    "foundationSourceCommitment", "permit2GenesisProvenance",
    "permitAuthoritySourceProvenance", "schemaVersion",
  ]) || value.schemaVersion !== CHAIN_DEPLOYMENT_SCHEMA ||
    value.chainDeploymentId !== binding.chainDeploymentId ||
    value.chainId !== String(binding.chainId) || value.caip2 !== binding.caip2 ||
    value.foundationSourceCommitment !== binding.foundationSourceCommitment ||
    !finalityMatches(value.finality, binding.finalityPolicy) ||
    !validProgrammableDeploymentEvidence(value.deploymentEvidence, binding) ||
    !exactKeys(value.contracts, [
      "graphFactory", "permit2", "permitAuthority", "poolManager",
      "positionManager", "programmableLaunchStampRouter", "stateView",
      "universalRouter", "v4Quoter",
    ]) || !Object.values(value.contracts).every(validContractBinding) ||
    sameHex(
      value.contracts.programmableLaunchStampRouter.address,
      value.contracts.universalRouter.address,
    ) || !validPermit2GenesisProvenance(
      value.permit2GenesisProvenance,
      value.contracts,
    ) || !validPermitAuthoritySourceProvenance(
      value.permitAuthoritySourceProvenance,
      value.contracts,
      binding.profile,
    ) || !validExternalRootDeploymentEvidence(
      value.externalRootDeploymentEvidence,
      value.contracts,
    )) {
    return false;
  }
  const programmable = value.deploymentEvidence;
  const authority = value.permitAuthoritySourceProvenance;
  const safe = authority.configurationEvidence;
  const routerReceipt = binding.routerDeploymentEvidence;
  if (
    !sameHex(authority.transactionHash, programmable.transactionHash) ||
    authority.blockNumber !== programmable.blockNumber ||
    !sameHex(authority.blockHash, programmable.blockHash) ||
    safe.blockNumber !== programmable.blockNumber ||
    !sameHex(safe.blockHash, programmable.blockHash) ||
    safe.ethereumFinalityEvidence.l2Checkpoint.blockNumber !==
      programmable.blockNumber ||
    !sameHex(
      safe.ethereumFinalityEvidence.l2Checkpoint.blockHash,
      programmable.blockHash,
    ) ||
    canonicalizeJson(programmable.ethereumFinalityEvidence) !==
      canonicalizeJson(safe.ethereumFinalityEvidence) ||
    programmable.resultingContracts[0].stateEvidenceDigest !==
      safe.atomicRootStateEvidenceDigest ||
    programmable.resultingContracts.some((result) =>
      !sameHex(result.address, value.contracts[result.contract]?.address) ||
      !sameHex(
        result.runtimeCodeHash,
        value.contracts[result.contract]?.runtimeCodeHash,
      )) ||
    binding.routerStartBlock !== programmable.blockNumber ||
    routerReceipt?.deploymentBlockNumber !== programmable.blockNumber ||
    !sameHex(
      routerReceipt?.deploymentTransactionHash,
      programmable.transactionHash,
    ) || !sameHex(routerReceipt?.deploymentBlockHash, programmable.blockHash)
  ) return false;
  return canonicalizeJson(value) === canonicalizeJson(binding.chainDeployment);
}

function validFunding(value) {
  return exactKeys(value, ["mode", "schemaVersion", "valueWei"]) &&
    value.schemaVersion === FUNDING_SCHEMA &&
    ["none", "wallet-transaction-value"].includes(value.mode) &&
    DECIMAL.test(value.valueWei ?? "") &&
    (value.mode !== "none" || value.valueWei === "0") &&
    (value.mode !== "wallet-transaction-value" || value.valueWei !== "0");
}

function validLiquidityModel(value) {
  const models = [
    "none-empty-pool", "project-provided-liquidity", "hook-owned-liquidity",
    "externally-managed-position", "custom-bonding-or-curve",
  ];
  const states = [
    "pool-not-initialized", "pool-initialized-empty", "liquidity-required",
    "liquidity-provided-by-launch", "custom-settlement",
  ];
  if (!exactKeys(value, [
    "declaredLaunchState", "model", "schemaVersion", "targetIds",
  ]) || value.schemaVersion !== LIQUIDITY_SCHEMA ||
    !models.includes(value.model) || !states.includes(value.declaredLaunchState) ||
    !Array.isArray(value.targetIds) || value.targetIds.length > 16 ||
    value.targetIds.some((targetId) => safeText(targetId, 128) === null)) {
    return false;
  }
  const sorted = [...value.targetIds].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
  return new Set(value.targetIds).size === value.targetIds.length &&
    value.targetIds.every((targetId, index) => targetId === sorted[index]) &&
    (value.model !== "none-empty-pool" || value.targetIds.length === 0);
}

function sourceVerificationAggregateStatus(components) {
  if (components.every((component) => component.status === "exact_match")) {
    return "exact_match";
  }
  if (components.some((component) => component.status === "needs_attention")) {
    return "needs_attention";
  }
  if (components.some((component) => component.status === "retrying")) {
    return "retrying";
  }
  return "queued";
}

function validSourceVerification(value, binding) {
  if (!exactKeys(value, [
    "caip2", "chainDeploymentId", "chainId", "components", "schemaVersion",
    "status", "updatedAt",
  ]) || value.schemaVersion !== SOURCE_VERIFICATION_SCHEMA ||
    value.chainId !== String(binding.chainId) || value.caip2 !== binding.caip2 ||
    value.chainDeploymentId !== binding.chainDeploymentId ||
    ![
      "queued", "retrying", "exact_match", "needs_attention",
    ].includes(value.status) || !Array.isArray(value.components) ||
    value.components.length < 1 || value.components.length > 16 ||
    safeSourceVerificationInstant(value.updatedAt) === null) {
    return false;
  }

  let previousTargetId = null;
  let latestUpdatedAt = null;
  for (const component of value.components) {
    const hasNextAttemptAt = Object.hasOwn(component ?? {}, "nextAttemptAt");
    if (!exactKeys(component, [
      "address", "evidenceDigest", "exactMatchProvider", "status", "targetId",
      "updatedAt", ...(hasNextAttemptAt ? ["nextAttemptAt"] : []),
    ]) || !SOURCE_VERIFICATION_TARGET_ID.test(component.targetId ?? "") ||
      !LOWERCASE_ADDRESS.test(component.address ?? "") ||
      ![
        "queued", "retrying", "exact_match", "needs_attention",
      ].includes(component.status) ||
      safeSourceVerificationInstant(component.updatedAt) === null) {
      return false;
    }
    if (previousTargetId !== null && Buffer.compare(
      Buffer.from(previousTargetId, "utf8"),
      Buffer.from(component.targetId, "utf8"),
    ) >= 0) {
      return false;
    }
    previousTargetId = component.targetId;
    latestUpdatedAt = latestUpdatedAt === null || component.updatedAt > latestUpdatedAt
      ? component.updatedAt
      : latestUpdatedAt;

    if (component.status === "exact_match") {
      if (component.exactMatchProvider !== "sourcify-v2" ||
        !SHA256.test(component.evidenceDigest ?? "") || hasNextAttemptAt) {
        return false;
      }
      continue;
    }
    if (component.exactMatchProvider !== null || component.evidenceDigest !== null) {
      return false;
    }
    if (component.status === "needs_attention") {
      if (hasNextAttemptAt) return false;
      continue;
    }
    if (!hasNextAttemptAt ||
      safeSourceVerificationInstant(component.nextAttemptAt) === null) {
      return false;
    }
  }

  return value.status === sourceVerificationAggregateStatus(value.components) &&
    value.updatedAt === latestUpdatedAt;
}

function validOnchainEvidence(onchain, resource, binding) {
  return exactKeys(onchain, [
    "apiVersion", "blockHash", "blockNumber", "caip2", "chainDeployment",
    "chainDeploymentDescriptorDigest", "chainDeploymentId", "chainId",
    "checkpointType", "commitments", "evidenceDigest", "finalityPolicy",
    "logIndex", "observedAt", "profile", "router", "routerLaunchId",
    "routerRuntimeCodeHash", "schemaVersion", "terminal", "transactionHash",
  ]) && onchain.schemaVersion === ONCHAIN_SCHEMA && onchain.apiVersion === "v4" &&
    onchain.chainId === String(binding.chainId) && onchain.caip2 === binding.caip2 &&
    onchain.chainDeploymentId === binding.chainDeploymentId &&
    sameHex(
      onchain.chainDeploymentDescriptorDigest,
      binding.chainDeploymentDescriptorDigest,
    ) && canonicalizeJson(onchain.chainDeployment) ===
      canonicalizeJson(resource.chainDeployment) &&
    profileMatches(onchain.profile, binding.profile) &&
    sameHex(onchain.router, binding.router) &&
    sameHex(onchain.routerRuntimeCodeHash, binding.routerRuntimeCodeHash) &&
    HASH32.test(onchain.routerLaunchId ?? "") &&
    HASH32.test(onchain.transactionHash ?? "") &&
    DECIMAL.test(onchain.blockNumber ?? "") &&
    BigInt(onchain.blockNumber ?? "0") >= BigInt(binding.routerStartBlock) &&
    HASH32.test(onchain.blockHash ?? "") &&
    Number.isSafeInteger(onchain.logIndex) && onchain.logIndex >= 0 &&
    onchain.checkpointType === "ethereum_finalized" &&
    finalityMatches(onchain.finalityPolicy, binding.finalityPolicy) &&
    validCommitments(onchain.commitments) &&
    canonicalizeJson(onchain.commitments) === canonicalizeJson(resource.commitments) &&
    SHA256.test(onchain.evidenceDigest ?? "") && onchain.terminal === true &&
    safeInstant(onchain.observedAt) !== null;
}

function validateResource(resource, binding) {
  const onchain = resource?.onchain;
  if (!exactKeys(resource, [
    "apiVersion", "caip2", "chainDeployment", "chainDeploymentDescriptorDigest",
    "chainDeploymentId", "chainId", "commitments", "createdAt", "finalizedAt",
    "funding", "launchId", "liquidityModel", "onchain", "profile",
    "projectMetadata", "schemaVersion", "sourceVerification",
  ]) ||
    resource.schemaVersion !== RESOURCE_SCHEMA || resource.apiVersion !== "v4" ||
    !UUID.test(resource.launchId ?? "") ||
    resource.chainId !== String(binding.chainId) ||
    resource.caip2 !== binding.caip2 ||
    resource.chainDeploymentId !== binding.chainDeploymentId ||
    !sameHex(
      resource.chainDeploymentDescriptorDigest,
      binding.chainDeploymentDescriptorDigest,
    ) || !profileMatches(resource.profile, binding.profile) ||
    !validChainDeployment(resource.chainDeployment, binding) ||
    !validCommitments(resource.commitments) ||
    !canonicalProjectMetadata(
      resource.projectMetadata,
      resource.commitments.metadata,
    ) || safeInstant(resource.createdAt) === null ||
    safeInstant(resource.finalizedAt) === null ||
    Date.parse(resource.finalizedAt) < Date.parse(resource.createdAt) ||
    !validFunding(resource.funding) ||
    !validLiquidityModel(resource.liquidityModel) ||
    !validSourceVerification(resource.sourceVerification, binding) ||
    !validOnchainEvidence(onchain, resource, binding) ||
    Date.parse(onchain.observedAt) > Date.parse(resource.finalizedAt)) {
    throw new TypeError("Finalized V4 resource binding is invalid");
  }
  return Object.freeze({ resource });
}

function sortKey(onchain, resourceId) {
  return `${onchain.blockNumber.padStart(24, "0")}:0000000000:${String(
    onchain.logIndex,
  ).padStart(10, "0")}:${onchain.transactionHash.toLowerCase()}:${resourceId}`;
}

function projectResource(validated, binding) {
  const { resource } = validated;
  const onchain = resource.onchain;
  const extension = {
    schemaVersion: "programmable.backend-finalized-v4-projection.v1",
    sourceUrl: binding.sourceUrl,
    resourceId: resource.launchId,
    chainDeploymentId: binding.chainDeploymentId,
    chainDeploymentDescriptorDigest: binding.chainDeploymentDescriptorDigest,
    chainDeployment: structuredClone(resource.chainDeployment),
    foundationSourceCommitment: binding.foundationSourceCommitment,
    profile: structuredClone(binding.profile),
    router: binding.router,
    routerRuntimeCodeHash: binding.routerRuntimeCodeHash,
    routerLaunchId: onchain.routerLaunchId.toLowerCase(),
    finalityPolicy: structuredClone(binding.finalityPolicy),
    finalityEvidenceDigest: onchain.evidenceDigest,
    commitments: structuredClone(resource.commitments),
    projectMetadata: structuredClone(resource.projectMetadata),
    funding: structuredClone(resource.funding),
    liquidityModel: structuredClone(resource.liquidityModel),
    sourceVerification: structuredClone(resource.sourceVerification),
  };
  const record = {
    schemaVersion: "2.0.0",
    platformId: "programmable",
    publicLabel: "Programmable Custom",
    launchId: onchain.routerLaunchId.toLowerCase(),
    category: "custom",
    chainId: binding.chainId,
    caip2: binding.caip2,
    projectId: resource.launchId,
    model: { id: "custom-graph", version: binding.profile.profileVersion },
    token: null,
    launch: {
      status: "live",
      origin: "first-party",
      modelId: "custom-graph",
      modelVersion: binding.profile.profileVersion,
      publicSubmission: true,
      creatorAddress: null,
      transactionHash: onchain.transactionHash.toLowerCase(),
      blockNumber: onchain.blockNumber,
      blockHash: onchain.blockHash.toLowerCase(),
      transactionIndex: null,
      logIndex: onchain.logIndex,
      timestamp: null,
      finality: "finalized",
      launchWallet: null,
      observedAt: onchain.observedAt,
      confirmedAt: onchain.observedAt,
      finalizedAt: resource.finalizedAt,
      orphanedAt: null,
      revokedAt: null,
    },
    verification: {
      sourceId: "backend-finalized-custom-launches-v4",
      launcherAddress: binding.router,
      registryAddress: null,
      provenanceStatus: "verified",
      sourceUrl: binding.sourceUrl,
      approvalMatch: "unavailable",
      runtimeMatch: "matched",
      metadataTrust: "creator-declared",
    },
    presentation: projectedPresentation(resource.projectMetadata),
    capabilities: [],
    markets: [],
    fees: [],
    extensions: {
      "programmable/backend-finalized-v4": extension,
    },
    sortKey: sortKey(onchain, resource.launchId),
  };
  Object.defineProperty(record, TRUSTED_FINALIZED_V4_RECORD, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return record;
}

export function isTrustedFinalizedCustomV4Record(record) {
  return record?.[TRUSTED_FINALIZED_V4_RECORD] === true;
}

function trustedClone(record) {
  const clone = structuredClone(record);
  Object.defineProperty(clone, TRUSTED_FINALIZED_V4_RECORD, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return clone;
}

function cloneResult(value) {
  return {
    ...structuredClone({ ...value, records: undefined }),
    records: value.records.map(trustedClone),
  };
}

function shortError(error) {
  if (error?.name === "AbortError") return "request timed out";
  return (error instanceof Error ? error.message : "unknown source failure")
    .replace(/https?:\/\/\S+/gu, "finalized source")
    .replace(PROHIBITED_TEXT, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 240);
}

function unavailable(manifest, code, message) {
  return {
    records: [],
    status: "unavailable",
    generatedAt: manifest?.generatedAt ?? new Date(0).toISOString(),
    asOfBlock: null,
    asOfBlockHash: null,
    sourceIdentityCommitment: null,
    snapshotSha256: null,
    verifiedIdentityCount: 0,
    publishedIdentityCount: 0,
    quality: null,
    lastKnownGood: false,
    error: { code, message },
  };
}

function canonicalQuality(value) {
  if (!exactKeys(value, [
    "publishedRowCount", "quarantinedRowCount", "sourceRowCount", "status",
  ]) || !["ready", "partial", "stale", "unavailable"].includes(value.status)) {
    return false;
  }
  const counts = [
    value.sourceRowCount,
    value.publishedRowCount,
    value.quarantinedRowCount,
  ];
  return counts.every((count) =>
    Number.isSafeInteger(count) && count >= 0 && count <= 1_000_000) &&
    value.publishedRowCount <= value.sourceRowCount &&
    value.quarantinedRowCount ===
      value.sourceRowCount - value.publishedRowCount;
}

function validatePage(value, binding) {
  if (!exactKeys(value, [
    "apiVersion", "caip2", "chainId", "generatedAt", "launches",
    "nextCursor", "quality", "schemaVersion",
  ]) || value.schemaVersion !== LIST_SCHEMA || value.apiVersion !== "v4" ||
    value.chainId !== String(binding.chainId) || value.caip2 !== binding.caip2 ||
    safeInstant(value.generatedAt) === null || !canonicalQuality(value.quality) ||
    value.quality.status !== "ready" || !Array.isArray(value.launches) ||
    value.launches.length > 25 ||
    !(value.nextCursor === null || CURSOR.test(value.nextCursor))) {
    throw new TypeError("Finalized V4 feed envelope is invalid or not ready");
  }
  return value.launches.map((resource) => validateResource(resource, binding));
}

async function fetchPage(url, signal) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "programmable-developer-api/2",
    },
    redirect: "error",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Finalized V4 source returned HTTP ${response.status}`);
  }
  return readBoundedJson(
    response,
    RESPONSE_BYTES,
    "Finalized V4 response",
  );
}

async function loadCurrent(binding, loadPage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const seenCursors = new Set();
  const validated = [];
  let cursor = null;
  let firstGeneratedAt = null;
  let quality = null;
  try {
    for (let pageIndex = 0; pageIndex < MAXIMUM_PAGES; pageIndex += 1) {
      const url = new URL(binding.sourceUrl);
      url.searchParams.set("limit", "25");
      if (cursor !== null) url.searchParams.set("cursor", cursor);
      const page = await loadPage(url, controller.signal);
      const pageResources = validatePage(page, binding);
      firstGeneratedAt ??= page.generatedAt;
      if (quality !== null &&
        canonicalizeJson(quality) !== canonicalizeJson(page.quality)) {
        throw new TypeError("Finalized V4 quality changed during pagination");
      }
      quality ??= structuredClone(page.quality);
      validated.push(...pageResources);
      if (page.nextCursor === null) break;
      if (seenCursors.has(page.nextCursor)) {
        throw new TypeError("Finalized V4 cursor repeated");
      }
      seenCursors.add(page.nextCursor);
      cursor = page.nextCursor;
      if (pageIndex === MAXIMUM_PAGES - 1) {
        throw new TypeError("Finalized V4 pagination exceeded its bound");
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  if (validated.length !== quality.publishedRowCount) {
    throw new TypeError("Finalized V4 published row count is incomplete");
  }
  const launchIds = new Set();
  const resourceIds = new Set();
  const records = validated.map((item) => {
    const launchId = item.resource.onchain.routerLaunchId.toLowerCase();
    const resourceId = item.resource.launchId.toLowerCase();
    if (launchIds.has(launchId) || resourceIds.has(resourceId)) {
      throw new TypeError("Finalized V4 feed contains a duplicate chain identity");
    }
    launchIds.add(launchId);
    resourceIds.add(resourceId);
    return projectResource(item, binding);
  }).sort((left, right) => right.sortKey.localeCompare(left.sortKey));
  const newest = records[0] ?? null;
  const asOfBlock = newest?.launch.blockNumber ??
    binding.canaryBoundary.blockNumber;
  const asOfBlockHash = newest?.launch.blockHash ??
    binding.canaryBoundary.blockHash;
  const resources = validated.map(({ resource }) => resource);
  const snapshotSha256 = canonicalSha256(
    "programmable.custom-launch-v4-finalized-snapshot.v1",
    {
      bindingKey: binding.bindingKey,
      generatedAt: firstGeneratedAt,
      quality,
      resources,
    },
  );
  const sourceIdentityCommitment = canonicalSha256(
    "programmable.custom-launch-v4-source-identity.v1",
    {
      bindingKey: binding.bindingKey,
      snapshotSha256,
      asOfBlock,
      asOfBlockHash,
      publishedRowCount: quality.publishedRowCount,
    },
  );
  return {
    records,
    status: "current",
    generatedAt: firstGeneratedAt,
    asOfBlock,
    asOfBlockHash,
    sourceIdentityCommitment,
    snapshotSha256,
    verifiedIdentityCount: records.length,
    publishedIdentityCount: records.length,
    quality,
    lastKnownGood: false,
    error: null,
  };
}

async function loadWithLastKnownGood(manifest, binding, loadPage) {
  try {
    const current = await loadCurrent(binding, loadPage);
    lastKnownGoodByChain.set(binding.chainId, {
      bindingKey: binding.bindingKey,
      value: current,
    });
    currentCacheByChain.set(binding.chainId, {
      bindingKey: binding.bindingKey,
      expiresAt: Date.now() + CACHE_MS,
      value: current,
    });
    return cloneResult(current);
  } catch (error) {
    const lastKnownGood = lastKnownGoodByChain.get(binding.chainId);
    if (lastKnownGood?.bindingKey === binding.bindingKey) {
      const stale = {
        ...lastKnownGood.value,
        status: "last-known-good",
        lastKnownGood: true,
        error: {
          code: "CHAIN_FINALIZED_SOURCE_STALE",
          message: shortError(error),
        },
      };
      return cloneResult(stale);
    }
    return unavailable(
      manifest,
      "CHAIN_FINALIZED_SOURCE_UNAVAILABLE",
      shortError(error),
    );
  }
}

async function readWithResolvedBinding(
  manifest,
  binding,
  { loadPage = fetchPage, force = false } = {},
) {
  if (binding === null) {
    return unavailable(
      manifest,
      "CHAIN_READ_MODEL_PLANNED",
      "The exact live Router, finalized canary, chain deployment, profile and backend read-model binding are not published",
    );
  }
  const customLoader = loadPage !== fetchPage;
  const cached = currentCacheByChain.get(binding.chainId);
  if (!force && !customLoader && cached?.bindingKey === binding.bindingKey &&
    cached.expiresAt > Date.now()) {
    return cloneResult(cached.value);
  }
  if (!customLoader && !force) {
    const existing = inFlightByChain.get(binding.chainId);
    if (existing?.bindingKey === binding.bindingKey) return existing.promise;
    const promise = loadWithLastKnownGood(manifest, binding, loadPage)
      .finally(() => inFlightByChain.delete(binding.chainId));
    inFlightByChain.set(binding.chainId, { bindingKey: binding.bindingKey, promise });
    return promise;
  }
  return loadWithLastKnownGood(manifest, binding, loadPage);
}

export async function readFinalizedCustomLaunchesV4(manifest, options = {}) {
  return readWithResolvedBinding(
    manifest,
    activeFinalizedV4Binding(manifest),
    options,
  );
}

export const finalizedV4FeedTestOnly = Object.freeze({
  bindingAgainstPromotionAnchor,
  read(manifest, promotionAnchor, options = {}) {
    return readWithResolvedBinding(
      manifest,
      bindingAgainstPromotionAnchor(manifest, promotionAnchor),
      options,
    );
  },
});

export function resetFinalizedV4FeedForTest() {
  lastKnownGoodByChain.clear();
  currentCacheByChain.clear();
  inFlightByChain.clear();
}
