import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { API_SCHEMA_VERSION, CHAIN_ID } from "./constants.js";

const SNAPSHOT_FILE_SHA256 =
  "34306ba1f55cd2ec5acae2f190c34702ab3e66130a71bf3fc06bea0b976e066b";
const SNAPSHOT_SCHEMA = "programmable.v1-frozen-launch-snapshot.v1";
const V1_RELEASE_COUNTS = Object.freeze({
  "classic-v1": 1,
  "classic-v2": 27,
  "classic-v3": 292,
  "stock-paired-v1": 1,
  "stock-paired-v2": 8,
  "stock-paired-v3": 46,
});
const V1_RELEASES = new Set(Object.keys(V1_RELEASE_COUNTS));
const EXPECTED_SOURCE = Object.freeze({
  deployment: "production-6157d22",
  sourceCommit: "6157d221f53d70dc1439226365f9be3c1f260b4b",
  anchorBlock: "25856551",
  anchorBlockHash:
    "0xd8c49440d8d12037d632fde66f7151c7d7117ca8481fd8cd9c0ab77dc0208edd",
  inventorySha256: "41502b69034d00d532f99166251dc000cd62994ec33b1b0f633f56972927ef37",
});
const CLASSIC_V1_TOKEN = "0xe6e18f5b16e2c5a43c7f86731be22bb81704469f";
const CLASSIC_V4_TOKEN = "0xb382f738a99820276fd66efb94b75eca104c2b4d";
const ADDRESS = /^0x[0-9a-f]{40}$/u;
const HASH32 = /^0x[0-9a-f]{64}$/u;

let snapshotPromise = null;

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

function exactKeys(value, keys) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0"),
  );
}

