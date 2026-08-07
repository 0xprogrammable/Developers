import genesisCanary from
  "../fixtures/v2/launches/custom-registry-genesis-canary.json" with { type: "json" };

import { canonicalSha256 } from "./canonical.js";

const DOMAIN = "programmable.custom-registry-genesis-canary-public-record.v1";
export const GENESIS_CANARY_RECORD_DIGEST =
  "sha256:9bebebc0317b1b81dd71796fdd79b4516466e3e9c85c2113701fb42779da7d3a";

function recordDigest(value) {
  try {
    return canonicalSha256(DOMAIN, value);
  } catch {
    return null;
  }
}

if (recordDigest(genesisCanary) !== GENESIS_CANARY_RECORD_DIGEST) {
  throw new Error("Custom Registry genesis canary fixture digest is invalid");
}

export const CUSTOM_REGISTRY_GENESIS_CANARY = Object.freeze(
  structuredClone(genesisCanary),
);

export function isExactCustomRegistryGenesisCanary(value) {
  return recordDigest(value) === GENESIS_CANARY_RECORD_DIGEST;
}
