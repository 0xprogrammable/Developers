import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { readClassicCatalogFeed } from "../server/classic-catalog.js";
import {
  CLASSIC_CATALOG_SOURCE,
  CLASSIC_CATALOG_SOURCE_URL,
  FINALITY_CONFIRMATIONS,
  RELEASE_BY_ID,
} from "../server/constants.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const CATALOG_COMMITMENT = `sha256:${"a".repeat(64)}`;
const AS_OF_BLOCK_HASH = `0x${"b".repeat(64)}`;
const AS_OF_BLOCK = "25855200";

function address(seed) {
  return `0x${BigInt(seed).toString(16).padStart(40, "0")}`;
}

function hash(seed) {
  return `0x${BigInt(seed).toString(16).padStart(64, "0")}`;
}

function classicToken(modelVersion, seed) {
  return {
    exploreKind: "token",
    launchModel: "classic",
    launchModelVersion: modelVersion,
    launchCategoryProvenance: {
      category: "classic",
      source: "canonical-launch-read-model",
    },
    tokenAddress: address(seed),
    name: `Classic ${modelVersion} ${seed}`,
    symbol: `C${seed}`,
    tokenDecimals: 18,
    totalSupplyRaw: "1000000000000000000000000000",
    description: null,
    imageUrl: null,
    links: [{ kind: "website", url: `https://example.com/${seed}` }],
    creatorAddress: address(10_000 + seed),
    launchTransactionHash: hash(20_000 + seed),
    launchBlockNumber: String(25_850_000 + seed),
    launchTransactionIndex: seed,
    launchLogIndex: 1_000 + seed,
    launchedAt: "2026-08-28T14:58:47.000Z",
    launchHash: hash(30_000 + seed),
    poolId: hash(40_000 + seed),
    hookAddress: RELEASE_BY_ID.get(modelVersion)?.hook ?? address(50_000 + seed),
    quoteAssetAddress: ZERO_ADDRESS,
    quoteAssetSymbol: "ETH",
    quoteAssetName: "Ether",
    quoteIsCurrency0: true,
    positionRecipient: address(60_000 + seed),
    positionTokenId: String(70_000 + seed),
    tokenLiquidityAmountRaw: "997000000000000000000000000",
    lockedTokenDustRaw: "3000000000000000000000000",
    buyHookFeeBps: 100,
    sellHookFeeBps: 200,
    buyCreatorFeeBps: 90,
    sellCreatorFeeBps: 190,
    creatorFeeBps: null,
    transferTaxBps: 0,
    lpFeePips: 3_000,
    rewardVaultAddress: address(80_000 + seed),
  };
}

function catalogPage({
  page = 1,
  tokens,
  total = tokens.length,
  totalPages = 1,
  identityCount = total,
  identityCommitment = CATALOG_COMMITMENT,
} = {}) {
  return {
    status: "ready",
    page,
    pageSize: 100,
    total,
    totalPages,
    tokens,
    catalog: {
      source: CLASSIC_CATALOG_SOURCE.catalogSource,
      launchSource: CLASSIC_CATALOG_SOURCE.launchSource,
      status: "current",
      completeness: { classic: "current", custom: "current" },
      scope: {
        included: [
          "classic-v3",
          "classic-v4",
          "official-main-token",
          "registry",
          "router",
        ],
        excluded: [
          "classic-v1",
          "classic-v2",
          "stock-paired-v1",
          "stock-paired-v2",
          "stock-paired-v3",
        ],
        publicCategories: ["classic", "custom"],
      },
      evidence: {
        kind: CLASSIC_CATALOG_SOURCE.evidenceKind,
        deployment: "production-6157d22",
        sourceCommit: "6157d221f53d70dc1439226365f9be3c1f260b4b",
        commitment: `sha256:${"c".repeat(64)}`,
        progressBlock: AS_OF_BLOCK,
      },
      identityCommitment,
      identityCount,
      asOfBlock: AS_OF_BLOCK,
      asOfBlockHash: AS_OF_BLOCK_HASH,
      lastIndexedAt: "2026-08-28T15:15:00.000Z",
    },
    dataQuality: {
      schemaVersion: CLASSIC_CATALOG_SOURCE.schemaVersion,
      launchIdentity: {
        status: "current",
        canonical: "current",
        asOfBlock: AS_OF_BLOCK,
      },
    },
  };
}

