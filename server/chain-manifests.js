import { readFile } from "node:fs/promises";

export const DEFAULT_CHAIN_ID = 1;
export const ROBINHOOD_CHAIN_ID = 4663;
export const SUPPORTED_CHAIN_IDS = Object.freeze([
  DEFAULT_CHAIN_ID,
  ROBINHOOD_CHAIN_ID,
]);

// Keep literal file URLs at the read sites so serverless dependency tracing
// includes both manifests in every function that consumes this module.
const MANIFEST_READERS = new Map([
  [DEFAULT_CHAIN_ID, () => readFile(
    new URL("../deployments/ethereum-v2.json", import.meta.url), "utf8",
  )],
  [ROBINHOOD_CHAIN_ID, () => readFile(
    new URL("../deployments/robinhood-v2.json", import.meta.url), "utf8",
  )],
]);
const manifestPromises = new Map();

export function isSupportedChainId(chainId) {
  return Number.isSafeInteger(chainId) && MANIFEST_READERS.has(chainId);
}

export async function developerManifestForChain(chainId = DEFAULT_CHAIN_ID) {
  if (!isSupportedChainId(chainId)) {
    const error = new RangeError(`Unsupported Programmable chain ${chainId}`);
    error.code = "CHAIN_NOT_SUPPORTED";
    throw error;
  }
  let manifestPromise = manifestPromises.get(chainId);
  if (!manifestPromise) {
    manifestPromise = MANIFEST_READERS.get(chainId)()
      .then((source) => JSON.parse(source));
    manifestPromises.set(chainId, manifestPromise);
  }
  const manifest = await manifestPromise;
  if (
    manifest.chainId !== chainId ||
    manifest.caip2 !== `eip155:${chainId}` ||
    manifest.network?.caip2 !== manifest.caip2 ||
    !Array.isArray(manifest.supportedChainIds) ||
    !manifest.supportedChainIds.includes(chainId)
  ) {
    throw new Error(`Manifest chain binding is invalid for ${chainId}`);
  }
  return structuredClone(manifest);
}

export async function developerManifestIndex() {
  const manifests = await Promise.all(
    SUPPORTED_CHAIN_IDS.map((chainId) => developerManifestForChain(chainId)),
  );
  return manifests.map((manifest) => {
    const profile = manifest.chains.find(
      (chain) => chain.chainId === manifest.chainId,
    );
    if (!profile) {
      throw new Error(`Manifest chain profile is missing for ${manifest.chainId}`);
    }
    return structuredClone(profile);
  });
}

export function resetChainManifestCacheForTest() {
  manifestPromises.clear();
}
