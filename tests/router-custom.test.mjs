import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import path from "node:path";

import { launchFeedPayload } from "../api/v2/launches.js";
import { tokenListPayload } from "../api/v2/token-list.js";
import { canonicalSha256 } from "../server/canonical.js";
import {
  feedStatusV2,
  isV2PublicLaunch,
  isV2DatasetPublishable,
  mergeRouterCustomRecords,
  projectV2Dataset,
  publicLaunchV2,
  serviceStatusV2,
} from "../server/v2-dataset.js";
import {
  isRouterStampedCustom,
  readRouterCustomRecords,
  resetRouterCustomCacheForTest,
  ROUTER_CUSTOM_SOURCE_URL,
} from "../server/router-custom.js";
import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import {
  assertValid,
  createSchemaRegistry,
} from "../scripts/lib/schema.mjs";
import { validateLaunchSemantics } from "../scripts/lib/semantics.mjs";

const registry = await createSchemaRegistry("v2");
const manifest = await readJson(
  path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
);
const bundledSource = await readJson(
  path.join(REPOSITORY_ROOT, "snapshots/router-custom-identities.v1.json"),
);
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetRouterCustomCacheForTest();
});

function canonicalSourceEntry(entry) {
  const proof = {
    launchId: entry.launchId,
    stampHash: entry.stampHash,
  };
  const provenance = {
    schemaVersion: "programmable.launch-stamp-provenance.v1",
    kind: "custom-graph",
    chainId: 1,
    routerAddress: entry.routerAddress,
    routerRuntimeCodeHash: entry.routerRuntimeCodeHash,
    routerStartBlock: entry.routerStartBlock,
    finalityConfirmations: entry.finalityConfirmations,
    finalizedAtBlockNumber: entry.finalizedAtBlockNumber,
    launchId: entry.launchId,
    stampHash: entry.stampHash,
    transactionHash: entry.transactionHash,
    blockNumber: entry.blockNumber,
    blockHash: entry.blockHash,
    transactionIndex: entry.transactionIndex,
    launchLogIndex: entry.logIndex,
    launchWallet: entry.launchWallet,
    tokenProof: { ...proof, tokenAddress: entry.tokenAddress },
    poolId: entry.poolId,
    poolManagerAddress: entry.poolManagerAddress,
    poolProof: {
      ...proof,
      poolId: entry.poolId,
      poolManagerAddress: entry.poolManagerAddress,
    },
    poolKey: { hooks: entry.hookAddress },
    routeLauncherAddress: entry.routeLauncherAddress,
    routeLauncherRuntimeCodeHash: entry.routeLauncherRuntimeCodeHash,
    components: [
      {
        kind: "token",
        scope: "exclusive",
        address: entry.tokenAddress,
        exclusiveProof: proof,
      },
      {
        kind: "hook",
        scope: "exclusive",
        address: entry.hookAddress,
        exclusiveProof: proof,
      },
    ],
  };
  return {
    id: `1:${entry.tokenAddress.toLowerCase()}`,
    exploreKind: "token",
    tokenAddress: entry.tokenAddress,
    name: entry.tokenName,
    symbol: entry.tokenSymbol,
    tokenDecimals: entry.tokenDecimals,
    creatorAddress: entry.launchWallet,
    hookAddress: entry.hookAddress,
    poolId: entry.poolId,
    launchTransactionHash: entry.transactionHash,
    launchBlockNumber: entry.blockNumber,
    launchTransactionIndex: entry.transactionIndex,
    launchLogIndex: entry.logIndex,
    launchedAt: entry.launchedAt,
    launchModel: "custom-graph",
    launchModelVersion: "programmable-launch-stamp-router-v1",
    liquidityPath: "programmable-v4",
    totalSwapFeeBps: null,
    launchStampProvenance: provenance,
    launchCategoryProvenance: {
      schemaVersion: "programmable.explore-launch-category-provenance.v1",
      category: "custom",
      source: "canonical-launch-stamp-router",
      launchId: entry.launchId,
      stampHash: entry.stampHash,
      routerAddress: entry.routerAddress,
      transactionHash: entry.transactionHash,
      blockHash: entry.blockHash,
      blockNumber: entry.blockNumber,
      transactionIndex: entry.transactionIndex,
      logIndex: entry.logIndex,
    },
  };
}

