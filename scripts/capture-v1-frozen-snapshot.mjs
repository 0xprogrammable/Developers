import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "snapshots/v1-launches.frozen.json");
const ENVIO_URL = "https://indexer.hyperindex.xyz/f6714ef/v1/graphql";
const RPC_URL = "https://ethereum-rpc.publicnode.com";
const SOURCE = Object.freeze({
  deployment: "production-6157d22",
  sourceCommit: "6157d221f53d70dc1439226365f9be3c1f260b4b",
  anchorBlock: "25856551",
  anchorBlockHash:
    "0xd8c49440d8d12037d632fde66f7151c7d7117ca8481fd8cd9c0ab77dc0208edd",
});
const STOCK_FEE_POLICY_SOURCE = Object.freeze({
  repository: "https://github.com/0xprogrammable/PROGRAMMABLE-EVM",
  commit: "66aae098860c8b6d2d465fbac2b178296359c7f1",
  tree: "523639896a497bcd430ee618aa53570eee189b2c",
  files: Object.freeze({
    "stock-paired-v1": {
      path: "config/stock-paired-assets.v1.json",
      sha256: "fdb4fced3dbda979e6d1153801b91dd9e82bfd22fa3dfd9237f84ffdc252bc2c",
    },
    "stock-paired-v2": {
      path: "config/stock-paired-assets.v2.json",
      sha256: "ba00429a4c8e1a2db973e228951fb05aeb7b7cf1d092d5b2156800e63deee1d6",
    },
    "stock-paired-v3": {
      path: "config/stock-paired-assets.v3.json",
      sha256: "bd8116a7c11a99af13fe0fa74649f54e5912d9ba387ec7f5e68d208ac6bf1a8b",
    },
  }),
  policy: Object.freeze({
    totalSwapFeeBps: 100,
    creatorFeeBps: 90,
    launcherFeeBps: 10,
    transferTaxBps: 0,
    lpFeePips: 0,
  }),
});
const RELEASES = Object.freeze({
  "classic-v1": {
    category: "classic",
    modelId: "classic",
    modelVersion: "1",
    deploymentId: "ethereum-classic-v1",
    launcher: "0x51d702731db281EE223904A4663E05BfCA26C775",
    publishV1: true,
  },
  "classic-v2": {
    category: "classic",
    modelId: "classic",
    modelVersion: "2",
    deploymentId: "ethereum-classic-v2",
    launcher: "0xD240D06f8586eB799f20056054e5b527405E6bAd",
    publishV1: true,
  },
  "classic-v3": {
    category: "classic",
    modelId: "classic",
    modelVersion: "3",
    deploymentId: "ethereum-classic-v3",
    launcher: "0xC3bd04aAc2fb2ba58efD7Eb673E544E0B80De770",
    publishV1: true,
  },
  "classic-v4": {
    category: "classic",
    modelId: "classic",
    modelVersion: "4",
    deploymentId: "ethereum-classic-v4",
    launcher: "0xBBDF30a2fE1394e4AA864aC269C6cF09b518E699",
    publishV1: false,
  },
  "stock-paired-v1": {
    category: "custom",
    modelId: "stock-paired",
    modelVersion: "1",
    deploymentId: "ethereum-stock-paired-v1",
    launcher: "0x195750f33caD5eF2DF857a53226B421297A1e79e",
    publishV1: true,
    fixedFees: STOCK_FEE_POLICY_SOURCE.policy,
  },
  "stock-paired-v2": {
    category: "custom",
    modelId: "stock-paired",
    modelVersion: "2",
    deploymentId: "ethereum-stock-paired-v2",
    launcher: "0x5eA6Be24838061bA45dbE8D82DE1b267DC240Daf",
    publishV1: true,
    fixedFees: STOCK_FEE_POLICY_SOURCE.policy,
  },
  "stock-paired-v3": {
    category: "custom",
    modelId: "stock-paired",
    modelVersion: "3",
    deploymentId: "ethereum-stock-paired-v3",
    launcher: "0x0573879f72d8eE8B0e5a4Ec5E8bcDb2fCab9E51c",
    publishV1: true,
    fixedFees: STOCK_FEE_POLICY_SOURCE.policy,
  },
});
const LAUNCH_FIELDS = `
  id chainId model releaseVersion launchHash token creator quoteAsset poolId hook
  rewardVault positionRecipient positionTokenId totalSwapFeeBps buySwapFeeBps
  sellSwapFeeBps totalSupply tokenLiquidityAmount lockedTokenDust initialTick
  tickLower tickUpper lpFeePips launchOccurrenceId provenanceValid isComplete
  updatedBlock
`;
const ADDRESS = /^0x[0-9a-f]{40}$/u;
const HASH32 = /^0x[0-9a-f]{64}$/u;
const DECIMAL = /^(0|[1-9][0-9]*)$/u;
const CLASSIC_V1 = Object.freeze({
  row: {
    id: "1:classic-v1:0x7451fa2c75b5cb25a23c1f2df1341850ad590f7ca1e836af3d7e81261f7d7f1a",
    chainId: 1,
    model: "classic",
    releaseVersion: "classic-v1",
    launchHash: "0x7451fa2c75b5cb25a23c1f2df1341850ad590f7ca1e836af3d7e81261f7d7f1a",
    token: "0xe6e18f5b16e2c5a43c7f86731be22bb81704469f",
    creator: "0x2bb333d48dfaf1596d9036671d2e43168994249e",
    quoteAsset: null,
    poolId: "0xc9883d4a9adb9613503409efaa5e6f57326f80895b8a29c2c9f9dad57407f280",
    hook: "0x48bb2672c7fd2a12e7fb5d46c441ccd3726520cc",
    rewardVault: null,
    positionRecipient: "0x4ee3877a8615fb37627a3d42dbc192f28aba26a0",
    positionTokenId: "351125",
    totalSwapFeeBps: 100,
    buySwapFeeBps: null,
    sellSwapFeeBps: null,
    totalSupply: null,
    tokenLiquidityAmount: null,
    lockedTokenDust: null,
    initialTick: null,
    tickLower: null,
    tickUpper: null,
    lpFeePips: null,
    launchOccurrenceId:
      "1:0xf9bf63f5be2c278a741e4d88fb1f5118795a0e44c7370de84c771a6f888f7ddd:0x5be3f866f7f4dc1ec4e6d0dd47953c6620d945a972f1b3245e3cbc6bf69ae85e:329",
    provenanceValid: true,
    isComplete: true,
    updatedBlock: "25622090",
  },
  event: {
    id: "1:0xf9bf63f5be2c278a741e4d88fb1f5118795a0e44c7370de84c771a6f888f7ddd:0x5be3f866f7f4dc1ec4e6d0dd47953c6620d945a972f1b3245e3cbc6bf69ae85e:329",
    blockNumber: "25622090",
    blockHash: "0xf9bf63f5be2c278a741e4d88fb1f5118795a0e44c7370de84c771a6f888f7ddd",
    blockTimestamp: "1785130523",
    transactionHash: "0x5be3f866f7f4dc1ec4e6d0dd47953c6620d945a972f1b3245e3cbc6bf69ae85e",
    transactionIndex: "98",
    blockGlobalLogIndex: "329",
    sourceAddress: "0x51d702731db281ee223904a4663e05bfca26c775",
    eventName: "MemeTokenLaunched",
    model: "classic",
    releaseVersion: "classic-v1",
  },
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])]),
  );
}

