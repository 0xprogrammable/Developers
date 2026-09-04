import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalSha256 } from "../server/canonical.js";
import { keccak256 } from "../server/keccak.js";
import {
  DIRECT_CHAIN_SMOKE_SCHEMA, fetchDirectChainJson, parseDirectChainArguments,
  runDirectChainSmoke, verifyDirectChainState,
} from "../scripts/direct-chain-smoke.mjs";

const hash = (value) => `0x${value.repeat(64)}`;
const address = (value) => `0x${value.repeat(40)}`;
const word = (value) => value.slice(2).padStart(64, "0");
const publicLaunchId = "b451a50f-026b-4e68-9c16-68e41c318076";
const now = Date.parse("2026-09-04T20:00:00.000Z");
const json = (value) => new Response(JSON.stringify(value), {
  headers: { "content-type": "application/json" },
});

async function fixture() {
  const manifest = JSON.parse(await readFile(new URL("../deployments/robinhood-v2.json",
    import.meta.url), "utf8"));
  manifest.generatedAt = "2026-09-03T00:00:00.000Z";
  const integration = {
    schemaVersion: "programmable.direct-chain-integration.v1", status: "live",
    platformId: "programmable", category: "custom", publicLabel: "Programmable Custom",
    indexing: "direct-chain", publicWrites: false, hostedIndexer: "unavailable",
    evidenceUrl: "https://developers.programmable.family/deployments/robinhood-direct-chain-evidence-v1.json",
    finality: { mode: "rpc-finalized", explicitBlockRequiresFinalizedAncestor: true },
  };
  manifest.directChainIntegration = integration;
  manifest.customLaunchV4.status = "planned";
  manifest.publicCategories.custom.discoveryStatus = "live";
  const router = manifest.launchStampRouter;
  Object.assign(router, {
    status: "live", address: address("1"), runtimeCodeHash: keccak256(Buffer.from("6000", "hex")),
    startBlock: "5", bindings: { permitAuthority: address("2"), graphFactory: address("3"),
      poolManager: address("4") },
    canaryEvidence: { finality: "finalized", launchId: hash("a"), stampHash: hash("b"),
      transactionHash: hash("c"), blockHash: hash("d"), blockNumber: "10",
      components: { token: address("5"), hook: address("6") } },
  });
  const canary = router.canaryEvidence;
  const status = { chainId: 4663, caip2: "eip155:4663", service: "degraded",
    checkedAt: manifest.generatedAt, custom: { status: "live" },
    directChainIntegration: integration, feeds: { launches: "unavailable", tokenList: "unavailable" } };
  const feed = { schemaVersion: "programmable.custom-launch-list.v4", apiVersion: "v4",
    chainId: "4663", caip2: "eip155:4663", generatedAt: new Date(now).toISOString(),
    quality: { status: "ready", quarantinedRowCount: 0 }, nextCursor: null,
    launches: [{ schemaVersion: "programmable.finalized-custom-launch-metadata.v4",
      launchId: publicLaunchId, platformId: "programmable", category: "custom",
      chainId: "4663", caip2: "eip155:4663", finalizedAt: "2026-09-03T20:00:00.000Z",
      onchain: { terminal: true, router: router.address, routerRuntimeCodeHash: router.runtimeCodeHash,
        routerLaunchId: canary.launchId, transactionHash: canary.transactionHash,
        l2Inclusion: { chainId: "4663", blockNumber: canary.blockNumber, blockHash: canary.blockHash,
          transactionHash: canary.transactionHash, receiptStatus: "success" } } }],
  };
  const record = [word("0x1"), word(address("7")), word(canary.components.token),
    word(canary.components.hook), word(router.bindings.poolManager), word(hash("8")),
    ...Array(7).fill(word(hash("9"))), word(canary.stampHash)];
  const callResults = new Map();
  const callValue = (signature, value) => callResults.set(
    keccak256(new TextEncoder().encode(signature)).slice(0, 10), value);
  callValue("CHAIN_ID()", `0x${word("0x1237")}`);
  callValue("PERMIT_AUTHORITY()", `0x${word(router.bindings.permitAuthority)}`);
  callValue("GRAPH_FACTORY()", `0x${word(router.bindings.graphFactory)}`);
  callValue("POOL_MANAGER()", `0x${word(router.bindings.poolManager)}`);
  callValue("launchIdByToken(address)", canary.launchId);
  callValue("launchIdByComponent(address)", canary.launchId);
  callValue("launchStamp(bytes32)", `0x${record.join("")}`);
  callValue("stampProof(address)", `0x${word(canary.launchId)}${word(canary.stampHash)}`);
  const receipt = { status: "0x1", transactionHash: canary.transactionHash,
    blockNumber: "0xa", blockHash: canary.blockHash, logs: [{ address: router.address,
      topics: [router.events.launchStamped.topic0, canary.launchId,
        `0x${word(canary.components.token)}`, `0x${word(canary.components.hook)}`],
      data: `0x${word(router.bindings.poolManager)}${record[5]}${record[13]}`, removed: false }] };
  const calls = [];
  const rpc = async (method, params) => {
    calls.push({ method, params });
    if (method === "eth_chainId") return "0x1237";
    if (method === "eth_getBlockByNumber") return params[0] === "0xa"
      ? { number: "0xa", hash: canary.blockHash }
      : { number: "0x14", hash: hash("e") };
    if (method === "eth_getCode") return "0x6000";
    if (method === "eth_call") return callResults.get(params[0].data.slice(0, 10));
    if (method === "eth_getTransactionReceipt") return receipt;
    throw new Error(`unexpected method ${method}`);
  };
  const evidence = { schemaVersion: "programmable.robinhood-direct-chain-evidence.v1",
    chainId: 4663, platformId: "programmable", category: "custom", publicLabel: "Programmable Custom",
    deployment: { routerAddress: router.address, runtimeCodeHash: router.runtimeCodeHash,
      blockNumber: router.startBlock }, launch: { ...canary, publicLaunchId } };
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    assert.equal(options.redirect, "error");
    if (options.method === "POST") {
      const request = JSON.parse(options.body);
      return json({ jsonrpc: "2.0", id: request.id, result: await rpc(request.method, request.params) });
    }
    if (url.includes("/manifests/4663")) return json(manifest);
    if (url.includes("/status?")) return json(status);
    if (url.includes("/finalized-custom-launches")) {
      const limit = Number(new URL(url).searchParams.get("limit"));
      if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
        return new Response("Invalid pagination", { status: 400 });
      }
      return json(feed);
    }
    if (url.endsWith("robinhood-direct-chain-evidence-v1.json")) return json(evidence);
    throw new Error("unexpected URL");
  };
  return { manifest, status, feed, evidence, rpc, calls, receipt, callResults, requests, fetchImpl,
    run: (overrides = {}) => runDirectChainSmoke({ apiBase: "https://developers-candidate.vercel.app",
      expectedManifest: manifest, expectedEvidence: evidence, fetchImpl, now: () => now, ...overrides }) };
}

