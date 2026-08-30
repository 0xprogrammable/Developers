import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { canonicalSha256, canonicalizeJson } from "../../server/canonical.js";
import { keccak256 } from "../../server/keccak.js";

export const STAGE_BUNDLE_SCHEMA =
  "programmable.robinhood-custom-launch.stage-bundle.v1";
export const PROMOTION_BUNDLE_SCHEMA =
  "programmable.robinhood-custom-launch.promotion-bundle.v2";
export const DEVELOPERS_PROMOTION_INPUT_SCHEMA =
  "programmable.robinhood-custom-launch.developers-promotion-input.v1";
export const STAGE_RECEIPT_SCHEMA =
  "programmable.developers.vercel-stage-receipt.v2";
export const PROMOTION_PLAN_SCHEMA =
  "programmable.developers.vercel-promotion-plan.v2";
export const ROLLBACK_PLAN_SCHEMA =
  "programmable.developers.vercel-rollback-plan.v2";
export const PUBLIC_AUTHORIZATION_SCHEMA =
  "programmable.developers.vercel-public-authorization.v1";
export const PROMOTION_RECEIPT_SCHEMA =
  "programmable.developers.vercel-promotion-receipt.v2";
export const ROLLBACK_RECEIPT_SCHEMA =
  "programmable.developers.vercel-rollback-receipt.v2";
export const LIVE_SMOKE_SCHEMA =
  "programmable.developers.chain-4663-live-smoke.v1";
export const PLANNED_SMOKE_SCHEMA =
  "programmable.developers.chain-4663-planned-smoke.v1";
export const INDEXER_RELEASE_IDENTITY_SCHEMA =
  "programmable.robinhood-indexer-release-identity.v1";
export const INDEXER_DEPLOYMENT_RECEIPT_SCHEMA =
  "programmable.robinhood-indexer.envio-deployment-receipt.v1";
export const INDEXER_RELEASE_AUDIT_SCHEMA =
  "programmable.robinhood-indexer.release-audit.v1";
export const INDEXER_PUBLISHED_RELEASE_IDENTITY_SCHEMA =
  "programmable.robinhood-indexer.published-release-identity.v1";
export const INDEXER_PUBLISHED_DEPLOYMENT_RECEIPT_SCHEMA =
  "programmable.robinhood-indexer.published-envio-deployment-receipt.v1";
export const INDEXER_PROMOTION_EVIDENCE_SCHEMA =
  "programmable.developers.robinhood-indexer-promotion-evidence.v1";
export const INDEXER_PROTECTION_SNAPSHOT_SCHEMA =
  "programmable.robinhood-indexer.github-protection-snapshot.v1";
export const INDEXER_PROTECTED_REF_SCHEMA =
  "programmable.robinhood-indexer.github-protected-run.v1";
export const VERCEL_STAGE_PROTECTION_SCHEMA =
  "programmable.developers.vercel-stage-protection.v1";
export const GITHUB_RUN_EVIDENCE_SCHEMA =
  "programmable.developers.github-workflow-run-evidence.v1";
export const GITHUB_ARTIFACT_EVIDENCE_SCHEMA =
  "programmable.developers.github-actions-artifact-evidence.v1";
export const GITHUB_OWNER_DISPATCH_AUTHORIZATION_SCHEMA =
  "programmable.developers.github-owner-dispatch-authorization.v1";
export const VERCEL_PUBLIC_DEPLOYMENT_RESOLUTION_SCHEMA =
  "programmable.developers.vercel-public-deployment-resolution.v1";
export const PLANNED_DEPLOY_AUTHORIZATION_SCHEMA =
  "programmable.developers.vercel-planned-deploy-authorization.v1";
export const SOURCE_TRANSITION_SCHEMA =
  "programmable.developers.evidence-only-source-transition.v1";
export const PRE_MUTATION_STATE_SCHEMA =
  "programmable.developers.vercel-pre-mutation-state.v2";
export const PUBLIC_MUTATION_INTENT_SCHEMA =
  "programmable.developers.vercel-public-mutation-intent.v1";
export const PUBLIC_MUTATION_INTENT_PROVENANCE_SCHEMA =
  "programmable.developers.vercel-public-mutation-intent-provenance.v1";
export const PUBLIC_MUTATION_RECOVERY_ATTEMPT_PROVENANCE_SCHEMA =
  "programmable.developers.vercel-public-mutation-recovery-attempt-provenance.v1";
export const PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA =
  "programmable.developers.vercel-public-mutation-recovery-attempt.v1";
export const PUBLIC_MUTATION_RECOVERY_READINESS_SCHEMA =
  "programmable.developers.vercel-public-mutation-recovery-readiness.v1";
export const RECOVERED_PROMOTION_RECEIPT_SCHEMA =
  "programmable.developers.vercel-recovered-promotion-receipt.v1";
export const RECOVERED_ROLLBACK_RECEIPT_SCHEMA =
  "programmable.developers.vercel-recovered-rollback-receipt.v1";
export const PLANNED_DEPLOY_RECEIPT_SCHEMA =
  "programmable.developers.vercel-planned-deploy-receipt.v1";
export const PLANNED_PUBLIC_MUTATION_READINESS_SCHEMA =
  "programmable.developers.vercel-planned-public-mutation-readiness.v1";
export const PUBLIC_MUTATION_READINESS_SCHEMA =
  "programmable.developers.vercel-public-mutation-readiness.v1";
export const VERCEL_MUTATION_CONTROL_SCHEMA =
  "programmable.developers.vercel-mutation-control.v1";

export const CANONICAL_STAGE_BUNDLE_PATH =
  "release/robinhood-chain-4663/programmable-stage-bundle.json";
export const CANONICAL_PROMOTION_BUNDLE_PATH =
  "release/robinhood-chain-4663/programmable-promotion-bundle.json";
export const CANONICAL_INDEXER_RELEASE_IDENTITY_PATH =
  "docs/operations/releases/robinhood-chain-4663/robinhood-mainnet-indexer-release-identity.json";
export const CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH =
  "docs/operations/releases/robinhood-chain-4663/robinhood-mainnet-indexer-deployment-receipt.json";
export const CANONICAL_INDEXER_RELEASE_AUDIT_PATH =
  "docs/operations/releases/robinhood-chain-4663/robinhood-mainnet-indexer-release-audit.json";
export const PRODUCTION_ORIGIN = "https://developers.programmable.family";
export const VERCEL_CLI_VERSION = "59.10.0";

const CHAIN_ID = "4663";
const CAIP2 = "eip155:4663";
const CHAIN_DEPLOYMENT_ID = "robinhood-mainnet-custom-launch-v1";
const FOUNDATION_SOURCE_COMMITMENT =
  "0xe87f5edc2dc839bd87a26a80cb53f14b021e603a1753d27aae3a02862058d730";
const PREDEPLOYMENT_PATH =
  "contracts/deployments/robinhood-custom-launch-v1.predeployment.json";
const PREDEPLOYMENT_SHA256 =
  "sha256:2d58b964232d345f82aa7c7d58e678df03bf83828b9d95da42f3cd54ab03319e";
const LIVE_DEPLOYMENT_PATH =
  "contracts/deployments/robinhood-custom-launch-v1.json";
const CLI_RELEASE_BINDING_PATH =
  "docs/operations/releases/custom-launch-v4/cli-release-binding.json";
const SOURCE_VERIFICATION_SCHEMA =
  "programmable.robinhood-custom-launch.source-verification-closure.v2";
const SOURCE_CLOSURE_SCHEMA =
  "programmable.launch-cli-v4-source-closure.v1";
const CAPTURE_AUTHORIZATION_SCHEMA =
  "programmable.robinhood-custom-launch.capture-authorization.v1";
const CAPTURE_SUBJECT_PATH =
  "release/robinhood-chain-4663/programmable-postdeployment-capture.json";
const CAPTURE_ATTESTATION_PATH =
  "release/robinhood-chain-4663/programmable-postdeployment-capture.attestation.json";
const PRODUCTION_VERIFY_PROOF_PATH =
  "release/robinhood-chain-4663/production-verify-proof.json";
const PRODUCTION_VERIFY_ATTESTATION_PATH =
  "release/robinhood-chain-4663/production-verify-proof.attestation.json";
const CAPTURE_CLOSURE_SCHEMA =
  "programmable.robinhood-custom-launch.capture-closure.v3";
const CAPTURE_PROFILE_DIGEST =
  "sha256:a3149f6a013eae1ca0fd932e0da0ddb8b8796d880ef53800830bfaaf49fe56c4";
const CAPTURE_RPC_INVENTORY_SCHEMA =
  "programmable.robinhood-custom-launch.rpc-inventory.v2";
const CAPTURE_NORMALIZED_L2_STATE_SCHEMA =
  "programmable.robinhood-custom-launch.normalized-l2-state.v1";
const CAPTURE_INVENTORY_SCHEMA =
  "programmable.robinhood-custom-launch.capture-inventory.v3";
const CAPTURE_SOURCIFY_RESPONSE_CLOSURE_SCHEMA =
  "programmable.robinhood-custom-launch.sourcify-response-closure.v2";
const BACKEND_RELEASE_ASSETS_SCHEMA =
  "programmable.robinhood-custom-launch.backend-release-assets.v1";
const BACKEND_PROMOTION_BINDING_SCHEMA =
  "programmable.robinhood-custom-launch.backend-promotion-binding.v1";
const BACKEND_PROMOTION_PUBLIC_INPUT_PATH =
  "release/robinhood-chain-4663/backend-promotion-input.public.json";
const BACKEND_PROMOTION_PRIVATE_INPUT_PATH =
  "release/robinhood-chain-4663/backend-promotion-input.json";
const BACKEND_PROMOTION_ATTESTATION_PATH =
  "release/robinhood-chain-4663/backend-promotion-input.attestation.json";
const BACKEND_CAPTURE_AUTHORIZATION_SCHEMA =
  "programmable.robinhood-custom-launch.backend-capture-authorization.v1";
const BACKEND_RELEASE_AUTHORIZATION_SCHEMA =
  "programmable.launch-cli-v4-backend-release-authorization.v1";
const BACKEND_RELEASE_EVIDENCE_SCHEMA =
  "programmable.launch-cli-v4-backend-release-evidence.v1";
const BACKEND_REPOSITORY = "programmablehq/programmable-open-hook-v2-internal";
const BACKEND_REPOSITORY_ID = "1318883798";
const BACKEND_CAPTURE_WORKFLOW =
  ".github/workflows/capture-programmable-robinhood-promotion.yml";
const BACKEND_AUTHORIZATION_WORKFLOW =
  ".github/workflows/finalize-robinhood-custom-launch-promotion.yml";
const FLY_APP = "programmable-custom-launch-api";
const PROGRAMMABLE_REPOSITORY = "programmablehq/PROGRAMMABLE";
const PROGRAMMABLE_REPOSITORY_ID = "1314365508";
const PROGRAMMABLE_PROTECTED_REF = "refs/heads/production";
const CAPTURE_WORKFLOW =
  ".github/workflows/capture-robinhood-custom-launch-postdeployment.yml";
const SAFE_SOURCE_COMMITMENT =
  "sha256:4591dc35029cba2a869f91919cb3cf7e7c68f26727cc68e4b03d99cdf1bc2ebb";
const EMPTY_RUNTIME_CODE_HASH =
  "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_RUNTIME_CODE_HASH =
  "0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891";
const MULTICALL3_SELECTOR = "0x82ad56cb";
const OWNER_CALLDATA_HASH =
  "0x3ba04469085b17e12843a94c154a335c9c384837f8f6531f179cb4915fd237d9";
const OWNER_CALLDATA_BYTES = 33_412;
const SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
const SAFE_SINGLETON = "0x41675C099F32341bf84BFc5382aF534df5C7461a";
const SAFE_SINGLETON_RUNTIME_CODE_HASH =
  "0x1fe2df852ba3299d6534ef416eefa406e56ced995bca886ab7a553e6d0c5e1c4";
const SAFE_FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99";
const SAFE_FALLBACK_HANDLER_RUNTIME_CODE_HASH =
  "0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9";
const SAFE_MODULES_END_SENTINEL = "0x0000000000000000000000000000000000000001";
const SAFE_OWNERS = Object.freeze([
  "0x032b1c7b96793717F0BD2f11eb86cd10CdefC4a3",
  "0x2Bb333d48DFAF1596D9036671d2E43168994249E",
]);
const PERMIT2_GENESIS_RUNTIME_CODE_BYTES = 9_152;
const INDEXER_REPOSITORY = "programmablehq/programmable-indexer";
const INDEXER_REPOSITORY_ID = 1318021881;
const INDEXER_EVIDENCE_WORKFLOW_REF =
  "programmablehq/programmable-indexer/.github/workflows/publish-robinhood-indexer-release-evidence.yml@refs/heads/production";
const INDEXER_REQUIRED_CHECKS = Object.freeze(["Credential leak gate", "Repository checks"]);
const GITHUB_ACTIONS_APP_ID = 15368;
const MAX_INDEXER_RPC_CAPTURE_SKEW_MILLISECONDS = 5 * 60 * 1000;
const MAX_INDEXER_OBSERVATION_WINDOW_MILLISECONDS = 15 * 60 * 1000;
const MAX_INDEXER_AUDIT_DELAY_MILLISECONDS = 15 * 60 * 1000;
const MAX_INDEXER_ROLLBACK_EVIDENCE_AGE_MILLISECONDS = 24 * 60 * 60 * 1000;
const MAX_INDEXER_PROTECTED_PUBLICATION_DELAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const MAX_INDEXER_OWNER_PROTECTION_SNAPSHOT_AGE_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEVELOPERS_RELEASE_WORKFLOW_PATH = ".github/workflows/vercel-release.yml";
const DEVELOPERS_RELEASE_WORKFLOW_REF =
  `programmablehq/Developers/${DEVELOPERS_RELEASE_WORKFLOW_PATH}@refs/heads/main`;
const DEVELOPERS_RECOVERY_WORKFLOW_PATH =
  ".github/workflows/vercel-release-recovery.yml";
const DEVELOPERS_RECOVERY_WORKFLOW_REF =
  `programmablehq/Developers/${DEVELOPERS_RECOVERY_WORKFLOW_PATH}@refs/heads/main`;
const DEVELOPERS_REPOSITORY = "programmablehq/Developers";
const DEVELOPERS_PRODUCTION_ENVIRONMENT = "production";
const DEVELOPERS_PRODUCTION_ENVIRONMENT_ID = "19441858925";
const DEVELOPERS_CANONICAL_OWNER = Object.freeze({
  login: "hazarxyz",
  id: "258789013",
});
const PROMOTION_EVIDENCE_PATHS = Object.freeze([
  CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
  CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
  CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
  CANONICAL_PROMOTION_BUNDLE_PATH,
]);
const ENVIO_OWNER = "0xprogrammable";
const ENVIO_PROJECT = "programmable-indexer";
const ENVIO_HOST = "indexer.hyperindex.xyz";

const FINALITY_POLICY = Object.freeze({
  schemaVersion: "programmable.custom-launch-finality-policy-ref.v1",
  policyId: "robinhood-stage-finality-v1",
  policyRevision: 1,
  policyDigest:
    "sha256:537d531423d1285a3808556a57303ec68f1e6bdeea3c9aaf6320f9e5a0e47153",
});

const ROOTS = Object.freeze({
  programmableLaunchStampRouter: Object.freeze({
    address: "0x34965F2A2ee9254522232C32F02056E92BE0C98a",
    runtimeCodeHash:
      "0x1dbbdaaad901ea3c6134dca0d4872a4789b3c071bf8ccfb44edd65d26d817388",
  }),
  permitAuthority: Object.freeze({
    address: "0xeD617CE7f82e2AB589aDeFFD319D1D872Bc8De06",
    runtimeCodeHash:
      "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
  }),
  graphFactory: Object.freeze({
    address: "0x0B6b3F40f84Df25D3bd69238f937096177DD09Bd",
    runtimeCodeHash:
      "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
  }),
  poolManager: Object.freeze({
    address: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
    runtimeCodeHash:
      "0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626",
  }),
  positionManager: Object.freeze({
    address: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
    runtimeCodeHash:
      "0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2",
  }),
  stateView: Object.freeze({
    address: "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b",
    runtimeCodeHash:
      "0x7d9c591e0956fd89d98feb4ffcfe8bf1f7a62bd485edd979fa21d104b49878a6",
  }),
  v4Quoter: Object.freeze({
    address: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
    runtimeCodeHash:
      "0xd707b1da8cb165e5ea35a3b4450d971eb562ec171e23492aa117036b78a868f6",
  }),
  permit2: Object.freeze({
    address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    runtimeCodeHash:
      "0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca",
  }),
  universalRouter: Object.freeze({
    address: "0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99",
    runtimeCodeHash:
      "0xbe8e8191bb42d843c2e948a5a55772eaab864ce01e54dcd47c9d089170b302d5",
  }),
});

const CAPTURE_L2_PROVIDERS = Object.freeze([
  Object.freeze({ role: "primary", providerId: "drpc", trustDomain: "drpc.org" }),
  Object.freeze({ role: "secondary", providerId: "alchemy", trustDomain: "alchemy.com" }),
]);
const CAPTURE_ETHEREUM_PROVIDERS = Object.freeze([
  Object.freeze({ role: "primary", providerId: "drpc", trustDomain: "drpc.org" }),
  Object.freeze({ role: "secondary", providerId: "quicknode", trustDomain: "quicknode.com" }),
]);
const CAPTURE_L2_ENTRY_ORDER = Object.freeze([
  "chainId", "rawTransaction", "transaction", "receipt", "deploymentBlock",
  "predecessorBlock", "genesisBlock", "multicall3Code", "prePermitAuthorityCode",
  "preGraphFactoryCode", "preRouterCode", "permitAuthorityCode", "graphFactoryCode",
  "routerCode", "safeSingletonCode", "safeFallbackHandlerCode", "permit2GenesisCode",
  "poolManagerRawTransaction", "poolManagerTransaction", "poolManagerReceipt",
  "poolManagerBlock", "poolManagerPredecessorBlock", "poolManagerCreate2DeployerCode",
  "prePoolManagerCode", "poolManagerCode", "positionManagerRawTransaction",
  "positionManagerTransaction", "positionManagerReceipt", "positionManagerBlock",
  "positionManagerPredecessorBlock", "positionManagerCreate2DeployerCode",
  "prePositionManagerCode", "positionManagerCode", "stateViewRawTransaction",
  "stateViewTransaction", "stateViewReceipt", "stateViewBlock",
  "stateViewPredecessorBlock", "stateViewCreate2DeployerCode", "preStateViewCode",
  "stateViewCode", "v4QuoterRawTransaction", "v4QuoterTransaction", "v4QuoterReceipt",
  "v4QuoterBlock", "v4QuoterPredecessorBlock", "v4QuoterCreate2DeployerCode",
  "preV4QuoterCode", "v4QuoterCode", "universalRouterRawTransaction",
  "universalRouterTransaction", "universalRouterReceipt", "universalRouterBlock",
  "universalRouterPredecessorBlock", "universalRouterCreate2DeployerCode",
  "preUniversalRouterCode", "universalRouterCode",
  "routerPermitAuthority", "routerPermitAuthorityCodeHash", "routerGraphFactory",
  "routerGraphFactoryCodeHash", "routerPoolManager", "routerPoolManagerCodeHash",
  "routerChainId", "safeOwners", "safeThreshold", "safeNonce", "safeModules",
  "safeVersion", "safeSingletonSlot", "safeFallbackHandlerSlot", "safeGuardSlot",
  "findBatchContainingBlock", "getL1Confirmations",
]);
const CAPTURE_ETHEREUM_ENTRY_ORDER = Object.freeze([
  "chainId", "postingLogs", "postingReceipt", "postingBlock", "finalizedTag",
  "finalizedReread",
]);
const CAPTURE_ATOMIC_ROOT_ORDER = Object.freeze([
  "permitAuthority", "graphFactory", "programmableLaunchStampRouter",
]);
const CAPTURE_EXTERNAL_ROOTS = Object.freeze({
  poolManager: Object.freeze({
    ...ROOTS.poolManager,
    transactionHash:
      "0x4fb28d4935866f462582c6c931c6f2705e55f5be5eb178c7d8d9329a95c44c41",
    startBlock: "9070",
  }),
  positionManager: Object.freeze({
    ...ROOTS.positionManager,
    transactionHash:
      "0x228c18ada6cb46b4fbcc18f4ec1519953415393e256fa8349aafbd5a2db037c8",
    startBlock: "9073",
  }),
  stateView: Object.freeze({
    ...ROOTS.stateView,
    transactionHash:
      "0x3d61e2c9eeb482385b1aa436b9e8f812167ea579cc390e4f93bc5abde00582f4",
    startBlock: "9075",
  }),
  v4Quoter: Object.freeze({
    ...ROOTS.v4Quoter,
    transactionHash:
      "0x6bf436d72a17f87284ddcab43094689bd320dfb39b535213b9a0b669fabc4ab4",
    startBlock: "9074",
  }),
  universalRouter: Object.freeze({
    ...ROOTS.universalRouter,
    transactionHash:
      "0xdfb76494e158d8dea4376160315239271636a18515207fd4526e574bc7eeb456",
    startBlock: "3347899",
  }),
});

const SOURCE_ROOTS = Object.freeze({
  graphFactory: Object.freeze({
    ...ROOTS.graphFactory,
    compilerName: "ProgrammableCreate2GraphDeployerV1",
    fullyQualifiedName:
      "src/ProgrammableCreate2GraphDeployerV1.sol:ProgrammableCreate2GraphDeployerV1",
    standardJsonInputPath:
      "contracts/spec/robinhood-custom-launch/standard-json/ProgrammableCreate2GraphDeployerV1.standard-input.json",
    standardJsonInputSha256:
      "sha256:8ab811a215d70b1d5aef0c71a47153173953ee78d7632725413833888369ec4d",
  }),
  programmableLaunchStampRouter: Object.freeze({
    ...ROOTS.programmableLaunchStampRouter,
    compilerName: "ProgrammableLaunchStampRouterV1",
    fullyQualifiedName:
      "src/robinhood-custom-launch/ProgrammableLaunchStampRouterV1.sol:ProgrammableLaunchStampRouterV1",
    standardJsonInputPath:
      "contracts/spec/robinhood-custom-launch/standard-json/ProgrammableLaunchStampRouterV1.standard-input.json",
    standardJsonInputSha256:
      "sha256:6abca24d06b013599f4ff63e049976419c3f17455fa9bc343b15ec0d6e6a078a",
  }),
});

const FROZEN_V3_IDENTITY = Object.freeze({
  repository: "https://github.com/programmablehq/PROGRAMMABLE",
  packageName: "@programmable/launch",
  releaseVersion: "3.3.9",
  minimumSupportingVersion: "3.3.9",
  releaseUrl:
    "https://github.com/programmablehq/PROGRAMMABLE/releases/tag/programmable-launch-v3.3.9",
  tarballUrl:
    "https://github.com/programmablehq/PROGRAMMABLE/releases/download/programmable-launch-v3.3.9/programmable-launch-3.3.9.tgz",
  checksumUrl:
    "https://github.com/programmablehq/PROGRAMMABLE/releases/download/programmable-launch-v3.3.9/programmable-launch-3.3.9.tgz.sha256",
  tarballSha256:
    "sha256:44b71185355bea8db6820b61f12351db7cc1237aa7ecf9b0db3cfbb09bebee01",
  tarballByteLength: 309223,
  openApiUrl: "https://programmable.market/openapi/custom-launch-v3.json",
  openApiVersion: "3.3.9",
  openApiSha256:
    "sha256:8c7f90255f62bb8c27083c868dfdef5a7cc15d9ed0815248c55b67b7b9302b6a",
  packConfigSchemaUrl:
    "https://programmable.market/schemas/custom-launch/v3/pack-config.json",
  packConfigSchemaSha256:
    "sha256:65e80af492582b8e42a440d9bbb23a776af31e22306ec828208959e8a790be15",
  commands: Object.freeze(["pack", "validate", "submit", "status"]),
});

const ADDRESS = /^0x[0-9a-fA-F]{40}$/u;
const HASH32 = /^0x[0-9a-f]{64}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const DECIMAL = /^(0|[1-9][0-9]*)$/u;
const VERCEL_ID = /^dpl_[A-Za-z0-9]+$/u;
const RUN_ID = /^[1-9][0-9]*$/u;

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function plainObject(value, label) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  const object = plainObject(value, label);
  const actual = Object.keys(object).sort();
  const wanted = [...expected].sort();
  assert(actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    `${label} has an unsupported field set`);
  return object;
}

function exactSha256(value, label) {
  assert(typeof value === "string" && SHA256.test(value),
    `${label} must be a lowercase SHA-256 digest`);
  return value;
}

function exactHash32(value, label) {
  assert(typeof value === "string" && HASH32.test(value) &&
    value !== `0x${"0".repeat(64)}`, `${label} must be a nonzero lowercase bytes32`);
  return value;
}

function exactDecimal(value, label, positive = false) {
  assert(typeof value === "string" && DECIMAL.test(value),
    `${label} must be a canonical decimal string`);
  if (positive) assert(BigInt(value) > 0n, `${label} must be positive`);
  return value;
}

function exactInstant(value, label) {
  assert(typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value, `${label} must be a canonical UTC instant`);
  return value;
}

function exactSecondInstant(value, label) {
  assert(typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value.replace(/Z$/u, ".000Z"),
  `${label} must be a canonical UTC second`);
  return value;
}

function assertFreshTransition(checkedAt, completedAt, label) {
  const checkedTime = Date.parse(exactInstant(checkedAt, `${label} checkedAt`));
  const completedTime = Date.parse(exactInstant(completedAt, `${label} completedAt`));
  const elapsed = completedTime - checkedTime;
  assert(elapsed >= 0 && elapsed <= 5 * 60_000,
    `${label} must complete within five minutes of its provider re-query`);
}

function sameAddress(left, right) {
  return typeof left === "string" && typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase();
}

function exactChecksumAddress(value, label, expected = null) {
  assert(typeof value === "string" && ADDRESS.test(value),
    `${label} must be an EIP-55 address`);
  const lower = value.slice(2).toLowerCase();
  const digest = keccak256(new TextEncoder().encode(lower)).slice(2);
  let checksum = "0x";
  for (let index = 0; index < lower.length; index += 1) {
    const character = lower[index];
    checksum += /[a-f]/u.test(character) && Number.parseInt(digest[index], 16) >= 8
      ? character.toUpperCase()
      : character;
  }
  assert(value === checksum && (expected === null || value === expected),
    `${label} must match the exact EIP-55 address`);
  return value;
}

function exactStorageWord(value, label, expectedAddress = null) {
  assert(typeof value === "string" && /^0x[0-9a-f]{64}$/u.test(value),
    `${label} must be a lowercase storage word`);
  if (expectedAddress !== null) {
    assert(value === `0x${"0".repeat(24)}${expectedAddress.slice(2).toLowerCase()}`,
      `${label} must bind the exact address`);
  }
  return value;
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalArtifactBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function exactZipEntry(archiveInput, entryPath) {
  const archive = Buffer.from(archiveInput);
  assert(archive.byteLength > 0 && archive.byteLength <= 128 * 1024 * 1024,
    "GitHub artifact archive must be between one byte and 128 MiB");
  assert(typeof entryPath === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/u.test(entryPath) &&
    !entryPath.includes("..") && !entryPath.startsWith("/") && !entryPath.endsWith("/"),
  "GitHub artifact archive entry path is invalid");
  const minimumEocd = 22;
  let eocd = -1;
  const lowerBound = Math.max(0, archive.byteLength - minimumEocd - 65_535);
  for (let offset = archive.byteLength - minimumEocd; offset >= lowerBound; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  assert(eocd >= 0 && eocd + minimumEocd <= archive.byteLength,
    "GitHub artifact archive has no valid ZIP directory");
  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const entryCount = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  const commentLength = archive.readUInt16LE(eocd + 20);
  assert(disk === 0 && centralDisk === 0 && entriesOnDisk === entryCount &&
    entryCount > 0 && entryCount < 65_535 && centralSize < 0xffffffff &&
    centralOffset < 0xffffffff && eocd + minimumEocd + commentLength === archive.byteLength &&
    centralOffset + centralSize === eocd,
  "GitHub artifact archive ZIP directory is unsupported or inconsistent");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let cursor = centralOffset;
  let selected = null;
  for (let index = 0; index < entryCount; index += 1) {
    assert(cursor + 46 <= eocd && archive.readUInt32LE(cursor) === 0x02014b50,
      "GitHub artifact archive central entry is invalid");
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const entryCommentLength = archive.readUInt16LE(cursor + 32);
    const startDisk = archive.readUInt16LE(cursor + 34);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + entryCommentLength;
    assert(next <= eocd && startDisk === 0 && compressedSize < 0xffffffff &&
      uncompressedSize < 0xffffffff && localOffset < 0xffffffff && (flags & 0x1) === 0,
    "GitHub artifact archive entry is unsupported or inconsistent");
    const name = decoder.decode(archive.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === entryPath) {
      assert(selected === null, "GitHub artifact archive contains a duplicate bound entry");
      selected = { method, compressedSize, uncompressedSize, localOffset, name };
    }
    cursor = next;
  }
  assert(cursor === eocd && selected !== null,
    "GitHub artifact archive does not contain the exact bound entry");
  const local = selected.localOffset;
  assert(local + 30 <= centralOffset && archive.readUInt32LE(local) === 0x04034b50,
    "GitHub artifact archive local entry is invalid");
  const localNameLength = archive.readUInt16LE(local + 26);
  const localExtraLength = archive.readUInt16LE(local + 28);
  const dataStart = local + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + selected.compressedSize;
  assert(dataEnd <= centralOffset &&
    decoder.decode(archive.subarray(local + 30, local + 30 + localNameLength)) === selected.name,
  "GitHub artifact archive local entry differs from its directory");
  const compressed = archive.subarray(dataStart, dataEnd);
  let bytes;
  if (selected.method === 0) bytes = Buffer.from(compressed);
  else if (selected.method === 8) {
    try {
      bytes = inflateRawSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
    } catch {
      throw new TypeError("GitHub artifact archive bound entry cannot be decompressed safely");
    }
  } else {
    throw new TypeError("GitHub artifact archive bound entry uses an unsupported compression");
  }
  assert(bytes.byteLength === selected.uncompressedSize &&
    bytes.byteLength <= 32 * 1024 * 1024,
  "GitHub artifact archive bound entry size is invalid");
  return bytes;
}

export function verifyGitHubArtifactArchiveEntry(archive, {
  artifactDigest, entryPath, expectedBytes,
}) {
  exactSha256(artifactDigest, "GitHub artifact archive digest");
  assert(sha256Bytes(archive) === artifactDigest,
    "downloaded GitHub artifact archive differs from provider metadata");
  const bytes = exactZipEntry(archive, entryPath);
  const expected = Buffer.from(expectedBytes);
  assert(bytes.equals(expected),
    "GitHub artifact archive entry differs from the exact local evidence bytes");
  return {
    artifactArchiveDigest: artifactDigest,
    artifactEntryPath: entryPath,
    artifactEntrySha256: sha256Bytes(bytes),
  };
}

function canonicalEqual(left, right) {
  return canonicalizeJson(left) === canonicalizeJson(right);
}

function validateArtifact(value, expectedPath, label) {
  const artifact = exactKeys(value, ["path", "sha256", "byteLength", "value"], label);
  const bytes = canonicalArtifactBytes(artifact.value);
  assert(artifact.path === expectedPath, `${label}.path differs`);
  assert(artifact.sha256 === sha256Bytes(bytes), `${label}.sha256 differs`);
  assert(artifact.byteLength === String(bytes.byteLength), `${label}.byteLength differs`);
  return artifact;
}

function validateSourceVerification(value) {
  const source = exactKeys(value, [
    "schemaVersion", "provider", "graphFactory", "programmableLaunchStampRouter",
    "permitAuthority", "sourceVerificationClosureDigest", "evidenceDigest",
  ], "release bundle sourceVerification");
  assert(source.schemaVersion === SOURCE_VERIFICATION_SCHEMA &&
    source.provider === "sourcify-v2",
  "release bundle sourceVerification must use the exact Sourcify V2 closure");
  for (const [name, expected] of Object.entries(SOURCE_ROOTS)) {
    const entry = exactKeys(source[name], [
      "chainId", "address", "match", "creationMatch", "runtimeMatch", "matchId",
      "verifiedAt", "compiler", "sourceFilesDigest", "metadataDigest", "urlPath",
      "httpStatus", "contentType", "responseByteLength", "standardJsonInputPath",
      "standardJsonInputSha256", "verificationResponseDigest",
    ], `release bundle sourceVerification.${name}`);
    assert(entry.chainId === CHAIN_ID && sameAddress(entry.address, expected.address) &&
      entry.match === "exact_match" && entry.creationMatch === "exact_match" &&
      entry.runtimeMatch === "exact_match" && typeof entry.matchId === "string" &&
      entry.matchId.length > 0 && entry.httpStatus === 200 &&
      /^application\/json(?:;\s*charset=utf-8)?$/u.test(entry.contentType ?? "") &&
      entry.urlPath === `/server/v2/contract/${CHAIN_ID}/${expected.address}?fields=all` &&
      entry.standardJsonInputPath === expected.standardJsonInputPath &&
      entry.standardJsonInputSha256 === expected.standardJsonInputSha256,
    `release bundle sourceVerification.${name} differs from the frozen source root`);
    exactInstant(entry.verifiedAt, `release bundle sourceVerification.${name}.verifiedAt`);
    exactDecimal(entry.responseByteLength,
      `release bundle sourceVerification.${name}.responseByteLength`, true);
    const compiler = exactKeys(entry.compiler, [
      "language", "compiler", "compilerVersion", "name", "fullyQualifiedName",
      "compilerSettingsDigest",
    ], `release bundle sourceVerification.${name}.compiler`);
    assert(compiler.language === "Solidity" && compiler.compiler === "solc" &&
      compiler.compilerVersion === "0.8.26+commit.8a97fa7a" &&
      compiler.name === expected.compilerName &&
      compiler.fullyQualifiedName === expected.fullyQualifiedName,
    `release bundle sourceVerification.${name}.compiler differs`);
    exactSha256(compiler.compilerSettingsDigest,
      `release bundle sourceVerification.${name}.compiler.compilerSettingsDigest`);
    exactSha256(entry.sourceFilesDigest,
      `release bundle sourceVerification.${name}.sourceFilesDigest`);
    exactSha256(entry.metadataDigest,
      `release bundle sourceVerification.${name}.metadataDigest`);
    exactSha256(entry.verificationResponseDigest,
      `release bundle sourceVerification.${name}.verificationResponseDigest`);
  }
  const permitAuthority = exactKeys(source.permitAuthority,
    ["address", "kind", "sourceCommitment"],
    "release bundle sourceVerification.permitAuthority");
  assert(sameAddress(permitAuthority.address, ROOTS.permitAuthority.address) &&
    permitAuthority.kind === "official-source-pinned" &&
    permitAuthority.sourceCommitment === SAFE_SOURCE_COMMITMENT,
  "release bundle permitAuthority source provenance differs");
  exactSha256(source.sourceVerificationClosureDigest,
    "release bundle sourceVerification.sourceVerificationClosureDigest");
  const { evidenceDigest, ...withoutDigest } = source;
  assert(evidenceDigest === canonicalSha256(SOURCE_VERIFICATION_SCHEMA, withoutDigest),
    "release bundle sourceVerification digest is invalid");
  return source;
}

function validateSourceClosure(value, sourceVerification) {
  const closure = exactKeys(value, [
    "schemaVersion", "repository", "repositoryId", "branch", "protectedRef", "revision", "tree",
    "foundationSourceCommitment", "entries", "sourceVerificationClosureDigest",
    "sourceClosureDigest",
  ], "release bundle sourceClosure");
  assert(closure.schemaVersion === SOURCE_CLOSURE_SCHEMA &&
    closure.repository === PROGRAMMABLE_REPOSITORY &&
    closure.repositoryId === PROGRAMMABLE_REPOSITORY_ID && closure.branch === "production" &&
    closure.protectedRef === PROGRAMMABLE_PROTECTED_REF &&
    COMMIT.test(closure.revision) && COMMIT.test(closure.tree) &&
    closure.foundationSourceCommitment === FOUNDATION_SOURCE_COMMITMENT,
  "release bundle sourceClosure identity differs");
  assert(Array.isArray(closure.entries) && closure.entries.length > 0,
    "release bundle sourceClosure entries are empty");
  const paths = new Set();
  for (const [index, raw] of closure.entries.entries()) {
    const entry = exactKeys(raw, ["path", "byteLength", "sha256"],
      `release bundle sourceClosure.entries[${index}]`);
    assert(typeof entry.path === "string" && entry.path.length > 0 &&
      !path.posix.isAbsolute(entry.path) && !entry.path.split("/").includes("..") &&
      !paths.has(entry.path),
    `release bundle sourceClosure.entries[${index}].path is invalid`);
    paths.add(entry.path);
    exactDecimal(entry.byteLength,
      `release bundle sourceClosure.entries[${index}].byteLength`, true);
    exactSha256(entry.sha256, `release bundle sourceClosure.entries[${index}].sha256`);
  }
  for (const expected of Object.values(SOURCE_ROOTS)) {
    const entry = closure.entries.find(({ path: entryPath }) =>
      entryPath === expected.standardJsonInputPath);
    assert(entry?.sha256 === expected.standardJsonInputSha256,
      `release bundle sourceClosure lacks ${expected.standardJsonInputPath}`);
  }
  assert(closure.sourceVerificationClosureDigest ===
    sourceVerification.sourceVerificationClosureDigest,
  "release bundle source closure differs from the Sourcify response closure");
  const { sourceClosureDigest, ...withoutDigest } = closure;
  assert(sourceClosureDigest === canonicalSha256(SOURCE_CLOSURE_SCHEMA, withoutDigest),
    "release bundle sourceClosure digest is invalid");
  assert(sourceVerification.graphFactory.standardJsonInputSha256 ===
    closure.entries.find(({ path: entryPath }) =>
      entryPath === SOURCE_ROOTS.graphFactory.standardJsonInputPath)?.sha256 &&
    sourceVerification.programmableLaunchStampRouter.standardJsonInputSha256 ===
    closure.entries.find(({ path: entryPath }) =>
      entryPath === SOURCE_ROOTS.programmableLaunchStampRouter.standardJsonInputPath)?.sha256,
  "release bundle source verification is not closed over the source entries");
  return closure;
}

function validateRoots(value, label) {
  const roots = exactKeys(value, Object.keys(ROOTS), label);
  for (const [name, expected] of Object.entries(ROOTS)) {
    const root = exactKeys(roots[name], ["address", "runtimeCodeHash"], `${label}.${name}`);
    assert(ADDRESS.test(root.address) && sameAddress(root.address, expected.address) &&
      root.runtimeCodeHash === expected.runtimeCodeHash,
    `${label}.${name} differs from the code-owned root`);
  }
  return roots;
}

// Atomic Phase-A capture-schema swap boundary. Refresh the authorization, ordered RPC
// inventory, Sourcify projection, and closure digest checks together when the producer contract
// freezes; never make legacy raw response fields optional beside the public normalized shape.
function validateCaptureAuthorization(value, sourceClosure) {
  const authorization = exactKeys(value, [
    "schemaVersion", "trustClass", "subjectPath", "subjectByteLength", "subjectSha256",
    "attestationBundlePath", "attestationBundleByteLength", "attestationBundleSha256",
    "trustedRootSource", "trustedRootByteLength", "trustedRootSha256",
    "productionVerifyProofPath", "productionVerifyProofByteLength",
    "productionVerifyProofSha256", "productionVerifyAttestationBundlePath",
    "productionVerifyAttestationBundleByteLength",
    "productionVerifyAttestationBundleSha256", "productionVerifyRunId",
    "productionVerifyRunAttempt", "productionVerifyArtifactId",
    "productionVerifyArtifactDigest", "repository", "repositoryId", "workflow", "sourceRef",
    "sourceRevision", "sourceTree", "sourceClosureDigest", "verifiedAt", "verificationDigest",
  ], "release bundle captureAuthorization");
  assert(authorization.schemaVersion === CAPTURE_AUTHORIZATION_SCHEMA &&
    authorization.trustClass === "github-artifact-attestation" &&
    authorization.subjectPath === CAPTURE_SUBJECT_PATH &&
    authorization.attestationBundlePath === CAPTURE_ATTESTATION_PATH &&
    authorization.trustedRootSource === "github-cli-embedded-tuf" &&
    authorization.productionVerifyProofPath === PRODUCTION_VERIFY_PROOF_PATH &&
    authorization.productionVerifyAttestationBundlePath ===
      PRODUCTION_VERIFY_ATTESTATION_PATH &&
    authorization.repository === PROGRAMMABLE_REPOSITORY &&
    authorization.repositoryId === PROGRAMMABLE_REPOSITORY_ID &&
    authorization.workflow === CAPTURE_WORKFLOW &&
    authorization.sourceRef === PROGRAMMABLE_PROTECTED_REF &&
    authorization.sourceRevision === sourceClosure.revision &&
    authorization.sourceTree === sourceClosure.tree &&
    authorization.sourceClosureDigest === sourceClosure.sourceClosureDigest,
  "release bundle capture authorization is not the protected PROGRAMMABLE attestation");
  for (const key of [
    "subjectByteLength", "attestationBundleByteLength", "trustedRootByteLength",
    "productionVerifyProofByteLength", "productionVerifyAttestationBundleByteLength",
    "productionVerifyRunId", "productionVerifyRunAttempt", "productionVerifyArtifactId",
  ]) exactDecimal(authorization[key], `release bundle captureAuthorization.${key}`, true);
  for (const key of [
    "subjectSha256", "attestationBundleSha256", "trustedRootSha256",
    "productionVerifyProofSha256", "productionVerifyAttestationBundleSha256",
    "productionVerifyArtifactDigest",
  ]) exactSha256(authorization[key], `release bundle captureAuthorization.${key}`);
  exactInstant(authorization.verifiedAt,
    "release bundle captureAuthorization.verifiedAt");
  const preimage = { ...authorization, verificationDigest: null };
  assert(authorization.verificationDigest ===
    canonicalSha256(CAPTURE_AUTHORIZATION_SCHEMA, preimage),
  "release bundle capture authorization digest is invalid");
  return authorization;
}

function validateCaptureProviderIdentity(value, expected, label) {
  const identity = exactKeys(value, [
    "role", "providerId", "trustDomain", "authentication", "observedAt",
  ], label);
  assert(identity.role === expected.role && identity.providerId === expected.providerId &&
    identity.trustDomain === expected.trustDomain &&
    identity.authentication === "provider-credential",
  `${label} differs from the ordered code-owned provider identity`);
  exactInstant(identity.observedAt, `${label}.observedAt`);
  return identity;
}

function validateCaptureInventory(value, layer, expected, expectedOrder, label) {
  const inventory = exactKeys(value, [
    "layer", "providerId", "trustDomain", "entries", "inventoryDigest",
  ], label);
  assert(inventory.layer === layer && inventory.providerId === expected.providerId &&
    inventory.trustDomain === expected.trustDomain && Array.isArray(inventory.entries) &&
    inventory.entries.length === expectedOrder.length,
  `${label} differs from the exact ordered provider inventory`);
  const entries = inventory.entries.map((raw, index) => {
    const entry = exactKeys(raw, [
      "key", "method", "paramsSha256", "requestSha256", "responseSha256",
      "normalizedResultSha256",
    ], `${label}.entries[${index}]`);
    assert(entry.key === expectedOrder[index] && /^eth_[A-Za-z0-9]+$/u.test(entry.method ?? ""),
      `${label}.entries[${index}] is missing or reorders ${expectedOrder[index]}`);
    for (const key of [
      "paramsSha256", "requestSha256", "responseSha256", "normalizedResultSha256",
    ]) exactSha256(entry[key], `${label}.entries[${index}].${key}`);
    return entry;
  });
  assert(inventory.inventoryDigest === canonicalSha256(CAPTURE_RPC_INVENTORY_SCHEMA, entries),
    `${label}.inventoryDigest differs from its exact entries`);
  return inventory;
}

function validateCaptureReceipt(value, transaction, label) {
  const receipt = exactKeys(value, [
    "transactionHash", "from", "to", "status", "transactionIndex", "blockNumber",
    "blockHash", "logs",
  ], label);
  assert(receipt.transactionHash === transaction.hash && receipt.from === transaction.from &&
    receipt.to === transaction.to && receipt.status === "1" &&
    receipt.transactionIndex === transaction.transactionIndex &&
    receipt.blockNumber === transaction.blockNumber && receipt.blockHash === transaction.blockHash &&
    Array.isArray(receipt.logs) && receipt.logs.length <= 1_024,
  `${label} differs from the exact successful foundation transaction`);
  let previousLogIndex = -1n;
  for (const [index, raw] of receipt.logs.entries()) {
    const log = exactKeys(raw, ["address", "topics", "data", "logIndex"],
      `${label}.logs[${index}]`);
    exactChecksumAddress(log.address, `${label}.logs[${index}].address`);
    assert(Array.isArray(log.topics) && log.topics.length <= 4 &&
      typeof log.data === "string" && /^0x(?:[0-9a-f]{2})*$/u.test(log.data),
    `${label}.logs[${index}] contains invalid log bytes`);
    log.topics.forEach((topic, topicIndex) =>
      exactHash32(topic, `${label}.logs[${index}].topics[${topicIndex}]`));
    const logIndex = BigInt(exactDecimal(log.logIndex, `${label}.logs[${index}].logIndex`));
    assert(logIndex > previousLogIndex, `${label}.logs must be strictly increasing and unique`);
    previousLogIndex = logIndex;
  }
  return receipt;
}

function validateCaptureTransaction(value, checkpoint, label) {
  const transaction = exactKeys(value, [
    "hash", "from", "to", "valueWei", "selector", "calldataHash", "calldataBytes",
    "nonce", "transactionIndex", "blockNumber", "blockHash",
  ], label);
  exactHash32(transaction.hash, `${label}.hash`);
  exactChecksumAddress(transaction.from, `${label}.from`);
  exactChecksumAddress(transaction.to, `${label}.to`, MULTICALL3_ADDRESS);
  assert(SAFE_OWNERS.includes(transaction.from) && transaction.valueWei === "0" &&
    transaction.selector === MULTICALL3_SELECTOR &&
    transaction.calldataHash === OWNER_CALLDATA_HASH &&
    transaction.calldataBytes === OWNER_CALLDATA_BYTES &&
    transaction.blockNumber === checkpoint.blockNumber &&
    transaction.blockHash === checkpoint.blockHash,
  `${label} differs from the exact owner Multicall3 deployment transaction`);
  exactDecimal(transaction.nonce, `${label}.nonce`);
  exactDecimal(transaction.transactionIndex, `${label}.transactionIndex`);
  return transaction;
}

function validateCaptureAtomicRoot(value, contract, checkpoint, label) {
  const root = exactKeys(value, [
    "contract", "address", "preDeploymentBlockNumber", "preDeploymentBlockHash",
    "preDeploymentRuntimeCodeHash", "deploymentBlockNumber", "deploymentBlockHash",
    "deploymentRuntimeCodeHash",
  ], label);
  const expected = ROOTS[contract];
  const predecessor = (BigInt(checkpoint.blockNumber) - 1n).toString(10);
  assert(root.contract === contract && root.preDeploymentBlockNumber === predecessor &&
    root.preDeploymentRuntimeCodeHash === EMPTY_RUNTIME_CODE_HASH &&
    root.deploymentBlockNumber === checkpoint.blockNumber &&
    root.deploymentBlockHash === checkpoint.blockHash,
  `${label} does not prove the exact D-1 to D runtime transition`);
  exactChecksumAddress(root.address, `${label}.address`, expected.address);
  exactHash32(root.preDeploymentBlockHash, `${label}.preDeploymentBlockHash`);
  assert(root.deploymentRuntimeCodeHash === expected.runtimeCodeHash,
    `${label}.deploymentRuntimeCodeHash differs from the code-owned root`);
  return root;
}

function validateCaptureRouterState(value, label) {
  const router = exactKeys(value, [
    "address", "runtimeCodeHash", "chainId", "permitAuthority",
    "permitAuthorityRuntimeCodeHash", "graphFactory", "graphFactoryRuntimeCodeHash",
    "poolManager", "poolManagerRuntimeCodeHash",
  ], label);
  assert(router.address === ROOTS.programmableLaunchStampRouter.address &&
    router.runtimeCodeHash === ROOTS.programmableLaunchStampRouter.runtimeCodeHash &&
    router.chainId === CHAIN_ID && router.permitAuthority === ROOTS.permitAuthority.address &&
    router.permitAuthorityRuntimeCodeHash === ROOTS.permitAuthority.runtimeCodeHash &&
    router.graphFactory === ROOTS.graphFactory.address &&
    router.graphFactoryRuntimeCodeHash === ROOTS.graphFactory.runtimeCodeHash &&
    router.poolManager === ROOTS.poolManager.address &&
    router.poolManagerRuntimeCodeHash === ROOTS.poolManager.runtimeCodeHash,
  `${label} differs from the finalized code-owned Router state`);
  return router;
}

function validateCaptureSafeState(value, checkpoint, label) {
  const safe = exactKeys(value, [
    "blockNumber", "blockHash", "proxyAddress", "proxyRuntimeCodeHash", "singleton",
    "fallbackHandler", "fallbackHandlerRuntimeCodeHash", "owners", "threshold", "nonce",
    "modules", "modulesNext", "guard", "singletonSlot", "fallbackHandlerSlot", "guardSlot",
  ], label);
  const singleton = exactKeys(safe.singleton, ["address", "runtimeCodeHash", "version"],
    `${label}.singleton`);
  assert(safe.blockNumber === checkpoint.blockNumber && safe.blockHash === checkpoint.blockHash &&
    safe.proxyAddress === ROOTS.permitAuthority.address &&
    safe.proxyRuntimeCodeHash === ROOTS.permitAuthority.runtimeCodeHash &&
    singleton.address === SAFE_SINGLETON &&
    singleton.runtimeCodeHash === SAFE_SINGLETON_RUNTIME_CODE_HASH &&
    singleton.version === "1.4.1" && safe.fallbackHandler === SAFE_FALLBACK_HANDLER &&
    safe.fallbackHandlerRuntimeCodeHash === SAFE_FALLBACK_HANDLER_RUNTIME_CODE_HASH &&
    canonicalEqual(safe.owners, SAFE_OWNERS) && safe.threshold === 1 && safe.nonce === "0" &&
    Array.isArray(safe.modules) && safe.modules.length === 0 &&
    safe.modulesNext === SAFE_MODULES_END_SENTINEL && safe.guard === null,
  `${label} differs from the exact freshly deployed Safe configuration`);
  safe.owners.forEach((owner, index) => exactChecksumAddress(owner, `${label}.owners[${index}]`));
  exactStorageWord(safe.singletonSlot, `${label}.singletonSlot`, SAFE_SINGLETON);
  exactStorageWord(safe.fallbackHandlerSlot, `${label}.fallbackHandlerSlot`,
    SAFE_FALLBACK_HANDLER);
  assert(exactStorageWord(safe.guardSlot, `${label}.guardSlot`) === `0x${"0".repeat(64)}`,
    `${label}.guardSlot must be empty`);
  return safe;
}

function validateCaptureExternalRoot(value, contract, label) {
  const root = exactKeys(value, [
    "contract", "address", "preStartBlockNumber", "preStartBlockHash",
    "preStartBlockRuntimeCodeHash", "runtimeCodeHash", "transactionHash",
    "rawTransactionDigest", "transactionDigest", "startBlock", "blockHash",
    "transactionReceiptDigest",
  ], label);
  const expected = CAPTURE_EXTERNAL_ROOTS[contract];
  assert(root.contract === contract && root.preStartBlockNumber ===
      (BigInt(expected.startBlock) - 1n).toString(10) &&
    root.preStartBlockRuntimeCodeHash === EMPTY_RUNTIME_CODE_HASH &&
    root.runtimeCodeHash === expected.runtimeCodeHash &&
    root.transactionHash === expected.transactionHash && root.startBlock === expected.startBlock,
  `${label} differs from the exact D-1 to D external deployment`);
  exactChecksumAddress(root.address, `${label}.address`, expected.address);
  exactHash32(root.preStartBlockHash, `${label}.preStartBlockHash`);
  exactHash32(root.blockHash, `${label}.blockHash`);
  exactSha256(root.rawTransactionDigest, `${label}.rawTransactionDigest`);
  exactSha256(root.transactionDigest, `${label}.transactionDigest`);
  exactSha256(root.transactionReceiptDigest, `${label}.transactionReceiptDigest`);
  return root;
}

function validateCaptureVerifiedState(value, expectedProvider, checkpoint, label) {
  const state = exactKeys(value, [
    "providerId", "trustDomain", "transaction", "receipt", "multicall3", "atomicRoots",
    "routerState", "safeState", "permit2Genesis", "externalRoots",
  ], label);
  assert(state.providerId === expectedProvider.providerId &&
    state.trustDomain === expectedProvider.trustDomain,
  `${label} differs from the ordered provider`);
  const transaction = validateCaptureTransaction(state.transaction, checkpoint,
    `${label}.transaction`);
  validateCaptureReceipt(state.receipt, transaction, `${label}.receipt`);
  const multicall3 = exactKeys(state.multicall3, ["address", "runtimeCodeHash"],
    `${label}.multicall3`);
  assert(multicall3.address === MULTICALL3_ADDRESS &&
    multicall3.runtimeCodeHash === MULTICALL3_RUNTIME_CODE_HASH,
  `${label}.multicall3 differs from the code-owned root`);
  assert(Array.isArray(state.atomicRoots) &&
    state.atomicRoots.length === CAPTURE_ATOMIC_ROOT_ORDER.length,
  `${label}.atomicRoots differs from the ordered foundation tuple`);
  state.atomicRoots.forEach((root, index) => validateCaptureAtomicRoot(
    root, CAPTURE_ATOMIC_ROOT_ORDER[index], checkpoint, `${label}.atomicRoots[${index}]`,
  ));
  validateCaptureRouterState(state.routerState, `${label}.routerState`);
  validateCaptureSafeState(state.safeState, checkpoint, `${label}.safeState`);
  const permit2 = exactKeys(state.permit2Genesis, [
    "address", "blockNumber", "blockHash", "runtimeCodeHash", "runtimeCodeBytes",
  ], `${label}.permit2Genesis`);
  assert(permit2.address === ROOTS.permit2.address && permit2.blockNumber === "0" &&
    permit2.runtimeCodeHash === ROOTS.permit2.runtimeCodeHash &&
    permit2.runtimeCodeBytes === PERMIT2_GENESIS_RUNTIME_CODE_BYTES,
  `${label}.permit2Genesis differs from the exact official genesis allocation`);
  exactHash32(permit2.blockHash, `${label}.permit2Genesis.blockHash`);
  const externalOrder = Object.keys(CAPTURE_EXTERNAL_ROOTS);
  assert(Array.isArray(state.externalRoots) && state.externalRoots.length === externalOrder.length,
    `${label}.externalRoots differs from the ordered Uniswap tuple`);
  state.externalRoots.forEach((root, index) => validateCaptureExternalRoot(
    root, externalOrder[index], `${label}.externalRoots[${index}]`,
  ));
  return state;
}

function validateCapturePostingEvent(value, label) {
  const event = exactKeys(value, [
    "batchNumber", "beforeAcc", "afterAcc", "delayedAcc", "afterDelayedMessagesRead",
    "timeBounds", "dataLocation", "transactionHash", "transactionIndex", "blockNumber",
    "blockHash", "logIndex",
  ], label);
  exactDecimal(event.batchNumber, `${label}.batchNumber`, true);
  for (const key of ["beforeAcc", "afterAcc", "delayedAcc", "transactionHash", "blockHash"]) {
    exactHash32(event[key], `${label}.${key}`);
  }
  exactDecimal(event.afterDelayedMessagesRead, `${label}.afterDelayedMessagesRead`);
  const timeBounds = exactKeys(event.timeBounds, [
    "delayBlocks", "futureBlocks", "delaySeconds", "futureSeconds",
  ], `${label}.timeBounds`);
  for (const key of Object.keys(timeBounds)) exactDecimal(timeBounds[key], `${label}.timeBounds.${key}`);
  assert(Number.isInteger(event.dataLocation) && event.dataLocation >= 0 &&
    event.dataLocation <= 255, `${label}.dataLocation is invalid`);
  exactDecimal(event.transactionIndex, `${label}.transactionIndex`);
  exactDecimal(event.blockNumber, `${label}.blockNumber`, true);
  exactDecimal(event.logIndex, `${label}.logIndex`);
  return event;
}

function validateCaptureSourcify(value, contract, label) {
  const entry = exactKeys(value, [
    "contract", "provider", "chainId", "address", "match", "creationMatch",
    "runtimeMatch", "matchId", "verifiedAt", "compiler", "sourceFilesDigest",
    "standardJsonInputPath", "standardJsonInputSha256", "metadataDigest", "urlPath",
    "httpStatus", "contentType", "responseByteLength", "responseSha256",
  ], label);
  const expected = SOURCE_ROOTS[contract];
  assert(entry.contract === contract && entry.provider === "sourcify-v2" &&
    entry.chainId === CHAIN_ID && entry.address === expected.address &&
    entry.match === "exact_match" && entry.creationMatch === "exact_match" &&
    entry.runtimeMatch === "exact_match" && typeof entry.matchId === "string" &&
    entry.matchId.length > 0 && entry.standardJsonInputPath === expected.standardJsonInputPath &&
    entry.standardJsonInputSha256 === expected.standardJsonInputSha256 &&
    entry.urlPath === `/server/v2/contract/${CHAIN_ID}/${expected.address}?fields=all` &&
    entry.httpStatus === 200 &&
    /^application\/json(?:;\s*charset=utf-8)?$/u.test(entry.contentType ?? ""),
  `${label} differs from the exact Sourcify V2 creation/runtime closure`);
  exactInstant(entry.verifiedAt, `${label}.verifiedAt`);
  const compiler = exactKeys(entry.compiler, [
    "language", "compiler", "compilerVersion", "name", "fullyQualifiedName",
    "compilerSettingsDigest",
  ], `${label}.compiler`);
  assert(compiler.language === "Solidity" && compiler.compiler === "solc" &&
    compiler.compilerVersion === "0.8.26+commit.8a97fa7a" &&
    compiler.name === expected.compilerName &&
    compiler.fullyQualifiedName === expected.fullyQualifiedName,
  `${label}.compiler differs from the prepared compiler input`);
  for (const key of [
    "compilerSettingsDigest", "sourceFilesDigest", "standardJsonInputSha256",
    "metadataDigest", "responseSha256",
  ]) {
    const subject = key === "compilerSettingsDigest" ? compiler : entry;
    exactSha256(subject[key], `${label}.${key}`);
  }
  exactDecimal(entry.responseByteLength, `${label}.responseByteLength`, true);
  return entry;
}

function validateCaptureClosure(value, authorization, sourceClosure, sourceVerification) {
  const closure = exactKeys(value, [
    "schemaVersion", "captureId", "observedAt", "expiresAt", "profileDigest",
    "sourceOrigin", "authorization", "l2Checkpoint", "l2ProviderReadbacks",
    "batchNumber", "postingEvent", "ethereumProviderReadbacks",
    "ethereumFinalizedCheckpoint", "sourcify", "sourceVerificationClosureDigest",
    "captureInventoryDigest", "captureSubjectSha256", "captureClosureDigest",
  ], "release bundle captureClosure");
  assert(closure.schemaVersion === CAPTURE_CLOSURE_SCHEMA &&
    /^[0-9a-f]{64}$/u.test(closure.captureId ?? "") &&
    closure.profileDigest === CAPTURE_PROFILE_DIGEST &&
    canonicalEqual(closure.authorization, authorization) &&
    closure.captureSubjectSha256 === authorization.subjectSha256 &&
    closure.sourceVerificationClosureDigest ===
      sourceVerification.sourceVerificationClosureDigest,
  "release bundle capture closure differs from its protected authorization");
  exactInstant(closure.observedAt, "release bundle captureClosure.observedAt");
  exactInstant(closure.expiresAt, "release bundle captureClosure.expiresAt");
  assert(Date.parse(closure.expiresAt) > Date.parse(closure.observedAt) &&
    Date.parse(closure.expiresAt) - Date.parse(closure.observedAt) <= 20 * 60_000,
    "release bundle capture closure validity window is invalid");
  const captureAuthorizationDelay = Date.parse(authorization.verifiedAt) -
    Date.parse(closure.observedAt);
  assert(captureAuthorizationDelay >= 0 && captureAuthorizationDelay <= 20 * 60_000,
    "release bundle capture authorization is outside the capture validity window");
  const sourceOrigin = exactKeys(closure.sourceOrigin, [
    "repository", "repositoryId", "protectedRef", "revision", "tree", "sourceClosureDigest",
  ], "release bundle captureClosure.sourceOrigin");
  assert(sourceOrigin.repository === PROGRAMMABLE_REPOSITORY &&
    sourceOrigin.repositoryId === PROGRAMMABLE_REPOSITORY_ID &&
    sourceOrigin.protectedRef === PROGRAMMABLE_PROTECTED_REF &&
    sourceOrigin.revision === sourceClosure.revision && sourceOrigin.tree === sourceClosure.tree &&
    sourceOrigin.sourceClosureDigest === sourceClosure.sourceClosureDigest,
  "release bundle capture source origin differs from the protected source closure");
  const checkpoint = exactKeys(closure.l2Checkpoint, ["blockNumber", "blockHash"],
    "release bundle captureClosure.l2Checkpoint");
  exactDecimal(checkpoint.blockNumber,
    "release bundle captureClosure.l2Checkpoint.blockNumber", true);
  exactHash32(checkpoint.blockHash, "release bundle captureClosure.l2Checkpoint.blockHash");
  const batchNumber = exactDecimal(closure.batchNumber,
    "release bundle captureClosure.batchNumber", true);
  assert(Array.isArray(closure.l2ProviderReadbacks) &&
    closure.l2ProviderReadbacks.length === 2 &&
    Array.isArray(closure.ethereumProviderReadbacks) &&
    closure.ethereumProviderReadbacks.length === 2 &&
    Array.isArray(closure.sourcify) && closure.sourcify.length === 2,
  "release bundle capture closure lacks the required independent readbacks");
  const l2Providers = closure.l2ProviderReadbacks.map((raw, index) => {
    const label = `release bundle captureClosure.l2ProviderReadbacks[${index}]`;
    const provider = exactKeys(raw, [
      "identity", "transactionHash", "signedTransactionSha256", "receiptDigest",
      "deploymentBlock", "batchNumber", "l1Confirmations", "normalizedStateDigest",
      "verifiedState", "inventory",
    ], label);
    const expected = CAPTURE_L2_PROVIDERS[index];
    validateCaptureProviderIdentity(provider.identity, expected, `${label}.identity`);
    const deploymentBlock = exactKeys(provider.deploymentBlock, [
      "blockNumber", "blockHash", "predecessorBlockHash",
    ], `${label}.deploymentBlock`);
    assert(deploymentBlock.blockNumber === checkpoint.blockNumber &&
      deploymentBlock.blockHash === checkpoint.blockHash,
    `${label}.deploymentBlock differs from the exact L2 checkpoint`);
    exactHash32(deploymentBlock.predecessorBlockHash,
      `${label}.deploymentBlock.predecessorBlockHash`);
    assert(provider.batchNumber === batchNumber,
      `${label}.batchNumber differs from the capture batch`);
    exactDecimal(provider.l1Confirmations, `${label}.l1Confirmations`, true);
    const state = validateCaptureVerifiedState(
      provider.verifiedState, expected, checkpoint, `${label}.verifiedState`,
    );
    assert(provider.transactionHash === state.transaction.hash &&
      deploymentBlock.predecessorBlockHash ===
        state.atomicRoots[0].preDeploymentBlockHash,
    `${label} differs from its exact verified D-1 to D state`);
    exactHash32(provider.transactionHash, `${label}.transactionHash`);
    exactSha256(provider.signedTransactionSha256, `${label}.signedTransactionSha256`);
    exactSha256(provider.receiptDigest, `${label}.receiptDigest`);
    assert(provider.normalizedStateDigest === canonicalSha256(
      CAPTURE_NORMALIZED_L2_STATE_SCHEMA, state,
    ), `${label}.normalizedStateDigest differs from its verified state`);
    const inventory = validateCaptureInventory(
      provider.inventory, "robinhood", expected, CAPTURE_L2_ENTRY_ORDER,
      `${label}.inventory`,
    );
    const inventoryByKey = new Map(inventory.entries.map((entry) => [entry.key, entry]));
    assert(provider.receiptDigest === inventoryByKey.get("receipt")?.responseSha256,
      `${label}.receiptDigest differs from the attested receipt response`);
    for (const root of state.externalRoots) {
      const title = `${root.contract[0].toUpperCase()}${root.contract.slice(1)}`;
      assert(root.rawTransactionDigest ===
          inventoryByKey.get(`${root.contract}RawTransaction`)?.normalizedResultSha256 &&
        root.transactionDigest ===
          inventoryByKey.get(`${root.contract}Transaction`)?.normalizedResultSha256 &&
        root.transactionReceiptDigest ===
          inventoryByKey.get(`${root.contract}Receipt`)?.normalizedResultSha256 &&
        inventoryByKey.has(`${root.contract}Block`) &&
        inventoryByKey.has(`${root.contract}PredecessorBlock`) &&
        inventoryByKey.has(`${root.contract}Create2DeployerCode`) &&
        inventoryByKey.has(`pre${title}Code`) && inventoryByKey.has(`${root.contract}Code`),
      `${label}.${root.contract} transition digests differ from its ordered RPC inventory`);
    }
    return { provider, state, inventory, deploymentBlock };
  });
  assert(l2Providers[0].provider.transactionHash === l2Providers[1].provider.transactionHash &&
    l2Providers[0].deploymentBlock.blockNumber === l2Providers[1].deploymentBlock.blockNumber &&
    l2Providers[0].deploymentBlock.blockHash === l2Providers[1].deploymentBlock.blockHash &&
    l2Providers[0].deploymentBlock.predecessorBlockHash ===
      l2Providers[1].deploymentBlock.predecessorBlockHash,
  "release bundle L2 providers disagree on the foundation transaction/checkpoint");
  for (const key of [
    "transaction", "receipt", "multicall3", "atomicRoots", "routerState", "safeState",
    "permit2Genesis", "externalRoots",
  ]) {
    assert(canonicalEqual(l2Providers[0].state[key], l2Providers[1].state[key]),
      `release bundle L2 providers disagree on verifiedState.${key}`);
  }

  const postingEvent = validateCapturePostingEvent(
    closure.postingEvent, "release bundle captureClosure.postingEvent",
  );
  assert(postingEvent.batchNumber === batchNumber,
    "release bundle posting event differs from the L2 batch");
  const finalized = exactKeys(closure.ethereumFinalizedCheckpoint,
    ["blockNumber", "blockHash", "tag"],
    "release bundle captureClosure.ethereumFinalizedCheckpoint");
  exactDecimal(finalized.blockNumber,
    "release bundle captureClosure.ethereumFinalizedCheckpoint.blockNumber", true);
  exactHash32(finalized.blockHash,
    "release bundle captureClosure.ethereumFinalizedCheckpoint.blockHash");
  assert(finalized.tag === "finalized",
    "release bundle capture closure lacks an Ethereum finalized checkpoint");
  assert(BigInt(finalized.blockNumber) >= BigInt(postingEvent.blockNumber),
    "release bundle Ethereum finalized checkpoint predates the posting block");
  const ethereumProviders = closure.ethereumProviderReadbacks.map((raw, index) => {
    const label = `release bundle captureClosure.ethereumProviderReadbacks[${index}]`;
    const provider = exactKeys(raw, [
      "identity", "postingEvent", "receiptStatus", "postingReceiptDigest",
      "postingBlockDigest", "finalizedCheckpoint", "inventory",
    ], label);
    const expected = CAPTURE_ETHEREUM_PROVIDERS[index];
    validateCaptureProviderIdentity(provider.identity, expected, `${label}.identity`);
    const providerPostingEvent = validateCapturePostingEvent(
      provider.postingEvent, `${label}.postingEvent`,
    );
    assert(provider.receiptStatus === "1" &&
      canonicalEqual(providerPostingEvent, postingEvent),
    `${label} differs from the successful Ethereum posting event`);
    exactSha256(provider.postingReceiptDigest, `${label}.postingReceiptDigest`);
    exactSha256(provider.postingBlockDigest, `${label}.postingBlockDigest`);
    const providerFinalized = exactKeys(provider.finalizedCheckpoint, [
      "blockNumber", "blockHash", "tag", "firstReadDigest", "rereadDigest",
    ], `${label}.finalizedCheckpoint`);
    assert(providerFinalized.blockNumber === finalized.blockNumber &&
      providerFinalized.blockHash === finalized.blockHash && providerFinalized.tag === "finalized",
    `${label}.finalizedCheckpoint differs from the stable finalized readback`);
    exactSha256(providerFinalized.firstReadDigest,
      `${label}.finalizedCheckpoint.firstReadDigest`);
    exactSha256(providerFinalized.rereadDigest,
      `${label}.finalizedCheckpoint.rereadDigest`);
    const inventory = validateCaptureInventory(
      provider.inventory, "ethereum", expected, CAPTURE_ETHEREUM_ENTRY_ORDER,
      `${label}.inventory`,
    );
    const inventoryByKey = new Map(inventory.entries.map((entry) => [entry.key, entry]));
    assert(provider.postingReceiptDigest ===
        inventoryByKey.get("postingReceipt")?.responseSha256 &&
      provider.postingBlockDigest === inventoryByKey.get("postingBlock")?.responseSha256 &&
      providerFinalized.firstReadDigest ===
        inventoryByKey.get("finalizedTag")?.responseSha256 &&
      providerFinalized.rereadDigest ===
        inventoryByKey.get("finalizedReread")?.responseSha256,
    `${label} response digests differ from its ordered Ethereum inventory`);
    return { provider, inventory };
  });
  assert(canonicalEqual(
    ethereumProviders[0].provider.postingEvent,
    ethereumProviders[1].provider.postingEvent,
  ) && ethereumProviders[0].provider.finalizedCheckpoint.blockNumber ===
      ethereumProviders[1].provider.finalizedCheckpoint.blockNumber &&
    ethereumProviders[0].provider.finalizedCheckpoint.blockHash ===
      ethereumProviders[1].provider.finalizedCheckpoint.blockHash,
  "release bundle Ethereum providers disagree on posting/finality");

  const sourcifyOrder = ["graphFactory", "programmableLaunchStampRouter"];
  const sourcify = closure.sourcify.map((entry, index) => validateCaptureSourcify(
    entry, sourcifyOrder[index], `release bundle captureClosure.sourcify[${index}]`,
  ));
  const sourcifyClosureDigest = canonicalSha256(
    CAPTURE_SOURCIFY_RESPONSE_CLOSURE_SCHEMA, sourcify,
  );
  assert(closure.sourceVerificationClosureDigest === sourcifyClosureDigest,
    "release bundle capture closure Sourcify digest differs from its exact responses");
  for (const [index, contract] of sourcifyOrder.entries()) {
    const entry = sourcify[index];
    const projected = {
      chainId: entry.chainId,
      address: entry.address,
      match: entry.match,
      creationMatch: entry.creationMatch,
      runtimeMatch: entry.runtimeMatch,
      matchId: entry.matchId,
      verifiedAt: entry.verifiedAt,
      compiler: structuredClone(entry.compiler),
      sourceFilesDigest: entry.sourceFilesDigest,
      metadataDigest: entry.metadataDigest,
      urlPath: entry.urlPath,
      httpStatus: entry.httpStatus,
      contentType: entry.contentType,
      responseByteLength: entry.responseByteLength,
      standardJsonInputPath: entry.standardJsonInputPath,
      standardJsonInputSha256: entry.standardJsonInputSha256,
      verificationResponseDigest: entry.responseSha256,
    };
    assert(canonicalEqual(projected, sourceVerification[contract]),
      `release bundle capture Sourcify ${contract} differs from sourceVerification`);
  }
  const captureInventorySubject = [
    ...l2Providers.map(({ inventory }) => inventory),
    ...ethereumProviders.map(({ inventory }) => inventory),
    ...sourcify.map((entry) => ({
      layer: "sourcify",
      contract: entry.contract,
      responseSha256: entry.responseSha256,
      responseByteLength: entry.responseByteLength,
    })),
  ];
  assert(closure.captureInventoryDigest === canonicalSha256(
    CAPTURE_INVENTORY_SCHEMA, captureInventorySubject,
  ), "release bundle capture inventory digest differs from the exact provider closure");
  for (const key of [
    "sourceVerificationClosureDigest", "captureInventoryDigest", "captureSubjectSha256",
    "captureClosureDigest",
  ]) exactSha256(closure[key], `release bundle captureClosure.${key}`);
  return closure;
}

function validateArtifactDescriptor(value, expectedPath, label) {
  const artifact = exactKeys(value, ["path", "sha256", "byteLength"], label);
  assert(artifact.path === expectedPath, `${label}.path differs`);
  exactSha256(artifact.sha256, `${label}.sha256`);
  exactDecimal(artifact.byteLength, `${label}.byteLength`, true);
  return artifact;
}

function assertNoRawProviderPayload(value, label) {
  assert(!/"(?:bodyBytesBase64|sanitizedBytesBase64|requestBase64|responseBase64|readinessReadback|flyReadbacks)"\s*:/u
    .test(JSON.stringify(value)), `${label} contains a legacy raw provider payload`);
}

function validateBackendReleaseAssets(value, descriptorDigest) {
  const assets = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "chainDeploymentDescriptorDigest",
    "chainDeployment", "preparedRootSourceManifest", "standardJsonInputs",
    "backendRuntimeReadinessRequired", "flyControlPlaneReceiptRequired",
    "backendReleaseAssetsDigest",
  ], "release bundle backendReleaseAssets");
  assert(assets.schemaVersion === BACKEND_RELEASE_ASSETS_SCHEMA &&
    assets.state === "phase-a-closed" && assets.publicAuthorization === false &&
    assets.chainDeploymentDescriptorDigest === descriptorDigest &&
    assets.backendRuntimeReadinessRequired === true &&
    assets.flyControlPlaneReceiptRequired === true,
  "release bundle backend assets are not a closed Phase-A handoff");
  validateArtifactDescriptor(assets.chainDeployment,
    "release/robinhood-v4-chain-deployment.v1.json",
    "release bundle backendReleaseAssets.chainDeployment");
  validateArtifactDescriptor(assets.preparedRootSourceManifest,
    "release/robinhood-v4-prepared-root-source-manifest.v1.json",
    "release bundle backendReleaseAssets.preparedRootSourceManifest");
  assert(Array.isArray(assets.standardJsonInputs) && assets.standardJsonInputs.length === 2,
    "release bundle backend assets require both Standard JSON inputs");
  const expected = [
    ["router", "release/assets/robinhood-v4/ProgrammableLaunchStampRouterV1.standard-input.json"],
    ["graphFactory", "release/assets/robinhood-v4/ProgrammableCreate2GraphDeployerV1.standard-input.json"],
  ];
  for (const [index, [contract, artifactPath]] of expected.entries()) {
    const entry = exactKeys(assets.standardJsonInputs[index],
      ["contract", "path", "sha256", "byteLength"],
      `release bundle backendReleaseAssets.standardJsonInputs[${index}]`);
    assert(entry.contract === contract && entry.path === artifactPath,
      `release bundle backend Standard JSON input ${index} differs`);
    exactSha256(entry.sha256,
      `release bundle backendReleaseAssets.standardJsonInputs[${index}].sha256`);
    exactDecimal(entry.byteLength,
      `release bundle backendReleaseAssets.standardJsonInputs[${index}].byteLength`, true);
  }
  const { backendReleaseAssetsDigest, ...withoutDigest } = assets;
  assert(backendReleaseAssetsDigest ===
    canonicalSha256(BACKEND_RELEASE_ASSETS_SCHEMA, withoutDigest),
  "release bundle backend asset closure digest is invalid");
  return assets;
}

export function parseStageBundle(value) {
  assertNoRawProviderPayload(value, "Phase-A stage bundle");
  const bundle = exactKeys(value, [
    "schemaVersion", "state", "releaseReady", "publicAuthorization", "publicWrites",
    "chainDeploymentId", "inputEvidenceDigest",
    "preparedArtifact", "captureAuthorization", "captureClosure", "sourceVerification",
    "sourceClosure", "backendReleaseAssets", "finalizedBindings", "artifacts",
    "consumerInputs", "stageBundleDigest",
  ], "Phase-A stage bundle");
  assert(bundle.schemaVersion === STAGE_BUNDLE_SCHEMA &&
    bundle.state === "closed-awaiting-backend-readiness" &&
    bundle.releaseReady === false && bundle.publicAuthorization === false &&
    bundle.publicWrites === false &&
    bundle.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Phase-A bundle is not closed awaiting backend readiness");
  exactSha256(bundle.inputEvidenceDigest, "Phase-A bundle inputEvidenceDigest");
  const prepared = exactKeys(bundle.preparedArtifact,
    ["path", "sha256", "state", "preserved"], "Phase-A bundle preparedArtifact");
  assert(prepared.path === PREDEPLOYMENT_PATH && prepared.sha256 === PREDEPLOYMENT_SHA256 &&
    prepared.state === "prepared-not-broadcast" && prepared.preserved === true,
  "Phase-A bundle does not preserve the exact prepared artifact");

  const sourceVerification = validateSourceVerification(bundle.sourceVerification);
  const sourceClosure = validateSourceClosure(bundle.sourceClosure, sourceVerification);
  const authorization = validateCaptureAuthorization(bundle.captureAuthorization, sourceClosure);
  const captureClosure = validateCaptureClosure(
    bundle.captureClosure, authorization, sourceClosure, sourceVerification,
  );

  const artifacts = exactKeys(bundle.artifacts,
    ["liveDeployment", "cliReleaseBinding", "backendRelease"],
    "Phase-A bundle artifacts");
  const liveDeployment = validateArtifact(
    artifacts.liveDeployment, LIVE_DEPLOYMENT_PATH, "Phase-A bundle live deployment",
  );
  const descriptorDigest = keccak256(
    new TextEncoder().encode(canonicalizeJson(liveDeployment.value)),
  );
  const backendReleaseAssets = validateBackendReleaseAssets(
    bundle.backendReleaseAssets, descriptorDigest,
  );
  const cliRaw = exactKeys(artifacts.cliReleaseBinding,
    ["path", "sha256", "byteLength", "value", "replacesSha256"],
    "Phase-A bundle CLI release binding");
  const cliReleaseBinding = validateArtifact(
    {
      path: cliRaw.path,
      sha256: cliRaw.sha256,
      byteLength: cliRaw.byteLength,
      value: cliRaw.value,
    },
    CLI_RELEASE_BINDING_PATH,
    "Phase-A bundle CLI release binding",
  );
  exactSha256(cliRaw.replacesSha256,
    "Phase-A bundle CLI release binding replacesSha256");
  assert(cliReleaseBinding.value?.releaseReady === false &&
    canonicalEqual(cliReleaseBinding.value?.blockers,
      ["releaseManifestEvidence", "backendReleaseEvidence"]) &&
    cliReleaseBinding.value?.evidence?.manifest === null &&
    cliReleaseBinding.value?.evidence?.backend === null,
  "Phase-A CLI binding must remain blocked and non-release-ready");

  const backendArtifacts = exactKeys(artifacts.backendRelease,
    ["chainDeployment", "preparedRootSourceManifest", "standardJsonInputs"],
    "Phase-A bundle backend artifacts");
  const backendChainDeployment = validateArtifact(
    backendArtifacts.chainDeployment,
    backendReleaseAssets.chainDeployment.path,
    "Phase-A bundle backend chain deployment artifact",
  );
  const preparedSourceManifest = validateArtifact(
    backendArtifacts.preparedRootSourceManifest,
    backendReleaseAssets.preparedRootSourceManifest.path,
    "Phase-A bundle prepared root source manifest artifact",
  );
  assert(backendChainDeployment.sha256 === backendReleaseAssets.chainDeployment.sha256 &&
    backendChainDeployment.byteLength === backendReleaseAssets.chainDeployment.byteLength &&
    preparedSourceManifest.sha256 === backendReleaseAssets.preparedRootSourceManifest.sha256 &&
    preparedSourceManifest.byteLength ===
      backendReleaseAssets.preparedRootSourceManifest.byteLength,
  "Phase-A backend artifacts differ from their closure descriptors");
  assert(Array.isArray(backendArtifacts.standardJsonInputs) &&
    backendArtifacts.standardJsonInputs.length === 2,
  "Phase-A backend artifacts require both Standard JSON inputs");
  for (const [index, raw] of backendArtifacts.standardJsonInputs.entries()) {
    const artifact = exactKeys(raw, ["path", "sha256", "byteLength", "bytesBase64"],
      `Phase-A backend Standard JSON artifact ${index}`);
    const expected = backendReleaseAssets.standardJsonInputs[index];
    assert(artifact.path === expected.path && artifact.sha256 === expected.sha256 &&
      artifact.byteLength === expected.byteLength &&
      typeof artifact.bytesBase64 === "string" && artifact.bytesBase64.length > 0,
    `Phase-A backend Standard JSON artifact ${index} differs from its closure`);
    const bytes = Buffer.from(artifact.bytesBase64, "base64");
    assert(bytes.toString("base64") === artifact.bytesBase64 &&
      String(bytes.byteLength) === artifact.byteLength &&
      sha256Bytes(bytes) === artifact.sha256,
    `Phase-A backend Standard JSON artifact ${index} bytes differ`);
  }

  const consumers = exactKeys(bundle.consumerInputs,
    ["indexer", "cli", "developers", "backend"], "Phase-A bundle consumerInputs");
  const developers = exactKeys(consumers.developers, [
    "schemaVersion", "status", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "chainDeploymentDescriptorDigest", "startBlock",
    "finalizedCheckpoint", "finalityPolicy", "roots", "sourceVerificationEvidenceDigest",
    "sourceVerificationClosureDigest", "captureClosureDigest", "postingEventDigest",
    "backendReleaseAssetsDigest", "backendPromotionPublicInputDigest",
    "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest", "releaseManifestDigest",
    "backendRuntimeReadinessRequired",
    "flyControlPlaneReceiptRequired", "sourceRevision", "sourceTree", "sourceClosureDigest",
  ], "Phase-A bundle consumerInputs.developers");
  assert(developers.schemaVersion === DEVELOPERS_PROMOTION_INPUT_SCHEMA &&
    developers.status === "closed-awaiting-backend-readiness" &&
    developers.publicAuthorization === false && developers.publicWrites === false &&
    developers.chainId === CHAIN_ID && developers.caip2 === CAIP2 &&
    developers.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    developers.chainDeploymentDescriptorDigest === descriptorDigest &&
    developers.backendPromotionPublicInputDigest === null &&
    developers.backendPromotionInputDigest === null &&
    developers.backendReleaseEvidenceDigest === null &&
    developers.backendAuthorizationDigest === null && developers.releaseManifestDigest === null &&
    developers.backendRuntimeReadinessRequired === true &&
    developers.flyControlPlaneReceiptRequired === true,
  "Phase-A Developers input is not a closed non-authorizing handoff");
  const startBlock = exactDecimal(developers.startBlock,
    "Phase-A Developers startBlock", true);
  const finalizedCheckpoint = exactKeys(developers.finalizedCheckpoint,
    ["blockNumber", "blockHash"], "Phase-A Developers finalizedCheckpoint");
  assert(finalizedCheckpoint.blockNumber === startBlock,
    "Phase-A Developers checkpoint differs from the activation block");
  exactHash32(finalizedCheckpoint.blockHash,
    "Phase-A Developers finalizedCheckpoint.blockHash");
  assert(canonicalEqual(developers.finalityPolicy, FINALITY_POLICY),
    "Phase-A Developers finality policy differs");
  const roots = validateRoots(developers.roots, "Phase-A Developers roots");
  assert(canonicalEqual(liveDeployment.value?.contracts, roots) &&
    liveDeployment.value?.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    liveDeployment.value?.chainId === CHAIN_ID && liveDeployment.value?.caip2 === CAIP2 &&
    liveDeployment.value?.foundationSourceCommitment === FOUNDATION_SOURCE_COMMITMENT &&
    liveDeployment.value?.deploymentEvidence?.transactionHash ===
      captureClosure.l2ProviderReadbacks[0].transactionHash &&
    liveDeployment.value?.deploymentEvidence?.blockNumber === startBlock &&
    liveDeployment.value?.deploymentEvidence?.blockHash === finalizedCheckpoint.blockHash,
  "Phase-A live deployment differs from the Developers activation boundary");
  const postingEventDigest = canonicalSha256(
    "programmable.robinhood-custom-launch.sequencer-posting-event.v1",
    captureClosure.postingEvent,
  );
  assert(developers.sourceVerificationEvidenceDigest === sourceVerification.evidenceDigest &&
    developers.sourceVerificationClosureDigest ===
      sourceVerification.sourceVerificationClosureDigest &&
    developers.captureClosureDigest === captureClosure.captureClosureDigest &&
    developers.postingEventDigest === postingEventDigest &&
    developers.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    developers.sourceRevision === sourceClosure.revision &&
    developers.sourceTree === sourceClosure.tree &&
    developers.sourceClosureDigest === sourceClosure.sourceClosureDigest,
  "Phase-A Developers closure differs from its source/capture/backend evidence");

  const indexer = exactKeys(consumers.indexer, [
    "schemaVersion", "status", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "chainDeploymentDescriptorDigest", "router", "graphFactory",
    "permitAuthority", "finalizedCheckpoint", "finalityEvidenceDigest", "sourceRevision",
    "sourceTree", "sourceClosureDigest", "sourceVerificationClosureDigest",
    "captureClosureDigest", "backendReleaseAssetsDigest", "backendPromotionPublicInputDigest",
    "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest", "releaseManifestDigest",
    "postingEventDigest", "standardJsonInputs",
  ], "Phase-A bundle consumerInputs.indexer");
  assert(indexer.schemaVersion ===
      "programmable.robinhood-custom-launch.indexer-bootstrap.v1" &&
    indexer.status === "closed-awaiting-backend-readiness" &&
    indexer.publicAuthorization === false && indexer.publicWrites === false &&
    indexer.chainId === CHAIN_ID && indexer.caip2 === CAIP2 &&
    indexer.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    indexer.chainDeploymentDescriptorDigest === descriptorDigest &&
    indexer.backendPromotionPublicInputDigest === null &&
    indexer.backendPromotionInputDigest === null &&
    indexer.backendReleaseEvidenceDigest === null &&
    indexer.backendAuthorizationDigest === null && indexer.releaseManifestDigest === null &&
    indexer.sourceRevision === sourceClosure.revision && indexer.sourceTree === sourceClosure.tree &&
    indexer.sourceClosureDigest === sourceClosure.sourceClosureDigest &&
    indexer.sourceVerificationClosureDigest ===
      sourceVerification.sourceVerificationClosureDigest &&
    indexer.captureClosureDigest === captureClosure.captureClosureDigest &&
    indexer.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    indexer.postingEventDigest === postingEventDigest &&
    canonicalEqual(indexer.finalizedCheckpoint, finalizedCheckpoint),
  "Phase-A Indexer input differs from the closed activation evidence");
  exactSha256(indexer.finalityEvidenceDigest, "Phase-A Indexer finalityEvidenceDigest");
  for (const [field, contract] of [
    ["router", "programmableLaunchStampRouter"],
    ["graphFactory", "graphFactory"],
    ["permitAuthority", "permitAuthority"],
  ]) {
    const root = exactKeys(indexer[field], ["address", "runtimeCodeHash", "startBlock"],
      `Phase-A Indexer ${field}`);
    assert(sameAddress(root.address, ROOTS[contract].address) &&
      root.runtimeCodeHash === ROOTS[contract].runtimeCodeHash && root.startBlock === startBlock,
    `Phase-A Indexer ${field} differs from the code-owned activation root`);
  }
  assert(Array.isArray(indexer.standardJsonInputs) && indexer.standardJsonInputs.length === 2,
    "Phase-A Indexer input must bind both Standard JSON inputs");
  const indexerStandardJsonPaths = new Set();
  for (const [entryIndex, entry] of indexer.standardJsonInputs.entries()) {
    const normalized = exactKeys(entry, ["path", "sha256"],
      `Phase-A Indexer standardJsonInputs[${entryIndex}]`);
    const sourceEntry = sourceClosure.entries.find(({ path: entryPath }) =>
      entryPath === normalized.path);
    assert(sourceEntry?.sha256 === normalized.sha256 &&
      !indexerStandardJsonPaths.has(normalized.path) &&
      Object.values(SOURCE_ROOTS).some((expected) =>
        expected.standardJsonInputPath === normalized.path &&
        expected.standardJsonInputSha256 === normalized.sha256),
    `Phase-A Indexer standardJsonInputs[${entryIndex}] differs from source closure`);
    indexerStandardJsonPaths.add(normalized.path);
  }

  const cli = exactKeys(consumers.cli, [
    "schemaVersion", "status", "publicAuthorization", "publicWrites", "chainDeploymentId",
    "chainDeploymentDescriptorDigest", "chainDeploymentPath", "releaseBindingPath", "profile",
    "releaseManifestDigest", "captureClosureDigest", "sourceVerificationClosureDigest",
    "backendReleaseAssetsDigest", "backendPromotionPublicInputDigest",
    "backendPromotionInputDigest", "backendReleaseEvidenceDigest",
    "backendAuthorizationDigest",
  ], "Phase-A bundle consumerInputs.cli");
  assert(cli.schemaVersion === "programmable.robinhood-custom-launch.cli-promotion-input.v1" &&
    cli.status === "closed-awaiting-backend-readiness" && cli.publicAuthorization === false &&
    cli.publicWrites === false && cli.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    cli.chainDeploymentDescriptorDigest === descriptorDigest &&
    cli.chainDeploymentPath === LIVE_DEPLOYMENT_PATH &&
    cli.releaseBindingPath === CLI_RELEASE_BINDING_PATH &&
    canonicalEqual(cli.profile, cliReleaseBinding.value?.releaseIdentity?.profile) &&
    cli.releaseManifestDigest === null &&
    cli.captureClosureDigest === captureClosure.captureClosureDigest &&
    cli.sourceVerificationClosureDigest === sourceVerification.sourceVerificationClosureDigest &&
    cli.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    cli.backendPromotionPublicInputDigest === null &&
    cli.backendPromotionInputDigest === null && cli.backendReleaseEvidenceDigest === null &&
    cli.backendAuthorizationDigest === null,
  "Phase-A CLI input differs from the closed release binding");

  const finalized = exactKeys(bundle.finalizedBindings, [
    "chainId", "caip2", "chainDeploymentId", "chainDeploymentDescriptorDigest",
    "deploymentTransactionHash", "deploymentBlockNumber", "deploymentBlockHash", "startBlock",
    "finalityEvidenceDigest", "captureClosureDigest", "postingEventDigest",
    "sourceClosureDigest", "sourceVerificationClosureDigest", "backendReleaseAssetsDigest",
    "backendPromotionPublicInputDigest", "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest",
    "releaseManifestDigest",
  ], "Phase-A bundle finalizedBindings");
  assert(finalized.chainId === CHAIN_ID && finalized.caip2 === CAIP2 &&
    finalized.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    finalized.chainDeploymentDescriptorDigest === descriptorDigest &&
    finalized.deploymentBlockNumber === startBlock && finalized.startBlock === startBlock &&
    finalized.deploymentBlockHash === finalizedCheckpoint.blockHash &&
    finalized.deploymentTransactionHash ===
      liveDeployment.value?.deploymentEvidence?.transactionHash &&
    finalized.captureClosureDigest === captureClosure.captureClosureDigest &&
    finalized.postingEventDigest === postingEventDigest &&
    finalized.sourceClosureDigest === sourceClosure.sourceClosureDigest &&
    finalized.sourceVerificationClosureDigest ===
      sourceVerification.sourceVerificationClosureDigest &&
    finalized.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    finalized.backendPromotionPublicInputDigest === null &&
    finalized.backendPromotionInputDigest === null &&
    finalized.backendReleaseEvidenceDigest === null &&
    finalized.backendAuthorizationDigest === null &&
    finalized.finalityEvidenceDigest === indexer.finalityEvidenceDigest &&
    finalized.releaseManifestDigest === null,
  "Phase-A finalized bindings differ or claim a release manifest");
  exactSha256(finalized.finalityEvidenceDigest,
    "Phase-A finalizedBindings.finalityEvidenceDigest");
  assert(captureClosure.l2Checkpoint.blockNumber === finalized.deploymentBlockNumber &&
    captureClosure.l2Checkpoint.blockHash === finalized.deploymentBlockHash,
  "Phase-A capture checkpoint differs from the finalized deployment boundary");

  const backendConsumer = exactKeys(consumers.backend, [
    "schemaVersion", "state", "publicAuthorization", "chainId", "chainDeploymentId",
    "chainDeploymentDescriptorDigest", "backendReleaseAssetsDigest",
    "backendPromotionPublicInputDigest", "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest",
    "chainDeployment",
    "preparedRootSourceManifest", "standardJsonInputs", "runtimeReadinessPath",
    "runtimeReadinessSchemaVersion", "flyControlPlaneReceiptRequired",
  ], "Phase-A bundle consumerInputs.backend");
  assert(backendConsumer.schemaVersion ===
      "programmable.robinhood-custom-launch.backend-release-input.v1" &&
    backendConsumer.state === "phase-a-closed" && backendConsumer.publicAuthorization === false &&
    backendConsumer.chainId === CHAIN_ID && backendConsumer.chainDeploymentId ===
      CHAIN_DEPLOYMENT_ID && backendConsumer.chainDeploymentDescriptorDigest === descriptorDigest &&
    backendConsumer.backendReleaseAssetsDigest ===
      backendReleaseAssets.backendReleaseAssetsDigest &&
    backendConsumer.backendPromotionPublicInputDigest === null &&
    backendConsumer.backendPromotionInputDigest === null &&
    backendConsumer.backendReleaseEvidenceDigest === null &&
    backendConsumer.backendAuthorizationDigest === null &&
    canonicalEqual(backendConsumer.chainDeployment, backendReleaseAssets.chainDeployment) &&
    canonicalEqual(backendConsumer.preparedRootSourceManifest,
      backendReleaseAssets.preparedRootSourceManifest) &&
    canonicalEqual(backendConsumer.standardJsonInputs,
      backendReleaseAssets.standardJsonInputs) &&
    backendConsumer.runtimeReadinessPath === "/v4/chains/4663/readiness" &&
    backendConsumer.runtimeReadinessSchemaVersion ===
      "programmable.custom-launch-api-release-identity.v4" &&
    backendConsumer.flyControlPlaneReceiptRequired === true,
  "Phase-A backend consumer input differs from the closed backend asset handoff");

  const { stageBundleDigest, ...withoutDigest } = bundle;
  assert(stageBundleDigest === canonicalSha256(STAGE_BUNDLE_SCHEMA, withoutDigest),
    "Phase-A bundle digest is invalid");
  return Object.freeze({
    phase: "stage",
    bundle,
    developers,
    descriptor: liveDeployment.value,
    descriptorDigest,
    finalizedBindings: finalized,
    bundleDigest: stageBundleDigest,
    stageBundleDigest,
    sourceClosure,
    captureAuthorization: authorization,
    captureClosure,
    backendReleaseAssets,
    startBlock,
    finalizedCheckpoint,
  });
}

function validateBackendSafeReceipt(value, expectedKind, observedAt, label) {
  const receipt = exactKeys(value, [
    "kind", "httpStatus", "contentType", "date", "requestIdSha256", "requestByteLength",
    "requestSha256", "responseBodyByteLength", "responseBodySha256",
  ], label);
  assert(receipt.kind === expectedKind && receipt.httpStatus === 200 &&
    receipt.contentType === "application/json", `${label} identity differs`);
  exactSha256(receipt.requestIdSha256, `${label}.requestIdSha256`);
  exactDecimal(receipt.requestByteLength, `${label}.requestByteLength`, true);
  exactSha256(receipt.requestSha256, `${label}.requestSha256`);
  exactDecimal(receipt.responseBodyByteLength, `${label}.responseBodyByteLength`, true);
  exactSha256(receipt.responseBodySha256, `${label}.responseBodySha256`);
  assert(Number.isFinite(Date.parse(receipt.date)) &&
    Math.abs(Date.parse(receipt.date) - Date.parse(observedAt)) <= 2 * 60_000,
  `${label} response Date differs from the capture`);
  return receipt;
}

// Atomic Phase-B schema-swap boundary. Keep the backend public projection closed here and
// replace this whole parser when the public-safe producer contract changes; never make an old
// provider/raw field optional to bridge schema versions.
function validateBackendPromotionBinding(value) {
  const binding = exactKeys(value, [
    "schemaVersion", "publicArtifact", "publicInputDigest", "privateRawArtifact",
    "readbackReceipts", "backendPromotionInputDigest", "backendSource",
    "captureAuthorization", "runtimeReadiness", "flyControlPlane",
    "backendReleaseEvidenceDigest",
  ], "promotion bundle backendPromotionBinding");
  assert(binding.schemaVersion === BACKEND_PROMOTION_BINDING_SCHEMA,
    "backend promotion binding identity differs");
  const publicArtifact = validateArtifactDescriptor(binding.publicArtifact,
    BACKEND_PROMOTION_PUBLIC_INPUT_PATH, "backend promotion public artifact");
  exactSha256(binding.publicInputDigest, "backend promotion public input digest");
  const privateRawArtifact = exactKeys(binding.privateRawArtifact, [
    "path", "byteLength", "sha256", "captureId", "backendPromotionInputDigest",
  ], "private backend raw artifact binding");
  assert(privateRawArtifact.path === BACKEND_PROMOTION_PRIVATE_INPUT_PATH &&
    /^[0-9a-f]{64}$/u.test(privateRawArtifact.captureId ?? ""),
  "private backend raw artifact binding differs");
  exactDecimal(privateRawArtifact.byteLength, "private backend raw artifact byteLength", true);
  exactSha256(privateRawArtifact.sha256, "private backend raw artifact sha256");
  exactSha256(privateRawArtifact.backendPromotionInputDigest,
    "private backend promotion input digest");
  assert(binding.backendPromotionInputDigest === privateRawArtifact.backendPromotionInputDigest,
    "backend private-input digest binding differs");

  const backendSource = exactKeys(binding.backendSource,
    ["repository", "sourceCommit", "sourceTree"], "backend promotion source");
  assert(backendSource.repository === BACKEND_REPOSITORY &&
    COMMIT.test(backendSource.sourceCommit) && backendSource.sourceCommit !== "0".repeat(40) &&
    COMMIT.test(backendSource.sourceTree) && backendSource.sourceTree !== "0".repeat(40),
  "backend promotion source is invalid");

  const captureAuthorization = exactKeys(binding.captureAuthorization, [
    "trustClass", "subjectPath", "subjectByteLength", "subjectSha256",
    "attestationBundlePath", "attestationBundleByteLength", "attestationBundleSha256",
    "trustedRootSource", "trustedRootByteLength", "trustedRootSha256", "repository",
    "repositoryId", "workflow", "sourceRef", "sourceRevision", "sourceTree",
    "verificationDigest",
  ], "backend capture authorization public binding");
  assert(captureAuthorization.trustClass === "github-artifact-attestation" &&
    captureAuthorization.subjectPath === publicArtifact.path &&
    captureAuthorization.subjectByteLength === publicArtifact.byteLength &&
    captureAuthorization.subjectSha256 === publicArtifact.sha256 &&
    captureAuthorization.attestationBundlePath === BACKEND_PROMOTION_ATTESTATION_PATH &&
    captureAuthorization.trustedRootSource === "github-cli-embedded-tuf" &&
    captureAuthorization.repository === BACKEND_REPOSITORY &&
    captureAuthorization.repositoryId === BACKEND_REPOSITORY_ID &&
    captureAuthorization.workflow === BACKEND_CAPTURE_WORKFLOW &&
    captureAuthorization.sourceRef === "refs/heads/main" &&
    captureAuthorization.sourceRevision === backendSource.sourceCommit &&
    captureAuthorization.sourceTree === backendSource.sourceTree,
  "backend capture authorization public binding differs");
  for (const key of [
    "subjectByteLength", "attestationBundleByteLength", "trustedRootByteLength",
  ]) exactDecimal(captureAuthorization[key],
    `backend capture authorization public binding ${key}`, true);
  for (const key of [
    "subjectSha256", "attestationBundleSha256", "trustedRootSha256", "verificationDigest",
  ]) exactSha256(captureAuthorization[key],
    `backend capture authorization public binding ${key}`);

  const runtime = exactKeys(binding.runtimeReadiness, [
    "schemaVersion", "path", "httpStatus", "contentType", "responseByteLength",
    "responseSha256", "releaseIdentityDigest", "observedAt", "authorizationDigest",
  ], "backend runtime readiness public binding");
  assert(runtime.schemaVersion ===
      "programmable.custom-launch-api-runtime-readiness-receipt.v4" &&
    runtime.path === "/v4/chains/4663/readiness" && runtime.httpStatus === 200 &&
    /^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(runtime.contentType ?? ""),
  "backend runtime readiness public binding differs");
  exactDecimal(runtime.responseByteLength, "backend runtime responseByteLength", true);
  for (const key of ["responseSha256", "releaseIdentityDigest", "authorizationDigest"]) {
    exactSha256(runtime[key], `backend runtime ${key}`);
  }
  exactSecondInstant(runtime.observedAt, "backend runtime observedAt");

  const fly = exactKeys(binding.flyControlPlane, [
    "schemaVersion", "app", "releaseId", "releaseVersion", "imageDigest", "imageTag",
    "machines", "readinessResponseSha256", "rawReadbacksDigest", "observedAt",
    "authorizationDigest",
  ], "backend Fly control-plane public binding");
  assert(fly.schemaVersion ===
      "programmable.custom-launch-api-fly-control-plane-receipt.v1" &&
    fly.app === FLY_APP && /^[A-Za-z0-9_-]{1,128}$/u.test(fly.releaseId ?? "") &&
    /^[1-9][0-9]*$/u.test(fly.releaseVersion ?? "") &&
    fly.imageTag === `main-${backendSource.sourceCommit.slice(0, 12)}` &&
    fly.readinessResponseSha256 === runtime.responseSha256 &&
    fly.observedAt === runtime.observedAt,
  "backend Fly public binding identity differs");
  for (const key of [
    "imageDigest", "readinessResponseSha256", "rawReadbacksDigest", "authorizationDigest",
  ]) exactSha256(fly[key], `backend Fly ${key}`);
  assert(Array.isArray(fly.machines) && fly.machines.length >= 1 && fly.machines.length <= 8,
    "backend Fly public machine inventory is invalid");
  const machineIds = [];
  for (const [index, raw] of fly.machines.entries()) {
    const machine = exactKeys(raw, ["id", "state", "region", "imageDigest"],
      `backend Fly public machine ${index}`);
    assert(/^[a-z0-9]{6,64}$/u.test(machine.id ?? "") && machine.state === "started" &&
      /^[a-z0-9-]{2,16}$/u.test(machine.region ?? "") &&
      machine.imageDigest === fly.imageDigest &&
      (index === 0 || Buffer.compare(
        Buffer.from(machineIds[index - 1], "utf8"), Buffer.from(machine.id, "utf8"),
      ) < 0), `backend Fly public machine ${index} differs`);
    machineIds.push(machine.id);
  }

  const receipts = exactKeys(binding.readbackReceipts,
    ["readiness", "fly", "digest"], "backend safe readback receipts");
  const readinessReceipt = validateBackendSafeReceipt(
    receipts.readiness, "readiness", runtime.observedAt, "backend readiness safe receipt",
  );
  const expectedKinds = ["releases", "app", "machine-list",
    ...machineIds.flatMap((id) => [`machine:${id}`, `metadata:${id}`])];
  assert(Array.isArray(receipts.fly) && receipts.fly.length === expectedKinds.length &&
    receipts.fly.length >= 5 && receipts.fly.length <= 19,
  "backend safe Fly receipt inventory differs");
  const flyReceipts = receipts.fly.map((receipt, index) => validateBackendSafeReceipt(
    receipt, expectedKinds[index], runtime.observedAt, `backend Fly safe receipt ${index}`,
  ));
  assert(fly.rawReadbacksDigest === canonicalSha256(
    "programmable.custom-launch-api-fly-raw-readbacks.v1", flyReceipts,
  ), "backend Fly safe-receipt digest differs");
  assert(receipts.digest === canonicalSha256(
    "programmable.robinhood-custom-launch.backend-safe-readback-receipts.v1",
    [readinessReceipt, ...flyReceipts],
  ), "backend safe-receipt aggregate digest differs");
  assert(runtime.responseByteLength === readinessReceipt.responseBodyByteLength &&
    runtime.responseSha256 === readinessReceipt.responseBodySha256 &&
    runtime.authorizationDigest === canonicalSha256(
      "programmable.custom-launch-api-runtime-readiness-receipt.v4",
      {
        backendPromotionInputDigest: binding.backendPromotionInputDigest,
        requestSha256: readinessReceipt.requestSha256,
        responseSha256: readinessReceipt.responseBodySha256,
      },
    ), "backend runtime safe-receipt binding differs");
  assert(fly.authorizationDigest === canonicalSha256(
    "programmable.custom-launch-api-fly-control-plane-receipt.v1",
    {
      backendPromotionInputDigest: binding.backendPromotionInputDigest,
      rawReadbacksDigest: fly.rawReadbacksDigest,
      readinessResponseSha256: readinessReceipt.responseBodySha256,
    },
  ), "backend Fly authorization digest differs");
  exactSha256(binding.backendReleaseEvidenceDigest,
    "backend promotion release evidence digest");
  assert(!/"(?:private_ip|instance_id|config|env|metadata|bodyBytesBase64|sanitizedBytesBase64|request|response)"\s*:/u
    .test(JSON.stringify(binding)),
  "backend promotion binding contains private provider fields");
  return { binding, publicArtifact, privateRawArtifact, backendSource,
    captureAuthorization, runtime, fly, readinessReceipt, flyReceipts };
}

function validateBackendCaptureAuthorization(value, backend) {
  const authorization = exactKeys(value, [
    "schemaVersion", "trustClass", "subjectPath", "subjectByteLength", "subjectSha256",
    "attestationBundlePath", "attestationBundleByteLength", "attestationBundleSha256",
    "trustedRootSource", "trustedRootByteLength", "trustedRootSha256", "repository",
    "repositoryId", "workflow", "sourceRef", "sourceRevision", "sourceTree", "verifiedAt",
    "verificationDigest",
  ], "promotion bundle backendCaptureAuthorization");
  assert(authorization.schemaVersion === BACKEND_CAPTURE_AUTHORIZATION_SCHEMA &&
    authorization.trustClass === "github-artifact-attestation" &&
    authorization.subjectPath === backend.publicArtifact.path &&
    authorization.subjectByteLength === backend.publicArtifact.byteLength &&
    authorization.subjectSha256 === backend.publicArtifact.sha256 &&
    authorization.attestationBundlePath === BACKEND_PROMOTION_ATTESTATION_PATH &&
    authorization.trustedRootSource === "github-cli-embedded-tuf" &&
    authorization.repository === BACKEND_REPOSITORY &&
    authorization.repositoryId === BACKEND_REPOSITORY_ID &&
    authorization.workflow === BACKEND_CAPTURE_WORKFLOW &&
    authorization.sourceRef === "refs/heads/main" &&
    authorization.sourceRevision === backend.backendSource.sourceCommit &&
    authorization.sourceTree === backend.backendSource.sourceTree,
  "backend capture authorization does not bind the protected backend source");
  for (const key of [
    "subjectByteLength", "attestationBundleByteLength", "trustedRootByteLength",
  ]) exactDecimal(authorization[key], `backend capture authorization ${key}`, true);
  for (const key of [
    "subjectSha256", "attestationBundleSha256", "trustedRootSha256",
  ]) exactSha256(authorization[key], `backend capture authorization ${key}`);
  exactSecondInstant(authorization.verifiedAt, "backend capture authorization verifiedAt");
  const authorizationDelay = Date.parse(authorization.verifiedAt) -
    Date.parse(backend.runtime.observedAt);
  assert(authorizationDelay >= 0 && authorizationDelay <= 10 * 60_000,
    "backend capture authorization time is outside the capture window");
  assert(authorization.verificationDigest === canonicalSha256(
    BACKEND_CAPTURE_AUTHORIZATION_SCHEMA,
    { ...structuredClone(authorization), verificationDigest: null },
  ), "backend capture authorization digest differs");
  const { schemaVersion: _schemaVersion, verifiedAt: _verifiedAt, ...publicBinding } =
    authorization;
  assert(canonicalEqual(publicBinding, backend.captureAuthorization),
    "backend capture authorization public projection differs");
  return authorization;
}

function validateBackendReleaseEvidence(value, stage, backend) {
  const evidence = exactKeys(value, [
    "schemaVersion", "repository", "sourceCommit", "sourceTree",
    "chainDeploymentDescriptorDigest", "backendPromotionInputDigest", "apiContract", "migration",
    "openApiSha256", "profileDigest", "admissionPolicyDigest", "finalityPolicyDigest",
    "runtimeReadiness", "flyControlPlane", "backendReleaseEvidenceDigest",
  ], "promotion bundle backend release evidence");
  assert(evidence.schemaVersion === BACKEND_RELEASE_EVIDENCE_SCHEMA &&
    evidence.repository === BACKEND_REPOSITORY &&
    evidence.sourceCommit === backend.backendSource.sourceCommit &&
    evidence.sourceTree === backend.backendSource.sourceTree &&
    evidence.chainDeploymentDescriptorDigest === stage.descriptorDigest &&
    evidence.backendPromotionInputDigest === backend.binding.backendPromotionInputDigest,
  "backend release evidence source/deployment binding differs");
  const apiContract = exactKeys(evidence.apiContract, ["path", "sha256"],
    "backend release evidence API contract");
  assert(apiContract.path === "release/custom-launch-api-contract.v4.json",
    "backend release evidence API contract path differs");
  exactSha256(apiContract.sha256, "backend release evidence API contract digest");
  const migration = exactKeys(evidence.migration, ["path", "sha256"],
    "backend release evidence migration");
  assert(/^migrations\/[0-9]{4}_[a-z0-9_]+\.sql$/u.test(migration.path),
    "backend release evidence migration path is invalid");
  exactSha256(migration.sha256, "backend release evidence migration digest");
  const stageBinding = stage.bundle.artifacts.cliReleaseBinding.value;
  const openApi = stageBinding?.machineContracts?.find(({ name } = {}) => name === "openapi");
  assert(evidence.openApiSha256 === openApi?.sha256 &&
    evidence.profileDigest === stageBinding?.releaseIdentity?.profile?.profileDigest &&
    evidence.admissionPolicyDigest ===
      stageBinding?.releaseIdentity?.profile?.admissionPolicyDigest &&
    evidence.finalityPolicyDigest === stageBinding?.releaseIdentity?.finalityPolicy?.policyDigest,
  "backend release evidence semantic digests differ from the staged binding");
  const runtime = exactKeys(evidence.runtimeReadiness, [
    "schemaVersion", "path", "httpStatus", "contentType", "responseByteLength",
    "responseSha256", "releaseIdentityDigest", "observedAt", "authorizationDigest",
  ], "backend runtime readiness receipt");
  assert(runtime.schemaVersion === "programmable.custom-launch-api-runtime-readiness-receipt.v4" &&
    canonicalEqual(runtime, backend.runtime),
  "backend runtime readiness receipt differs from the public-safe binding");
  exactSha256(runtime.authorizationDigest, "backend runtime readiness authorization digest");
  const fly = exactKeys(evidence.flyControlPlane, [
    "schemaVersion", "app", "releaseId", "releaseVersion", "imageDigest", "imageTag",
    "machines", "readinessResponseSha256", "rawReadbacksDigest", "observedAt",
    "authorizationDigest",
  ], "backend Fly control-plane receipt");
  assert(fly.schemaVersion === "programmable.custom-launch-api-fly-control-plane-receipt.v1" &&
    fly.app === FLY_APP && /^[A-Za-z0-9_-]{1,128}$/u.test(fly.releaseId ?? "") &&
    DECIMAL.test(fly.releaseVersion ?? "") && fly.releaseVersion !== "0" &&
    /^main-[0-9a-f]{12}$/u.test(fly.imageTag ?? "") &&
    fly.imageTag === `main-${backend.backendSource.sourceCommit.slice(0, 12)}` &&
    fly.readinessResponseSha256 === runtime.responseSha256 &&
    canonicalEqual(fly, backend.fly),
  "backend Fly receipt identity differs");
  exactSha256(fly.imageDigest, "backend Fly image digest");
  assert(Array.isArray(fly.machines) && fly.machines.length >= 1 && fly.machines.length <= 8,
    "backend Fly receipt machine inventory is invalid");
  let previousId = null;
  for (const [index, raw] of fly.machines.entries()) {
    const machine = exactKeys(raw, ["id", "state", "region", "imageDigest"],
      `backend Fly receipt machine ${index}`);
    assert(/^[a-z0-9]{6,64}$/u.test(machine.id ?? "") &&
      (previousId === null || Buffer.compare(Buffer.from(previousId), Buffer.from(machine.id)) < 0) &&
      machine.state === "started" && /^[a-z0-9-]{2,16}$/u.test(machine.region ?? "") &&
      machine.imageDigest === fly.imageDigest,
    `backend Fly receipt machine ${index} differs`);
    previousId = machine.id;
  }
  exactSha256(fly.authorizationDigest, "backend Fly authorization digest");
  const { backendReleaseEvidenceDigest, ...withoutDigest } = evidence;
  assert(backendReleaseEvidenceDigest ===
    canonicalSha256(BACKEND_RELEASE_EVIDENCE_SCHEMA, withoutDigest),
  "backend release evidence digest differs");
  return evidence;
}

function validateBackendReleaseAuthorization(value, stage, backend, evidence) {
  const stageBundleSha256 = stage.stageBundleSha256 ??
    sha256Bytes(canonicalArtifactBytes(stage.bundle));
  const stageBundleDigest = stage.stageBundleDigest ?? stage.bundle.stageBundleDigest;
  const authorization = exactKeys(value, [
    "schemaVersion", "trustClass", "repository", "repositoryId", "workflow", "sourceRef",
    "producerRevision", "producerTree", "stageSourceRevision", "stageSourceTree",
    "stageBundlePath", "stageBundleSha256", "stageBundleDigest",
    "backendPromotionPublicInputPath", "backendPromotionPublicInputSha256",
    "backendPromotionPublicInputDigest", "chainDeploymentDescriptorDigest",
    "backendPromotionInputDigest", "backendReleaseEvidenceDigest",
    "runtimeReadinessResponseSha256", "flyRawReadbacksDigest", "observedAt",
    "authorizationDigest",
  ], "promotion bundle backendAuthorization");
  assert(authorization.schemaVersion === BACKEND_RELEASE_AUTHORIZATION_SCHEMA &&
    authorization.trustClass === "github-artifact-attestation" &&
    authorization.repository === PROGRAMMABLE_REPOSITORY &&
    authorization.repositoryId === PROGRAMMABLE_REPOSITORY_ID &&
    authorization.workflow === BACKEND_AUTHORIZATION_WORKFLOW &&
    authorization.sourceRef === PROGRAMMABLE_PROTECTED_REF &&
    COMMIT.test(authorization.producerRevision) &&
    authorization.producerRevision !== "0".repeat(40) &&
    COMMIT.test(authorization.producerTree) && authorization.producerTree !== "0".repeat(40) &&
    authorization.producerRevision !== authorization.stageSourceRevision &&
    authorization.stageSourceRevision === stage.sourceClosure.revision &&
    authorization.stageSourceTree === stage.sourceClosure.tree &&
    authorization.stageBundlePath === CANONICAL_STAGE_BUNDLE_PATH &&
    authorization.stageBundleSha256 === stageBundleSha256 &&
    authorization.stageBundleDigest === stageBundleDigest &&
    authorization.backendPromotionPublicInputPath === backend.publicArtifact.path &&
    authorization.backendPromotionPublicInputSha256 === backend.publicArtifact.sha256 &&
    authorization.backendPromotionPublicInputDigest === backend.binding.publicInputDigest &&
    authorization.chainDeploymentDescriptorDigest === stage.descriptorDigest &&
    authorization.backendPromotionInputDigest === backend.binding.backendPromotionInputDigest &&
    authorization.backendReleaseEvidenceDigest === evidence.backendReleaseEvidenceDigest &&
    authorization.runtimeReadinessResponseSha256 === evidence.runtimeReadiness.responseSha256 &&
    authorization.flyRawReadbacksDigest === evidence.flyControlPlane.rawReadbacksDigest &&
    authorization.observedAt === backend.runtime.observedAt &&
    authorization.observedAt === backend.fly.observedAt,
  "backend release authorization does not bind the exact production evidence");
  exactSecondInstant(authorization.observedAt, "backend release authorization observedAt");
  const { authorizationDigest, ...withoutDigest } = authorization;
  assert(authorizationDigest === canonicalSha256(BACKEND_RELEASE_AUTHORIZATION_SCHEMA,
    withoutDigest), "backend release authorization digest differs");
  return authorization;
}

export function parsePromotionBundle(value, { stageBundle } = {}) {
  assertNoRawProviderPayload(value, "Phase-B promotion bundle");
  const bundle = exactKeys(value, [
    "schemaVersion", "state", "releaseReady", "publicAuthorization", "publicWrites",
    "stageBundle", "chainDeploymentId", "inputEvidenceDigest", "preparedArtifact",
    "captureAuthorization", "captureClosure", "sourceVerification", "sourceClosure",
    "backendReleaseAssets", "backendPromotionBinding", "backendCaptureAuthorization",
    "backendAuthorization", "finalizedBindings", "artifacts", "consumerInputs",
    "promotionBundleDigest",
  ], "Phase-B promotion bundle");
  assert(bundle.schemaVersion === PROMOTION_BUNDLE_SCHEMA && bundle.state === "finalized-live" &&
    bundle.releaseReady === true && bundle.publicAuthorization === true &&
    bundle.publicWrites === true && bundle.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Phase-B bundle is not the production-attested finalized-live input");
  exactSha256(bundle.inputEvidenceDigest, "Phase-B bundle inputEvidenceDigest");
  const stageReference = exactKeys(bundle.stageBundle,
    ["path", "sha256", "byteLength", "stageBundleDigest"], "Phase-B stageBundle reference");
  assert(stageReference.path === CANONICAL_STAGE_BUNDLE_PATH,
    "Phase-B bundle does not reference the canonical Phase-A path");
  exactSha256(stageReference.sha256, "Phase-B stage bundle bytes digest");
  exactDecimal(stageReference.byteLength, "Phase-B stage bundle byteLength", true);
  exactSha256(stageReference.stageBundleDigest, "Phase-B stage bundle semantic digest");
  const parsedStage = stageBundle === undefined ? null : parseStageBundle(stageBundle);
  if (parsedStage) {
    const stageBytes = canonicalArtifactBytes(parsedStage.bundle);
    assert(stageReference.sha256 === sha256Bytes(stageBytes) &&
      stageReference.byteLength === String(stageBytes.byteLength) &&
      stageReference.stageBundleDigest === parsedStage.stageBundleDigest &&
      bundle.inputEvidenceDigest === parsedStage.bundle.inputEvidenceDigest,
    "Phase-B bundle does not bind the exact canonical Phase-A bytes and semantic digest");
  }
  const prepared = exactKeys(bundle.preparedArtifact,
    ["path", "sha256", "state", "preserved"], "Phase-B preparedArtifact");
  assert(prepared.path === PREDEPLOYMENT_PATH && prepared.sha256 === PREDEPLOYMENT_SHA256 &&
    prepared.state === "prepared-not-broadcast" && prepared.preserved === true,
  "Phase-B bundle does not preserve the exact prepared artifact");
  if (parsedStage) assert(canonicalEqual(prepared, parsedStage.bundle.preparedArtifact),
    "Phase-B bundle changed the Phase-A prepared artifact");

  const sourceVerification = validateSourceVerification(bundle.sourceVerification);
  const sourceClosure = validateSourceClosure(bundle.sourceClosure, sourceVerification);
  const captureAuthorization = validateCaptureAuthorization(bundle.captureAuthorization,
    sourceClosure);
  const captureClosure = validateCaptureClosure(bundle.captureClosure, captureAuthorization,
    sourceClosure, sourceVerification);
  if (parsedStage) assert(canonicalEqual(bundle.captureAuthorization,
    parsedStage.bundle.captureAuthorization) && canonicalEqual(bundle.captureClosure,
    parsedStage.bundle.captureClosure) && canonicalEqual(bundle.sourceVerification,
    parsedStage.bundle.sourceVerification) && canonicalEqual(bundle.sourceClosure,
    parsedStage.bundle.sourceClosure), "Phase-B bundle changed the Phase-A capture/source closure");

  const artifacts = exactKeys(bundle.artifacts,
    ["liveDeployment", "cliReleaseBinding", "backendRelease"], "Phase-B artifacts");
  const liveDeployment = validateArtifact(
    artifacts.liveDeployment, LIVE_DEPLOYMENT_PATH, "Phase-B live deployment",
  );
  const descriptorDigest = keccak256(
    new TextEncoder().encode(canonicalizeJson(liveDeployment.value)),
  );
  const backendReleaseAssets = validateBackendReleaseAssets(
    bundle.backendReleaseAssets, descriptorDigest,
  );
  const cliRaw = exactKeys(artifacts.cliReleaseBinding,
    ["path", "sha256", "byteLength", "value", "replacesSha256"],
    "Phase-B CLI release binding");
  const cliReleaseBinding = validateArtifact({
    path: cliRaw.path, sha256: cliRaw.sha256, byteLength: cliRaw.byteLength, value: cliRaw.value,
  }, CLI_RELEASE_BINDING_PATH, "Phase-B CLI release binding");
  exactSha256(cliRaw.replacesSha256, "Phase-B CLI release binding replacesSha256");
  assert(cliReleaseBinding.value?.releaseReady === true &&
    Array.isArray(cliReleaseBinding.value?.blockers) &&
    cliReleaseBinding.value.blockers.length === 0 &&
    cliReleaseBinding.value?.evidence?.backend !== null &&
    cliReleaseBinding.value?.evidence?.manifest !== null,
  "Phase-B CLI binding is not backend-attested and release-ready");
  if (parsedStage) assert(canonicalEqual(liveDeployment, parsedStage.bundle.artifacts.liveDeployment) &&
    canonicalEqual(bundle.backendReleaseAssets, parsedStage.bundle.backendReleaseAssets) &&
    canonicalEqual(artifacts.backendRelease, parsedStage.bundle.artifacts.backendRelease) &&
    cliRaw.replacesSha256 === parsedStage.bundle.artifacts.cliReleaseBinding.replacesSha256,
  "Phase-B bundle changed the Phase-A deployment/backend assets");

  const stageContext = parsedStage ?? {
    descriptor: liveDeployment.value,
    descriptorDigest,
    sourceClosure,
    bundle,
    stageBundleSha256: stageReference.sha256,
    stageBundleDigest: stageReference.stageBundleDigest,
  };
  const backend = validateBackendPromotionBinding(bundle.backendPromotionBinding);
  const backendCaptureAuthorization = validateBackendCaptureAuthorization(
    bundle.backendCaptureAuthorization, backend,
  );
  const backendEvidence = validateBackendReleaseEvidence(
    cliReleaseBinding.value.evidence.backend, stageContext, backend,
  );
  assert(backend.binding.backendReleaseEvidenceDigest ===
    backendEvidence.backendReleaseEvidenceDigest,
  "backend promotion binding differs from the CLI backend evidence digest");
  const backendAuthorization = validateBackendReleaseAuthorization(
    bundle.backendAuthorization, stageContext, backend, backendEvidence,
  );
  assert(backendCaptureAuthorization.subjectSha256 ===
      bundle.backendCaptureAuthorization.subjectSha256,
  "backend capture authorization subject differs");

  const finalized = exactKeys(bundle.finalizedBindings, [
    "chainId", "caip2", "chainDeploymentId", "chainDeploymentDescriptorDigest",
    "deploymentTransactionHash", "deploymentBlockNumber", "deploymentBlockHash", "startBlock",
    "finalityEvidenceDigest", "captureClosureDigest", "postingEventDigest",
    "sourceClosureDigest", "sourceVerificationClosureDigest", "backendReleaseAssetsDigest",
    "backendPromotionPublicInputDigest", "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest",
    "releaseManifestDigest",
  ], "Phase-B finalizedBindings");
  const startBlock = exactDecimal(finalized.startBlock, "Phase-B startBlock", true);
  assert(finalized.chainId === CHAIN_ID && finalized.caip2 === CAIP2 &&
    finalized.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    finalized.chainDeploymentDescriptorDigest === descriptorDigest &&
    finalized.deploymentBlockNumber === startBlock &&
    finalized.deploymentBlockHash === liveDeployment.value?.deploymentEvidence?.blockHash &&
    finalized.deploymentTransactionHash ===
      liveDeployment.value?.deploymentEvidence?.transactionHash &&
    finalized.captureClosureDigest === captureClosure.captureClosureDigest &&
    finalized.sourceClosureDigest === sourceClosure.sourceClosureDigest &&
    finalized.sourceVerificationClosureDigest ===
      sourceVerification.sourceVerificationClosureDigest &&
    finalized.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    finalized.backendPromotionPublicInputDigest === backend.binding.publicInputDigest &&
    finalized.backendPromotionInputDigest === backend.binding.backendPromotionInputDigest &&
    finalized.backendReleaseEvidenceDigest === backendEvidence.backendReleaseEvidenceDigest &&
    finalized.backendAuthorizationDigest === backendAuthorization.authorizationDigest,
  "Phase-B finalized bindings differ from the retained evidence");
  for (const key of ["finalityEvidenceDigest", "postingEventDigest", "releaseManifestDigest"]) {
    exactSha256(finalized[key], `Phase-B finalizedBindings.${key}`);
  }
  if (parsedStage) assert(canonicalEqual(
    Object.fromEntries(Object.entries(finalized).filter(([key]) => ![
      "backendPromotionPublicInputDigest", "backendPromotionInputDigest",
      "backendReleaseEvidenceDigest", "backendAuthorizationDigest",
      "releaseManifestDigest",
    ].includes(key))),
    Object.fromEntries(Object.entries(parsedStage.finalizedBindings).filter(([key]) => ![
      "backendPromotionPublicInputDigest", "backendPromotionInputDigest",
      "backendReleaseEvidenceDigest", "backendAuthorizationDigest",
      "releaseManifestDigest",
    ].includes(key))),
  ), "Phase-B bundle changed the Phase-A chain/source/finality bindings");

  const consumers = exactKeys(bundle.consumerInputs,
    ["indexer", "cli", "developers", "backend"], "Phase-B consumerInputs");
  const developers = exactKeys(consumers.developers, [
    "schemaVersion", "status", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "chainDeploymentDescriptorDigest", "startBlock",
    "finalizedCheckpoint", "finalityPolicy", "roots", "sourceVerificationEvidenceDigest",
    "sourceVerificationClosureDigest", "captureClosureDigest", "postingEventDigest",
    "backendReleaseAssetsDigest", "backendPromotionPublicInputDigest",
    "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest", "releaseManifestDigest",
    "backendRuntimeReadinessRequired", "flyControlPlaneReceiptRequired", "sourceRevision",
    "sourceTree", "sourceClosureDigest",
  ], "Phase-B consumerInputs.developers");
  const finalizedCheckpoint = exactKeys(developers.finalizedCheckpoint,
    ["blockNumber", "blockHash"], "Phase-B Developers finalizedCheckpoint");
  assert(developers.schemaVersion === DEVELOPERS_PROMOTION_INPUT_SCHEMA &&
    developers.status === "authorized-live" && developers.publicAuthorization === true &&
    developers.publicWrites === true && developers.chainId === CHAIN_ID &&
    developers.caip2 === CAIP2 && developers.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    developers.chainDeploymentDescriptorDigest === descriptorDigest &&
    developers.startBlock === startBlock && finalizedCheckpoint.blockNumber === startBlock &&
    finalizedCheckpoint.blockHash === finalized.deploymentBlockHash &&
    canonicalEqual(developers.finalityPolicy, FINALITY_POLICY) &&
    canonicalEqual(validateRoots(developers.roots, "Phase-B Developers roots"),
      liveDeployment.value?.contracts) &&
    developers.sourceVerificationEvidenceDigest === sourceVerification.evidenceDigest &&
    developers.sourceVerificationClosureDigest ===
      sourceVerification.sourceVerificationClosureDigest &&
    developers.captureClosureDigest === captureClosure.captureClosureDigest &&
    developers.postingEventDigest === finalized.postingEventDigest &&
    developers.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    developers.backendPromotionPublicInputDigest === backend.binding.publicInputDigest &&
    developers.backendPromotionInputDigest === backend.binding.backendPromotionInputDigest &&
    developers.backendReleaseEvidenceDigest === backendEvidence.backendReleaseEvidenceDigest &&
    developers.backendAuthorizationDigest === backendAuthorization.authorizationDigest &&
    developers.releaseManifestDigest === finalized.releaseManifestDigest &&
    developers.backendRuntimeReadinessRequired === false &&
    developers.flyControlPlaneReceiptRequired === false &&
    developers.sourceRevision === sourceClosure.revision &&
    developers.sourceTree === sourceClosure.tree &&
    developers.sourceClosureDigest === sourceClosure.sourceClosureDigest,
  "Phase-B Developers input differs from the production-attested closure");

  const indexer = exactKeys(consumers.indexer, [
    "schemaVersion", "status", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "chainDeploymentDescriptorDigest", "router", "graphFactory",
    "permitAuthority", "finalizedCheckpoint", "finalityEvidenceDigest", "sourceRevision",
    "sourceTree", "sourceClosureDigest", "sourceVerificationClosureDigest",
    "captureClosureDigest", "backendReleaseAssetsDigest", "backendPromotionPublicInputDigest",
    "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest", "releaseManifestDigest",
    "postingEventDigest", "standardJsonInputs",
  ], "Phase-B consumerInputs.indexer");
  assert(indexer.schemaVersion ===
      "programmable.robinhood-custom-launch.indexer-bootstrap.v1" &&
    indexer.status === "authorized-live" && indexer.publicAuthorization === true &&
    indexer.publicWrites === true && indexer.chainId === CHAIN_ID && indexer.caip2 === CAIP2 &&
    indexer.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    indexer.chainDeploymentDescriptorDigest === descriptorDigest &&
    canonicalEqual(indexer.finalizedCheckpoint, finalizedCheckpoint) &&
    indexer.finalityEvidenceDigest === finalized.finalityEvidenceDigest &&
    indexer.sourceRevision === sourceClosure.revision && indexer.sourceTree === sourceClosure.tree &&
    indexer.sourceClosureDigest === sourceClosure.sourceClosureDigest &&
    indexer.sourceVerificationClosureDigest ===
      sourceVerification.sourceVerificationClosureDigest &&
    indexer.captureClosureDigest === captureClosure.captureClosureDigest &&
    indexer.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    indexer.backendPromotionPublicInputDigest === backend.binding.publicInputDigest &&
    indexer.backendPromotionInputDigest === backend.binding.backendPromotionInputDigest &&
    indexer.backendReleaseEvidenceDigest === backendEvidence.backendReleaseEvidenceDigest &&
    indexer.backendAuthorizationDigest === backendAuthorization.authorizationDigest &&
    indexer.releaseManifestDigest === finalized.releaseManifestDigest &&
    indexer.postingEventDigest === finalized.postingEventDigest,
  "Phase-B Indexer input differs from the production-attested closure");
  for (const [field, contract] of [
    ["router", "programmableLaunchStampRouter"],
    ["graphFactory", "graphFactory"],
    ["permitAuthority", "permitAuthority"],
  ]) {
    const root = exactKeys(indexer[field], ["address", "runtimeCodeHash", "startBlock"],
      `Phase-B Indexer ${field}`);
    assert(sameAddress(root.address, ROOTS[contract].address) &&
      root.runtimeCodeHash === ROOTS[contract].runtimeCodeHash && root.startBlock === startBlock,
    `Phase-B Indexer ${field} differs from the code-owned activation root`);
  }
  assert(Array.isArray(indexer.standardJsonInputs) && indexer.standardJsonInputs.length === 2,
    "Phase-B Indexer input must bind both Standard JSON inputs");
  const phaseBStandardJsonPaths = new Set();
  for (const [entryIndex, raw] of indexer.standardJsonInputs.entries()) {
    const entry = exactKeys(raw, ["path", "sha256"],
      `Phase-B Indexer standardJsonInputs[${entryIndex}]`);
    const expected = Object.values(SOURCE_ROOTS).find(({ standardJsonInputPath }) =>
      standardJsonInputPath === entry.path);
    assert(expected?.standardJsonInputSha256 === entry.sha256 &&
      !phaseBStandardJsonPaths.has(entry.path),
    `Phase-B Indexer standardJsonInputs[${entryIndex}] differs from source closure`);
    phaseBStandardJsonPaths.add(entry.path);
  }

  const cli = exactKeys(consumers.cli, [
    "schemaVersion", "status", "publicAuthorization", "publicWrites", "chainDeploymentId",
    "chainDeploymentDescriptorDigest", "chainDeploymentPath", "releaseBindingPath", "profile",
    "releaseManifestDigest", "captureClosureDigest", "sourceVerificationClosureDigest",
    "backendReleaseAssetsDigest", "backendPromotionPublicInputDigest",
    "backendPromotionInputDigest", "backendReleaseEvidenceDigest",
    "backendAuthorizationDigest",
  ], "Phase-B consumerInputs.cli");
  assert(cli.schemaVersion === "programmable.robinhood-custom-launch.cli-promotion-input.v1" &&
    cli.status === "authorized-live" && cli.publicAuthorization === true &&
    cli.publicWrites === true && cli.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    cli.chainDeploymentDescriptorDigest === descriptorDigest &&
    cli.chainDeploymentPath === LIVE_DEPLOYMENT_PATH &&
    cli.releaseBindingPath === CLI_RELEASE_BINDING_PATH &&
    canonicalEqual(cli.profile, cliReleaseBinding.value?.releaseIdentity?.profile) &&
    cli.releaseManifestDigest === finalized.releaseManifestDigest &&
    cli.captureClosureDigest === captureClosure.captureClosureDigest &&
    cli.sourceVerificationClosureDigest === sourceVerification.sourceVerificationClosureDigest &&
    cli.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    cli.backendPromotionPublicInputDigest === backend.binding.publicInputDigest &&
    cli.backendPromotionInputDigest === backend.binding.backendPromotionInputDigest &&
    cli.backendReleaseEvidenceDigest === backendEvidence.backendReleaseEvidenceDigest &&
    cli.backendAuthorizationDigest === backendAuthorization.authorizationDigest,
  "Phase-B CLI input differs from the production-attested binding");

  const backendConsumer = exactKeys(consumers.backend, [
    "schemaVersion", "state", "publicAuthorization", "chainId", "chainDeploymentId",
    "chainDeploymentDescriptorDigest", "backendReleaseAssetsDigest",
    "backendPromotionPublicInputDigest", "backendPromotionInputDigest",
    "backendReleaseEvidenceDigest", "backendAuthorizationDigest",
    "chainDeployment", "preparedRootSourceManifest", "standardJsonInputs",
    "runtimeReadinessPath", "runtimeReadinessSchemaVersion", "flyControlPlaneReceiptRequired",
    "runtimeReadinessResponseSha256", "flyRawReadbacksDigest",
  ], "Phase-B consumerInputs.backend");
  assert(backendConsumer.schemaVersion ===
      "programmable.robinhood-custom-launch.backend-release-input.v1" &&
    backendConsumer.state === "phase-b-authorized" &&
    backendConsumer.publicAuthorization === true && backendConsumer.chainId === CHAIN_ID &&
    backendConsumer.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    backendConsumer.chainDeploymentDescriptorDigest === descriptorDigest &&
    backendConsumer.backendReleaseAssetsDigest === backendReleaseAssets.backendReleaseAssetsDigest &&
    backendConsumer.backendPromotionPublicInputDigest === backend.binding.publicInputDigest &&
    backendConsumer.backendPromotionInputDigest === backend.binding.backendPromotionInputDigest &&
    backendConsumer.backendReleaseEvidenceDigest === backendEvidence.backendReleaseEvidenceDigest &&
    backendConsumer.backendAuthorizationDigest === backendAuthorization.authorizationDigest &&
    canonicalEqual(backendConsumer.chainDeployment, backendReleaseAssets.chainDeployment) &&
    canonicalEqual(backendConsumer.preparedRootSourceManifest,
      backendReleaseAssets.preparedRootSourceManifest) &&
    canonicalEqual(backendConsumer.standardJsonInputs, backendReleaseAssets.standardJsonInputs) &&
    backendConsumer.runtimeReadinessPath === "/v4/chains/4663/readiness" &&
    backendConsumer.runtimeReadinessSchemaVersion ===
      "programmable.custom-launch-api-release-identity.v4" &&
    backendConsumer.flyControlPlaneReceiptRequired === true &&
    backendConsumer.runtimeReadinessResponseSha256 ===
      backendEvidence.runtimeReadiness.responseSha256 &&
    backendConsumer.flyRawReadbacksDigest === backendEvidence.flyControlPlane.rawReadbacksDigest,
  "Phase-B backend input differs from the production-attested backend closure");

  const finalBindingManifest = cliReleaseBinding.value.evidence.manifest;
  assert(finalBindingManifest?.releaseManifestDigest === finalized.releaseManifestDigest &&
    finalBindingManifest?.backendReleaseEvidenceDigest ===
      backendEvidence.backendReleaseEvidenceDigest &&
    finalBindingManifest?.chainDeploymentDescriptorDigest === descriptorDigest &&
    finalBindingManifest?.sourceRevision === sourceClosure.revision &&
    finalBindingManifest?.sourceTree === sourceClosure.tree &&
    finalBindingManifest?.sourceClosureDigest === sourceClosure.sourceClosureDigest &&
    finalBindingManifest?.finalityEvidenceDigest === finalized.finalityEvidenceDigest,
  "Phase-B CLI release manifest differs from finalized bindings");

  const { promotionBundleDigest, ...withoutDigest } = bundle;
  assert(promotionBundleDigest === canonicalSha256(PROMOTION_BUNDLE_SCHEMA, withoutDigest),
    "Phase-B promotion bundle digest is invalid");
  return Object.freeze({
    phase: "promotion", bundle, developers, descriptor: liveDeployment.value, descriptorDigest,
    finalizedBindings: finalized, bundleDigest: promotionBundleDigest, promotionBundleDigest,
    stageBundleDigest: stageReference.stageBundleDigest, stageReference, sourceClosure,
    captureAuthorization, captureClosure, backendReleaseAssets, backendEvidence,
    backendAuthorization, startBlock, finalizedCheckpoint,
  });
}

// Atomic Indexer identity schema-swap boundary. Provider receipt and audit evidence bind this
// identity transitively, so the frozen producer schema is refreshed here without duplicating its
// promotion fields into those two envelopes.
export function parseIndexerReleaseIdentity(value, { bundle } = {}) {
  const identity = exactKeys(value, [
    "schemaVersion", "deployment", "sourceCommit", "sourceTree", "configSha256",
    "schemaSha256", "handlerSha256", "sourceRegistrySha256", "eventSetSha256",
    "eventCount", "chainId", "caip2", "chainDeploymentId", "promotionBundleDigest",
    "chainDeploymentDescriptorDigest", "sourceClosureDigest", "finalityEvidenceDigest",
    "router", "finalizedCheckpoint", "releaseIdentityDigest",
  ], "Robinhood Indexer release identity");
  assert(identity.schemaVersion === INDEXER_RELEASE_IDENTITY_SCHEMA &&
    COMMIT.test(identity.sourceCommit) && COMMIT.test(identity.sourceTree) &&
    identity.deployment === `robinhood-production-${identity.sourceCommit.slice(0, 7)}` &&
    identity.eventCount === 3 && identity.chainId === Number(CHAIN_ID) &&
    identity.caip2 === CAIP2 && identity.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Robinhood Indexer release identity is invalid");
  for (const key of [
    "configSha256", "schemaSha256", "handlerSha256", "sourceRegistrySha256",
    "eventSetSha256",
  ]) exactHash32(identity[key], `Robinhood Indexer release identity ${key}`);
  for (const key of [
    "promotionBundleDigest", "sourceClosureDigest", "finalityEvidenceDigest",
  ]) exactSha256(identity[key], `Robinhood Indexer release identity ${key}`);
  exactHash32(identity.chainDeploymentDescriptorDigest,
    "Robinhood Indexer release identity chainDeploymentDescriptorDigest");
  const router = exactKeys(identity.router, ["address", "runtimeCodeHash", "startBlock"],
    "Robinhood Indexer release identity router");
  assert(sameAddress(router.address, ROOTS.programmableLaunchStampRouter.address) &&
    router.runtimeCodeHash === ROOTS.programmableLaunchStampRouter.runtimeCodeHash,
  "Robinhood Indexer release identity Router differs from the code-owned root");
  exactDecimal(router.startBlock, "Robinhood Indexer release identity router.startBlock", true);
  const checkpoint = exactKeys(identity.finalizedCheckpoint, ["blockNumber", "blockHash"],
    "Robinhood Indexer release identity finalizedCheckpoint");
  assert(checkpoint.blockNumber === router.startBlock,
    "Robinhood Indexer release identity checkpoint differs from its Router start block");
  exactHash32(checkpoint.blockHash,
    "Robinhood Indexer release identity finalizedCheckpoint.blockHash");
  const { releaseIdentityDigest, ...withoutDigest } = identity;
  assert(releaseIdentityDigest === canonicalSha256(INDEXER_RELEASE_IDENTITY_SCHEMA, withoutDigest),
    "Robinhood Indexer release identity digest is invalid");
  if (bundle) {
    const promotion = parsePromotionBundle(bundle);
    assert(identity.promotionBundleDigest === promotion.promotionBundleDigest &&
      identity.chainDeploymentDescriptorDigest === promotion.descriptorDigest &&
      identity.sourceClosureDigest === promotion.sourceClosure.sourceClosureDigest &&
      identity.finalityEvidenceDigest === promotion.finalizedBindings.finalityEvidenceDigest &&
      router.startBlock === promotion.startBlock &&
      checkpoint.blockNumber === promotion.finalizedCheckpoint.blockNumber &&
      checkpoint.blockHash === promotion.finalizedCheckpoint.blockHash,
    "Robinhood Indexer release identity differs from the finalized promotion bundle");
  }
  return identity;
}

export function parseIndexerDeploymentReceipt(value, { releaseIdentity } = {}) {
  const receipt = exactKeys(value, [
    "schemaVersion", "capturedAt", "provider", "deploymentId", "deploymentLabel",
    "endpointId", "graphqlEndpoint", "sourceCommit", "configSha256",
    "releaseIdentityDigest", "handoffDigest", "previousDeploymentEvidenceDigest",
    "status", "providerReceiptSha256", "receiptDigest",
  ], "Robinhood Indexer Envio deployment receipt");
  const provider = exactKeys(receipt.provider, ["platform", "owner", "project"],
    "Robinhood Indexer Envio provider");
  assert(receipt.schemaVersion === INDEXER_DEPLOYMENT_RECEIPT_SCHEMA &&
    provider.platform === "envio-cloud" && provider.owner === ENVIO_OWNER &&
    provider.project === ENVIO_PROJECT && typeof receipt.deploymentId === "string" &&
    receipt.deploymentId.length > 0 &&
    /^[a-z0-9][a-z0-9._-]{0,127}$/u.test(receipt.deploymentLabel) &&
    /^[a-z0-9]{6,64}$/u.test(receipt.endpointId) &&
    receipt.graphqlEndpoint ===
      `https://${ENVIO_HOST}/${receipt.endpointId}/v1/graphql` &&
    COMMIT.test(receipt.sourceCommit) && receipt.status === "ready-awaiting-release-audit",
  "Robinhood Indexer Envio deployment receipt is invalid");
  exactInstant(receipt.capturedAt, "Robinhood Indexer Envio receipt capturedAt");
  exactHash32(receipt.configSha256, "Robinhood Indexer Envio receipt configSha256");
  for (const key of [
    "releaseIdentityDigest", "handoffDigest", "previousDeploymentEvidenceDigest",
    "providerReceiptSha256",
  ]) exactSha256(receipt[key], `Robinhood Indexer Envio receipt ${key}`);
  const { receiptDigest, ...withoutDigest } = receipt;
  assert(receiptDigest === canonicalSha256(INDEXER_DEPLOYMENT_RECEIPT_SCHEMA, withoutDigest),
    "Robinhood Indexer Envio deployment receipt digest is invalid");
  if (releaseIdentity) {
    const identity = parseIndexerReleaseIdentity(releaseIdentity);
    assert(receipt.releaseIdentityDigest === identity.releaseIdentityDigest &&
      receipt.sourceCommit === identity.sourceCommit &&
      receipt.configSha256 === identity.configSha256 &&
      receipt.deploymentLabel === identity.deployment,
    "Robinhood Indexer Envio receipt differs from its release identity");
  }
  return receipt;
}

function parseIndexerAuditBackfill(value, identity) {
  const backfill = exactKeys(value, [
    "throughBlock", "throughBlockHash", "counts", "totalLogs", "backfillDigest",
  ], "Robinhood Indexer release audit backfill");
  exactDecimal(backfill.throughBlock,
    "Robinhood Indexer release audit backfill.throughBlock", true);
  assert(BigInt(backfill.throughBlock) >= BigInt(identity.router.startBlock),
    "Robinhood Indexer release audit backfill precedes Router deployment");
  exactHash32(backfill.throughBlockHash,
    "Robinhood Indexer release audit backfill.throughBlockHash");
  const counts = exactKeys(backfill.counts,
    ["RouterLaunch", "RouterRoute", "RouterComponent"],
    "Robinhood Indexer release audit backfill.counts");
  assert(Object.values(counts).every((count) => Number.isSafeInteger(count) && count >= 0) &&
    Number.isSafeInteger(backfill.totalLogs) && backfill.totalLogs >= 0 &&
    backfill.totalLogs === Object.values(counts).reduce((total, count) => total + count, 0),
  "Robinhood Indexer release audit backfill counts are invalid");
  exactSha256(backfill.backfillDigest,
    "Robinhood Indexer release audit backfill.backfillDigest");
  return backfill;
}

function parseIndexerProtectionSnapshot(value) {
  const snapshot = exactKeys(value, [
    "schemaVersion", "capturedAt", "repository", "repositoryId", "mechanism",
    "branch", "ref", "observedHead", "policy", "apiClosure", "snapshotDigest",
  ], "Robinhood Indexer owner-verified protection snapshot");
  const policy = exactKeys(snapshot.policy, [
    "strictRequiredStatusChecks", "requiredStatusChecks", "requiredCheckAppId",
    "requiredApprovingReviewCount", "dismissStaleReviews",
    "requiredConversationResolution", "requiredLinearHistory", "requiredSignatures",
    "enforceAdmins", "allowForcePushes", "allowDeletions", "pullRequestBypassAllowed",
  ], "Robinhood Indexer protected production policy");
  const apiClosure = exactKeys(snapshot.apiClosure, [
    "branchResponseSha256", "branchProtectionResponseSha256",
    "requiredSignaturesResponseSha256", "repositoryRulesetsResponseSha256",
  ], "Robinhood Indexer protected production API closure");
  assert(snapshot.schemaVersion === INDEXER_PROTECTION_SNAPSHOT_SCHEMA &&
    snapshot.repository === INDEXER_REPOSITORY &&
    snapshot.repositoryId === INDEXER_REPOSITORY_ID &&
    snapshot.mechanism === "legacy-branch-protection-no-rulesets" &&
    snapshot.branch === "production" && snapshot.ref === "refs/heads/production" &&
    COMMIT.test(snapshot.observedHead) && policy.strictRequiredStatusChecks === true &&
    canonicalEqual(policy.requiredStatusChecks, INDEXER_REQUIRED_CHECKS) &&
    policy.requiredCheckAppId === GITHUB_ACTIONS_APP_ID &&
    policy.requiredApprovingReviewCount === 1 && policy.dismissStaleReviews === true &&
    policy.requiredConversationResolution === true && policy.requiredLinearHistory === true &&
    policy.requiredSignatures === true && policy.enforceAdmins === true &&
    policy.allowForcePushes === false && policy.allowDeletions === false &&
    policy.pullRequestBypassAllowed === false,
  "Robinhood Indexer protected production proof has the wrong policy");
  exactInstant(snapshot.capturedAt,
    "Robinhood Indexer protection snapshot capturedAt");
  for (const [name, digest] of Object.entries(apiClosure)) {
    exactSha256(digest, `Robinhood Indexer protected production API closure ${name}`);
  }
  const { snapshotDigest, ...withoutDigest } = snapshot;
  assert(snapshotDigest === canonicalSha256(INDEXER_PROTECTION_SNAPSHOT_SCHEMA, withoutDigest),
    "Robinhood Indexer protection snapshot digest is invalid");
  return snapshot;
}

function parseIndexerProtectedRef(value) {
  const proof = exactKeys(value, [
    "schemaVersion", "branch", "ref", "sourceRevision", "workflowSha",
    "nativeRefProtected", "protectionSnapshot", "protectedRunDigest",
  ], "Robinhood Indexer native protected run proof");
  parseIndexerProtectionSnapshot(proof.protectionSnapshot);
  assert(proof.schemaVersion === INDEXER_PROTECTED_REF_SCHEMA &&
    proof.branch === "production" && proof.ref === "refs/heads/production" &&
    COMMIT.test(proof.sourceRevision) && proof.workflowSha === proof.sourceRevision &&
    proof.nativeRefProtected === true,
  "Robinhood Indexer native protected run proof is invalid");
  const { protectedRunDigest, ...withoutDigest } = proof;
  assert(protectedRunDigest === canonicalSha256(INDEXER_PROTECTED_REF_SCHEMA, withoutDigest),
    "Robinhood Indexer native protected run proof digest is invalid");
  return proof;
}

function parseIndexerEvidenceProducer(value) {
  const producer = exactKeys(value, [
    "repository", "repositoryId", "workflowRef", "runId", "runAttempt", "artifactName",
    "publishedAt", "sourceRevision", "sourceTree", "protectedRef",
  ], "Robinhood Indexer release audit producer");
  exactDecimal(producer.runId, "Robinhood Indexer release audit producer.runId", true);
  exactDecimal(producer.runAttempt,
    "Robinhood Indexer release audit producer.runAttempt", true);
  exactInstant(producer.publishedAt,
    "Robinhood Indexer release audit producer.publishedAt");
  const protectedRef = parseIndexerProtectedRef(producer.protectedRef);
  assert(producer.repository === INDEXER_REPOSITORY &&
    producer.repositoryId === INDEXER_REPOSITORY_ID &&
    producer.workflowRef === INDEXER_EVIDENCE_WORKFLOW_REF &&
    producer.artifactName ===
      `robinhood-indexer-release-evidence-${producer.runId}-${producer.runAttempt}` &&
    COMMIT.test(producer.sourceRevision) && COMMIT.test(producer.sourceTree) &&
    protectedRef.sourceRevision === producer.sourceRevision,
  "Robinhood Indexer release audit lacks protected producer provenance");
  return producer;
}

function parseIndexerPublishedReleaseIdentity(value, { bundle } = {}) {
  const envelope = exactKeys(value, [
    "schemaVersion", "evidence", "producer", "publicationDigest",
  ], "published Robinhood Indexer release identity");
  assert(envelope.schemaVersion === INDEXER_PUBLISHED_RELEASE_IDENTITY_SCHEMA,
    "published Robinhood Indexer release identity schema is invalid");
  const evidence = parseIndexerReleaseIdentity(envelope.evidence, { bundle });
  const producer = parseIndexerEvidenceProducer(envelope.producer);
  const { publicationDigest, ...withoutDigest } = envelope;
  assert(publicationDigest === canonicalSha256(
    INDEXER_PUBLISHED_RELEASE_IDENTITY_SCHEMA,
    withoutDigest,
  ), "published Robinhood Indexer release identity digest is invalid");
  return { envelope, evidence, producer };
}

function parseIndexerPublishedDeploymentReceipt(value, { releaseIdentity } = {}) {
  const envelope = exactKeys(value, [
    "schemaVersion", "evidence", "producer", "publicationDigest",
  ], "published Robinhood Indexer Envio deployment receipt");
  assert(envelope.schemaVersion === INDEXER_PUBLISHED_DEPLOYMENT_RECEIPT_SCHEMA,
    "published Robinhood Indexer Envio receipt schema is invalid");
  const evidence = parseIndexerDeploymentReceipt(envelope.evidence, { releaseIdentity });
  const producer = parseIndexerEvidenceProducer(envelope.producer);
  const { publicationDigest, ...withoutDigest } = envelope;
  assert(publicationDigest === canonicalSha256(
    INDEXER_PUBLISHED_DEPLOYMENT_RECEIPT_SCHEMA,
    withoutDigest,
  ), "published Robinhood Indexer Envio receipt digest is invalid");
  return { envelope, evidence, producer };
}

export function parseIndexerReleaseAudit(value, { releaseIdentity, deploymentReceipt } = {}) {
  const publishedIdentity = parseIndexerPublishedReleaseIdentity(releaseIdentity);
  const identity = publishedIdentity.evidence;
  const publishedReceipt = parseIndexerPublishedDeploymentReceipt(deploymentReceipt, {
    releaseIdentity: identity,
  });
  const receipt = publishedReceipt.evidence;
  const audit = exactKeys(value, [
    "schemaVersion", "status", "publicAuthorization", "producer", "closureDigest", "capturedAt",
    "evidenceWindow", "chainId", "caip2", "releaseIdentityDigest", "handoffDigest",
    "deploymentReceiptDigest", "snapshotDigest", "rpcEvidenceDigests", "reconciliationDigest",
    "backfill", "promotionAuthority", "auditDigest",
  ], "Robinhood Indexer release audit");
  assert(audit.schemaVersion === INDEXER_RELEASE_AUDIT_SCHEMA &&
    audit.status === "verified-ready-for-explicit-promotion" &&
    audit.publicAuthorization === false && audit.chainId === Number(CHAIN_ID) &&
    audit.caip2 === CAIP2 && audit.promotionAuthority === "explicit-product-owner" &&
    audit.releaseIdentityDigest === identity.releaseIdentityDigest &&
    audit.handoffDigest === receipt.handoffDigest &&
    audit.deploymentReceiptDigest === receipt.receiptDigest,
  "Robinhood Indexer release audit is invalid or grants public authority");
  exactSha256(audit.closureDigest, "Robinhood Indexer release audit closureDigest");
  exactInstant(audit.capturedAt, "Robinhood Indexer release audit capturedAt");
  const evidenceWindow = exactKeys(audit.evidenceWindow, [
    "previousDeploymentCapturedAt", "providerDeploymentCapturedAt", "primaryRpcCapturedAt",
    "secondaryRpcCapturedAt", "indexerCapturedAt", "observationWindowMilliseconds",
    "auditDelayMilliseconds",
  ], "Robinhood Indexer release audit evidence window");
  for (const [name, instant] of Object.entries(evidenceWindow)
    .filter(([name]) => name.endsWith("CapturedAt"))) {
    exactInstant(instant, `Robinhood Indexer release audit evidence window ${name}`);
  }
  const observationTimes = [
    evidenceWindow.primaryRpcCapturedAt,
    evidenceWindow.secondaryRpcCapturedAt,
    evidenceWindow.indexerCapturedAt,
  ].map((instant) => Date.parse(instant));
  const observationStart = Math.min(...observationTimes);
  const observationEnd = Math.max(...observationTimes);
  assert(evidenceWindow.providerDeploymentCapturedAt === receipt.capturedAt &&
    Date.parse(evidenceWindow.previousDeploymentCapturedAt) <=
      Date.parse(evidenceWindow.providerDeploymentCapturedAt) &&
    Date.parse(audit.capturedAt) - Date.parse(evidenceWindow.previousDeploymentCapturedAt) <=
      MAX_INDEXER_ROLLBACK_EVIDENCE_AGE_MILLISECONDS &&
    Date.parse(evidenceWindow.providerDeploymentCapturedAt) <= observationStart &&
    Math.abs(Date.parse(evidenceWindow.primaryRpcCapturedAt) -
      Date.parse(evidenceWindow.secondaryRpcCapturedAt)) <=
      MAX_INDEXER_RPC_CAPTURE_SKEW_MILLISECONDS &&
    Number.isSafeInteger(evidenceWindow.observationWindowMilliseconds) &&
    evidenceWindow.observationWindowMilliseconds === observationEnd - observationStart &&
    evidenceWindow.observationWindowMilliseconds <=
      MAX_INDEXER_OBSERVATION_WINDOW_MILLISECONDS &&
    Number.isSafeInteger(evidenceWindow.auditDelayMilliseconds) &&
    evidenceWindow.auditDelayMilliseconds === Date.parse(audit.capturedAt) - observationEnd &&
    evidenceWindow.auditDelayMilliseconds >= 0 &&
    evidenceWindow.auditDelayMilliseconds <= MAX_INDEXER_AUDIT_DELAY_MILLISECONDS,
  "Robinhood Indexer release audit evidence window is invalid");
  for (const key of ["snapshotDigest", "reconciliationDigest"]) {
    exactSha256(audit[key], `Robinhood Indexer release audit ${key}`);
  }
  assert(Array.isArray(audit.rpcEvidenceDigests) && audit.rpcEvidenceDigests.length === 2,
    "Robinhood Indexer release audit requires exactly two RPC evidence digests");
  for (const [index, digest] of audit.rpcEvidenceDigests.entries()) {
    exactSha256(digest, `Robinhood Indexer release audit rpcEvidenceDigests[${index}]`);
  }
  assert(audit.rpcEvidenceDigests[0] !== audit.rpcEvidenceDigests[1],
    "Robinhood Indexer release audit RPC evidence digests must be independent");
  parseIndexerAuditBackfill(audit.backfill, identity);
  const producer = parseIndexerEvidenceProducer(audit.producer);
  const publicationDelay = Date.parse(producer.publishedAt) - Date.parse(audit.capturedAt);
  const protectionSnapshotAge = Date.parse(producer.publishedAt) -
    Date.parse(producer.protectedRef.protectionSnapshot.capturedAt);
  assert(publicationDelay >= 0 &&
    publicationDelay <= MAX_INDEXER_PROTECTED_PUBLICATION_DELAY_MILLISECONDS &&
    protectionSnapshotAge >= 0 &&
    protectionSnapshotAge <= MAX_INDEXER_OWNER_PROTECTION_SNAPSHOT_AGE_MILLISECONDS,
  "Robinhood Indexer release audit is stale at protected publication");
  assert(canonicalEqual(producer, publishedIdentity.producer) &&
    canonicalEqual(producer, publishedReceipt.producer),
  "published Robinhood Indexer evidence files do not share exact producer provenance");
  const { auditDigest, ...withoutDigest } = audit;
  assert(auditDigest === canonicalSha256(INDEXER_RELEASE_AUDIT_SCHEMA, withoutDigest),
    "Robinhood Indexer release audit digest is invalid");
  return audit;
}

export function parseIndexerPromotionEvidence({
  releaseIdentity: releaseIdentityInput,
  deploymentReceipt: deploymentReceiptInput,
  releaseAudit: releaseAuditInput,
  bundle,
  artifacts,
}) {
  const promotion = parsePromotionBundle(bundle);
  const publishedIdentity = parseIndexerPublishedReleaseIdentity(releaseIdentityInput, { bundle });
  const releaseIdentity = publishedIdentity.evidence;
  const publishedReceipt = parseIndexerPublishedDeploymentReceipt(deploymentReceiptInput, {
    releaseIdentity,
  });
  const deploymentReceipt = publishedReceipt.evidence;
  const releaseAudit = parseIndexerReleaseAudit(releaseAuditInput, {
    releaseIdentity: releaseIdentityInput,
    deploymentReceipt: deploymentReceiptInput,
  });
  const artifactBindings = exactKeys(artifacts, [
    "releaseIdentity", "deploymentReceipt", "releaseAudit",
  ], "tracked Robinhood Indexer artifacts");
  for (const [name, expectedPath] of Object.entries({
    releaseIdentity: CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
    deploymentReceipt: CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
    releaseAudit: CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
  })) {
    const artifact = exactKeys(artifactBindings[name], ["path", "gitBlob", "sha256"],
      `tracked Robinhood Indexer artifact ${name}`);
    assert(artifact.path === expectedPath && /^[0-9a-f]{40}$/u.test(artifact.gitBlob),
      `tracked Robinhood Indexer artifact ${name} is not Git-bound`);
    exactSha256(artifact.sha256, `tracked Robinhood Indexer artifact ${name}.sha256`);
  }
  assert(artifactBindings.releaseIdentity.sha256 ===
    sha256Bytes(canonicalArtifactBytes(releaseIdentityInput)) &&
    artifactBindings.deploymentReceipt.sha256 ===
      sha256Bytes(canonicalArtifactBytes(deploymentReceiptInput)) &&
    artifactBindings.releaseAudit.sha256 ===
      sha256Bytes(canonicalArtifactBytes(releaseAuditInput)),
  "tracked Robinhood Indexer artifact bytes differ from their SHA-256 commitments");
  const value = {
    schemaVersion: INDEXER_PROMOTION_EVIDENCE_SCHEMA,
    state: "verified-awaiting-explicit-product-owner",
    publicAuthorization: false,
    repository: INDEXER_REPOSITORY,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    promotionBundleDigest: promotion.promotionBundleDigest,
    releaseIdentityPublicationDigest: publishedIdentity.envelope.publicationDigest,
    releaseIdentityDigest: releaseIdentity.releaseIdentityDigest,
    deploymentReceiptPublicationDigest: publishedReceipt.envelope.publicationDigest,
    deploymentReceiptDigest: deploymentReceipt.receiptDigest,
    auditDigest: releaseAudit.auditDigest,
    indexerSourceRevision: releaseIdentity.sourceCommit,
    indexerSourceTree: releaseIdentity.sourceTree,
    deploymentId: deploymentReceipt.deploymentId,
    producer: releaseAudit.producer,
    artifacts: artifactBindings,
  };
  return withDigest(INDEXER_PROMOTION_EVIDENCE_SCHEMA, value, "indexerEvidenceDigest");
}

export function parseIndexerPromotionEvidenceBinding(value) {
  const binding = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "repository", "chainId", "caip2",
    "chainDeploymentId", "promotionBundleDigest", "releaseIdentityPublicationDigest",
    "releaseIdentityDigest", "deploymentReceiptPublicationDigest", "deploymentReceiptDigest",
    "auditDigest", "indexerSourceRevision", "indexerSourceTree", "deploymentId", "producer",
    "artifacts", "indexerEvidenceDigest",
  ], "Robinhood Indexer promotion evidence binding");
  assert(binding.schemaVersion === INDEXER_PROMOTION_EVIDENCE_SCHEMA &&
    binding.state === "verified-awaiting-explicit-product-owner" &&
    binding.publicAuthorization === false && binding.repository === INDEXER_REPOSITORY &&
    binding.chainId === CHAIN_ID && binding.caip2 === CAIP2 &&
    binding.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    COMMIT.test(binding.indexerSourceRevision) && COMMIT.test(binding.indexerSourceTree) &&
    typeof binding.deploymentId === "string" && binding.deploymentId.length > 0,
  "Robinhood Indexer promotion evidence binding is invalid");
  parseIndexerEvidenceProducer(binding.producer);
  for (const key of [
    "promotionBundleDigest", "releaseIdentityPublicationDigest", "releaseIdentityDigest",
    "deploymentReceiptPublicationDigest", "deploymentReceiptDigest", "auditDigest",
  ]) exactSha256(binding[key], `Robinhood Indexer promotion evidence binding ${key}`);
  const artifacts = exactKeys(binding.artifacts, [
    "releaseIdentity", "deploymentReceipt", "releaseAudit",
  ], "Robinhood Indexer promotion evidence binding artifacts");
  for (const artifact of Object.values(artifacts)) {
    exactKeys(artifact, ["path", "gitBlob", "sha256"],
      "Robinhood Indexer promotion evidence binding artifact");
    assert(typeof artifact.path === "string" && /^[0-9a-f]{40}$/u.test(artifact.gitBlob),
      "Robinhood Indexer promotion evidence artifact Git identity is invalid");
    exactSha256(artifact.sha256, "Robinhood Indexer promotion evidence artifact sha256");
  }
  const { indexerEvidenceDigest, ...withoutDigest } = binding;
  assert(indexerEvidenceDigest ===
    canonicalSha256(INDEXER_PROMOTION_EVIDENCE_SCHEMA, withoutDigest),
  "Robinhood Indexer promotion evidence binding digest is invalid");
  return binding;
}

export function frozenEthereumV3Identity(manifest) {
  const profile = plainObject(manifest?.directNativeHookGraphProfileV3,
    "Ethereum V3 profile");
  const api = plainObject(profile.api, "Ethereum V3 API identity");
  const cli = plainObject(profile.cli, "Ethereum V3 CLI identity");
  const agent = plainObject(api.agentIntegration, "Ethereum V3 agent identity");
  const actual = {
    repository: manifest?.source?.repository ?? FROZEN_V3_IDENTITY.repository,
    packageName: cli.packageName,
    releaseVersion: cli.releaseVersion,
    minimumSupportingVersion: cli.minimumSupportingVersion,
    releaseUrl: cli.releaseUrl,
    tarballUrl: cli.tarballUrl,
    checksumUrl: cli.checksumUrl,
    tarballSha256: cli.tarballSha256,
    tarballByteLength: cli.tarballByteLength,
    openApiUrl: api.openApiUrl,
    openApiVersion: api.openApiVersion,
    openApiSha256: api.openApiSha256,
    packConfigSchemaUrl: agent.packConfigSchemaUrl,
    packConfigSchemaSha256: agent.packConfigSchemaSha256,
    commands: cli.commands,
  };
  assert(canonicalEqual(actual, FROZEN_V3_IDENTITY),
    "Ethereum V3 CLI 3.3.9 and programmablehq release identity changed");
  return Object.freeze({
    value: actual,
    digest: canonicalSha256("programmable.developers.ethereum-v3-release-identity.v1", actual),
  });
}

export function validatePlannedRobinhoodManifest(manifest) {
  assert(manifest?.chainId === 4663 && manifest?.caip2 === CAIP2,
    "Robinhood manifest has the wrong chain identity");
  const v4 = manifest.customLaunchV4;
  const router = manifest.launchStampRouter;
  const binding = manifest.robinhoodCustomLaunchBinding;
  assert(v4?.status === "planned" && v4.chainDeploymentDescriptorDigest === null &&
    v4.profile === null && v4.finalityPolicy === null,
  "planned Robinhood V4 metadata must remain null and non-live");
  assert(router?.status === "planned" && router.address === null && router.startBlock === null &&
    router.runtimeCodeHash === null && router.artifact === null &&
    router.deploymentEvidence === null && router.canaryEvidence === null,
  "planned Robinhood Router metadata must remain null and non-live");
  assert(binding?.state === "prepared-not-broadcast" &&
    binding.deployment?.transactionHash === null && binding.deployment?.blockNumber === null &&
    binding.deployment?.blockHash === null && binding.deployment?.startBlock === null &&
    binding.deployment?.finalizedBlockNumber === null &&
    binding.deployment?.finalizedBlockHash === null &&
    binding.deployment?.finalityEvidence === null &&
    binding.chainDeployment === null && binding.publication === null,
  "planned Robinhood chain binding contains live evidence");
  assert(Array.isArray(manifest.deployments) && manifest.deployments.length === 0,
    "planned Robinhood deployment inventory must remain empty");
  return manifest;
}

export function validateLiveRobinhoodManifest(manifest, promotion) {
  assert(manifest?.chainId === 4663 && manifest?.caip2 === CAIP2,
    "live Robinhood manifest has the wrong chain identity");
  const v4 = plainObject(manifest.customLaunchV4, "live Robinhood customLaunchV4");
  const router = plainObject(manifest.launchStampRouter, "live Robinhood launchStampRouter");
  const binding = plainObject(
    manifest.robinhoodCustomLaunchBinding, "live Robinhood chain binding",
  );
  assert(v4.status === "live" && router.status === "live" &&
    binding.state === "finalized-live",
  "Robinhood live state is not finalized across every public binding");
  assert(v4.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    v4.chainDeploymentDescriptorDigest === promotion.descriptorDigest &&
    canonicalEqual(v4.finalityPolicy, promotion.developers.finalityPolicy),
  "Robinhood V4 capability differs from the finalized promotion bundle");
  assert(canonicalEqual(binding.chainDeployment, promotion.descriptor),
    "Robinhood chain deployment differs from the finalized promotion bundle");
  assert(binding.deployment?.blockNumber === promotion.startBlock &&
    binding.deployment?.blockHash === promotion.finalizedCheckpoint.blockHash &&
    binding.deployment?.startBlock === promotion.startBlock,
  "Robinhood public deployment boundary differs from the finalized promotion bundle");
  assert(router.startBlock === promotion.startBlock &&
    sameAddress(router.address, ROOTS.programmableLaunchStampRouter.address) &&
    router.runtimeCodeHash === ROOTS.programmableLaunchStampRouter.runtimeCodeHash,
  "Robinhood public Router differs from the finalized promotion bundle");
  for (const [name, expected] of Object.entries(promotion.developers.roots)) {
    const root = binding.chainBindings?.[name];
    assert(root && sameAddress(root.address, expected.address) &&
      root.runtimeCodeHash === expected.runtimeCodeHash,
    `Robinhood public ${name} root differs from the finalized promotion bundle`);
  }
  assert(binding.chainBindings.permit2.provenance === "genesis-allocation" &&
    binding.chainBindings.permit2.startBlock === "0",
  "Permit2 is the only root allowed to use genesis block zero");
  for (const name of Object.keys(ROOTS).filter((rootName) => rootName !== "permit2")) {
    exactDecimal(binding.chainBindings[name].startBlock,
      `Robinhood public ${name} startBlock`, true);
  }
  assert(manifest.chains?.find(({ chainId }) => chainId === 4663)?.status === "live" &&
    manifest.extensions?.["programmable/read-model-v1"]?.status === "live",
  "Robinhood live manifest does not activate the chain profile and read model");
  return manifest;
}

function exactSource(value, label = "release source") {
  const source = exactKeys(value, ["repository", "revision", "tree"], label);
  assert(source.repository === "programmablehq/Developers" &&
    COMMIT.test(source.revision) && COMMIT.test(source.tree), `${label} is invalid`);
  return source;
}

function exactWorkflow(value, label = "release workflow") {
  const workflow = exactKeys(value, [
    "repository", "workflowRef", "runId", "runAttempt", "actor", "actorId",
  ], label);
  assert(workflow.repository === DEVELOPERS_REPOSITORY &&
    workflow.workflowRef === DEVELOPERS_RELEASE_WORKFLOW_REF &&
    RUN_ID.test(workflow.runId) && RUN_ID.test(workflow.runAttempt) &&
    workflow.actor === DEVELOPERS_CANONICAL_OWNER.login &&
    workflow.actorId === DEVELOPERS_CANONICAL_OWNER.id,
  `${label} is not the canonical owner-dispatched release workflow`);
  return workflow;
}

function exactRecoveryWorkflow(value, label = "release recovery workflow") {
  const workflow = exactKeys(value, [
    "repository", "workflowRef", "runId", "runAttempt", "actor", "actorId",
  ], label);
  assert(workflow.repository === DEVELOPERS_REPOSITORY &&
    workflow.workflowRef === DEVELOPERS_RECOVERY_WORKFLOW_REF &&
    RUN_ID.test(workflow.runId) && RUN_ID.test(workflow.runAttempt) &&
    workflow.actor === DEVELOPERS_CANONICAL_OWNER.login &&
    workflow.actorId === DEVELOPERS_CANONICAL_OWNER.id,
  `${label} is not the canonical owner-dispatched recovery workflow`);
  return workflow;
}

function exactOwnerWorkflow(value, label = "owner-dispatched workflow") {
  if (value?.workflowRef === DEVELOPERS_RECOVERY_WORKFLOW_REF) {
    return exactRecoveryWorkflow(value, label);
  }
  return exactWorkflow(value, label);
}

export function validateGitHubRunEvidence(value, expected) {
  const run = plainObject(value, "GitHub stage workflow run");
  const repository = plainObject(run.repository, "GitHub stage workflow repository");
  const actor = plainObject(run.actor, "GitHub stage workflow actor");
  const triggeringActor = plainObject(run.triggering_actor,
    "GitHub stage workflow triggering actor");
  const headCommit = plainObject(run.head_commit, "GitHub stage workflow head commit");
  const producer = [
    {
      workflowRef: DEVELOPERS_RELEASE_WORKFLOW_REF,
      path: DEVELOPERS_RELEASE_WORKFLOW_PATH,
      name: "Vercel release control",
    },
    {
      workflowRef: DEVELOPERS_RECOVERY_WORKFLOW_REF,
      path: DEVELOPERS_RECOVERY_WORKFLOW_PATH,
      name: "Vercel release recovery",
    },
  ].find(({ path: workflowPath, name }) => run.path === workflowPath && run.name === name);
  const allowedWorkflowRefs = expected.workflowRefs ?? [DEVELOPERS_RELEASE_WORKFLOW_REF];
  assert(String(run.id) === expected.runId && String(run.run_attempt) === expected.runAttempt &&
    run.event === "workflow_dispatch" && run.status === "completed" &&
    run.conclusion === "success" &&
    (expected.sourceRevision === undefined || run.head_sha === expected.sourceRevision) &&
    run.head_branch === "main" && producer !== undefined &&
    allowedWorkflowRefs.includes(producer.workflowRef) &&
    repository.full_name === DEVELOPERS_REPOSITORY &&
    headCommit.id === run.head_sha && COMMIT.test(run.head_sha) &&
    COMMIT.test(headCommit.tree_id) &&
    actor.login === DEVELOPERS_CANONICAL_OWNER.login &&
    String(actor.id) === DEVELOPERS_CANONICAL_OWNER.id &&
    triggeringActor.login === DEVELOPERS_CANONICAL_OWNER.login &&
    String(triggeringActor.id) === DEVELOPERS_CANONICAL_OWNER.id &&
    typeof run.html_url === "string" &&
    run.html_url.startsWith(`https://github.com/${repository.full_name}/actions/runs/${run.id}`),
  "selected GitHub stage workflow run is not the exact successful protected release run");
  const evidence = {
    schemaVersion: GITHUB_RUN_EVIDENCE_SCHEMA,
    state: "successful-protected-main-run",
    repository: repository.full_name,
    workflowRef: producer.workflowRef,
    runId: String(run.id),
    runAttempt: String(run.run_attempt),
    actor: actor.login,
    actorId: String(actor.id),
    sourceRevision: run.head_sha,
    sourceTree: headCommit.tree_id,
  };
  return withDigest(GITHUB_RUN_EVIDENCE_SCHEMA, evidence, "runEvidenceDigest");
}

export function parseGitHubRunEvidence(value) {
  const evidence = exactKeys(value, [
    "schemaVersion", "state", "repository", "workflowRef", "runId", "runAttempt",
    "actor", "actorId", "sourceRevision", "sourceTree", "runEvidenceDigest",
  ], "GitHub workflow run evidence");
  assert(evidence.schemaVersion === GITHUB_RUN_EVIDENCE_SCHEMA &&
    evidence.state === "successful-protected-main-run" &&
    evidence.repository === DEVELOPERS_REPOSITORY &&
    [DEVELOPERS_RELEASE_WORKFLOW_REF, DEVELOPERS_RECOVERY_WORKFLOW_REF]
      .includes(evidence.workflowRef) &&
    RUN_ID.test(evidence.runId) && RUN_ID.test(evidence.runAttempt) &&
    typeof evidence.actor === "string" && evidence.actor.length > 0 &&
    RUN_ID.test(evidence.actorId) && COMMIT.test(evidence.sourceRevision) &&
    COMMIT.test(evidence.sourceTree),
  "GitHub workflow run evidence is invalid");
  exactOwnerWorkflow({
    repository: evidence.repository,
    workflowRef: evidence.workflowRef,
    runId: evidence.runId,
    runAttempt: evidence.runAttempt,
    actor: evidence.actor,
    actorId: evidence.actorId,
  }, "GitHub workflow run evidence workflow");
  const { runEvidenceDigest, ...withoutDigest } = evidence;
  assert(runEvidenceDigest === canonicalSha256(GITHUB_RUN_EVIDENCE_SCHEMA, withoutDigest),
    "GitHub workflow run evidence digest is invalid");
  return evidence;
}

export function validateGitHubArtifactEvidence(value, expected) {
  const listing = plainObject(value, "GitHub Actions artifact listing");
  assert(Array.isArray(listing.artifacts), "GitHub Actions artifact listing is invalid");
  const candidates = listing.artifacts.filter((artifact) => artifact?.name === expected.name);
  assert(candidates.length === 1, "selected GitHub Actions artifact is not unique");
  const artifact = plainObject(candidates[0], "selected GitHub Actions artifact");
  const workflowRun = plainObject(artifact.workflow_run,
    "selected GitHub Actions artifact workflow run");
  assert(Number.isSafeInteger(artifact.id) && artifact.id > 0 &&
    artifact.expired === false && Number.isSafeInteger(artifact.size_in_bytes) &&
    artifact.size_in_bytes > 0 && exactSha256(artifact.digest,
      "selected GitHub Actions artifact digest") &&
    String(workflowRun.id) === expected.runId &&
    workflowRun.head_sha === expected.sourceRevision &&
    workflowRun.head_branch === "main",
  "selected GitHub Actions artifact is not from the exact protected source run");
  const evidence = {
    schemaVersion: GITHUB_ARTIFACT_EVIDENCE_SCHEMA,
    state: "immutable-actions-artifact",
    repository: DEVELOPERS_REPOSITORY,
    runId: expected.runId,
    runAttempt: expected.runAttempt,
    artifactId: String(artifact.id),
    artifactName: artifact.name,
    artifactDigest: artifact.digest,
    artifactSizeBytes: String(artifact.size_in_bytes),
    sourceRevision: expected.sourceRevision,
  };
  return withDigest(GITHUB_ARTIFACT_EVIDENCE_SCHEMA, evidence, "artifactEvidenceDigest");
}

export function parseGitHubArtifactEvidence(value) {
  const evidence = exactKeys(value, [
    "schemaVersion", "state", "repository", "runId", "runAttempt", "artifactId",
    "artifactName", "artifactDigest", "artifactSizeBytes", "sourceRevision",
    "artifactEvidenceDigest",
  ], "GitHub Actions artifact evidence");
  assert(evidence.schemaVersion === GITHUB_ARTIFACT_EVIDENCE_SCHEMA &&
    evidence.state === "immutable-actions-artifact" &&
    evidence.repository === DEVELOPERS_REPOSITORY && RUN_ID.test(evidence.runId) &&
    RUN_ID.test(evidence.runAttempt) && RUN_ID.test(evidence.artifactId) &&
    typeof evidence.artifactName === "string" && evidence.artifactName.length > 0 &&
    DECIMAL.test(evidence.artifactSizeBytes) && evidence.artifactSizeBytes !== "0" &&
    COMMIT.test(evidence.sourceRevision),
  "GitHub Actions artifact evidence is invalid");
  exactSha256(evidence.artifactDigest, "GitHub Actions artifact digest");
  const { artifactEvidenceDigest, ...withoutDigest } = evidence;
  assert(artifactEvidenceDigest ===
    canonicalSha256(GITHUB_ARTIFACT_EVIDENCE_SCHEMA, withoutDigest),
  "GitHub Actions artifact evidence digest is invalid");
  return evidence;
}

const INTERRUPTED_RELEASE_CONCLUSIONS = Object.freeze([
  "failure", "cancelled", "timed_out",
]);

export function validatePublicMutationIntentProvenance(value, expected) {
  const provider = exactKeys(value, ["workflowRun", "artifacts"],
    "public mutation intent provider provenance");
  const run = plainObject(provider.workflowRun,
    "public mutation intent workflow run");
  const repository = plainObject(run.repository,
    "public mutation intent workflow repository");
  const actor = plainObject(run.actor, "public mutation intent workflow actor");
  const triggeringActor = plainObject(run.triggering_actor,
    "public mutation intent triggering actor");
  const headCommit = plainObject(run.head_commit,
    "public mutation intent workflow head commit");
  assert(RUN_ID.test(expected.runId) && RUN_ID.test(expected.runAttempt),
    "public mutation intent expected run identity is invalid");
  const workflow = exactWorkflow({
    repository: DEVELOPERS_REPOSITORY,
    workflowRef: DEVELOPERS_RELEASE_WORKFLOW_REF,
    runId: expected.runId,
    runAttempt: expected.runAttempt,
    actor: DEVELOPERS_CANONICAL_OWNER.login,
    actorId: DEVELOPERS_CANONICAL_OWNER.id,
  }, "public mutation intent producer workflow");
  assert(String(run.id) === workflow.runId &&
    String(run.run_attempt) === workflow.runAttempt &&
    run.event === "workflow_dispatch" && run.status === "completed" &&
    INTERRUPTED_RELEASE_CONCLUSIONS.includes(run.conclusion) &&
    run.head_branch === "main" && run.path === DEVELOPERS_RELEASE_WORKFLOW_PATH &&
    run.name === "Vercel release control" &&
    repository.full_name === DEVELOPERS_REPOSITORY &&
    headCommit.id === run.head_sha && COMMIT.test(run.head_sha) &&
    COMMIT.test(headCommit.tree_id) &&
    actor.login === DEVELOPERS_CANONICAL_OWNER.login &&
    String(actor.id) === DEVELOPERS_CANONICAL_OWNER.id &&
    triggeringActor.login === DEVELOPERS_CANONICAL_OWNER.login &&
    String(triggeringActor.id) === DEVELOPERS_CANONICAL_OWNER.id &&
    typeof run.html_url === "string" &&
    run.html_url.startsWith(
      `https://github.com/${DEVELOPERS_REPOSITORY}/actions/runs/${workflow.runId}`,
    ), "public mutation intent is not from an interrupted canonical release run");
  exactSecondInstant(run.created_at, "public mutation intent run created_at");
  exactSecondInstant(run.run_started_at, "public mutation intent run run_started_at");
  exactSecondInstant(run.updated_at, "public mutation intent run updated_at");
  const artifactName =
    `developers-vercel-mutation-intent-${workflow.runId}-${workflow.runAttempt}`;
  const artifact = validateGitHubArtifactEvidence(provider.artifacts, {
    name: artifactName,
    runId: workflow.runId,
    runAttempt: workflow.runAttempt,
    sourceRevision: run.head_sha,
  });
  const rawArtifacts = plainObject(provider.artifacts,
    "public mutation intent artifact listing").artifacts;
  const rawArtifact = rawArtifacts.find(({ id }) => String(id) === artifact.artifactId);
  exactSecondInstant(rawArtifact.created_at,
    "public mutation intent artifact created_at");
  exactSecondInstant(rawArtifact.updated_at,
    "public mutation intent artifact updated_at");
  exactSecondInstant(rawArtifact.expires_at,
    "public mutation intent artifact expires_at");
  assert(Date.parse(run.run_started_at) >= Date.parse(run.created_at) &&
    Date.parse(rawArtifact.created_at) >= Date.parse(run.run_started_at) &&
    Date.parse(rawArtifact.updated_at) >= Date.parse(rawArtifact.created_at) &&
    Date.parse(run.updated_at) >= Date.parse(rawArtifact.updated_at) &&
    Date.parse(rawArtifact.expires_at) > Date.parse(run.updated_at),
  "public mutation intent producer timestamps are invalid");
  const source = exactSource({
    repository: DEVELOPERS_REPOSITORY,
    revision: run.head_sha,
    tree: headCommit.tree_id,
  }, "public mutation intent producer source");
  const intent = parsePublicMutationIntent(expected.intent);
  const archiveBinding = verifyGitHubArtifactArchiveEntry(expected.artifactArchive, {
    artifactDigest: artifact.artifactDigest,
    entryPath: "public-mutation-intent.json",
    expectedBytes: canonicalArtifactBytes(intent),
  });
  assert(canonicalEqual(intent.source, source) &&
    canonicalEqual(intent.workflow, workflow) &&
    Date.parse(intent.createdAt) >= Date.parse(run.run_started_at) &&
    Date.parse(intent.createdAt) <= Date.parse(rawArtifact.created_at) + 999 &&
    Date.parse(intent.createdAt) <= Date.parse(run.updated_at) + 999,
  "public mutation intent differs from its authenticated producer");
  const normalized = {
    schemaVersion: PUBLIC_MUTATION_INTENT_PROVENANCE_SCHEMA,
    state: "interrupted-release-intent-artifact",
    source,
    workflow,
    conclusion: run.conclusion,
    artifact,
    ...archiveBinding,
    mutationIntentDigest: intent.mutationIntentDigest,
    runCreatedAt: run.created_at,
    runStartedAt: run.run_started_at,
    artifactCreatedAt: rawArtifact.created_at,
    artifactUpdatedAt: rawArtifact.updated_at,
    completedAt: run.updated_at,
    artifactExpiresAt: rawArtifact.expires_at,
  };
  return withDigest(PUBLIC_MUTATION_INTENT_PROVENANCE_SCHEMA, normalized,
    "intentProvenanceDigest");
}

export function parsePublicMutationIntentProvenance(value, { intent } = {}) {
  const provenance = exactKeys(value, [
    "schemaVersion", "state", "source", "workflow", "conclusion", "artifact",
    "artifactArchiveDigest", "artifactEntryPath", "artifactEntrySha256",
    "mutationIntentDigest",
    "runCreatedAt", "runStartedAt", "artifactCreatedAt", "artifactUpdatedAt",
    "completedAt", "artifactExpiresAt", "intentProvenanceDigest",
  ], "public mutation intent provenance");
  assert(provenance.schemaVersion === PUBLIC_MUTATION_INTENT_PROVENANCE_SCHEMA &&
    provenance.state === "interrupted-release-intent-artifact" &&
    INTERRUPTED_RELEASE_CONCLUSIONS.includes(provenance.conclusion),
  "public mutation intent provenance is invalid");
  const source = exactSource(provenance.source,
    "public mutation intent provenance source");
  const workflow = exactWorkflow(provenance.workflow,
    "public mutation intent provenance workflow");
  const artifact = parseGitHubArtifactEvidence(provenance.artifact);
  exactSha256(provenance.artifactArchiveDigest,
    "public mutation intent provenance artifactArchiveDigest");
  exactSha256(provenance.artifactEntrySha256,
    "public mutation intent provenance artifactEntrySha256");
  exactSha256(provenance.mutationIntentDigest,
    "public mutation intent provenance mutationIntentDigest");
  for (const key of [
    "runCreatedAt", "runStartedAt", "artifactCreatedAt", "artifactUpdatedAt",
    "completedAt", "artifactExpiresAt",
  ]) exactSecondInstant(provenance[key], `public mutation intent provenance ${key}`);
  assert(artifact.runId === workflow.runId &&
    artifact.runAttempt === workflow.runAttempt &&
    artifact.sourceRevision === source.revision &&
    provenance.artifactArchiveDigest === artifact.artifactDigest &&
    provenance.artifactEntryPath === "public-mutation-intent.json" &&
    artifact.artifactName ===
      `developers-vercel-mutation-intent-${workflow.runId}-${workflow.runAttempt}` &&
    Date.parse(provenance.runStartedAt) >= Date.parse(provenance.runCreatedAt) &&
    Date.parse(provenance.artifactCreatedAt) >= Date.parse(provenance.runStartedAt) &&
    Date.parse(provenance.artifactUpdatedAt) >= Date.parse(provenance.artifactCreatedAt) &&
    Date.parse(provenance.completedAt) >= Date.parse(provenance.artifactUpdatedAt) &&
    Date.parse(provenance.artifactExpiresAt) > Date.parse(provenance.completedAt),
  "public mutation intent provenance bindings are invalid");
  const { intentProvenanceDigest, ...withoutDigest } = provenance;
  assert(intentProvenanceDigest === canonicalSha256(
    PUBLIC_MUTATION_INTENT_PROVENANCE_SCHEMA, withoutDigest,
  ), "public mutation intent provenance digest is invalid");
  if (intent) {
    const parsedIntent = parsePublicMutationIntent(intent);
    assert(provenance.mutationIntentDigest === parsedIntent.mutationIntentDigest &&
      provenance.artifactEntrySha256 ===
        sha256Bytes(canonicalArtifactBytes(parsedIntent)) &&
      canonicalEqual(source, parsedIntent.source) &&
      canonicalEqual(workflow, parsedIntent.workflow) &&
      Date.parse(parsedIntent.createdAt) >= Date.parse(provenance.runStartedAt) &&
      Date.parse(parsedIntent.createdAt) <= Date.parse(provenance.artifactCreatedAt) + 999 &&
      Date.parse(parsedIntent.createdAt) <= Date.parse(provenance.completedAt) + 999,
    "public mutation intent differs from its authenticated producer provenance");
  }
  return provenance;
}

export function validateGitHubOwnerDispatchAuthorization(value, expected) {
  const provider = exactKeys(value, ["workflowRun", "environment"],
    "GitHub owner-dispatch provider readback");
  const run = plainObject(provider.workflowRun, "GitHub owner-dispatch workflow run");
  const repository = plainObject(run.repository,
    "GitHub owner-dispatch workflow repository");
  const actor = plainObject(run.actor, "GitHub owner-dispatch actor");
  const triggeringActor = plainObject(run.triggering_actor,
    "GitHub owner-dispatch triggering actor");
  const headCommit = plainObject(run.head_commit,
    "GitHub owner-dispatch head commit");
  const environment = plainObject(provider.environment,
    "GitHub production environment");
  const branchPolicy = plainObject(environment.deployment_branch_policy,
    "GitHub production environment branch policy");
  assert(Array.isArray(environment.protection_rules) &&
    environment.protection_rules.every((rule) => rule?.type !== "required_reviewers"),
  "GitHub production environment must not invent a second-party reviewer gate");
  const workflow = exactOwnerWorkflow(expected.workflow,
    "GitHub owner-dispatch authorization workflow");
  const recovery = workflow.workflowRef === DEVELOPERS_RECOVERY_WORKFLOW_REF;
  const expectedWorkflowPath = recovery
    ? DEVELOPERS_RECOVERY_WORKFLOW_PATH
    : DEVELOPERS_RELEASE_WORKFLOW_PATH;
  const expectedWorkflowName = recovery
    ? "Vercel release recovery"
    : "Vercel release control";
  const source = exactSource(expected.source,
    "GitHub owner-dispatch authorization source");
  exactInstant(expected.observedAt, "GitHub owner-dispatch observedAt");
  assert(String(run.id) === workflow.runId &&
    String(run.run_attempt) === workflow.runAttempt &&
    run.event === "workflow_dispatch" && run.status === "in_progress" &&
    run.conclusion === null && run.head_sha === source.revision &&
    run.head_branch === "main" && run.path === expectedWorkflowPath &&
    run.name === expectedWorkflowName &&
    repository.full_name === DEVELOPERS_REPOSITORY &&
    headCommit.id === source.revision && headCommit.tree_id === source.tree &&
    actor.login === DEVELOPERS_CANONICAL_OWNER.login &&
    String(actor.id) === DEVELOPERS_CANONICAL_OWNER.id &&
    triggeringActor.login === DEVELOPERS_CANONICAL_OWNER.login &&
    String(triggeringActor.id) === DEVELOPERS_CANONICAL_OWNER.id &&
    workflow.actor === actor.login && workflow.actorId === String(actor.id),
  "GitHub authorization is not the current canonical owner workflow_dispatch run");
  assert(String(environment.id) === DEVELOPERS_PRODUCTION_ENVIRONMENT_ID &&
    environment.name === DEVELOPERS_PRODUCTION_ENVIRONMENT &&
    environment.can_admins_bypass === false &&
    branchPolicy.protected_branches === true &&
    branchPolicy.custom_branch_policies === false,
  "GitHub production environment is not protected-main-only with admin bypass disabled");
  exactSecondInstant(environment.created_at, "GitHub production environment created_at");
  exactSecondInstant(environment.updated_at, "GitHub production environment updated_at");
  exactSecondInstant(run.created_at, "GitHub owner-dispatch run created_at");
  exactSecondInstant(run.run_started_at, "GitHub owner-dispatch run_started_at");
  assert(Date.parse(environment.updated_at) >= Date.parse(environment.created_at) &&
    Date.parse(run.run_started_at) >= Date.parse(run.created_at) &&
    Date.parse(expected.observedAt) >= Date.parse(run.run_started_at),
  "GitHub owner-dispatch provider timestamps are invalid");
  const evidence = {
    schemaVersion: GITHUB_OWNER_DISPATCH_AUTHORIZATION_SCHEMA,
    state: "canonical-owner-dispatched",
    environment: {
      id: String(environment.id),
      name: environment.name,
      createdAt: environment.created_at,
      updatedAt: environment.updated_at,
      protectedBranchesOnly: true,
      canAdminsBypass: false,
    },
    owner: { login: actor.login, id: String(actor.id) },
    workflowRun: {
      repository: workflow.repository,
      workflowRef: workflow.workflowRef,
      runId: workflow.runId,
      runAttempt: workflow.runAttempt,
      sourceRevision: source.revision,
      sourceTree: source.tree,
      event: "workflow_dispatch",
    },
    observedAt: expected.observedAt,
  };
  return withDigest(GITHUB_OWNER_DISPATCH_AUTHORIZATION_SCHEMA, evidence,
    "ownerDispatchAuthorizationDigest");
}

export function parseGitHubOwnerDispatchAuthorization(value, { workflow, source } = {}) {
  const evidence = exactKeys(value, [
    "schemaVersion", "state", "environment", "owner", "workflowRun", "observedAt",
    "ownerDispatchAuthorizationDigest",
  ], "GitHub owner-dispatch authorization evidence");
  assert(evidence.schemaVersion === GITHUB_OWNER_DISPATCH_AUTHORIZATION_SCHEMA &&
    evidence.state === "canonical-owner-dispatched",
  "GitHub owner-dispatch authorization evidence is invalid");
  const environment = exactKeys(evidence.environment, [
    "id", "name", "createdAt", "updatedAt", "protectedBranchesOnly", "canAdminsBypass",
  ], "authorized GitHub production environment");
  const owner = exactKeys(evidence.owner, ["login", "id"],
    "GitHub owner-dispatch owner");
  const workflowRun = exactKeys(evidence.workflowRun, [
    "repository", "workflowRef", "runId", "runAttempt", "sourceRevision", "sourceTree",
    "event",
  ], "GitHub owner-dispatch run");
  assert(environment.id === DEVELOPERS_PRODUCTION_ENVIRONMENT_ID &&
    environment.name === DEVELOPERS_PRODUCTION_ENVIRONMENT &&
    environment.protectedBranchesOnly === true && environment.canAdminsBypass === false &&
    owner.login === DEVELOPERS_CANONICAL_OWNER.login &&
    owner.id === DEVELOPERS_CANONICAL_OWNER.id &&
    workflowRun.repository === DEVELOPERS_REPOSITORY &&
    [DEVELOPERS_RELEASE_WORKFLOW_REF, DEVELOPERS_RECOVERY_WORKFLOW_REF]
      .includes(workflowRun.workflowRef) &&
    RUN_ID.test(workflowRun.runId) && RUN_ID.test(workflowRun.runAttempt) &&
    COMMIT.test(workflowRun.sourceRevision) && COMMIT.test(workflowRun.sourceTree) &&
    workflowRun.event === "workflow_dispatch",
  "GitHub owner-dispatch authorization evidence is invalid");
  exactSecondInstant(environment.createdAt, "authorized GitHub environment createdAt");
  exactSecondInstant(environment.updatedAt, "authorized GitHub environment updatedAt");
  exactInstant(evidence.observedAt, "GitHub owner-dispatch observedAt");
  assert(Date.parse(environment.updatedAt) >= Date.parse(environment.createdAt),
    "GitHub owner-dispatch environment timestamps disagree");
  if (workflow) {
    const parsed = exactOwnerWorkflow(workflow, "authorized workflow");
    assert(workflowRun.repository === parsed.repository &&
      workflowRun.workflowRef === parsed.workflowRef &&
      workflowRun.runId === parsed.runId && workflowRun.runAttempt === parsed.runAttempt &&
      owner.login === parsed.actor && owner.id === parsed.actorId,
    "GitHub owner-dispatch authorization is for a different workflow or actor");
  }
  if (source) {
    const parsed = exactSource(source, "authorized owner-dispatch source");
    assert(workflowRun.sourceRevision === parsed.revision &&
      workflowRun.sourceTree === parsed.tree,
    "GitHub owner-dispatch authorization is for a different source");
  }
  const { ownerDispatchAuthorizationDigest, ...withoutDigest } = evidence;
  assert(ownerDispatchAuthorizationDigest ===
    canonicalSha256(GITHUB_OWNER_DISPATCH_AUTHORIZATION_SCHEMA, withoutDigest),
  "GitHub owner-dispatch authorization digest is invalid");
  return evidence;
}

export function createPlannedDeployAuthorization(input) {
  const mutation = input.mutation;
  assert(["create-candidate", "promote-candidate"].includes(mutation),
    "planned deploy authorization mutation is invalid");
  const source = exactSource(input.source, "planned deploy authorization source");
  const target = exactTarget(input.target, "planned deploy authorization target");
  const workflow = exactWorkflow(input.workflow, "planned deploy authorization workflow");
  const currentDeployment = exactDeployment(input.currentDeployment,
    "planned deploy current public deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, {
      deployment: currentDeployment,
      target,
    },
  );
  const ownerDispatchAuthorization = parseGitHubOwnerDispatchAuthorization(
    input.ownerDispatchAuthorization, { workflow, source },
  );
  exactInstant(input.authorizedAt, "planned deploy authorization authorizedAt");
  assert(ownerDispatchAuthorization.observedAt === input.authorizedAt,
    "planned deploy authorization must use the freshly observed owner dispatch");
  assertFreshTransition(currentPublicResolution.checkedAt, input.authorizedAt,
    "planned deploy public-origin resolution");

  let candidateDeployment = null;
  let candidateProtectionEvidence = null;
  let candidateSmokeDigest = null;
  if (mutation === "create-candidate") {
    assert(input.candidateDeployment === undefined &&
      input.candidateProtectionEvidence === undefined && input.candidateSmoke === undefined,
    "candidate creation authorization must not claim a candidate that does not exist yet");
  } else {
    candidateDeployment = exactDeployment(input.candidateDeployment,
      "planned deploy authorized candidate");
    candidateProtectionEvidence = parseStageProtectionEvidence(
      input.candidateProtectionEvidence, { deployment: candidateDeployment },
    );
    assert(candidateProtectionEvidence.projectProtection.projectId === target.projectId,
      "planned deploy candidate protection evidence is for a different project");
    const candidateSmoke = parseSmokeReceipt(input.candidateSmoke, {
      expectedMode: "planned",
    });
    assert(candidateSmoke.origin === candidateDeployment.url,
      "planned deploy candidate smoke did not target the protected candidate");
    assertFreshTransition(candidateProtectionEvidence.checkedAt, candidateSmoke.checkedAt,
      "planned deploy candidate protection and authenticated smoke");
    assertFreshTransition(candidateSmoke.checkedAt, input.authorizedAt,
      "planned deploy candidate smoke and owner authorization");
    candidateSmokeDigest = candidateSmoke.smokeDigest;
  }

  const value = {
    schemaVersion: PLANNED_DEPLOY_AUTHORIZATION_SCHEMA,
    state: "owner-authorized-planned-deploy",
    mutation,
    publicAuthorization: false,
    publicWrites: false,
    source,
    target,
    currentDeployment,
    currentPublicResolution,
    candidateDeployment,
    candidateProtectionEvidence,
    candidateSmokeDigest,
    ownerDispatchAuthorization,
    workflow,
    authorizedAt: input.authorizedAt,
  };
  return withDigest(PLANNED_DEPLOY_AUTHORIZATION_SCHEMA, value,
    "authorizationDigest");
}

export function parsePlannedDeployAuthorization(value) {
  const authorization = exactKeys(value, [
    "schemaVersion", "state", "mutation", "publicAuthorization", "publicWrites",
    "source", "target", "currentDeployment", "currentPublicResolution",
    "candidateDeployment",
    "candidateProtectionEvidence", "candidateSmokeDigest", "ownerDispatchAuthorization",
    "workflow", "authorizedAt", "authorizationDigest",
  ], "planned Vercel deploy authorization");
  assert(authorization.schemaVersion === PLANNED_DEPLOY_AUTHORIZATION_SCHEMA &&
    authorization.state === "owner-authorized-planned-deploy" &&
    ["create-candidate", "promote-candidate"].includes(authorization.mutation) &&
    authorization.publicAuthorization === false && authorization.publicWrites === false,
  "planned Vercel deploy authorization is invalid");
  const source = exactSource(authorization.source,
    "planned Vercel deploy authorization source");
  const target = exactTarget(authorization.target,
    "planned Vercel deploy authorization target");
  const workflow = exactWorkflow(authorization.workflow,
    "planned Vercel deploy authorization workflow");
  const currentDeployment = exactDeployment(authorization.currentDeployment,
    "planned Vercel deploy current public deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    authorization.currentPublicResolution, {
      deployment: currentDeployment,
      target,
    },
  );
  const ownerDispatchAuthorization = parseGitHubOwnerDispatchAuthorization(
    authorization.ownerDispatchAuthorization, { workflow, source },
  );
  exactInstant(authorization.authorizedAt,
    "planned Vercel deploy authorization authorizedAt");
  assert(ownerDispatchAuthorization.observedAt === authorization.authorizedAt,
    "planned Vercel deploy authorization differs from its owner-dispatch observation");
  assertFreshTransition(currentPublicResolution.checkedAt, authorization.authorizedAt,
    "planned Vercel deploy public-origin resolution");

  if (authorization.mutation === "create-candidate") {
    assert(authorization.candidateDeployment === null &&
      authorization.candidateProtectionEvidence === null &&
      authorization.candidateSmokeDigest === null,
    "candidate creation authorization must not contain candidate evidence");
  } else {
    const candidate = exactDeployment(authorization.candidateDeployment,
      "planned Vercel deploy authorized candidate");
    const protection = parseStageProtectionEvidence(
      authorization.candidateProtectionEvidence, { deployment: candidate },
    );
    assert(protection.projectProtection.projectId === target.projectId,
      "planned Vercel deploy candidate protection evidence is for a different project");
    exactSha256(authorization.candidateSmokeDigest,
      "planned Vercel deploy candidateSmokeDigest");
  }
  const { authorizationDigest, ...withoutDigest } = authorization;
  assert(authorizationDigest === canonicalSha256(
    PLANNED_DEPLOY_AUTHORIZATION_SCHEMA, withoutDigest,
  ), "planned Vercel deploy authorization digest is invalid");
  return authorization;
}

function exactTarget(value, label = "Vercel release target") {
  const target = exactKeys(value, [
    "provider", "orgId", "projectId", "environment", "publicOrigin",
  ], label);
  assert(target.provider === "vercel" &&
    typeof target.orgId === "string" && target.orgId.length >= 3 &&
    typeof target.projectId === "string" && target.projectId.length >= 3 &&
    target.environment === "production" && target.publicOrigin === PRODUCTION_ORIGIN,
  `${label} is invalid`);
  return target;
}

export function createVercelPublicDeploymentResolution(input) {
  const deployment = exactDeployment(input.deployment,
    "Vercel public-origin resolved deployment");
  const target = exactTarget(input.target, "Vercel public-origin resolution target");
  assert(input.origin === PRODUCTION_ORIGIN,
    "Vercel public-origin resolution must select the canonical production origin");
  exactInstant(input.checkedAt, "Vercel public-origin resolution checkedAt");
  const value = {
    schemaVersion: VERCEL_PUBLIC_DEPLOYMENT_RESOLUTION_SCHEMA,
    state: "provider-resolved",
    provider: "vercel",
    origin: PRODUCTION_ORIGIN,
    deploymentId: deployment.id,
    deploymentUrl: deployment.url,
    orgId: target.orgId,
    projectId: target.projectId,
    checkedAt: input.checkedAt,
  };
  return withDigest(VERCEL_PUBLIC_DEPLOYMENT_RESOLUTION_SCHEMA, value,
    "resolutionDigest");
}

export function createVercelMutationControlEvidence(input) {
  const project = plainObject(input.project, "Vercel mutation-control project");
  const target = exactTarget(input.target, "Vercel mutation-control target");
  assert(project.id === target.projectId,
    "Vercel mutation-control evidence is for a different project");
  assert(project.rollingRelease === undefined || project.rollingRelease === null ||
    project.rollingRelease === false,
    "Vercel mutation control requires Rolling Releases to be disabled");
  let lastAliasRequest = null;
  if (project.lastAliasRequest !== undefined && project.lastAliasRequest !== null) {
    const raw = plainObject(project.lastAliasRequest,
      "Vercel mutation-control last alias request");
    assert(["pending", "in-progress", "succeeded", "failed", "skipped"]
      .includes(raw.jobStatus) &&
      Number.isSafeInteger(raw.requestedAt) && raw.requestedAt > 0 &&
      VERCEL_ID.test(raw.toDeploymentId) &&
      ["promote", "rollback"].includes(raw.type),
    "Vercel mutation-control alias request is invalid or unknown");
    lastAliasRequest = {
      jobStatus: raw.jobStatus,
      requestedAt: new Date(raw.requestedAt).toISOString(),
      toDeploymentId: raw.toDeploymentId,
      type: raw.type,
    };
  }
  exactInstant(input.checkedAt, "Vercel mutation-control checkedAt");
  assert(lastAliasRequest === null ||
    Date.parse(lastAliasRequest.requestedAt) <= Date.parse(input.checkedAt),
  "Vercel mutation-control alias request cannot be future-dated");
  return withDigest(VERCEL_MUTATION_CONTROL_SCHEMA, {
    schemaVersion: VERCEL_MUTATION_CONTROL_SCHEMA,
    state: "provider-mutation-control",
    provider: "vercel",
    projectId: target.projectId,
    rollingReleaseEnabled: false,
    lastAliasRequest,
    mutationAvailable: lastAliasRequest === null ||
      !["pending", "in-progress"].includes(lastAliasRequest.jobStatus),
    checkedAt: input.checkedAt,
  }, "mutationControlDigest");
}

export function parseVercelMutationControlEvidence(value, { target } = {}) {
  const evidence = exactKeys(value, [
    "schemaVersion", "state", "provider", "projectId", "rollingReleaseEnabled",
    "lastAliasRequest", "mutationAvailable", "checkedAt", "mutationControlDigest",
  ], "Vercel mutation-control evidence");
  assert(evidence.schemaVersion === VERCEL_MUTATION_CONTROL_SCHEMA &&
    evidence.state === "provider-mutation-control" && evidence.provider === "vercel" &&
    evidence.rollingReleaseEnabled === false,
  "Vercel mutation-control evidence is invalid");
  let available = true;
  if (evidence.lastAliasRequest !== null) {
    const request = exactKeys(evidence.lastAliasRequest, [
      "jobStatus", "requestedAt", "toDeploymentId", "type",
    ], "Vercel mutation-control last alias request");
    assert(["pending", "in-progress", "succeeded", "failed", "skipped"]
      .includes(request.jobStatus) && VERCEL_ID.test(request.toDeploymentId) &&
      ["promote", "rollback"].includes(request.type),
    "Vercel mutation-control alias request is invalid or unknown");
    exactInstant(request.requestedAt,
      "Vercel mutation-control alias request requestedAt");
    available = !["pending", "in-progress"].includes(request.jobStatus);
  }
  assert(evidence.mutationAvailable === available,
    "Vercel mutation-control availability differs from its alias request");
  exactInstant(evidence.checkedAt, "Vercel mutation-control checkedAt");
  assert(evidence.lastAliasRequest === null ||
    Date.parse(evidence.lastAliasRequest.requestedAt) <= Date.parse(evidence.checkedAt),
  "Vercel mutation-control alias request cannot be future-dated");
  if (target) assert(evidence.projectId === exactTarget(target).projectId,
    "Vercel mutation-control evidence differs from the protected project");
  const { mutationControlDigest, ...withoutDigest } = evidence;
  assert(mutationControlDigest === canonicalSha256(
    VERCEL_MUTATION_CONTROL_SCHEMA, withoutDigest,
  ), "Vercel mutation-control digest is invalid");
  return evidence;
}

function assertMutationControlResolutionConsistency(mutationControl, resolution) {
  const request = mutationControl.lastAliasRequest;
  if (request?.jobStatus !== "succeeded") return;
  assert(request.toDeploymentId === resolution.deploymentId,
    "successful Vercel alias request differs from the resolved public deployment");
}

export function parseVercelPublicDeploymentResolution(value, {
  deployment,
  target,
} = {}) {
  const resolution = exactKeys(value, [
    "schemaVersion", "state", "provider", "origin", "deploymentId", "deploymentUrl",
    "orgId", "projectId", "checkedAt", "resolutionDigest",
  ], "Vercel public-origin resolution");
  assert(resolution.schemaVersion === VERCEL_PUBLIC_DEPLOYMENT_RESOLUTION_SCHEMA &&
    resolution.state === "provider-resolved" && resolution.provider === "vercel" &&
    resolution.origin === PRODUCTION_ORIGIN && VERCEL_ID.test(resolution.deploymentId),
  "Vercel public-origin resolution is invalid");
  const parsedUrl = new URL(resolution.deploymentUrl);
  assert(parsedUrl.protocol === "https:" && parsedUrl.username === "" &&
    parsedUrl.password === "" && parsedUrl.pathname === "/" &&
    parsedUrl.search === "" && parsedUrl.hash === "" &&
    parsedUrl.hostname.endsWith(".vercel.app") &&
    resolution.deploymentUrl === parsedUrl.origin,
  "Vercel public-origin resolution deployment URL is invalid");
  exactInstant(resolution.checkedAt, "Vercel public-origin resolution checkedAt");
  const { resolutionDigest, ...withoutDigest } = resolution;
  assert(resolutionDigest === canonicalSha256(
    VERCEL_PUBLIC_DEPLOYMENT_RESOLUTION_SCHEMA, withoutDigest,
  ), "Vercel public-origin resolution digest is invalid");
  if (deployment) {
    const parsedDeployment = exactDeployment(deployment,
      "Vercel public-origin resolution deployment");
    assert(resolution.deploymentId === parsedDeployment.id &&
      resolution.deploymentUrl === parsedDeployment.url,
    "Vercel public-origin resolution selected a different deployment");
  }
  if (target) {
    const parsedTarget = exactTarget(target, "Vercel public-origin resolution target");
    assert(resolution.orgId === parsedTarget.orgId &&
      resolution.projectId === parsedTarget.projectId,
    "Vercel public-origin resolution selected a different protected project");
  }
  return resolution;
}

function exactDeployment(value, label) {
  const deployment = exactKeys(value, [
    "id", "url", "target", "readyState", "aliases", "createdAt",
  ], label);
  assert(VERCEL_ID.test(deployment.id) && deployment.target === "production" &&
    deployment.readyState === "READY" && Number.isSafeInteger(deployment.createdAt) &&
    deployment.createdAt > 0 && Array.isArray(deployment.aliases), `${label} is invalid`);
  const parsed = new URL(deployment.url);
  assert(parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" &&
    parsed.pathname === "/" && parsed.search === "" && parsed.hash === "" &&
    parsed.hostname.endsWith(".vercel.app") && deployment.url === parsed.origin,
  `${label}.url is not a canonical immutable Vercel origin`);
  const normalizedAliases = deployment.aliases.map((alias) => {
    assert(typeof alias === "string" && alias === alias.toLowerCase(),
      `${label}.aliases contains a non-canonical hostname`);
    const url = new URL(`https://${alias}`);
    assert(url.hostname === alias && url.pathname === "/" && url.search === "" &&
      url.hash === "", `${label}.aliases contains an invalid hostname`);
    return alias;
  });
  assert(canonicalEqual(normalizedAliases,
    [...new Set(normalizedAliases)].sort((left, right) => Buffer.compare(
      Buffer.from(left), Buffer.from(right),
    ))), `${label}.aliases must be sorted and unique`);
  // Vercel's deployment record exposes creation-time alias metadata. It is
  // useful as bounded descriptive data, but it is not routing authority: an
  // origin can be promoted after the deployment record was created without
  // that array becoming an authoritative current-origin lookup. Every release
  // transition therefore binds a fresh provider resolution of PRODUCTION_ORIGIN
  // instead of interpreting this array as public or non-public state.
  return deployment;
}

function sameImmutableDeployment(left, right) {
  return left.id === right.id && left.url === right.url && left.target === right.target &&
    left.readyState === right.readyState && left.createdAt === right.createdAt;
}

export function normalizeVercelDeployment({ deployOutput, inspectOutput, apiOutput }) {
  const deploy = deployOutput === undefined
    ? undefined
    : deployOutput?.deployment ?? deployOutput;
  const inspect = inspectOutput?.deployment ?? inspectOutput;
  const api = apiOutput?.deployment ?? apiOutput;
  const id = deploy?.id ?? inspect?.id ?? api?.id;
  const rawUrl = api?.url ?? inspect?.url ?? deploy?.url;
  const url = rawUrl?.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
  const aliases = [...new Set([
    ...(Array.isArray(api?.alias) ? api.alias : []),
    ...(Array.isArray(api?.aliases) ? api.aliases : []),
    ...(Array.isArray(inspect?.aliases) ? inspect.aliases : []),
  ].map((alias) => alias.replace(/^https:\/\//u, "").toLowerCase()))].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)));
  assert((deploy === undefined || deploy?.id === id) && inspect?.id === id && api?.id === id,
    "Vercel deployment outputs disagree on deployment id");
  assert((deploy?.readyState ?? inspect?.readyState) === "READY" &&
    inspect?.readyState === "READY" && api?.readyState === "READY",
  "Vercel deployment is not READY");
  const target = api?.target ?? inspect?.target ?? deploy?.target;
  const createdAt = api?.createdAt ?? inspect?.createdAt;
  return exactDeployment({ id, url, target, readyState: "READY", aliases, createdAt },
    "Vercel deployment");
}

export function createStageProtectionEvidence(input) {
  const deployment = exactDeployment(input.deployment,
    "Vercel protected staged deployment");
  const response = exactKeys(input.response,
    ["status", "location", "server", "vercelId"], "Vercel protection probe response");
  assert(Number.isSafeInteger(response.status) &&
    [302, 303, 307, 308].includes(response.status) &&
    typeof response.server === "string" && response.server.toLowerCase() === "vercel" &&
    typeof response.vercelId === "string" &&
    /^[A-Za-z0-9._:-]{1,200}$/u.test(response.vercelId),
  "Vercel generated deployment did not return its authentication redirect");
  const location = new URL(response.location);
  assert(location.protocol === "https:" && location.hostname === "vercel.com" &&
    (location.pathname === "/login" || location.pathname === "/sso-api" ||
      location.pathname.startsWith("/sso-api/")),
  "Vercel protection redirect does not target the canonical Vercel authentication service");
  const normalizedResponse = {
    status: response.status,
    location: `${location.origin}${location.pathname}`,
    server: response.server,
    vercelId: response.vercelId,
  };
  const project = plainObject(input.projectProtection, "Vercel project protection response");
  // Vercel's versioned project response is additive. Normalize only the fields
  // that form this evidence instead of letting unrelated provider additions
  // make an otherwise identical protection state unverifiable.
  const sso = plainObject(project.ssoProtection, "Vercel Authentication protection");
  assert(project.id === input.projectId &&
    sso.deploymentType === "prod_deployment_urls_and_all_previews",
  "Vercel project must protect generated production URLs without protecting its public domain");
  assert(project.protectionBypass !== null && typeof project.protectionBypass === "object" &&
    Object.values(project.protectionBypass).some((entry) =>
      plainObject(entry, "Vercel protection bypass entry").scope === "automation-bypass"),
  "Vercel project lacks a dedicated automation protection bypass");
  exactInstant(input.checkedAt, "Vercel protection probe checkedAt");
  const value = {
    schemaVersion: VERCEL_STAGE_PROTECTION_SCHEMA,
    state: "provider-protected-generated-url",
    publicAccess: false,
    deploymentId: deployment.id,
    deploymentUrl: deployment.url,
    requestPath: "/api/v2/status?chainId=4663",
    projectProtection: {
      projectId: project.id,
      method: "vercel-authentication",
      deploymentType: sso.deploymentType,
      automationBypassConfigured: true,
    },
    response: normalizedResponse,
    checkedAt: input.checkedAt,
  };
  return withDigest(VERCEL_STAGE_PROTECTION_SCHEMA, value, "protectionEvidenceDigest");
}

export function parseStageProtectionEvidence(value, { deployment } = {}) {
  const evidence = exactKeys(value, [
    "schemaVersion", "state", "publicAccess", "deploymentId", "deploymentUrl",
    "requestPath", "projectProtection", "response", "checkedAt", "protectionEvidenceDigest",
  ], "Vercel stage protection evidence");
  assert(evidence.schemaVersion === VERCEL_STAGE_PROTECTION_SCHEMA &&
    evidence.state === "provider-protected-generated-url" && evidence.publicAccess === false &&
    evidence.requestPath === "/api/v2/status?chainId=4663",
  "Vercel stage protection evidence is not fail-closed");
  const response = exactKeys(evidence.response,
    ["status", "location", "server", "vercelId"], "Vercel protection evidence response");
  const projectProtection = exactKeys(evidence.projectProtection, [
    "projectId", "method", "deploymentType", "automationBypassConfigured",
  ], "Vercel stage project protection");
  assert(typeof projectProtection.projectId === "string" &&
    projectProtection.method === "vercel-authentication" &&
    projectProtection.deploymentType === "prod_deployment_urls_and_all_previews" &&
    projectProtection.automationBypassConfigured === true &&
    [302, 303, 307, 308].includes(response.status) &&
    typeof response.server === "string" && response.server.toLowerCase() === "vercel" &&
    typeof response.vercelId === "string" &&
    /^[A-Za-z0-9._:-]{1,200}$/u.test(response.vercelId),
  "Vercel stage protection evidence is incomplete");
  const location = new URL(response.location);
  assert(location.protocol === "https:" && location.hostname === "vercel.com" &&
    location.search === "" && location.hash === "" &&
    (location.pathname === "/login" || location.pathname === "/sso-api" ||
      location.pathname.startsWith("/sso-api/")),
  "Vercel stage protection evidence lacks the canonical authentication redirect");
  exactInstant(evidence.checkedAt, "Vercel stage protection checkedAt");
  if (deployment) {
    const parsed = exactDeployment(deployment,
      "Vercel stage protection deployment");
    assert(evidence.deploymentId === parsed.id && evidence.deploymentUrl === parsed.url,
      "Vercel stage protection evidence differs from the provider deployment");
  }
  const { protectionEvidenceDigest, ...withoutDigest } = evidence;
  assert(protectionEvidenceDigest ===
    canonicalSha256(VERCEL_STAGE_PROTECTION_SCHEMA, withoutDigest),
  "Vercel stage protection evidence digest is invalid");
  return evidence;
}

export function assertVercelDeploymentMetadata(apiOutput, expected) {
  const api = apiOutput?.deployment ?? apiOutput;
  const meta = plainObject(api?.meta, "Vercel deployment metadata");
  if (expected.releaseMode === "planned") {
    assert(meta.programmableSourceRevision === expected.source.revision &&
      meta.programmableSourceTree === expected.source.tree &&
      meta.programmableReleaseMode === "planned" &&
      !Object.hasOwn(meta, "programmableStageBundleDigest") &&
      !Object.hasOwn(meta, "programmablePromotionBundleDigest"),
    "Vercel planned deployment metadata differs from the checked-out source or selects a phase bundle");
    return;
  }
  assert(meta.programmableSourceRevision === expected.source.revision &&
    meta.programmableSourceTree === expected.source.tree &&
    meta.programmableStageBundleDigest === expected.stageBundleDigest,
  "Vercel deployment metadata differs from the checked-out source and Phase-A bundle");
  return meta;
}

export function assertVercelProjectBinding(apiOutput, linkOutput, expected) {
  const api = plainObject(apiOutput?.deployment ?? apiOutput, "Vercel deployment");
  const link = plainObject(linkOutput, "Vercel project link");
  // Vercel v13 returns team ownership as ownerId and team.id for some
  // team-scoped deployments while leaving teamId null. Every identity the
  // provider does return must agree so contradictory metadata fails closed.
  const deploymentOrgIds = [api.teamId, api.ownerId, api.team?.id]
    .filter((value) => value !== null && value !== undefined);
  const deploymentProjectIds = [api.projectId, api.project?.id]
    .filter((value) => value !== null && value !== undefined);
  assert(link.orgId === expected.orgId && link.projectId === expected.projectId &&
    deploymentOrgIds.length > 0 && deploymentOrgIds.every((id) => id === expected.orgId) &&
    deploymentProjectIds.length > 0 &&
    deploymentProjectIds.every((id) => id === expected.projectId),
  "Vercel deployment is not bound to the protected project and organization");
  return exactTarget({
    provider: "vercel",
    orgId: expected.orgId,
    projectId: expected.projectId,
    environment: "production",
    publicOrigin: PRODUCTION_ORIGIN,
  });
}

async function treeEntries(root, relative = "") {
  const current = path.join(root, relative);
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
  const output = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.split(path.sep).join(path.posix.sep), entry.name);
    const absolute = path.join(root, ...child.split("/"));
    const metadata = await lstat(absolute);
    assert(!metadata.isSymbolicLink(), `build output contains symlink ${child}`);
    if (metadata.isDirectory()) {
      output.push(...await treeEntries(root, child));
    } else {
      assert(metadata.isFile(), `build output contains non-file ${child}`);
      const bytes = await readFile(absolute);
      output.push({ path: child, byteLength: String(bytes.byteLength), sha256: sha256Bytes(bytes) });
    }
  }
  return output;
}

export async function hashBuildOutput(root) {
  const entries = await treeEntries(path.resolve(root));
  assert(entries.length > 0, "Vercel build output is empty");
  return Object.freeze({
    entries,
    digest: canonicalSha256("programmable.developers.vercel-build-output.v1", entries),
  });
}

export function createEvidenceOnlySourceTransition(input) {
  const stagedSource = exactSource(input.stagedSource,
    "evidence-only transition staged source");
  const promotionSource = exactSource(input.promotionSource,
    "evidence-only transition promotion source");
  assert(stagedSource.revision !== promotionSource.revision &&
    stagedSource.tree !== promotionSource.tree,
  "evidence-only transition must move to a distinct reviewed commit and tree");
  assert(canonicalEqual(input.addedPaths, PROMOTION_EVIDENCE_PATHS),
    "evidence-only transition must add exactly the Phase-B bundle and three Indexer evidence files");
  exactSha256(input.buildOutputDigest, "evidence-only transition buildOutputDigest");
  const value = {
    schemaVersion: SOURCE_TRANSITION_SCHEMA,
    state: "reviewed-promotion-evidence-only",
    stagedSource,
    promotionSource,
    addedPaths: [...PROMOTION_EVIDENCE_PATHS],
    buildOutputDigest: input.buildOutputDigest,
  };
  return withDigest(SOURCE_TRANSITION_SCHEMA, value, "sourceTransitionDigest");
}

export function parseEvidenceOnlySourceTransition(value) {
  const transition = exactKeys(value, [
    "schemaVersion", "state", "stagedSource", "promotionSource", "addedPaths",
    "buildOutputDigest", "sourceTransitionDigest",
  ], "evidence-only release source transition");
  assert(transition.schemaVersion === SOURCE_TRANSITION_SCHEMA &&
    transition.state === "reviewed-promotion-evidence-only" &&
    canonicalEqual(transition.addedPaths, PROMOTION_EVIDENCE_PATHS),
  "release source transition is not limited to the Phase-B bundle and Indexer evidence files");
  const stagedSource = exactSource(transition.stagedSource,
    "release source transition staged source");
  const promotionSource = exactSource(transition.promotionSource,
    "release source transition promotion source");
  assert(stagedSource.revision !== promotionSource.revision &&
    stagedSource.tree !== promotionSource.tree,
  "release source transition did not move to a distinct reviewed commit and tree");
  exactSha256(transition.buildOutputDigest,
    "release source transition buildOutputDigest");
  const { sourceTransitionDigest, ...withoutDigest } = transition;
  assert(sourceTransitionDigest === canonicalSha256(SOURCE_TRANSITION_SCHEMA, withoutDigest),
    "release source transition digest is invalid");
  return transition;
}

function withDigest(schemaVersion, value, digestKey) {
  return Object.freeze({
    ...value,
    [digestKey]: canonicalSha256(schemaVersion, value),
  });
}

export function createStageReceipt(input) {
  const source = exactSource(input.source);
  const workflow = exactWorkflow(input.workflow);
  const target = exactTarget(input.target);
  const deployment = exactDeployment(input.deployment, "staged Vercel deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, { target },
  );
  assert(currentPublicResolution.deploymentId !== deployment.id &&
    currentPublicResolution.deploymentUrl !== deployment.url,
  "Vercel public origin already selects the staged deployment");
  const protectionEvidence = parseStageProtectionEvidence(input.protectionEvidence, {
    deployment,
  });
  assert(protectionEvidence.projectProtection.projectId === target.projectId,
    "Vercel stage protection evidence is for a different project");
  const stageBundle = parseStageBundle(input.bundle);
  const stagedSmoke = parseSmokeReceipt(input.stagedSmoke, {
    expectedMode: "live", expectedBundlePhase: "stage", bundle: input.bundle,
  });
  assert(stagedSmoke.origin === deployment.url,
    "stage receipt smoke did not target the protected staged deployment");
  validateLiveRobinhoodManifest(input.manifest, stageBundle);
  exactSha256(input.buildOutputDigest, "Vercel build output digest");
  exactInstant(input.stagedAt, "stage receipt stagedAt");
  assertFreshTransition(protectionEvidence.checkedAt, stagedSmoke.checkedAt,
    "Vercel dark-stage protection and smoke");
  assertFreshTransition(stagedSmoke.checkedAt, currentPublicResolution.checkedAt,
    "Vercel dark-stage public-origin resolution");
  assertFreshTransition(currentPublicResolution.checkedAt, input.stagedAt,
    "Vercel dark-stage receipt");
  const v3 = frozenEthereumV3Identity(input.ethereumManifest);
  const value = {
    schemaVersion: STAGE_RECEIPT_SCHEMA,
    state: "staged-not-public",
    publicAuthorization: false,
    publicWrites: false,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    stageBundleDigest: stageBundle.bundleDigest,
    chainDeploymentDescriptorDigest: stageBundle.descriptorDigest,
    source,
    target,
    buildOutputDigest: input.buildOutputDigest,
    manifestDigest: canonicalSha256(
      "programmable.developers.chain-4663-live-manifest.v1", input.manifest,
    ),
    ethereumV3IdentityDigest: v3.digest,
    deployment,
    currentPublicResolution,
    protectionEvidence,
    stagedSmokeDigest: stagedSmoke.smokeDigest,
    workflow,
    stagedAt: input.stagedAt,
  };
  return withDigest(STAGE_RECEIPT_SCHEMA, value, "stageReceiptDigest");
}

export function parseStageReceipt(value, {
  bundle, source, target, deployment, workflowRun, stagedSmoke,
} = {}) {
  const receipt = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "stageBundleDigest", "chainDeploymentDescriptorDigest", "source",
    "target", "buildOutputDigest", "manifestDigest", "ethereumV3IdentityDigest", "deployment",
    "currentPublicResolution", "protectionEvidence", "stagedSmokeDigest", "workflow",
    "stagedAt", "stageReceiptDigest",
  ], "Vercel stage receipt");
  assert(receipt.schemaVersion === STAGE_RECEIPT_SCHEMA &&
    receipt.state === "staged-not-public" && receipt.publicAuthorization === false &&
    receipt.publicWrites === false && receipt.chainId === CHAIN_ID && receipt.caip2 === CAIP2 &&
    receipt.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Vercel stage receipt does not remain non-public");
  exactSource(receipt.source, "Vercel stage receipt source");
  exactTarget(receipt.target, "Vercel stage receipt target");
  exactDeployment(receipt.deployment, "Vercel stage receipt deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    receipt.currentPublicResolution, { target: receipt.target },
  );
  assert(currentPublicResolution.deploymentId !== receipt.deployment.id &&
    currentPublicResolution.deploymentUrl !== receipt.deployment.url,
  "Vercel stage receipt public origin selects the staged deployment");
  const protectionEvidence = parseStageProtectionEvidence(
    receipt.protectionEvidence, { deployment: receipt.deployment },
  );
  exactSha256(receipt.stagedSmokeDigest, "Vercel stage receipt stagedSmokeDigest");
  exactSha256(receipt.stageBundleDigest, "Vercel stage receipt stageBundleDigest");
  exactSha256(receipt.buildOutputDigest, "Vercel stage receipt buildOutputDigest");
  exactSha256(receipt.manifestDigest, "Vercel stage receipt manifestDigest");
  exactSha256(receipt.ethereumV3IdentityDigest, "Vercel stage receipt ethereumV3IdentityDigest");
  exactWorkflow(receipt.workflow, "Vercel stage receipt workflow");
  exactInstant(receipt.stagedAt, "Vercel stage receipt stagedAt");
  assertFreshTransition(currentPublicResolution.checkedAt, receipt.stagedAt,
    "Vercel stage receipt public-origin resolution");
  const { stageReceiptDigest, ...withoutDigest } = receipt;
  assert(stageReceiptDigest === canonicalSha256(STAGE_RECEIPT_SCHEMA, withoutDigest),
    "Vercel stage receipt digest is invalid");
  if (bundle) {
    const stageBundle = parseStageBundle(bundle);
    assert(receipt.stageBundleDigest === stageBundle.bundleDigest &&
      receipt.chainDeploymentDescriptorDigest === stageBundle.descriptorDigest,
    "Vercel stage receipt differs from the non-authorizing Phase-A bundle");
  }
  if (source) assert(canonicalEqual(receipt.source, exactSource(source)),
    "Vercel stage receipt differs from the checked-out source");
  if (target) assert(canonicalEqual(receipt.target, exactTarget(target)),
    "Vercel stage receipt differs from the protected target");
  if (deployment) assert(canonicalEqual(receipt.deployment,
    exactDeployment(deployment, "provider-requeried staged Vercel deployment")),
  "Vercel stage receipt differs from the provider-requeried deployment");
  if (workflowRun) {
    const expected = exactKeys(workflowRun,
      ["repository", "workflowRef", "runId", "runAttempt", "actor", "actorId"],
      "selected stage workflow run");
    assert(receipt.workflow.repository === expected.repository &&
      receipt.workflow.workflowRef === expected.workflowRef &&
      receipt.workflow.runId === expected.runId &&
      receipt.workflow.runAttempt === expected.runAttempt &&
      receipt.workflow.actor === expected.actor &&
      receipt.workflow.actorId === expected.actorId,
    "Vercel stage receipt differs from the selected workflow run");
  }
  if (stagedSmoke) {
    const smoke = parseSmokeReceipt(stagedSmoke, {
      expectedMode: "live", expectedBundlePhase: "stage", bundle,
    });
    assert(receipt.stagedSmokeDigest === smoke.smokeDigest &&
      smoke.origin === receipt.deployment.url,
    "Vercel stage receipt differs from its dark-stage smoke");
    assertFreshTransition(protectionEvidence.checkedAt, smoke.checkedAt,
      "Vercel dark-stage protection and smoke");
    assertFreshTransition(smoke.checkedAt, currentPublicResolution.checkedAt,
      "Vercel dark-stage public-origin resolution");
    assertFreshTransition(currentPublicResolution.checkedAt, receipt.stagedAt,
      "Vercel dark-stage receipt");
  }
  return receipt;
}

function parseBundleForPhase(bundle, phase) {
  assert(["stage", "promotion"].includes(phase), "release bundle phase is invalid");
  return phase === "stage" ? parseStageBundle(bundle) : parsePromotionBundle(bundle);
}

export function parseSmokeReceipt(value, { expectedMode, expectedBundlePhase, bundle } = {}) {
  const schema = expectedMode === "live" ? LIVE_SMOKE_SCHEMA : PLANNED_SMOKE_SCHEMA;
  const smoke = exactKeys(value, [
    "schemaVersion", "mode", "origin", "chainId", "caip2", "bundlePhase", "bundleDigest",
    "manifestDigest", "manifestStatus", "service", "launchFeedStatus", "tokenListStatus",
    "launchCount", "tokenCount", "checkedAt", "smokeDigest",
  ], "chain-4663 smoke receipt");
  assert(smoke.schemaVersion === schema && smoke.mode === expectedMode &&
    smoke.chainId === CHAIN_ID && smoke.caip2 === CAIP2,
  "chain-4663 smoke receipt has the wrong state");
  const origin = new URL(smoke.origin);
  assert(origin.protocol === "https:" ||
    (origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)),
  "chain-4663 smoke receipt origin is invalid");
  exactSha256(smoke.manifestDigest, "chain-4663 smoke manifestDigest");
  exactInstant(smoke.checkedAt, "chain-4663 smoke checkedAt");
  assert(Number.isSafeInteger(smoke.launchCount) && smoke.launchCount >= 0 &&
    Number.isSafeInteger(smoke.tokenCount) && smoke.tokenCount >= 0,
  "chain-4663 smoke counts are invalid");
  if (expectedMode === "live") {
    assert(expectedBundlePhase === "stage" || expectedBundlePhase === "promotion",
      "chain-4663 live smoke requires an exact bundle phase");
    const expectedBundleDigest = bundle === undefined
      ? exactSha256(smoke.bundleDigest, "chain-4663 live smoke bundleDigest")
      : parseBundleForPhase(bundle, expectedBundlePhase).bundleDigest;
    assert(smoke.bundlePhase === expectedBundlePhase &&
      smoke.bundleDigest === expectedBundleDigest &&
      smoke.manifestStatus === "live" && smoke.service === "operational" &&
      smoke.launchFeedStatus === "ready" && smoke.tokenListStatus === "ready",
    "chain-4663 live smoke did not prove a ready finalized read model");
  } else {
    assert(smoke.bundlePhase === null && smoke.bundleDigest === null &&
      smoke.manifestStatus === "planned" &&
      smoke.service !== "operational" && smoke.launchFeedStatus === "unavailable" &&
      smoke.tokenListStatus === "unavailable" && smoke.launchCount === 0 &&
      smoke.tokenCount === 0,
    "chain-4663 planned smoke exposed live data");
  }
  const { smokeDigest, ...withoutDigest } = smoke;
  assert(smokeDigest === canonicalSha256(schema, withoutDigest),
    "chain-4663 smoke receipt digest is invalid");
  return smoke;
}

export function createSmokeReceipt(input) {
  const mode = input.mode;
  assert(["planned", "live"].includes(mode), "chain-4663 smoke mode is invalid");
  const schemaVersion = mode === "live" ? LIVE_SMOKE_SCHEMA : PLANNED_SMOKE_SCHEMA;
  const bundlePhase = mode === "live" ? input.bundlePhase : null;
  const origin = new URL(input.origin);
  assert(origin.pathname === "/" && origin.search === "" && origin.hash === "",
    "chain-4663 smoke origin must be an origin URL");
  exactSha256(input.manifestDigest, "chain-4663 smoke manifestDigest");
  exactInstant(input.checkedAt, "chain-4663 smoke checkedAt");
  const value = {
    schemaVersion,
    mode,
    origin: origin.origin,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    bundlePhase,
    bundleDigest: mode === "live"
      ? parseBundleForPhase(input.bundle, bundlePhase).bundleDigest
      : null,
    manifestDigest: input.manifestDigest,
    manifestStatus: input.manifestStatus,
    service: input.service,
    launchFeedStatus: input.launchFeedStatus,
    tokenListStatus: input.tokenListStatus,
    launchCount: input.launchCount,
    tokenCount: input.tokenCount,
    checkedAt: input.checkedAt,
  };
  const receipt = withDigest(schemaVersion, value, "smokeDigest");
  return parseSmokeReceipt(receipt, {
    expectedMode: mode,
    ...(mode === "live" ? { expectedBundlePhase: bundlePhase, bundle: input.bundle } : {}),
  });
}

function exactPreviousRelease(value, label) {
  const previous = exactKeys(value,
    ["mode", "promotionBundleDigest", "promotionReceiptDigest", "source", "workflow",
      "deployment", "smokeDigest"],
    label);
  assert(["planned", "live"].includes(previous.mode), `${label}.mode is invalid`);
  if (previous.mode === "planned") {
    assert(previous.promotionBundleDigest === null && previous.promotionReceiptDigest === null &&
      previous.source === null && previous.workflow === null,
      `${label} planned promotion digests must be null`);
  } else {
    exactSha256(previous.promotionBundleDigest, `${label}.promotionBundleDigest`);
    exactSha256(previous.promotionReceiptDigest, `${label}.promotionReceiptDigest`);
    exactSource(previous.source, `${label}.source`);
    exactOwnerWorkflow(previous.workflow, `${label}.workflow`);
  }
  exactDeployment(previous.deployment, `${label}.deployment`);
  exactSha256(previous.smokeDigest, `${label}.smokeDigest`);
  return previous;
}

export function createPromotionPlan(input) {
  const stage = parseStageReceipt(input.stageReceipt, {
    bundle: input.stageBundle, target: input.target,
  });
  const promotion = parsePromotionBundle(input.promotionBundle, {
    stageBundle: input.stageBundle,
  });
  assert(stage.stageBundleDigest === promotion.stageBundleDigest &&
    stage.chainDeploymentDescriptorDigest === promotion.descriptorDigest,
  "Phase-B promotion bundle changed the staged Phase-A evidence");
  const source = exactSource(input.source, "promotion evidence source");
  const sourceTransition = parseEvidenceOnlySourceTransition(input.sourceTransition);
  assert(canonicalEqual(sourceTransition.stagedSource, stage.source) &&
    canonicalEqual(sourceTransition.promotionSource, source) &&
    sourceTransition.buildOutputDigest === stage.buildOutputDigest &&
    input.currentBuildOutputDigest === stage.buildOutputDigest,
  "promotion evidence-only source transition changed the staged build output");
  const stageRunEvidence = parseGitHubRunEvidence(input.stageRunEvidence);
  assert(stageRunEvidence.runId === stage.workflow.runId &&
    stageRunEvidence.runAttempt === stage.workflow.runAttempt &&
    stageRunEvidence.sourceRevision === stage.source.revision &&
    stageRunEvidence.sourceTree === stage.source.tree &&
    stageRunEvidence.actor === stage.workflow.actor &&
    stageRunEvidence.actorId === stage.workflow.actorId,
  "promotion plan stage run differs from the stage receipt");
  const stageArtifact = parseGitHubArtifactEvidence(input.stageArtifact);
  assert(stageArtifact.runId === stage.workflow.runId &&
    stageArtifact.runAttempt === stage.workflow.runAttempt &&
    stageArtifact.sourceRevision === stage.source.revision &&
    stageArtifact.artifactName ===
      `developers-vercel-stage-${stage.workflow.runId}-${stage.workflow.runAttempt}`,
  "promotion plan stage artifact differs from the stage receipt workflow");
  const stagedProviderDeployment = exactDeployment(input.stagedProviderDeployment,
    "promotion plan fresh staged provider deployment");
  assert(canonicalEqual(stagedProviderDeployment, stage.deployment),
    "promotion plan fresh provider deployment differs from the stage receipt");
  const stagedSmoke = parseSmokeReceipt(input.stagedSmoke, {
    expectedMode: "live", expectedBundlePhase: "stage", bundle: input.stageBundle,
  });
  assert(stagedSmoke.origin === stage.deployment.url,
    "promotion plan staged smoke did not target the staged deployment");
  const stageProtectionEvidence = parseStageProtectionEvidence(
    input.stageProtectionEvidence, { deployment: stage.deployment },
  );
  assert(stageProtectionEvidence.projectProtection.projectId === stage.target.projectId,
    "promotion plan stage protection evidence is for a different project");
  const previousSmoke = parseSmokeReceipt(input.previousSmoke, {
    expectedMode: input.previousMode,
    ...(input.previousMode === "live"
      ? { expectedBundlePhase: "promotion", bundle: input.previousBundle }
      : {}),
  });
  assert(previousSmoke.origin === PRODUCTION_ORIGIN,
    "promotion plan previous smoke did not target production");
  const previousDeployment = exactDeployment(input.previousDeployment,
    "promotion plan previous public deployment");
  const previousPublicResolution = parseVercelPublicDeploymentResolution(
    input.previousPublicResolution, {
      deployment: previousDeployment,
      target: stage.target,
    },
  );
  assert(previousPublicResolution.deploymentId !== stage.deployment.id &&
    previousPublicResolution.deploymentUrl !== stage.deployment.url,
  "promotion plan public origin already selects the staged deployment");
  const previousPromotion = input.previousMode === "live"
    ? parsePromotionReceipt(input.previousPromotionReceipt, {
      bundle: input.previousBundle, target: input.target,
    })
    : undefined;
  if (previousPromotion) {
    assert(sameImmutableDeployment(previousPromotion.deployment, previousDeployment),
      "promotion plan current deployment differs from the previous promotion receipt");
  }
  const previousPromotionArtifact = previousPromotion
    ? parseGitHubArtifactEvidence(input.previousPromotionArtifact)
    : null;
  const previousPromotionArtifactBinding = previousPromotion
    ? verifyGitHubArtifactArchiveEntry(input.previousPromotionArtifactArchive, {
      artifactDigest: previousPromotionArtifact.artifactDigest,
      entryPath: "promotion-receipt.json",
      expectedBytes: canonicalArtifactBytes(previousPromotion),
    })
    : null;
  const previousPromotionRun = previousPromotion
    ? parseGitHubRunEvidence(input.previousPromotionRun)
    : null;
  if (previousPromotion) {
    assert(previousPromotionRun.runId === previousPromotion.workflow.runId &&
      previousPromotionRun.runAttempt === previousPromotion.workflow.runAttempt &&
      previousPromotionRun.workflowRef === previousPromotion.workflow.workflowRef &&
      previousPromotionRun.actor === previousPromotion.workflow.actor &&
      previousPromotionRun.actorId === previousPromotion.workflow.actorId &&
      previousPromotionRun.sourceRevision === previousPromotion.source.revision &&
      previousPromotionRun.sourceTree === previousPromotion.source.tree &&
      previousPromotionArtifact.runId === previousPromotionRun.runId &&
      previousPromotionArtifact.runAttempt === previousPromotionRun.runAttempt &&
      previousPromotionArtifact.runAttempt === previousPromotion.workflow.runAttempt &&
      previousPromotionArtifact.sourceRevision === previousPromotion.source.revision &&
      previousPromotionArtifact.artifactName ===
        `developers-vercel-promotion-${previousPromotion.workflow.runId}-${previousPromotion.workflow.runAttempt}`,
    "previous promotion artifact differs from the previous promotion receipt workflow");
  }
  const previous = exactPreviousRelease({
    mode: input.previousMode,
    promotionBundleDigest: input.previousMode === "live"
      ? parsePromotionBundle(input.previousBundle).promotionBundleDigest
      : null,
    promotionReceiptDigest: previousPromotion?.promotionReceiptDigest ?? null,
    source: previousPromotion?.source ?? null,
    workflow: previousPromotion?.workflow ?? null,
    deployment: previousDeployment,
    smokeDigest: previousSmoke.smokeDigest,
  }, "promotion plan previous release");
  const indexerEvidence = parseIndexerPromotionEvidence({
    ...input.indexerEvidence,
    bundle: input.promotionBundle,
  });
  assert(indexerEvidence.promotionBundleDigest === promotion.promotionBundleDigest,
    "promotion plan Indexer evidence differs from the Phase-B bundle");
  exactInstant(input.preparedAt, "promotion plan preparedAt");
  const indexerEvidenceAge = Date.parse(input.preparedAt) -
    Date.parse(indexerEvidence.producer.publishedAt);
  assert(indexerEvidenceAge >= 0 &&
    indexerEvidenceAge <= MAX_INDEXER_PROTECTED_PUBLICATION_DELAY_MILLISECONDS,
  "promotion plan requires Indexer evidence published within the last 24 hours");
  assertFreshTransition(stageProtectionEvidence.checkedAt, stagedSmoke.checkedAt,
    "promotion plan stage protection and smoke verification");
  assertFreshTransition(stagedSmoke.checkedAt, input.preparedAt,
    "promotion plan stage smoke verification");
  assertFreshTransition(previousPublicResolution.checkedAt, previousSmoke.checkedAt,
    "promotion plan public-origin resolution and smoke verification");
  assertFreshTransition(previousSmoke.checkedAt, input.preparedAt,
    "promotion plan current public smoke verification");
  const value = {
    schemaVersion: PROMOTION_PLAN_SCHEMA,
    state: "ready-awaiting-owner-authorization",
    publicAuthorization: false,
    publicWrites: false,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    stageBundleDigest: stage.stageBundleDigest,
    promotionBundleDigest: promotion.promotionBundleDigest,
    stageReceiptDigest: stage.stageReceiptDigest,
    stagedSource: stage.source,
    source,
    sourceTransition,
    target: stage.target,
    stagedDeployment: stage.deployment,
    stagedProviderDeployment,
    buildOutputDigest: stage.buildOutputDigest,
    stagedSmokeDigest: stagedSmoke.smokeDigest,
    stageProtectionEvidence,
    stageRunEvidence,
    stageArtifact,
    indexerEvidence,
    previousRelease: previous,
    previousPublicResolution,
    previousPromotionReceipt: previousPromotion ?? null,
    previousPromotionRun,
    previousPromotionArtifact,
    previousPromotionArtifactArchiveDigest:
      previousPromotionArtifactBinding?.artifactArchiveDigest ?? null,
    previousPromotionArtifactEntryPath:
      previousPromotionArtifactBinding?.artifactEntryPath ?? null,
    previousPromotionArtifactEntrySha256:
      previousPromotionArtifactBinding?.artifactEntrySha256 ?? null,
    workflow: exactWorkflow(input.workflow),
    preparedAt: input.preparedAt,
  };
  return withDigest(PROMOTION_PLAN_SCHEMA, value, "promotionPlanDigest");
}

export function parsePromotionPlan(value, {
  bundle, promotionBundle = bundle, stageBundle, stageReceipt, target,
} = {}) {
  const plan = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "stageBundleDigest", "promotionBundleDigest", "stageReceiptDigest",
    "stagedSource", "source",
    "sourceTransition", "target", "stagedDeployment", "stagedProviderDeployment",
    "buildOutputDigest", "stagedSmokeDigest", "stageProtectionEvidence", "stageRunEvidence",
    "stageArtifact", "indexerEvidence", "previousRelease",
    "previousPublicResolution", "previousPromotionReceipt", "previousPromotionRun",
    "previousPromotionArtifact", "previousPromotionArtifactArchiveDigest",
    "previousPromotionArtifactEntryPath", "previousPromotionArtifactEntrySha256", "workflow",
    "preparedAt", "promotionPlanDigest",
  ], "Vercel promotion plan");
  assert(plan.schemaVersion === PROMOTION_PLAN_SCHEMA &&
    plan.state === "ready-awaiting-owner-authorization" &&
    plan.publicAuthorization === false && plan.publicWrites === false &&
    plan.chainId === CHAIN_ID && plan.caip2 === CAIP2 &&
    plan.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Vercel promotion plan must remain non-authorizing");
  exactSource(plan.stagedSource, "Vercel promotion plan stagedSource");
  exactSource(plan.source, "Vercel promotion plan source");
  const sourceTransition = parseEvidenceOnlySourceTransition(plan.sourceTransition);
  assert(canonicalEqual(sourceTransition.stagedSource, plan.stagedSource) &&
    canonicalEqual(sourceTransition.promotionSource, plan.source),
  "Vercel promotion plan source transition disagrees with its sources");
  exactTarget(plan.target, "Vercel promotion plan target");
  exactDeployment(plan.stagedDeployment, "Vercel promotion plan stagedDeployment");
  exactDeployment(plan.stagedProviderDeployment,
    "Vercel promotion plan stagedProviderDeployment");
  assert(canonicalEqual(plan.stagedProviderDeployment, plan.stagedDeployment),
    "Vercel promotion plan fresh provider deployment differs from the staged receipt");
  exactSha256(plan.buildOutputDigest, "Vercel promotion plan buildOutputDigest");
  assert(sourceTransition.buildOutputDigest === plan.buildOutputDigest,
    "Vercel promotion plan source transition changed the staged build output");
  exactSha256(plan.stagedSmokeDigest, "Vercel promotion plan stagedSmokeDigest");
  exactSha256(plan.stageBundleDigest, "Vercel promotion plan stageBundleDigest");
  const stageProtectionEvidence = parseStageProtectionEvidence(
    plan.stageProtectionEvidence, { deployment: plan.stagedDeployment },
  );
  assert(stageProtectionEvidence.projectProtection.projectId === plan.target.projectId,
    "Vercel promotion plan stage protection evidence is for a different project");
  const stageArtifact = parseGitHubArtifactEvidence(plan.stageArtifact);
  const stageRunEvidence = parseGitHubRunEvidence(plan.stageRunEvidence);
  assert(stageArtifact.sourceRevision === plan.stagedSource.revision &&
    stageArtifact.runId === stageRunEvidence.runId &&
    stageArtifact.runAttempt === stageRunEvidence.runAttempt &&
    stageRunEvidence.sourceRevision === plan.stagedSource.revision &&
    stageRunEvidence.sourceTree === plan.stagedSource.tree,
  "Vercel promotion plan run or artifact differs from the staged source");
  const indexerEvidence = parseIndexerPromotionEvidenceBinding(plan.indexerEvidence);
  assert(indexerEvidence.promotionBundleDigest === plan.promotionBundleDigest,
    "Vercel promotion plan Indexer evidence differs from the promotion bundle");
  exactPreviousRelease(plan.previousRelease, "Vercel promotion plan previousRelease");
  const previousPublicResolution = parseVercelPublicDeploymentResolution(
    plan.previousPublicResolution, {
      deployment: plan.previousRelease.deployment,
      target: plan.target,
    },
  );
  assert(previousPublicResolution.deploymentId !== plan.stagedDeployment.id &&
    previousPublicResolution.deploymentUrl !== plan.stagedDeployment.url,
  "Vercel promotion plan public origin selects the staged deployment");
  if (plan.previousRelease.mode === "planned") {
    assert(plan.previousPromotionReceipt === null &&
      plan.previousPromotionRun === null && plan.previousPromotionArtifact === null &&
      plan.previousPromotionArtifactArchiveDigest === null &&
      plan.previousPromotionArtifactEntryPath === null &&
      plan.previousPromotionArtifactEntrySha256 === null,
      "planned previous release must not claim a promotion artifact");
  } else {
    const previousPromotion = parsePromotionReceipt(plan.previousPromotionReceipt, {
      target: plan.target,
    });
    const previousRun = parseGitHubRunEvidence(plan.previousPromotionRun);
    const previousArtifact = parseGitHubArtifactEvidence(plan.previousPromotionArtifact);
    exactSha256(plan.previousPromotionArtifactArchiveDigest,
      "Vercel promotion plan previousPromotionArtifactArchiveDigest");
    exactSha256(plan.previousPromotionArtifactEntrySha256,
      "Vercel promotion plan previousPromotionArtifactEntrySha256");
    assert(previousRun.runId === previousArtifact.runId &&
      previousRun.runAttempt === previousArtifact.runAttempt &&
      previousArtifact.sourceRevision === previousRun.sourceRevision &&
      previousRun.sourceRevision === plan.previousRelease.source.revision &&
      previousRun.sourceTree === plan.previousRelease.source.tree &&
      previousRun.workflowRef === plan.previousRelease.workflow.workflowRef &&
      previousRun.runId === plan.previousRelease.workflow.runId &&
      previousRun.runAttempt === plan.previousRelease.workflow.runAttempt &&
      previousRun.actor === plan.previousRelease.workflow.actor &&
      previousRun.actorId === plan.previousRelease.workflow.actorId &&
      plan.previousRelease.promotionReceiptDigest === previousPromotion.promotionReceiptDigest &&
      plan.previousPromotionArtifactArchiveDigest === previousArtifact.artifactDigest &&
      plan.previousPromotionArtifactEntryPath === "promotion-receipt.json" &&
      plan.previousPromotionArtifactEntrySha256 ===
        sha256Bytes(canonicalArtifactBytes(previousPromotion)) &&
      canonicalEqual(previousPromotion.source, plan.previousRelease.source) &&
      canonicalEqual(previousPromotion.workflow, plan.previousRelease.workflow) &&
      sameImmutableDeployment(previousPromotion.deployment,
        plan.previousRelease.deployment),
    "live previous release is missing its promotion evidence");
  }
  exactWorkflow(plan.workflow, "Vercel promotion plan workflow");
  exactInstant(plan.preparedAt, "Vercel promotion plan preparedAt");
  const indexerEvidenceAge = Date.parse(plan.preparedAt) -
    Date.parse(indexerEvidence.producer.publishedAt);
  assert(indexerEvidenceAge >= 0 &&
    indexerEvidenceAge <= MAX_INDEXER_PROTECTED_PUBLICATION_DELAY_MILLISECONDS,
  "Vercel promotion plan Indexer evidence is older than 24 hours");
  assertFreshTransition(stageProtectionEvidence.checkedAt, plan.preparedAt,
    "Vercel promotion plan stage protection verification");
  assertFreshTransition(previousPublicResolution.checkedAt, plan.preparedAt,
    "Vercel promotion plan public-origin verification");
  const { promotionPlanDigest, ...withoutDigest } = plan;
  assert(promotionPlanDigest === canonicalSha256(PROMOTION_PLAN_SCHEMA, withoutDigest),
    "Vercel promotion plan digest is invalid");
  if (promotionBundle) assert(plan.promotionBundleDigest ===
    parsePromotionBundle(promotionBundle, { stageBundle }).promotionBundleDigest,
  "Vercel promotion plan differs from the finalized promotion bundle");
  if (stageReceipt) {
    const stage = parseStageReceipt(stageReceipt, { bundle: stageBundle, target });
    assert(plan.stageReceiptDigest === stage.stageReceiptDigest &&
      plan.stageBundleDigest === stage.stageBundleDigest &&
      canonicalEqual(plan.stagedSource, stage.source) &&
      canonicalEqual(plan.stagedDeployment, stage.deployment) &&
      stageRunEvidence.runId === stage.workflow.runId &&
      stageRunEvidence.runAttempt === stage.workflow.runAttempt &&
      plan.buildOutputDigest === stage.buildOutputDigest,
    "Vercel promotion plan differs from the stage receipt");
  }
  if (target) assert(canonicalEqual(plan.target, exactTarget(target)),
    "Vercel promotion plan differs from the protected target");
  return plan;
}

export function createPublicAuthorization(input) {
  const operation = input.operation;
  assert(["promote", "rollback"].includes(operation),
    "public authorization operation is invalid");
  const plan = operation === "promote"
    ? parsePromotionPlan(input.plan, input.context)
    : parseRollbackPlan(input.plan, input.context);
  const planDigest = operation === "promote"
    ? plan.promotionPlanDigest
    : plan.rollbackPlanDigest;
  exactInstant(input.authorizedAt, "public authorization authorizedAt");
  const planAge = Date.parse(input.authorizedAt) - Date.parse(plan.preparedAt);
  assert(planAge >= 0 && planAge <= 30 * 60_000,
    "public authorization requires a plan prepared within 30 minutes");
  const workflow = exactWorkflow(input.workflow);
  const ownerDispatchAuthorization = parseGitHubOwnerDispatchAuthorization(
    input.ownerDispatchAuthorization, { workflow, source: plan.source },
  );
  assert(ownerDispatchAuthorization.observedAt === input.authorizedAt,
    "canonical owner dispatch must be observed in the authorization step");
  const inputArtifact = operation === "promote"
    ? parseGitHubArtifactEvidence(plan.stageArtifact)
    : parseGitHubArtifactEvidence(plan.promotionArtifact);
  const deploymentTransition = operation === "promote"
    ? {
      from: plan.previousRelease.deployment,
      to: plan.stagedDeployment,
      fromMode: plan.previousRelease.mode,
      toMode: "live",
    }
    : {
      from: plan.currentDeployment,
      to: plan.rollbackDeployment,
      fromMode: "live",
      toMode: plan.rollbackTarget.mode,
    };
  const value = {
    schemaVersion: PUBLIC_AUTHORIZATION_SCHEMA,
    state: "owner-authorized",
    operation,
    publicAuthorization: true,
    publicWrites: true,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    planDigest,
    stageBundleDigest: plan.stageBundleDigest,
    promotionBundleDigest: plan.promotionBundleDigest,
    indexerEvidence: plan.indexerEvidence,
    source: plan.source,
    target: plan.target,
    inputArtifact,
    deploymentTransition,
    authorizationEnvironment: DEVELOPERS_PRODUCTION_ENVIRONMENT,
    ownerDispatchAuthorization,
    ownerDispatchCommitment: canonicalSha256(
      "programmable.developers.vercel-owner-dispatch-commitment.v1",
      {
        operation,
        planDigest,
        ownerDispatchAuthorizationDigest:
          ownerDispatchAuthorization.ownerDispatchAuthorizationDigest,
      },
    ),
    workflow,
    authorizedAt: input.authorizedAt,
  };
  return withDigest(PUBLIC_AUTHORIZATION_SCHEMA, value, "authorizationDigest");
}

export function parsePublicAuthorization(value, { operation, plan } = {}) {
  const authorization = exactKeys(value, [
    "schemaVersion", "state", "operation", "publicAuthorization", "publicWrites", "chainId",
    "caip2", "chainDeploymentId", "planDigest", "stageBundleDigest",
    "promotionBundleDigest", "indexerEvidence",
    "source", "target", "inputArtifact", "deploymentTransition", "authorizationEnvironment",
    "ownerDispatchAuthorization", "ownerDispatchCommitment", "workflow", "authorizedAt",
    "authorizationDigest",
  ], "Vercel public authorization");
  assert(authorization.schemaVersion === PUBLIC_AUTHORIZATION_SCHEMA &&
    authorization.state === "owner-authorized" && authorization.operation === operation &&
    authorization.publicAuthorization === true && authorization.publicWrites === true &&
    authorization.chainId === CHAIN_ID && authorization.caip2 === CAIP2 &&
    authorization.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Vercel public authorization is invalid");
  exactSha256(authorization.planDigest, "Vercel public authorization planDigest");
  exactSha256(authorization.stageBundleDigest,
    "Vercel public authorization stageBundleDigest");
  exactSha256(authorization.promotionBundleDigest,
    "Vercel public authorization promotionBundleDigest");
  const indexerEvidence = parseIndexerPromotionEvidenceBinding(authorization.indexerEvidence);
  assert(indexerEvidence.promotionBundleDigest === authorization.promotionBundleDigest,
    "Vercel public authorization Indexer evidence differs from the promotion bundle");
  exactSource(authorization.source, "Vercel public authorization source");
  exactTarget(authorization.target, "Vercel public authorization target");
  const inputArtifact = parseGitHubArtifactEvidence(authorization.inputArtifact);
  const transition = exactKeys(authorization.deploymentTransition,
    ["from", "to", "fromMode", "toMode"], "authorized deployment transition");
  exactDeployment(transition.from, "authorized deployment transition source");
  exactDeployment(transition.to, "authorized deployment transition target");
  assert(["planned", "live"].includes(transition.fromMode) &&
    ["planned", "live"].includes(transition.toMode) &&
    authorization.authorizationEnvironment === DEVELOPERS_PRODUCTION_ENVIRONMENT,
  "Vercel public authorization transition or environment is invalid");
  const workflow = exactWorkflow(authorization.workflow,
    "Vercel public authorization workflow");
  const ownerDispatchAuthorization = parseGitHubOwnerDispatchAuthorization(
    authorization.ownerDispatchAuthorization, { workflow, source: authorization.source },
  );
  assert(authorization.authorizedAt === ownerDispatchAuthorization.observedAt,
    "Vercel public authorization differs from its observed owner dispatch");
  exactSha256(authorization.ownerDispatchCommitment,
    "Vercel public authorization ownerDispatchCommitment");
  assert(authorization.ownerDispatchCommitment === canonicalSha256(
    "programmable.developers.vercel-owner-dispatch-commitment.v1",
    {
      operation,
      planDigest: authorization.planDigest,
      ownerDispatchAuthorizationDigest:
        ownerDispatchAuthorization.ownerDispatchAuthorizationDigest,
    },
  ), "Vercel public authorization owner-dispatch commitment is invalid");
  exactInstant(authorization.authorizedAt, "Vercel public authorization authorizedAt");
  const { authorizationDigest, ...withoutDigest } = authorization;
  assert(authorizationDigest === canonicalSha256(PUBLIC_AUTHORIZATION_SCHEMA, withoutDigest),
    "Vercel public authorization digest is invalid");
  if (plan) {
    const parsed = operation === "promote" ? parsePromotionPlan(plan) : parseRollbackPlan(plan);
    const planAge = Date.parse(authorization.authorizedAt) - Date.parse(parsed.preparedAt);
    assert(authorization.planDigest === (operation === "promote"
      ? parsed.promotionPlanDigest : parsed.rollbackPlanDigest) &&
      authorization.stageBundleDigest === parsed.stageBundleDigest &&
      authorization.promotionBundleDigest === parsed.promotionBundleDigest &&
      canonicalEqual(authorization.indexerEvidence, parsed.indexerEvidence) &&
      canonicalEqual(authorization.source, parsed.source) &&
      canonicalEqual(authorization.target, parsed.target) &&
      canonicalEqual(inputArtifact, operation === "promote"
        ? parsed.stageArtifact : parsed.promotionArtifact) &&
      canonicalEqual(transition, operation === "promote" ? {
        from: parsed.previousRelease.deployment,
        to: parsed.stagedDeployment,
        fromMode: parsed.previousRelease.mode,
        toMode: "live",
      } : {
        from: parsed.currentDeployment,
        to: parsed.rollbackDeployment,
        fromMode: "live",
        toMode: parsed.rollbackTarget.mode,
      }) && planAge >= 0 && planAge <= 30 * 60_000,
    "Vercel public authorization differs from the release plan");
  }
  return authorization;
}

export function createPreMutationState(input) {
  const operation = input.operation;
  const plan = operation === "promote"
    ? parsePromotionPlan(input.plan)
    : parseRollbackPlan(input.plan);
  const current = exactDeployment(input.currentDeployment,
    "pre-mutation current production deployment");
  const selected = exactDeployment(input.selectedDeployment,
    "pre-mutation selected deployment");
  const expectedCurrent = operation === "promote"
    ? plan.previousRelease.deployment
    : plan.currentDeployment;
  const expectedSelected = operation === "promote"
    ? plan.stagedDeployment
    : plan.rollbackDeployment;
  assert(sameImmutableDeployment(current, expectedCurrent) &&
    sameImmutableDeployment(selected, expectedSelected),
  "fresh Vercel deployment state differs from the approved release transition");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, {
      deployment: current,
      target: plan.target,
    },
  );
  assert(currentPublicResolution.deploymentId !== selected.id &&
    currentPublicResolution.deploymentUrl !== selected.url,
  "fresh Vercel public origin already selects the release target");
  const selectedProtectionEvidence = parseStageProtectionEvidence(
    input.selectedProtectionEvidence, { deployment: selected },
  );
  assert(selectedProtectionEvidence.projectProtection.projectId === plan.target.projectId,
    "fresh selected deployment protection evidence is for a different project");
  const selectedSmoke = operation === "promote"
    ? parseSmokeReceipt(input.selectedSmoke, {
      expectedMode: "live", expectedBundlePhase: "promotion", bundle: input.selectedBundle,
    })
    : parseSmokeReceipt(input.selectedSmoke, {
      expectedMode: plan.rollbackTarget.mode,
      ...(plan.rollbackTarget.mode === "live"
        ? { expectedBundlePhase: "promotion", bundle: input.selectedBundle }
        : {}),
    });
  assert(selectedSmoke.origin === selected.url,
    "fresh selected deployment smoke targeted a different origin");
  if (operation === "promote") {
    assert(selectedSmoke.bundleDigest === plan.promotionBundleDigest,
      "fresh promotion smoke differs from the approved Phase-B bundle");
  } else if (plan.rollbackTarget.mode === "live") {
    assert(selectedSmoke.bundleDigest === plan.rollbackTarget.promotionBundleDigest,
      "fresh rollback smoke differs from the historical Phase-B bundle");
  }
  exactInstant(input.checkedAt, "pre-mutation state checkedAt");
  assert(selectedSmoke.checkedAt === input.checkedAt,
    "pre-mutation state must use the fresh selected deployment smoke time");
  assertFreshTransition(selectedProtectionEvidence.checkedAt, selectedSmoke.checkedAt,
    "pre-mutation selected deployment verification");
  assertFreshTransition(currentPublicResolution.checkedAt, input.checkedAt,
    "pre-mutation public-origin resolution");
  const value = {
    schemaVersion: PRE_MUTATION_STATE_SCHEMA,
    state: "fresh-provider-requery",
    operation,
    planDigest: operation === "promote" ? plan.promotionPlanDigest : plan.rollbackPlanDigest,
    currentDeployment: current,
    currentPublicResolution,
    selectedDeployment: selected,
    selectedProtectionEvidence,
    selectedSmokeDigest: selectedSmoke.smokeDigest,
    checkedAt: input.checkedAt,
  };
  return withDigest(PRE_MUTATION_STATE_SCHEMA, value, "preMutationStateDigest");
}

export function parsePreMutationState(value, {
  operation, plan, selectedSmoke, selectedBundle,
} = {}) {
  const state = exactKeys(value, [
    "schemaVersion", "state", "operation", "planDigest", "currentDeployment",
    "currentPublicResolution", "selectedDeployment", "selectedProtectionEvidence",
    "selectedSmokeDigest", "checkedAt", "preMutationStateDigest",
  ], "Vercel pre-mutation state");
  assert(state.schemaVersion === PRE_MUTATION_STATE_SCHEMA &&
    state.state === "fresh-provider-requery" && state.operation === operation,
  "Vercel pre-mutation state is invalid");
  exactSha256(state.planDigest, "Vercel pre-mutation state planDigest");
  exactDeployment(state.currentDeployment, "Vercel pre-mutation current deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    state.currentPublicResolution, { deployment: state.currentDeployment },
  );
  exactDeployment(state.selectedDeployment,
    "Vercel pre-mutation selected deployment");
  assert(currentPublicResolution.deploymentId !== state.selectedDeployment.id &&
    currentPublicResolution.deploymentUrl !== state.selectedDeployment.url,
  "Vercel pre-mutation public origin selects the release target");
  const selectedProtectionEvidence = parseStageProtectionEvidence(
    state.selectedProtectionEvidence, { deployment: state.selectedDeployment },
  );
  exactSha256(state.selectedSmokeDigest, "Vercel pre-mutation selectedSmokeDigest");
  assertFreshTransition(selectedProtectionEvidence.checkedAt, state.checkedAt,
    "Vercel pre-mutation selected deployment verification");
  assertFreshTransition(currentPublicResolution.checkedAt, state.checkedAt,
    "Vercel pre-mutation public-origin resolution");
  exactInstant(state.checkedAt, "Vercel pre-mutation state checkedAt");
  const { preMutationStateDigest, ...withoutDigest } = state;
  assert(preMutationStateDigest === canonicalSha256(PRE_MUTATION_STATE_SCHEMA, withoutDigest),
    "Vercel pre-mutation state digest is invalid");
  if (plan) {
    const recreated = createPreMutationState({
      operation,
      plan,
      currentDeployment: state.currentDeployment,
      currentPublicResolution: state.currentPublicResolution,
      selectedDeployment: state.selectedDeployment,
      selectedProtectionEvidence: state.selectedProtectionEvidence,
      selectedSmoke,
      selectedBundle,
      checkedAt: state.checkedAt,
    });
    assert(recreated.preMutationStateDigest === state.preMutationStateDigest,
      "Vercel pre-mutation state differs from the approved release plan");
  }
  return state;
}

function samePublicResolutionIdentity(left, right) {
  return left.provider === right.provider && left.origin === right.origin &&
    left.deploymentId === right.deploymentId &&
    left.deploymentUrl === right.deploymentUrl && left.orgId === right.orgId &&
    left.projectId === right.projectId;
}

export function validatePreMutationReadiness(input) {
  const operation = input.operation;
  assert(["promote", "rollback"].includes(operation),
    "pre-mutation readiness operation is invalid");
  const plan = operation === "promote"
    ? parsePromotionPlan(input.plan)
    : parseRollbackPlan(input.plan);
  const authorization = parsePublicAuthorization(input.authorization, { operation, plan });
  const intent = parsePublicMutationIntent(input.intent, {
    operation,
    plan,
    authorization: input.intentAuthorization ?? input.authorization,
    preMutationState: input.intentPreMutationState ?? input.preMutationState,
    selectedSmoke: input.intentSelectedSmoke ?? input.selectedSmoke,
    selectedBundle: input.selectedBundle,
  });
  assert(canonicalEqual(authorization.source, intent.source) &&
    canonicalEqual(authorization.target, intent.target) &&
    canonicalEqual(authorization.workflow, intent.workflow),
  "fresh public authorization differs from the immutable mutation intent");
  const state = parsePreMutationState(input.preMutationState, {
    operation,
    plan,
    selectedSmoke: input.selectedSmoke,
    selectedBundle: input.selectedBundle,
  });
  const current = exactDeployment(input.currentDeployment,
    "final pre-mutation current production deployment");
  assert(sameImmutableDeployment(current, state.currentDeployment),
    "final pre-mutation provider re-query found public routing drift");
  assert(sameImmutableDeployment(current, intent.currentDeployment) &&
    sameImmutableDeployment(state.selectedDeployment, intent.targetDeployment),
  "final public mutation readiness differs from the immutable mutation intent");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, { deployment: current, target: plan.target },
  );
  const mutationControl = parseVercelMutationControlEvidence(input.mutationControl, {
    target: plan.target,
  });
  assert(mutationControl.mutationAvailable,
    "Vercel has a pending or in-progress alias mutation");
  assertMutationControlResolutionConsistency(mutationControl, currentPublicResolution);
  assert(samePublicResolutionIdentity(
    currentPublicResolution, state.currentPublicResolution,
  ), "final pre-mutation public-origin resolution differs from the sealed state");
  exactInstant(input.confirmedAt, "pre-mutation readiness confirmedAt");
  assertFreshTransition(state.checkedAt, authorization.authorizedAt,
    "final target evidence and owner authorization");
  assertFreshTransition(authorization.authorizedAt, currentPublicResolution.checkedAt,
    "owner authorization and final public-origin provider re-query");
  assertFreshTransition(state.checkedAt, currentPublicResolution.checkedAt,
    "sealed state and final public-origin provider re-query");
  assertFreshTransition(currentPublicResolution.checkedAt, input.confirmedAt,
    "final public-origin provider re-query and mutation readiness");
  assertFreshTransition(currentPublicResolution.checkedAt, mutationControl.checkedAt,
    "final public-origin resolution and Vercel mutation control");
  assertFreshTransition(mutationControl.checkedAt, input.confirmedAt,
    "Vercel mutation control and mutation readiness");
  assertFreshTransition(state.checkedAt, input.confirmedAt,
    "sealed pre-mutation state readiness");
  assertFreshTransition(state.selectedProtectionEvidence.checkedAt, input.confirmedAt,
    "selected deployment protection and mutation readiness");
  const authorizationAge = Date.parse(input.confirmedAt) -
    Date.parse(authorization.authorizedAt);
  assert(authorizationAge >= 0 && authorizationAge <= 30 * 60_000,
    "public mutation authorization must remain fresh at the mutation boundary");
  return withDigest(PUBLIC_MUTATION_READINESS_SCHEMA, {
    schemaVersion: PUBLIC_MUTATION_READINESS_SCHEMA,
    state: "fresh-public-mutation-boundary",
    operation,
    planDigest: operation === "promote"
      ? plan.promotionPlanDigest
      : plan.rollbackPlanDigest,
    source: intent.source,
    target: intent.target,
    workflow: intent.workflow,
    authorization,
    authorizationDigest: authorization.authorizationDigest,
    preMutationState: state,
    preMutationStateDigest: state.preMutationStateDigest,
    mutationIntentDigest: intent.mutationIntentDigest,
    currentPublicResolution,
    mutationControl,
    mutationControlDigest: mutationControl.mutationControlDigest,
    selectedDeployment: state.selectedDeployment,
    confirmedAt: input.confirmedAt,
  }, "mutationReadinessDigest");
}

export function parsePublicMutationReadiness(value, {
  operation, plan, intent, authorization, preMutationState, selectedSmoke, selectedBundle,
} = {}) {
  const readiness = exactKeys(value, [
    "schemaVersion", "state", "operation", "planDigest", "source", "target",
    "workflow", "authorization", "authorizationDigest", "preMutationState",
    "preMutationStateDigest", "mutationIntentDigest", "currentPublicResolution",
    "mutationControl", "mutationControlDigest", "selectedDeployment", "confirmedAt",
    "mutationReadinessDigest",
  ], "public mutation readiness");
  assert(readiness.schemaVersion === PUBLIC_MUTATION_READINESS_SCHEMA &&
    readiness.state === "fresh-public-mutation-boundary" &&
    ["promote", "rollback"].includes(readiness.operation),
  "public mutation readiness is invalid");
  if (operation) assert(readiness.operation === operation,
    "public mutation readiness operation differs");
  const parsedPlan = readiness.operation === "promote"
    ? parsePromotionPlan(plan)
    : parseRollbackPlan(plan);
  const expectedPlanDigest = readiness.operation === "promote"
    ? parsedPlan.promotionPlanDigest
    : parsedPlan.rollbackPlanDigest;
  assert(readiness.planDigest === expectedPlanDigest,
    "public mutation readiness plan differs");
  const source = exactSource(readiness.source, "public mutation readiness source");
  const target = exactTarget(readiness.target, "public mutation readiness target");
  const workflow = exactWorkflow(readiness.workflow,
    "public mutation readiness workflow");
  const parsedAuthorization = parsePublicAuthorization(readiness.authorization, {
    operation: readiness.operation, plan: parsedPlan,
  });
  const parsedState = parsePreMutationState(readiness.preMutationState, {
    operation: readiness.operation,
    plan: parsedPlan,
    selectedSmoke,
    selectedBundle,
  });
  assert(parsedAuthorization.authorizationDigest === readiness.authorizationDigest &&
    parsedState.preMutationStateDigest === readiness.preMutationStateDigest &&
    canonicalEqual(parsedAuthorization.source, source) &&
    canonicalEqual(parsedAuthorization.target, target) &&
    canonicalEqual(parsedAuthorization.workflow, workflow) &&
    canonicalEqual(parsedState.selectedDeployment, readiness.selectedDeployment),
  "public mutation readiness evidence differs");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    readiness.currentPublicResolution, {
      deployment: parsedState.currentDeployment,
      target,
    },
  );
  const mutationControl = parseVercelMutationControlEvidence(readiness.mutationControl, {
    target,
  });
  assert(mutationControl.mutationAvailable &&
    mutationControl.mutationControlDigest === readiness.mutationControlDigest,
  "public mutation readiness has unavailable Vercel mutation control");
  assertMutationControlResolutionConsistency(mutationControl, currentPublicResolution);
  assert(samePublicResolutionIdentity(
    currentPublicResolution, parsedState.currentPublicResolution,
  ), "public mutation readiness resolution differs from its sealed state");
  exactInstant(readiness.confirmedAt, "public mutation readiness confirmedAt");
  assertFreshTransition(parsedState.checkedAt, parsedAuthorization.authorizedAt,
    "parsed final target evidence and owner authorization");
  assertFreshTransition(parsedAuthorization.authorizedAt,
    currentPublicResolution.checkedAt,
    "parsed owner authorization and public-origin provider re-query");
  assertFreshTransition(currentPublicResolution.checkedAt, readiness.confirmedAt,
    "parsed public-origin provider re-query and mutation readiness");
  assertFreshTransition(currentPublicResolution.checkedAt, mutationControl.checkedAt,
    "parsed public-origin resolution and Vercel mutation control");
  assertFreshTransition(mutationControl.checkedAt, readiness.confirmedAt,
    "parsed Vercel mutation control and mutation readiness");
  assertFreshTransition(parsedState.selectedProtectionEvidence.checkedAt,
    readiness.confirmedAt,
    "parsed selected protection and mutation readiness");
  for (const key of [
    "planDigest", "authorizationDigest", "preMutationStateDigest",
    "mutationIntentDigest", "mutationControlDigest",
  ]) exactSha256(readiness[key], `public mutation readiness ${key}`);
  const { mutationReadinessDigest, ...withoutDigest } = readiness;
  assert(mutationReadinessDigest === canonicalSha256(
    PUBLIC_MUTATION_READINESS_SCHEMA, withoutDigest,
  ), "public mutation readiness digest is invalid");
  if (intent) {
    const parsedIntent = parsePublicMutationIntent(intent);
    assert(readiness.mutationIntentDigest === parsedIntent.mutationIntentDigest &&
      canonicalEqual(source, parsedIntent.source) &&
      canonicalEqual(target, parsedIntent.target) &&
      canonicalEqual(workflow, parsedIntent.workflow),
    "public mutation readiness differs from its immutable intent");
  }
  if (authorization) assert(readiness.authorizationDigest ===
    parsePublicAuthorization(authorization, {
      operation: readiness.operation, plan: parsedPlan,
    }).authorizationDigest,
  "public mutation readiness differs from its final authorization");
  if (preMutationState) assert(readiness.preMutationStateDigest ===
    parsePreMutationState(preMutationState, {
      operation: readiness.operation, plan: parsedPlan, selectedSmoke, selectedBundle,
    }).preMutationStateDigest,
  "public mutation readiness differs from its final state");
  return readiness;
}

export function validatePlannedPublicMutationReadiness(input) {
  const authorization = parsePlannedDeployAuthorization(input.authorization);
  assert(authorization.mutation === "promote-candidate",
    "planned public mutation requires a promote-candidate authorization");
  const intent = parsePublicMutationIntent(input.intent, {
    operation: "deploy-planned",
    authorization: input.intentAuthorization ?? input.authorization,
    selectedSmoke: input.intentSelectedSmoke,
  });
  assert(canonicalEqual(authorization.source, intent.source) &&
    canonicalEqual(authorization.target, intent.target) &&
    canonicalEqual(authorization.workflow, intent.workflow),
  "fresh planned authorization differs from the immutable mutation intent");
  const current = exactDeployment(input.currentDeployment,
    "final planned pre-mutation current production deployment");
  assert(sameImmutableDeployment(current, authorization.currentDeployment),
    "final planned pre-mutation provider re-query found public routing drift");
  assert(sameImmutableDeployment(current, intent.currentDeployment) &&
    sameImmutableDeployment(authorization.candidateDeployment, intent.targetDeployment),
  "final planned mutation readiness differs from the immutable mutation intent");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, {
      deployment: current,
      target: authorization.target,
    },
  );
  const mutationControl = parseVercelMutationControlEvidence(input.mutationControl, {
    target: authorization.target,
  });
  assert(mutationControl.mutationAvailable,
    "Vercel has a pending or in-progress alias mutation");
  assertMutationControlResolutionConsistency(mutationControl, currentPublicResolution);
  assert(samePublicResolutionIdentity(
    currentPublicResolution, authorization.currentPublicResolution,
  ), "final planned public-origin resolution differs from the authorization");
  assert(!sameImmutableDeployment(current, authorization.candidateDeployment),
    "planned public origin already selects the authorized candidate");
  const candidateProtection = parseStageProtectionEvidence(
    authorization.candidateProtectionEvidence, {
      deployment: authorization.candidateDeployment,
    },
  );
  const candidateSmoke = parseSmokeReceipt(input.candidateSmoke, {
    expectedMode: "planned",
  });
  assert(candidateProtection.projectProtection.projectId === authorization.target.projectId &&
    candidateSmoke.origin === authorization.candidateDeployment.url &&
    candidateSmoke.smokeDigest === authorization.candidateSmokeDigest,
  "planned mutation readiness candidate evidence differs from the authorization");
  exactInstant(input.confirmedAt, "planned mutation readiness confirmedAt");
  assertFreshTransition(candidateProtection.checkedAt, candidateSmoke.checkedAt,
    "planned candidate protection and smoke verification");
  assertFreshTransition(candidateSmoke.checkedAt, authorization.authorizedAt,
    "planned candidate smoke and owner authorization");
  assertFreshTransition(authorization.authorizedAt, currentPublicResolution.checkedAt,
    "planned authorization and final public-origin provider re-query");
  assertFreshTransition(currentPublicResolution.checkedAt, input.confirmedAt,
    "final planned public-origin provider re-query and mutation readiness");
  assertFreshTransition(currentPublicResolution.checkedAt, mutationControl.checkedAt,
    "planned public-origin resolution and Vercel mutation control");
  assertFreshTransition(mutationControl.checkedAt, input.confirmedAt,
    "planned Vercel mutation control and mutation readiness");
  assertFreshTransition(authorization.authorizedAt, input.confirmedAt,
    "planned public mutation authorization readiness");
  assertFreshTransition(candidateProtection.checkedAt, input.confirmedAt,
    "planned candidate protection and mutation readiness");
  assertFreshTransition(candidateSmoke.checkedAt, input.confirmedAt,
    "planned candidate smoke and mutation readiness");
  return withDigest(PLANNED_PUBLIC_MUTATION_READINESS_SCHEMA, {
    schemaVersion: PLANNED_PUBLIC_MUTATION_READINESS_SCHEMA,
    state: "fresh-planned-mutation-boundary",
    source: intent.source,
    target: intent.target,
    workflow: intent.workflow,
    currentDeployment: current,
    authorization,
    authorizationDigest: authorization.authorizationDigest,
    mutationIntentDigest: intent.mutationIntentDigest,
    currentPublicResolution,
    mutationControl,
    mutationControlDigest: mutationControl.mutationControlDigest,
    candidateDeployment: authorization.candidateDeployment,
    candidateProtectionEvidence: candidateProtection,
    candidateSmoke,
    confirmedAt: input.confirmedAt,
  }, "mutationReadinessDigest");
}

export function parsePlannedPublicMutationReadiness(value, {
  intent, authorization,
} = {}) {
  const readiness = exactKeys(value, [
    "schemaVersion", "state", "source", "target", "workflow", "currentDeployment",
    "authorization", "authorizationDigest", "mutationIntentDigest",
    "currentPublicResolution", "mutationControl", "mutationControlDigest",
    "candidateDeployment", "candidateProtectionEvidence", "candidateSmoke", "confirmedAt",
    "mutationReadinessDigest",
  ], "planned public mutation readiness");
  assert(readiness.schemaVersion === PLANNED_PUBLIC_MUTATION_READINESS_SCHEMA &&
    readiness.state === "fresh-planned-mutation-boundary",
  "planned public mutation readiness is invalid");
  exactSha256(readiness.authorizationDigest,
    "planned public mutation readiness authorizationDigest");
  exactSha256(readiness.mutationIntentDigest,
    "planned public mutation readiness mutationIntentDigest");
  const source = exactSource(readiness.source, "planned public mutation readiness source");
  const target = exactTarget(readiness.target, "planned public mutation readiness target");
  const workflow = exactWorkflow(readiness.workflow,
    "planned public mutation readiness workflow");
  const current = exactDeployment(readiness.currentDeployment,
    "planned public mutation readiness current deployment");
  const parsedAuthorization = parsePlannedDeployAuthorization(readiness.authorization);
  assert(parsedAuthorization.mutation === "promote-candidate" &&
    parsedAuthorization.authorizationDigest === readiness.authorizationDigest &&
    canonicalEqual(parsedAuthorization.source, source) &&
    canonicalEqual(parsedAuthorization.target, target) &&
    canonicalEqual(parsedAuthorization.workflow, workflow) &&
    sameImmutableDeployment(parsedAuthorization.currentDeployment, current),
  "planned public mutation readiness authorization differs");
  const candidate = exactDeployment(readiness.candidateDeployment,
    "planned public mutation readiness candidate");
  assert(sameImmutableDeployment(candidate, parsedAuthorization.candidateDeployment),
    "planned public mutation readiness candidate differs from its authorization");
  const protection = parseStageProtectionEvidence(readiness.candidateProtectionEvidence, {
    deployment: candidate,
  });
  const smoke = parseSmokeReceipt(readiness.candidateSmoke, { expectedMode: "planned" });
  assert(protection.projectProtection.projectId === target.projectId &&
    smoke.origin === candidate.url &&
    smoke.smokeDigest === parsedAuthorization.candidateSmokeDigest,
  "planned public mutation readiness candidate evidence differs");
  const resolution = parseVercelPublicDeploymentResolution(readiness.currentPublicResolution, {
    deployment: current,
    target,
  });
  const mutationControl = parseVercelMutationControlEvidence(readiness.mutationControl, {
    target,
  });
  exactSha256(readiness.mutationControlDigest,
    "planned public mutation readiness mutationControlDigest");
  assert(mutationControl.mutationAvailable &&
    mutationControl.mutationControlDigest === readiness.mutationControlDigest,
  "planned public mutation readiness has unavailable Vercel mutation control");
  assertMutationControlResolutionConsistency(mutationControl, resolution);
  assert(samePublicResolutionIdentity(
    resolution, parsedAuthorization.currentPublicResolution,
  ), "planned public mutation readiness resolution differs from its authorization");
  exactInstant(readiness.confirmedAt,
    "planned public mutation readiness confirmedAt");
  assertFreshTransition(protection.checkedAt, smoke.checkedAt,
    "parsed planned candidate protection and smoke");
  assertFreshTransition(smoke.checkedAt, parsedAuthorization.authorizedAt,
    "parsed planned candidate smoke and authorization");
  assertFreshTransition(parsedAuthorization.authorizedAt, resolution.checkedAt,
    "parsed planned authorization and public-origin provider re-query");
  assertFreshTransition(resolution.checkedAt, readiness.confirmedAt,
    "parsed planned public-origin provider re-query and readiness");
  assertFreshTransition(resolution.checkedAt, mutationControl.checkedAt,
    "parsed planned public-origin resolution and Vercel mutation control");
  assertFreshTransition(mutationControl.checkedAt, readiness.confirmedAt,
    "parsed planned Vercel mutation control and readiness");
  assertFreshTransition(protection.checkedAt, readiness.confirmedAt,
    "parsed planned candidate protection and readiness");
  assertFreshTransition(smoke.checkedAt, readiness.confirmedAt,
    "parsed planned candidate smoke and readiness");
  const { mutationReadinessDigest, ...withoutDigest } = readiness;
  assert(mutationReadinessDigest === canonicalSha256(
    PLANNED_PUBLIC_MUTATION_READINESS_SCHEMA, withoutDigest,
  ), "planned public mutation readiness digest is invalid");
  if (intent && authorization) {
    const parsedIntent = parsePublicMutationIntent(intent);
    const contextualAuthorization = parsePlannedDeployAuthorization(authorization);
    assert(contextualAuthorization.mutation === "promote-candidate" &&
      readiness.authorizationDigest === contextualAuthorization.authorizationDigest &&
      readiness.mutationIntentDigest === parsedIntent.mutationIntentDigest &&
      sameImmutableDeployment(candidate, parsedIntent.targetDeployment) &&
      canonicalEqual(contextualAuthorization.source, parsedIntent.source) &&
      canonicalEqual(contextualAuthorization.target, parsedIntent.target) &&
      canonicalEqual(contextualAuthorization.workflow, parsedIntent.workflow),
    "planned public mutation readiness differs from its intent or authorization");
  }
  return readiness;
}

function mutationIntentParts(input) {
  const operation = input.operation;
  assert(["deploy-planned", "promote", "rollback"].includes(operation),
    "public mutation intent operation is invalid");
  if (operation === "deploy-planned") {
    const authorization = parsePlannedDeployAuthorization(input.authorization);
    assert(authorization.mutation === "promote-candidate",
      "planned public mutation intent requires candidate-promotion authorization");
    const selectedSmoke = parseSmokeReceipt(input.selectedSmoke, {
      expectedMode: "planned",
    });
    assert(selectedSmoke.origin === authorization.candidateDeployment.url &&
      selectedSmoke.smokeDigest === authorization.candidateSmokeDigest,
    "planned public mutation intent candidate smoke differs from its authorization");
    return {
      source: authorization.source,
      target: authorization.target,
      workflow: authorization.workflow,
      currentDeployment: authorization.currentDeployment,
      currentPublicResolution: authorization.currentPublicResolution,
      targetDeployment: authorization.candidateDeployment,
      targetProtectionEvidence: authorization.candidateProtectionEvidence,
      targetSmokeDigest: selectedSmoke.smokeDigest,
      targetMode: "planned",
      planDigest: null,
      authorizationDigest: authorization.authorizationDigest,
      preMutationStateDigest: null,
      selectedBundleDigest: null,
      evidenceCheckedAt: selectedSmoke.checkedAt,
    };
  }
  const plan = operation === "promote"
    ? parsePromotionPlan(input.plan)
    : parseRollbackPlan(input.plan);
  const authorization = parsePublicAuthorization(input.authorization, { operation, plan });
  const state = parsePreMutationState(input.preMutationState, {
    operation,
    plan,
    selectedSmoke: input.selectedSmoke,
    selectedBundle: input.selectedBundle,
  });
  const selectedSmoke = parseSmokeReceipt(input.selectedSmoke, operation === "promote"
    ? { expectedMode: "live", expectedBundlePhase: "promotion", bundle: input.selectedBundle }
    : {
      expectedMode: plan.rollbackTarget.mode,
      ...(plan.rollbackTarget.mode === "live"
        ? { expectedBundlePhase: "promotion", bundle: input.selectedBundle }
        : {}),
    });
  return {
    source: plan.source,
    target: plan.target,
    workflow: authorization.workflow,
    currentDeployment: state.currentDeployment,
    currentPublicResolution: state.currentPublicResolution,
    targetDeployment: state.selectedDeployment,
    targetProtectionEvidence: state.selectedProtectionEvidence,
    targetSmokeDigest: selectedSmoke.smokeDigest,
    targetMode: operation === "promote" ? "live" : plan.rollbackTarget.mode,
    planDigest: operation === "promote" ? plan.promotionPlanDigest : plan.rollbackPlanDigest,
    authorizationDigest: authorization.authorizationDigest,
    preMutationStateDigest: state.preMutationStateDigest,
    selectedBundleDigest: operation === "promote"
      ? plan.promotionBundleDigest
      : plan.rollbackTarget.promotionBundleDigest,
    evidenceCheckedAt: state.checkedAt,
  };
}

export function createPublicMutationIntent(input) {
  const parts = mutationIntentParts(input);
  exactInstant(input.createdAt, "public mutation intent createdAt");
  assertFreshTransition(parts.evidenceCheckedAt, input.createdAt,
    "public mutation intent evidence sealing");
  const value = {
    schemaVersion: PUBLIC_MUTATION_INTENT_SCHEMA,
    state: "sealed-before-public-mutation",
    operation: input.operation,
    productionOrigin: PRODUCTION_ORIGIN,
    source: parts.source,
    target: parts.target,
    currentDeployment: parts.currentDeployment,
    currentPublicResolution: parts.currentPublicResolution,
    targetDeployment: parts.targetDeployment,
    targetProtectionEvidence: parts.targetProtectionEvidence,
    targetSmokeDigest: parts.targetSmokeDigest,
    evidenceCheckedAt: parts.evidenceCheckedAt,
    targetMode: parts.targetMode,
    planDigest: parts.planDigest,
    authorizationDigest: parts.authorizationDigest,
    preMutationStateDigest: parts.preMutationStateDigest,
    selectedBundleDigest: parts.selectedBundleDigest,
    workflow: parts.workflow,
    createdAt: input.createdAt,
  };
  return withDigest(PUBLIC_MUTATION_INTENT_SCHEMA, value, "mutationIntentDigest");
}

export function parsePublicMutationIntent(value, validation = {}) {
  const intent = exactKeys(value, [
    "schemaVersion", "state", "operation", "productionOrigin", "source", "target",
    "currentDeployment", "currentPublicResolution", "targetDeployment",
    "targetProtectionEvidence", "targetSmokeDigest", "evidenceCheckedAt", "targetMode", "planDigest",
    "authorizationDigest", "preMutationStateDigest", "selectedBundleDigest", "workflow",
    "createdAt", "mutationIntentDigest",
  ], "public mutation intent");
  assert(intent.schemaVersion === PUBLIC_MUTATION_INTENT_SCHEMA &&
    intent.state === "sealed-before-public-mutation" &&
    ["deploy-planned", "promote", "rollback"].includes(intent.operation) &&
    intent.productionOrigin === PRODUCTION_ORIGIN &&
    ["planned", "live"].includes(intent.targetMode),
  "public mutation intent is invalid");
  exactSource(intent.source, "public mutation intent source");
  exactTarget(intent.target, "public mutation intent target");
  exactDeployment(intent.currentDeployment, "public mutation intent current deployment");
  const currentResolution = parseVercelPublicDeploymentResolution(
    intent.currentPublicResolution, {
      deployment: intent.currentDeployment,
      target: intent.target,
    },
  );
  exactDeployment(intent.targetDeployment, "public mutation intent target deployment");
  assert(!sameImmutableDeployment(intent.currentDeployment, intent.targetDeployment),
    "public mutation intent source and target deployments must differ");
  const protection = parseStageProtectionEvidence(
    intent.targetProtectionEvidence, { deployment: intent.targetDeployment },
  );
  assert(protection.projectProtection.projectId === intent.target.projectId,
    "public mutation intent target protection differs from the protected project");
  exactSha256(intent.targetSmokeDigest, "public mutation intent targetSmokeDigest");
  exactInstant(intent.evidenceCheckedAt, "public mutation intent evidenceCheckedAt");
  assertFreshTransition(currentResolution.checkedAt, intent.evidenceCheckedAt,
    "public mutation intent current public resolution");
  assertFreshTransition(protection.checkedAt, intent.evidenceCheckedAt,
    "public mutation intent target protection");
  exactSha256(intent.authorizationDigest, "public mutation intent authorizationDigest");
  if (intent.operation === "deploy-planned") {
    assert(intent.targetMode === "planned" && intent.planDigest === null &&
      intent.preMutationStateDigest === null && intent.selectedBundleDigest === null,
    "planned public mutation intent contains live-release evidence");
  } else {
    exactSha256(intent.planDigest, "public mutation intent planDigest");
    exactSha256(intent.preMutationStateDigest,
      "public mutation intent preMutationStateDigest");
    if (intent.targetMode === "live") {
      exactSha256(intent.selectedBundleDigest,
        "public mutation intent selectedBundleDigest");
    } else {
      assert(intent.selectedBundleDigest === null,
        "planned rollback intent must not contain a promotion bundle digest");
    }
  }
  exactWorkflow(intent.workflow, "public mutation intent workflow");
  exactInstant(intent.createdAt, "public mutation intent createdAt");
  assertFreshTransition(intent.evidenceCheckedAt, intent.createdAt,
    "public mutation intent evidence sealing");
  const { mutationIntentDigest, ...withoutDigest } = intent;
  assert(mutationIntentDigest === canonicalSha256(PUBLIC_MUTATION_INTENT_SCHEMA, withoutDigest),
    "public mutation intent digest is invalid");
  if (validation.operation) {
    assert(intent.operation === validation.operation,
      "recovery artifact operation substitution detected");
    const recreated = createPublicMutationIntent({
      ...validation,
      operation: validation.operation,
      createdAt: intent.createdAt,
    });
    assert(recreated.mutationIntentDigest === intent.mutationIntentDigest,
      "recovery artifact substitution differs from the sealed mutation intent");
  }
  return intent;
}

function classifyRecoveryDeployment(current, intent) {
  if (sameImmutableDeployment(current, intent.currentDeployment)) return "old";
  if (sameImmutableDeployment(current, intent.targetDeployment)) return "target";
  throw new Error("public recovery found a third deployment state");
}

function parseRecoveryTargetEvidence(input, intent) {
  const targetDeployment = exactDeployment(input.targetDeployment,
    "recovery target deployment");
  assert(sameImmutableDeployment(targetDeployment, intent.targetDeployment),
    "recovery target provider readback differs from the immutable intent");
  const protection = parseStageProtectionEvidence(input.targetProtectionEvidence, {
    deployment: targetDeployment,
  });
  assert(protection.projectProtection.projectId === intent.target.projectId,
    "recovery target protection differs from the protected project");
  const selectedSmoke = parseSmokeReceipt(input.targetSmoke,
    intent.targetMode === "live"
      ? { expectedMode: "live", expectedBundlePhase: "promotion", bundle: input.selectedBundle }
      : { expectedMode: "planned" });
  assert(selectedSmoke.origin === targetDeployment.url,
    "recovery smoke did not target the exact intended deployment");
  if (intent.targetMode === "live") {
    assert(selectedSmoke.bundleDigest === intent.selectedBundleDigest,
      "recovery smoke differs from the immutable intended bundle");
  }
  return { targetDeployment, protection, selectedSmoke };
}

function parseRecoverySmokeEvidence(value, {
  intent, targetDeployment, selectedBundle,
} = {}) {
  const expectedMode = intent?.targetMode ?? value?.mode;
  assert(["planned", "live"].includes(expectedMode),
    "public mutation recovery smoke mode is invalid");
  const smoke = parseSmokeReceipt(value, expectedMode === "live"
    ? {
      expectedMode: "live",
      expectedBundlePhase: "promotion",
      ...(selectedBundle === undefined ? {} : { bundle: selectedBundle }),
    }
    : { expectedMode: "planned" });
  if (targetDeployment) assert(smoke.origin === targetDeployment.url,
    "public mutation recovery smoke differs from its target deployment");
  if (intent) {
    assert(smoke.mode === intent.targetMode &&
      (intent.targetMode === "live"
        ? smoke.bundleDigest === intent.selectedBundleDigest
        : smoke.bundleDigest === null),
    "public mutation recovery smoke differs from its immutable intent");
  }
  return smoke;
}

export function createPublicMutationRecoveryAttempt(input) {
  const intent = parsePublicMutationIntent(input.intent);
  const intentProvenance = parsePublicMutationIntentProvenance(
    input.intentProvenance, { intent },
  );
  const source = exactSource(input.source, "recovery workflow source");
  const workflow = exactRecoveryWorkflow(input.workflow);
  const owner = parseGitHubOwnerDispatchAuthorization(input.ownerDispatchAuthorization, {
    workflow,
    source,
  });
  const current = exactDeployment(input.currentDeployment,
    "recovery current public deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, { deployment: current, target: intent.target },
  );
  const classification = classifyRecoveryDeployment(current, intent);
  const targetEvidence = parseRecoveryTargetEvidence(input, intent);
  exactInstant(input.authorizedAt, "recovery attempt authorizedAt");
  assert(Date.parse(intentProvenance.completedAt) <= Date.parse(input.authorizedAt) &&
    Date.parse(input.authorizedAt) < Date.parse(intentProvenance.artifactExpiresAt),
  "recovery attempt is outside the authenticated intent artifact lifetime");
  assert(owner.observedAt === input.authorizedAt,
    "recovery attempt must use the freshly observed owner dispatch");
  assertFreshTransition(currentPublicResolution.checkedAt,
    targetEvidence.protection.checkedAt, "recovery public and target provider readbacks");
  assertFreshTransition(targetEvidence.protection.checkedAt,
    targetEvidence.selectedSmoke.checkedAt, "recovery target protection and smoke");
  assertFreshTransition(targetEvidence.selectedSmoke.checkedAt, input.authorizedAt,
    "recovery target smoke and owner authorization");
  assertFreshTransition(currentPublicResolution.checkedAt, input.authorizedAt,
    "recovery attempt total freshness");
  const value = {
    schemaVersion: PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA,
    state: "owner-authorized-recovery-attempt",
    operation: intent.operation,
    mutationIntentDigest: intent.mutationIntentDigest,
    intentProvenance,
    intentProvenanceDigest: intentProvenance.intentProvenanceDigest,
    classification,
    publicMutationRequired: classification === "old",
    source,
    target: intent.target,
    currentDeployment: current,
    currentPublicResolution,
    targetDeployment: targetEvidence.targetDeployment,
    targetProtectionEvidence: targetEvidence.protection,
    targetSmoke: targetEvidence.selectedSmoke,
    ownerDispatchAuthorization: owner,
    workflow,
    authorizedAt: input.authorizedAt,
  };
  return withDigest(PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA, value,
    "recoveryAttemptDigest");
}

export function parsePublicMutationRecoveryAttempt(value, { intent } = {}) {
  const attempt = exactKeys(value, [
    "schemaVersion", "state", "operation", "mutationIntentDigest", "classification",
    "intentProvenance", "intentProvenanceDigest", "publicMutationRequired",
    "source", "target", "currentDeployment",
    "currentPublicResolution", "targetDeployment", "targetProtectionEvidence",
    "targetSmoke", "ownerDispatchAuthorization", "workflow", "authorizedAt",
    "recoveryAttemptDigest",
  ], "public mutation recovery attempt");
  assert(attempt.schemaVersion === PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA &&
    attempt.state === "owner-authorized-recovery-attempt" &&
    ["deploy-planned", "promote", "rollback"].includes(attempt.operation) &&
    ["old", "target"].includes(attempt.classification) &&
    attempt.publicMutationRequired === (attempt.classification === "old"),
  "public mutation recovery attempt is invalid");
  exactSha256(attempt.mutationIntentDigest,
    "public mutation recovery attempt mutationIntentDigest");
  exactSha256(attempt.intentProvenanceDigest,
    "public mutation recovery attempt intentProvenanceDigest");
  const provenance = parsePublicMutationIntentProvenance(
    attempt.intentProvenance, intent ? { intent } : {},
  );
  assert(attempt.intentProvenanceDigest === provenance.intentProvenanceDigest,
    "public mutation recovery attempt provenance digest differs");
  exactSource(attempt.source, "public mutation recovery attempt source");
  exactTarget(attempt.target, "public mutation recovery attempt target");
  exactDeployment(attempt.currentDeployment,
    "public mutation recovery attempt current deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    attempt.currentPublicResolution, {
      deployment: attempt.currentDeployment,
      target: attempt.target,
    },
  );
  exactDeployment(attempt.targetDeployment,
    "public mutation recovery attempt target deployment");
  const protection = parseStageProtectionEvidence(attempt.targetProtectionEvidence, {
    deployment: attempt.targetDeployment,
  });
  assert(protection.projectProtection.projectId === attempt.target.projectId,
    "public mutation recovery attempt protection differs from its target");
  const targetSmoke = parseRecoverySmokeEvidence(attempt.targetSmoke, {
    intent,
    targetDeployment: attempt.targetDeployment,
  });
  const workflow = exactRecoveryWorkflow(attempt.workflow);
  const owner = parseGitHubOwnerDispatchAuthorization(
    attempt.ownerDispatchAuthorization, { workflow, source: attempt.source },
  );
  exactInstant(attempt.authorizedAt, "public mutation recovery attempt authorizedAt");
  assert(Date.parse(provenance.completedAt) <= Date.parse(attempt.authorizedAt) &&
    Date.parse(attempt.authorizedAt) < Date.parse(provenance.artifactExpiresAt),
  "public mutation recovery attempt is outside its intent artifact lifetime");
  assert(owner.observedAt === attempt.authorizedAt,
    "public mutation recovery attempt differs from its owner authorization");
  assertFreshTransition(publicResolution.checkedAt, protection.checkedAt,
    "public mutation recovery attempt provider readbacks");
  assertFreshTransition(protection.checkedAt, targetSmoke.checkedAt,
    "public mutation recovery attempt target smoke");
  assertFreshTransition(targetSmoke.checkedAt, attempt.authorizedAt,
    "public mutation recovery attempt authorization");
  assertFreshTransition(publicResolution.checkedAt, attempt.authorizedAt,
    "public mutation recovery attempt total freshness");
  const { recoveryAttemptDigest, ...withoutDigest } = attempt;
  assert(recoveryAttemptDigest === canonicalSha256(
    PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA, withoutDigest,
  ), "public mutation recovery attempt digest is invalid");
  if (intent) {
    const parsedIntent = parsePublicMutationIntent(intent);
    assert(attempt.operation === parsedIntent.operation &&
      attempt.mutationIntentDigest === parsedIntent.mutationIntentDigest &&
      attempt.intentProvenanceDigest === provenance.intentProvenanceDigest &&
      canonicalEqual(attempt.target, parsedIntent.target) &&
      sameImmutableDeployment(attempt.targetDeployment, parsedIntent.targetDeployment) &&
      attempt.classification === classifyRecoveryDeployment(
        attempt.currentDeployment, parsedIntent,
      ),
    "public mutation recovery attempt differs from the immutable intent");
  }
  return attempt;
}

export function validatePublicMutationRecoveryAttemptProvenance(value, {
  attempt, source, workflow, artifactArchive,
}) {
  const parsedAttempt = parsePublicMutationRecoveryAttempt(attempt);
  const parsedSource = exactSource(source,
    "public mutation recovery attempt artifact source");
  const parsedWorkflow = exactRecoveryWorkflow(workflow,
    "public mutation recovery attempt artifact workflow");
  assert(canonicalEqual(parsedAttempt.source, parsedSource) &&
    canonicalEqual(parsedAttempt.workflow, parsedWorkflow),
  "public mutation recovery attempt artifact differs from its producer");
  const artifactName =
    `developers-vercel-recovery-attempt-${parsedWorkflow.runId}-${parsedWorkflow.runAttempt}`;
  const artifact = validateGitHubArtifactEvidence(value, {
    name: artifactName,
    runId: parsedWorkflow.runId,
    runAttempt: parsedWorkflow.runAttempt,
    sourceRevision: parsedSource.revision,
  });
  const listing = plainObject(value,
    "public mutation recovery attempt artifact listing").artifacts;
  const rawArtifact = listing.find(({ id }) => String(id) === artifact.artifactId);
  exactSecondInstant(rawArtifact.created_at,
    "public mutation recovery attempt artifact created_at");
  exactSecondInstant(rawArtifact.updated_at,
    "public mutation recovery attempt artifact updated_at");
  exactSecondInstant(rawArtifact.expires_at,
    "public mutation recovery attempt artifact expires_at");
  assert(Date.parse(parsedAttempt.authorizedAt) <=
    Date.parse(rawArtifact.created_at) + 999 &&
    Date.parse(rawArtifact.updated_at) >= Date.parse(rawArtifact.created_at) &&
    Date.parse(rawArtifact.expires_at) > Date.parse(rawArtifact.updated_at),
  "public mutation recovery attempt artifact timestamps are invalid");
  const archiveBinding = verifyGitHubArtifactArchiveEntry(artifactArchive, {
    artifactDigest: artifact.artifactDigest,
    entryPath: "recovery-attempt.json",
    expectedBytes: canonicalArtifactBytes(parsedAttempt),
  });
  return withDigest(PUBLIC_MUTATION_RECOVERY_ATTEMPT_PROVENANCE_SCHEMA, {
    schemaVersion: PUBLIC_MUTATION_RECOVERY_ATTEMPT_PROVENANCE_SCHEMA,
    state: "durable-recovery-attempt-artifact",
    source: parsedSource,
    workflow: parsedWorkflow,
    artifact,
    ...archiveBinding,
    recoveryAttemptDigest: parsedAttempt.recoveryAttemptDigest,
    artifactCreatedAt: rawArtifact.created_at,
    artifactUpdatedAt: rawArtifact.updated_at,
    artifactExpiresAt: rawArtifact.expires_at,
  }, "recoveryAttemptProvenanceDigest");
}

export function parsePublicMutationRecoveryAttemptProvenance(value, { attempt } = {}) {
  const provenance = exactKeys(value, [
    "schemaVersion", "state", "source", "workflow", "artifact",
    "artifactArchiveDigest", "artifactEntryPath", "artifactEntrySha256",
    "recoveryAttemptDigest", "artifactCreatedAt", "artifactUpdatedAt",
    "artifactExpiresAt", "recoveryAttemptProvenanceDigest",
  ], "public mutation recovery attempt provenance");
  assert(provenance.schemaVersion ===
    PUBLIC_MUTATION_RECOVERY_ATTEMPT_PROVENANCE_SCHEMA &&
    provenance.state === "durable-recovery-attempt-artifact",
  "public mutation recovery attempt provenance is invalid");
  const source = exactSource(provenance.source,
    "public mutation recovery attempt provenance source");
  const workflow = exactRecoveryWorkflow(provenance.workflow,
    "public mutation recovery attempt provenance workflow");
  const artifact = parseGitHubArtifactEvidence(provenance.artifact);
  for (const key of [
    "artifactArchiveDigest", "artifactEntrySha256", "recoveryAttemptDigest",
  ]) exactSha256(provenance[key], `public mutation recovery attempt provenance ${key}`);
  for (const key of ["artifactCreatedAt", "artifactUpdatedAt", "artifactExpiresAt"]) {
    exactSecondInstant(provenance[key],
      `public mutation recovery attempt provenance ${key}`);
  }
  assert(artifact.runId === workflow.runId &&
    artifact.runAttempt === workflow.runAttempt &&
    artifact.sourceRevision === source.revision &&
    artifact.artifactName ===
      `developers-vercel-recovery-attempt-${workflow.runId}-${workflow.runAttempt}` &&
    provenance.artifactArchiveDigest === artifact.artifactDigest &&
    provenance.artifactEntryPath === "recovery-attempt.json" &&
    Date.parse(provenance.artifactUpdatedAt) >=
      Date.parse(provenance.artifactCreatedAt) &&
    Date.parse(provenance.artifactExpiresAt) > Date.parse(provenance.artifactUpdatedAt),
  "public mutation recovery attempt provenance bindings are invalid");
  const { recoveryAttemptProvenanceDigest, ...withoutDigest } = provenance;
  assert(recoveryAttemptProvenanceDigest === canonicalSha256(
    PUBLIC_MUTATION_RECOVERY_ATTEMPT_PROVENANCE_SCHEMA, withoutDigest,
  ), "public mutation recovery attempt provenance digest is invalid");
  if (attempt) {
    const parsedAttempt = parsePublicMutationRecoveryAttempt(attempt);
    assert(provenance.recoveryAttemptDigest === parsedAttempt.recoveryAttemptDigest &&
      provenance.artifactEntrySha256 ===
        sha256Bytes(canonicalArtifactBytes(parsedAttempt)) &&
      canonicalEqual(source, parsedAttempt.source) &&
      canonicalEqual(workflow, parsedAttempt.workflow) &&
      Date.parse(parsedAttempt.authorizedAt) <=
        Date.parse(provenance.artifactCreatedAt) + 999,
    "public mutation recovery attempt provenance differs from its exact attempt");
  }
  return provenance;
}

export function createPublicMutationRecoveryReadiness(input) {
  const intent = parsePublicMutationIntent(input.intent);
  const attempt = parsePublicMutationRecoveryAttempt(input.attempt, { intent });
  const attemptProvenance = parsePublicMutationRecoveryAttemptProvenance(
    input.attemptProvenance, { attempt },
  );
  const intentProvenance = parsePublicMutationIntentProvenance(
    input.intentProvenance, { intent },
  );
  assert(intentProvenance.intentProvenanceDigest === attempt.intentProvenanceDigest,
    "final recovery readiness changed the intent producer provenance");
  const source = exactSource(input.source, "recovery readiness workflow source");
  const workflow = exactRecoveryWorkflow(input.workflow);
  assert(canonicalEqual(source, attempt.source) &&
    canonicalEqual(workflow, attempt.workflow) &&
    canonicalEqual(source, attemptProvenance.source) &&
    canonicalEqual(workflow, attemptProvenance.workflow),
  "final recovery readiness differs from the durable recovery workflow");
  const owner = parseGitHubOwnerDispatchAuthorization(input.ownerDispatchAuthorization, {
    workflow,
    source,
  });
  const targetEvidence = parseRecoveryTargetEvidence(input, intent);
  const current = exactDeployment(input.currentDeployment,
    "recovery readiness current public deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, { deployment: current, target: intent.target },
  );
  const mutationControl = parseVercelMutationControlEvidence(input.mutationControl, {
    target: intent.target,
  });
  assert(mutationControl.mutationAvailable,
    "recovery found a pending or in-progress Vercel alias mutation");
  assertMutationControlResolutionConsistency(mutationControl, currentPublicResolution);
  const classification = classifyRecoveryDeployment(current, intent);
  assert(!(attempt.classification === "target" && classification === "old"),
    "recovery public state reversed from target to old after durable sealing");
  exactInstant(input.authorizedAt, "public mutation recovery readiness authorizedAt");
  assert(owner.observedAt === input.authorizedAt,
    "public mutation recovery readiness must use the freshly observed owner dispatch");
  exactInstant(input.confirmedAt, "public mutation recovery readiness confirmedAt");
  assert(Date.parse(input.authorizedAt) < Date.parse(intentProvenance.artifactExpiresAt) &&
    Date.parse(input.confirmedAt) < Date.parse(intentProvenance.artifactExpiresAt) &&
    Date.parse(attemptProvenance.artifactUpdatedAt) <=
      Date.parse(input.authorizedAt) + 999 &&
    Date.parse(input.confirmedAt) < Date.parse(attemptProvenance.artifactExpiresAt),
  "public mutation recovery readiness is outside its intent artifact lifetime");
  assertFreshTransition(targetEvidence.protection.checkedAt,
    targetEvidence.selectedSmoke.checkedAt,
    "public mutation recovery readiness target protection and smoke");
  assertFreshTransition(targetEvidence.selectedSmoke.checkedAt, input.authorizedAt,
    "public mutation recovery readiness owner authorization");
  assertFreshTransition(input.authorizedAt, currentPublicResolution.checkedAt,
    "public mutation recovery readiness final public-origin provider re-query");
  assertFreshTransition(currentPublicResolution.checkedAt, input.confirmedAt,
    "public mutation recovery readiness confirmation");
  assertFreshTransition(currentPublicResolution.checkedAt, mutationControl.checkedAt,
    "public mutation recovery resolution and Vercel mutation control");
  assertFreshTransition(mutationControl.checkedAt, input.confirmedAt,
    "public mutation recovery Vercel mutation control and confirmation");
  assertFreshTransition(targetEvidence.protection.checkedAt, input.confirmedAt,
    "public mutation recovery readiness total freshness");
  assertFreshTransition(input.authorizedAt, input.confirmedAt,
    "public mutation recovery authorization freshness");
  assertFreshTransition(attempt.authorizedAt, targetEvidence.protection.checkedAt,
    "durable recovery attempt and final target provider re-query");
  assertFreshTransition(attempt.authorizedAt, input.confirmedAt,
    "durable recovery attempt and final readiness");
  const value = {
    schemaVersion: PUBLIC_MUTATION_RECOVERY_READINESS_SCHEMA,
    state: "fresh-recovery-boundary",
    operation: intent.operation,
    mutationIntentDigest: intent.mutationIntentDigest,
    intentProvenanceDigest: intentProvenance.intentProvenanceDigest,
    recoveryAttemptDigest: attempt.recoveryAttemptDigest,
    attemptProvenance,
    recoveryAttemptProvenanceDigest:
      attemptProvenance.recoveryAttemptProvenanceDigest,
    classification,
    publicMutationRequired: classification === "old",
    source,
    target: intent.target,
    currentDeployment: current,
    currentPublicResolution,
    mutationControl,
    mutationControlDigest: mutationControl.mutationControlDigest,
    targetDeployment: targetEvidence.targetDeployment,
    targetProtectionEvidence: targetEvidence.protection,
    targetSmoke: targetEvidence.selectedSmoke,
    ownerDispatchAuthorization: owner,
    ownerDispatchAuthorizationDigest: owner.ownerDispatchAuthorizationDigest,
    workflow,
    authorizedAt: input.authorizedAt,
    confirmedAt: input.confirmedAt,
  };
  return withDigest(PUBLIC_MUTATION_RECOVERY_READINESS_SCHEMA, value,
    "recoveryReadinessDigest");
}

export function parsePublicMutationRecoveryReadiness(value, { intent, attempt } = {}) {
  const readiness = exactKeys(value, [
    "schemaVersion", "state", "operation", "mutationIntentDigest",
    "intentProvenanceDigest", "recoveryAttemptDigest", "classification",
    "attemptProvenance", "recoveryAttemptProvenanceDigest", "publicMutationRequired",
    "source", "target", "currentDeployment", "currentPublicResolution", "targetDeployment",
    "mutationControl", "mutationControlDigest", "targetProtectionEvidence", "targetSmoke",
    "ownerDispatchAuthorization", "ownerDispatchAuthorizationDigest",
    "workflow", "authorizedAt", "confirmedAt", "recoveryReadinessDigest",
  ], "public mutation recovery readiness");
  assert(readiness.schemaVersion === PUBLIC_MUTATION_RECOVERY_READINESS_SCHEMA &&
    readiness.state === "fresh-recovery-boundary" &&
    ["deploy-planned", "promote", "rollback"].includes(readiness.operation) &&
    ["old", "target"].includes(readiness.classification) &&
    readiness.publicMutationRequired === (readiness.classification === "old"),
  "public mutation recovery readiness is invalid");
  for (const key of [
    "mutationIntentDigest", "intentProvenanceDigest", "recoveryAttemptDigest",
    "recoveryAttemptProvenanceDigest", "mutationControlDigest",
    "ownerDispatchAuthorizationDigest",
  ]) exactSha256(readiness[key], `public mutation recovery readiness ${key}`);
  exactSource(readiness.source,
    "public mutation recovery readiness source");
  const target = exactTarget(readiness.target,
    "public mutation recovery readiness target");
  exactDeployment(readiness.currentDeployment,
    "public mutation recovery readiness current deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    readiness.currentPublicResolution, {
      deployment: readiness.currentDeployment,
      target,
    },
  );
  const mutationControl = parseVercelMutationControlEvidence(readiness.mutationControl, {
    target,
  });
  assert(mutationControl.mutationAvailable &&
    mutationControl.mutationControlDigest === readiness.mutationControlDigest,
  "public mutation recovery readiness has unavailable Vercel mutation control");
  assertMutationControlResolutionConsistency(mutationControl, publicResolution);
  exactDeployment(readiness.targetDeployment,
    "public mutation recovery readiness target deployment");
  const protection = parseStageProtectionEvidence(readiness.targetProtectionEvidence, {
    deployment: readiness.targetDeployment,
  });
  assert(protection.projectProtection.projectId === target.projectId,
    "public mutation recovery readiness protection differs from its target");
  const targetSmoke = parseRecoverySmokeEvidence(readiness.targetSmoke, {
    intent,
    targetDeployment: readiness.targetDeployment,
  });
  const workflow = exactRecoveryWorkflow(readiness.workflow);
  const attemptProvenance = parsePublicMutationRecoveryAttemptProvenance(
    readiness.attemptProvenance, attempt ? { attempt } : {},
  );
  assert(attemptProvenance.recoveryAttemptProvenanceDigest ===
    readiness.recoveryAttemptProvenanceDigest &&
    attemptProvenance.recoveryAttemptDigest === readiness.recoveryAttemptDigest &&
    canonicalEqual(attemptProvenance.source, readiness.source) &&
    canonicalEqual(attemptProvenance.workflow, workflow),
  "public mutation recovery readiness attempt provenance differs");
  const owner = parseGitHubOwnerDispatchAuthorization(
    readiness.ownerDispatchAuthorization, { workflow, source: readiness.source },
  );
  exactInstant(readiness.authorizedAt,
    "public mutation recovery readiness authorizedAt");
  exactInstant(readiness.confirmedAt,
    "public mutation recovery readiness confirmedAt");
  assert(owner.observedAt === readiness.authorizedAt &&
    owner.ownerDispatchAuthorizationDigest === readiness.ownerDispatchAuthorizationDigest &&
    Date.parse(attemptProvenance.artifactUpdatedAt) <=
      Date.parse(readiness.authorizedAt) + 999 &&
    Date.parse(readiness.confirmedAt) <
      Date.parse(attemptProvenance.artifactExpiresAt),
  "public mutation recovery readiness owner authorization differs");
  assertFreshTransition(protection.checkedAt,
    targetSmoke.checkedAt,
    "public mutation recovery readiness target smoke");
  assertFreshTransition(targetSmoke.checkedAt, readiness.authorizedAt,
    "public mutation recovery readiness authorization");
  assertFreshTransition(readiness.authorizedAt, publicResolution.checkedAt,
    "public mutation recovery readiness public-origin provider re-query");
  assertFreshTransition(publicResolution.checkedAt, readiness.confirmedAt,
    "public mutation recovery readiness confirmation");
  assertFreshTransition(publicResolution.checkedAt, mutationControl.checkedAt,
    "public mutation recovery readiness resolution and Vercel mutation control");
  assertFreshTransition(mutationControl.checkedAt, readiness.confirmedAt,
    "public mutation recovery readiness Vercel mutation control and confirmation");
  assertFreshTransition(protection.checkedAt, readiness.confirmedAt,
    "public mutation recovery readiness total freshness");
  assertFreshTransition(readiness.authorizedAt, readiness.confirmedAt,
    "public mutation recovery authorization freshness");
  const { recoveryReadinessDigest, ...withoutDigest } = readiness;
  assert(recoveryReadinessDigest === canonicalSha256(
    PUBLIC_MUTATION_RECOVERY_READINESS_SCHEMA, withoutDigest,
  ), "public mutation recovery readiness digest is invalid");
  if (intent) {
    const parsedIntent = parsePublicMutationIntent(intent);
    assert(readiness.operation === parsedIntent.operation &&
      readiness.mutationIntentDigest === parsedIntent.mutationIntentDigest &&
      canonicalEqual(readiness.target, parsedIntent.target) &&
      sameImmutableDeployment(readiness.targetDeployment, parsedIntent.targetDeployment) &&
      readiness.classification === classifyRecoveryDeployment(
        readiness.currentDeployment, parsedIntent,
      ),
    "public mutation recovery readiness differs from the immutable intent");
  }
  if (attempt) {
    const parsedAttempt = parsePublicMutationRecoveryAttempt(attempt, { intent });
    assert(Date.parse(readiness.authorizedAt) <
      Date.parse(parsedAttempt.intentProvenance.artifactExpiresAt) &&
      Date.parse(readiness.confirmedAt) <
      Date.parse(parsedAttempt.intentProvenance.artifactExpiresAt),
    "parsed public mutation recovery readiness is outside its intent artifact lifetime");
    assertFreshTransition(parsedAttempt.authorizedAt, protection.checkedAt,
      "durable recovery attempt and parsed target provider re-query");
    assertFreshTransition(parsedAttempt.authorizedAt, readiness.confirmedAt,
      "durable recovery attempt and parsed readiness");
    assert(readiness.recoveryAttemptDigest === parsedAttempt.recoveryAttemptDigest &&
      readiness.intentProvenanceDigest === parsedAttempt.intentProvenanceDigest &&
      canonicalEqual(readiness.source, parsedAttempt.source) &&
      canonicalEqual(readiness.workflow, parsedAttempt.workflow) &&
      !(parsedAttempt.classification === "target" && readiness.classification === "old"),
    "public mutation recovery readiness differs from its durable recovery attempt");
  }
  return readiness;
}

export function createPlannedDeployReceipt(input) {
  const intent = parsePublicMutationIntent(input.intent, input.intentValidation);
  assert(intent.operation === "deploy-planned",
    "planned deploy receipt requires a planned mutation intent");
  const deployment = exactDeployment(input.productionDeployment,
    "planned deploy receipt production deployment");
  assert(sameImmutableDeployment(deployment, intent.targetDeployment),
    "planned deploy receipt did not select the exact intended candidate");
  const publicResolution = parseVercelPublicDeploymentResolution(
    input.publicResolution, { deployment, target: intent.target },
  );
  const smoke = parseSmokeReceipt(input.productionSmoke, { expectedMode: "planned" });
  assert(smoke.origin === PRODUCTION_ORIGIN,
    "planned deploy receipt smoke did not target the public origin");
  const execution = input.recoveryReadiness ? "recovery" : "normal";
  const intentAuthorizationDigest = intent.authorizationDigest;
  let authorizationDigest;
  let mutationReadinessDigest = null;
  let recoveryAttemptDigest = null;
  let recoveryReadinessDigest = null;
  let intentProvenanceDigest = null;
  let startingClassification = "old";
  let publicMutationPerformed = true;
  let workflow;
  let readinessConfirmedAt;
  let recoveryIntent = null;
  let recoveryAttempt = null;
  let recoveryReadiness = null;
  if (execution === "recovery") {
    recoveryAttempt = parsePublicMutationRecoveryAttempt(input.recoveryAttempt, { intent });
    const readiness = parsePublicMutationRecoveryReadiness(input.recoveryReadiness, {
      intent, attempt: recoveryAttempt,
    });
    assert(readiness.operation === "deploy-planned",
      "planned deploy recovery readiness operation differs");
    authorizationDigest = readiness.ownerDispatchAuthorizationDigest;
    recoveryAttemptDigest = readiness.recoveryAttemptDigest;
    recoveryReadinessDigest = readiness.recoveryReadinessDigest;
    intentProvenanceDigest = readiness.intentProvenanceDigest;
    startingClassification = readiness.classification;
    publicMutationPerformed = readiness.publicMutationRequired;
    workflow = readiness.workflow;
    readinessConfirmedAt = readiness.confirmedAt;
    recoveryIntent = intent;
    recoveryReadiness = readiness;
  } else {
    const authorization = parsePlannedDeployAuthorization(input.authorization);
    const readiness = parsePlannedPublicMutationReadiness(input.mutationReadiness, {
      intent,
      authorization,
    });
    assert(authorization.mutation === "promote-candidate",
      "planned deploy receipt requires final candidate-promotion authorization");
    authorizationDigest = authorization.authorizationDigest;
    mutationReadinessDigest = readiness.mutationReadinessDigest;
    workflow = authorization.workflow;
    readinessConfirmedAt = readiness.confirmedAt;
  }
  exactInstant(input.completedAt, "planned deploy receipt completedAt");
  const earliest = readinessConfirmedAt;
  assertFreshTransition(earliest, publicResolution.checkedAt,
    "planned deployment public provider resolution");
  assertFreshTransition(publicResolution.checkedAt, smoke.checkedAt,
    "planned deployment public resolution and smoke");
  assertFreshTransition(smoke.checkedAt, input.completedAt,
    "planned deployment receipt sealing");
  assertFreshTransition(earliest, input.completedAt,
    "planned deployment total completion freshness");
  const value = {
    schemaVersion: PLANNED_DEPLOY_RECEIPT_SCHEMA,
    state: "planned-public-verified",
    publicAuthorization: false,
    publicWrites: false,
    source: intent.source,
    target: intent.target,
    deployment,
    publicResolution,
    previousDeployment: intent.currentDeployment,
    previousPublicResolution: intent.currentPublicResolution,
    productionSmokeDigest: smoke.smokeDigest,
    productionSmoke: smoke,
    intentAuthorizationDigest,
    authorizationDigest,
    mutationReadinessDigest,
    mutationIntentDigest: intent.mutationIntentDigest,
    intentProvenanceDigest,
    execution,
    recoveryAttemptDigest,
    recoveryReadinessDigest,
    recoveryIntent,
    recoveryAttempt,
    recoveryReadiness,
    startingClassification,
    publicMutationPerformed,
    workflow,
    completedAt: input.completedAt,
  };
  return withDigest(PLANNED_DEPLOY_RECEIPT_SCHEMA, value,
    "plannedDeployReceiptDigest");
}

export function parsePlannedDeployReceipt(value) {
  const receipt = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "source", "target",
    "deployment", "publicResolution", "previousDeployment", "previousPublicResolution",
    "productionSmokeDigest", "productionSmoke", "intentAuthorizationDigest", "authorizationDigest",
    "mutationReadinessDigest", "mutationIntentDigest", "intentProvenanceDigest",
    "execution", "recoveryAttemptDigest",
    "recoveryReadinessDigest", "recoveryIntent", "recoveryAttempt", "recoveryReadiness",
    "startingClassification",
    "publicMutationPerformed", "workflow", "completedAt", "plannedDeployReceiptDigest",
  ], "planned deploy receipt");
  assert(receipt.schemaVersion === PLANNED_DEPLOY_RECEIPT_SCHEMA &&
    receipt.state === "planned-public-verified" &&
    receipt.publicAuthorization === false && receipt.publicWrites === false &&
    ["normal", "recovery"].includes(receipt.execution) &&
    ["old", "target"].includes(receipt.startingClassification) &&
    receipt.publicMutationPerformed === (receipt.startingClassification === "old"),
  "planned deploy receipt is invalid");
  exactSource(receipt.source, "planned deploy receipt source");
  exactTarget(receipt.target, "planned deploy receipt target");
  exactDeployment(receipt.deployment, "planned deploy receipt deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(receipt.publicResolution, {
    deployment: receipt.deployment,
    target: receipt.target,
  });
  const productionSmoke = parseSmokeReceipt(receipt.productionSmoke, {
    expectedMode: "planned",
  });
  assert(productionSmoke.origin === PRODUCTION_ORIGIN &&
    productionSmoke.smokeDigest === receipt.productionSmokeDigest,
  "planned deploy receipt production smoke differs");
  exactDeployment(receipt.previousDeployment,
    "planned deploy receipt previous deployment");
  parseVercelPublicDeploymentResolution(receipt.previousPublicResolution, {
    deployment: receipt.previousDeployment,
    target: receipt.target,
  });
  for (const key of [
    "productionSmokeDigest", "intentAuthorizationDigest", "authorizationDigest",
    "mutationIntentDigest",
  ]) exactSha256(receipt[key], `planned deploy receipt ${key}`);
  if (receipt.execution === "recovery") {
    assert(receipt.mutationReadinessDigest === null,
      "planned recovery receipt contains normal mutation readiness");
    exactSha256(receipt.intentProvenanceDigest,
      "planned deploy receipt intentProvenanceDigest");
    exactSha256(receipt.recoveryAttemptDigest,
      "planned deploy receipt recoveryAttemptDigest");
    exactSha256(receipt.recoveryReadinessDigest,
      "planned deploy receipt recoveryReadinessDigest");
    exactRecoveryWorkflow(receipt.workflow);
    const intent = parsePublicMutationIntent(receipt.recoveryIntent);
    const attempt = parsePublicMutationRecoveryAttempt(receipt.recoveryAttempt, { intent });
    const readiness = parsePublicMutationRecoveryReadiness(
      receipt.recoveryReadiness, { intent, attempt },
    );
    assert(intent.operation === "deploy-planned" &&
      receipt.mutationIntentDigest === intent.mutationIntentDigest &&
      receipt.intentAuthorizationDigest === intent.authorizationDigest &&
      receipt.intentProvenanceDigest === attempt.intentProvenanceDigest &&
      receipt.recoveryAttemptDigest === attempt.recoveryAttemptDigest &&
      receipt.recoveryReadinessDigest === readiness.recoveryReadinessDigest &&
      receipt.authorizationDigest === readiness.ownerDispatchAuthorizationDigest &&
      receipt.startingClassification === readiness.classification &&
      receipt.publicMutationPerformed === readiness.publicMutationRequired &&
      canonicalEqual(receipt.source, intent.source) &&
      canonicalEqual(receipt.target, intent.target) &&
      canonicalEqual(receipt.workflow, readiness.workflow) &&
      sameImmutableDeployment(receipt.deployment, intent.targetDeployment) &&
      sameImmutableDeployment(receipt.previousDeployment, intent.currentDeployment),
    "planned recovery receipt differs from its exact recovery lineage");
    assertFreshTransition(readiness.confirmedAt, publicResolution.checkedAt,
      "planned recovery readiness and public provider resolution");
    assertFreshTransition(readiness.confirmedAt, receipt.completedAt,
      "planned recovery total completion freshness");
  } else {
    exactSha256(receipt.mutationReadinessDigest,
      "planned deploy receipt mutationReadinessDigest");
    assert(receipt.intentProvenanceDigest === null &&
      receipt.recoveryAttemptDigest === null &&
      receipt.recoveryReadinessDigest === null &&
      receipt.recoveryIntent === null &&
      receipt.recoveryAttempt === null &&
      receipt.recoveryReadiness === null &&
      receipt.startingClassification === "old" &&
      receipt.publicMutationPerformed === true,
    "normal planned deploy receipt contains recovery evidence");
    exactWorkflow(receipt.workflow);
  }
  exactInstant(receipt.completedAt, "planned deploy receipt completedAt");
  assertFreshTransition(publicResolution.checkedAt, receipt.completedAt,
    "planned deploy receipt public-origin resolution");
  assertFreshTransition(publicResolution.checkedAt, productionSmoke.checkedAt,
    "planned deploy receipt public-origin resolution and smoke");
  assertFreshTransition(productionSmoke.checkedAt, receipt.completedAt,
    "planned deploy receipt production smoke and sealing");
  const { plannedDeployReceiptDigest, ...withoutDigest } = receipt;
  assert(plannedDeployReceiptDigest === canonicalSha256(
    PLANNED_DEPLOY_RECEIPT_SCHEMA, withoutDigest,
  ), "planned deploy receipt digest is invalid");
  return receipt;
}

export function createPromotionReceipt(input) {
  const plan = parsePromotionPlan(input.plan, input.context);
  const authorization = parsePublicAuthorization(input.authorization, {
    operation: "promote", plan,
  });
  const deployment = exactDeployment(input.productionDeployment,
    "promoted Vercel deployment");
  assert(sameImmutableDeployment(deployment, plan.stagedDeployment),
    "public promotion did not select the exact staged deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    input.publicResolution, {
      deployment,
      target: plan.target,
    },
  );
  const preMutationState = parsePreMutationState(input.preMutationState, {
    operation: "promote", plan, selectedSmoke: input.selectedSmoke,
    selectedBundle: input.bundle,
  });
  const readiness = parsePublicMutationReadiness(input.mutationReadiness, {
    operation: "promote",
    plan,
    intent: input.intent,
    authorization: input.authorization,
    preMutationState: input.preMutationState,
    selectedSmoke: input.selectedSmoke,
    selectedBundle: input.bundle,
  });
  const smoke = parseSmokeReceipt(input.productionSmoke, {
    expectedMode: "live", expectedBundlePhase: "promotion", bundle: input.bundle,
  });
  assert(smoke.origin === PRODUCTION_ORIGIN,
    "post-promotion smoke did not target the public origin");
  exactInstant(input.promotedAt, "promotion receipt promotedAt");
  assertFreshTransition(readiness.confirmedAt, publicResolution.checkedAt,
    "Vercel promotion readiness and public provider resolution");
  assertFreshTransition(preMutationState.checkedAt, input.promotedAt,
    "Vercel public promotion");
  assertFreshTransition(preMutationState.checkedAt, publicResolution.checkedAt,
    "Vercel public promotion provider resolution");
  assertFreshTransition(publicResolution.checkedAt, smoke.checkedAt,
    "Vercel post-promotion public-origin resolution and smoke");
  assertFreshTransition(smoke.checkedAt, input.promotedAt,
    "Vercel post-promotion public smoke");
  const authorizationAge = Date.parse(authorization.authorizedAt) -
    Date.parse(preMutationState.checkedAt);
  assert(authorizationAge >= 0 && authorizationAge <= 30 * 60_000,
    "Vercel public promotion must re-query within 30 minutes of owner authorization");
  const value = {
    schemaVersion: PROMOTION_RECEIPT_SCHEMA,
    state: "promoted-live",
    publicAuthorization: true,
    publicWrites: true,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    stageBundleDigest: plan.stageBundleDigest,
    promotionBundleDigest: plan.promotionBundleDigest,
    promotionPlanDigest: plan.promotionPlanDigest,
    stageReceiptDigest: plan.stageReceiptDigest,
    authorizationDigest: authorization.authorizationDigest,
    preMutationStateDigest: preMutationState.preMutationStateDigest,
    mutationIntentDigest: readiness.mutationIntentDigest,
    mutationReadinessDigest: readiness.mutationReadinessDigest,
    indexerEvidence: plan.indexerEvidence,
    stagedSource: plan.stagedSource,
    source: plan.source,
    sourceTransition: plan.sourceTransition,
    target: plan.target,
    deployment,
    publicResolution,
    buildOutputDigest: plan.buildOutputDigest,
    stageArtifact: plan.stageArtifact,
    previousRelease: plan.previousRelease,
    previousPublicResolution: plan.previousPublicResolution,
    productionSmokeDigest: smoke.smokeDigest,
    workflow: exactWorkflow(input.workflow),
    promotedAt: input.promotedAt,
  };
  return withDigest(PROMOTION_RECEIPT_SCHEMA, value, "promotionReceiptDigest");
}

function parseStandardPromotionReceipt(value, { bundle, target } = {}) {
  const receipt = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "stageBundleDigest", "promotionBundleDigest", "promotionPlanDigest",
    "stageReceiptDigest",
    "authorizationDigest", "preMutationStateDigest", "mutationIntentDigest",
    "mutationReadinessDigest", "indexerEvidence", "stagedSource", "source", "sourceTransition",
    "target", "deployment", "publicResolution", "buildOutputDigest", "stageArtifact",
    "previousRelease", "previousPublicResolution", "productionSmokeDigest", "workflow",
    "promotedAt", "promotionReceiptDigest",
  ], "Vercel promotion receipt");
  assert(receipt.schemaVersion === PROMOTION_RECEIPT_SCHEMA &&
    receipt.state === "promoted-live" && receipt.publicAuthorization === true &&
    receipt.publicWrites === true && receipt.chainId === CHAIN_ID && receipt.caip2 === CAIP2 &&
    receipt.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Vercel promotion receipt is invalid");
  for (const [key, label] of [
    ["stageBundleDigest", "stageBundleDigest"],
    ["promotionBundleDigest", "promotionBundleDigest"],
    ["promotionPlanDigest", "promotionPlanDigest"],
    ["stageReceiptDigest", "stageReceiptDigest"],
    ["authorizationDigest", "authorizationDigest"],
    ["preMutationStateDigest", "preMutationStateDigest"],
    ["mutationIntentDigest", "mutationIntentDigest"],
    ["mutationReadinessDigest", "mutationReadinessDigest"],
    ["productionSmokeDigest", "productionSmokeDigest"],
  ]) exactSha256(receipt[key], `Vercel promotion receipt ${label}`);
  const indexerEvidence = parseIndexerPromotionEvidenceBinding(receipt.indexerEvidence);
  assert(indexerEvidence.promotionBundleDigest === receipt.promotionBundleDigest,
    "Vercel promotion receipt Indexer evidence differs from the promotion bundle");
  exactSource(receipt.stagedSource, "Vercel promotion receipt stagedSource");
  exactSource(receipt.source, "Vercel promotion receipt source");
  const sourceTransition = parseEvidenceOnlySourceTransition(receipt.sourceTransition);
  assert(canonicalEqual(sourceTransition.stagedSource, receipt.stagedSource) &&
    canonicalEqual(sourceTransition.promotionSource, receipt.source),
  "Vercel promotion receipt source transition differs from its sources");
  exactTarget(receipt.target, "Vercel promotion receipt target");
  exactDeployment(receipt.deployment, "Vercel promotion receipt deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    receipt.publicResolution, {
      deployment: receipt.deployment,
      target: receipt.target,
    },
  );
  exactSha256(receipt.buildOutputDigest, "Vercel promotion receipt buildOutputDigest");
  assert(receipt.buildOutputDigest === sourceTransition.buildOutputDigest,
    "Vercel promotion receipt source transition changed the staged build output");
  const stageArtifact = parseGitHubArtifactEvidence(receipt.stageArtifact);
  assert(stageArtifact.sourceRevision === receipt.stagedSource.revision,
    "Vercel promotion receipt stage artifact differs from the staged source");
  exactPreviousRelease(receipt.previousRelease, "Vercel promotion receipt previousRelease");
  parseVercelPublicDeploymentResolution(receipt.previousPublicResolution, {
    deployment: receipt.previousRelease.deployment,
    target: receipt.target,
  });
  exactWorkflow(receipt.workflow, "Vercel promotion receipt workflow");
  exactInstant(receipt.promotedAt, "Vercel promotion receipt promotedAt");
  assertFreshTransition(publicResolution.checkedAt, receipt.promotedAt,
    "Vercel promotion receipt public-origin resolution");
  const { promotionReceiptDigest, ...withoutDigest } = receipt;
  assert(promotionReceiptDigest === canonicalSha256(PROMOTION_RECEIPT_SCHEMA, withoutDigest),
    "Vercel promotion receipt digest is invalid");
  if (bundle) assert(receipt.promotionBundleDigest ===
    parsePromotionBundle(bundle).promotionBundleDigest,
  "Vercel promotion receipt differs from its finalized promotion bundle");
  if (target) assert(canonicalEqual(receipt.target, exactTarget(target)),
    "Vercel promotion receipt differs from the protected target");
  return receipt;
}

export function createRecoveredPromotionReceipt(input) {
  const intent = parsePublicMutationIntent(input.intent, {
    operation: "promote",
    plan: input.plan,
    authorization: input.intentAuthorization,
    preMutationState: input.intentPreMutationState,
    selectedSmoke: input.intentSelectedSmoke,
    selectedBundle: input.bundle,
  });
  const plan = parsePromotionPlan(input.plan);
  const attempt = parsePublicMutationRecoveryAttempt(input.recoveryAttempt, { intent });
  const readiness = parsePublicMutationRecoveryReadiness(input.recoveryReadiness, {
    intent,
    attempt,
  });
  assert(readiness.operation === "promote",
    "recovered promotion readiness operation differs");
  const deployment = exactDeployment(input.productionDeployment,
    "recovered promoted Vercel deployment");
  assert(sameImmutableDeployment(deployment, plan.stagedDeployment) &&
    sameImmutableDeployment(deployment, intent.targetDeployment),
  "recovered promotion did not select the exact staged deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    input.publicResolution, { deployment, target: plan.target },
  );
  const smoke = parseSmokeReceipt(input.productionSmoke, {
    expectedMode: "live", expectedBundlePhase: "promotion", bundle: input.bundle,
  });
  assert(smoke.origin === PRODUCTION_ORIGIN,
    "recovered promotion smoke did not target the public origin");
  exactInstant(input.promotedAt, "recovered promotion receipt promotedAt");
  assertFreshTransition(readiness.confirmedAt, publicResolution.checkedAt,
    "recovered promotion provider resolution");
  assertFreshTransition(publicResolution.checkedAt, smoke.checkedAt,
    "recovered promotion public resolution and smoke");
  assertFreshTransition(smoke.checkedAt, input.promotedAt,
    "recovered promotion receipt sealing");
  assertFreshTransition(readiness.confirmedAt, input.promotedAt,
    "recovered promotion total completion freshness");
  const value = {
    schemaVersion: RECOVERED_PROMOTION_RECEIPT_SCHEMA,
    state: "promoted-live",
    publicAuthorization: true,
    publicWrites: true,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    stageBundleDigest: plan.stageBundleDigest,
    promotionBundleDigest: plan.promotionBundleDigest,
    promotionPlanDigest: plan.promotionPlanDigest,
    stageReceiptDigest: plan.stageReceiptDigest,
    authorizationDigest: readiness.ownerDispatchAuthorizationDigest,
    preMutationStateDigest: intent.preMutationStateDigest,
    indexerEvidence: plan.indexerEvidence,
    stagedSource: plan.stagedSource,
    source: attempt.source,
    deploymentSource: plan.source,
    recoverySource: attempt.source,
    sourceTransition: plan.sourceTransition,
    target: plan.target,
    deployment,
    publicResolution,
    buildOutputDigest: plan.buildOutputDigest,
    stageArtifact: plan.stageArtifact,
    previousRelease: plan.previousRelease,
    previousPublicResolution: plan.previousPublicResolution,
    productionSmokeDigest: smoke.smokeDigest,
    productionSmoke: smoke,
    originalWorkflow: intent.workflow,
    workflow: readiness.workflow,
    recoveryIntent: intent,
    recoveryAttempt: attempt,
    recoveryReadiness: readiness,
    mutationIntentDigest: intent.mutationIntentDigest,
    intentProvenanceDigest: readiness.intentProvenanceDigest,
    recoveryAttemptDigest: attempt.recoveryAttemptDigest,
    recoveryReadinessDigest: readiness.recoveryReadinessDigest,
    recoveryClassification: readiness.classification,
    publicMutationPerformed: readiness.publicMutationRequired,
    promotedAt: input.promotedAt,
  };
  return withDigest(RECOVERED_PROMOTION_RECEIPT_SCHEMA, value,
    "promotionReceiptDigest");
}

function parseRecoveredPromotionReceipt(value, { bundle, target } = {}) {
  const receipt = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "stageBundleDigest", "promotionBundleDigest",
    "promotionPlanDigest", "stageReceiptDigest", "authorizationDigest",
    "preMutationStateDigest", "indexerEvidence", "stagedSource", "source",
    "deploymentSource", "recoverySource", "sourceTransition", "target", "deployment", "publicResolution",
    "buildOutputDigest", "stageArtifact", "previousRelease", "previousPublicResolution",
    "productionSmokeDigest", "productionSmoke", "originalWorkflow", "workflow",
    "recoveryIntent", "recoveryAttempt", "recoveryReadiness", "mutationIntentDigest",
    "intentProvenanceDigest", "recoveryAttemptDigest", "recoveryReadinessDigest",
    "recoveryClassification",
    "publicMutationPerformed", "promotedAt", "promotionReceiptDigest",
  ], "recovered Vercel promotion receipt");
  assert(receipt.schemaVersion === RECOVERED_PROMOTION_RECEIPT_SCHEMA &&
    receipt.state === "promoted-live" && receipt.publicAuthorization === true &&
    receipt.publicWrites === true && receipt.chainId === CHAIN_ID &&
    receipt.caip2 === CAIP2 && receipt.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    ["old", "target"].includes(receipt.recoveryClassification) &&
    receipt.publicMutationPerformed === (receipt.recoveryClassification === "old"),
  "recovered Vercel promotion receipt is invalid");
  for (const key of [
    "stageBundleDigest", "promotionBundleDigest", "promotionPlanDigest",
    "stageReceiptDigest", "authorizationDigest", "preMutationStateDigest",
    "buildOutputDigest", "productionSmokeDigest", "mutationIntentDigest",
    "intentProvenanceDigest", "recoveryAttemptDigest", "recoveryReadinessDigest",
  ]) exactSha256(receipt[key], `recovered Vercel promotion receipt ${key}`);
  const indexerEvidence = parseIndexerPromotionEvidenceBinding(receipt.indexerEvidence);
  assert(indexerEvidence.promotionBundleDigest === receipt.promotionBundleDigest,
    "recovered promotion receipt Indexer evidence differs from its bundle");
  exactSource(receipt.stagedSource, "recovered promotion staged source");
  exactSource(receipt.source, "recovered promotion receipt source");
  exactSource(receipt.deploymentSource, "recovered promotion deployment source");
  exactSource(receipt.recoverySource, "recovered promotion recovery source");
  assert(canonicalEqual(receipt.source, receipt.recoverySource),
    "recovered promotion receipt source differs from its recovery source");
  const transition = parseEvidenceOnlySourceTransition(receipt.sourceTransition);
  assert(canonicalEqual(transition.stagedSource, receipt.stagedSource) &&
    canonicalEqual(transition.promotionSource, receipt.deploymentSource) &&
    transition.buildOutputDigest === receipt.buildOutputDigest,
  "recovered promotion receipt source transition differs");
  exactTarget(receipt.target, "recovered promotion target");
  exactDeployment(receipt.deployment, "recovered promotion deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(receipt.publicResolution, {
    deployment: receipt.deployment,
    target: receipt.target,
  });
  const productionSmoke = parseSmokeReceipt(receipt.productionSmoke, {
    expectedMode: "live", expectedBundlePhase: "promotion",
    ...(bundle ? { bundle } : {}),
  });
  assert(productionSmoke.origin === PRODUCTION_ORIGIN &&
    productionSmoke.smokeDigest === receipt.productionSmokeDigest,
  "recovered promotion receipt production smoke differs");
  const stageArtifact = parseGitHubArtifactEvidence(receipt.stageArtifact);
  assert(stageArtifact.sourceRevision === receipt.stagedSource.revision,
    "recovered promotion receipt stage artifact differs from its staged source");
  exactPreviousRelease(receipt.previousRelease,
    "recovered promotion previous release");
  parseVercelPublicDeploymentResolution(receipt.previousPublicResolution, {
    deployment: receipt.previousRelease.deployment,
    target: receipt.target,
  });
  exactWorkflow(receipt.originalWorkflow, "recovered promotion original workflow");
  exactRecoveryWorkflow(receipt.workflow, "recovered promotion workflow");
  const intent = parsePublicMutationIntent(receipt.recoveryIntent);
  const attempt = parsePublicMutationRecoveryAttempt(receipt.recoveryAttempt, { intent });
  const readiness = parsePublicMutationRecoveryReadiness(
    receipt.recoveryReadiness, { intent, attempt },
  );
  assert(intent.operation === "promote" &&
    intent.planDigest === receipt.promotionPlanDigest &&
    intent.preMutationStateDigest === receipt.preMutationStateDigest &&
    intent.selectedBundleDigest === receipt.promotionBundleDigest &&
    receipt.mutationIntentDigest === intent.mutationIntentDigest &&
    receipt.intentProvenanceDigest === attempt.intentProvenanceDigest &&
    receipt.recoveryAttemptDigest === attempt.recoveryAttemptDigest &&
    receipt.recoveryReadinessDigest === readiness.recoveryReadinessDigest &&
    receipt.authorizationDigest === readiness.ownerDispatchAuthorizationDigest &&
    receipt.recoveryClassification === readiness.classification &&
    receipt.publicMutationPerformed === readiness.publicMutationRequired &&
    canonicalEqual(receipt.deploymentSource, intent.source) &&
    canonicalEqual(receipt.source, attempt.source) &&
    canonicalEqual(receipt.recoverySource, attempt.source) &&
    canonicalEqual(receipt.target, intent.target) &&
    canonicalEqual(receipt.originalWorkflow, intent.workflow) &&
    canonicalEqual(receipt.workflow, readiness.workflow) &&
    sameImmutableDeployment(receipt.deployment, intent.targetDeployment),
  "recovered promotion receipt differs from its exact recovery lineage");
  exactInstant(receipt.promotedAt, "recovered promotion promotedAt");
  assertFreshTransition(readiness.confirmedAt, publicResolution.checkedAt,
    "recovered promotion readiness and public provider resolution");
  assertFreshTransition(publicResolution.checkedAt, productionSmoke.checkedAt,
    "recovered promotion public resolution and smoke");
  assertFreshTransition(productionSmoke.checkedAt, receipt.promotedAt,
    "recovered promotion smoke and receipt sealing");
  assertFreshTransition(readiness.confirmedAt, receipt.promotedAt,
    "recovered promotion total completion freshness");
  assertFreshTransition(publicResolution.checkedAt, receipt.promotedAt,
    "recovered promotion receipt public-origin resolution");
  const { promotionReceiptDigest, ...withoutDigest } = receipt;
  assert(promotionReceiptDigest === canonicalSha256(
    RECOVERED_PROMOTION_RECEIPT_SCHEMA, withoutDigest,
  ), "recovered Vercel promotion receipt digest is invalid");
  if (bundle) assert(receipt.promotionBundleDigest ===
    parsePromotionBundle(bundle).promotionBundleDigest,
  "recovered Vercel promotion receipt differs from its bundle");
  if (target) assert(canonicalEqual(receipt.target, exactTarget(target)),
    "recovered Vercel promotion receipt differs from the protected target");
  return receipt;
}

export function parsePromotionReceipt(value, options = {}) {
  if (value?.schemaVersion === RECOVERED_PROMOTION_RECEIPT_SCHEMA) {
    return parseRecoveredPromotionReceipt(value, options);
  }
  return parseStandardPromotionReceipt(value, options);
}

export function createRollbackPlan(input) {
  const promotion = parsePromotionReceipt(input.promotionReceipt, {
    bundle: input.bundle, target: input.target,
  });
  const currentDeployment = exactDeployment(input.currentDeployment,
    "rollback plan current deployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    input.currentPublicResolution, {
      deployment: currentDeployment,
      target: promotion.target,
    },
  );
  const currentSmoke = parseSmokeReceipt(input.currentSmoke, {
    expectedMode: "live", expectedBundlePhase: "promotion", bundle: input.bundle,
  });
  assert(currentSmoke.origin === PRODUCTION_ORIGIN &&
    sameImmutableDeployment(currentDeployment, promotion.deployment),
  "rollback plan current production differs from the promotion receipt");
  const promotionArtifact = parseGitHubArtifactEvidence(input.promotionArtifact);
  const promotionArtifactBinding = verifyGitHubArtifactArchiveEntry(
    input.promotionArtifactArchive, {
      artifactDigest: promotionArtifact.artifactDigest,
      entryPath: "promotion-receipt.json",
      expectedBytes: canonicalArtifactBytes(promotion),
    },
  );
  const promotionRun = parseGitHubRunEvidence(input.promotionRun);
  const promotionArtifactSource = promotion.source;
  assert(promotionRun.runId === promotion.workflow.runId &&
    promotionRun.runAttempt === promotion.workflow.runAttempt &&
    promotionRun.workflowRef === promotion.workflow.workflowRef &&
    promotionRun.actor === promotion.workflow.actor &&
    promotionRun.actorId === promotion.workflow.actorId &&
    promotionRun.sourceRevision === promotionArtifactSource.revision &&
    promotionRun.sourceTree === promotionArtifactSource.tree &&
    promotionArtifact.runId === promotionRun.runId &&
    promotionArtifact.runAttempt === promotionRun.runAttempt &&
    promotionArtifact.runAttempt === promotion.workflow.runAttempt &&
    promotionArtifact.sourceRevision === promotionArtifactSource.revision &&
    promotionArtifact.artifactName ===
      `developers-vercel-promotion-${promotion.workflow.runId}-${promotion.workflow.runAttempt}`,
  "rollback plan promotion artifact differs from the promotion receipt workflow");
  const previousBundle = promotion.previousRelease.mode === "live"
    ? input.previousBundle
    : undefined;
  const targetSmoke = parseSmokeReceipt(input.targetSmoke, {
    expectedMode: promotion.previousRelease.mode,
    ...(previousBundle
      ? { expectedBundlePhase: "promotion", bundle: previousBundle }
      : {}),
  });
  assert(targetSmoke.origin === promotion.previousRelease.deployment.url,
    "rollback target smoke did not use the exact prior deployment URL");
  const targetDeployment = exactDeployment(input.targetDeployment,
    "rollback plan target deployment");
  assert(sameImmutableDeployment(targetDeployment,
    promotion.previousRelease.deployment),
  "rollback plan target differs from the exact prior deployment");
  assert(currentPublicResolution.deploymentId !== targetDeployment.id &&
    currentPublicResolution.deploymentUrl !== targetDeployment.url,
  "rollback plan public origin already selects the rollback target");
  const targetProtectionEvidence = parseStageProtectionEvidence(
    input.targetProtectionEvidence, { deployment: targetDeployment },
  );
  assert(targetProtectionEvidence.projectProtection.projectId === promotion.target.projectId,
    "rollback plan target protection evidence is for a different project");
  exactInstant(input.preparedAt, "rollback plan preparedAt");
  assertFreshTransition(targetProtectionEvidence.checkedAt, targetSmoke.checkedAt,
    "rollback plan target protection and smoke verification");
  assertFreshTransition(targetSmoke.checkedAt, input.preparedAt,
    "rollback plan target smoke verification");
  assertFreshTransition(currentPublicResolution.checkedAt, currentSmoke.checkedAt,
    "rollback plan current public-origin resolution and smoke");
  assertFreshTransition(currentSmoke.checkedAt, input.preparedAt,
    "rollback plan current public smoke verification");
  const value = {
    schemaVersion: ROLLBACK_PLAN_SCHEMA,
    state: "ready-awaiting-owner-authorization",
    publicAuthorization: false,
    publicWrites: false,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    stageBundleDigest: promotion.stageBundleDigest,
    promotionBundleDigest: promotion.promotionBundleDigest,
    promotionReceiptDigest: promotion.promotionReceiptDigest,
    promotionReceipt: promotion,
    promotionRun,
    promotionArtifact,
    promotionArtifactArchiveDigest: promotionArtifactBinding.artifactArchiveDigest,
    promotionArtifactEntryPath: promotionArtifactBinding.artifactEntryPath,
    promotionArtifactEntrySha256: promotionArtifactBinding.artifactEntrySha256,
    indexerEvidence: promotion.indexerEvidence,
    source: promotion.source,
    target: promotion.target,
    currentDeployment,
    currentPublicResolution,
    currentSmokeDigest: currentSmoke.smokeDigest,
    rollbackTarget: promotion.previousRelease,
    rollbackDeployment: targetDeployment,
    targetSmokeDigest: targetSmoke.smokeDigest,
    targetProtectionEvidence,
    workflow: exactWorkflow(input.workflow),
    preparedAt: input.preparedAt,
  };
  return withDigest(ROLLBACK_PLAN_SCHEMA, value, "rollbackPlanDigest");
}

export function parseRollbackPlan(value, { bundle, promotionReceipt, target } = {}) {
  const plan = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "stageBundleDigest", "promotionBundleDigest",
    "promotionReceiptDigest", "promotionReceipt", "promotionRun", "promotionArtifact",
    "promotionArtifactArchiveDigest", "promotionArtifactEntryPath",
    "promotionArtifactEntrySha256",
    "indexerEvidence",
    "source", "target", "currentDeployment", "currentPublicResolution",
    "currentSmokeDigest", "rollbackTarget", "rollbackDeployment", "targetSmokeDigest",
    "targetProtectionEvidence", "workflow",
    "preparedAt", "rollbackPlanDigest",
  ], "Vercel rollback plan");
  assert(plan.schemaVersion === ROLLBACK_PLAN_SCHEMA &&
    plan.state === "ready-awaiting-owner-authorization" &&
    plan.publicAuthorization === false && plan.publicWrites === false &&
    plan.chainId === CHAIN_ID && plan.caip2 === CAIP2 &&
    plan.chainDeploymentId === CHAIN_DEPLOYMENT_ID,
  "Vercel rollback plan must remain non-authorizing");
  exactSha256(plan.stageBundleDigest, "Vercel rollback plan stageBundleDigest");
  exactSha256(plan.promotionBundleDigest, "Vercel rollback plan promotionBundleDigest");
  exactSha256(plan.promotionReceiptDigest, "Vercel rollback plan promotionReceiptDigest");
  exactSha256(plan.promotionArtifactArchiveDigest,
    "Vercel rollback plan promotionArtifactArchiveDigest");
  exactSha256(plan.promotionArtifactEntrySha256,
    "Vercel rollback plan promotionArtifactEntrySha256");
  const promotionRun = parseGitHubRunEvidence(plan.promotionRun);
  const promotionArtifact = parseGitHubArtifactEvidence(plan.promotionArtifact);
  const promotion = parsePromotionReceipt(plan.promotionReceipt, {
    ...(bundle ? { bundle } : {}),
    target: plan.target,
  });
  const indexerEvidence = parseIndexerPromotionEvidenceBinding(plan.indexerEvidence);
  assert(indexerEvidence.promotionBundleDigest === plan.promotionBundleDigest,
    "Vercel rollback plan Indexer evidence differs from the promotion bundle");
  exactSource(plan.source, "Vercel rollback plan source");
  assert(promotionRun.runId === promotionArtifact.runId &&
    promotionRun.runAttempt === promotionArtifact.runAttempt &&
    promotionRun.sourceRevision === promotionArtifact.sourceRevision &&
    promotionRun.sourceRevision === plan.source.revision &&
    promotionRun.sourceTree === plan.source.tree &&
    plan.promotionReceiptDigest === promotion.promotionReceiptDigest &&
    plan.promotionArtifactArchiveDigest === promotionArtifact.artifactDigest &&
    plan.promotionArtifactEntryPath === "promotion-receipt.json" &&
    plan.promotionArtifactEntrySha256 ===
      sha256Bytes(canonicalArtifactBytes(promotion)) &&
    canonicalEqual(promotion.source, plan.source) &&
    canonicalEqual(promotion.target, plan.target),
  "Vercel rollback plan promotion evidence differs from its source");
  exactTarget(plan.target, "Vercel rollback plan target");
  exactDeployment(plan.currentDeployment, "Vercel rollback plan currentDeployment");
  const currentPublicResolution = parseVercelPublicDeploymentResolution(
    plan.currentPublicResolution, {
      deployment: plan.currentDeployment,
      target: plan.target,
    },
  );
  exactSha256(plan.currentSmokeDigest, "Vercel rollback plan currentSmokeDigest");
  exactPreviousRelease(plan.rollbackTarget, "Vercel rollback plan rollbackTarget");
  exactDeployment(plan.rollbackDeployment,
    "Vercel rollback plan rollbackDeployment");
  assert(sameImmutableDeployment(plan.rollbackDeployment, plan.rollbackTarget.deployment),
    "Vercel rollback plan provider target differs from the historical release");
  assert(currentPublicResolution.deploymentId !== plan.rollbackDeployment.id &&
    currentPublicResolution.deploymentUrl !== plan.rollbackDeployment.url,
  "Vercel rollback plan public origin selects the rollback target");
  exactSha256(plan.targetSmokeDigest, "Vercel rollback plan targetSmokeDigest");
  const targetProtectionEvidence = parseStageProtectionEvidence(
    plan.targetProtectionEvidence, { deployment: plan.rollbackDeployment },
  );
  assert(targetProtectionEvidence.projectProtection.projectId === plan.target.projectId,
    "Vercel rollback plan target protection evidence is for a different project");
  exactWorkflow(plan.workflow, "Vercel rollback plan workflow");
  exactInstant(plan.preparedAt, "Vercel rollback plan preparedAt");
  assertFreshTransition(targetProtectionEvidence.checkedAt, plan.preparedAt,
    "Vercel rollback plan target protection verification");
  assertFreshTransition(currentPublicResolution.checkedAt, plan.preparedAt,
    "Vercel rollback plan current public-origin verification");
  const { rollbackPlanDigest, ...withoutDigest } = plan;
  assert(rollbackPlanDigest === canonicalSha256(ROLLBACK_PLAN_SCHEMA, withoutDigest),
    "Vercel rollback plan digest is invalid");
  if (bundle) assert(plan.promotionBundleDigest ===
    parsePromotionBundle(bundle).promotionBundleDigest,
  "Vercel rollback plan differs from the current finalized promotion bundle");
  if (promotionReceipt) assert(canonicalEqual(plan.promotionReceipt,
    parsePromotionReceipt(promotionReceipt, { bundle, target })),
  "Vercel rollback plan differs from the promotion receipt");
  if (target) assert(canonicalEqual(plan.target, exactTarget(target)),
    "Vercel rollback plan differs from the protected target");
  return plan;
}

export function createRollbackReceipt(input) {
  const plan = parseRollbackPlan(input.plan, input.context);
  const authorization = parsePublicAuthorization(input.authorization, {
    operation: "rollback", plan,
  });
  const deployment = exactDeployment(input.productionDeployment,
    "rolled-back Vercel deployment");
  assert(sameImmutableDeployment(deployment, plan.rollbackDeployment),
    "public rollback did not select the exact prior deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    input.publicResolution, {
      deployment,
      target: plan.target,
    },
  );
  const preMutationState = parsePreMutationState(input.preMutationState, {
    operation: "rollback", plan, selectedSmoke: input.selectedSmoke,
    selectedBundle: input.previousBundle,
  });
  const readiness = parsePublicMutationReadiness(input.mutationReadiness, {
    operation: "rollback",
    plan,
    intent: input.intent,
    authorization: input.authorization,
    preMutationState: input.preMutationState,
    selectedSmoke: input.selectedSmoke,
    selectedBundle: input.previousBundle,
  });
  const smoke = parseSmokeReceipt(input.productionSmoke, {
    expectedMode: plan.rollbackTarget.mode,
    ...(plan.rollbackTarget.mode === "live"
      ? { expectedBundlePhase: "promotion", bundle: input.previousBundle }
      : {}),
  });
  assert(smoke.origin === PRODUCTION_ORIGIN,
    "post-rollback smoke did not target the public origin");
  exactInstant(input.rolledBackAt, "rollback receipt rolledBackAt");
  assertFreshTransition(readiness.confirmedAt, publicResolution.checkedAt,
    "Vercel rollback readiness and public provider resolution");
  assertFreshTransition(preMutationState.checkedAt, input.rolledBackAt,
    "Vercel public rollback");
  assertFreshTransition(preMutationState.checkedAt, publicResolution.checkedAt,
    "Vercel public rollback provider resolution");
  assertFreshTransition(publicResolution.checkedAt, smoke.checkedAt,
    "Vercel post-rollback public-origin resolution and smoke");
  assertFreshTransition(smoke.checkedAt, input.rolledBackAt,
    "Vercel post-rollback public smoke");
  const authorizationAge = Date.parse(authorization.authorizedAt) -
    Date.parse(preMutationState.checkedAt);
  assert(authorizationAge >= 0 && authorizationAge <= 30 * 60_000,
    "Vercel public rollback must re-query within 30 minutes of owner authorization");
  const value = {
    schemaVersion: ROLLBACK_RECEIPT_SCHEMA,
    state: "rolled-back-verified",
    publicAuthorization: true,
    publicWrites: true,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    stageBundleDigest: plan.stageBundleDigest,
    promotionBundleDigest: plan.promotionBundleDigest,
    promotionReceiptDigest: plan.promotionReceiptDigest,
    rollbackPlanDigest: plan.rollbackPlanDigest,
    authorizationDigest: authorization.authorizationDigest,
    preMutationStateDigest: preMutationState.preMutationStateDigest,
    mutationIntentDigest: readiness.mutationIntentDigest,
    mutationReadinessDigest: readiness.mutationReadinessDigest,
    promotionArtifact: plan.promotionArtifact,
    indexerEvidence: plan.indexerEvidence,
    source: plan.source,
    target: plan.target,
    deployment,
    publicResolution,
    restoredMode: plan.rollbackTarget.mode,
    restoredPromotionBundleDigest: plan.rollbackTarget.promotionBundleDigest,
    productionSmokeDigest: smoke.smokeDigest,
    workflow: exactWorkflow(input.workflow),
    rolledBackAt: input.rolledBackAt,
  };
  return withDigest(ROLLBACK_RECEIPT_SCHEMA, value, "rollbackReceiptDigest");
}

function parseStandardRollbackReceipt(value, { target } = {}) {
  const receipt = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "stageBundleDigest", "promotionBundleDigest", "promotionReceiptDigest",
    "rollbackPlanDigest", "authorizationDigest", "preMutationStateDigest",
    "mutationIntentDigest", "mutationReadinessDigest",
    "promotionArtifact", "indexerEvidence",
    "source", "target", "deployment", "publicResolution", "restoredMode",
    "restoredPromotionBundleDigest", "productionSmokeDigest", "workflow", "rolledBackAt",
    "rollbackReceiptDigest",
  ], "Vercel rollback receipt");
  assert(receipt.schemaVersion === ROLLBACK_RECEIPT_SCHEMA &&
    receipt.state === "rolled-back-verified" && receipt.publicAuthorization === true &&
    receipt.publicWrites === true && receipt.chainId === CHAIN_ID && receipt.caip2 === CAIP2 &&
    receipt.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    ["planned", "live"].includes(receipt.restoredMode),
  "Vercel rollback receipt is invalid");
  for (const key of [
    "stageBundleDigest", "promotionBundleDigest", "promotionReceiptDigest", "rollbackPlanDigest",
    "authorizationDigest", "preMutationStateDigest", "mutationIntentDigest",
    "mutationReadinessDigest", "productionSmokeDigest",
  ]) exactSha256(receipt[key], `Vercel rollback receipt ${key}`);
  if (receipt.restoredMode === "planned") {
    assert(receipt.restoredPromotionBundleDigest === null,
      "planned rollback receipt must not claim a promotion bundle");
  } else {
    exactSha256(receipt.restoredPromotionBundleDigest,
      "Vercel rollback receipt restoredPromotionBundleDigest");
  }
  const promotionArtifact = parseGitHubArtifactEvidence(receipt.promotionArtifact);
  const indexerEvidence = parseIndexerPromotionEvidenceBinding(receipt.indexerEvidence);
  exactSource(receipt.source, "Vercel rollback receipt source");
  assert(indexerEvidence.promotionBundleDigest === receipt.promotionBundleDigest &&
    promotionArtifact.sourceRevision === receipt.source.revision,
  "Vercel rollback receipt evidence differs from the promoted release");
  exactTarget(receipt.target, "Vercel rollback receipt target");
  exactDeployment(receipt.deployment, "Vercel rollback receipt deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    receipt.publicResolution, {
      deployment: receipt.deployment,
      target: receipt.target,
    },
  );
  exactWorkflow(receipt.workflow, "Vercel rollback receipt workflow");
  exactInstant(receipt.rolledBackAt, "Vercel rollback receipt rolledBackAt");
  assertFreshTransition(publicResolution.checkedAt, receipt.rolledBackAt,
    "Vercel rollback receipt public-origin resolution");
  const { rollbackReceiptDigest, ...withoutDigest } = receipt;
  assert(rollbackReceiptDigest === canonicalSha256(ROLLBACK_RECEIPT_SCHEMA, withoutDigest),
    "Vercel rollback receipt digest is invalid");
  if (target) assert(canonicalEqual(receipt.target, exactTarget(target)),
    "Vercel rollback receipt differs from the protected target");
  return receipt;
}

export function createRecoveredRollbackReceipt(input) {
  const plan = parseRollbackPlan(input.plan);
  const intent = parsePublicMutationIntent(input.intent, {
    operation: "rollback",
    plan,
    authorization: input.intentAuthorization,
    preMutationState: input.intentPreMutationState,
    selectedSmoke: input.intentSelectedSmoke,
    selectedBundle: input.previousBundle,
  });
  const attempt = parsePublicMutationRecoveryAttempt(input.recoveryAttempt, { intent });
  const readiness = parsePublicMutationRecoveryReadiness(input.recoveryReadiness, {
    intent,
    attempt,
  });
  assert(readiness.operation === "rollback",
    "recovered rollback readiness operation differs");
  const deployment = exactDeployment(input.productionDeployment,
    "recovered rollback production deployment");
  assert(sameImmutableDeployment(deployment, plan.rollbackDeployment) &&
    sameImmutableDeployment(deployment, intent.targetDeployment),
  "recovered rollback did not select the exact prior deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(
    input.publicResolution, { deployment, target: plan.target },
  );
  const smoke = parseSmokeReceipt(input.productionSmoke, {
    expectedMode: plan.rollbackTarget.mode,
    ...(plan.rollbackTarget.mode === "live"
      ? { expectedBundlePhase: "promotion", bundle: input.previousBundle }
      : {}),
  });
  assert(smoke.origin === PRODUCTION_ORIGIN,
    "recovered rollback smoke did not target the public origin");
  exactInstant(input.rolledBackAt, "recovered rollback receipt rolledBackAt");
  assertFreshTransition(readiness.confirmedAt, publicResolution.checkedAt,
    "recovered rollback provider resolution");
  assertFreshTransition(publicResolution.checkedAt, smoke.checkedAt,
    "recovered rollback public resolution and smoke");
  assertFreshTransition(smoke.checkedAt, input.rolledBackAt,
    "recovered rollback receipt sealing");
  assertFreshTransition(readiness.confirmedAt, input.rolledBackAt,
    "recovered rollback total completion freshness");
  const value = {
    schemaVersion: RECOVERED_ROLLBACK_RECEIPT_SCHEMA,
    state: "rolled-back-verified",
    publicAuthorization: true,
    publicWrites: true,
    chainId: CHAIN_ID,
    caip2: CAIP2,
    chainDeploymentId: CHAIN_DEPLOYMENT_ID,
    stageBundleDigest: plan.stageBundleDigest,
    promotionBundleDigest: plan.promotionBundleDigest,
    promotionReceiptDigest: plan.promotionReceiptDigest,
    rollbackPlanDigest: plan.rollbackPlanDigest,
    authorizationDigest: readiness.ownerDispatchAuthorizationDigest,
    preMutationStateDigest: intent.preMutationStateDigest,
    promotionArtifact: plan.promotionArtifact,
    indexerEvidence: plan.indexerEvidence,
    source: plan.source,
    recoverySource: attempt.source,
    target: plan.target,
    deployment,
    publicResolution,
    restoredMode: plan.rollbackTarget.mode,
    restoredPromotionBundleDigest: plan.rollbackTarget.promotionBundleDigest,
    productionSmokeDigest: smoke.smokeDigest,
    productionSmoke: smoke,
    originalWorkflow: intent.workflow,
    workflow: readiness.workflow,
    recoveryIntent: intent,
    recoveryAttempt: attempt,
    recoveryReadiness: readiness,
    mutationIntentDigest: intent.mutationIntentDigest,
    intentProvenanceDigest: readiness.intentProvenanceDigest,
    recoveryAttemptDigest: attempt.recoveryAttemptDigest,
    recoveryReadinessDigest: readiness.recoveryReadinessDigest,
    recoveryClassification: readiness.classification,
    publicMutationPerformed: readiness.publicMutationRequired,
    rolledBackAt: input.rolledBackAt,
  };
  return withDigest(RECOVERED_ROLLBACK_RECEIPT_SCHEMA, value,
    "rollbackReceiptDigest");
}

function parseRecoveredRollbackReceipt(value, { target, previousBundle } = {}) {
  const receipt = exactKeys(value, [
    "schemaVersion", "state", "publicAuthorization", "publicWrites", "chainId", "caip2",
    "chainDeploymentId", "stageBundleDigest", "promotionBundleDigest",
    "promotionReceiptDigest", "rollbackPlanDigest", "authorizationDigest",
    "preMutationStateDigest", "promotionArtifact", "indexerEvidence", "source",
    "recoverySource", "target", "deployment", "publicResolution", "restoredMode",
    "restoredPromotionBundleDigest", "productionSmokeDigest", "productionSmoke",
    "originalWorkflow", "workflow", "recoveryIntent", "recoveryAttempt",
    "recoveryReadiness", "mutationIntentDigest", "intentProvenanceDigest",
    "recoveryAttemptDigest", "recoveryReadinessDigest", "recoveryClassification",
    "publicMutationPerformed",
    "rolledBackAt", "rollbackReceiptDigest",
  ], "recovered Vercel rollback receipt");
  assert(receipt.schemaVersion === RECOVERED_ROLLBACK_RECEIPT_SCHEMA &&
    receipt.state === "rolled-back-verified" && receipt.publicAuthorization === true &&
    receipt.publicWrites === true && receipt.chainId === CHAIN_ID &&
    receipt.caip2 === CAIP2 && receipt.chainDeploymentId === CHAIN_DEPLOYMENT_ID &&
    ["planned", "live"].includes(receipt.restoredMode) &&
    ["old", "target"].includes(receipt.recoveryClassification) &&
    receipt.publicMutationPerformed === (receipt.recoveryClassification === "old"),
  "recovered Vercel rollback receipt is invalid");
  for (const key of [
    "stageBundleDigest", "promotionBundleDigest", "promotionReceiptDigest",
    "rollbackPlanDigest", "authorizationDigest", "preMutationStateDigest",
    "productionSmokeDigest", "mutationIntentDigest", "intentProvenanceDigest",
    "recoveryAttemptDigest", "recoveryReadinessDigest",
  ]) exactSha256(receipt[key], `recovered Vercel rollback receipt ${key}`);
  if (receipt.restoredMode === "planned") {
    assert(receipt.restoredPromotionBundleDigest === null,
      "recovered planned rollback receipt must not claim a promotion bundle");
  } else {
    exactSha256(receipt.restoredPromotionBundleDigest,
      "recovered rollback restoredPromotionBundleDigest");
  }
  const promotionArtifact = parseGitHubArtifactEvidence(receipt.promotionArtifact);
  const indexerEvidence = parseIndexerPromotionEvidenceBinding(receipt.indexerEvidence);
  exactSource(receipt.source, "recovered rollback source");
  exactSource(receipt.recoverySource, "recovered rollback recovery source");
  assert(promotionArtifact.sourceRevision === receipt.source.revision &&
    indexerEvidence.promotionBundleDigest === receipt.promotionBundleDigest,
  "recovered rollback receipt evidence differs from its promoted release");
  exactTarget(receipt.target, "recovered rollback target");
  exactDeployment(receipt.deployment, "recovered rollback deployment");
  const publicResolution = parseVercelPublicDeploymentResolution(receipt.publicResolution, {
    deployment: receipt.deployment,
    target: receipt.target,
  });
  const productionSmoke = parseSmokeReceipt(receipt.productionSmoke, {
    expectedMode: receipt.restoredMode,
    ...(receipt.restoredMode === "live" && previousBundle
      ? {
        expectedBundlePhase: "promotion",
        bundle: previousBundle,
      }
      : receipt.restoredMode === "live"
        ? { expectedBundlePhase: "promotion" }
        : {}),
  });
  assert(productionSmoke.origin === PRODUCTION_ORIGIN &&
    productionSmoke.smokeDigest === receipt.productionSmokeDigest,
  "recovered rollback receipt production smoke differs");
  exactWorkflow(receipt.originalWorkflow, "recovered rollback original workflow");
  exactRecoveryWorkflow(receipt.workflow, "recovered rollback workflow");
  const intent = parsePublicMutationIntent(receipt.recoveryIntent);
  const attempt = parsePublicMutationRecoveryAttempt(receipt.recoveryAttempt, { intent });
  const readiness = parsePublicMutationRecoveryReadiness(
    receipt.recoveryReadiness, { intent, attempt },
  );
  assert(intent.operation === "rollback" &&
    intent.planDigest === receipt.rollbackPlanDigest &&
    intent.preMutationStateDigest === receipt.preMutationStateDigest &&
    intent.selectedBundleDigest === receipt.restoredPromotionBundleDigest &&
    receipt.mutationIntentDigest === intent.mutationIntentDigest &&
    receipt.intentProvenanceDigest === attempt.intentProvenanceDigest &&
    receipt.recoveryAttemptDigest === attempt.recoveryAttemptDigest &&
    receipt.recoveryReadinessDigest === readiness.recoveryReadinessDigest &&
    receipt.authorizationDigest === readiness.ownerDispatchAuthorizationDigest &&
    receipt.recoveryClassification === readiness.classification &&
    receipt.publicMutationPerformed === readiness.publicMutationRequired &&
    canonicalEqual(receipt.recoverySource, attempt.source) &&
    canonicalEqual(receipt.target, intent.target) &&
    canonicalEqual(receipt.originalWorkflow, intent.workflow) &&
    canonicalEqual(receipt.workflow, readiness.workflow) &&
    sameImmutableDeployment(receipt.deployment, intent.targetDeployment),
  "recovered rollback receipt differs from its exact recovery lineage");
  exactInstant(receipt.rolledBackAt, "recovered rollback rolledBackAt");
  assertFreshTransition(readiness.confirmedAt, publicResolution.checkedAt,
    "recovered rollback readiness and public provider resolution");
  assertFreshTransition(publicResolution.checkedAt, productionSmoke.checkedAt,
    "recovered rollback public resolution and smoke");
  assertFreshTransition(productionSmoke.checkedAt, receipt.rolledBackAt,
    "recovered rollback smoke and receipt sealing");
  assertFreshTransition(readiness.confirmedAt, receipt.rolledBackAt,
    "recovered rollback total completion freshness");
  assertFreshTransition(publicResolution.checkedAt, receipt.rolledBackAt,
    "recovered rollback receipt public-origin resolution");
  const { rollbackReceiptDigest, ...withoutDigest } = receipt;
  assert(rollbackReceiptDigest === canonicalSha256(
    RECOVERED_ROLLBACK_RECEIPT_SCHEMA, withoutDigest,
  ), "recovered Vercel rollback receipt digest is invalid");
  if (target) assert(canonicalEqual(receipt.target, exactTarget(target)),
    "recovered Vercel rollback receipt differs from the protected target");
  return receipt;
}

export function parseRollbackReceipt(value, options = {}) {
  if (value?.schemaVersion === RECOVERED_ROLLBACK_RECEIPT_SCHEMA) {
    return parseRecoveredRollbackReceipt(value, options);
  }
  return parseStandardRollbackReceipt(value, options);
}

export function releaseTarget(orgId, projectId) {
  return exactTarget({
    provider: "vercel", orgId, projectId, environment: "production",
    publicOrigin: PRODUCTION_ORIGIN,
  });
}

export function releaseSource(revision, tree) {
  return exactSource({ repository: "programmablehq/Developers", revision, tree });
}

export function releaseWorkflow(value) {
  return exactWorkflow(value);
}

export function releaseRecoveryWorkflow(value) {
  return exactRecoveryWorkflow(value);
}

export const RELEASE_CONSTANTS = Object.freeze({
  chainId: CHAIN_ID,
  caip2: CAIP2,
  chainDeploymentId: CHAIN_DEPLOYMENT_ID,
  roots: ROOTS,
  finalityPolicy: FINALITY_POLICY,
  emptyRuntimeCodeHash: EMPTY_RUNTIME_CODE_HASH,
  frozenEthereumV3Identity: FROZEN_V3_IDENTITY,
});
