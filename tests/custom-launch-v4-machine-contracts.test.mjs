import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  parseJsonStrict,
  REPOSITORY_ROOT,
} from "../scripts/lib/files.mjs";

const OPENAPI_PATH = "openapi/custom-launch-v4.json";
const EXPECTED_DOCUMENT_DIGEST =
  "a86dc96465d0a079d1f0804a8c39499ee7e7e682f10a8e78b2850b8ff77bd53e";
const SCHEMAS = Object.freeze({
  "capabilities.json": Object.freeze({
    component: "CustomLaunchCapabilitiesV2",
    sha256: "926a96aa9b01d03c0896845b51e3c6442697395343eeb23d901795723e3e5cfd",
  }),
  "custom-launch-create-request.json": Object.freeze({
    component: "CustomLaunchCreateRequestV4",
    sha256: "d8afb187333cf43212896b561adb640de2ac8832cc8f97f8315436e61f896299",
  }),
  "custom-launch.json": Object.freeze({
    component: "CustomLaunchResourceV4",
    sha256: "c9849f76da57044e3d0070d4f42a70271d6be50473103a2ff176f1e9ce0a878b",
  }),
  "exact-wallet-transaction.json": Object.freeze({
    component: "ExactWalletTransactionV4",
    sha256: "b15c5047c61ef30e50c6d64fd57806c15e14d11a86aaf0c25d0396f97f1a94b8",
  }),
  "onchain-evidence.json": Object.freeze({
    component: "CustomLaunchOnchainEvidenceV2",
    sha256: "598c23ad6cf486db4a8660b21cd53a6c6e068e4d615df162b2392a82bbdd95fa",
  }),
  "pack-config.json": Object.freeze({
    component: "PackConfigV4",
    sha256: "4a7a924a4773bf3ff6a29dab4779c6e314bc53d068d3cd40958a84bbb0e9d8ef",
  }),
  "preflight.json": Object.freeze({
    component: "CustomLaunchPreflightV2",
    sha256: "58075dde83c658fd85996b4e3f073fa6cfd5f80c472fd162aad7fede77530ffa",
  }),
});

async function strictDocument(relativePath) {
  const bytes = await readFile(path.join(REPOSITORY_ROOT, relativePath));
  return {
    bytes,
    document: parseJsonStrict(bytes.toString("utf8"), relativePath),
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function visit(value, callback) {
  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, callback));
    return;
  }
  if (value === null || typeof value !== "object") return;
  callback(value);
  Object.values(value).forEach((item) => visit(item, callback));
}

describe("Custom Launch V4 public machine contracts", () => {
  test("pins the final mirrored OpenAPI bytes and route surface", async () => {
    const { bytes, document } = await strictDocument(OPENAPI_PATH);
    assert.equal(sha256(bytes), EXPECTED_DOCUMENT_DIGEST);
    assert.equal(document.openapi, "3.1.0");
    assert.equal(document.info.title, "Programmable Custom Launch API V4");
    assert.equal(document.info.version, "4.0.0");
    assert.deepEqual(Object.keys(document.paths).sort(), [
      "/v4/chains/{chainId}/capabilities",
      "/v4/chains/{chainId}/custom-launches",
      "/v4/chains/{chainId}/custom-launches/preflight",
      "/v4/chains/{chainId}/custom-launches/{launchId}",
      "/v4/chains/{chainId}/finalized-custom-launches",
    ]);
  });

  test("keeps every standalone schema byte-pinned, self-contained and OpenAPI-identical", async () => {
    const { document: openapi } = await strictDocument(OPENAPI_PATH);
    for (const [name, expected] of Object.entries(SCHEMAS)) {
      const relativePath = `schemas/custom-launch/v4/${name}`;
      const { bytes, document } = await strictDocument(relativePath);
      assert.equal(sha256(bytes), expected.sha256, relativePath);
      assert.equal(
        document.$schema,
        "https://json-schema.org/draft/2020-12/schema",
        relativePath,
      );
      assert.equal(
        document.$id,
        `https://programmable.market/schemas/custom-launch/v4/${name}`,
        relativePath,
      );
      assert.deepEqual(
        document,
        openapi.components.schemas[expected.component],
        `${relativePath} must equal OpenAPI component ${expected.component}`,
      );
      visit(document, (value) => {
        if (typeof value.$ref === "string") {
          assert.match(value.$ref, /^#\//u, `${relativePath}: ${value.$ref}`);
        }
      });
    }
  });
});
