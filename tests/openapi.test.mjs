import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";
import { parseDocument } from "yaml";

import {
  parseJsonStrict,
  readJson,
  REPOSITORY_ROOT,
} from "../scripts/lib/files.mjs";

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
  test("rejects duplicate JSON keys before resolving external contracts", () => {
    assert.throws(
      () => parseJsonStrict('{"schema":{"type":"string"},"schema":{}}'),
      /is not strict JSON/u,
    );
  });

  test("parses OpenAPI 3.1 with the complete stable route surface", () => {
    assert.equal(spec.openapi, "3.1.1");
    assert.equal(spec.info.version, "2.0.0");
    assert.deepEqual(Object.keys(spec.paths).sort(), [
      "/.well-known/programmable.json",
      "/api/v2/launches",
      "/api/v2/launches/{chainId}/{tokenAddress}",
      "/api/v2/launches/{launchId}",
      "/api/v2/manifest",
      "/api/v2/manifests/{chainId}",
      "/api/v2/status",
      "/api/v2/token-list",
      "/v3/finalized-custom-launches",
    ]);
    const operations = Object.values(spec.paths).map((item) => item.get.operationId);
    assert.equal(new Set(operations).size, operations.length);
  });

  test("keeps Developer reads and wallet signing boundaries explicit", () => {
    assert.match(spec.info.description, /409 CUSTOM_LAUNCH_V1_READ_ONLY/u);
    assert.match(
      spec.info.description,
      /Custom Launch API V3 profile `3\.3\.0` is the sole fresh-submission route/u,
    );
    assert.match(spec.info.description, /currentCustomLaunchCreate/u);
    assert.match(spec.info.description, /bounded one-level subkeys/u);
    assert.deepEqual(spec["x-programmable-partner-credentials"], {
      schemaVersion: "programmable.partner-public-contract.v1",
      status: "live",
      environmentVariable: "PROGRAMMABLE_API_KEY",
      credentialKinds: ["root", "subkey"],
      canonicalV3LaunchRoutes: true,
      launchScopes: ["custom-launch:create", "custom-launch:read"],
      rootOnlyScope: "partner-subkeys:manage",
      subkeyAdminRoutes: [
        "GET /v1/partner/subkeys",
        "POST /v1/partner/subkeys",
        "POST /v1/partner/subkeys/{subkeyId}/rotate",
        "DELETE /v1/partner/subkeys/{subkeyId}",
      ],
      maximumSubkeyDepth: 1,
      subkeyScopesAndBudgetsCannotExceedRoot: true,
      subkeyExpiryCannotExceedRoot: true,
      permitReissueDispositionCredentialKind: "wallet-only",
      metadataPolicySameAsWalletKeys: true,
      controllerWallet: {
        walletKey: "must-equal-key-wallet-binding",
        partnerCredential: "selected-by-exact-request",
        mustReviewSignAndBroadcast: true,
      },
      launchHistoryVisibility: {
        root: "all-partner-attributed-root-and-subkey-launches",
        subkey: "stable-subkey-lineage-only",
        rootAggregatesSubkeys: true,
        rotationPreservesLineageHistory: true,
        newDistinctSubkeyStartsIsolatedLineage: true,
        revokedCredentialCanAuthenticate: false,
      },
      secretDelivery: "issue-and-rotation-response-only",
      callerSuppliedAttributionAccepted: false,
      attributionSource: "authenticated-partner-api-key",
      attributionIsVerificationOrSafetyClaim: false,
      walletSigningAuthority: false,
      walletBroadcastAuthority: false,
      gateBypassAuthority: false,
      adminProvisioning: {
        authentication: "website-bff-assertion-v2",
        authorization: "server-configured-privy-user-wallet-pair-allowlist",
        clientMaySelfAuthorize: false,
      },
    });
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
      /exact retained Fee-Enforced V2 historical profile/u,
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
    const finalizedMetadata = spec.paths["/v3/finalized-custom-launches"].get;
    assert.deepEqual(finalizedMetadata.servers, [
      {
        url: "https://api.programmable.market",
        description: "Production Custom Launch API read surface",
      },
    ]);
    assert.equal(
      finalizedMetadata.operationId,
      "listFinalizedCustomLaunchMetadataV3",
    );
    assert.equal(
      finalizedMetadata.responses["200"].content["application/json"].schema.$ref,
      "https://programmable.market/openapi/custom-launch-v3.json#/components/schemas/FinalizedCustomLaunchMetadataListV1",
    );
    assert.match(finalizedMetadata.description, /partnerAttribution/u);
    assert.match(finalizedMetadata.description, /launchedVia/u);
    assert.match(finalizedMetadata.description, /launches\[\]\.partnerAttribution/u);
    assert.match(
      finalizedMetadata.description,
      /finalized-v3-project-metadata-ledger/u,
    );
    assert.match(finalizedMetadata.description, /retained `3\.2\.0`/u);
    assert.match(finalizedMetadata.description, /immutable `launchProfileVersion`/u);
    assert.match(finalizedMetadata.description, /tokenMetadataReadback\.status/u);
    assert.match(finalizedMetadata.description, /cannot guarantee GMGN, Dexscreener/u);
    assert.equal(
      spec.components.schemas.LaunchPartnerAttributionV1.$ref,
      "../schemas/v2/launch-partner-attribution-v1.schema.json",
    );
    assert.match(
      spec.paths["/api/v2/launches"].get.description,
      /server-owned\s+`partnerAttribution`/u,
    );
    assert.match(finalizedMetadata.responses["400"].description, /INVALID_PAGINATION/u);
    assert.match(
      finalizedMetadata.responses["503"].description,
      /CUSTOM_LAUNCH_V3_UNAVAILABLE/u,
    );
    assert.match(
      spec.paths["/api/v2/manifest"].get.description,
      /(all|every) valid Uniswap v4\s+permission mask/u,
    );
    assert.match(
      spec.paths["/api/v2/manifest"].get.description,
      /authenticated executed negative returns\s+`BEHAVIOR_EVIDENCE_NOT_VERIFIED`/u,
    );
    assert.doesNotMatch(source, /GitHub approval to permit/u);
  });

  test("resolves local references and pins the canonical external V3 response", async () => {
    const local = [];
    const relative = [];
    const external = [];
    visit(spec, (value) => {
      if (typeof value.$ref !== "string") return;
      if (value.$ref.startsWith("#/")) local.push(value.$ref);
      else if (value.$ref.startsWith("https://")) external.push(value.$ref);
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
    assert.deepEqual(external, [
      "https://programmable.market/openapi/custom-launch-v3.json#/components/schemas/FinalizedCustomLaunchMetadataListV1",
    ]);
    const statusSchema = await readJson(
      path.join(REPOSITORY_ROOT, "schemas/v2/status.schema.json"),
    );
    assert.equal(
      statusSchema.properties.currentCustomLaunchCreate.$ref,
      "#/$defs/currentCustomLaunchCreate",
    );
    assert.equal(
      statusSchema.required.includes("currentCustomLaunchCreate"),
      false,
    );
    assert.equal(
      statusSchema.$defs.currentCustomLaunchCreate.properties.path.const,
      "/v3/custom-launches",
    );
    assert.equal(
      statusSchema.$defs.customLaunchApi.properties.openApiUrl.const,
      "https://programmable.market/openapi/custom-launch-v1.json",
    );
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
