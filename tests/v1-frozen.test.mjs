import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import {
  createLaunchesHandler,
} from "../api/v1/launches.js";
import {
  createTokenListHandler,
  tokenListPayload,
} from "../api/v1/token-list.js";
import { encodePageCursor } from "../server/http.js";
import { getV1Dataset, v1ServiceStatus } from "../server/v1-frozen.js";

const CLASSIC_V1_TOKEN = "0xe6e18f5b16e2c5a43c7f86731be22bb81704469f";
const CLASSIC_V4_CANARY = "0xb382f738a99820276fd66efb94b75eca104c2b4d";

function mockResponse() {
  return {
    headers: new Map(),
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

async function callHandler(handler, query = {}) {
  const response = mockResponse();
  await handler(
    { method: "GET", query, headers: {}, url: "/api/v1/launches" },
    response,
  );
  return {
    status: response.statusCode,
    body: response.body ? JSON.parse(response.body) : null,
  };
}

function releaseId(record) {
  return record.extensions?.["programmable/release"]?.releaseId ?? null;
}

describe("frozen API v1 dataset", () => {
  test("loads and publishes the immutable historical snapshot", async () => {
    const artifactBytes = await readFile(
      new URL("../snapshots/v1-launches.frozen.json", import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(artifactBytes).digest("hex"),
      "34306ba1f55cd2ec5acae2f190c34702ab3e66130a71bf3fc06bea0b976e066b",
    );
    const artifact = JSON.parse(artifactBytes.toString("utf8"));
    assert.equal(
      artifact.source.stockFeePolicy.repository,
      "https://github.com/0xprogrammable/PROGRAMMABLE-EVM",
    );
    const dataset = await getV1Dataset();
    const status = v1ServiceStatus(dataset.status);

    assert.equal(artifact.records.length, 376);
    assert.equal(artifact.counts.v1Published, 375);
    assert.equal(dataset.records.length, 375);
    assert.ok(dataset.records.some((record) =>
      record.token.address.toLowerCase() === CLASSIC_V1_TOKEN));
    assert.equal(dataset.records.some((record) =>
      record.token.address.toLowerCase() === CLASSIC_V4_CANARY), false);
    assert.equal(dataset.status.coverage.status, "complete");
    assert.ok(dataset.status.coverage.checkpoint);
    assert.equal(status.service, "operational");
    assert.equal(status.feeds.launches, "ready");
    assert.equal(status.feeds.tokenList, "ready");

    const launchResponse = await callHandler(
      createLaunchesHandler(async () => dataset),
      { limit: "100" },
    );
    assert.equal(launchResponse.status, 200);
    assert.equal(launchResponse.body.status, "ready");
    assert.ok(launchResponse.body.items.length > 0);
    assert.deepEqual(
      Object.keys(launchResponse.body.snapshot).sort(),
      ["blockHash", "blockNumber", "cursor", "finality", "indexedAt"],
    );

    const tokenListResponse = await callHandler(
      createTokenListHandler(async () => dataset),
    );
    assert.equal(tokenListResponse.status, 200);
    assert.ok(tokenListResponse.body.tokens.length > 0);
  });

  test("retains Classic V2 and maps historical Stock-Paired records to custom", async () => {
    const { records } = await getV1Dataset();
    const classicV2 = records.filter((record) => releaseId(record) === "classic-v2");
    const stockPaired = records.filter(
      (record) => record.launch.modelId === "stock-paired",
    );

    assert.equal(classicV2.length, 27);
    assert.ok(classicV2.every((record) => record.category === "classic"));
    assert.equal(stockPaired.length, 55);
    assert.ok(stockPaired.every((record) => record.category === "custom"));
    assert.deepEqual(
      [...new Set(stockPaired.map(releaseId))].sort(),
      ["stock-paired-v1", "stock-paired-v2", "stock-paired-v3"],
    );
    for (const record of stockPaired) {
      const fees = record.extensions["programmable/market-disclosure"].fees;
      assert.equal(fees.buyTotalFeeBps, 100);
      assert.equal(fees.sellTotalFeeBps, 100);
      assert.equal(fees.buyProjectFeeBps, 90);
      assert.equal(fees.sellProjectFeeBps, 90);
      assert.equal(fees.programmableFeeBps, 10);
      assert.equal(fees.transferTaxBps, 0);
      assert.equal(fees.lpFeePips, 0);
    }
  });

  test("does not leak Classic V4 or current Registry launches into v1", async () => {
    const { records } = await getV1Dataset();

    assert.equal(records.some((record) => releaseId(record) === "classic-v4"), false);
    assert.equal(
      records.some((record) => record.verification.registryAddress !== null),
      false,
    );
    assert.equal(
      records.some((record) =>
        Object.keys(record.extensions).some((key) => key.includes("registry"))),
      false,
    );
  });

  test("publishes every finalized complete token identity through the v1 token list", async () => {
    const dataset = await getV1Dataset();
    const eligible = dataset.records.filter(
      (record) =>
        record.launch.finality === "finalized" &&
        record.token?.identityStatus === "complete",
    );
    const list = tokenListPayload(
      dataset.records,
      dataset.status.generatedAt,
    );

    assert.ok(eligible.length > 0);
    assert.equal(list.tokens.length, eligible.length);
    assert.equal(list.timestamp, dataset.status.generatedAt);
    for (const token of list.tokens) {
      assert.match(token.address, /^0x[0-9a-fA-F]{40}$/u);
      assert.equal(typeof token.name, "string");
      assert.ok(token.name.length > 0);
      assert.equal(typeof token.symbol, "string");
      assert.ok(token.symbol.length > 0);
      assert.ok(Number.isInteger(token.decimals));
    }
  });

  test("does not leak legacy registry-aware cursor fields into the public snapshot", async () => {
    const dataset = await getV1Dataset();
    const cursor = encodePageCursor(
      dataset.records[0].sortKey,
      dataset.records[1].sortKey,
      "all",
      {
        blockNumber: String(dataset.status.coverage.checkpoint.blockNumber),
        blockHash: dataset.status.coverage.checkpoint.blockHash,
        indexedAt: dataset.status.generatedAt,
        finality: "finalized",
        customRegistryHighWaterGeneration: "0",
      },
      null,
      "0",
      "0",
    );
    const response = await callHandler(
      createLaunchesHandler(async () => dataset),
      { cursor, limit: "2" },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
      Object.keys(response.body.snapshot).sort(),
      ["blockHash", "blockNumber", "cursor", "finality", "indexedAt"],
    );
    assert.equal(
      Object.hasOwn(response.body.snapshot, "customRegistryHighWaterGeneration"),
      false,
    );
  });

  test("wires v1 defaults to the frozen loader while v2 remains live", async () => {
    const v1Sources = await Promise.all([
      "../api/v1/launches.js",
      "../api/v1/token-list.js",
      "../api/v1/status.js",
      "../api/v1/launches/[chainId]/[tokenAddress].js",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
    for (const source of v1Sources) {
      assert.match(source, /server\/v1-frozen\.js/u);
      assert.match(source, /\bgetV1Dataset\b/u);
      assert.doesNotMatch(source, /loadDataset\s*=\s*getDataset\b/u);
    }

    const v2DatasetSource = await readFile(
      new URL("../server/v2-dataset.js", import.meta.url),
      "utf8",
    );
    assert.match(
      v2DatasetSource,
      /import\s*\{[^}]*\bgetDataset\b[^}]*\}\s*from\s*["']\.\/dataset\.js["']/su,
    );
    assert.doesNotMatch(v2DatasetSource, /v1-frozen/u);
  });
});
