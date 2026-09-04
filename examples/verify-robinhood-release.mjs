#!/usr/bin/env node
// Run from a clone of programmablehq/Developers with Node.js 20 or later.
// Uses only public discovery and the manifest's existing finalized launch.
import { verifyLaunchStamp } from "./verify-launch-stamp.mjs";

const discoveryUrl = process.env.PROGRAMMABLE_DISCOVERY_URL ||
  "https://developers.programmable.family/.well-known/programmable.json";
const rpcUrl = process.env.PROGRAMMABLE_RPC_URL;
const same = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
function requireValue(condition, message) { if (!condition) throw new Error(message); }
async function json(url, options = {}) {
  const parsed = new URL(url);
  requireValue(!parsed.username && !parsed.password &&
    (parsed.protocol === "https:" || parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)), "HTTPS URL required");
  const response = await fetch(parsed, { ...options, redirect: "error", signal: AbortSignal.timeout(20_000) });
  requireValue(response.ok, `Request failed with HTTP ${response.status}`);
  return response.json();
}

try {
  requireValue(Boolean(rpcUrl), "Set PROGRAMMABLE_RPC_URL to a Robinhood RPC provider");
  const discovery = await json(discoveryUrl);
  const chain = discovery.chains?.find((entry) => entry.chainId === 4663);
  requireValue(Boolean(chain?.manifestUrl), "Robinhood is not in platform discovery");
  const manifest = await json(chain.manifestUrl);
  const router = manifest.launchStampRouter;
  requireValue(manifest.chainId === 4663 && router?.status === "live", "Live Robinhood Router required");
  const sample = router.canaryEvidence;
  requireValue(sample?.finality === "finalized", "Finalized example required");
  const payload = await json(rpcUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [sample.transactionHash] }),
  });
  const receipt = payload.result;
  requireValue(!payload.error && receipt?.status === "0x1" &&
    same(receipt.transactionHash, sample.transactionHash) &&
    same(receipt.blockHash, sample.blockHash) &&
    BigInt(receipt.blockNumber).toString() === sample.blockNumber, "Example receipt mismatch or unavailable");
  const logs = receipt.logs.filter((log) => !log.removed && same(log.address, router.address) &&
    same(log.topics?.[0], router.events.launchStamped.topic0) && same(log.topics?.[1], sample.launchId));
  requireValue(logs.length === 1 && logs[0].topics.length === 4 &&
    /^0x[0-9a-f]{192}$/i.test(logs[0].data) &&
    /^0x0{24}[0-9a-f]{40}$/i.test(logs[0].topics[2]), "Exact Router launch event required");
  const token = `0x${logs[0].topics[2].slice(-40)}`;
  const eventStampHash = `0x${logs[0].data.slice(-64)}`;
  const result = await verifyLaunchStamp({ kind: "token", values: [token], chainId: 4663, rpcUrl, discoveryUrl });
  requireValue(result.state === "stamped" && result.category === "custom" &&
    result.publicLabel === "Programmable Custom" && same(result.launchId, sample.launchId) &&
    same(result.stampHash, eventStampHash) &&
    BigInt(result.block.number) >= BigInt(sample.blockNumber), `Verification incomplete: ${result.reason}`);
  console.log(JSON.stringify({ ...result, example: {
    transactionHash: sample.transactionHash, blockNumber: sample.blockNumber,
    blockHash: sample.blockHash, token,
    note: "The Router bytes32 launchId is distinct from the API request UUID.",
  } }, null, 2));
} catch (error) {
  // Provider URLs may contain credentials. Only explicit errors, never raw fetch errors.
  console.error(JSON.stringify({ state: "indeterminate", reason: error?.name === "TypeError" ?
    "network-or-input-unavailable" : error.message }));
  process.exitCode = 1;
}
