#!/usr/bin/env node

import {
  advertisedDeploymentAddresses,
  capabilitiesOf,
  fetchJson,
  formatSourceWarning,
  launchIdentity,
  launchRecords,
  marketsOf,
  nextCursor,
  shortAddress,
  sourceState,
} from "./lib/programmable-client.mjs";

const cursor = process.argv[2] || process.env.PROGRAMMABLE_CURSOR;
const limit = process.env.PROGRAMMABLE_PAGE_SIZE || "25";

const manifest = await fetchJson("/api/v2/manifest");
const feed = await fetchJson("/api/v2/launches", { cursor, limit });
const warning = formatSourceWarning(feed);

if (warning) console.warn(`Warning: ${warning}`);

console.log("Programmable launches");
console.log(`Source: ${sourceState(feed).status}`);
console.log(
  `Deployment contracts discovered from manifest: ${advertisedDeploymentAddresses(manifest).size}`,
);
console.log("");

for (const launch of launchRecords(feed)) {
  const identity = launchIdentity(launch);
  const markets = marketsOf(launch);
  const capabilities = capabilitiesOf(launch);
  const marketLabel = markets.length
    ? markets
        .map((market) => {
          const charting = supportLabel(market.support.charting);
          const execution = supportLabel(market.support.execution);
          return `${market.type} (${market.status}; chart ${charting}; execute ${execution})`;
        })
        .join(", ")
    : "launch only — no market declared";

  console.log(
    `${identity.category.toUpperCase()}  ${identity.token.symbol}  ${shortAddress(identity.token.address)}`,
  );
  console.log(`  ${identity.token.name} · chain ${identity.chainId}`);
  console.log(`  markets: ${marketLabel}`);
  console.log(
    `  capabilities: ${capabilities.length ? capabilities.map(({ type }) => type).join(", ") : "none declared"}`,
  );
  console.log(`  launch id: ${identity.launchId}`);
  console.log("");
}

const followingCursor = nextCursor(feed);
console.log(
  followingCursor
    ? `Next page: node examples/terminal-scanner.mjs '${followingCursor}'`
    : "No following page in this snapshot.",
);

// This scanner displays open market and capability strings rather than rejecting
// values it does not recognize. It never constructs or submits a transaction.

function supportLabel(value) {
  if (value === "available" || value === "unavailable") return value;
  return "unknown";
}