test("direct-chain smoke proves the exact publication and finalized canonical stamp without hosted activation", async () => {
  const input = await fixture();
  const result = await input.run({ protectionBypass: true, bypassSecret: "test-bypass" });
  const { smokeDigest, ...payload } = result;
  assert.equal(smokeDigest, canonicalSha256(DIRECT_CHAIN_SMOKE_SCHEMA, payload));
  assert.equal(result.launchId, publicLaunchId);
  assert.equal(result.publicWrites, false);
  assert.equal(result.hostedIndexer, "unavailable");
  for (const request of input.requests) {
    const candidate = new URL(request.url).hostname.endsWith(".vercel.app");
    assert.equal(request.options.headers["x-vercel-protection-bypass"], candidate ? "test-bypass" : undefined);
  }
  for (const call of input.calls.filter(({ method }) => ["eth_call", "eth_getCode"].includes(method))) {
    assert.deepEqual(call.params[1], { blockHash: hash("e"), requireCanonical: true });
  }
});

test("rejects source substitution, hosted activation, stale or foreign finalized-feed data", async () => {
  const modifiedSource = await fixture();
  await assert.rejects(modifiedSource.run({ expectedEvidence: { replaced: true } }), /evidence differs/);
  await assert.rejects(modifiedSource.run({ expectedManifest: { replaced: true } }), /manifest differs/);
  for (const mutation of [
    (input) => { input.status.checkedAt = new Date(now).toISOString(); },
    (input) => { input.status.checkedAt = "invalid"; },
    (input) => { input.status.service = "operational"; },
    (input) => { input.status.feeds.launches = "ready"; },
    (input) => { input.feed.generatedAt = "2026-09-03T20:00:00.000Z"; },
    (input) => { input.feed.chainId = "1"; },
    (input) => { input.feed.quality.status = "partial"; },
    (input) => { input.feed.launches[0].onchain.routerLaunchId = hash("f"); },
  ]) {
    const input = await fixture();
    mutation(input);
    await assert.rejects(input.run());
  }
});

