import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";

import { developerManifestV2, serviceStatusV2 } from "../server/v2-dataset.js";
import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";

const PROFILE_KEY = "directNativeHookGraphProfileV3";

function sourceStatus() {
  return {
    schemaVersion: "1.0.0",
    status: "ready",
    generatedAt: "2026-08-26T04:42:49Z",
    chainId: 1,
    source: {},
    chain: {},
    coverage: {
      status: "complete",
      checkpoint: {
        blockNumber: 25717612,
        blockHash: `0x${"e".repeat(64)}`,
        finality: "confirmed",
      },
    },
    counts: { total: 0, classic: 0, custom: 0 },
    errors: [],
  };
}

describe("Direct Native Hook Graph Profile V3 discovery", () => {
  test("publishes the active general lane without changing Revision 2", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator(
      "direct-native-hook-graph-profile-discovery-v3.schema.json",
    );
    const profile = manifest[PROFILE_KEY];

    assertValid(validate, profile, PROFILE_KEY);
    assert.equal(
      profile.schemaVersion,
      "programmable.direct-native-hook-graph-profile-discovery.v3",
    );
    assert.equal(
      profile.profileSchemaVersion,
      "programmable.direct-native-hook-graph-profile.v3",
    );
    assert.equal(
      profile.profileSelectionBindingSchemaVersion,
      "programmable.direct-native-hook-graph-profile-selection-binding.v3",
    );
    assert.equal(profile.profileId, "programmable.direct-native-hook-graph.v1");
    assert.equal(profile.profileRevision, 3);
    assert.equal(profile.profileVersion, "3.0.0");
    assert.equal(profile.publicCategory, "custom");
    assert.equal(profile.status, "live");
    assert.equal(profile.productionLaunchAuthorized, true);
    assert.equal(profile.platformFeePolicy.rateDenominator, "1000000");
    assert.equal(
      profile.platformFeePolicy.programmableFeeHundredthsOfBip,
      "1000",
    );
    assert.deepEqual(
      Object.keys(profile.platformFeePolicy.accountingModes).sort(),
      ["additive-platform-share", "inclusive-selected-total"],
    );
    assert.equal(profile.platformFeePolicy.admissionCertifiesFeeBehavior, false);

    assert.equal(manifest.directNativeHookGraphProfileV2.profileRevision, 2);
    assert.equal(manifest.directNativeHookGraphProfileV2.profileVersion, "2.0.0");
    assert.deepEqual(Object.keys(manifest.publicCategories).sort(), [
      "classic",
      "custom",
    ]);
  });

  test("binds blocking findings, warnings and mandatory Router simulation", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const profile = manifest[PROFILE_KEY];
    const policy = profile.platformAdmissionPolicy;

    assert.deepEqual(policy, {
      schemaVersion: "programmable.direct-native-platform-admission-policy.v1",
      mode: "deterministic-exact-source-graph-static-baseline-v1",
      receiptSchemaVersion: "programmable.platform-admission-receipt.v1",
      engineId: "programmable.direct-native-static-admission",
      engineVersion: "1.0.0",
      exactSourceCompilerGraphBindingRequired: true,
      staticBaselineGateVersion: "1.0.0",
      blockingFindingRules: [
        { code: "SOURCE_TARGET_ANALYSIS_INCOMPLETE", targetRoles: ["any"] },
        { code: "V4_CALLBACK_AUTHENTICATION_REVIEW_REQUIRED", targetRoles: ["hook"] },
        { code: "V4_ENABLED_CALLBACK_IMPLEMENTATION_MISSING", targetRoles: ["hook"] },
        { code: "SOURCE_MUTABLE_BLOCKLIST_SURFACE", targetRoles: ["token"] },
        { code: "SOURCE_MUTABLE_TRANSFER_RESTRICTION", targetRoles: ["token"] },
        { code: "SOURCE_PUBLIC_MINT_SURFACE", targetRoles: ["token"] },
        { code: "SOURCE_MUTABLE_PAUSE_SURFACE", targetRoles: ["token"] },
        { code: "SOURCE_MUTABLE_TAX_OR_FEE_SURFACE", targetRoles: ["token"] },
        { code: "SOURCE_PROXY_OR_UPGRADE_SURFACE", targetRoles: ["token", "hook"] },
        { code: "SOURCE_SELFDESTRUCT_SURFACE", targetRoles: ["token", "hook"] },
        { code: "RUNTIME_CALLCODE", targetRoles: ["token", "hook"] },
        { code: "RUNTIME_DELEGATECALL", targetRoles: ["token", "hook"] },
        { code: "RUNTIME_SELFDESTRUCT", targetRoles: ["token", "hook"] },
      ],
      warningDisposition: "bound-and-visible",
      noBlockingFindingDisposition: "router-simulation-eligible",
      blockingFindingDisposition: "action-required",
      routerSimulationRequiredBeforeAuthorization: true,
      receiptAuthority: "platform-only",
      assurance: "launch-admission-only",
      safetyClaim: false,
      feeBehaviorClaim: false,
    });
    assert.equal(
      profile.staticBaselineDisclosure.receiptEvidenceDisposition,
      "no_blocking_static_finding",
    );
    assert.equal(
      profile.staticBaselineDisclosure.receiptVerdict,
      "admitted_to_router_simulation",
    );
    assert.equal(
      profile.staticBaselineDisclosure.blockingFindingsResourceStatus,
      "action_required",
    );
    assert.equal(profile.staticBaselineDisclosure.allWarningFindingsBound, true);
    assert.equal(profile.staticBaselineDisclosure.unmatchedFindingsBecomeWarnings, true);
    assert.equal(profile.staticBaselineDisclosure.projectSpecificExceptions, false);
    assert.deepEqual(profile.assuranceBoundary, {
      launchAdmissionOnly: true,
      auditClaim: false,
      safetyClaim: false,
      honeypotFreeClaim: false,
      liquidityClaim: false,
      tradeabilityClaim: false,
      feeBehaviorClaim: false,
      routerSimulationIsNotProductionOutcomeEvidence: true,
    });
  });

  test("publishes the live API and evidence-bound CLI locator", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const profile = manifest[PROFILE_KEY];

    assert.equal(profile.api.apiVersion, "3");
    assert.equal(profile.api.publiclyRoutable, true);
    assert.deepEqual(profile.api.agentIntegration, {
      remediationCatalogSchemaVersion:
        "programmable.custom-launch-agent-remediation-catalog.v1",
      remediationCatalogUrl:
        "https://programmable.market/policies/custom-launch-agent-remediation-v1.json",
      existingProjectGuideUrl:
        "https://programmable.market/docs/developers/custom-launch#existing-project-integration",
      packConfigSchemaUrl:
        "https://programmable.market/schemas/custom-launch/v3/pack-config.json",
    });
    assert.deepEqual(profile.cli.fundingAuthorizationPatch, {
      schemaVersion: "programmable.eip3009-authorization-patch.v2",
      authorizationEncoding: "eip3009-nonce-r-s-v-abi-leaves",
      requiredFields: [
        "schemaVersion",
        "targetId",
        "unsignedInitializerCalldataSha256",
        "initializerCalldataLengthBytes",
        "authorizationEncoding",
        "nonceArgumentPath",
        "rArgumentPath",
        "sArgumentPath",
        "vArgumentPath",
      ],
      requiredArgumentPaths: [
        "nonceArgumentPath",
        "rArgumentPath",
        "sArgumentPath",
        "vArgumentPath",
      ],
      argumentPathSemantics: "zero-based-static-abi-paths",
      argumentPathMaximumDepth: 16,
      argumentPathIndexMinimum: 0,
      argumentPathIndexMaximum: 255,
      legacyReplaySchemaVersion: "programmable.eip3009-signature-patch.v1",
    });
    assert.equal(profile.cli.releaseVersion, "3.2.0");
    assert.equal(profile.cli.releaseLocatorStatus, "pending-publication");
    assert.equal(profile.cli.supportStatus, "live");
    assert.equal(
      profile.cli.releaseUrl,
      "https://github.com/0xprogrammable/PROGRAMMABLE/releases/tag/programmable-launch-v3.2.0",
    );
    assert.equal(
      profile.cli.tarballUrl,
      "https://github.com/0xprogrammable/PROGRAMMABLE/releases/download/programmable-launch-v3.2.0/programmable-launch-3.2.0.tgz",
    );
    assert.equal(
      profile.cli.checksumUrl,
      "https://github.com/0xprogrammable/PROGRAMMABLE/releases/download/programmable-launch-v3.2.0/programmable-launch-3.2.0.tgz.sha256",
    );
    assert.equal(
      profile.cli.tarballSha256,
      null,
    );
    assert.deepEqual(profile.cli.commands, [
      "pack",
      "validate",
      "submit",
      "status",
    ]);
    assert.equal(profile.cli.maySign, false);
    assert.equal(profile.cli.mayBroadcast, false);
  });

  test("projects the additive descriptor through manifest and status", async () => {
    const manifest = await developerManifestV2();
    const status = serviceStatusV2(sourceStatus(), manifest);
    const registry = await createSchemaRegistry("v2");

    assert.deepEqual(status[PROFILE_KEY], manifest[PROFILE_KEY]);
    assertValid(
      registry.validator("manifest.schema.json"),
      manifest,
      "manifest with Revision 3",
    );
    assertValid(
      registry.validator("status.schema.json"),
      status,
      "status with Revision 3",
    );

    const compatible = structuredClone(manifest);
    delete compatible[PROFILE_KEY];
    assertValid(
      registry.validator("manifest.schema.json"),
      compatible,
      "older compatible manifest without Revision 3",
    );
  });

  test("documents the assurance and feature boundaries", async () => {
    const [guide, readme, llms, llmsFull, wellKnown, schemaIndex] =
      await Promise.all([
        readFile(
          path.join(
            REPOSITORY_ROOT,
            "docs/guides/direct-native-hook-graph-profile-v3.md",
          ),
          "utf8",
        ),
        readFile(path.join(REPOSITORY_ROOT, "README.md"), "utf8"),
        readFile(path.join(REPOSITORY_ROOT, "llms.txt"), "utf8"),
        readFile(path.join(REPOSITORY_ROOT, "llms-full.txt"), "utf8"),
        readJson(
          path.join(REPOSITORY_ROOT, "public/.well-known/programmable.json"),
        ),
        readJson(path.join(REPOSITORY_ROOT, "schema-index-v2.json")),
      ]);
    const extension =
      wellKnown.extensions["programmable.direct-native-hook-graph-profile-v3"];
    const customLaunchApi =
      wellKnown.extensions["programmable.custom-launch-api"];

    assert.equal(extension.profileRevision, 3);
    assert.equal(extension.profileVersion, "3.0.0");
    assert.deepEqual(
      extension.cli,
      (await developerManifestV2())[PROFILE_KEY].cli,
    );
    assert.deepEqual(extension.platformAdmissionPolicy,
      (await developerManifestV2())[PROFILE_KEY].platformAdmissionPolicy);
    assert.deepEqual(
      extension.platformFeePolicy,
      (await developerManifestV2())[PROFILE_KEY].platformFeePolicy,
    );
    assert.deepEqual(
      extension.api.agentIntegration,
      (await developerManifestV2())[PROFILE_KEY].api.agentIntegration,
    );
    assert.deepEqual(
      customLaunchApi.agentIntegration,
      (await developerManifestV2())[PROFILE_KEY].api.agentIntegration,
    );
    assert.equal(
      (await developerManifestV2()).platformFee.customPublicSubmissions.scope,
      "legacy-fee-enforced-isolated-after-swap-profile-only",
    );
    assert.equal(
      (await developerManifestV2()).platformFee.customPublicSubmissions.profileId,
      "programmable.fee-enforced-isolated-after-swap.zero-delta.v1",
    );
    assert.match(guide, /not a security audit/iu);
    assert.match(guide, /honeypot-free guarantee/iu);
    assert.match(guide, /liquidity or tradeability/iu);
    assert.match(guide, /feeBehaviorClaim: false|`feeBehaviorClaim: false`|`feeBehaviorClaim`/u);
    assert.match(guide, /generic fee claiming/iu);
    assert.match(guide, /generic buyback/iu);
    assert.match(guide, /Legacy Registry and\s+GitHub submission intake are closed/iu);
    assert.match(guide, /custom-launch-agent-remediation-v1\.json/u);
    assert.match(guide, /schemas\/custom-launch\/v3\/pack-config\.json/u);
    assert.match(guide, /programmable\.eip3009-authorization-patch\.v2/u);
    assert.match(guide, /nonceArgumentPath/u);
    assert.match(guide, /rArgumentPath/u);
    assert.match(guide, /sArgumentPath/u);
    assert.match(guide, /vArgumentPath/u);
    assert.match(guide, /`action_required`\s+is not a manual approval queue/iu);
    assert.match(llms, /custom-launch-agent-remediation-v1\.json/u);
    assert.match(llms, /programmable\.eip3009-authorization-patch\.v2/u);
    assert.match(llmsFull, /not a manual approval queue/iu);
    assert.match(guide, /releaseLocatorStatus: pending-publication/iu);
    assert.match(guide, /supportStatus: live/iu);
    assert.match(guide, /CLI `3\.1\.0` remains\s+the compatible published predecessor/iu);
    assert.match(guide, /Do not install that locator until discovery reports `published`/iu);
    assert.match(guide, /additive-platform-share/iu);
    assert.match(guide, /inclusive-selected-total/iu);
    assert.match(
      readme,
      /\[V3 profile guide\]\(docs\/guides\/direct-native-hook-graph-profile-v3\.md\)/u,
    );
    assert.match(llms, /launch-admission-only/iu);
    assert.match(llms, /no claimed checksum/iu);
    assert.match(llmsFull, /claims no tarball checksum/iu);
    assert.ok(
      schemaIndex.schemas.some(
        ({ name }) =>
          name === "direct-native-hook-graph-profile-discovery-v3",
      ),
    );
  });
});
