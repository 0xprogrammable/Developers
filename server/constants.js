export const API_SCHEMA_VERSION = "1.0.0";
export const LAUNCH_SCHEMA_VERSION = "1.0.0";

export const CHAIN_ID = 1;
export const CHAIN_NAME = "Ethereum";
export const FINALITY_CONFIRMATIONS = 12;
export const LEGACY_SOURCE_URL =
  "https://programmable.family/api/indexers/v1/tokens";

export const PLATFORM_FEE = Object.freeze({
  feeBps: 10,
  chargeMode: "included",
  basis: "executed-gross-quote-volume",
  beneficiary: "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
  scope: "canonical-market",
});

export const RELEASES = Object.freeze([
  {
    id: "classic-v1",
    deploymentId: "ethereum-classic-v1",
    modelVersion: "1",
    category: "classic",
    modelId: "classic",
    origin: "first-party",
    status: "retired-live",
    launcher: "0x51d702731db281EE223904A4663E05BfCA26C775",
    startBlock: 25_622_048,
    hook: null,
    launchTopic:
      "0x54f861f401872200b25acd4a9f53153ac06a7be4562b3e43025a4a85740a5675",
    launchEvent:
      "MemeTokenLaunched(address,address,bytes32,address,address,uint256,uint16,bytes32)",
    decoder: "classic-v2",
  },
  {
    id: "classic-v2",
    deploymentId: "ethereum-classic-v2",
    modelVersion: "2",
    category: "classic",
    modelId: "classic",
    origin: "first-party",
    status: "legacy-live",
    launcher: "0xD240D06f8586eB799f20056054e5b527405E6bAd",
    startBlock: 25_624_131,
    hook: "0x025a386eAa79f6067d29848FD05ccC71bEAb20CC",
    launchTopic:
      "0x54f861f401872200b25acd4a9f53153ac06a7be4562b3e43025a4a85740a5675",
    launchEvent:
      "MemeTokenLaunched(address,address,bytes32,address,address,uint256,uint16,bytes32)",
    decoder: "classic-v2",
  },
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
    id: "stock-paired-v1",
    deploymentId: "ethereum-stock-paired-v1",
    modelVersion: "1",
    category: "custom",
    modelId: "stock-paired",
    origin: "first-party",
    status: "candidate-live",
    launcher: "0x195750f33caD5eF2DF857a53226B421297A1e79e",
    startBlock: 25_637_469,
    hook: "0x7773D183fe7B60d4F1885047fa42b815a62Fe0Cc",
    launchTopic:
      "0xe33bd69b6e794281bc106d622fbe0c587aeabf86d1ca4d1afcd583cf8a3e8935",
    launchEvent:
      "StockPairedTokenLaunched(address,address,address,bytes32,address,address,uint256,bytes32)",
    decoder: "stock-paired",
  },
  {
    id: "stock-paired-v2",
    deploymentId: "ethereum-stock-paired-v2",
    modelVersion: "2",
    category: "custom",
    modelId: "stock-paired",
    origin: "first-party",
    status: "candidate-live",
    launcher: "0x5eA6Be24838061bA45dbE8D82DE1b267DC240Daf",
    startBlock: 25_640_338,
    hook: "0x90c67C1E866f86526F0e338459cD435E1F23A0cc",
    launchTopic:
      "0xe33bd69b6e794281bc106d622fbe0c587aeabf86d1ca4d1afcd583cf8a3e8935",
    launchEvent:
      "StockPairedTokenLaunched(address,address,address,bytes32,address,address,uint256,bytes32)",
    decoder: "stock-paired",
  },
  {
    id: "stock-paired-v3",
    deploymentId: "ethereum-stock-paired-v3",
    modelVersion: "3",
    category: "custom",
    modelId: "stock-paired",
    origin: "first-party",
    status: "candidate-live",
    launcher: "0x0573879f72d8eE8B0e5a4Ec5E8bcDb2fCab9E51c",
    startBlock: 25_642_745,
    hook: "0x90c67C1E866f86526F0e338459cD435E1F23A0cc",
    launchTopic:
      "0xe33bd69b6e794281bc106d622fbe0c587aeabf86d1ca4d1afcd583cf8a3e8935",
    launchEvent:
      "StockPairedTokenLaunched(address,address,address,bytes32,address,address,uint256,bytes32)",
    decoder: "stock-paired",
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
    topic: RELEASES[0].launchTopic,
    addresses: RELEASES.filter(
      (release) => release.launchTopic === RELEASES[0].launchTopic,
    ).map((release) => release.launcher),
  },
  {
    topic: RELEASE_BY_ID.get("classic-v3").launchTopic,
    addresses: [RELEASE_BY_ID.get("classic-v3").launcher],
  },
  {
    topic: RELEASE_BY_ID.get("stock-paired-v1").launchTopic,
    addresses: RELEASES.filter(
      (release) => release.modelId === "stock-paired",
    ).map((release) => release.launcher),
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
  legacyTimeoutMs: 6_000,
  legacyResponseBytes: 5_000_000,
  rpcTimeoutMs: 5_000,
  rpcResponseBytes: 5_000_000,
  rpcLogRange: 10_000,
  maximumGapBlocks: 24_000,
  maximumGapLaunches: 500,
  metadataConcurrency: 6,
  defaultPageSize: 100,
  maximumPageSize: 100,
  cacheMs: 15_000,
});
