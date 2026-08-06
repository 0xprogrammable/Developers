#!/usr/bin/env node

import {
  capabilitiesOf,
  fetchJson,
  formatSourceWarning,
  launchIdentity,
  launchRecords,
  marketsOf,
} from "./lib/programmable-client.mjs";

const requestedCapability = process.argv[2]?.trim().toLowerCase() || null;
const feed = await fetchJson("/api/v2/launches", {
  limit: process.env.PROGRAMMABLE_PAGE_SIZE || 100,
});
const warning = formatSourceWarning(feed);
if (warning) console.warn(`Warning: ${warning}`);

for (const launch of launchRecords(feed)) {
  const identity = launchIdentity(launch);
  const capabilities = capabilitiesOf(launch);
  const markets = marketsOf(launch);
  const matchingCapabilities = requestedCapability
    ? capabilities.filter(({ type }) => type.toLowerCase() === requestedCapability)
    : [];

  console.log(
    JSON.stringify({
      launchId: identity.launchId,
      projectId: identity.projectId,
      token: identity.token.address
        ? {
            address: identity.token.address,
            symbol: identity.token.symbol,
          }
        : null,
      assets: identity.assets,
      category: identity.category,
      requestedCapability: requestedCapability
        ? {
            type: requestedCapability,
            declared: matchingCapabilities.length > 0,
            active: matchingCapabilities.some(({ status }) =>
              ["active", "supported"].includes(status.toLowerCase()),
            ),
            statuses: matchingCapabilities.map(({ status }) => status),
          }
        : null,
      capabilities: capabilities.map(({ type, version, status }) => ({
        id: type,
        version,
        status,
      })),
      markets: markets.map(({ id, type, status, support }) => ({
        id,
        type,
        status,
        support,
      })),
      hasActiveMarket: markets.some(({ status }) => status.toLowerCase() === "active"),
      extensionNamespaces: Object.keys(
        launch.extensions !== null &&
          typeof launch.extensions === "object" &&
          !Array.isArray(launch.extensions)
          ? launch.extensions
          : {},
      ),
    }),
  );
}

// Capability and market type strings are open vocabularies. Applications should
// show or store unknown values, but must not infer execution support from them.
