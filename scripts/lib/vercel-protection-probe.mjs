import { setTimeout as wait } from "node:timers/promises";

export const PROTECTION_PROBE_TIMEOUT_MS = 55_000;
export const PROTECTION_PROBE_RETRY_DELAYS_MS = Object.freeze([
  5_000,
  10_000,
  10_000,
  10_000,
  10_000,
]);

function responseMediaType(response) {
  return response.headers.get("content-type")
    ?.split(";", 1)[0].trim().toLowerCase();
}

function isExpectedUnprotectedPlannedResponse(response) {
  return response.status === 503 &&
    responseMediaType(response) === "application/problem+json" &&
    response.headers.get("x-programmable-status") === "error" &&
    response.headers.get("retry-after") === "30";
}

function isExpectedVercelDeploymentPropagationResponse(response) {
  const vercelId = response.headers.get("x-vercel-id");
  return response.status === 404 && responseMediaType(response) === "text/plain" &&
    response.headers.get("server")?.toLowerCase() === "vercel" &&
    response.headers.get("x-vercel-error") === "DEPLOYMENT_NOT_FOUND" &&
    typeof vercelId === "string" && /^[A-Za-z0-9._:-]{1,200}$/u.test(vercelId);
}

function isExpectedTransientResponse(response) {
  return isExpectedUnprotectedPlannedResponse(response) ||
    isExpectedVercelDeploymentPropagationResponse(response);
}

export async function probeGeneratedDeploymentProtection(url, {
  fetchImpl = globalThis.fetch,
  waitImpl = wait,
  retryDelaysMs = PROTECTION_PROBE_RETRY_DELAYS_MS,
  signal = AbortSignal.timeout(PROTECTION_PROBE_TIMEOUT_MS),
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { accept: "text/html" },
      redirect: "manual",
      signal,
    });
    if (!isExpectedTransientResponse(response) ||
      attempt === retryDelaysMs.length) return response;

    await response.body?.cancel();
    await waitImpl(retryDelaysMs[attempt], undefined, { signal });
  }
}
