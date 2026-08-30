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
  "8de25f1d3f9022e2e10ef08be2ee75d36fb4202b6616b00ad6d5e244b824c862";
const SCHEMAS = Object.freeze({
  "capabilities.json": Object.freeze({
    component: "CustomLaunchCapabilitiesV2",
    sha256: "6887876a30704478ae9f800227f046f2ee07d022633f6f6960588a1c1832de8e",
  }),
  "custom-launch-create-request.json": Object.freeze({
    component: "CustomLaunchCreateRequestV4",
    sha256: "2a3520db569ea72d9e006d4c8fea3246336d69f9cee35cf527fdaea0341db33e",
  }),
  "custom-launch.json": Object.freeze({
    component: "CustomLaunchResourceV4",
    sha256: "3a2c0adacb42934ee42cc355867ff5094937375040689a61d158fbbcf87d9ae7",
  }),
  "exact-wallet-transaction.json": Object.freeze({
    component: "ExactWalletTransactionV4",
    sha256: "8f4789b39e916acfe37b37d4829070f34758b64515256afd2932f258f6eb21ba",
  }),
  "onchain-evidence.json": Object.freeze({
    component: "CustomLaunchOnchainEvidenceV2",
    sha256: "d99ae22d095cb591f25eb7fe679d727d863316798a4f5f62aeca25424fd15180",
  }),
  "pack-config.json": Object.freeze({
    component: "PackConfigV4",
    sha256: "49df9abd0f920327cf5d57aaf95c72fc5567bc32599965fd8431e8ebf2f326c6",
  }),
  "preflight.json": Object.freeze({
    component: "CustomLaunchPreflightV2",
    sha256: "58075dde83c658fd85996b4e3f073fa6cfd5f80c472fd162aad7fede77530ffa",
  }),
  "source-verification-status.json": Object.freeze({
    component: "SourceVerificationStatusV4",
    sha256: "b966aee03edaef7d67e30231f5c13e580edd6c4d983a23293746159b7b9c1c22",
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

  test("keeps Developer V2 external-root evidence in structural parity with the public V4 wire", async () => {
    const [{ document: developer }, { document: exactWallet }] = await Promise.all([
      strictDocument("schemas/v2/custom-launch-chain-deployment-v4.schema.json"),
      strictDocument("schemas/custom-launch/v4/exact-wallet-transaction.json"),
    ]);
    const canonicalRoot = exactWallet.properties.chainDeployment.properties
      .externalRootDeploymentEvidence.prefixItems[0];
    const developerRoot = developer.$defs.externalRoot;
    assert.deepEqual(developerRoot.required, canonicalRoot.required);
    assert.equal(developerRoot.additionalProperties, false);
    assert.equal(
      developerRoot["x-programmable-order"],
      canonicalRoot["x-programmable-order"],
    );

    const canonicalReadback = canonicalRoot.properties.providerReadbacks.prefixItems[0];
    const developerReadback = developer.$defs.externalRootProviderReadback;
    assert.deepEqual(developerReadback.required, canonicalReadback.required);
    assert.equal(developerReadback.additionalProperties, false);
    assert.deepEqual(
      Object.keys(developerReadback.properties).sort(),
      Object.keys(canonicalReadback.properties).sort(),
    );
    assert.equal(
      developerRoot.properties.previousBlockRuntimeCodeHash.const,
      canonicalRoot.properties.previousBlockRuntimeCodeHash.const,
    );
    assert.equal(
      developerReadback.properties.previousBlockRuntimeCodeHash.const,
      canonicalReadback.properties.previousBlockRuntimeCodeHash.const,
    );
    const canonicalRoots = exactWallet.properties.chainDeployment.properties
      .externalRootDeploymentEvidence.prefixItems;
    const developerRoots = developer.$defs.externalRootDeploymentEvidence
      .prefixItems;
    assert.deepEqual(
      developerRoots.map((root) => root.allOf[1].properties.previousBlockNumber),
      canonicalRoots.map((root) => root.properties.previousBlockNumber),
    );
  });
});
