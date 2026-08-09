#!/usr/bin/env node

const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const DEFAULT_DISCOVERY_URL =
  "https://developers.programmable.family/.well-known/programmable.json";

const [kind, ...values] = process.argv.slice(2);
const rpcUrl = process.env.PROGRAMMABLE_RPC_URL;
const discoveryUrl =
  process.env.PROGRAMMABLE_DISCOVERY_URL || DEFAULT_DISCOVERY_URL;

if (!rpcUrl || !new Set(["token", "hook", "pool", "component"]).has(kind)) usage();
if (kind === "pool" && values.length !== 2) usage();
if (kind !== "pool" && values.length !== 1) usage();

const discovery = await getJson(discoveryUrl);
const manifest = await getJson(discovery.manifestUrl);
const registry = manifest.customRegistry;
const stamp = registry?.launchStamp;

if (
  registry?.status !== "live" ||
  stamp?.status !== "live" ||
  !address(registry.address) ||
  !address(stamp.address) ||
  !decimalBlock(stamp.startBlock)
) {
  throw new Error("Programmable launch stamp is not live in the canonical manifest");
}

const rpcChainId = Number.parseInt(await rpc("eth_chainId", []), 16);
if (!Number.isSafeInteger(rpcChainId) || rpcChainId !== manifest.chainId) {
  throw new Error(`RPC chain mismatch: manifest=${manifest.chainId}, rpc=${rpcChainId}`);
}

const getter = stamp.getters?.[kind];
if (!/^0x[0-9a-f]{8}$/.test(getter?.selector ?? "")) {
  throw new Error(`Manifest does not publish the ${kind} getter selector`);
}

const args =
  kind === "pool"
    ? `${encodeAddress(values[0])}${encodeBytes32(values[1])}`
    : encodeAddress(values[0]);
const result = await rpc("eth_call", [
  { to: stamp.address, data: `${getter.selector}${args}` },
  "latest",
]);

const output = decodeResult(getter.result, result);
const lifecycle = output.launchId
  ? await readLifecycle(output.launchId, registry, stamp.lifecycle)
  : null;
console.log(
  JSON.stringify(
    {
      chainId: manifest.chainId,
      stamp: stamp.address,
      stampStartBlock: stamp.startBlock,
      registry: registry.address,
      query: { kind, values },
      launchedOnProgrammable: output.matched,
      launchId: output.launchId,
      lifecycle,
      claim: "provenance-only",
    },
    null,
    2,
  ),
);

async function readLifecycle(launchId, registry, lifecycleDescriptor) {
  const selector = lifecycleDescriptor?.getter?.selector;
  if (!/^0x[0-9a-f]{8}$/.test(selector ?? "")) {
    throw new Error("Manifest does not publish the Registry lifecycle getter");
  }
  const value = await rpc("eth_call", [
    { to: registry.address, data: `${selector}${encodeBytes32(launchId)}` },
    "latest",
  ]);
  if (!/^0x[0-9a-fA-F]{64,}$/.test(value) || (value.length - 2) % 64 !== 0) {
    throw new Error("Registry returned malformed lifecycle data");
  }
  const code = BigInt(`0x${value.slice(2, 66)}`).toString(10);
  const status = lifecycleDescriptor.statusCodes?.[code];
  if (!status) throw new Error(`Registry returned unknown lifecycle code ${code}`);
  return { code, status, active: status === "observed" || status === "finalized" };
}

function decodeResult(resultKind, value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Registry returned malformed data");
  }
  const normalized = value.toLowerCase();
  if (resultKind === "launch-id") {
    return {
      matched: normalized !== ZERO_BYTES32,
      launchId: normalized === ZERO_BYTES32 ? null : normalized,
    };
  }
  throw new Error(`Unsupported getter result: ${resultKind}`);
}

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`RPC ${payload.error.code}: ${payload.error.message}`);
  return payload.result;
}

async function getJson(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error(`Refusing non-HTTPS discovery URL: ${parsed.href}`);
  }
  const response = await fetch(parsed, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${parsed.href} returned HTTP ${response.status}`);
  return response.json();
}

function address(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function decimalBlock(value) {
  return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value);
}

function encodeAddress(value) {
  if (!address(value)) throw new Error(`Invalid EVM address: ${value}`);
  return value.slice(2).toLowerCase().padStart(64, "0");
}

function encodeBytes32(value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`Invalid bytes32 value: ${value}`);
  return value.slice(2).toLowerCase();
}

function usage() {
  console.error(
    "Usage:\n" +
      "  PROGRAMMABLE_RPC_URL=https://... node examples/verify-launch-stamp.mjs token <address>\n" +
      "  PROGRAMMABLE_RPC_URL=https://... node examples/verify-launch-stamp.mjs pool <poolManager> <poolId>\n" +
      "  PROGRAMMABLE_RPC_URL=https://... node examples/verify-launch-stamp.mjs hook|component <address>",
  );
  process.exit(2);
}
