import { createHash } from "node:crypto";
import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  http,
  keccak256,
  toEventSelector,
  toFunctionSelector,
  type Abi,
  type AbiEvent,
  type AbiFunction,
  type Address,
  type Hex,
} from "viem";

const DEFAULT_DISCOVERY_URL =
  "https://developers.programmable.family/.well-known/programmable.json";
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;

type Query =
  | { kind: "token" | "component"; address: Address }
  | { kind: "pool"; poolManager: Address; poolId: Hex };

type GetterDescriptor = {
  signature: string;
  selector: Hex;
  result: string;
};

type RouterManifest = {
  status: "prelaunch" | "live" | "retired";
  address: Address | null;
  startBlock: string | null;
  endBlock: string | null;
  runtimeCodeHash: Hex | null;
  abiUrl: string;
  abiSha256: string | null;
  events: {
    launchStamped: { signature: string; topic0: Hex } | null;
    componentStamped: { signature: string; topic0: Hex } | null;
  };
  getters: Record<string, GetterDescriptor | null>;
};

export async function verifyLaunchStampWithViem({
  query,
  rpcUrl,
  discoveryUrl = DEFAULT_DISCOVERY_URL,
  block = "finalized",
}: {
  query: Query;
  rpcUrl?: string;
  discoveryUrl?: string;
  block?: "finalized" | bigint;
}) {
  const discovery = await fetchJson(discoveryUrl);
  const manifest = await fetchJson(discovery.manifestUrl);
  const router = manifest.launchStampRouter as RouterManifest | undefined;

  if (
    !router ||
    router.status === "prelaunch" ||
    !router.address ||
    !router.startBlock ||
    !router.runtimeCodeHash ||
    !router.abiSha256 ||
    !router.events.launchStamped ||
    !router.events.componentStamped ||
    !router.getters.token ||
    !router.getters.pool ||
    !router.getters.component ||
    !router.getters.componentRuntimeCodeHash ||
    !router.getters.record
  ) {
    return result("unavailable", "router-prelaunch-or-incomplete", query);
  }
  if (!rpcUrl) return result("indeterminate", "missing-rpc-url", query);

  const client = createPublicClient({ transport: http(rpcUrl) });
  try {
    const chainId = await client.getChainId();
    if (chainId !== manifest.chainId) {
      return result("indeterminate", "chain-mismatch", query);
    }

    const canonicalBlock =
      block === "finalized"
        ? await client.getBlock({ blockTag: "finalized" })
        : await client.getBlock({ blockNumber: block });
    const blockNumber = canonicalBlock.number;
    if (blockNumber < BigInt(router.startBlock)) {
      return result("unavailable", "block-before-router-start", query);
    }
    if (
      router.status === "retired" &&
      (!router.endBlock || blockNumber > BigInt(router.endBlock))
    ) {
      return result("unavailable", "block-outside-router-range", query);
    }

    const code = await client.getBytecode({
      address: router.address,
      blockNumber,
    });
    if (!code || keccak256(code) !== router.runtimeCodeHash) {
      return result("indeterminate", "router-runtime-mismatch", query);
    }

    const { abi, sha256 } = await fetchAbi(router.abiUrl);
    if (sha256 !== router.abiSha256) {
      return result("indeterminate", "router-abi-hash-mismatch", query);
    }
    validatePublishedAbi(abi, router);

    const pointDescriptor = router.getters[query.kind]!;
    const pointFunction = describedFunction(abi, pointDescriptor);
    const pointArgs =
      query.kind === "pool"
        ? [query.poolManager, query.poolId]
        : [query.address];
    const launchId = (await callFunction({
      client,
      router: router.address,
      blockNumber,
      item: pointFunction,
      args: pointArgs,
    })) as Hex;

    if (launchId === ZERO_BYTES32) {
      return {
        ...result("not-stamped", "zero-launch-id", query),
        chainId,
        router: router.address,
        blockNumber,
        blockHash: canonicalBlock.hash,
        launchId: null,
      };
    }

    const recordFunction = describedFunction(abi, router.getters.record);
    const decodedRecord = await callFunction({
      client,
      router: router.address,
      blockNumber,
      item: recordFunction,
      args: [launchId],
    });
    const record = namedOutputs(recordFunction, decodedRecord);
    if (!record.stampHash || record.stampHash === ZERO_BYTES32) {
      return result("indeterminate", "stamp-record-empty", query);
    }
    if (
      query.kind === "token" &&
      normalizeAddress(record.token) !== query.address.toLowerCase()
    ) {
      return result("indeterminate", "stamp-record-token-mismatch", query);
    }
    if (
      query.kind === "pool" &&
      (normalizeAddress(record.poolManager) !== query.poolManager.toLowerCase() ||
        String(record.poolId).toLowerCase() !== query.poolId.toLowerCase())
    ) {
      return result("indeterminate", "stamp-record-pool-mismatch", query);
    }

    const classification = classifyLaunchKind(record.kind);
    if (!classification) {
      return result("indeterminate", "launch-kind-unknown", query);
    }

    let componentRuntime = null;
    if (query.kind === "token" || query.kind === "component") {
      const runtimeFunction = describedFunction(
        abi,
        router.getters.componentRuntimeCodeHash,
      );
      const recorded = (await callFunction({
        client,
        router: router.address,
        blockNumber,
        item: runtimeFunction,
        args: [query.address],
      })) as Hex;
      const observedCode = await client.getBytecode({
        address: query.address,
        blockNumber,
      });
      componentRuntime = {
        recorded,
        observed: observedCode ? keccak256(observedCode) : null,
        matches: observedCode ? keccak256(observedCode) === recorded : null,
      };
    }

    return {
      state: "stamped",
      reason: "canonical-router-record",
      chainId,
      router: router.address,
      routerStartBlock: router.startBlock,
      blockNumber,
      blockHash: canonicalBlock.hash,
      query,
      launchId,
      launchKind: classification.kind,
      category: classification.category,
      publicLabel: classification.publicLabel,
      stampHash: record.stampHash,
      componentRuntime,
      claim: "provenance-only",
    };
  } catch {
    return result("indeterminate", "verification-failed", query);
  }
}

