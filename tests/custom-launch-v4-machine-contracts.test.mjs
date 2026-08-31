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
  "581eb94ad6b8500646ec8b60aa56023c1badee44daf8814ffcd821a85e1ed1ef";
const SCHEMAS = Object.freeze({
  "capabilities.json": Object.freeze({
    component: "CustomLaunchCapabilitiesV2",
    sha256: "441ae5f45536ff52dce618fdd55cc1f7235ff1535935070087d9328f1ae85434",
  }),
  "custom-launch-create-request.json": Object.freeze({
    component: "CustomLaunchCreateRequestV4",
    sha256: "904e6a459f84885413faea02fd7bc609e2967dfc772dd52ed4a66b9f2bbe31bb",
  }),
  "custom-launch.json": Object.freeze({
    component: "CustomLaunchResourceV4",
    sha256: "1fec0ec89eb22f2b6dc8f5721e65c1a69f1a4171f1b0a5a8fd237b73e149d681",
  }),
  "exact-wallet-transaction.json": Object.freeze({
    component: "ExactWalletTransactionV4",
    sha256: "ca94fc74a2670d72ce222198730fd2380abb69924fa91e76a84853ae6f77965c",
  }),
  "onchain-evidence.json": Object.freeze({
    component: "CustomLaunchOnchainEvidenceV2",
    sha256: "0c9521ba8c858d197562668a578468f578636eaccd4b4309d5120fce28e6e201",
  }),
  "pack-config.json": Object.freeze({
    component: "PackConfigV4",
    sha256: "64a6aea9c45fc55c6acf63588ffadc668ca8465f84e1cb6dfd5577919d73ff7c",
  }),
  "preflight.json": Object.freeze({
    component: "CustomLaunchPreflightV2",
    sha256: "58075dde83c658fd85996b4e3f073fa6cfd5f80c472fd162aad7fede77530ffa",
  }),
  "source-verification-status.json": Object.freeze({
    component: "SourceVerificationStatusV4",
    sha256: "09844bfb244839084f06925f9f7fe8d2689e46c66ea4c453c7a7931fb68bb94c",
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

  test("publishes the bounded chain-scoped V4 pagination contract", async () => {
    const { document: openapi } = await strictDocument(OPENAPI_PATH);
    for (const route of [
      "/v4/chains/{chainId}/custom-launches",
      "/v4/chains/{chainId}/finalized-custom-launches",
    ]) {
      const query = openapi.paths[route].get.parameters.filter(({ in: location }) =>
        location === "query");
      assert.deepEqual(query.map(({ name }) => name), ["limit", "cursor"]);
      assert.deepEqual(query[0].schema, {
        type: "integer", minimum: 1, maximum: 25, default: 10,
      });
      assert.deepEqual(query[1].schema, {
        type: "string", minLength: 16, maxLength: 512,
        pattern: "^[A-Za-z0-9_-]+$",
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