test("rejects insufficient finality, runtime mismatch, invalid stamps, receipt mismatch and reorgs", async () => {
  for (const change of [
    (method, params, value) => method === "eth_getCode" ? "0x6001" : value,
    (method, params, value) => method === "eth_getBlockByNumber" && params[0] === "finalized"
      ? { ...value, number: "0x9" } : value,
    (method, params, value) => method === "eth_getBlockByNumber" && params[0] === "0x14"
      ? { ...value, hash: hash("f") } : value,
    (method, params, value) => method === "eth_getTransactionReceipt" ? { ...value, status: "0x0" } : value,
    (method, params, value) => method === "eth_call" && params[0].data.startsWith("0x4c9e4764")
      ? `0x${word("0x2")}${value.slice(66)}` : value,
  ]) {
    const input = await fixture();
    await assert.rejects(verifyDirectChainState({ manifest: input.manifest, evidence: input.evidence,
      rpc: async (method, params) => change(method, params, await input.rpc(method, params)) }));
  }
});

test("archive errors fail closed and never trigger latest-state fallback", async () => {
  const input = await fixture();
  await assert.rejects(verifyDirectChainState({ manifest: input.manifest, evidence: input.evidence,
    rpc: async (method, params) => {
      if (method === "eth_getCode") throw new Error("metadata not found");
      return input.rpc(method, params);
    } }), /metadata not found/);
  assert.equal(input.calls.some(({ params }) => params.includes("latest")), false);
});

test("tag-only provider must keep the exact finalized checkpoint unchanged across every state read", async () => {
  for (const moves of [false, true]) {
    const input = await fixture();
    let finalizedReads = 0;
    const verify = verifyDirectChainState({ manifest: input.manifest, evidence: input.evidence,
      rpc: async (method, params) => {
        if (["eth_call", "eth_getCode"].includes(method) && typeof params[1] === "object") {
          throw new Error("hash-bound state unsupported");
        }
        const result = await input.rpc(method, params);
        if (method === "eth_getBlockByNumber" && params[0] === "finalized" &&
          ++finalizedReads === 3 && moves) return { ...result, hash: hash("f") };
        return result;
      } });
    if (moves) await assert.rejects(verify, /finalized read block changed/);
    else {
      await verify;
      assert.equal(finalizedReads, 3);
      assert(input.calls.filter(({ method }) => method === "eth_call")
        .every(({ params }) => params[1] === "finalized"));
    }
  }
});

test("bounds and validates transport and refuses bypass on public origins", async () => {
  const input = await fixture();
  await assert.rejects(input.run({ apiBase: "https://developers.programmable.family",
    protectionBypass: true, bypassSecret: "test-bypass" }), /generated Vercel origin/);
  await assert.rejects(fetchDirectChainJson("https://example.com", {
    maximumBytes: 4, fetchImpl: async () => json({ oversized: true }),
  }), /byte limit/);
  await assert.rejects(fetchDirectChainJson("https://example.com", {
    fetchImpl: async () => new Response("", { status: 302, headers: { location: "https://other.example" } }),
  }), /HTTP 302/);
  assert.throws(() => parseDirectChainArguments(["--mode", "planned", "--output", "x"]));
  assert.throws(() => parseDirectChainArguments(["--output", "x", "--output", "y"]));
  assert.deepEqual(parseDirectChainArguments(["--output", "x"]), { protectionBypass: false, output: "x" });
});