async function callFunction({
  client,
  router,
  blockNumber,
  item,
  args,
}: {
  client: ReturnType<typeof createPublicClient>;
  router: Address;
  blockNumber: bigint;
  item: AbiFunction;
  args: readonly unknown[];
}) {
  const data = encodeFunctionData({
    abi: [item] as Abi,
    functionName: item.name,
    args,
  });
  const response = await client.call({ to: router, data, blockNumber });
  if (!response.data) throw new Error("empty eth_call result");
  return decodeFunctionResult({
    abi: [item] as Abi,
    functionName: item.name,
    data: response.data,
  });
}

function validatePublishedAbi(abi: Abi, router: RouterManifest) {
  for (const descriptor of Object.values(router.getters)) {
    if (descriptor) describedFunction(abi, descriptor);
  }
  for (const descriptor of Object.values(router.events)) {
    if (!descriptor) throw new Error("missing event descriptor");
    const item = abi.find(
      (candidate): candidate is AbiEvent =>
        candidate.type === "event" && eventSignature(candidate) === descriptor.signature,
    );
    if (!item || toEventSelector(item) !== descriptor.topic0) {
      throw new Error("event topic mismatch");
    }
  }
}

function describedFunction(abi: Abi, descriptor: GetterDescriptor | null) {
  if (!descriptor) throw new Error("missing getter descriptor");
  const item = abi.find(
    (candidate): candidate is AbiFunction =>
      candidate.type === "function" &&
      functionSignature(candidate) === descriptor.signature,
  );
  if (!item || toFunctionSelector(item) !== descriptor.selector) {
    throw new Error("getter selector mismatch");
  }
  return item;
}

function namedOutputs(item: AbiFunction, decoded: unknown) {
  if (item.outputs.length === 1 && item.outputs[0].type === "tuple") {
    return decoded as Record<string, unknown>;
  }
  if (!Array.isArray(decoded)) throw new Error("record output is not a tuple");
  return Object.fromEntries(
    item.outputs.map((output, index) => [output.name || String(index), decoded[index]]),
  );
}

function classifyLaunchKind(value: unknown) {
  const kind = BigInt(value as bigint);
  if (kind === 0n) {
    return {
      kind: "CustomGraph",
      category: "custom",
      publicLabel: "Programmable Custom",
    };
  }
  if (kind === 1n) {
    return {
      kind: "Classic",
      category: "classic",
      publicLabel: "Programmable Classic",
    };
  }
  return null;
}

function functionSignature(item: AbiFunction) {
  return `${item.name}(${item.inputs.map(canonicalType).join(",")})`;
}

function eventSignature(item: AbiEvent) {
  return `${item.name}(${item.inputs.map(canonicalType).join(",")})`;
}

function canonicalType(input: { type: string; components?: readonly unknown[] }) {
  if (!input.type.startsWith("tuple")) return input.type;
  const suffix = input.type.slice("tuple".length);
  const components = (input.components ?? []) as readonly {
    type: string;
    components?: readonly unknown[];
  }[];
  return `(${components.map(canonicalType).join(",")})${suffix}`;
}

async function fetchAbi(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`ABI HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    abi: JSON.parse(new TextDecoder().decode(bytes)) as Abi,
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

async function fetchJson(url: string) {
  const parsed = new URL(url);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.username || parsed.password) throw new Error("credentials in URL");
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("HTTPS required");
  }
  const response = await fetch(parsed, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function result(state: string, reason: string, query: Query) {
  return { state, reason, query, claim: "provenance-only" };
}
