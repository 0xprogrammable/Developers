const DEFAULT_API_BASE = "https://developers.programmable.family";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export function apiBase() {
  const raw = process.env.PROGRAMMABLE_API_BASE || DEFAULT_API_BASE;
  const url = new URL(raw);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PROGRAMMABLE_API_BASE must use http or https");
  }

  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

export async function fetchJson(pathname, search = {}) {
  const url = new URL(pathname.replace(/^\//, ""), apiBase());

  for (const [name, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  const timeoutMs = positiveInteger(
    process.env.PROGRAMMABLE_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  const attempts = positiveInteger(
    process.env.PROGRAMMABLE_RETRY_ATTEMPTS,
    DEFAULT_RETRY_ATTEMPTS,
  );
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "programmable-developers-reference-consumer/1.0",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastError = new Error(
        `Programmable API request failed: ${safeDisplayText(error?.message, "network error", 300)}`,
        { cause: error },
      );
      if (attempt === attempts) throw lastError;
      await wait(retryDelayMs(null, attempt));
      continue;
    }

    if (response.ok) return response.json();

    const detail = safeDisplayText(await response.text(), "", 500);
    lastError = new Error(
      `Programmable API returned ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
    );
    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === attempts) {
      throw lastError;
    }
    await wait(retryDelayMs(response.headers.get("retry-after"), attempt));
  }

  throw lastError ?? new Error("Programmable API request failed");
}

export function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function text(value, fallback = null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function address(value) {
  const candidate = text(value);
  return candidate && /^0x[0-9a-fA-F]{40}$/.test(candidate)
    ? candidate
    : null;
}

export function normalizedAddress(value) {
  return address(value)?.toLowerCase() ?? null;
}

export function launchCategory(launch) {
  const record = object(launch);
  if (text(record.platformId)?.toLowerCase() !== "programmable") return "unknown";
  const category = text(record.category)?.toLowerCase();
  return category === "classic" || category === "custom" ? category : "unknown";
}

export function tokenSummary(launch) {
  const token = object(object(launch).token);
  const metadata = object(token.metadata);
  const tokenAddress = address(token.address);

  return {
    address: tokenAddress,
    name: safeDisplayText(token.name, "Unknown token", 128),
    symbol: safeDisplayText(token.symbol, "UNKNOWN", 32),
    decimals: Number.isInteger(token.decimals) ? token.decimals : null,
    image: text(metadata.imageUrl ?? token.image ?? token.imageUrl ?? token.logoURI),
  };
}

export function launchIdentity(launch) {
  const record = object(launch);
  const token = tokenSummary(record);
  const assets = Array.isArray(record.assets)
    ? record.assets.filter(
        (value) => value !== null && typeof value === "object" && !Array.isArray(value),
      )
    : [];
  const chainId =
    typeof record.chainId === "string" || Number.isSafeInteger(record.chainId)
      ? String(record.chainId)
      : "unknown";

  return {
    launchId: text(
      record.launchId,
      `${chainId}:${token.address ?? "unknown-token"}`,
    ),
    chainId,
    category: launchCategory(record),
    platformId: text(record.platformId),
    publicLabel: text(
      record.publicLabel,
      launchCategory(record) === "classic"
        ? "Programmable Classic"
        : launchCategory(record) === "custom"
          ? "Programmable Custom"
          : "Unknown launch",
    ),
    projectId: text(record.projectId),
    token,
    assets,
  };
}

export function capabilitiesOf(launch) {
  const values = Array.isArray(object(launch).capabilities)
    ? object(launch).capabilities
    : [];

  return values.map((value, index) => {
    if (typeof value === "string") {
      return {
        type: value,
        version: null,
        status: "unknown",
        declaration: value,
      };
    }

    const declaration = object(value);
    return {
      type: text(
        declaration.type ?? declaration.id ?? declaration.capability,
        `unknown:${index}`,
      ),
      version: text(declaration.version),
      status: text(declaration.status, "unknown"),
      declaration,
    };
  });
}

export function marketsOf(launch) {
  const values = Array.isArray(object(launch).markets) ? object(launch).markets : [];

  return values.map((value, index) => {
    const market = object(value);
    const support = object(market.support);
    return {
      id: text(market.marketId ?? market.id, `market:${index}`),
      type: text(market.type ?? market.kind ?? market.marketType, "unknown"),
      status: text(market.status ?? market.state, "unknown"),
      support: {
        discovery: supportState(support.discovery),
        charting: supportState(support.charting),
        quote: supportState(support.quote),
        simulation: supportState(support.simulation),
        execution: supportState(support.execution),
      },
      declaration: market,
    };
  });
}

export function sourceState(document) {
  const root = object(document);
  const statusObject = object(root.status);
  const snapshot = object(root.snapshot);
  const status =
    text(root.status) ?? text(statusObject.state ?? statusObject.status, "unknown");
  const stale = Boolean(
    snapshot.stale === true ||
      statusObject.stale === true ||
      ["stale", "degraded", "unavailable", "error"].includes(
        status.toLowerCase(),
      ),
  );
  const normalizedStatus = status.toLowerCase();
  const degraded = [
    "degraded",
    "partial",
    "unavailable",
    "error",
    "prelaunch",
  ].includes(normalizedStatus);
  const healthy = ["ready", "ready-gap-filled", "healthy", "live"].includes(
    normalizedStatus,
  );

  return {
    status,
    stale,
    degraded,
    safeToCheckpoint: healthy && !stale && !degraded,
    generatedAt: text(
      snapshot.indexedAt ??
        snapshot.generatedAt ??
        snapshot.timestamp ??
        root.generatedAt,
    ),
    lagSeconds:
      Number.isFinite(snapshot.lagSeconds) && snapshot.lagSeconds >= 0
        ? snapshot.lagSeconds
        : null,
  };
}

export function launchRecords(feed) {
  const root = object(feed);
  const values = Array.isArray(root.launches) ? root.launches : root.items;
  if (!Array.isArray(values)) {
    throw new Error("Launch feed is missing its launches/items array");
  }

  return values.filter(
    (value) => value !== null && typeof value === "object" && !Array.isArray(value),
  );
}

export function nextCursor(feed) {
  const root = object(feed);
  const page = object(root.page);

  if (Object.hasOwn(root, "nextCursor")) return text(root.nextCursor);
  if (Object.hasOwn(page, "nextCursor")) return text(page.nextCursor);
  return text(object(root.snapshot).nextCursor);
}

export function checkpointCursor(feed) {
  const root = object(feed);
  return text(object(root.page).resumeCursor) ?? text(object(root.snapshot).cursor);
}

export function verificationSummary(launch) {
  const record = object(launch);
  const verification = object(record.verification);
  const launchEvidence = object(record.launch);
  const registry = object(
    verification.registry ?? verification.originRegistry ?? verification.proof,
  );

  return {
    sourceId: text(verification.sourceId),
    status: text(
      verification.provenanceStatus ?? verification.status ?? verification.state,
      verification.verified === true ? "verified" : "unknown",
    ),
    registryAddress: address(
      verification.registryAddress ??
        verification.originRegistryAddress ??
        registry.address ??
        registry.contractAddress,
    ),
    launcherAddress: address(
      verification.launcherAddress ?? verification.sourceAddress,
    ),
    transactionHash: text(
      launchEvidence.transactionHash ??
        verification.transactionHash ??
        verification.txHash ??
        registry.transactionHash ??
        registry.txHash,
    ),
    blockNumber:
      launchEvidence.blockNumber ??
      verification.blockNumber ??
      registry.blockNumber ??
      null,
    sourceUrl: text(
      verification.sourceUrl ?? verification.repositoryUrl ?? verification.source,
    ),
  };
}

export function advertisedDeploymentAddresses(manifest) {
  const addresses = new Set();
  const root = object(manifest);
  collectManifestAddresses(root.deployments, addresses, 0);
  collectManifestAddresses(root.customRegistry, addresses, 0);
  const routerAddress = normalizedAddress(object(root.launchStampRouter).address);
  if (routerAddress) addresses.add(routerAddress);

  return addresses;
}

export function provenanceManifestMatch(manifest, verification) {
  const root = object(manifest);
  const deployments = Array.isArray(root.deployments) ? root.deployments : [];
  const sourceId = text(verification.sourceId);
  const registryAddress = normalizedAddress(verification.registryAddress);
  const launcherAddress = normalizedAddress(verification.launcherAddress);
  const router = object(root.launchStampRouter);
  const routerAddress = normalizedAddress(router.address);

  if (registryAddress) {
    const registryCandidates = new Set();
    const customRegistryAddress = normalizedAddress(
      object(root.customRegistry).address,
    );
    if (customRegistryAddress) registryCandidates.add(customRegistryAddress);

    for (const deployment of deployments) {
      const contracts = object(object(deployment).contracts);
      for (const value of [contracts.registry, contracts.registryAddress]) {
        const normalized = normalizedAddress(value);
        if (normalized) registryCandidates.add(normalized);
      }
    }

    return {
      role: "registry",
      matched: registryCandidates.has(registryAddress),
      sourceIdMatched:
        !sourceId || deployments.some((deployment) => sourceMatches(deployment, sourceId)),
    };
  }

  if (launcherAddress && routerAddress === launcherAddress) {
    const routerVersion = text(router.version);
    const routerSourceId = routerVersion
      ? `programmable-launch-stamp-router-v${routerVersion}`
      : null;
    return {
      role: "launchStampRouter",
      matched: true,
      sourceIdMatched:
        !sourceId ||
        (routerSourceId !== null && sourceId.toLowerCase() === routerSourceId),
    };
  }

  if (launcherAddress) {
    const matchingDeployment = deployments.find((deployment) => {
      const contracts = object(object(deployment).contracts);
      return (
        normalizedAddress(contracts.launcher ?? contracts.launcherAddress) ===
        launcherAddress
      );
    });
    return {
      role: "launcher",
      matched: Boolean(matchingDeployment),
      sourceIdMatched:
        !sourceId ||
        (matchingDeployment
          ? sourceMatches(matchingDeployment, sourceId)
          : deployments.some((deployment) => sourceMatches(deployment, sourceId))),
    };
  }

  return { role: "none", matched: false, sourceIdMatched: !sourceId };
}

function sourceMatches(deployment, sourceId) {
  const record = object(deployment);
  const normalizedSource = text(sourceId)?.toLowerCase();
  if (!normalizedSource) return true;

  const deploymentId = text(record.deploymentId)?.toLowerCase();
  const modelId = text(record.modelId)?.toLowerCase();
  const modelVersion = text(record.modelVersion)?.toLowerCase();
  const modelRelease =
    modelId && modelVersion ? `${modelId}-v${modelVersion}` : null;

  return (
    normalizedSource === deploymentId ||
    normalizedSource === modelRelease ||
    normalizedSource === `launcher-event:${modelRelease}`
  );
}

function collectManifestAddresses(value, output, depth) {
  if (depth > 8 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const entry of value) collectManifestAddresses(entry, output, depth + 1);
    return;
  }

  if (typeof value === "string") {
    const normalized = normalizedAddress(value);
    if (normalized) output.add(normalized);
    return;
  }

  if (typeof value !== "object") return;

  for (const child of Object.values(value)) {
    collectManifestAddresses(child, output, depth + 1);
  }
}

export function formatSourceWarning(document) {
  const state = sourceState(document);
  if (state.safeToCheckpoint) return null;

  const details = [state.status];
  if (state.stale && state.status.toLowerCase() !== "stale") details.push("stale");
  if (state.lagSeconds !== null) details.push(`${state.lagSeconds}s lag`);
  return `Source is ${details.join(", ")}; keep existing records and retry before treating this as complete.`;
}

export function shortAddress(value) {
  const candidate = address(value);
  return candidate
    ? `${candidate.slice(0, 6)}…${candidate.slice(-4)}`
    : "unknown address";
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function retryDelayMs(retryAfter, attempt) {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 5_000);
  }

  if (retryAfter) {
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay) && dateDelay > 0) {
      return Math.min(dateDelay, 5_000);
    }
  }

  const ceiling = Math.min(250 * 2 ** (attempt - 1), 2_000);
  return Math.floor(Math.random() * (ceiling + 1));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function supportState(value) {
  const normalized = text(value)?.toLowerCase();
  if (["available", "unavailable", "unknown"].includes(normalized)) {
    return normalized;
  }
  if (typeof value === "boolean") return value ? "available" : "unavailable";
  return "unknown";
}

function safeDisplayText(value, fallback, maximumLength) {
  const candidate = text(value);
  if (!candidate) return fallback;

  const cleaned = candidate
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(
      /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
      "",
    )
    .trim();
  return cleaned ? cleaned.slice(0, maximumLength) : fallback;
}
