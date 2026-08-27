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

const STANDARD_BEHAVIOR_VECTORS = [
  ["swap.zero-for-one.exact-input.multi-size", "swap", ["routability"]],
  ["swap.zero-for-one.exact-output.multi-size", "swap", ["routability"]],
  ["swap.one-for-zero.exact-input.multi-size", "swap", ["routability"]],
  ["swap.one-for-zero.exact-output.multi-size", "swap", ["routability"]],
  ["swap.second-user", "swap", ["routability"]],
  ["swap.time-advance", "swap", ["routability"]],
  ["liquidity.lifecycle.add-remove-withdraw", "liquidity", ["routability"]],
  ["callback.unauthorized-rejected", "callback-authentication", [
    "deployability-hard-invariant",
    "routability",
  ]],
  ["fee.programmable-ten-bps", "platform-fee", [
    "deployability-hard-invariant",
    "platform-fee-conformance",
    "routability",
  ]],
  ["fee.no-bypass", "platform-fee", [
    "deployability-hard-invariant",
    "platform-fee-conformance",
    "routability",
  ]],
  ["fee.no-overcharge", "platform-fee", [
    "deployability-hard-invariant",
    "platform-fee-conformance",
    "routability",
  ]],
  ["fee.claim-isolation", "platform-fee", [
    "deployability-hard-invariant",
    "platform-fee-conformance",
    "routability",
  ]],
];

