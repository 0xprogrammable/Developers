import {
  PUBLIC_RPC_URLS,
  REQUEST_LIMITS,
} from "./constants.js";
import { readBoundedJson } from "./bounded-body.js";

let nextRpcId = 1;

function safeProviderUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      !parsed.hostname
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function configuredProviders() {
  const providers = [];
  let configuredIndex = 0;
  const environmentNames = [
    "PROGRAMMABLE_ALCHEMY_MAINNET_RPC_URL",
    "PROGRAMMABLE_QUICKNODE_MAINNET_RPC_URL",
    "ETHEREUM_RPC_URL",
    "ETHEREUM_RPC_URL_B",
  ];
  for (const name of environmentNames) {
    const raw = process.env[name];
    if (typeof raw !== "string" || !raw.trim()) continue;
    let candidates = [raw.trim()];
    if (raw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) candidates = parsed;
      } catch {
        candidates = [];
      }
    }
    for (const candidate of candidates) {
      const url = safeProviderUrl(candidate);
      if (
        url &&
        !providers.some((provider) => provider.url === url)
      ) {
        configuredIndex += 1;
        providers.push({ url, label: `configured-${configuredIndex}` });
      }
    }
  }
  for (const [index, url] of PUBLIC_RPC_URLS.entries()) {
    if (!providers.some((provider) => provider.url === url)) {
      providers.push({ url, label: `public-${index + 1}` });
    }
  }
  return providers;
}

function safeErrorMessage(error) {
  if (error?.name === "AbortError") return "request timed out";
  if (error instanceof Error) {
    return error.message
      .replace(
        /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }
  return "unknown RPC failure";
}

async function callProvider(provider, method, params) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_LIMITS.rpcTimeoutMs,
    );
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "programmable-developer-api/1",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: nextRpcId++,
          method,
          params,
        }),
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        const transient =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;
        if (transient && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await readBoundedJson(
        response,
        REQUEST_LIMITS.rpcResponseBytes,
        "RPC response",
      );
      if (payload?.error) {
        const code = Number.isSafeInteger(payload.error.code)
          ? ` (${payload.error.code})`
          : "";
        throw new Error(`JSON-RPC provider returned an error${code}`);
      }
      if (!payload || !("result" in payload)) {
        throw new Error("missing JSON-RPC result");
      }
      return { result: payload.result, provider: provider.label };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("RPC retry budget exhausted");
}

export async function rpcCall(method, params, options = {}) {
  const providers = configuredProviders();
  if (options.preferredProvider) {
    providers.sort((a, b) => {
      if (a.label === options.preferredProvider) return -1;
      if (b.label === options.preferredProvider) return 1;
      return 0;
    });
  }

  const errors = [];
  for (const provider of providers) {
    try {
      return await callProvider(provider, method, params);
    } catch (error) {
      errors.push(`${provider.label}: ${safeErrorMessage(error)}`);
    }
  }
  throw new Error(`${method} failed (${errors.join("; ")})`);
}

export function parseQuantity(value) {
  if (
    typeof value !== "string" ||
    value.length > 66 ||
    !/^0x[0-9a-f]{1,64}$/i.test(value)
  ) {
    throw new Error("invalid RPC quantity");
  }
  const parsed = Number(BigInt(value));
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("RPC quantity exceeds safe integer range");
  }
  return parsed;
}

export function toQuantity(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("invalid block number");
  }
  return `0x${value.toString(16)}`;
}

export async function readHeadBlock() {
  const response = await rpcCall("eth_blockNumber", []);
  return {
    blockNumber: parseQuantity(response.result),
    provider: response.provider,
  };
}

export async function readFinalizedBlock(preferredProvider) {
  const response = await rpcCall(
    "eth_getBlockByNumber",
    ["finalized", false],
    { preferredProvider },
  );
  if (!response.result) throw new Error("finalized block is unavailable");
  let timestamp = null;
  try {
    timestamp = parseQuantity(response.result.timestamp);
  } catch {
    timestamp = null;
  }
  return {
    blockNumber: parseQuantity(response.result.number),
    blockHash: response.result.hash ?? null,
    timestamp,
    provider: response.provider,
  };
}

export async function readBlock(blockNumber, preferredProvider) {
  const response = await rpcCall(
    "eth_getBlockByNumber",
    [toQuantity(blockNumber), false],
    { preferredProvider },
  );
  if (!response.result) throw new Error(`block ${blockNumber} not found`);
  let timestamp = null;
  try {
    timestamp = parseQuantity(response.result.timestamp);
  } catch {
    timestamp = null;
  }
  return {
    blockNumber: parseQuantity(response.result.number),
    blockHash: response.result.hash ?? null,
    timestamp,
    provider: response.provider,
  };
}

export async function readLogs(filter, preferredProvider) {
  const response = await rpcCall("eth_getLogs", [filter], {
    preferredProvider,
  });
  if (!Array.isArray(response.result)) {
    throw new Error("eth_getLogs returned a non-array result");
  }
  return { logs: response.result, provider: response.provider };
}

export async function ethCall(
  address,
  data,
  preferredProvider,
  blockNumber = null,
) {
  const blockTag = blockNumber === null ? "latest" : toQuantity(blockNumber);
  const response = await rpcCall(
    "eth_call",
    [{ to: address, data }, blockTag],
    { preferredProvider },
  );
  return response.result;
}
