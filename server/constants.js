export const API_SCHEMA_VERSION = "1.0.0";
export const LAUNCH_SCHEMA_VERSION = "1.0.0";
export const API_V2_SCHEMA_VERSION = "2.0.0";
export const PLATFORM_ID = "programmable";

export const CHAIN_ID = 1;
export const CHAIN_NAME = "Ethereum";
export const FINALITY_CONFIRMATIONS = 12;
export const CLASSIC_CATALOG_SOURCE_URL =
  "https://programmable.market/api/explore";
export const CLASSIC_CATALOG_SOURCE = Object.freeze({
  schemaVersion: "programmable.explore-data-quality.v1",
  catalogSource: "envio-classic-v3",
  launchSource:
    "envio-classic-v3+registry.custom-launched+canonical-launch-stamp-router",
  evidenceKind: "envio-indexer-state",
  requiredScope: Object.freeze(["classic-v3", "classic-v4"]),
  requiredExcludedScope: Object.freeze([
    "classic-v1",
    "classic-v2",
    "stock-paired-v1",
    "stock-paired-v2",
    "stock-paired-v3",
  ]),
  activeReleases: Object.freeze(["classic-v3", "classic-v4"]),
});

export const PLATFORM_FEE = Object.freeze({
  feeBps: 10,
  chargeMode: "included",
  basis: "executed-gross-quote-volume",
  beneficiary: "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
  scope: "canonical-market",
});

export const RELEASES = Object.freeze([
  {
    id: "classic-v3",
    deploymentId: "ethereum-classic-v3",
    modelVersion: "3",
    category: "classic",
    modelId: "classic",
    origin: "first-party",
    status: "available",
    launcher: "0xC3bd04aAc2fb2ba58efD7Eb673E544E0B80De770",
    startBlock: 25_639_596,
    hook: "0x35Fe236EA82F7cF525c9719d7df8F49F94D720CC",
    launchTopic:
      "0xf23bd7fdf96caf9195ba5982de473632f59015abc714915dfbbe06cbd8e255e5",
    launchEvent:
      "MemeTokenLaunchedV2(address,address,bytes32,address,address,address,uint256,uint16,uint16,bytes32,bytes32)",
    decoder: "classic-v3",
  },
  {
    id: "classic-v4",
    deploymentId: "ethereum-classic-v4",
    modelVersion: "4",
    category: "classic",
    modelId: "classic",
    origin: "first-party",
    status: "available",
    launcher: "0xBBDF30a2fE1394e4AA864aC269C6cF09b518E699",
    startBlock: 25_853_086,
    hook: "0xADF955a44FD7F009380240d56D71dFAfB46020cc",
    launchTopic:
      "0xf23bd7fdf96caf9195ba5982de473632f59015abc714915dfbbe06cbd8e255e5",
    launchEvent:
      "MemeTokenLaunchedV2(address,address,bytes32,address,address,address,uint256,uint16,uint16,bytes32,bytes32)",
    decoder: "classic-v3",
  },
]);

export const RELEASE_BY_LAUNCHER = new Map(
  RELEASES.map((release) => [release.launcher.toLowerCase(), release]),
);

export const RELEASE_BY_ID = new Map(
  RELEASES.map((release) => [release.id, release]),
);

export const LAUNCH_EVENT_GROUPS = Object.freeze([
  {
    topic: RELEASE_BY_ID.get("classic-v3").launchTopic,
    addresses: [
      RELEASE_BY_ID.get("classic-v3").launcher,
      RELEASE_BY_ID.get("classic-v4").launcher,
    ],
  },
]);

export const LAUNCH_DISCOVERY_FILTER = Object.freeze({
  addresses: RELEASES.map((release) => release.launcher),
  topics: [...new Set(RELEASES.map((release) => release.launchTopic))],
});

export const PUBLIC_RPC_URLS = Object.freeze([
  "https://eth.drpc.org",
  "https://mainnet.gateway.tenderly.co",
  "https://rpc.mevblocker.io",
  "https://ethereum-rpc.publicnode.com",
  "https://eth-mainnet.public.blastapi.io",
]);

export const REQUEST_LIMITS = Object.freeze({
  classicCatalogTimeoutMs: 6_000,
  classicCatalogResponseBytes: 2_000_000,
  rpcTimeoutMs: 5_000,
  rpcResponseBytes: 5_000_000,
  rpcLogRange: 10_000,
  maximumGapBlocks: 24_000,
  maximumGapLaunches: 500,
  metadataConcurrency: 6,
  defaultPageSize: 100,
  maximumPageSize: 100,
  cacheMs: 15_000,
  registryTimeoutMs: 8_000,
  registryResponseBytes: 8_388_608,
  registryPageSize: 100,
  registryMaximumPages: 1_000,
  registryMaximumLaunches: 100_000,
});