function canonical(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

async function graphql(query, variables = {}) {
  const response = await fetch(ENVIO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Envio returned HTTP ${response.status}`);
  const value = await response.json();
  if (value.errors) throw new Error(`Envio rejected snapshot query: ${JSON.stringify(value.errors)}`);
  return value.data;
}

async function readState() {
  const data = await graphql(`query { IndexerState(limit: 2) {
    id deployment sourceCommit chainId progressBlock progressBlockHash
  } }`);
  if (!Array.isArray(data.IndexerState) || data.IndexerState.length !== 1) {
    throw new Error("Envio state cardinality changed");
  }
  const state = data.IndexerState[0];
  if (
    state.id !== "ethereum-mainnet" ||
    state.deployment !== SOURCE.deployment ||
    state.sourceCommit !== SOURCE.sourceCommit ||
    state.chainId !== 1 ||
    BigInt(state.progressBlock) < BigInt(SOURCE.anchorBlock)
  ) throw new Error("Envio state does not cover the reviewed v1 boundary");
  return state;
}

async function readLaunches() {
  const rows = [];
  let after = "";
  for (;;) {
    const data = await graphql(
      `query($after: String!) { Launch(
        where: { id: { _gt: $after } }, limit: 250, order_by: { id: asc }
      ) { ${LAUNCH_FIELDS} } }`,
      { after },
    );
    if (!Array.isArray(data.Launch) || data.Launch.length > 250) {
      throw new Error("Envio launch page is invalid");
    }
    if (data.Launch.length === 0) break;
    for (const row of data.Launch) {
      if (row.id <= after) throw new Error("Envio launches are not strictly ordered");
      if (RELEASES[row.releaseVersion] && BigInt(row.updatedBlock) <= BigInt(SOURCE.anchorBlock)) {
        rows.push(row);
      }
      after = row.id;
    }
    if (data.Launch.length < 250) break;
  }
  return rows;
}

async function readEvents(ids) {
  const events = new Map();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const page = ids.slice(offset, offset + 100);
    const data = await graphql(
      `query($ids: [String!]!) { ChainEvent(where: { id: { _in: $ids } }, limit: 100) {
        id blockNumber blockHash blockTimestamp transactionHash transactionIndex
        blockGlobalLogIndex sourceAddress eventName model releaseVersion
      } }`,
      { ids: page },
    );
    for (const event of data.ChainEvent ?? []) events.set(event.id, event);
  }
  if (events.size !== ids.length) throw new Error("Envio launch event evidence is incomplete");
  return events;
}

function decodeString(hex) {
  if (typeof hex !== "string" || !/^0x[0-9a-f]*$/iu.test(hex)) return null;
  const data = hex.slice(2);
  try {
    let payload = data;
    if (data.length >= 128 && BigInt(`0x${data.slice(0, 64)}`) === 32n) {
      const length = Number(BigInt(`0x${data.slice(64, 128)}`));
      if (!Number.isSafeInteger(length) || length < 1 || length > 512) return null;
      payload = data.slice(128, 128 + length * 2);
    } else {
      payload = data.slice(0, 64).replace(/(?:00)+$/u, "");
    }
    const value = Buffer.from(payload, "hex").toString("utf8")
      .replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
    return value ? value.slice(0, 128) : null;
  } catch {
    return null;
  }
}

async function rpcBatch(calls) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(calls),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) {
      const values = await response.json();
      if (Array.isArray(values)) return values;
    }
  }
  throw new Error("Ethereum metadata batch failed");
}

async function rpc(method, params) {
  const [value] = await rpcBatch([{
    jsonrpc: "2.0",
    id: "single",
    method,
    params,
  }]);
  if (value?.error || value?.result === undefined) {
    throw new Error(`Ethereum RPC rejected ${method}`);
  }
  return value.result;
}

async function verifyAnchor() {
  const block = await rpc("eth_getBlockByNumber", [
    `0x${BigInt(SOURCE.anchorBlock).toString(16)}`,
    false,
  ]);
  if (
    BigInt(block?.number ?? -1) !== BigInt(SOURCE.anchorBlock) ||
    block?.hash !== SOURCE.anchorBlockHash
  ) throw new Error("Ethereum anchor block does not match the reviewed Envio boundary");
}

async function readMetadata(rows) {
  const methods = {
    name: "0x06fdde03",
    symbol: "0x95d89b41",
    decimals: "0x313ce567",
    totalSupplyRaw: "0x18160ddd",
  };
  const results = new Map(rows.map((row) => [row.token, {}]));
  const calls = rows.flatMap((row) => Object.entries(methods).map(([field, data]) => ({
    jsonrpc: "2.0",
    id: `${row.token}:${field}`,
    method: "eth_call",
    params: [{ to: row.token, data }, {
      blockHash: SOURCE.anchorBlockHash,
      requireCanonical: true,
    }],
  })));
  for (let offset = 0; offset < calls.length; offset += 80) {
    const responses = await rpcBatch(calls.slice(offset, offset + 80));
    for (const response of responses) {
      const [token, field] = String(response.id).split(":");
      const target = results.get(token);
      if (!target || typeof response.result !== "string") continue;
      if (field === "name" || field === "symbol") {
        target[field] = decodeString(response.result);
      } else {
        try {
          const value = BigInt(response.result);
          target[field] = field === "decimals" ? Number(value) : value.toString();
        } catch {
          // Partial token identity is an explicit v1 contract state.
        }
      }
    }
  }
  for (const [token, value] of results) {
    if (
      !value.name || !value.symbol || !Number.isInteger(value.decimals) ||
      value.decimals < 0 || value.decimals > 255 || !DECIMAL.test(value.totalSupplyRaw ?? "")
    ) throw new Error(`token metadata is incomplete at the frozen anchor: ${token}`);
  }
  return results;
}

function sortKey(record) {
  return [
    String(record.launch.blockNumber ?? 0).padStart(16, "0"),
    String(record.launch.transactionIndex ?? 0).padStart(10, "0"),
    String(record.launch.logIndex ?? 0).padStart(10, "0"),
    record.token.address.toLowerCase(),
  ].join(":");
}

function record(row, event, metadata) {
  const release = RELEASES[row.releaseVersion];
  if (
    row.chainId !== 1 || !ADDRESS.test(row.token) || !ADDRESS.test(row.creator) ||
    !HASH32.test(row.poolId) || !HASH32.test(row.launchHash) ||
    event.releaseVersion !== row.releaseVersion || event.model !== row.model ||
    event.blockNumber !== row.updatedBlock ||
    event.sourceAddress.toLowerCase() !== release.launcher.toLowerCase()
  ) throw new Error(`invalid frozen launch evidence: ${row.id}`);
  const complete = Boolean(
    metadata.name && metadata.symbol &&
    Number.isInteger(metadata.decimals) && metadata.decimals >= 0 && metadata.decimals <= 255,
  );
  const quoteAddress = ADDRESS.test(row.quoteAsset ?? "") ? row.quoteAsset : null;
  const totalFee = row.totalSwapFeeBps ?? release.fixedFees?.totalSwapFeeBps ?? null;
  const buyFee = row.buySwapFeeBps ?? totalFee;
  const sellFee = row.sellSwapFeeBps ?? totalFee;
  const market = {
    marketId: `uniswap-v4:${row.poolId}`,
    kind: "uniswap-v4",
    status: "active",
    baseTokenAddress: row.token,
    quoteTokenAddress: quoteAddress,
    protocol: "uniswap-v4",
    poolId: row.poolId,
    poolAddress: null,
    hookAddress: ADDRESS.test(row.hook ?? "") ? row.hook : null,
    support: {
      discovery: "available",
      charting: "unknown",
      quote: "unavailable",
      simulation: "unavailable",
      execution: "unavailable",
    },
    adapter: null,
    metrics: {
      price: { status: "unavailable", value: null },
      liquidity: { status: "unavailable", value: null },
      volume24h: { status: "unavailable", value: null },
      updatedAt: null,
    },
  };
  const value = {
    schemaVersion: "1.0.0",
    platformId: "programmable",
    launchId: `eip155:1:${row.token}`,
    category: release.category,
    chainId: 1,
    token: {
      address: row.token,
      identityStatus: complete ? "complete" : "partial",
      name: metadata.name ?? null,
      symbol: metadata.symbol ?? null,
      decimals: Number.isInteger(metadata.decimals) ? metadata.decimals : null,
      totalSupplyRaw: metadata.totalSupplyRaw ?? row.totalSupply ?? null,
      supplyStatus: metadata.totalSupplyRaw || row.totalSupply ? "observed" : "unavailable",
      supplyAsOfBlock: metadata.totalSupplyRaw ? SOURCE.anchorBlock :
        row.totalSupply ? event.blockNumber : null,
      metadata: { description: null, imageUrl: null, links: null, trustStatus: "unavailable" },
    },
    launch: {
      status: "live",
      origin: "first-party",
      modelId: release.modelId,
      modelVersion: release.modelVersion,
      publicSubmission: false,
      creatorAddress: row.creator,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      transactionIndex: Number(event.transactionIndex),
      logIndex: Number(event.blockGlobalLogIndex),
      timestamp: new Date(Number(event.blockTimestamp) * 1_000).toISOString(),
      finality: "finalized",
    },
    verification: {
      sourceId: release.deploymentId,
      launcherAddress: release.launcher,
      registryAddress: null,
      provenanceStatus: row.provenanceValid && row.isComplete ? "verified" : "partial",
      sourceUrl: `https://etherscan.io/tx/${event.transactionHash}`,
    },
    capabilities: [{ id: "uniswap-v4-pool", version: "1", status: "active", parameters: {} }],
    markets: [market],
    fees: [{
      kind: "programmable-platform",
      ratePpm: 1_000,
      rateBps: 10,
      recipient: "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
      chargeMode: "included",
      basis: "executed-gross-quote-volume",
      assetAddress: quoteAddress,
      verificationStatus: "verified",
    }],
    extensions: {
      "programmable/release": {
        deploymentId: release.deploymentId,
        releaseId: row.releaseVersion,
        modelVersion: release.modelVersion,
        launchHash: row.launchHash,
        rewardVault: ADDRESS.test(row.rewardVault ?? "") ? row.rewardVault : null,
      },
      "programmable/market-disclosure": {
        quoteAssetSymbol: quoteAddress ? null : "ETH",
        quoteAssetName: quoteAddress ? null : "Ether",
        quoteIsCurrency0: null,
        fees: {
          currency: quoteAddress ? null : "ETH",
          currencyAddress: quoteAddress,
          buyTotalFeeBps: buyFee,
          sellTotalFeeBps: sellFee,
          buyProjectFeeBps: buyFee === null ? null : Math.max(0, buyFee - 10),
          sellProjectFeeBps: sellFee === null ? null : Math.max(0, sellFee - 10),
          programmableFeeBps: 10,
          chargeMode: "included",
          transferTaxBps: release.fixedFees?.transferTaxBps ?? null,
          lpFeePips: row.lpFeePips ?? release.fixedFees?.lpFeePips ?? null,
        },
        liquidityPosition: {
          recipient: ADDRESS.test(row.positionRecipient ?? "") ? row.positionRecipient : null,
          tokenId: row.positionTokenId ?? null,
          tokenLiquidityAmountRaw: row.tokenLiquidityAmount ?? null,
          lockedTokenDustRaw: row.lockedTokenDust ?? null,
        },
      },
    },
  };
  return { ...value, sortKey: sortKey(value) };
}

