const KNOWN_MARKETS = new Set(["uniswap-v4", "contract-priced-market"]);

export function terminalRow(launch) {
  const markets = Array.isArray(launch?.markets) ? launch.markets : [];
  const trustedPlatform = launch?.platformId === "programmable";
  return {
    platformId: trustedPlatform ? "programmable" : null,
    launchId: launch?.launchId ?? null,
    category:
      !trustedPlatform
        ? "Unrecognized"
        : launch?.category === "classic"
        ? "Programmable Classic"
        : launch?.category === "custom"
          ? "Programmable Custom"
          : "Unrecognized",
    chainId: launch?.chainId ?? null,
    tokenAddress: launch?.token?.address ?? null,
    name: launch?.token?.name ?? null,
    symbol: launch?.token?.symbol ?? null,
    lifecycle: launch?.launch?.status ?? "unknown",
    provenanceStatus: launch?.verification?.provenanceStatus ?? "unknown",
    marketCount: markets.length,
    marketKinds: markets.map((market) => market.kind).filter(Boolean),
    unsupportedMarketKinds: markets
      .map((market) => market.kind)
      .filter((kind) => kind && !KNOWN_MARKETS.has(kind)),
    capabilityIds: (launch?.capabilities ?? [])
      .map((capability) => capability.id)
      .filter(Boolean),
    hasActiveMarket: markets.some((market) => market.status === "active"),
  };
}

export function discoverDeploymentAddresses(manifest) {
  const addresses = new Set();
  for (const deployment of manifest?.deployments ?? []) {
    if (deployment.discovery !== "enabled") continue;
    for (const address of Object.values(deployment.contracts ?? {})) {
      if (typeof address === "string") addresses.add(address.toLowerCase());
    }
  }
  if (
    manifest?.customRegistry?.status === "live" &&
    typeof manifest.customRegistry.address === "string"
  ) {
    addresses.add(manifest.customRegistry.address.toLowerCase());
  }
  return [...addresses].sort();
}
