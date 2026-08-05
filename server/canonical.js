import { createHash } from "node:crypto";

function assertUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("canonical JSON contains a lone surrogate");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("canonical JSON contains a lone surrogate");
    }
  }
}

function canonicalValue(value, active, depth) {
  if (depth > 128) throw new TypeError("canonical JSON is too deeply nested");
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON number is invalid");
    return JSON.stringify(value);
  }
  if (!value || typeof value !== "object") {
    throw new TypeError("canonical JSON value is invalid");
  }
  if (active.has(value)) throw new TypeError("canonical JSON is cyclic");
  active.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalValue(item, active, depth + 1)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("canonical JSON object prototype is invalid");
    }
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        assertUnicode(key);
        return `${JSON.stringify(key)}:${canonicalValue(value[key], active, depth + 1)}`;
      })
      .join(",")}}`;
  } finally {
    active.delete(value);
  }
}

export function canonicalizeJson(value) {
  return canonicalValue(value, new Set(), 0);
}

export function canonicalSha256(domain, value) {
  if (!/^programmable\.[a-z0-9.-]+\.v[1-9][0-9]*$/.test(domain)) {
    throw new TypeError("hash domain is invalid");
  }
  const hash = createHash("sha256");
  hash.update(domain, "utf8");
  hash.update(Uint8Array.of(0));
  hash.update(canonicalizeJson(value), "utf8");
  return `sha256:${hash.digest("hex")}`;
}

export function parseCanonicalJson(source) {
  const value = JSON.parse(source);
  if (canonicalizeJson(value) !== source) {
    throw new TypeError("response is not canonical JSON");
  }
  return value;
}
