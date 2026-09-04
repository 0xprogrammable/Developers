import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { verifyLaunchStamp } from "../examples/verify-launch-stamp.mjs";

const candidate = JSON.parse(await readFile(new URL("../deployments/robinhood-v2.json", import.meta.url)));
const address = "0x1111111111111111111111111111111111111111";
const hash = `0x${"a".repeat(64)}`;

async function fixture(t, { manifest = candidate, finalized = "0x100", chainId = "0x1237" } = {}) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push(String(url));
    if (String(url).endsWith("/discovery")) return Response.json({
      manifestUrl: "https://docs.example/ethereum",
      chains: [{ chainId: 4663, manifestUrl: "https://docs.example/robinhood" }],
    });
    if (String(url).endsWith("/robinhood")) return Response.json(manifest);
    if (String(url).endsWith("/ethereum")) throw new Error("selected wrong chain");
    const rpc = JSON.parse(options.body);
    let result;
    if (rpc.method === "eth_chainId") result = chainId;
    else if (rpc.method === "eth_getBlockByNumber") result = {
      number: rpc.params[0] === "finalized" ? finalized : rpc.params[0], hash,
    };
    else throw new Error(`unexpected RPC ${rpc.method}`);
    return Response.json({ jsonrpc: "2.0", id: rpc.id, result });
  });
  return requests;
}

test("Robinhood verifier selects the advertised chain and does not require an Ethereum Classic canary", async t => {
  const requests = await fixture(t);
  const result = await verifyLaunchStamp({ kind: "token", values: [address], chainId: 4663,
    discoveryUrl: "https://docs.example/discovery", rpcUrl: "" });
  assert.equal(result.reason, "missing-rpc-url");
  assert.deepEqual(requests, ["https://docs.example/discovery", "https://docs.example/robinhood"]);
});

test("Robinhood verifier rejects mismatched manifest chain identity before RPC access", async t => {
  await fixture(t, { manifest: { ...candidate, chainId: 1 } });
  await assert.rejects(verifyLaunchStamp({ kind: "token", values: [address], chainId: 4663,
    discoveryUrl: "https://docs.example/discovery" }), /manifest-chain-mismatch/);
});

test("explicit Robinhood block cannot use head confirmations instead of finalized ancestry", async t => {
  await fixture(t);
  const result = await verifyLaunchStamp({ kind: "token", values: [address], chainId: 4663,
    discoveryUrl: "https://docs.example/discovery", rpcUrl: "https://rpc.example", blockTag: "257" });
  assert.equal(result.reason, "block-not-finalized");
  assert.equal(result.state, "indeterminate");
});

test("Router roots require finalized deployment and canary evidence", async t => {
  const manifest = structuredClone(candidate);
  manifest.launchStampRouter.deploymentEvidence.verificationStatus = "planned";
  await fixture(t, { manifest });
  const result = await verifyLaunchStamp({ kind: "token", values: [address], chainId: 4663,
    discoveryUrl: "https://docs.example/discovery", rpcUrl: "https://rpc.example" });
  assert.equal(result.state, "unavailable");
  assert.equal(result.reason, "router-canary-evidence-incomplete");
});
