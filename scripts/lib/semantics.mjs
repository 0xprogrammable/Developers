export const PLATFORM_FEE_RECIPIENT =
  "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";

const EXECUTABLE_KEY =
  /(^|[-_.])(calldata|executionurl|execution-url|executiontarget|execution-target|unsignedtransaction|unsigned-transaction|transactionrequest|transaction-request|approvalpayload|approval-payload|signature)([-_.]|$)/i;
const MAX_METADATA_DEPTH = 32;
const MAX_METADATA_NODES = 4_096;
const MAX_METADATA_CHILDREN = 256;

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

export function validateLaunchSemantics(launch) {
  const findings = [];
  const capabilities = launch.capabilities ?? [];
  const markets = launch.markets ?? [];
  const fees = launch.fees ?? [];

  for (const id of duplicateValues(capabilities.map((item) => item.id))) {
    findings.push(
      finding("DUPLICATE_CAPABILITY", "/capabilities", `Duplicate capability ${id}`),
    );
  }
  for (const id of duplicateValues(markets.map((item) => item.marketId))) {
    findings.push(finding("DUPLICATE_MARKET", "/markets", `Duplicate market ${id}`));
  }

  const platformFees = fees.filter((fee) => fee.kind === "programmable-platform");
  if (platformFees.length !== 1) {
    findings.push(
      finding(
        "PLATFORM_FEE_COUNT",
        "/fees",
        "Exactly one Programmable platform fee is required",
      ),
    );
  } else {
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
      ["transactionHash", "blockNumber", "blockHash", "logIndex"].some(
        (key) => launch.launch?.[key] === null,
      )
    ) {
      findings.push(
        finding(
          "VERIFIED_PROVENANCE_INCOMPLETE",
          "/verification/provenanceStatus",
          "Verified provenance requires the exact transaction, block number, block hash, and log index",
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

  const supplyKnown = launch.token?.supplyStatus !== "unavailable";
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
    (supplyKnown &&
      (launch.token?.totalSupplyRaw === null || launch.token?.supplyAsOfBlock === null)) ||
    (!supplyKnown &&
      (launch.token?.totalSupplyRaw !== null || launch.token?.supplyAsOfBlock !== null))
  ) {
    findings.push(
      finding(
        "SUPPLY_CONTRADICTION",
        "/token",
        "Supply value, status, and observation block contradict each other",
      ),
    );
  }

  markets.forEach((market, index) => {
    const path = `/markets/${index}`;
    if (
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
  const tokenKeys = items.map(
    (item) => `${item.chainId}:${item.token?.address?.toLowerCase()}`,
  );
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
    (registry.address !== null || registry.startBlock !== null)
  ) {
    findings.push(
      finding(
        "PRELAUNCH_REGISTRY",
        "/customRegistry",
        "A prelaunch registry may not publish placeholder deployment facts",
      ),
    );
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