function currentSourcePayload() {
  const entries = bundledSource.entries
    .map(canonicalSourceEntry)
    .sort((left, right) =>
      BigInt(left.launchBlockNumber) < BigInt(right.launchBlockNumber) ? -1 : 1);
  const next = {
    ...bundledSource.entries[0],
    finalizedAtBlockNumber: "25833390",
    launchId: `0x${"a".repeat(64)}`,
    stampHash: `0x${"b".repeat(64)}`,
    transactionHash: `0x${"c".repeat(64)}`,
    blockNumber: "25833320",
    blockHash: `0x${"d".repeat(64)}`,
    transactionIndex: 1,
    logIndex: 2,
    launchedAt: "2026-08-25T16:30:00.000Z",
    tokenAddress: "0x1111111111111111111111111111111111111111",
    tokenName: "Next Router Token",
    tokenSymbol: "NEXT",
    hookAddress: "0x2222222222222222222222222222222222222222",
    poolId: `0x${"e".repeat(64)}`,
  };
  entries.push(canonicalSourceEntry(next));
  const payload = {
    schemaVersion: "programmable.router-custom-identity-snapshot.v1",
    source: "canonical-launch-stamp-router",
    status: "current",
    generatedAt: "2026-08-25T16:31:00.000Z",
    asOfBlock: "25833400",
    asOfBlockHash: `0x${"f".repeat(64)}`,
    finalityConfirmations: 64,
    identityCommitment: null,
    entries,
  };
  payload.identityCommitment = canonicalSha256(payload.schemaVersion, {
    chainId: 1,
    source: payload.source,
    asOfBlock: payload.asOfBlock,
    asOfBlockHash: payload.asOfBlockHash,
    finalityConfirmations: payload.finalityConfirmations,
    entries: payload.entries,
  });
  return payload;
}

function recommitSourcePayload(payload) {
  payload.identityCommitment = canonicalSha256(payload.schemaVersion, {
    chainId: 1,
    source: payload.source,
    asOfBlock: payload.asOfBlock,
    asOfBlockHash: payload.asOfBlockHash,
    finalityConfirmations: payload.finalityConfirmations,
    entries: payload.entries,
  });
  return payload;
}

