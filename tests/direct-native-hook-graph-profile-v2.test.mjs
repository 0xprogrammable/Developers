import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";
import { parseDocument } from "yaml";

import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";

const PROFILE_KEY = "directNativeHookGraphProfileV2";

describe("Direct Native Hook Graph Profile V2 historical discovery", () => {
  test("publishes the exact read-only V2 profile while preserving v1", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator(
      "direct-native-hook-graph-profile-discovery-v2.schema.json",
    );
    const profile = manifest[PROFILE_KEY];

    assertValid(validate, profile, PROFILE_KEY);
    assert.equal(
      profile.schemaVersion,
      "programmable.direct-native-hook-graph-profile-discovery.v2",
    );
    assert.equal(profile.profileId, "programmable.direct-native-hook-graph.v1");
    assert.equal(profile.profileRevision, 2);
    assert.equal(profile.profileVersion, "2.0.0");
    assert.equal(profile.publicCategory, "custom");
    assert.equal(profile.status, "read-only");
    assert.equal(profile.productionLaunchAuthorized, false);
    assert.equal(profile.api.apiVersion, "3");
    assert.equal(profile.api.publiclyRoutable, false);
    assert.equal(profile.api.freshSubmissions, false);
    assert.equal(profile.api.exactByteRetriesOnly, true);
    assert.equal(profile.cli.releaseVersion, "3.0.0");
    assert.deepEqual(profile.cli.commands, [
      "pack",
      "validate",
      "submit",
      "status",
    ]);
    assert.equal(profile.cli.maySign, false);
    assert.equal(profile.cli.mayBroadcast, false);

    assert.equal(
      manifest.directNativeHookGraphProfileV1.schemaVersion,
      "programmable.direct-native-hook-graph-profile-discovery.v1",
    );
    assert.equal(
      manifest.directNativeHookGraphProfileV1.productionLaunchAuthorized,
      false,
    );
    assert.deepEqual(Object.keys(manifest.publicCategories).sort(), [
      "classic",
      "custom",
    ]);

    for (const mutate of [
      (candidate) => { candidate.status = "live"; },
      (candidate) => { candidate.productionLaunchAuthorized = true; },
      (candidate) => { candidate.api.publiclyRoutable = true; },
      (candidate) => { candidate.api.freshSubmissions = true; },
      (candidate) => { candidate.cli.commands.push("sign"); },
      (candidate) => { candidate.graphContract.minimumTargets = 2; },
      (candidate) => { candidate.hookPermissions.maximumMask = 8191; },
      (candidate) => { candidate.fundingPolicy.supportedModes.pop(); },
      (candidate) => {
        candidate.platformFeeConformance.activationStatus = "integration-pending";
      },
      (candidate) => {
        candidate.liquidityPolicy.tradingVolumeCreatesConcentratedLiquidity = true;
      },
    ]) {
      const candidate = structuredClone(profile);
      mutate(candidate);
      assert.equal(validate(candidate), false);
    }
  });

  test("keeps the V2 JSON schema free of duplicate keys", async () => {
    const source = await readFile(
      path.join(
        REPOSITORY_ROOT,
        "schemas/v2/direct-native-hook-graph-profile-discovery-v2.schema.json",
      ),
      "utf8",
    );
    const document = parseDocument(source, {
      maxAliasCount: 0,
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    });

    assert.deepEqual(document.errors, [], document.errors.join("\n"));
  });

  test("describes general exact graphs, funding, liquidity and conformance", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const profile = manifest[PROFILE_KEY];

    assert.equal(profile.graphContract.minimumTargets, 3);
    assert.equal(profile.graphContract.maximumTargets, 16);
    assert.equal(profile.ownershipContract.token, "project-owned-exact-artifact");
    assert.equal(profile.ownershipContract.hook, "project-owned-exact-artifact");
    assert.equal(profile.ownershipContract.platformHookSubstitution, false);
    assert.equal(profile.hookPermissions.minimumMask, 0);
    assert.equal(profile.hookPermissions.maximumMask, 16383);
    assert.equal(profile.hookPermissions.supported.length, 14);
    assert.equal(profile.currencyContract.dynamicFeeSentinel, 8388608);
    assert.deepEqual(profile.fundingPolicy.supportedModes, [
      "none",
      "wallet-transaction-value",
      "eip-3009-receive-with-authorization",
    ]);
    assert.equal(
      profile.fundingPolicy.walletTransactionValue.exactPreparedTransactionValueRequired,
      true,
    );
    assert.equal(profile.platformFeeConformance.receiptAuthority, "platform-only");
    assert.equal(profile.platformFeeConformance.receiptDigest, "per-launch");
    assert.deepEqual(Object.keys(profile.liquidityPolicy.models), [
      "external-concentrated-liquidity",
      "launch-seeded-concentrated-liquidity",
      "hook-inventory-custom-accounting",
    ]);
    assert.equal(
      profile.liquidityPolicy.models["external-concentrated-liquidity"].declaredLaunchState,
      "liquidity_required",
    );
    assert.equal(
      profile.liquidityPolicy.models["hook-inventory-custom-accounting"]
        .assessmentMayBeSelfDeclaredPassed,
      false,
    );
    assert.equal(profile.liquidityPolicy.poolInitializationCreatesLiquidity, false);
    assert.equal(
      profile.liquidityPolicy.tradingVolumeCreatesConcentratedLiquidity,
      false,
    );
    assert.equal(
      profile.liquidityPolicy.customAccounting.zeroClassicalLpMayBeValid,
      true,
    );
    assert.equal(profile.feedContract.prelaunchProfileRecordsPublished, false);
    assert.equal(
      profile.feedContract.launchFeedPublication,
      "finalized-canonical-router-launches",
    );
  });

  test("publishes additive schema and documentation without write calldata", async () => {
    const [schemaIndex, guide, status, httpReference, openApi] = await Promise.all([
      readJson(path.join(REPOSITORY_ROOT, "schema-index-v2.json")),
      readFile(
        path.join(
          REPOSITORY_ROOT,
          "docs/guides/direct-native-hook-graph-profile-v2.md",
        ),
        "utf8",
      ),
      readFile(path.join(REPOSITORY_ROOT, "docs/status.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "openapi/programmable-v2.yaml"), "utf8"),
    ]);

    assert.ok(
      schemaIndex.schemas.some(
        ({ name }) =>
          name === "direct-native-hook-graph-profile-discovery-v2",
      ),
    );
    assert.match(status, /guides\/direct-native-hook-graph-profile-v2\.md/u);
    assert.match(status, /Historical reads and exact-byte retries; no fresh requests/u);
    for (const source of [guide, httpReference]) {
      assert.match(source, /3.?16/iu);
      assert.match(source, /wallet transaction value|wallet-transaction-value/iu);
      assert.match(source, /EIP-3009/iu);
      assert.match(source, /conformance receipt/iu);
      assert.match(source, /zero(?:-| )classical(?:-| )LP/iu);
      assert.match(source, /does not (add|create).*liquidity|creates no liquidity/is);
    }
    assert.match(guide, /(all|every) valid Uniswap v4 mask/iu);
    assert.match(guide, /never\s+sign or broadcast/iu);
    assert.match(guide, /finalized consistent\s+canonical-Router/iu);
    assert.match(openApi, /DirectNativeHookGraphProfileDiscoveryV2/iu);
    assert.doesNotMatch(openApi, /^\s{2}\/v3\/custom-launches:/mu);
  });

  test("keeps the V2 descriptor optional for additive v2 compatibility", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const registry = await createSchemaRegistry("v2");
    const validateManifest = registry.validator("manifest.schema.json");
    const olderCompatible = structuredClone(manifest);
    delete olderCompatible.directNativeHookGraphProfileV2;

    assertValid(validateManifest, manifest, "manifest with V2 descriptor");
    assertValid(
      validateManifest,
      olderCompatible,
      "manifest without additive V2 descriptor",
    );
  });
});
