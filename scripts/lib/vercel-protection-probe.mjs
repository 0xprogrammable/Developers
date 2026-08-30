import { setTimeout as wait } from "node:timers/promises";

export const PROTECTION_PROBE_TIMEOUT_MS = 55_000;
export const PROTECTION_PROBE_RETRY_DELAYS_MS = Object.freeze([
  5_000,
  10_000,
  10_000,
  10_000,
  10_000,
]);

function isExpectedUnprotectedPlannedResponse(response) {
  const contentType = response.headers.get("content-type")
    ?.split(";", 1)[0].trim().toLowerCase();
  return response.status === 503 && contentType === "application/problem+json" &&
    response.headers.get("x-programmable-status") === "error" &&
    response.headers.get("retry-after") === "30";
}

export async function probeGeneratedDeploymentProtection(url, {
  fetchImpl = globalThis.fetch,
  waitImpl = wait,
  retryDelaysMs = PROTECTION_PROBE_RETRY_DELAYS_MS,
  signal = AbortSignal.timeout(PROTECTION_PROBE_TIMEOUT_MS),
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal,
    });
    if (!isExpectedUnprotectedPlannedResponse(response) ||
      attempt === retryDelaysMs.length) return response;

    await response.body?.cancel();
    await waitImpl(retryDelaysMs[attempt], undefined, { signal });
  }
}