function validateSnapshot(value, sourceBytes) {
  if (
    sha256(sourceBytes) !== SNAPSHOT_FILE_SHA256 ||
    !exactKeys(value, [
      "schemaVersion", "status", "generatedAt", "source", "counts",
      "recordsSha256", "records",
    ]) ||
    value.schemaVersion !== SNAPSHOT_SCHEMA || value.status !== "frozen" ||
    !Number.isFinite(Date.parse(value.generatedAt)) ||
    value.source?.provider !== "envio-cloud" ||
    value.source?.url !== "https://indexer.hyperindex.xyz/f6714ef/v1/graphql" ||
    value.source?.deployment !== EXPECTED_SOURCE.deployment ||
    value.source?.sourceCommit !== EXPECTED_SOURCE.sourceCommit ||
    value.source?.anchorBlock !== EXPECTED_SOURCE.anchorBlock ||
    value.source?.anchorBlockHash !== EXPECTED_SOURCE.anchorBlockHash ||
    value.source?.envioInventoryCount !== 375 ||
    value.source?.envioInventorySha256 !== EXPECTED_SOURCE.inventorySha256 ||
    value.source?.metadataRead?.blockNumber !== EXPECTED_SOURCE.anchorBlock ||
    value.source?.metadataRead?.blockHash !== EXPECTED_SOURCE.anchorBlockHash ||
    value.source?.metadataRead?.selector !== "eip-1898-canonical-block-hash" ||
    value.source?.stockFeePolicy?.repository !==
      "https://github.com/0xprogrammable/PROGRAMMABLE-EVM" ||
    value.source?.stockFeePolicy?.commit !==
      "66aae098860c8b6d2d465fbac2b178296359c7f1" ||
    value.source?.stockFeePolicy?.tree !==
      "523639896a497bcd430ee618aa53570eee189b2c" ||
    value.source?.stockFeePolicy?.files?.["stock-paired-v1"]?.sha256 !==
      "fdb4fced3dbda979e6d1153801b91dd9e82bfd22fa3dfd9237f84ffdc252bc2c" ||
    value.source?.stockFeePolicy?.files?.["stock-paired-v2"]?.sha256 !==
      "ba00429a4c8e1a2db973e228951fb05aeb7b7cf1d092d5b2156800e63deee1d6" ||
    value.source?.stockFeePolicy?.files?.["stock-paired-v3"]?.sha256 !==
      "bd8116a7c11a99af13fe0fa74649f54e5912d9ba387ec7f5e68d208ac6bf1a8b" ||
    value.source?.stockFeePolicy?.policy?.totalSwapFeeBps !== 100 ||
    value.source?.stockFeePolicy?.policy?.creatorFeeBps !== 90 ||
    value.source?.stockFeePolicy?.policy?.launcherFeeBps !== 10 ||
    value.source?.stockFeePolicy?.policy?.transferTaxBps !== 0 ||
    value.source?.stockFeePolicy?.policy?.lpFeePips !== 0 ||
    value.source?.supplementalClassicV1?.tokenAddress !== CLASSIC_V1_TOKEN ||
    value.source?.supplementalClassicV1?.blockNumber !== "25622090" ||
    value.source?.supplementalClassicV1?.blockHash !==
      "0xf9bf63f5be2c278a741e4d88fb1f5118795a0e44c7370de84c771a6f888f7ddd" ||
    value.source?.supplementalClassicV1?.transactionHash !==
      "0x5be3f866f7f4dc1ec4e6d0dd47953c6620d945a972f1b3245e3cbc6bf69ae85e" ||
    value.source?.supplementalClassicV1?.logIndex !== 329 ||
    value.counts?.totalEvidenceRecords !== 376 ||
    value.counts?.v1Published !== 375 ||
    !Array.isArray(value.records) || value.records.length !== 376 ||
    value.recordsSha256 !== sha256(canonical(value.records))
  ) throw new Error("bundled v1 compatibility snapshot is invalid");

  const v1Records = [];
  const tokens = new Set();
  const releaseCounts = Object.fromEntries([...V1_RELEASES].map((id) => [id, 0]));
  let previousSortKey = null;
  for (const record of value.records) {
    const releaseId = record?.extensions?.["programmable/release"]?.releaseId;
    const token = String(record?.token?.address ?? "").toLowerCase();
    if (
      !ADDRESS.test(token) || !HASH32.test(record?.launch?.transactionHash ?? "") ||
      !HASH32.test(record?.launch?.blockHash ?? "") ||
      typeof record.sortKey !== "string" ||
      (previousSortKey !== null && record.sortKey >= previousSortKey) ||
      tokens.has(token)
    ) throw new Error("bundled v1 compatibility records are invalid");
    previousSortKey = record.sortKey;
    tokens.add(token);
    if (releaseId === "classic-v4") {
      if (token !== CLASSIC_V4_TOKEN) {
        throw new Error("bundled v1 exclusion boundary is invalid");
      }
      continue;
    }
    if (!V1_RELEASES.has(releaseId)) {
      throw new Error("bundled v1 release set is invalid");
    }
    releaseCounts[releaseId] += 1;
    v1Records.push(record);
  }
  if (
    v1Records.length !== 375 || !v1Records.some((record) =>
      record.token.address.toLowerCase() === CLASSIC_V1_TOKEN) ||
    [...V1_RELEASES].some((id) => releaseCounts[id] !== V1_RELEASE_COUNTS[id])
  ) throw new Error("bundled v1 release inventory is incomplete");

  const counts = {
    total: v1Records.length,
    classic: v1Records.filter((record) => record.category === "classic").length,
    custom: v1Records.filter((record) => record.category === "custom").length,
  };
  return {
    records: v1Records,
    status: {
      schemaVersion: API_SCHEMA_VERSION,
      generatedAt: value.generatedAt,
      status: "ready",
      chainId: CHAIN_ID,
      source: {
        url: value.source.url,
        statusReported: "frozen",
        schemaVersion: value.schemaVersion,
        evidence: {
          deployment: value.source.deployment,
          sourceCommit: value.source.sourceCommit,
          inventorySha256: value.source.envioInventorySha256,
          recordsSha256: value.recordsSha256,
        },
        snapshot: {
          blockNumber: value.source.anchorBlock,
          blockHash: value.source.anchorBlockHash,
        },
        snapshotMatchesChain: true,
        freshness: "frozen",
        lagBlocks: null,
      },
      chain: {
        headBlock: Number(value.source.anchorBlock),
        scanBlock: Number(value.source.anchorBlock),
        finalizedBlock: Number(value.source.anchorBlock),
        scanConfirmations: null,
        finalizedBlockHash: value.source.anchorBlockHash,
        provider: "frozen-snapshot",
      },
      coverage: {
        status: "complete",
        fromBlock: 25_622_090,
        toBlock: Number(value.source.anchorBlock),
        checkpoint: {
          blockNumber: Number(value.source.anchorBlock),
          blockHash: value.source.anchorBlockHash,
          timestamp: "2026-08-28T21:53:11.000Z",
          finality: "finalized",
        },
        gapFill: null,
        enrichment: { status: "complete", diagnostics: 0 },
      },
      customRegistry: {
        configured: false,
        status: "not-applicable",
        launches: 0,
      },
      counts,
      errors: [],
      snapshotMode: "immutable-compatibility",
      snapshotFileSha256: SNAPSHOT_FILE_SHA256,
    },
  };
}

async function loadSnapshot() {
  const bytes = await readFile(
    new URL("../snapshots/v1-launches.frozen.json", import.meta.url),
  );
  return validateSnapshot(JSON.parse(bytes.toString("utf8")), bytes);
}

export async function getV1Dataset() {
  snapshotPromise ??= loadSnapshot();
  return structuredClone(await snapshotPromise);
}

export function v1ServiceStatus(status) {
  return {
    schemaVersion: API_SCHEMA_VERSION,
    service: "operational",
    checkedAt: status.generatedAt,
    chainId: CHAIN_ID,
    classic: {
      status: "live",
      note: "Frozen Classic V1-V3 compatibility records are available. New launches use API v2.",
    },
    custom: {
      status: "live",
      note: "Frozen Stock-Paired compatibility records are available as Custom. New launches use API v2.",
    },
    feeds: { manifest: "ready", launches: "ready", tokenList: "ready" },
    snapshotMode: status.snapshotMode,
    source: status.source,
    coverage: status.coverage,
    counts: status.counts,
    errors: status.errors,
  };
}