function serveSource(payload) {
  globalThis.fetch = async (url) => {
    assert.equal(String(url), ROUTER_CUSTOM_SOURCE_URL);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

async function fallbackRecords() {
  resetRouterCustomCacheForTest();
  globalThis.fetch = async () => {
    throw new Error("current Router source unavailable in fixture");
  };
  return readRouterCustomRecords(manifest);
}

describe("Router Custom v2 projection", () => {
  test("keeps the bounded PCAN and FADE identities when live enrichment is unavailable", async () => {
    const snapshot = await fallbackRecords();
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
    assert.deepEqual(
      snapshot.records.map((record) => record.token.symbol),
      ["FADE", "PCAN"],
    );
    assert.deepEqual(
      snapshot.records.map((record) => record.token.address.toLowerCase()),
      [
        "0x69d278968abf120f878f2e1e016ab615d3686c19",
        "0x9deeb39d2590b0cad5fc473f755c5f97dcc8f7ce",
      ],
    );
    assert.equal(
      ROUTER_CUSTOM_SOURCE_URL,
      "https://programmable.market/api/indexers/v1/router-custom-identities",
    );
    assert.equal(
      snapshot.snapshotSha256,
      "sha256:25f47a745c4704af13787340dc855ad13a9e3eb12023352c88b0befc2d93d771",
    );
  });

  test("automatically accepts a complete commitment-bound current snapshot", async () => {
    const payload = currentSourcePayload();
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "current");
    assert.equal(snapshot.verifiedIdentityCount, 3);
    assert.ok(snapshot.records.some((record) => record.token.symbol === "NEXT"));
    const projected = projectV2Dataset({
      records: snapshot.records,
      status: {
        status: "ready",
        generatedAt: payload.generatedAt,
        chainId: 1,
        coverage: {
          status: "complete",
          checkpoint: {
            blockNumber: 25833400,
            blockHash: payload.asOfBlockHash,
            finality: "finalized",
          },
        },
      },
    }, manifest);
    assert.equal(projected.records.length, 3);
    const currentRecord = publicLaunchV2(projected.records.find((record) =>
      record.token.symbol === "NEXT"));
    assert.deepEqual(validateLaunchSemantics(currentRecord), []);
    const transportedRecord = JSON.parse(JSON.stringify(currentRecord));
    assert.equal(isRouterStampedCustom(transportedRecord, manifest), false);
    assert.deepEqual(validateLaunchSemantics(transportedRecord), []);

    transportedRecord.markets[0].hookAddress =
      "0x3333333333333333333333333333333333333333";
    assert.ok(validateLaunchSemantics(transportedRecord).some((finding) =>
      finding.code === "FEE_POLICY_REQUIRED"));
  });

  test("keeps every warm accepted finalized identity across later shrink or rewrite", async () => {
    const first = currentSourcePayload();
    serveSource(first);
    const accepted = await readRouterCustomRecords(manifest);
    assert.equal(accepted.status, "current");
    assert.equal(accepted.verifiedIdentityCount, 3);

    const shrunk = currentSourcePayload();
    shrunk.entries.pop();
    shrunk.generatedAt = "2026-08-25T16:32:00.000Z";
    shrunk.asOfBlock = "25833401";
    shrunk.asOfBlockHash = `0x${"1".repeat(64)}`;
    recommitSourcePayload(shrunk);
    resetRouterCustomCacheForTest({ preserveAcceptedSource: true });
    serveSource(shrunk);
    const afterShrink = await readRouterCustomRecords(manifest);
    assert.equal(afterShrink.status, "last-known-good");
    assert.equal(afterShrink.verifiedIdentityCount, 3);
    assert.ok(afterShrink.records.some((record) => record.token.symbol === "NEXT"));

    const rewritten = currentSourcePayload();
    const next = rewritten.entries.at(-1);
    next.hookAddress = "0x3333333333333333333333333333333333333333";
    next.launchStampProvenance.poolKey.hooks = next.hookAddress;
    for (const component of next.launchStampProvenance.components) {
      if (component.kind === "hook") component.address = next.hookAddress;
    }
    rewritten.generatedAt = "2026-08-25T16:33:00.000Z";
    rewritten.asOfBlock = "25833402";
    rewritten.asOfBlockHash = `0x${"2".repeat(64)}`;
    recommitSourcePayload(rewritten);
    resetRouterCustomCacheForTest({ preserveAcceptedSource: true });
    serveSource(rewritten);
    const afterRewrite = await readRouterCustomRecords(manifest);
    assert.equal(afterRewrite.status, "last-known-good");
    assert.equal(afterRewrite.verifiedIdentityCount, 3);
    assert.equal(
      afterRewrite.records.find((record) => record.token.symbol === "NEXT")
        .markets[0].hookAddress,
      "0x2222222222222222222222222222222222222222",
    );
  });

  test("rejects a source mutation under an unchanged commitment", async () => {
    const payload = currentSourcePayload();
    payload.entries.at(-1).hookAddress =
      "0x3333333333333333333333333333333333333333";
    payload.entries.at(-1).launchStampProvenance.poolKey.hooks =
      "0x3333333333333333333333333333333333333333";
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
    assert.ok(!snapshot.records.some((record) => record.token.symbol === "NEXT"));
  });

  test("rejects duplicate pool identity even under a recomputed commitment", async () => {
    const payload = currentSourcePayload();
    const duplicatePool = payload.entries[0].launchStampProvenance;
    const next = payload.entries.at(-1);
    next.poolId = duplicatePool.poolId;
    next.launchStampProvenance.poolId = duplicatePool.poolId;
    next.launchStampProvenance.poolProof.poolId = duplicatePool.poolId;
    recommitSourcePayload(payload);
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
  });

  test("keeps a current Router identity with partial token metadata in launches only", async () => {
    const payload = currentSourcePayload();
    delete payload.entries.at(-1).tokenDecimals;
    recommitSourcePayload(payload);
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    const next = snapshot.records.find((record) => record.token.symbol === "NEXT");
    assert.equal(snapshot.status, "current");
    assert.equal(next.token.identityStatus, "partial");
    assert.equal(next.token.decimals, null);
    const tokens = tokenListPayload(
      snapshot.records,
      snapshot.generatedAt,
      "custom",
      1,
      "ready",
    );
    assert.ok(!tokens.tokens.some((token) => token.symbol === "NEXT"));
  });

  test("rejects every public-field mutation instead of bypassing Router and fee gates", async () => {
    const snapshot = await fallbackRecords();
    const source = publicLaunchV2(snapshot.records[0]);
    const mutations = [
      ["chain", (record) => { record.chainId = 10; }],
      ["caip2", (record) => { record.caip2 = "eip155:10"; }],
      ["token", (record) => {
        record.token.address = "0x1111111111111111111111111111111111111111";
      }],
      ["transaction", (record) => {
        record.launch.transactionHash = `0x${"1".repeat(64)}`;
      }],
      ["launch block", (record) => { record.launch.blockNumber = "25827141"; }],
      ["verification launcher", (record) => {
        record.verification.launcherAddress =
          "0x1111111111111111111111111111111111111111";
      }],
      ["hook", (record) => {
        record.markets[0].hookAddress =
          "0x1111111111111111111111111111111111111111";
      }],
      ["pool", (record) => { record.markets[0].poolId = `0x${"1".repeat(64)}`; }],
      ["stamp", (record) => {
        record.extensions["programmable/router-stamp-v1"].stampHash =
          `0x${"1".repeat(64)}`;
      }],
      ["finality", (record) => {
        record.extensions["programmable/router-stamp-v1"]
          .finalizedAtBlockNumber = "0";
      }],
      ["snapshot digest", (record) => {
        record.extensions["programmable/router-stamp-v1"].snapshotSha256 =
          `sha256:${"1".repeat(64)}`;
      }],
      ["entry digest", (record) => {
        record.extensions["programmable/router-stamp-v1"].entrySha256 =
          `sha256:${"1".repeat(64)}`;
      }],
    ];
    for (const [name, mutate] of mutations) {
      const changed = structuredClone(source);
      mutate(changed);
      assert.equal(isRouterStampedCustom(changed, manifest), false, name);
      assert.ok(
        validateLaunchSemantics(changed).some((finding) =>
          finding.code === "FEE_POLICY_REQUIRED"),
        `${name} must not retain the fee-policy exception`,
      );
    }
  });

  test("publishes only manifest-bound finalized Router records", async () => {
    const snapshot = await fallbackRecords();
    const validate = registry.validator("launch.schema.json");
    for (const record of snapshot.records) {
      assert.equal(isRouterStampedCustom(record, manifest), true);
      assert.equal(isV2PublicLaunch(record, manifest), true);
      const publicRecord = publicLaunchV2(record);
      assertValid(validate, publicRecord, record.token.symbol);
      assert.deepEqual(validateLaunchSemantics(publicRecord), []);
      assert.equal(publicRecord.launch.finality, "finalized");
      assert.equal(publicRecord.verification.provenanceStatus, "verified");
      assert.equal(publicRecord.token.supplyStatus, "unavailable");
      assert.equal(publicRecord.fees.length, 0);
      assert.equal(
        publicRecord.extensions["programmable/router-stamp-v1"]
          .feePolicyStatus,
        "unavailable",
      );
      assert.deepEqual(publicRecord.markets[0].metrics, {
        price: { status: "unavailable", value: null },
        liquidity: { status: "unavailable", value: null },
        volume24h: { status: "unavailable", value: null },
        updatedAt: null,
      });
    }
  });

  test("keeps Router Custom independent from Registry publication readiness", async () => {
    const snapshot = await fallbackRecords();
    const projected = projectV2Dataset(
      {
        records: snapshot.records,
        status: {
          status: "partial",
          generatedAt: "2026-08-25T16:20:39.656Z",
          chainId: 1,
          coverage: {
            status: "complete",
            checkpoint: {
              blockNumber: 25833303,
              blockHash:
                "0x8a41eb9adef78cdf523beff49f0b8d19225394991ff3e7be1bb8d24e34e7cdce",
              finality: "finalized",
            },
          },
          customRegistry: {
            configured: true,
            status: "unavailable",
            completeness: "incomplete",
            freshness: "stale",
            highWaterGeneration: "0",
            launches: 0,
          },
        },
      },
      manifest,
    );
    assert.equal(projected.records.length, 2);
    assert.ok(projected.records.every((record) => record.category === "custom"));
    assert.deepEqual(projected.status.counts, {
      total: 2,
      classic: 0,
      custom: 2,
    });
  });

  test("adds complete Router token identities to the wallet-compatible token list", async () => {
    const snapshot = await fallbackRecords();
    const payload = tokenListPayload(
      snapshot.records,
      snapshot.generatedAt,
      "custom",
      1,
      "degraded",
    );
    assert.equal(payload.status, "degraded");
    assert.deepEqual(payload.tokens.map((token) => token.symbol), ["FADE", "PCAN"]);
    assert.ok(
      payload.tokens.every((token) =>
        token.extensions.programmable.category === "custom" &&
        token.extensions.programmable.finality === "finalized" &&
        !("programmableFeeBps" in token.extensions.programmable)),
    );
    assertValid(
      registry.validator("token-list.schema.json"),
      payload,
      "Router Custom token list",
    );
  });

  test("reports the pinned Router snapshot as degraded and non-authoritative", async () => {
    const snapshot = await fallbackRecords();
    const projected = projectV2Dataset({
      records: snapshot.records,
      status: {
        status: "ready",
        generatedAt: "2026-08-25T16:20:39.656Z",
        chainId: 1,
        coverage: {
          status: "complete",
          checkpoint: {
            blockNumber: 25833000,
            blockHash: `0x${"e".repeat(64)}`,
            finality: "finalized",
          },
        },
        routerCustom: {
          source: "canonical-launch-stamp-router",
          status: snapshot.status,
          generatedAt: snapshot.generatedAt,
          asOfBlock: snapshot.asOfBlock,
          asOfBlockHash: snapshot.asOfBlockHash,
          sourceIdentityCommitment: snapshot.sourceIdentityCommitment,
          snapshotSha256: snapshot.snapshotSha256,
          verifiedIdentityCount: snapshot.verifiedIdentityCount,
          publishedIdentityCount: snapshot.records.length,
        },
      },
    }, manifest);

    assert.equal(feedStatusV2(projected), "degraded");
    assert.equal(feedStatusV2(projected, "custom"), "degraded");
    assert.equal(isV2DatasetPublishable(projected, "custom"), false);
    const service = serviceStatusV2(projected.status, manifest);
    assert.equal(service.feeds.launches, "degraded");
    assert.equal(service.routerCustom.status, "last-known-good");
    assertValid(
      registry.validator("status.schema.json"),
      service,
      "Router Custom service status",
    );
    const feed = launchFeedPayload(projected, { category: "custom", limit: 100 });
    assert.equal(feed.snapshot.blockNumber, snapshot.asOfBlock);
    assert.equal(feed.snapshot.blockHash, snapshot.asOfBlockHash);
    assert.ok(feed.items.every((record) =>
      record.extensions["programmable/classification"].basis ===
        "canonical-launch-stamp-router"));
  });

  test("fails closed when Router identity collides with another public source", async () => {
    const snapshot = await fallbackRecords();
    const conflict = structuredClone(snapshot.records[0]);
    conflict.launchId = `0x${"f".repeat(64)}`;
    assert.throws(
      () => mergeRouterCustomRecords(
        { records: [conflict], status: {} },
        snapshot,
      ),
      /conflicts with another public source/,
    );
  });
});