await readState();
await verifyAnchor();
const first = await readLaunches();
const second = await readLaunches();
if (sha256(canonical(first)) !== sha256(canonical(second))) {
  throw new Error("Envio historical inventory moved during capture");
}
const events = await readEvents(first.map((row) => row.launchOccurrenceId));
events.set(CLASSIC_V1.event.id, CLASSIC_V1.event);
const sourceRows = [...first, CLASSIC_V1.row];
const metadata = await readMetadata(sourceRows);
const records = sourceRows
  .map((row) => record(row, events.get(row.launchOccurrenceId), metadata.get(row.token) ?? {}))
  .sort((left, right) => right.sortKey.localeCompare(left.sortKey));
await verifyAnchor();
const counts = Object.fromEntries(Object.keys(RELEASES).map((release) => [
  release,
  records.filter((value) => value.extensions["programmable/release"].releaseId === release).length,
]));
if (
  first.length !== 375 || records.length !== 376 || counts["classic-v1"] !== 1 ||
  counts["classic-v2"] !== 27 || counts["classic-v3"] !== 292 || counts["classic-v4"] !== 1 ||
  counts["stock-paired-v1"] !== 1 || counts["stock-paired-v2"] !== 8 ||
  counts["stock-paired-v3"] !== 46
) throw new Error(`reviewed historical inventory changed: ${JSON.stringify(counts)}`);
const payload = {
  schemaVersion: "programmable.v1-frozen-launch-snapshot.v1",
  status: "frozen",
  generatedAt: new Date().toISOString(),
  source: {
    provider: "envio-cloud",
    url: ENVIO_URL,
    deployment: SOURCE.deployment,
    sourceCommit: SOURCE.sourceCommit,
    anchorBlock: SOURCE.anchorBlock,
    anchorBlockHash: SOURCE.anchorBlockHash,
    envioInventoryCount: first.length,
    envioInventorySha256: sha256(canonical(first)),
    supplementalClassicV1: {
      transactionHash: CLASSIC_V1.event.transactionHash,
      blockNumber: CLASSIC_V1.event.blockNumber,
      blockHash: CLASSIC_V1.event.blockHash,
      logIndex: Number(CLASSIC_V1.event.blockGlobalLogIndex),
      tokenAddress: CLASSIC_V1.row.token,
    },
    stockFeePolicy: STOCK_FEE_POLICY_SOURCE,
    metadataRead: {
      provider: "ethereum-public-rpc",
      blockNumber: SOURCE.anchorBlock,
      blockHash: SOURCE.anchorBlockHash,
      selector: "eip-1898-canonical-block-hash",
    },
  },
  counts: {
    totalEvidenceRecords: records.length,
    v1Published: records.filter((value) =>
      RELEASES[value.extensions["programmable/release"].releaseId].publishV1).length,
    byRelease: counts,
  },
  recordsSha256: sha256(canonical(records)),
  records,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`${OUTPUT}\nrecords=${records.length}\nrecordsSha256=${payload.recordsSha256}`);