function preflightResponse() {
  const requiredVectors = STANDARD_BEHAVIOR_VECTORS.map(
    ([vectorId, category, claimAxes]) => ({
      vectorId,
      category,
      requirement: "required",
      claimAxes,
    }),
  );
  const vectorIds = requiredVectors.map(({ vectorId }) => vectorId);
  const hardInvariantIds = requiredVectors
    .filter(({ claimAxes }) => claimAxes.includes("deployability-hard-invariant"))
    .map(({ vectorId }) => vectorId);
  const feeIds = requiredVectors
    .filter(({ claimAxes }) => claimAxes.includes("platform-fee-conformance"))
    .map(({ vectorId }) => vectorId);
  const digest = (character) => `sha256:${character.repeat(64)}`;
  return {
    schemaVersion: "programmable.custom-launch-preflight.v1",
    requestHash: digest("1"),
    profileRevision: 3,
    serverTime: "2026-08-26T12:34:56.000Z",
    disposition: "needs_evidence",
    launchEligibility: {
      deployable: true,
      routable: false,
      featured: false,
    },
    evidenceTier: "standard_swap_compatible",
    riskClassification: {
      schemaVersion: "programmable.platform-admission-risk-classification.v3",
      classifierVersion: "1.0.0",
      evidenceAuthority: "deterministic-static-classification",
      disposition: "needs_evidence",
      launchEligibility: {
        deployable: true,
        routable: false,
        featured: false,
        basis: "static-admission-only",
      },
      evidenceTier: "standard_swap_compatible",
      evidenceTierStatus: "required",
      hardBlockFindingCodes: [],
      needsEvidenceFindingCodes: [],
      requiredEvidence: [
        "callback.pool-manager-authentication",
        "launch.router-simulation",
        "liquidity.declared-lifecycle-and-withdrawal",
        "platform-fee.ten-bps-no-bypass-no-overcharge-claim-isolation",
        "swap.four-quadrant-multi-size",
        "swap.second-user-and-time",
      ],
      behaviorEvidenceStatus: "not_executed",
      approvalAuthority: false,
      safetyClaim: false,
      feeBehaviorClaim: false,
      limitations: ["Static admission does not prove runtime behavior."],
    },
    behaviorEvidence: {
      schemaVersion: "programmable.custom-launch-behavior-summary.v1",
      subjectSha256: digest("2"),
      requirements: {
        schemaVersion: "programmable.custom-launch-behavior-requirements.v1",
        vectorSetVersion: "1.0.0",
        riskClass: "standard-swaps",
        hookPermissionMask: 192,
        liquidityModel: "external-concentrated-liquidity",
        vectors: requiredVectors,
        requirementsSha256: digest("3"),
      },
      status: "not_executed",
      execution: null,
      vectors: requiredVectors.map(({ vectorId, category, claimAxes }) => ({
        vectorId,
        category,
        claimAxes,
        status: "not_executed",
        evidenceSha256: null,
        reasonCode: "BEHAVIOR_RUNNER_NOT_CONFIGURED",
      })),
      outstandingVectorIds: vectorIds,
      claimAxes: {
        deployability: {
          status: "behavior-hard-invariants-required",
          scope: "behavior-only",
          requiredVectorIds: hardInvariantIds,
          outstandingVectorIds: hardInvariantIds,
        },
        platformFeeConformance: {
          status: "not_verified",
          requiredVectorIds: feeIds,
          outstandingVectorIds: feeIds,
        },
        routability: {
          status: "not_verified",
          requiredVectorIds: vectorIds,
          outstandingVectorIds: vectorIds,
        },
        featured: {
          status: "external-evidence-required",
          derivedFromBehaviorEvidence: false,
        },
        finality: {
          status: "independent-evidence-required",
          derivedFromBehaviorEvidence: false,
        },
      },
    },
    productTruthAxes: {
      deployment: {
        status: "eligible",
        basis: "static-admission-only",
        transactionExecuted: false,
      },
      trading: {
        status: "not_verified",
        basis: "runtime-behavior-evidence-required",
      },
      platform_fee_evidence: {
        status: "not_verified",
        basis: "exact-fee-behavior-evidence-required",
      },
      source_verification: {
        status: "not_verified",
        basis: "provider-exact-match-required",
      },
      indexing: {
        status: "not_indexed",
        basis: "finalized-router-identity-required",
      },
      featured: {
        status: "not_featured",
        basis: "separate-product-evidence-required",
      },
    },
    hardBlockFindingCodes: [],
    needsEvidenceFindingCodes: [],
    warningFindingCodes: [],
    staticBaseline: {
      schemaVersion: "programmable.custom-launch-static-baseline-gate.v1",
      disposition: "no_static_finding",
    },
    remediations: [],
    quotaConsumed: false,
    nonceAllocated: false,
    persisted: false,
    walletSignatureRequiredLater: true,
    walletBroadcastByService: false,
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
    assert.equal(profile.profileVersion, "3.3.0");
    assert.equal(
      profile.compatibility.profileVersion3_0_0,
      "retained-exact-read-and-retry",
    );
    assert.equal(
      profile.compatibility.profileVersion3_1_0,
      "retained-exact-read-and-retry",
    );
    assert.equal(
      profile.compatibility.profileVersion3_2_0,
      "retained-exact-read-and-retry",
    );
    assert.equal(profile.compatibility.profileVersion3_3_0, "active-for-new-packs");
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
    assert.deepEqual(profile.generalLane.projectOwnedRoles, ["token", "hook"]);
    assert.deepEqual(profile.generalLane.supportedHookPermissions, [
      "beforeInitialize",
      "afterInitialize",
      "beforeAddLiquidity",
      "afterAddLiquidity",
      "beforeRemoveLiquidity",
      "afterRemoveLiquidity",
      "beforeSwap",
      "afterSwap",
      "beforeDonate",
      "afterDonate",
      "beforeSwapReturnDelta",
      "afterSwapReturnDelta",
      "afterAddLiquidityReturnDelta",
      "afterRemoveLiquidityReturnDelta",
    ]);
    assert.deepEqual(profile.generalLane.quoteCurrencyKinds, ["native", "erc20"]);
    assert.deepEqual(profile.generalLane.fundingModes, [
      "none",
      "wallet-transaction-value",
      "eip-3009-receive-with-authorization",
    ]);
    assert.deepEqual(profile.generalLane.liquidityModels, [
      "external-concentrated-liquidity",
      "launch-seeded-concentrated-liquidity",
      "hook-inventory-custom-accounting",
    ]);
    assert.equal(profile.generalLane.structuralSupportIsUniversalCompatibility, false);

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
        { code: "RUNTIME_CALLCODE", targetRoles: ["any"] },
        { code: "RUNTIME_SELFDESTRUCT", targetRoles: ["any"] },
        { code: "SOURCE_SELFDESTRUCT_SURFACE", targetRoles: ["any"] },
        { code: "V4_CALLBACK_AUTHENTICATION_MISSING", targetRoles: ["hook"] },
        { code: "V4_CALLBACK_AUTHENTICATION_INVALID", targetRoles: ["hook"] },
        { code: "V4_CALLBACK_POOL_MANAGER_MISMATCH", targetRoles: ["hook"] },
        { code: "V4_ENABLED_CALLBACK_IMPLEMENTATION_MISSING", targetRoles: ["hook"] },
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
    assert.equal(policy.blockingFindingRules.length, 7);
    for (const evidenceOnly of [
      "RUNTIME_DELEGATECALL",
      "SOURCE_PROXY_OR_UPGRADE_SURFACE",
      "SOURCE_PUBLIC_MINT_SURFACE",
      "SOURCE_MUTABLE_TAX_OR_FEE_SURFACE",
      "SOURCE_MUTABLE_PAUSE_SURFACE",
      "SOURCE_LIQUIDITY_LOCK_OR_CUSTODY_SURFACE",
    ]) {
      assert.ok(
        profile.evidenceClassification.needsEvidenceFindingCodes.includes(
          evidenceOnly,
        ),
        evidenceOnly,
      );
    }
    assert.deepEqual(
      profile.evidenceClassification.advancedBehaviorEvidenceFeatures,
      [
        "beforeSwapReturnDelta",
        "afterSwapReturnDelta",
        "afterAddLiquidityReturnDelta",
        "afterRemoveLiquidityReturnDelta",
        "hook-inventory-custom-accounting",
      ],
    );
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
    assert.equal(
      profile.api.openApiUrl,
      "https://programmable.market/openapi/custom-launch-v3.json",
    );
    assert.deepEqual(profile.api.selfServe, {
      capabilities: {
        method: "GET",
        path: "/v3/capabilities",
        authentication: "none",
        projectMetadata: {
          schemaVersion: "programmable.project-metadata.v1",
          inputSchemaVersion: "programmable.project-metadata-input.v1",
          requiredForProfileVersion: "3.3.0",
          legacyWithoutMetadataProfileVersions: ["2.0.0", "3.0.0", "3.1.0"],
          legacyMetadataProfileVersions: ["3.2.0"],
          requiredFields: [
            "token.name",
            "token.symbol",
            "presentation.description",
            "presentation.image",
            "presentation.links",
          ],
          imageMayBeNull: false,
          descriptionMustBeMeaningful: true,
          requiredLinkKinds: ["website", "x"],
          maximumLinks: 32,
          linkKinds: [
            "website",
            "documentation",
            "x",
            "telegram",
            "discord",
            "github",
            "other",
          ],
          projectMetadataHashDomain: "programmable.project-metadata.v1",
          graphBundleHashBindingDomain:
            "programmable.custom-graph-project-metadata.v1",
          postDeploymentTokenReadbackRequired: true,
        },
      },
      preflight: {
        method: "POST",
        path: "/v3/custom-launches/preflight",
        authentication: "bearer-api-key",
        launchQuota: "not-consumed",
        responseSchemaVersion: "programmable.custom-launch-preflight.v1",
        responseSchemaUrl:
          "https://developers.programmable.family/schemas/v2/custom-launch-preflight-v1.schema.json",
        requestId: "x-request-id-header",
        retryAfter: "honor-on-429-or-503",
        sideEffects: {
          quotaConsumed: false,
          nonceAllocated: false,
          persisted: false,
          walletSignatureRequiredLater: true,
          walletBroadcastByService: false,
        },
      },
      finalizedMetadata: {
        method: "GET",
        path: "/v3/finalized-custom-launches",
        authentication: "none",
        responseSchemaVersion:
          "programmable.finalized-custom-launch-metadata-list.v1",
        openApiOperationId: "listFinalizedCustomLaunchMetadataV3",
        pagination: "opaque-cursor",
        minimumLimit: 1,
        maximumLimit: 25,
        defaultLimit: 10,
        finalityScope: "finalized-profile-3.3.0-only",
        cacheControl: "public, max-age=15, stale-while-revalidate=300",
        sourceLkg: "none",
      },
      lifecycleQueue: {
        resourceField: "lifecycleQueue",
        schemaVersion: "programmable.custom-launch-lifecycle-queue.v3",
        schemaUrl:
          "https://developers.programmable.family/schemas/v2/custom-launch-lifecycle-queue-v3.schema.json",
        canonicalPollingPath: "/v3/custom-launches/{launchId}",
        queueStateIsLaunchFinality: false,
      },
      walletHandoff: {
        availableAfter: "authorized",
        urlAndExpiryPublished: true,
        walletSignatureRequired: true,
        walletBroadcastByService: false,
      },
    });
    assert.deepEqual(profile.api.partnerCredentials, {
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
      secretDelivery: "issue-and-rotation-response-only",
      callerSuppliedAttributionAccepted: false,
      attributionSource: "authenticated-partner-api-key",
      attributionIsVerificationOrSafetyClaim: false,
      walletSigningAuthority: false,
      walletBroadcastAuthority: false,
      gateBypassAuthority: false,
    });
    assert.deepEqual(profile.api.agentIntegration, {
      remediationCatalogSchemaVersion:
        "programmable.custom-launch-agent-remediation-catalog.v1",
      remediationCatalogUrl:
        "https://programmable.market/policies/custom-launch-agent-remediation-v1.json",
      existingProjectGuideUrl:
        "https://programmable.market/docs/developers/custom-launch#existing-project-integration",
      packConfigSchemaUrl:
        "https://programmable.market/schemas/custom-launch/v3/pack-config.json",
      packConfigSchemaSha256:
        "sha256:40ec776b04f9a4cd4f0fc50b977c2b9954d25205133251bb1c9d2e7a400dc074",
      finalizedMetadataUrl:
        "https://api.programmable.market/v3/finalized-custom-launches",
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
    assert.equal(profile.cli.releaseVersion, "3.3.6");
    assert.equal(profile.cli.releaseLocatorStatus, "published");
    assert.equal(profile.cli.supportStatus, "live");
    assert.equal(profile.cli.minimumSupportingVersion, "3.3.6");
    assert.equal(
      profile.cli.releaseUrl,
      "https://github.com/0xprogrammable/PROGRAMMABLE/releases/tag/programmable-launch-v3.3.6",
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

  test("publishes a strict quota-free preflight response schema", async () => {
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator("custom-launch-preflight-v1.schema.json");
    const response = preflightResponse();

    for (const disposition of [
      "supported",
      "supported_with_warnings",
      "needs_evidence",
      "unsupported",
    ]) {
      assertValid(
        validate,
        { ...response, disposition },
        `V3 preflight disposition ${disposition}`,
      );
    }
    for (const evidenceTier of [
      "launch_mechanics_verified",
      "standard_swap_compatible",
      "advanced_custom_accounting",
      "governed_external_trust",
    ]) {
      assertValid(
        validate,
        { ...response, evidenceTier },
        `V3 preflight evidence tier ${evidenceTier}`,
      );
    }

    assert.equal(validate({ ...response, quotaConsumed: true }), false);
    assert.equal(validate({ ...response, nonceAllocated: true }), false);
    assert.equal(validate({ ...response, persisted: true }), false);
    assert.equal(validate({ ...response, walletSignatureRequiredLater: false }), false);
    assert.equal(validate({ ...response, walletBroadcastByService: true }), false);
    assert.equal(validate({ ...response, evidenceTier: "unverified" }), false);
    assert.equal(validate({ ...response, disposition: "approved" }), false);
    assert.equal(validate({ ...response, requestHash: "1".repeat(64) }), false);
    assert.equal(validate({ ...response, requestId: "not-in-response-body" }), false);
    assert.equal(validate({
      ...response,
      productTruthAxes: {
        ...response.productTruthAxes,
        trading: { status: "verified", basis: "client-declared" },
      },
    }), false);
    assert.equal(validate({
      ...response,
      behaviorEvidence: {
        ...response.behaviorEvidence,
        vectors: response.behaviorEvidence.vectors.map((vector, index) => (
          index === 0 ? { ...vector, status: "verified" } : vector
        )),
      },
    }), false);
  });

  test("publishes the bounded authenticated lifecycle queue without changing feeds", async () => {
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator(
      "custom-launch-lifecycle-queue-v3.schema.json",
    );
    const queue = {
      schemaVersion: "programmable.custom-launch-lifecycle-queue.v3",
      state: "queued",
      reason: "request-created",
      generation: 1,
      attemptCount: 0,
      pollAfterSeconds: 1,
      nextAttemptAt: "2026-08-26T12:35:00.000Z",
      leaseExpiresAt: null,
      workExpiresAt: "2026-08-26T13:35:00.000Z",
      lastErrorCode: null,
      updatedAt: "2026-08-26T12:34:56.000Z",
      polling: {
        method: "GET",
        path: "/v3/custom-launches/123e4567-e89b-12d3-a456-426614174000",
      },
    };
    assertValid(validate, queue, "queued lifecycle projection");
    assert.equal(validate({ ...queue, pollAfterSeconds: 0 }), false);
    assert.equal(validate({
      ...queue,
      state: "completed",
      nextAttemptAt: null,
    }), false);

    const [launchSchema, tokenListSchema] = await Promise.all([
      readFile(path.join(REPOSITORY_ROOT, "schemas/v2/launch.schema.json"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "schemas/v2/token-list.schema.json"), "utf8"),
    ]);
    assert.doesNotMatch(launchSchema, /lifecycleQueue/u);
    assert.doesNotMatch(tokenListSchema, /lifecycleQueue/u);
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
    const [guide, readme, llms, llmsFull, changelog, wellKnown, schemaIndex, readOpenApi] =
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
        readFile(path.join(REPOSITORY_ROOT, "CHANGELOG.md"), "utf8"),
        readJson(
          path.join(REPOSITORY_ROOT, "public/.well-known/programmable.json"),
        ),
        readJson(path.join(REPOSITORY_ROOT, "schema-index-v2.json")),
        readFile(
          path.join(REPOSITORY_ROOT, "openapi/programmable-v2.yaml"),
          "utf8",
        ),
      ]);
    const extension =
      wellKnown.extensions["programmable.direct-native-hook-graph-profile-v3"];
    const customLaunchApi =
      wellKnown.extensions["programmable.custom-launch-api"];

    assert.equal(extension.profileRevision, 3);
    assert.equal(extension.profileVersion, "3.3.0");
    assert.deepEqual(extension.compatibleProfileVersions, ["3.2.0", "3.1.0", "3.0.0", "2.0.0"]);
    assert.deepEqual(
      extension.cli,
      (await developerManifestV2())[PROFILE_KEY].cli,
    );
    assert.deepEqual(
      extension.platformAdmissionPolicy,
      (await developerManifestV2())[PROFILE_KEY].platformAdmissionPolicy,
    );
    assert.deepEqual(
      extension.evidenceClassification,
      (await developerManifestV2())[PROFILE_KEY].evidenceClassification,
    );
    assert.deepEqual(
      extension.platformFeePolicy,
      (await developerManifestV2())[PROFILE_KEY].platformFeePolicy,
    );
    assert.deepEqual(
      extension.api.agentIntegration,
      (await developerManifestV2())[PROFILE_KEY].api.agentIntegration,
    );
    assert.deepEqual(
      extension.api.selfServe,
      (await developerManifestV2())[PROFILE_KEY].api.selfServe,
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
    assert.match(guide, /Policy authority and resource lifecycle/u);
    assert.match(guide, /exact versioned Programmable Launch Policy commit or release/iu);
    assert.match(guide, /server-side preflight, exact-request admission/iu);
    assert.match(guide, /`authorized` means an exact wallet handoff is available/iu);
    assert.match(guide, /`submitted` is not finality/iu);
    assert.match(guide, /`finalized`,\s+`failed`, and `cancelled` are terminal/iu);
    assert.match(guide, /`lifecycleQueue\.state` is worker progress/iu);
    assert.match(guide, /custom-launch-agent-remediation-v1\.json/u);
    assert.match(guide, /schemas\/custom-launch\/v3\/pack-config\.json/u);
    assert.match(
      guide,
      /packConfigSchemaSha256[^\n]+sha256:40ec776b04f9a4cd4f0fc50b977c2b9954d25205133251bb1c9d2e7a400dc074/u,
    );
    assert.match(guide, /api\.openApiUrl.*canonical absolute contract locator/iu);
    assert.match(guide, /programmable\.eip3009-authorization-patch\.v2/u);
    assert.match(guide, /nonceArgumentPath/u);
    assert.match(guide, /rArgumentPath/u);
    assert.match(guide, /sArgumentPath/u);
    assert.match(guide, /vArgumentPath/u);
    assert.match(guide, /`action_required`\s+is not a manual approval queue/iu);
    assert.match(guide, /GET \/v3\/capabilities/u);
    assert.match(guide, /POST \/v3\/custom-launches\/preflight/u);
    assert.match(guide, /quotaConsumed: false/u);
    assert.match(guide, /hardBlockFindingCodes/u);
    assert.match(guide, /needsEvidenceFindingCodes/u);
    assert.match(guide, /warningFindingCodes/u);
    assert.match(guide, /exactly seven objective static hard blocks/iu);
    assert.match(guide, /return\s+delta permissions/iu);
    assert.match(guide, /X-Request-Id/u);
    assert.match(guide, /programmable\.custom-launch-lifecycle-queue\.v3/u);
    assert.match(guide, /not added to the Developer launch or token-list feeds/iu);
    assert.match(guide, /wallet-handoff URL with an explicit expiry/iu);
    assert.match(guide, /programmable\.project-metadata\.v1/u);
    assert.match(guide, /programmable\.launch-presentation-draft\.v1/u);
    assert.match(guide, /projectMetadataHash/u);
    assert.match(guide, /unboundGraphBundleHash/u);
    assert.match(guide, /programmable\.custom-graph-project-metadata\.v1/u);
    assert.match(guide, /programmable\.project-token-metadata-binding\.v1/u);
    assert.match(guide, /postDeploymentReadback/u);
    assert.match(guide, /\{kind, uri\}/u);
    assert.match(guide, /`website`, `documentation`, `x`, `telegram`, `discord`/u);
    assert.match(guide, /GET|curl[\s\S]+\/v3\/finalized-custom-launches/iu);
    assert.match(guide, /programmable\.finalized-custom-launch-metadata-list\.v1/u);
    assert.match(guide, /resourceId` is a pagination\/resource coordinate, not\s+Router identity/iu);
    assert.match(readme, /metadata-bound\s+`graphBundleHash`/iu);
    assert.match(llms, /images and links remain untrusted display data/iu);
    assert.match(llmsFull, /meaningful description, a non-null image with immutable byte digest and media facts/iu);
    assert.match(readOpenApi, /programmable\.project-metadata\.v1/u);
    assert.match(readOpenApi, /post-deployment readback/iu);
    assert.match(readOpenApi, /operationId: listFinalizedCustomLaunchMetadataV3/u);
    assert.match(
      readOpenApi,
      /FinalizedCustomLaunchMetadataListV1/u,
    );
    assert.match(readme, /programmable\.custom-launch-preflight\.v1/u);
    assert.match(llms, /quota-free `POST \/v3\/custom-launches\/preflight`/u);
    assert.match(llmsFull, /all 14 Uniswap v4 permissions/iu);
    assert.match(llms, /custom-launch-agent-remediation-v1\.json/u);
    assert.match(llms, /programmable\.eip3009-authorization-patch\.v2/u);
    assert.match(llmsFull, /not a manual approval queue/iu);
    assert.match(guide, /releaseLocatorStatus: published/iu);
    assert.match(guide, /supportStatus: live/iu);
    assert.match(guide, /public CLI contract version `3\.3\.6`/iu);
    assert.match(guide, /additive-platform-share/iu);
    assert.match(guide, /inclusive-selected-total/iu);
    assert.match(
      readme,
      /\[V3 profile guide\]\(docs\/guides\/direct-native-hook-graph-profile-v3\.md\)/u,
    );
    assert.match(llms, /launch-admission-only/iu);
    assert.match(llms, /CLI `3\.3\.6`/u);
    assert.match(llmsFull, /CLI `3\.3\.6`/u);
    assert.match(changelog, /CLI `3\.3\.3` release discovery/u);
    assert.ok(
      schemaIndex.schemas.some(
        ({ name }) =>
          name === "direct-native-hook-graph-profile-discovery-v3",
      ),
    );
    assert.ok(
      schemaIndex.schemas.some(
        ({ name }) => name === "custom-launch-preflight-v1",
      ),
    );
    assert.ok(
      schemaIndex.schemas.some(
        ({ name }) => name === "custom-launch-lifecycle-queue-v3",
      ),
    );
    assert.doesNotMatch(readOpenApi, /^\s*\/v3\/capabilities:/mu);
    assert.doesNotMatch(readOpenApi, /^\s*\/v3\/custom-launches\/preflight:/mu);
  });
});
