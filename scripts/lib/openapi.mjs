import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

import { parseJsonStrict } from "./files.mjs";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

function parseYamlStrict(source, label) {
  const document = parseDocument(source, {
    maxAliasCount: 0,
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `${label} is not strict YAML:\n${document.errors.map(String).join("\n")}`,
    );
  }
  return document.toJS({ maxAliasCount: 0 });
}

function parseStructuredDocument(source, url) {
  return url.pathname.endsWith(".json")
    ? parseJsonStrict(source, url.href)
    : parseYamlStrict(source, url.href);
}

function visitReferences(value, callback) {
  if (Array.isArray(value)) {
    for (const item of value) visitReferences(item, callback);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.$ref === "string") callback(value.$ref);
  for (const item of Object.values(value)) visitReferences(item, callback);
}

function atFragment(value, hash) {
  if (!hash || hash === "#") return value;
  const pointer = decodeURIComponent(hash.slice(1));
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, segment) => current?.[segment], value);
}

async function responseTextBounded(response, label) {
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_DOCUMENT_BYTES) {
    throw new Error(`${label} exceeds ${MAX_DOCUMENT_BYTES} bytes`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error(`${label} exceeds ${MAX_DOCUMENT_BYTES} bytes`);
  }
  return new TextDecoder().decode(bytes);
}

function withoutHash(url) {
  const copy = new URL(url);
  copy.hash = "";
  return copy;
}

export async function lintOpenApiGraph(entryUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new Map();
  const visited = new Set();
  const loading = new Set();

  async function load(url) {
    const documentUrl = withoutHash(url);
    const key = documentUrl.href;
    if (cache.has(key)) return cache.get(key);
    if (loading.has(key)) throw new Error(`Circular document load: ${key}`);
    loading.add(key);
    try {
      let source;
      if (documentUrl.protocol === "file:") {
        source = await readFile(fileURLToPath(documentUrl), "utf8");
      } else if (documentUrl.protocol === "https:") {
        const response = await fetchImpl(documentUrl, {
          headers: { accept: "application/json, application/yaml, text/yaml" },
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
          throw new Error(`${key} returned HTTP ${response.status}`);
        }
        source = await responseTextBounded(response, key);
      } else {
        throw new Error(`Unsupported OpenAPI reference protocol: ${key}`);
      }
      const value = parseStructuredDocument(source, documentUrl);
      cache.set(key, value);
      return value;
    } finally {
      loading.delete(key);
    }
  }

  async function validateDocument(url) {
    const documentUrl = withoutHash(url);
    const key = documentUrl.href;
    if (visited.has(key)) return;
    visited.add(key);
    const value = await load(documentUrl);
    const references = [];
    visitReferences(value, (reference) => references.push(reference));
    for (const reference of references) {
      let target;
      try {
        target = new URL(reference, documentUrl);
      } catch {
        throw new Error(`${key} contains an invalid $ref: ${reference}`);
      }
      const targetDocument = await load(target);
      if (atFragment(targetDocument, target.hash) === undefined) {
        throw new Error(`${key} contains an unresolved $ref: ${reference}`);
      }
      await validateDocument(target);
    }
  }

  const parsedEntryUrl = entryUrl instanceof URL ? entryUrl : new URL(entryUrl);
  await validateDocument(parsedEntryUrl);
  const entry = await load(parsedEntryUrl);
  if (
    typeof entry?.openapi !== "string" ||
    !entry.openapi.startsWith("3.1.") ||
    !entry.paths ||
    typeof entry.paths !== "object" ||
    !entry.components ||
    typeof entry.components !== "object"
  ) {
    throw new Error(`${parsedEntryUrl.href} is not an OpenAPI 3.1 document`);
  }
  return {
    documentCount: cache.size,
    referenceDocumentCount: Math.max(0, cache.size - 1),
  };
}
