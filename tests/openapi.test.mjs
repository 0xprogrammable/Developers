import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";
import { parseDocument } from "yaml";

import { REPOSITORY_ROOT } from "../scripts/lib/files.mjs";

const file = path.join(REPOSITORY_ROOT, "openapi/programmable-v2.yaml");
const source = await readFile(file, "utf8");
const document = parseDocument(source, {
  maxAliasCount: 0,
  prettyErrors: true,
  strict: true,
  uniqueKeys: true,
});
assert.deepEqual(document.errors, [], document.errors.join("\n"));
const spec = document.toJS({ maxAliasCount: 0 });

function atPointer(value, pointer) {
  return pointer
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, segment) => current?.[segment], value);
}

function visit(value, callback) {
  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, callback));
    return;
  }
  if (!value || typeof value !== "object") return;
  callback(value);
  Object.values(value).forEach((item) => visit(item, callback));
}

describe("OpenAPI v2 contract", () => {
  test("parses OpenAPI 3.1 with the complete stable route surface", () => {
    assert.equal(spec.openapi, "3.1.1");
    assert.equal(spec.info.version, "2.0.0");
    assert.deepEqual(Object.keys(spec.paths).sort(), [
      "/.well-known/programmable.json",
      "/api/v2/launches",
      "/api/v2/launches/{chainId}/{tokenAddress}",
      "/api/v2/launches/{launchId}",
      "/api/v2/manifest",
      "/api/v2/status",
      "/api/v2/token-list",
    ]);
    const operations = Object.values(spec.paths).map((item) => item.get.operationId);
    assert.equal(new Set(operations).size, operations.length);
  });

  test("keeps Developer reads and wallet signing boundaries explicit", () => {
    assert.match(spec.info.description, /409 CUSTOM_LAUNCH_V1_READ_ONLY/u);
    assert.match(
      spec.info.description,
      /public authenticated Ethereum\s+Mainnet preparation route/u,
    );
    assert.equal(
      spec.components.schemas.WellKnownDocument.properties.publicCategories
        .properties.custom.properties.publicSubmissionStatus.const,
      "closed",
    );
    assert.match(
      spec.components.schemas.WellKnownDocument.properties.publicCategories
        .properties.custom.properties.publicSubmissionStatus.description,
      /Backward-compatible legacy Registry and GitHub submission intake status/u,
    );
    assert.equal(
      spec.components.schemas.WellKnownDocument.properties.publicCategories
        .properties.custom.properties.customLaunchApiStatus.const,
      "live",
    );
    assert.equal(
      spec.components.schemas.WellKnownDocument.properties.publicCategories
        .properties.custom.properties.legacyRegistrySubmissionStatus.const,
      "closed",
    );
    assert.equal(
      spec.components.schemas.WellKnownDocument.properties.publicCategories
        .properties.custom.properties.legacyGithubSubmissionStatus.const,
      "closed",
    );
    assert.match(
      spec.paths["/api/v2/status"].get.description,
      /exact public Fee-Enforced V2 production profile/u,
    );
    assert.equal(
      spec.components.schemas.CustomFeeEnforcedLaunchProfileV2.$ref,
      "../schemas/v2/custom-fee-enforced-launch-profile-v2.schema.json",
    );
    assert.equal(
      spec.components.schemas.DirectNativeHookGraphProfileDiscoveryV1.$ref,
      "../schemas/v2/direct-native-hook-graph-profile-discovery-v1.schema.json",
    );
    assert.equal(
      spec.components.schemas.DirectNativeHookGraphProfileDiscoveryV2.$ref,
      "../schemas/v2/direct-native-hook-graph-profile-discovery-v2.schema.json",
    );
    assert.equal(spec.components.schemas.DirectNativeHookGraphProfileV1, undefined);
    assert.match(
      spec.paths["/api/v2/manifest"].get.description,
      /gated Direct Native Hook Graph V1 preview/u,
    );
    assert.equal(spec.paths["/v2/custom-launches"], undefined);
    assert.equal(spec.paths["/v3/custom-launches"], undefined);
    assert.match(
      spec.paths["/api/v2/manifest"].get.description,
      /(all|every) valid Uniswap v4\s+permission mask/u,
    );
    assert.doesNotMatch(source, /GitHub approval to permit/u);
  });

  test("resolves every local component and repository schema reference", async () => {
    const local = [];
    const relative = [];
    visit(spec, (value) => {
      if (typeof value.$ref !== "string") return;
      if (value.$ref.startsWith("#/")) local.push(value.$ref);
      else relative.push(value.$ref);
    });
    assert.ok(local.length > 0);
    for (const reference of local) {
      assert.notEqual(atPointer(spec, reference), undefined, reference);
    }
    for (const reference of relative) {
      assert.ok(!reference.includes("#"), reference);
      await access(path.resolve(path.dirname(file), reference));
    }
  });

  test("documents problem JSON and filter parity on every v2 feed route", () => {
    for (const route of [
      "/api/v2/launches",
      "/api/v2/launches/{chainId}/{tokenAddress}",
      "/api/v2/launches/{launchId}",
      "/api/v2/token-list",
    ]) {
      const operation = spec.paths[route].get;
      const parameters = operation.parameters.map((value) => value.$ref);
      if (route === "/api/v2/launches" || route === "/api/v2/token-list") {
        assert.ok(parameters.includes("#/components/parameters/ChainIdQuery"));
        assert.ok(parameters.includes("#/components/parameters/CategoryQuery"));
      }
      for (const code of ["400", "404", "429", "503"]) {
        const response = operation.responses[code];
        if (!response) continue;
        const resolved = response.$ref ? atPointer(spec, response.$ref) : response;
        assert.ok(resolved.content?.["application/problem+json"], `${route} ${code}`);
      }
    }
  });
});
