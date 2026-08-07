#!/usr/bin/env node

import {
  fetchJson,
  formatSourceWarning,
  launchIdentity,
  launchRecords,
  nextCursor,
  normalizedAddress,
  provenanceManifestMatch,
  verificationSummary,
} from "./lib/programmable-client.mjs";

const requestedAddress = normalizedAddress(process.argv[2]);
const requestedChain = process.argv[3] || process.env.PROGRAMMABLE_CHAIN_ID || null;

if (!requestedAddress) {
  console.error(
    "Usage: node examples/wallet-provenance.mjs <token-address> [chain-id]",
  );
  process.exitCode = 2;
} else {
  const manifest = await fetchJson("/api/v2/manifest");
  const matches = [];
  const seenMatches = new Set();
  let cursor;
  let pages = 0;
  const maxPages = Number.parseInt(process.env.PROGRAMMABLE_MAX_PAGES || "100", 10);

  do {
    const feed = await fetchJson("/api/v2/launches", { cursor, limit: 100 });
    const warning = formatSourceWarning(feed);
    if (warning) console.warn(`Warning: ${warning}`);

    for (const launch of launchRecords(feed)) {
      const identity = launchIdentity(launch);
      if (identity.platformId !== "programmable") continue;
      if (
        normalizedAddress(identity.token.address) === requestedAddress &&
        (!requestedChain || identity.chainId === String(requestedChain))
      ) {
        const matchKey = `${identity.chainId}:${identity.launchId}`;
        if (!seenMatches.has(matchKey)) {
          seenMatches.add(matchKey);
          matches.push(launch);
        }
      }
    }

    const followingCursor = nextCursor(feed);
    cursor = followingCursor && followingCursor !== cursor ? followingCursor : null;
    pages += 1;
  } while (cursor && pages < maxPages);

  if (!matches.length) {
    console.log("No Programmable launch record found for this token.");
    console.log("Absence from this feed is not proof that a token is safe or unsafe.");
    process.exitCode = 1;
  }

  for (const launch of matches) {
    const identity = launchIdentity(launch);
    const verification = verificationSummary(launch);
    const manifestMatch = provenanceManifestMatch(manifest, verification);

    console.log(`${identity.token.symbol} on chain ${identity.chainId}`);
    console.log(`  Programmable category: ${identity.category}`);
    console.log(`  Launch ID: ${identity.launchId}`);
    console.log(`  Feed verification state: ${verification.status}`);
    console.log(`  Manifest source ID: ${verification.sourceId ?? "not declared"}`);
    console.log(`  Registry: ${verification.registryAddress ?? "not declared"}`);
    console.log(`  Launcher: ${verification.launcherAddress ?? "not declared"}`);
    console.log(
      `  Declared ${manifestMatch.role} matches its manifest role: ${manifestMatch.matched ? "yes" : "no"}`,
    );
    console.log(`  Transaction: ${verification.transactionHash ?? "not declared"}`);
    console.log(`  Block: ${verification.blockNumber ?? "not declared"}`);
    console.log(`  Source: ${verification.sourceUrl ?? "not declared"}`);
    console.log("");
  }

  console.log(
    "This is a provenance summary from the public feed, not an audit or an instruction to transact.",
  );
}
