import { isExactCustomRegistryGenesisCanary } from
  "../../server/genesis-canary.js";

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

function validateV2FeePolicy(launch) {
  const findings = [];
  const policy = launch.feePolicy;
  const fees = launch.fees ?? [];
  if (!policy) {
    if (launch.category === "custom") {
      findings.push(finding(
        "FEE_POLICY_REQUIRED",
        "/feePolicy",
        "Every v2 Custom record must disclose one closed fee policy",
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

function validateV2IdentityAndReview(launch) {
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

export function validateLaunchSemantics(launch) {
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
    findings.push(...validateV2IdentityAndReview(launch));
    findings.push(...validateV2FeePolicy(launch));
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
    registry?.status === "prelaunch" &&
    (registry.address !== null ||
      registry.startBlock !== null ||
      registry.publicSubmissionsEnabled !== false ||
      (manifest.registryGenerations ?? []).length !== 0)
  ) {
    findings.push(
      finding(
        "PRELAUNCH_REGISTRY",
        "/customRegistry",
        "A prelaunch registry may not publish placeholder deployment facts",
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