function mockPages(pages, observedUrls = []) {
  return async (url, options) => {
    const parsed = new URL(url);
    observedUrls.push(parsed.href);
    assert.equal(`${parsed.origin}${parsed.pathname}`, CLASSIC_CATALOG_SOURCE_URL);
    assert.equal(parsed.searchParams.get("limit"), "100");
    assert.equal(parsed.searchParams.get("model"), "classic");
    assert.equal(parsed.searchParams.get("sort"), "newest");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Accept, "application/json");
    const page = Number(parsed.searchParams.get("page"));
    const body = pages[page - 1];
    if (!body) return new Response("missing page", { status: 404 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("canonical Classic catalog ingestion", () => {
  test("reads a stable multi-page V4/V3 catalog and skips inactive V2", async () => {
    const inactiveV2 = Array.from(
      { length: 99 },
      (_, index) => classicToken("classic-v2", 100 + index),
    );
    const pages = [
      catalogPage({
        page: 1,
        tokens: [classicToken("classic-v4", 1), ...inactiveV2],
        total: 101,
        totalPages: 2,
        identityCount: 101,
      }),
      catalogPage({
        page: 2,
        tokens: [classicToken("classic-v3", 2)],
        total: 101,
        totalPages: 2,
        identityCount: 101,
      }),
    ];
    const observedUrls = [];

    const feed = await readClassicCatalogFeed(mockPages(pages, observedUrls));

    assert.equal(feed.reportedStatus, "current");
    assert.equal(feed.schemaVersion, CLASSIC_CATALOG_SOURCE.schemaVersion);
    assert.deepEqual(feed.snapshot, {
      blockNumber: Number(AS_OF_BLOCK),
      blockHash: AS_OF_BLOCK_HASH,
      confirmations: FINALITY_CONFIRMATIONS,
    });
    assert.deepEqual(
      feed.tokens.map((token) => [token.address, token.launch.modelVersion]),
      [
        [address(1), "classic-v4"],
        [address(2), "classic-v3"],
      ],
    );
    assert.equal(feed.tokens[0].launch.transactionIndex, 1);
    assert.equal(feed.tokens[0].launch.logIndex, 1_001);
    assert.equal(observedUrls.length, 2);
    assert.deepEqual(
      observedUrls.map((url) => new URL(url).searchParams.get("q")),
      [null, null],
    );
    assert.equal(feed.source.pageBoundaryCount, 2);
    assert.match(feed.source.pageBoundaryCommitment, /^sha256:[0-9a-f]{64}$/u);
  });

  test("accepts rolling Envio releases but rejects malformed evidence or scope", async () => {
    const rollingRelease = catalogPage({
      tokens: [classicToken("classic-v4", 1)],
    });
    rollingRelease.catalog.evidence.deployment = "production-abcdef12";
    rollingRelease.catalog.evidence.sourceCommit = "1".repeat(40);
    const feed = await readClassicCatalogFeed(mockPages([rollingRelease]));
    assert.equal(feed.source.deployment, "production-abcdef12");
    assert.equal(feed.source.sourceCommit, "1".repeat(40));

    for (const mutate of [
      (payload) => {
        payload.catalog.evidence.kind = "unrecognized-indexer-state";
      },
      (payload) => {
        payload.catalog.evidence.deployment = "Production wrong";
      },
      (payload) => {
        payload.catalog.evidence.sourceCommit = "0".repeat(40);
      },
      (payload) => {
        payload.catalog.scope.included = payload.catalog.scope.included.filter(
          (scope) => scope !== "classic-v4",
        );
      },
    ]) {
      const payload = catalogPage({ tokens: [classicToken("classic-v4", 1)] });
      mutate(payload);
      await assert.rejects(
        () => readClassicCatalogFeed(mockPages([payload])),
        /Classic catalog source binding is invalid/,
      );
    }
  });

  test("rejects a persistent catalog identity change after three bounded attempts", async () => {
    const inactiveV2 = Array.from(
      { length: 99 },
      (_, index) => classicToken("classic-v2", 100 + index),
    );
    const pageOne = catalogPage({
      page: 1,
      tokens: [classicToken("classic-v4", 1), ...inactiveV2],
      total: 101,
      totalPages: 2,
      identityCount: 101,
    });
    const pageTwo = catalogPage({
      page: 2,
      tokens: [classicToken("classic-v3", 2)],
      total: 101,
      totalPages: 2,
      identityCount: 101,
      identityCommitment: `sha256:${"d".repeat(64)}`,
    });

    const observedUrls = [];
    const delays = [];
    await assert.rejects(
      () => readClassicCatalogFeed(
        mockPages([pageOne, pageTwo], observedUrls),
        async (milliseconds) => delays.push(milliseconds),
      ),
      /Classic catalog changed during page traversal/,
    );
    assert.deepEqual(
      observedUrls.map((url) => new URL(url).searchParams.get("page")),
      ["1", "2", "1", "2", "1", "2"],
    );
    assert.deepEqual(delays, [250, 750]);
  });

  test("converges after two identity-changing CDN traversals", async () => {
    const inactiveV2 = Array.from(
      { length: 99 },
      (_, index) => classicToken("classic-v2", 100 + index),
    );
    const pages = [
      catalogPage({
        page: 1,
        tokens: [classicToken("classic-v4", 1), ...inactiveV2],
        total: 101,
        totalPages: 2,
        identityCount: 101,
      }),
      catalogPage({
        page: 2,
        tokens: [classicToken("classic-v3", 2)],
        total: 101,
        totalPages: 2,
        identityCount: 101,
      }),
    ];
    const observedPages = [];
    const delays = [];
    let pageTwoReads = 0;
    const fetcher = async (url, options) => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get("page"));
      observedPages.push(page);
      assert.equal(options.redirect, "error");
      const payload = structuredClone(pages[page - 1]);
      if (page === 2 && pageTwoReads < 2) {
        payload.catalog.identityCommitment = pageTwoReads === 0
          ? `sha256:${"d".repeat(64)}`
          : `sha256:${"e".repeat(64)}`;
        pageTwoReads += 1;
      }
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const feed = await readClassicCatalogFeed(
      fetcher,
      async (milliseconds) => delays.push(milliseconds),
    );

    assert.equal(feed.snapshot.blockNumber, Number(AS_OF_BLOCK));
    assert.deepEqual(delays, [250, 750]);
    assert.deepEqual(observedPages, [1, 2, 1, 2, 1, 2]);
  });

  test("accepts rolling page evidence for one identity and anchors the oldest page", async () => {
    const inactiveV2 = Array.from(
      { length: 99 },
      (_, index) => classicToken("classic-v2", 100 + index),
    );
    const pageOne = catalogPage({
      page: 1,
      tokens: [classicToken("classic-v4", 1), ...inactiveV2],
      total: 101,
      totalPages: 2,
      identityCount: 101,
    });
    const pageTwo = catalogPage({
      page: 2,
      tokens: [classicToken("classic-v3", 2)],
      total: 101,
      totalPages: 2,
      identityCount: 101,
    });
    pageTwo.catalog.asOfBlock = String(Number(AS_OF_BLOCK) - 1);
    pageTwo.catalog.asOfBlockHash = `0x${"e".repeat(64)}`;
    pageTwo.catalog.lastIndexedAt = "2026-08-28T15:15:12.000Z";
    pageTwo.catalog.evidence.progressBlock = pageTwo.catalog.asOfBlock;
    pageTwo.catalog.evidence.commitment = `sha256:${"f".repeat(64)}`;
    pageTwo.dataQuality.launchIdentity.asOfBlock = pageTwo.catalog.asOfBlock;

    const feed = await readClassicCatalogFeed(mockPages([pageOne, pageTwo]));

    assert.deepEqual(feed.snapshot, {
      blockNumber: Number(AS_OF_BLOCK) - 1,
      blockHash: `0x${"e".repeat(64)}`,
      confirmations: FINALITY_CONFIRMATIONS,
    });
    assert.equal(feed.source.generatedAt, "2026-08-28T15:15:12.000Z");
    assert.equal(feed.source.evidenceCommitment, `sha256:${"f".repeat(64)}`);
    assert.equal(feed.source.pageBoundaryCount, 2);
    assert.match(feed.source.pageBoundaryCommitment, /^sha256:[0-9a-f]{64}$/u);
  });

  test("rejects different hashes for the same page boundary block", async () => {
    const inactiveV2 = Array.from(
      { length: 99 },
      (_, index) => classicToken("classic-v2", 100 + index),
    );
    const pageOne = catalogPage({
      page: 1,
      tokens: [classicToken("classic-v4", 1), ...inactiveV2],
      total: 101,
      totalPages: 2,
      identityCount: 101,
    });
    const pageTwo = catalogPage({
      page: 2,
      tokens: [classicToken("classic-v3", 2)],
      total: 101,
      totalPages: 2,
      identityCount: 101,
    });
    pageTwo.catalog.asOfBlockHash = `0x${"e".repeat(64)}`;

    await assert.rejects(
      () => readClassicCatalogFeed(
        mockPages([pageOne, pageTwo]),
        async () => {},
      ),
      /Classic catalog changed during page traversal/u,
    );
  });

  test("rejects source or scope changes inside one identity traversal", async () => {
    const inactiveV2 = Array.from(
      { length: 99 },
      (_, index) => classicToken("classic-v2", 100 + index),
    );
    for (const mutate of [
      (payload) => {
        payload.catalog.evidence.sourceCommit = "1".repeat(40);
      },
      (payload) => {
        payload.catalog.scope.included.push("future-unbound-scope");
      },
    ]) {
      const pages = [
        catalogPage({
          page: 1,
          tokens: [classicToken("classic-v4", 1), ...inactiveV2],
          total: 101,
          totalPages: 2,
          identityCount: 101,
        }),
        catalogPage({
          page: 2,
          tokens: [classicToken("classic-v3", 2)],
          total: 101,
          totalPages: 2,
          identityCount: 101,
        }),
      ];
      mutate(pages[1]);
      await assert.rejects(
        () => readClassicCatalogFeed(mockPages(pages), async () => {}),
        /Classic catalog changed during page traversal/u,
      );
    }
  });

  test("rejects a catalog without an active Classic V4 launch", async () => {
    const payload = catalogPage({
      tokens: [
        classicToken("classic-v3", 1),
        classicToken("classic-v2", 2),
      ],
    });

    await assert.rejects(
      () => readClassicCatalogFeed(mockPages([payload])),
      /Classic catalog identity set is incomplete/,
    );
  });

  test("rejects an active release whose hook does not match its declared version", async () => {
    const token = classicToken("classic-v4", 1);
    token.hookAddress = address(999_999);
    const payload = catalogPage({ tokens: [token] });

    await assert.rejects(
      () => readClassicCatalogFeed(mockPages([payload])),
      /Classic catalog token binding is invalid/u,
    );
  });

  test("rejects duplicate active launch identities", async () => {
    const duplicate = classicToken("classic-v4", 1);
    const payload = catalogPage({
      tokens: [duplicate, structuredClone(duplicate)],
    });

    await assert.rejects(
      () => readClassicCatalogFeed(mockPages([payload])),
      /Classic catalog contains a duplicate token/,
    );
  });

  test("rejects a short page instead of publishing incomplete coverage", async () => {
    const payload = catalogPage({
      tokens: [classicToken("classic-v4", 1)],
      total: 2,
      totalPages: 1,
      identityCount: 2,
    });

    await assert.rejects(
      () => readClassicCatalogFeed(mockPages([payload])),
      /Classic catalog pagination is invalid/,
    );
  });

  test("rejects an aggregate catalog body above the traversal budget", async () => {
    const firstInactiveV2 = Array.from(
      { length: 99 },
      (_, index) => classicToken("classic-v2", 100 + index),
    );
    const secondInactiveV2 = Array.from(
      { length: 100 },
      (_, index) => classicToken("classic-v2", 200 + index),
    );
    const pages = [
      catalogPage({
        page: 1,
        tokens: [classicToken("classic-v4", 1), ...firstInactiveV2],
        total: 201,
        totalPages: 3,
        identityCount: 201,
      }),
      catalogPage({
        page: 2,
        tokens: secondInactiveV2,
        total: 201,
        totalPages: 3,
        identityCount: 201,
      }),
      catalogPage({
        page: 3,
        tokens: [classicToken("classic-v3", 2)],
        total: 201,
        totalPages: 3,
        identityCount: 201,
      }),
    ];
    pages[0].padding = "a".repeat(1_700_000);
    pages[1].padding = "b".repeat(1_700_000);
    pages[2].padding = "c".repeat(1_700_000);

    await assert.rejects(
      () => readClassicCatalogFeed(mockPages(pages)),
      /aggregate response limit/u,
    );
  });
});
