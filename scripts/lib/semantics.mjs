import { isExactCustomRegistryGenesisCanary } from
  "../../server/genesis-canary.js";
import { isAcceptedRouterStampedCustomRecord } from
  "../../server/router-custom.js";
import { canonicalSha256, canonicalizeJson } from
  "../../server/canonical.js";
import {
  isCanonicalHttpsUrl,
  isExactLaunchPartnerAttribution,
} from "../../server/partner-attribution.js";

export const PLATFORM_FEE_RECIPIENT =
  "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";
export const PLATFORM_ID = "programmable";

const EXECUTABLE_KEY =
  /(^|[-_.])(calldata|executionurl|execution-url|executiontarget|execution-target|unsignedtransaction|unsigned-transaction|transactionrequest|transaction-request|approvalpayload|approval-payload|signature)([-_.]|$)/i;
const MAX_METADATA_DEPTH = 32;
const MAX_METADATA_NODES = 4_096;
const MAX_METADATA_CHILDREN = 256;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const ZERO_HASH32 = `0x${"0".repeat(64)}`;
const ROBINHOOD_CUSTOM_LAUNCH_V4_RELEASE_IDENTITY = Object.freeze({
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
const GEN2_EVENT_EMITTERS = Object.freeze({
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
});
const GEN2_CONTRACT_ROLES = Object.freeze([
  "registry",
  "partnerFactoryRegistry",
  "feePolicyVerifier",
  "atomicRegistrar",
]);
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

function finding(code, path, message) {
  return { code, path, message };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function pointerSegment(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function executableMetadataFindings(value, path = "") {
  const findings = [];
  const stack = [{ value, path, depth: 0 }];
  let visited = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    visited += 1;
    if (visited > MAX_METADATA_NODES) {
      findings.push(
        finding(
          "METADATA_TOO_COMPLEX",
          path,
          `Read-only metadata may contain at most ${MAX_METADATA_NODES} values`,
        ),
      );
      break;
    }
    if (current.depth > MAX_METADATA_DEPTH) {
      findings.push(
        finding(
          "METADATA_TOO_COMPLEX",
          current.path,
          `Read-only metadata may be nested at most ${MAX_METADATA_DEPTH} levels`,
        ),
      );
      continue;
    }
    if (!current.value || typeof current.value !== "object") continue;

    const childCount = Array.isArray(current.value)
      ? current.value.length
      : Object.keys(current.value).length;
    const entries = Array.isArray(current.value)
      ? Array.from(
          { length: Math.min(current.value.length, MAX_METADATA_CHILDREN) },
          (_, index) => [String(index), current.value[index]],
        )
      : Object.entries(current.value).slice(0, MAX_METADATA_CHILDREN);
    if (childCount > MAX_METADATA_CHILDREN) {
      findings.push(
        finding(
          "METADATA_TOO_COMPLEX",
          current.path,
          `One metadata container may contain at most ${MAX_METADATA_CHILDREN} values`,
        ),
      );
    }

    if (!Array.isArray(current.value)) {
      const normalized = new Map(
        entries.map(([key, child]) => [key.replace(/[^a-z0-9]/gi, "").toLowerCase(), child]),
      );
      const target = ["to", "target", "spender", "contract"].find((key) =>
        normalized.has(key),
      );
      const data = ["data", "calldata", "txdata"].find((key) =>
        normalized.has(key),
      );
      if (
        target &&
        data &&
        /^0x[0-9a-fA-F]{40}$/.test(normalized.get(target)) &&
        /^0x(?:[0-9a-fA-F]{2})+$/.test(normalized.get(data))
      ) {
        findings.push(
          finding(
            "EXECUTABLE_METADATA",
            current.path,
            "Read-only metadata may not carry a wallet target and executable call data",
          ),
        );
      }
    }

    for (const [key, child] of entries) {
      const childPath = `${current.path}/${pointerSegment(key)}`;
      const semanticKey = key.includes("/") ? key.slice(key.indexOf("/") + 1) : key;
      if (EXECUTABLE_KEY.test(semanticKey)) {
        findings.push(
          finding(
            "EXECUTABLE_METADATA",
            childPath,
            "Read-only metadata may not carry executable wallet payloads",
          ),
        );
      }
      stack.push({ value: child, path: childPath, depth: current.depth + 1 });
    }
  }
  return findings;
}

function isRouterStampedCustomLaunch(launch, acceptedRouterCustomMembership) {
  return isAcceptedRouterStampedCustomRecord(
    launch,
    acceptedRouterCustomMembership,
  );
}

function isNonEmptyTrimmedText(value) {
  return typeof value === "string" && value.length > 0 &&
    value.trim() === value;
}

function isCanonicalXProfileUrl(value) {
  if (!isCanonicalHttpsUrl(value)) return false;
  const parsed = new URL(value);
  return parsed.origin === "https://x.com" && parsed.search === "" &&
    parsed.hash === "" && /^\/[A-Za-z0-9_]+$/.test(parsed.pathname);
}

function validateV2LaunchPartnerAttribution(launch) {
  const findings = [];
  if (launch.launchedVia === undefined) return findings;
  if (!isExactLaunchPartnerAttribution(launch.launchedVia)) {
    findings.push(finding(
      "LAUNCH_PARTNER_ATTRIBUTION_INVALID",
      "/launchedVia",
      "Partner attribution must be the exact server-owned v1 snapshot with its matching canonical digest",
    ));
    return findings;
  }
  if (launch.category !== "custom") {
    findings.push(finding(
      "LAUNCH_PARTNER_ATTRIBUTION_CUSTOM_ONLY",
      "/launchedVia",
      "Launch partner attribution is only defined for Custom launches",
    ));
  }
  if (launch.launch?.finality !== "finalized") {
    findings.push(finding(
      "LAUNCH_PARTNER_ATTRIBUTION_FINALIZED_REQUIRED",
      "/launchedVia",
      "Partner attribution is published only on finalized Custom launch projections",
    ));
  }

  const token = launch.token;
  const metadata = token?.metadata;
  const links = metadata?.links;
  if (
    token?.identityStatus !== "complete" ||
    !isNonEmptyTrimmedText(token?.name) ||
    !isNonEmptyTrimmedText(token?.symbol) ||
    !isNonEmptyTrimmedText(metadata?.description) ||
    !isCanonicalHttpsUrl(metadata?.imageUrl) ||
    !isCanonicalHttpsUrl(links?.website) ||
    !isCanonicalXProfileUrl(links?.x) ||
    metadata?.trustStatus === "unavailable"
  ) {
    findings.push(finding(
      "LAUNCH_PARTNER_METADATA_INCOMPLETE",
      "/token",
      "A partner-attributed finalized launch must expose name, symbol, description, image, website, and one canonical X profile URL without inventing unavailable metadata",
    ));
  }

  const presentation = launch.presentation;
  if (presentation !== undefined && presentation !== null) {
    const disagreements = [
      [presentation.description, metadata?.description],
      [presentation.image, metadata?.imageUrl],
      [presentation.website, links?.website],
      [presentation.x, links?.x],
    ].some(([left, right]) => left !== null && right !== null && left !== right);
    if (disagreements) {
      findings.push(finding(
        "LAUNCH_PARTNER_METADATA_CONFLICT",
        "/presentation",
        "Partner-attributed launch presentation must not conflict with the canonical token metadata projection",
      ));
    }
  }
  return findings;
}

function validateV2FeePolicy(launch, acceptedRouterCustomMembership) {
  const findings = [];
  const policy = launch.feePolicy;
  const fees = launch.fees ?? [];
  if (!policy) {
    if (
      launch.category === "custom" &&
      !(isRouterStampedCustomLaunch(
        launch,
        acceptedRouterCustomMembership,
      ) && fees.length === 0)
    ) {
      findings.push(finding(
        "FEE_POLICY_REQUIRED",
        "/feePolicy",
        "Every v2 Custom record needs a closed fee policy unless a provenance-only Router record explicitly reports the policy unavailable",
      ));
    }
    return findings;
  }
  if (
    policy.programmableRecipient?.namespace !== "eip155-address" ||
    String(policy.programmableRecipient?.value).toLowerCase() !==
      PLATFORM_FEE_RECIPIENT.toLowerCase()
  ) {
    findings.push(finding(
      "PLATFORM_FEE_RECIPIENT",
      "/feePolicy/programmableRecipient",
      "The fee policy does not bind the canonical Programmable recipient",
    ));
  }

  if (policy.mode === "no-qualifying-market") {
    if (
      (launch.markets ?? []).length !== 0 ||
      fees.length !== 0 ||
      policy.totalFeeBps !== 0 ||
      policy.programmableShareBps !== 0 ||
      policy.partnerShareBps !== 0 ||
      policy.normalProgrammableTenBpsApplied !== false ||
      policy.chargeMode !== "none-no-qualifying-market" ||
      policy.claimRights?.programmable !== null ||
      policy.claimRights?.partner !== null ||
      policy.claimRights?.independentlyClaimable !== false ||
      policy.claimRights?.crossPartyClaimingProhibited !== true
    ) {
      findings.push(finding(
        "NO_MARKET_FEE_CONTRADICTION",
        "/feePolicy",
        "A no-qualifying-market policy cannot publish a market fee or market",
      ));
    }
    return findings;
  }

  const programmable = fees.filter((fee) => fee.share === "programmable");
  const partner = fees.filter((fee) => fee.share === "partner");
  const verifiedMarketIds = policy.verifiedMarketIds ?? [];
  const marketsById = new Map(
    (launch.markets ?? []).map((market) => [market.marketId, market]),
  );
  if (
    verifiedMarketIds.length === 0 ||
    duplicateValues(verifiedMarketIds).length > 0 ||
    verifiedMarketIds.some((marketId) => {
      const market = marketsById.get(marketId);
      return market?.status !== "active" ||
        market?.verification?.status !== "verified";
    })
  ) {
    findings.push(finding(
      "FEE_MARKET_EVIDENCE",
      "/feePolicy/verifiedMarketIds",
      "A charged fee policy must name active, verified official markets",
    ));
  }
  if (programmable.length !== 1) {
    findings.push(finding(
      "PROGRAMMABLE_SHARE_COUNT",
      "/fees",
      "A verified v2 fee policy requires exactly one Programmable share",
    ));
  }
  const programmableFee = programmable[0];
  if (
    programmableFee &&
    String(programmableFee.recipient).toLowerCase() !== PLATFORM_FEE_RECIPIENT.toLowerCase()
  ) {
    findings.push(finding(
      "PLATFORM_FEE_RECIPIENT",
      "/fees",
      "The Programmable share recipient does not match the canonical recipient",
    ));
  }

  if (policy.mode === "native") {
    if (
      policy.totalFeeBps !== 10 ||
      policy.programmableShareBps !== 10 ||
      policy.chargeMode !== "verified-official-market-path-only" ||
      policy.partnerShareBps !== 0 ||
      partner.length !== 0 ||
      fees.length !== 1 ||
      programmableFee?.rateBps !== 10 ||
      launch.partner !== null ||
      policy.claimRights?.programmable === null ||
      policy.claimRights?.partner !== null ||
      policy.claimRights?.independentlyClaimable !== false ||
      policy.claimRights?.crossPartyClaimingProhibited !== true
    ) {
      findings.push(finding(
        "NATIVE_CUSTOM_FEE_POLICY",
        "/feePolicy",
        "Native Custom must charge exactly 10 bps to Programmable with no partner share",
      ));
    }
  } else if (policy.mode === "partner-template") {
    const partnerFee = partner[0];
    if (
      policy.totalFeeBps !== 20 ||
      policy.partnerShareBps !== 15 ||
      policy.programmableShareBps !== 5 ||
      policy.normalProgrammableTenBpsApplied !== false ||
      policy.chargeMode !== "template-native-verified-market-path" ||
      programmableFee?.rateBps !== 5 ||
      partner.length !== 1 ||
      partnerFee?.rateBps !== 15 ||
      fees.length !== 2 ||
      launch.partner === null ||
      launch.template === null ||
      launch.partner?.status !== "active" ||
      launch.template?.partnerId !== launch.partner?.id ||
      launch.partner?.recipient?.value?.toLowerCase() !==
        policy.partnerRecipient?.value?.toLowerCase() ||
      String(partnerFee?.recipient).toLowerCase() !==
        String(policy.partnerRecipient?.value).toLowerCase() ||
      programmableFee?.basis !== partnerFee?.basis ||
      JSON.stringify(programmableFee?.currency) !== JSON.stringify(partnerFee?.currency) ||
      policy.verificationStatus !== "verified" ||
      policy.claimRights?.programmable === null ||
      policy.claimRights?.partner === null ||
      policy.claimRights?.independentlyClaimable !== true ||
      policy.claimRights?.crossPartyClaimingProhibited !== true
    ) {
      findings.push(finding(
        "PARTNER_TEMPLATE_FEE_POLICY",
        "/feePolicy",
        "Partner templates must prove exactly 20 bps total as independent 15 bps partner and 5 bps Programmable shares with no added native 10 bps",
      ));
    }
  }
  return findings;
}

function validateV2IdentityAndReview(launch, acceptedRouterCustomMembership) {
  const findings = [];
  const expectedLabel = launch.category === "classic"
    ? "Programmable Classic"
    : "Programmable Custom";
  if (launch.publicLabel !== expectedLabel) {
    findings.push(finding(
      "PUBLIC_LABEL",
      "/publicLabel",
      "The public label must follow the canonical Classic or Custom category",
    ));
  }
  if (launch.caip2 !== `eip155:${launch.chainId}`) {
    findings.push(finding(
      "CHAIN_IDENTITY",
      "/caip2",
      "CAIP-2 identity must match chainId",
    ));
  }
  if (
    launch.model &&
    (launch.model.id !== launch.launch?.modelId ||
      launch.model.version !== launch.launch?.modelVersion)
  ) {
    findings.push(finding(
      "MODEL_IDENTITY",
      "/model",
      "Top-level model identity must match the launch projection",
    ));
  }
  const assetIds = (launch.assets ?? []).map((asset) => asset.assetId);
  for (const duplicate of duplicateValues(assetIds)) {
    findings.push(finding(
      "DUPLICATE_ASSET",
      "/assets",
      `Duplicate asset ${duplicate}`,
    ));
  }

  const exactGenesisCanary = isExactCustomRegistryGenesisCanary(launch);
  const materializedCustom = launch.category === "custom" &&
    !exactGenesisCanary &&
    !isRouterStampedCustomLaunch(launch, acceptedRouterCustomMembership) &&
    ["observed", "live", "paused", "retired", "revoked"].includes(
      launch.launch?.status,
    );
  if (materializedCustom && (
    launch.origin !== "programmable" ||
    launch.launchFamily !== "custom" ||
    launch.registryRecordSchemaVersion !==
      "programmable.custom-launch-registry-record.v3" ||
    !/^sha256:[0-9a-f]{64}$/.test(launch.producerEnvelopeDigest ?? "") ||
    !/^0x[0-9a-f]{64}$/.test(launch.registeredRecordHash ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(launch.projectionDigest ?? "") ||
    launch.verification?.registryAddress === null ||
    launch.verification?.registryGeneration === null ||
    launch.verification?.registryEventTopic === null ||
    launch.verification?.approvalMatch !== "matched" ||
    launch.verification?.runtimeMatch !== "matched" ||
    launch.approvalBinding === null ||
    launch.deploymentBinding?.runtimeMatch !== "exact" ||
    launch.verifiedReview === null
  )) {
    findings.push(finding(
      "CUSTOM_VERIFIED_BINDING",
      "/verification",
      "A materialized Programmable Custom record must prove registry, approval, runtime and current review bindings",
    ));
  }
  if (materializedCustom) {
    const origin = launch.registryOrigin;
    const launchIdRaw = typeof launch.launchId === "string" &&
      /^sha256:[0-9a-f]{64}$/.test(launch.launchId)
      ? `0x${launch.launchId.slice("sha256:".length)}`
      : null;
    const approvalRaw = typeof launch.approvalBinding?.approvalBindingHash === "string" &&
      /^sha256:[0-9a-f]{64}$/.test(launch.approvalBinding.approvalBindingHash)
      ? `0x${launch.approvalBinding.approvalBindingHash.slice("sha256:".length)}`
      : null;
    if (
      origin?.launchIdEncoding !== "sha256-digest-raw-bytes32" ||
      origin?.registryLaunchIdRaw !== launchIdRaw ||
      origin?.registryApprovalBindingHashRaw !== approvalRaw ||
      origin?.registeredRecordHash !== launch.registeredRecordHash ||
      origin?.chainId !== String(launch.chainId) ||
      origin?.caip2 !== launch.caip2 ||
      origin?.registryAddress?.toLowerCase() !==
        launch.verification?.registryAddress?.toLowerCase()
    ) {
      findings.push(finding(
        "CUSTOM_REGISTRY_IDENTITY_BINDING",
        "/registryOrigin",
        "Registry chain, launch ID, approval and immutable record hash must match the public projection",
      ));
    }
    const contracts = launch.deploymentBinding?.contracts ?? [];
    const deployedKeccak = contracts
      .map((contract) => contract.runtimeCodeKeccak256)
      .sort();
    const deployedSha256 = contracts
      .map((contract) => contract.runtimeCodeSha256)
      .sort();
    const reviewedKeccak = [...(launch.verifiedReview?.runtimeCodeKeccak256 ?? [])]
      .sort();
    const reviewedSha256 = [...(launch.verifiedReview?.runtimeCodeSha256 ?? [])]
      .sort();
    if (
      JSON.stringify(deployedKeccak) !== JSON.stringify(reviewedKeccak) ||
      JSON.stringify(deployedSha256) !== JSON.stringify(reviewedSha256)
    ) {
      findings.push(finding(
        "CUSTOM_RUNTIME_HASH_BINDING",
        "/verifiedReview",
        "Reviewed Keccak-256 and SHA-256 runtime sets must exactly match deployed contracts",
      ));
    }
  }
  if (
    materializedCustom &&
    launch.lifecycle?.status === "active" &&
    (launch.verifiedReview?.status !== "verified" ||
      launch.verifiedReview?.supersededBy !== null ||
      launch.verifiedReview?.revokedAt !== null)
  ) {
    findings.push(finding(
      "CUSTOM_ACTIVE_REVIEW",
      "/verifiedReview",
      "An active Custom record requires a current deployment-bound review",
    ));
  }
  if (
    launch.verifiedReview?.status === "verified" &&
    (launch.verifiedReview.supersededBy !== null || launch.verifiedReview.revokedAt !== null)
  ) {
    findings.push(finding(
      "REVIEW_STATUS_CONTRADICTION",
      "/verifiedReview",
      "A current reviewed record cannot also be superseded or revoked",
    ));
  }
  return findings;
}

export function validateLaunchSemantics(
  launch,
  { acceptedRouterCustomMembership = null } = {},
) {
  const findings = [];
  const capabilities = launch.capabilities ?? [];
  const markets = launch.markets ?? [];
  const fees = launch.fees ?? [];
  const isV2 = launch.schemaVersion === "2.0.0";

  if (isV2 && launch.platformId !== PLATFORM_ID) {
    findings.push(
      finding(
        "PLATFORM_IDENTITY",
        "/platformId",
        "Official launch records must carry the canonical Programmable platform identity",
      ),
    );
  }

  for (const id of duplicateValues(capabilities.map((item) => item.id))) {
    findings.push(
      finding("DUPLICATE_CAPABILITY", "/capabilities", `Duplicate capability ${id}`),
    );
  }
  for (const id of duplicateValues(markets.map((item) => item.marketId))) {
    findings.push(finding("DUPLICATE_MARKET", "/markets", `Duplicate market ${id}`));
  }

  const platformFees = fees.filter((fee) => fee.kind === "programmable-platform");
  if (!isV2 && platformFees.length !== 1) {
    findings.push(
      finding(
        "PLATFORM_FEE_COUNT",
        "/fees",
        "Exactly one Programmable platform fee is required",
      ),
    );
  } else if (!isV2) {
    const platformFee = platformFees[0];
    if (platformFee.rateBps !== 10 || platformFee.ratePpm !== 1000) {
      findings.push(
        finding(
          "PLATFORM_FEE_RATE",
          "/fees",
          "The Programmable platform fee must be 10 bps / 1000 ppm",
        ),
      );
    }
    if (
      String(platformFee.recipient).toLowerCase() !==
      PLATFORM_FEE_RECIPIENT.toLowerCase()
    ) {
      findings.push(
        finding(
          "PLATFORM_FEE_RECIPIENT",
          "/fees",
          "The platform fee recipient does not match the canonical recipient",
        ),
      );
    }
    if (launch.category === "classic" && platformFee.chargeMode !== "included") {
      findings.push(
        finding(
          "CLASSIC_FEE_MODE",
          "/fees",
          "Current Classic fees include the 10 bps platform share",
        ),
      );
    }
    if (
      launch.category === "custom" &&
      launch.launch?.publicSubmission === true &&
      platformFee.chargeMode !== "added-on-top"
    ) {
      findings.push(
        finding(
          "CUSTOM_PUBLIC_FEE_MODE",
          "/fees",
          "Future public Custom launches add the 10 bps platform share on top",
        ),
      );
    }
  }

  if (isV2) {
    findings.push(...validateV2IdentityAndReview(
      launch,
      acceptedRouterCustomMembership,
    ));
    findings.push(...validateV2FeePolicy(
      launch,
      acceptedRouterCustomMembership,
    ));
    findings.push(...validateV2LaunchPartnerAttribution(launch));
  }

  const lifecycle = launch.launch?.status;
  if (["live", "paused", "retired"].includes(lifecycle)) {
    const required = [
      "transactionHash",
      "blockNumber",
      "finality",
    ];
    if (
      required.some((key) => launch.launch?.[key] === null) ||
      launch.verification?.provenanceStatus === "prelaunch"
    ) {
      findings.push(
        finding(
          "LIVE_PROVENANCE",
          "/launch",
          "A materialized launch needs transaction, block, and finality provenance; timestamp enrichment is optional",
        ),
      );
    }
    if (
      launch.verification?.provenanceStatus === "verified" &&
      ["transactionHash", "blockNumber", "blockHash"].some(
        (key) => launch.launch?.[key] === null,
      )
    ) {
      findings.push(
        finding(
          "VERIFIED_PROVENANCE_INCOMPLETE",
          "/verification/provenanceStatus",
          "Verified provenance requires the exact transaction, block number, and block hash; log index may be null for transaction-level launch identity",
        ),
      );
    }
  }
  if (lifecycle === "prelaunch") {
    const shouldBeNull = [
      "transactionHash",
      "blockNumber",
      "blockHash",
      "logIndex",
      "timestamp",
      "finality",
    ];
    if (shouldBeNull.some((key) => launch.launch?.[key] !== null)) {
      findings.push(
        finding(
          "PRELAUNCH_PROVENANCE",
          "/launch",
          "Prelaunch fixtures may not imply a completed onchain launch",
        ),
      );
    }
  }

  const supplyKnown = launch.token !== null && launch.token?.supplyStatus !== "unavailable";
  if (
    launch.token?.identityStatus === "complete" &&
    ["name", "symbol", "decimals"].some((key) => launch.token?.[key] === null)
  ) {
    findings.push(
      finding(
        "IDENTITY_CONTRADICTION",
        "/token",
        "Complete token identity requires name, symbol, and decimals",
      ),
    );
  }
  if (
    launch.token !== null &&
    ((supplyKnown &&
      (launch.token?.totalSupplyRaw === null || launch.token?.supplyAsOfBlock === null)) ||
      (!supplyKnown &&
        (launch.token?.totalSupplyRaw !== null || launch.token?.supplyAsOfBlock !== null)))
  ) {
    findings.push(
      finding(
        "SUPPLY_CONTRADICTION",
        "/token",
        "Supply value, status, and observation block contradict each other",
      ),
    );
  }

  if (launch.token === null) {
    if (!isV2) {
      findings.push(
        finding(
          "NON_TOKEN_SCHEMA_VERSION",
          "/schemaVersion",
          "Project-only token-null records require the additive v1.1 schema",
        ),
      );
    }
    const primaryAssets = (launch.assets ?? []).filter(
      (asset) => asset.role === "primary-token",
    );
    if (!isV2 && (primaryAssets.length !== 0 || markets.length !== 0)) {
      findings.push(
        finding(
          "NON_TOKEN_CONTRADICTION",
          "/token",
          "A project-only launch cannot advertise a primary token or token market",
        ),
      );
    }
  }

  markets.forEach((market, index) => {
    const path = `/markets/${index}`;
    if (!isV2 && launch.token !== null &&
      market.baseTokenAddress?.toLowerCase() !== launch.token?.address?.toLowerCase()
    ) {
      findings.push(
        finding(
          "MARKET_BASE_TOKEN",
          `${path}/baseTokenAddress`,
          "Market base token must match the launched token",
        ),
      );
    }
    if (market.status === "planned" && market.support?.execution === "available") {
      findings.push(
        finding(
          "PLANNED_MARKET_EXECUTION",
          `${path}/support/execution`,
          "A planned market cannot report execution as available",
        ),
      );
    }
    for (const name of ["price", "liquidity", "volume24h"]) {
      const metric = market.metrics?.[name];
      if (!metric) continue;
      if (
        (metric.status === "unavailable" && metric.value !== null) ||
        (metric.status !== "unavailable" && metric.value === null)
      ) {
        findings.push(
          finding(
            "METRIC_CONTRADICTION",
            `${path}/metrics/${name}`,
            "Metric value and availability status contradict each other",
          ),
        );
      }
    }
    const metricsAvailable = ["price", "liquidity", "volume24h"].some(
      (name) => market.metrics?.[name]?.status !== "unavailable",
    );
    if (metricsAvailable !== (market.metrics?.updatedAt !== null)) {
      findings.push(
        finding(
          "METRIC_TIMESTAMP",
          `${path}/metrics/updatedAt`,
          "Available metrics need an observation time; unavailable metrics must not invent one",
        ),
      );
    }
  });

  findings.push(...executableMetadataFindings(launch.extensions, "/extensions"));
  capabilities.forEach((capability, index) => {
    findings.push(
      ...executableMetadataFindings(
        capability.parameters,
        `/capabilities/${index}/parameters`,
      ),
    );
  });
  return findings;
}

export function validateFeedSemantics(feed) {
  const findings = [];
  const items = feed.items ?? [];
  for (const launchId of duplicateValues(items.map((item) => item.launchId))) {
    findings.push(
      finding("DUPLICATE_LAUNCH", "/items", `Duplicate launch ${launchId}`),
    );
  }
  const tokenKeys = items
    .filter((item) => item.token?.address)
    .map((item) => `${item.chainId}:${item.token.address.toLowerCase()}`);
  for (const tokenKey of duplicateValues(tokenKeys)) {
    findings.push(
      finding("DUPLICATE_TOKEN", "/items", `Duplicate token ${tokenKey}`),
    );
  }
  if (feed.snapshot && feed.snapshot.cursor !== feed.page?.resumeCursor) {
    findings.push(
      finding(
        "RESUME_CURSOR_MISMATCH",
        "/page/resumeCursor",
        "Resume cursor must equal the snapshot high-water cursor",
      ),
    );
  }
  if (Boolean(feed.page?.nextCursor) !== Boolean(feed.page?.hasMore)) {
    findings.push(
      finding(
        "PAGINATION_CONTRADICTION",
        "/page",
        "nextCursor and hasMore contradict each other",
      ),
    );
  }
  if (feed.snapshot) {
    const snapshotBlock = BigInt(feed.snapshot.blockNumber);
    for (const [index, item] of items.entries()) {
      if (
        item.launch?.blockNumber !== null &&
        BigInt(item.launch.blockNumber) > snapshotBlock
      ) {
        findings.push(
          finding(
            "AFTER_SNAPSHOT",
            `/items/${index}/launch/blockNumber`,
            "Launch is newer than the feed snapshot",
          ),
        );
      }
    }
  }
  let previousPosition = null;
  for (const [index, item] of items.entries()) {
    if (item.launch?.status === "prelaunch") {
      findings.push(
        finding(
          "PRELAUNCH_IN_FEED",
          `/items/${index}`,
          "Prelaunch examples are fixtures, not materialized launch records",
        ),
      );
      continue;
    }
    if (item.launch?.finality === "orphaned") {
      findings.push(
        finding(
          "ORPHANED_IN_FEED",
          `/items/${index}`,
          "Orphaned observations must not remain in the canonical launch feed",
        ),
      );
    }
    if (item.launch?.blockNumber === null || item.launch?.logIndex === null) continue;
    const position = {
      block: BigInt(item.launch.blockNumber),
      log: BigInt(item.launch.logIndex),
    };
    if (
      previousPosition &&
      (position.block > previousPosition.block ||
        (position.block === previousPosition.block && position.log > previousPosition.log))
    ) {
      findings.push(
        finding(
          "FEED_ORDER",
          `/items/${index}`,
          "Launch records must be ordered by block and log position descending",
        ),
      );
    }
    previousPosition = position;
  }
  return findings;
}

function sameHex(left, right) {
  return typeof left === "string" && typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase();
}

function robinhoodCustomLaunchBindingFindings(manifest) {
  if (manifest.chainId !== 4663) return [];
  const binding = manifest.robinhoodCustomLaunchBinding;
  const router = manifest.launchStampRouter;
  const v4 = manifest.customLaunchV4;
  if (!binding) {
    return [finding(
      "ROBINHOOD_CUSTOM_LAUNCH_BINDING",
      "/robinhoodCustomLaunchBinding",
      "Robinhood must publish its chain-owned Custom Launch binding",
    )];
  }
  const routerLive = ["live", "retired"].includes(router?.status);
  const v4Live = v4?.status === "live";
  if (!routerLive && !v4Live) {
    if (binding.state !== "prepared-not-broadcast" ||
      binding.chainDeployment !== null || binding.publication !== null) {
      return [finding(
        "ROBINHOOD_CUSTOM_LAUNCH_PLANNED_BINDING",
        "/robinhoodCustomLaunchBinding",
        "Planned Robinhood metadata may not publish finalized deployment evidence",
      )];
    }
    return [];
  }
  if (binding.state !== "finalized-live") {
    return [finding(
      "ROBINHOOD_CUSTOM_LAUNCH_LIVE_BINDING",
      "/robinhoodCustomLaunchBinding/state",
      "Live Robinhood metadata requires the finalized chain-owned branch",
    )];
  }

  try {
    const chainDeployment = binding.chainDeployment;
    const publication = binding.publication;
    const deployment = binding.deployment;
    const chainBindings = binding.chainBindings;
    const profileBinding = binding.profileBinding;
    const externalEvidence = new Map(
      chainDeployment.externalRootDeploymentEvidence.map((evidence) => [
        evidence.contract,
        evidence,
      ]),
    );
    const profileMatches =
      v4.profile.structuralProfileId ===
        profileBinding.structuralProfile.profileId &&
      v4.profile.businessProfileId ===
        profileBinding.serverBusinessProfile.profileId &&
      v4.profile.profileRevision ===
        profileBinding.serverBusinessProfile.profileRevision &&
      v4.profile.profileVersion ===
        profileBinding.serverBusinessProfile.profileVersion &&
      v4.profile.profileDigest ===
        profileBinding.serverBusinessProfile.profileDigest &&
      v4.profile.admissionDescriptorDigest ===
        profileBinding.admission.descriptorSha256 &&
      v4.profile.admissionPolicyDigest ===
        profileBinding.admission.businessPolicySha256 &&
      v4.profile.admissionSchemaDigest ===
        profileBinding.admission.bindingSchemaSha256 &&
      v4.profile.admissionBindingDigest ===
        profileBinding.admission.bindingSha256;
    const contractsMatch = Object.entries(chainBindings).every(
      ([contract, root]) => sameHex(
        root.address,
        chainDeployment.contracts[contract]?.address,
      ) && sameHex(
        root.runtimeCodeHash,
        chainDeployment.contracts[contract]?.runtimeCodeHash,
      ),
    );
    const externalRootsMatch = [
      "poolManager", "positionManager", "stateView", "v4Quoter",
      "universalRouter",
    ].every((contract) => {
      const root = chainBindings[contract];
      const evidence = externalEvidence.get(contract);
      return evidence !== undefined && root.provenance === "deployment-block" &&
        root.startBlock === evidence.startBlock &&
        sameHex(root.address, evidence.address) &&
        sameHex(root.runtimeCodeHash, evidence.runtimeCodeHash);
    });
    const finalizedFeedUrl =
      `${v4.api.baseUrl}${v4.api.finalizedLaunchesPath}`;
    const chainProfile = manifest.chains.find(
      (entry) => entry.chainId === manifest.chainId,
    );
    const readModel = manifest.extensions?.["programmable/read-model-v1"];
    const eventEvidenceDigest = canonicalSha256(
      "programmable.router-event-evidence.v1",
      router.events,
    );
    const getterEvidenceDigest = canonicalSha256(
      "programmable.router-getter-evidence.v1",
      router.getters,
    );
    const { evidenceDigest: publicationDigest, ...publicationWithoutDigest } =
      publication;
    const expectedPublicationDigest = canonicalSha256(
      publication.schemaVersion,
      publicationWithoutDigest,
    );
    const expectedFinalityEvidence = canonicalSha256(
      "programmable.robinhood-custom-launch-deployment-finality.v1",
      {
        chainDeploymentDescriptorDigest:
          publication.chainDeploymentDescriptorDigest,
        transactionHash: deployment.transactionHash,
        blockNumber: deployment.blockNumber,
        blockHash: deployment.blockHash,
        finalizedBlockNumber: deployment.finalizedBlockNumber,
        finalizedBlockHash: deployment.finalizedBlockHash,
        finalityPolicy: chainDeployment.finality,
        canaryEvidence: router.canaryEvidence,
      },
    );
    const safeConfiguration = chainDeployment
      .permitAuthoritySourceProvenance.configurationEvidence;
    const ethereumFinality = safeConfiguration.ethereumFinalityEvidence;
    const {
      evidenceDigest: ethereumFinalityDigest,
      ...ethereumFinalityWithoutDigest
    } = ethereumFinality;
    const {
      evidenceDigest: safeConfigurationDigest,
      ...safeConfigurationWithoutDigest
    } = safeConfiguration;
    const permit2Genesis = chainDeployment.permit2GenesisProvenance;
    const {
      evidenceDigest: permit2GenesisDigest,
      ...permit2GenesisWithoutDigest
    } = permit2Genesis;
    const permit2ReadbacksValid = permit2Genesis.providerReadbacks.every(
      (readback) => {
        const { evidenceDigest, ...withoutDigest } = readback;
        return evidenceDigest === canonicalSha256(
          readback.schemaVersion,
          withoutDigest,
        );
      },
    );
    const permitAuthoritySource =
      chainDeployment.permitAuthoritySourceProvenance;
    const {
      evidenceDigest: permitAuthoritySourceDigest,
      ...permitAuthoritySourceWithoutDigest
    } = permitAuthoritySource;
    const atomic = chainDeployment.deploymentEvidence;
    const { evidenceDigest: atomicDigest, ...atomicWithoutDigest } = atomic;
    const atomicProviderReadbacksValid = atomic.providerReadbacks.every(
      (readback, index) => {
        const { evidenceDigest, ...withoutDigest } = readback;
        const expectedProvider = [
          ["quicknode", "quicknode.com"],
          ["alchemy", "alchemy.com"],
        ][index];
        return readback.providerId === expectedProvider[0] &&
          readback.trustDomain === expectedProvider[1] &&
          readback.transactionHash === atomic.transactionHash &&
          evidenceDigest === canonicalSha256(
            "programmable.robinhood-atomic-root-deployment-provider-readback.v1",
            withoutDigest,
          );
      },
    );
    const atomicResultsValid = [
      "permitAuthority", "graphFactory", "programmableLaunchStampRouter",
    ].every((contract, index) => {
      const result = atomic.resultingContracts[index];
      const root = chainDeployment.contracts[contract];
      const transitionReadbacksValid = result.providerReadbacks.every(
        (readback, providerIndex) => {
          const expectedProvider = [
            ["quicknode", "quicknode.com"],
            ["alchemy", "alchemy.com"],
          ][providerIndex];
          const { evidenceDigest, ...withoutDigest } = readback;
          return readback.schemaVersion ===
              "programmable.robinhood-atomic-root-runtime-transition-provider-readback.v1" &&
            readback.providerId === expectedProvider[0] &&
            readback.trustDomain === expectedProvider[1] &&
            readback.contract === contract && sameHex(readback.address, root.address) &&
            readback.preDeploymentBlockNumber ===
              (BigInt(atomic.blockNumber) - 1n).toString(10) &&
            readback.preDeploymentRuntimeCodeHash ===
              "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" &&
            readback.deploymentBlockNumber === atomic.blockNumber &&
            readback.deploymentBlockHash === atomic.blockHash &&
            sameHex(readback.deploymentRuntimeCodeHash, root.runtimeCodeHash) &&
            evidenceDigest === canonicalSha256(
              readback.schemaVersion,
              withoutDigest,
            );
        },
      );
      const { stateEvidenceDigest, ...resultWithoutDigest } = result;
      return result.contract === contract && sameHex(result.address, root.address) &&
        sameHex(result.runtimeCodeHash, root.runtimeCodeHash) &&
        result.previousBlockRuntimeCodeHash ===
          "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" &&
        result.providerReadbacks.length === 2 && transitionReadbacksValid &&
        result.providerReadbacks[0].preDeploymentBlockHash ===
          result.providerReadbacks[1].preDeploymentBlockHash &&
        stateEvidenceDigest === canonicalSha256(
          "programmable.robinhood-atomic-root-deployment-result-state.v1",
          resultWithoutDigest,
        );
    });
    const uniswapRegistrySource = {
      repository: "Uniswap/contracts",
      commit: "4cfc406c8e34da3ce04e60657a7825075b64fd22",
      path: "deployments/json/4663.json",
      rawUrl:
        "https://raw.githubusercontent.com/Uniswap/contracts/4cfc406c8e34da3ce04e60657a7825075b64fd22/deployments/json/4663.json",
      sha256:
        "sha256:21964cefbfc24b0ee89e7427acf74d223ce5a50aeb4216a9bac361a6148dea15",
    };
    const externalRootConstants = [
      [
        "poolManager",
        "0x4fb28d4935866f462582c6c931c6f2705e55f5be5eb178c7d8d9329a95c44c41",
        "9070",
      ],
      [
        "positionManager",
        "0x228c18ada6cb46b4fbcc18f4ec1519953415393e256fa8349aafbd5a2db037c8",
        "9073",
      ],
      [
        "stateView",
        "0x3d61e2c9eeb482385b1aa436b9e8f812167ea579cc390e4f93bc5abde00582f4",
        "9075",
      ],
      [
        "v4Quoter",
        "0x6bf436d72a17f87284ddcab43094689bd320dfb39b535213b9a0b669fabc4ab4",
        "9074",
      ],
      [
        "universalRouter",
        "0xdfb76494e158d8dea4376160315239271636a18515207fd4526e574bc7eeb456",
        "3347899",
      ],
    ];
    const externalEvidenceValid =
      chainDeployment.externalRootDeploymentEvidence.every((evidence, index) => {
        const [contract, transactionHash, startBlock] =
          externalRootConstants[index];
        const root = chainBindings[contract];
        const readbacksValid = evidence.providerReadbacks.every(
          (readback, providerIndex) => {
            const { evidenceDigest, ...withoutDigest } = readback;
            const expectedProvider = [
              ["quicknode", "quicknode.com"],
              ["alchemy", "alchemy.com"],
            ][providerIndex];
            return readback.providerId === expectedProvider[0] &&
              readback.trustDomain === expectedProvider[1] &&
              readback.transactionHash === transactionHash &&
              readback.blockNumber === startBlock &&
              readback.blockHash === evidence.blockHash &&
              sameHex(readback.runtimeCodeHash, root.runtimeCodeHash) &&
              evidenceDigest === canonicalSha256(
                "programmable.custom-launch-deployment-provider-readback.v1",
                withoutDigest,
              );
          },
        );
        const { evidenceDigest, ...withoutDigest } = evidence;
        return evidence.contract === contract &&
          evidence.transactionHash === transactionHash &&
          evidence.startBlock === startBlock &&
          canonicalizeJson(evidence.registrySource) ===
            canonicalizeJson(uniswapRegistrySource) && readbacksValid &&
          evidenceDigest === canonicalSha256(
            "programmable.custom-launch-deployment-evidence.v1",
            withoutDigest,
          );
      });
    const exact =
      chainDeployment.chainDeploymentId === binding.chainDeploymentId &&
      chainDeployment.chainDeploymentId === v4.chainDeploymentId &&
      chainDeployment.chainId === "4663" &&
      chainDeployment.caip2 === "eip155:4663" &&
      chainDeployment.foundationSourceCommitment ===
        binding.foundationSourceCommitment &&
      chainDeployment.foundationSourceCommitment ===
        v4.foundationSourceCommitment &&
      canonicalizeJson(chainDeployment.finality) ===
        canonicalizeJson(binding.finalityPolicy) &&
      canonicalizeJson(chainDeployment.finality) ===
        canonicalizeJson(v4.finalityPolicy) && profileMatches &&
      contractsMatch && externalRootsMatch && externalEvidenceValid &&
      permitAuthoritySourceDigest === canonicalSha256(
        permitAuthoritySource.schemaVersion,
        permitAuthoritySourceWithoutDigest,
      ) && atomic.schemaVersion ===
        "programmable.robinhood-atomic-root-deployment-evidence.v1" &&
      atomic.deploymentId === "robinhood-mainnet-custom-launch-v1" &&
      atomic.chainId === "4663" &&
      atomic.from !== undefined && [
        "0x032b1c7b96793717F0BD2f11eb86cd10CdefC4a3",
        "0x2Bb333d48DFAF1596D9036671d2E43168994249E",
      ].includes(atomic.from) &&
      atomic.to === "0xcA11bde05977b3631167028862bE2a173976CA11" &&
      atomic.valueWei === "0" && atomic.selector === "0x82ad56cb" &&
      atomic.calldataHash ===
        "0x3ba04469085b17e12843a94c154a335c9c384837f8f6531f179cb4915fd237d9" &&
      atomic.calldataBytes === 33_412 && atomic.receiptStatus === "1" &&
      atomic.receiptLogsDigest === canonicalSha256(
        "programmable.robinhood-atomic-root-deployment-receipt-logs.v1",
        atomic.receiptLogs,
      ) && atomicProviderReadbacksValid && atomicResultsValid &&
      safeConfiguration.atomicRootStateEvidenceDigest ===
        atomic.resultingContracts[0].stateEvidenceDigest &&
      canonicalizeJson(atomic.ethereumFinalityEvidence) ===
        canonicalizeJson(ethereumFinality) &&
      atomicDigest === canonicalSha256(atomic.schemaVersion, atomicWithoutDigest) &&
      publication.chainDeploymentDescriptorDigest ===
        v4.chainDeploymentDescriptorDigest &&
      publication.finalizedFeedUrl === finalizedFeedUrl &&
      publication.finalizedFeedUrl === chainProfile?.finalizedFeedUrl &&
      publication.finalizedFeedUrl === readModel?.finalizedFeedUrl &&
      publication.routerEventEvidenceDigest === eventEvidenceDigest &&
      publication.routerGetterEvidenceDigest === getterEvidenceDigest &&
      publicationDigest === expectedPublicationDigest &&
      deployment.finalityEvidence === expectedFinalityEvidence &&
      chainBindings.programmableLaunchStampRouter.provenance ===
        "deployment-block" &&
      chainBindings.programmableLaunchStampRouter.startBlock ===
        chainDeployment.deploymentEvidence.blockNumber &&
      chainBindings.programmableLaunchStampRouter.startBlock ===
        router.startBlock &&
      chainBindings.graphFactory.provenance === "deployment-block" &&
      chainBindings.graphFactory.startBlock ===
        chainDeployment.deploymentEvidence.blockNumber &&
      chainBindings.permitAuthority.provenance === "deployment-block" &&
      chainBindings.permitAuthority.startBlock ===
        chainDeployment.deploymentEvidence.blockNumber &&
      chainDeployment.permitAuthoritySourceProvenance.transactionHash ===
        chainDeployment.deploymentEvidence.transactionHash &&
      chainDeployment.permitAuthoritySourceProvenance.blockNumber ===
        chainDeployment.deploymentEvidence.blockNumber &&
      chainDeployment.permitAuthoritySourceProvenance.blockHash ===
        chainDeployment.deploymentEvidence.blockHash &&
      safeConfiguration.blockNumber === deployment.blockNumber &&
      safeConfiguration.blockHash === deployment.blockHash &&
      ethereumFinality.l2Checkpoint.blockNumber === deployment.blockNumber &&
      ethereumFinality.l2Checkpoint.blockHash === deployment.blockHash &&
      canonicalizeJson(ethereumFinality.profile) ===
        canonicalizeJson(v4.profile) &&
      ethereumFinalityDigest === canonicalSha256(
        ethereumFinality.schemaVersion,
        ethereumFinalityWithoutDigest,
      ) && safeConfigurationDigest === canonicalSha256(
        safeConfiguration.schemaVersion,
        safeConfigurationWithoutDigest,
      ) && BigInt(ethereumFinality.ethereumFinalizedCheckpoint.blockNumber) >=
        BigInt(ethereumFinality.postingBlockNumber) &&
      chainBindings.permit2.provenance === "genesis-allocation" &&
      chainBindings.permit2.startBlock === "0" &&
      chainDeployment.permit2GenesisProvenance.startBlock === "0" &&
      chainDeployment.permit2GenesisProvenance.genesisSourceUrl ===
        "https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-genesis.json" &&
      chainDeployment.permit2GenesisProvenance.genesisSourceDigest ===
        "sha256:353e6f6441b47695b41cee0c3645cde8dd7492d2f7f574bfb6aa4371e41bb6ba" &&
      chainDeployment.permit2GenesisProvenance.allocRuntimeCodeBytes ===
        9_152 && permit2ReadbacksValid &&
      permit2Genesis.providerReadbacks[0].blockHash ===
        permit2Genesis.providerReadbacks[1].blockHash &&
      permit2GenesisDigest === canonicalSha256(
        permit2Genesis.schemaVersion,
        permit2GenesisWithoutDigest,
      ) &&
      sameHex(
        chainDeployment.permit2GenesisProvenance.address,
        chainBindings.permit2.address,
      ) && sameHex(
        chainDeployment.permitAuthoritySourceProvenance
          .configurationEvidence.proxyRuntimeCodeHash,
        chainBindings.permitAuthority.runtimeCodeHash,
      ) && sameHex(router.address, chainBindings
        .programmableLaunchStampRouter.address) &&
      sameHex(router.runtimeCodeHash, chainBindings
        .programmableLaunchStampRouter.runtimeCodeHash) &&
      deployment.transactionHash ===
        chainDeployment.deploymentEvidence.transactionHash &&
      deployment.blockNumber ===
        chainDeployment.deploymentEvidence.blockNumber &&
      deployment.blockHash === chainDeployment.deploymentEvidence.blockHash &&
      deployment.startBlock === router.startBlock &&
      deployment.transactionHash ===
        router.deploymentEvidence.deploymentTransactionHash &&
      deployment.blockNumber ===
        router.deploymentEvidence.deploymentBlockNumber &&
      deployment.blockHash === router.deploymentEvidence.deploymentBlockHash &&
      deployment.finalizedBlockNumber ===
        router.deploymentEvidence.finalizedBlockNumber &&
      deployment.finalizedBlockHash ===
        router.deploymentEvidence.finalizedBlockHash &&
      router.events.launchStamped.signature ===
        "ProgrammableLaunchStampedV1(bytes32,address,address,address,bytes32,bytes32)" &&
      router.events.launchRouteStamped.signature ===
        "ProgrammableLaunchRouteStampedV1(bytes32,uint8,bytes32,bytes32,bytes32)" &&
      router.getters.launchWallet.signature === "launchStamp(bytes32)" &&
      router.getters.launchWallet.result === "stamp-record.launchWallet" &&
      router.getters.stampRequestHash.signature ===
        "computeStampRequestHash((bytes32,address,bytes32,(address,address,uint24,int24,address),bytes32,(uint8,address,bytes32,uint8,uint8)[]))" &&
      router.getters.stampRequestHash.selector === "0x1f2efd85";
    return exact ? [] : [finding(
      "ROBINHOOD_CUSTOM_LAUNCH_FINALIZED_BINDING",
      "/robinhoodCustomLaunchBinding",
      "Finalized Robinhood deployment, profile, Router and publication evidence disagree",
    )];
  } catch {
    return [finding(
      "ROBINHOOD_CUSTOM_LAUNCH_FINALIZED_BINDING",
      "/robinhoodCustomLaunchBinding",
      "Finalized Robinhood evidence is incomplete or malformed",
    )];
  }
}

export function validateManifestSemantics(manifest) {
  const findings = [];
  if (manifest.schemaVersion === "2.0.0" && manifest.platformId !== PLATFORM_ID) {
    findings.push(
      finding(
        "PLATFORM_IDENTITY",
        "/platformId",
        "Manifest platform identity is not canonical",
      ),
    );
  }
  if (`eip155:${manifest.chainId}` !== manifest.network?.caip2) {
    findings.push(
      finding("CHAIN_IDENTITY", "/network/caip2", "CAIP-2 identity does not match chainId"),
    );
  }
  if (
    manifest.schemaVersion === "2.0.0" &&
    manifest.caip2 !== `eip155:${manifest.chainId}`
  ) {
    findings.push(
      finding("CHAIN_IDENTITY", "/caip2", "Root CAIP-2 identity does not match chainId"),
    );
  }
  if (manifest.platformFee !== undefined) {
    if (
      manifest.platformFee?.ratePpm !== "1000" ||
      manifest.platformFee?.rateBps !== "10"
    ) {
      findings.push(
        finding("PLATFORM_FEE_RATE", "/platformFee", "Manifest platform fee must be 10 bps"),
      );
    }
    if (
      manifest.platformFee?.recipient?.toLowerCase() !==
      PLATFORM_FEE_RECIPIENT.toLowerCase()
    ) {
      findings.push(
        finding(
          "PLATFORM_FEE_RECIPIENT",
          "/platformFee/recipient",
          "Manifest fee recipient is not canonical",
        ),
      );
    }
  } else if (manifest.publicCategories?.custom?.publicSubmissionStatus === "open") {
    findings.push(finding(
      "PLATFORM_FEE_UNPUBLISHED",
      "/platformFee",
      "An open Custom submission lane must publish its exact fee policy",
    ));
  }
  const deployments = manifest.deployments ?? [];
  for (const duplicate of duplicateValues(deployments.map((item) => item.deploymentId))) {
    findings.push(
      finding("DUPLICATE_DEPLOYMENT", "/deployments", `Duplicate deployment ${duplicate}`),
    );
  }
  for (const [index, deployment] of deployments.entries()) {
    if (
      deployment.startBlock !== null &&
      deployment.endBlock !== null &&
      BigInt(deployment.endBlock) < BigInt(deployment.startBlock)
    ) {
      findings.push(
        finding(
          "DEPLOYMENT_RANGE",
          `/deployments/${index}`,
          "Deployment end block precedes its start block",
        ),
      );
    }
  }
  const registry = manifest.customRegistry;
  if (
    ["planned", "prelaunch"].includes(registry?.status) &&
    (registry.address !== null ||
      registry.startBlock !== null ||
      registry.publicSubmissionsEnabled !== false ||
      (manifest.registryGenerations ?? []).length !== 0)
  ) {
    findings.push(
      finding(
        "PRELAUNCH_REGISTRY",
        "/customRegistry",
        "A planned registry may not publish placeholder deployment facts",
      ),
    );
  }
  if (registry?.status === "live" && manifest.schemaVersion === "2.0.0") {
    const liveGeneration = (manifest.registryGenerations ?? []).find(
      (generation) =>
        generation.status === "live" &&
        generation.address.toLowerCase() === registry.address?.toLowerCase() &&
        generation.startBlock === registry.startBlock &&
        generation.generation === registry.generation,
    );
    if (
      registry.address === null ||
      registry.startBlock === null ||
      registry.generation === null ||
      registry.eventSignature === null ||
      registry.eventTopic === null ||
      registry.abiUrl === null ||
      registry.finalityConfirmations === null ||
      liveGeneration === undefined
    ) {
      findings.push(finding(
        "LIVE_REGISTRY_BINDING",
        "/customRegistry",
        "A live Registry must bind the complete active generation",
      ));
    }
    if (
      registry.publicSubmissionsEnabled === false &&
      manifest.publicCategories?.custom?.publicSubmissionStatus !== "closed"
    ) {
      findings.push(finding(
        "LEGACY_CUSTOM_INTAKE_STATE",
        "/publicCategories/custom/publicSubmissionStatus",
        "A disabled live Registry must publish legacy Custom submission intake as closed",
      ));
    }
  }
  if (registry?.status === "live" && manifest.schemaVersion === "1.0.0"
    && (registry.address === null || registry.startBlock === null
      || registry.publicSubmissionsEnabled !== false)) {
    findings.push(finding(
      "LIVE_REGISTRY_BINDING",
      "/customRegistry",
      "A live v1 Registry must publish its address and start block while public intake remains disabled",
    ));
  }
  const chainIds = new Set((manifest.chains ?? []).map((chain) => chain.chainId));
  const supportedChainIds = manifest.supportedChainIds ?? [];
  if (
    manifest.schemaVersion === "2.0.0" &&
    (!chainIds.has(manifest.chainId) ||
      supportedChainIds.length !== chainIds.size ||
      supportedChainIds.some((chainId) => !chainIds.has(chainId)))
  ) {
    findings.push(finding(
      "SUPPORTED_CHAIN_IDS",
      "/supportedChainIds",
      "supportedChainIds must exactly match the published chain profiles",
    ));
  }
  for (const [index, chain] of (manifest.chains ?? []).entries()) {
    if (chain.caip2 !== `eip155:${chain.chainId}`) {
      findings.push(finding(
        "CHAIN_PROFILE_IDENTITY",
        `/chains/${index}/caip2`,
        "Chain profile CAIP-2 identity must match chainId",
      ));
    }
  }
  const v4 = manifest.customLaunchV4;
  if (v4 !== undefined && (
    v4.chainId !== manifest.chainId ||
    v4.caip2 !== manifest.caip2 ||
    !v4.api?.capabilitiesPath?.includes(`/chains/${manifest.chainId}/`) ||
    !v4.api?.preflightPath?.includes(`/chains/${manifest.chainId}/`) ||
    !v4.api?.collectionPath?.includes(`/chains/${manifest.chainId}/`) ||
    !v4.api?.resourcePath?.includes(`/chains/${manifest.chainId}/`) ||
    !v4.api?.finalizedLaunchesPath?.includes(`/chains/${manifest.chainId}/`)
  )) {
    findings.push(finding(
      "CUSTOM_LAUNCH_V4_CHAIN_BINDING",
      "/customLaunchV4",
      "Custom Launch V4 routes and identities must match the manifest chain",
    ));
  }
  if (v4 !== undefined && manifest.chainId === 4663 &&
    v4.foundationSourceCommitment !==
      "0xe87f5edc2dc839bd87a26a80cb53f14b021e603a1753d27aae3a02862058d730") {
    findings.push(finding(
      "CUSTOM_LAUNCH_V4_FOUNDATION_SOURCE",
      "/customLaunchV4/foundationSourceCommitment",
      "Robinhood Custom Launch V4 must bind the exact foundation source commitment",
    ));
  }
  if (v4 !== undefined && manifest.chainId === 4663 &&
    canonicalizeJson(v4.releaseIdentity) !==
      canonicalizeJson(ROBINHOOD_CUSTOM_LAUNCH_V4_RELEASE_IDENTITY)) {
    findings.push(finding(
      "CUSTOM_LAUNCH_V4_POLICY_SOURCE",
      "/customLaunchV4/releaseIdentity/policySource",
      "Robinhood Custom Launch V4 must bind the exact protected policy source",
    ));
  }
  if (v4?.status === "planned" && (
    v4.chainDeploymentDescriptorDigest !== null || v4.profile !== null ||
    v4.finalityPolicy !== null
  )) {
    findings.push(finding(
      "CUSTOM_LAUNCH_V4_PLANNED_EVIDENCE",
      "/customLaunchV4",
      "A planned V4 lane must not publish deployment, profile or finality trust roots",
    ));
  }
  const readModel = manifest.extensions?.["programmable/read-model-v1"];
  if (v4?.status === "live" && (
    typeof v4.chainDeploymentDescriptorDigest !== "string" ||
    v4.profile === null || v4.finalityPolicy === null ||
    manifest.launchStampRouter?.status !== "live" ||
    readModel?.status !== "live" ||
    readModel?.lastKnownGoodScope !== "chain-id" ||
    readModel?.absenceAuthoritative !== true
  )) {
    findings.push(finding(
      "CUSTOM_LAUNCH_V4_LIVE_READ_MODEL",
      "/customLaunchV4",
      "A live V4 lane must bind exact deployment, profile, finality, Router and chain-scoped read-model evidence",
    ));
  }
  findings.push(...robinhoodCustomLaunchBindingFindings(manifest));
  const registryKeys = [];
  for (const [index, generation] of (manifest.registryGenerations ?? []).entries()) {
    registryKeys.push(
      `${generation.chainId}:${generation.generation}:${generation.address.toLowerCase()}`,
    );
    if (
      generation.caip2 !== `eip155:${generation.chainId}` ||
      !chainIds.has(generation.chainId)
    ) {
      findings.push(finding(
        "REGISTRY_CHAIN_IDENTITY",
        `/registryGenerations/${index}`,
        "Registry generation chain identity must match a published chain profile",
      ));
    }
    if (
      generation.endBlock !== null &&
      BigInt(generation.endBlock) < BigInt(generation.startBlock)
    ) {
      findings.push(finding(
        "REGISTRY_BLOCK_RANGE",
        `/registryGenerations/${index}`,
        "Registry generation end block precedes its start block",
      ));
    }
    const topics = Object.values(generation.events ?? {})
      .map((event) => event.topic0?.toLowerCase())
      .filter(Boolean);
    const expectedTopicCount = generation.generation === "2" ? 15 : 11;
    if (topics.length !== expectedTopicCount || new Set(topics).size !== topics.length) {
      findings.push(finding(
        "REGISTRY_EVENT_SET",
        `/registryGenerations/${index}/events`,
        `Registry generation ${generation.generation} must publish ${expectedTopicCount} distinct canonical event topics`,
      ));
    }
    if (generation.generation === "2") {
      const contracts = generation.contractSet;
      const completeContractSet = GEN2_CONTRACT_ROLES.every((role) =>
        contracts?.[role]?.address &&
        contracts[role].address.toLowerCase() !== ZERO_ADDRESS &&
        contracts[role].runtimeCodeKeccak256 &&
        contracts[role].runtimeCodeKeccak256 !== ZERO_HASH32 &&
        contracts[role].abiUrl
      );
      const addresses = completeContractSet
        ? GEN2_CONTRACT_ROLES.map((role) => contracts[role].address.toLowerCase())
        : [];
      if (!completeContractSet || new Set(addresses).size !== addresses.length ||
        contracts.registry.address.toLowerCase() !== generation.address.toLowerCase() ||
        contracts.registry.runtimeCodeKeccak256 !== generation.runtimeCodeKeccak256 ||
        contracts.registry.abiUrl !== generation.abiUrl) {
        findings.push(finding(
          "REGISTRY_GEN2_CONTRACT_SET",
          `/registryGenerations/${index}/contractSet`,
          "Generation 2 must bind four distinct official contracts and exact Registry address, runtime, and ABI",
        ));
      }
      for (const [eventId, emitterRole] of Object.entries(GEN2_EVENT_EMITTERS)) {
        if (generation.events?.[eventId]?.emitterRole !== emitterRole) {
          findings.push(finding(
            "REGISTRY_GEN2_EVENT_EMITTER",
            `/registryGenerations/${index}/events/${eventId}`,
            `Generation 2 event ${eventId} must bind emitter role ${emitterRole}`,
          ));
        }
      }
    } else if (generation.generation === "1") {
      const authorities = generation.operationAuthorities;
      for (const [operation, expected] of Object.entries(
        GEN1_OPERATION_AUTHORITIES,
      )) {
        const authority = authorities?.[operation];
        if (authority?.role !== expected.role ||
          authority?.roleHash !== expected.roleHash ||
          !Array.isArray(authority?.addresses) ||
          authority.addresses.length === 0) {
          findings.push(finding(
            "REGISTRY_OPERATION_AUTHORITY",
            `/registryGenerations/${index}/operationAuthorities/${operation}`,
            `Generation 1 ${operation} authority must bind the canonical ${expected.role} role and a non-empty address set`,
          ));
        }
      }
      const registrationWriters = (authorities?.registered?.addresses ?? [])
        .map((address) => address.toLowerCase()).sort();
      const legacyWriters = (generation.authorizedWriters ?? [])
        .map((address) => address.toLowerCase()).sort();
      if (registrationWriters.join("\0") !== legacyWriters.join("\0")) {
        findings.push(finding(
          "REGISTRY_REGISTRATION_WRITER_MISMATCH",
          `/registryGenerations/${index}/operationAuthorities/registered`,
          "Generation 1 registration authority must match authorizedWriters exactly",
        ));
      }
    }
  }
  for (const duplicate of duplicateValues(registryKeys)) {
    findings.push(finding(
      "DUPLICATE_REGISTRY_GENERATION",
      "/registryGenerations",
      `Duplicate Registry generation ${duplicate}`,
    ));
  }
  for (const [index, partner] of (manifest.partnerTemplates ?? []).entries()) {
    if (
      partner.totalPartnershipFeeBps !== 20 ||
      partner.partnerShareBps !== 15 ||
      partner.programmableShareBps !== 5 ||
      partner.programmableRecipient.toLowerCase() !==
        PLATFORM_FEE_RECIPIENT.toLowerCase()
    ) {
      findings.push(finding(
        "PARTNER_FEE_POLICY",
        `/partnerTemplates/${index}`,
        "Partner templates must prove exactly 20 bps split 15/5",
      ));
    }
  }
  findings.push(...executableMetadataFindings(manifest.extensions, "/extensions"));
  return findings;
}

export function assertNoFindings(findings, label) {
  if (findings.length > 0) {
    throw new Error(
      `${label} failed semantic validation: ${findings
        .map((item) => `${item.code} ${item.path}: ${item.message}`)
        .join("; ")}`,
    );
  }
}
