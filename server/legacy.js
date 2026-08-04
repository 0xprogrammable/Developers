import {
  CHAIN_ID,
  LEGACY_SOURCE_URL,
  REQUEST_LIMITS,
} from "./constants.js";
import { readBoundedJson } from "./bounded-body.js";

function boundedInteger(value) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function readLegacyFeed() {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_LIMITS.legacyTimeoutMs,
  );

  try {
    const response = await fetch(LEGACY_SOURCE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "programmable-developer-api/1",
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`legacy source returned HTTP ${response.status}`);

    const payload = await readBoundedJson(
      response,
      REQUEST_LIMITS.legacyResponseBytes,
      "legacy source response",
    );
    if (
      payload?.chainId !== CHAIN_ID ||
      !Array.isArray(payload.tokens) ||
      payload.tokens.length > 100_000
    ) {
      throw new Error("legacy source schema is not supported");
    }

    const snapshotBlock = boundedInteger(payload.snapshot?.blockNumber);
    return {
      reportedStatus:
        typeof payload.status === "string" ? payload.status.slice(0, 64) : null,
      schemaVersion:
        typeof payload.schemaVersion === "string"
          ? payload.schemaVersion.slice(0, 64)
          : null,
      snapshot:
        snapshotBlock === null
          ? null
          : {
              blockNumber: snapshotBlock,
              blockHash:
                typeof payload.snapshot?.blockHash === "string"
                  ? payload.snapshot.blockHash
                  : null,
              confirmations: boundedInteger(payload.snapshot?.confirmations),
            },
      tokens: payload.tokens,
    };
  } finally {
    clearTimeout(timeout);
  }
}
