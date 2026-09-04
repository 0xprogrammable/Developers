import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";
import { listFiles, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { hardcodedDeploymentFindings } from "../scripts/lib/source-scan.mjs";

const FEE_RECIPIENT = "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";

describe("documentation contract", () => {
  test("pins the additive v2 launch and compatibility contracts byte-identically", async () => {
    for (const [file, expected] of [
      ["schemas/v2/launch.schema.json", "7c67ec7615dcca38e2305483a64d337d64b3537cd0a6c35a11b07d674e789b99"],
      [
        "schemas/v2/custom-launch-source-verification-v4.schema.json",
        "8644c494738f043218798c13093a42b66195661db490e796c2a394be47570385",
      ],
      ["compatibility/core-v2.json", "e863d39d25ff040f2d7a5c100d354019a11aaca8b102686e67ea0fe4e0be60b0"],
    ]) {
      const bytes = await readFile(path.join(REPOSITORY_ROOT, file));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, file);
    }
  });

  test("does not hardcode any launcher, hook, coordinator, or registry address", async () => {
    assert.deepEqual(await hardcodedDeploymentFindings(), []);
  });

  test("publishes the Router-first entry points, read-only endpoints, and fee disclosure", async () => {
    const [readme, fees, routerReference] = await Promise.all([
      readFile(path.join(REPOSITORY_ROOT, "README.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "docs/reference/fees.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "docs/reference/launch-stamp.md"), "utf8"),
    ]);
    for (const endpoint of [
      "/api/v2/status",
      "/api/v2/manifest",
      "/api/v2/launches",
      "/api/v2/token-list",
    ]) {
      assert.ok(readme.includes(endpoint), `README is missing ${endpoint}`);
    }
    assert.match(readme, /docs\/reference\/fees\.md/);
    assert.ok(fees.includes(FEE_RECIPIENT));
    assert.match(fees, /10 basis points/);
    assert.match(fees, /0\.1 percent/);
    assert.match(fees, /1,000 parts per million/);
    assert.match(readme, /v2 API is read-only/i);
    assert.match(readme, /programmable-launch-stamp-router-v1\.json/i);
    assert.match(readme, /docs\/reference\/launch-stamp\.md/i);
    assert.match(routerReference, /Programmable Classic/);
    assert.match(routerReference, /Programmable Custom/);
    assert.match(routerReference, /Finalized PCAN test vector/i);
    assert.match(routerReference, /Historical launches are not backfilled/i);
    assert.doesNotMatch(readme, /Custom public intake/i);
    assert.doesNotMatch(readme, /self-service launch flow/i);
  });

  test("keeps two v2 categories while binding Custom to explicit provenance bases", async () => {
    const [versioning, migration, reference, openapi, core] = await Promise.all([
      readFile(path.join(REPOSITORY_ROOT, "VERSIONING.md"), "utf8"),
      readFile(
        path.join(REPOSITORY_ROOT, "docs/migrations/v1-to-v2.md"),
        "utf8",
      ),
      readFile(
        path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"),
        "utf8",
      ),
      readFile(
        path.join(REPOSITORY_ROOT, "openapi/programmable-v2.yaml"),
        "utf8",
      ),
      readFile(
        path.join(REPOSITORY_ROOT, "compatibility/core-v2.json"),
        "utf8",
      ).then(JSON.parse),
    ]);
    assert.deepEqual(core.publicCategories, ["classic", "custom"]);
    assert.equal(
      core.classification.custom.requiredEvidence,
      "programmable-custom-registry-event-or-canonical-launch-stamp-router",
    );
    for (const source of [versioning, migration, reference, openapi]) {
      assert.match(source, /classification.*basis/is);
      assert.match(source, /Registry.*Router|Router.*Registry/is);
    }
    assert.match(reference, /accepted Router snapshot/i);
    assert.match(openapi, /source-shaped JSON alone is never sufficient/i);
  });

  test("never presents the read-only feed as transaction authorization", async () => {
    const reference = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"),
      "utf8",
    );
    assert.match(reference, /never returns transaction payloads/i);
    assert.match(reference, /neither authorizes nor constructs/i);
  });

  test("publishes one bounded ingestion reference and explicit manifest precedence", async () => {
    const ingestion = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/hosted-feed.md"),
      "utf8",
    );
    const reference = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"),
      "utf8",
    );
    for (const contract of [
      /maximumPages = 1_000/,
      /AbortSignal\.timeout\(10_000\)/,
      /attempt <= 3/,
      /retry-after/,
      /Page cursor loop detected/,
      /const pollScope = \{ chainId, category \}/,
      /recordsByKey\.set\(`\$\{record\.chainId\}:\$\{record\.launchId\}`, record\)/,
      /request = \{ \.\.\.pollScope, cursor: nextCursor, limit: 100 \}/,
      /commitRecordsAndCursor\(backfill\)/,
      /ingestTraversal\(durableResumeCursor\)/,
    ]) {
      assert.match(ingestion, contract);
    }
    assert.match(reference, /operational presentation mirror/i);
    assert.match(reference, /Developer manifest.*takes precedence/i);
    assert.match(reference, /must not be resolved by merging fields/i);
  });

  test("all local Markdown links resolve", async () => {
    const files = [
      path.join(REPOSITORY_ROOT, "README.md"),
      ...(await listFiles(path.join(REPOSITORY_ROOT, "docs"), (file) =>
        file.endsWith(".md"),
      )),
    ];
    const failures = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].trim();
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const pathOnly = target.split("#", 1)[0];
        if (!pathOnly) continue;
        try {
          await access(path.resolve(path.dirname(file), pathOnly));
        } catch {
          failures.push(`${path.relative(REPOSITORY_ROOT, file)} -> ${target}`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  test("publishes an openable index for the advertised schema base URL", async () => {
    const wellKnown = JSON.parse(
      await readFile(
        path.join(REPOSITORY_ROOT, "public/.well-known/programmable.json"),
        "utf8",
      ),
    );
    const schemaIndex = JSON.parse(
      await readFile(
        path.join(REPOSITORY_ROOT, "schema-index-v2.json"),
        "utf8",
      ),
    );
    const vercel = JSON.parse(
      await readFile(path.join(REPOSITORY_ROOT, "vercel.json"), "utf8"),
    );

    assert.equal(schemaIndex.baseUrl, wellKnown.schemasBaseUrl);
    const manifest = JSON.parse(
      await readFile(
        path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
        "utf8",
      ),
    );
    assert.deepEqual(wellKnown.publicCategories.custom, {
      discoveryStatus: "live",
      publicSubmissionStatus: "closed",
      customLaunchApiStatus: "live",
      legacyRegistrySubmissionStatus: "closed",
      legacyGithubSubmissionStatus: "closed",
      registryAddress: manifest.customRegistry.address,
      registryStartBlock: manifest.customRegistry.startBlock,
      registryGeneration: manifest.customRegistry.generation,
      note:
        "Custom Launch API V1 and V2 historical reads remain available, but authenticated POST is read-only and returns nonretryable HTTP 409. Only metadata-bound V3 profile 3.3.0 accepts fresh submissions. Legacy Registry and GitHub submission intake remain closed.",
    });
    const customLaunchApi = wellKnown.extensions["programmable.custom-launch-api"];
    const {
      currentCreate,
      publicRelease,
      versions,
      legacyIntake,
      ...v1Surface
    } = customLaunchApi;
    assert.deepEqual(v1Surface, {
      status: "live",
      scope: "provenance-only",
      feeEnforcement: "not-established-by-api",
      writeStatus: "read-only",
      postResponse: {
        httpStatus: 409,
        code: "CUSTOM_LAUNCH_V1_READ_ONLY",
        retryable: false,
      },
      apiBaseUrl: "https://api.programmable.market",
      readyzUrl: "https://api.programmable.market/readyz",
      guideUrl: "https://programmable.market/developers/custom-launch-api-v1.md",
      openApiUrl: "https://programmable.market/openapi/custom-launch-v1.json",
      apiKeyManagementUrl: "https://programmable.market/developers/api-keys",
      walletBoundary: "separate-wallet-signature",
      agentIntegration: {
        remediationCatalogSchemaVersion:
          "programmable.custom-launch-agent-remediation-catalog.v1",
        remediationCatalogUrl:
          "https://programmable.market/policies/custom-launch-agent-remediation-v1.json",
        existingProjectGuideUrl:
          "https://programmable.market/docs/developers/custom-launch#existing-project-integration",
        packConfigSchemaUrl:
          "https://programmable.market/schemas/custom-launch/v3/pack-config.json",
        packConfigSchemaSha256:
          "sha256:65e80af492582b8e42a440d9bbb23a776af31e22306ec828208959e8a790be15",
        finalizedMetadataUrl:
          "https://api.programmable.market/v3/finalized-custom-launches",
      },
    });
    assert.equal(customLaunchApi.publicRelease.status, "historical-read-only");
    assert.equal(customLaunchApi.publicRelease.apiVersion, "2");
    assert.equal(customLaunchApi.publicRelease.openApiUrl,
      "https://programmable.market/openapi/custom-launch-v2.json");
    assert.equal(customLaunchApi.publicRelease.cli.releaseVersion, "2.0.1");
    assert.deepEqual(customLaunchApi.publicRelease.postResponse, {
      httpStatus: 409,
      code: "CUSTOM_LAUNCH_V2_READ_ONLY",
      retryable: false,
    });
    assert.deepEqual(currentCreate, {
      apiVersion: "3",
      status: "live",
      profileId: manifest.directNativeHookGraphProfileV3.profileId,
      profileRevision: manifest.directNativeHookGraphProfileV3.profileRevision,
      profileVersion: manifest.directNativeHookGraphProfileV3.profileVersion,
      baseUrl: manifest.directNativeHookGraphProfileV3.api.baseUrl,
      method: "POST",
      path: manifest.directNativeHookGraphProfileV3.api.collectionPath,
      capabilitiesUrl: "https://api.programmable.market/v3/capabilities",
      preflightUrl:
        "https://api.programmable.market/v3/custom-launches/preflight",
      readyzUrl: "https://api.programmable.market/readyz",
      openApiUrl: "https://programmable.market/openapi/custom-launch-v3.json",
      authentication:
        manifest.directNativeHookGraphProfileV3.api.authentication,
      partnerCredentials:
        manifest.directNativeHookGraphProfileV3.api.partnerCredentials,
      walletBoundary:
        manifest.directNativeHookGraphProfileV3.api.walletBoundary,
    });
    assert.deepEqual(versions, {
      v1: {
        reads: "live",
        create: "read-only",
        createHttpStatus: 409,
        createErrorCode: "CUSTOM_LAUNCH_V1_READ_ONLY",
        retryable: false,
      },
      v2: {
        reads: "live",
        create: "read-only",
        createAuthentication: "wallet-bound-api-key",
        createHttpStatus: 409,
        createErrorCode: "CUSTOM_LAUNCH_V2_READ_ONLY",
        retryable: false,
      },
      v3: {
        status: "live",
        collectionPath: "/v3/custom-launches",
        openApiPath: "/openapi/custom-launch-v3.json",
        openApiUrl:
          "https://programmable.market/openapi/custom-launch-v3.json",
        profileId: "programmable.direct-native-hook-graph.v1",
        profileRevision: 3,
        profileVersion: "3.3.0",
        compatibleProfileRevisions: [2, 3],
        compatibleProfileVersions: ["3.2.0", "3.1.0", "3.0.0", "2.0.0"],
        authentication: "bearer-api-key",
        partnerCredentials:
          manifest.directNativeHookGraphProfileV3.api.partnerCredentials,
        walletBoundary: "wallet-reviews-signs-and-broadcasts-separately",
        selfServe: {
          capabilities: {
            method: "GET",
            path: "/v3/capabilities",
            authentication: "none",
            projectMetadata: {
              schemaVersion: "programmable.project-metadata.v1",
              inputSchemaVersion: "programmable.project-metadata-input.v1",
              requiredForProfileVersion: "3.3.0",
              requiredForProfileVersions: ["3.2.0", "3.3.0", "3.4.0"],
              strictMetadataProfileVersions: ["3.3.0", "3.4.0"],
              legacyWithoutMetadataProfileVersions: [
                "2.0.0",
                "3.0.0",
                "3.1.0",
              ],
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
            behaviorEvidence: {
              requiredForProfileVersion: "3.4.0",
              configurationIsExecutionEvidence: false,
              walletHandoffRequiresVerifiedEvidence: false,
              notConfiguredDisposition: "claims_remain_unverified",
              unavailableDisposition: "claims_remain_unverified",
              requiredProfileNotConfiguredDisposition: "blocks_wallet_handoff",
              requiredProfileUnavailableDisposition: "blocks_wallet_handoff",
              executedFailureDisposition: "blocks_wallet_handoff",
              feeBehaviorClaim: false,
            },
            feePolicy: {
              tenBpsClaimRequiresExactPerLaunchVerifiedFeePathEvidence: true,
            },
            safetyClaim: false,
            auditClaim: false,
            universalCompatibilityClaim: false,
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
            finalityScope: "finalized-v3-project-metadata-ledger",
            launchProfileVersionField: "launchProfileVersion",
            launchProfileVersionSemantics: "immutable-origin-profile",
            responseEnvelope: {
              requiredFields: [
                "schemaVersion",
                "generatedAt",
                "launches",
                "nextCursor",
                "quality",
              ],
              launchesField: "launches",
              quality: {
                required: true,
                statuses: ["complete", "partial"],
                sourceRowAccounting:
                  "published-plus-quarantined-equals-source",
                quarantineDiagnosticCode: "FINALIZED_ROW_QUARANTINED",
              },
            },
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
        },
      },
    });
    assert.deepEqual(legacyIntake, {
      registry: "closed",
      github: "closed",
    });
    assert.deepEqual(
      wellKnown.extensions["programmable.custom-fee-enforced-launch-profile-v2"],
      {
        profileId:
          "programmable.fee-enforced-isolated-after-swap.zero-delta.v1",
        profileRevision: 3,
        profileVersion: "2.0.0",
        launchProfileHash:
          "sha256:fd2d738117c4c69304efb49c75d402d2e8b8968832fd2e27548c3d9814c5c9ee",
        contractPolicyId:
          "0xb7ff874d418bc714d0ec6c36a2df03ea6251bc8b6eb125adc4f5b6b4899d2517",
        status: "read-only",
        releaseStage: "compatibility",
        activationStatus: "historical-read-only",
        productionLaunchAuthorized: false,
        statusUrl: "https://developers.programmable.family/api/v2/status",
        manifestUrl: "https://developers.programmable.family/api/v2/manifest",
        guideUrl:
          "https://raw.githubusercontent.com/programmablehq/developers/main/docs/guides/custom-fee-enforced-launch-profile-v2.md",
        openApiUrl:
          "https://programmable.market/openapi/custom-launch-v2.json",
        writeStatus: "read-only",
        postResponse: {
          httpStatus: 409,
          code: "CUSTOM_LAUNCH_V2_READ_ONLY",
          retryable: false,
        },
        note:
          "Historical V2 resources remain readable. Authenticated POST is read-only and returns nonretryable 409 CUSTOM_LAUNCH_V2_READ_ONLY. Only V3 profile 3.3.0 accepts fresh submissions. Generic fee claiming and buybacks are not live.",
      },
    );
    assert.equal(
      wellKnown.extensions["programmable.direct-native-hook-graph-profile-v1"]
        .note,
      "Retained preview contract only. This revision remains gated and publishes no launch; fresh submissions use the active V3 descriptor, while V2 is retained for historical reads and exact-byte retries.",
    );
    const directNativeV2 = manifest.directNativeHookGraphProfileV2;
    assert.deepEqual(
      wellKnown.extensions["programmable.direct-native-hook-graph-profile-v2"],
      {
        discoverySchemaVersion: directNativeV2.schemaVersion,
        discoverySchemaUrl:
          "https://developers.programmable.family/schemas/v2/direct-native-hook-graph-profile-discovery-v2.schema.json",
        profileSchemaVersion: directNativeV2.profileSchemaVersion,
        profileId: directNativeV2.profileId,
        profileRevision: directNativeV2.profileRevision,
        profileVersion: directNativeV2.profileVersion,
        publicCategory: directNativeV2.publicCategory,
        status: directNativeV2.status,
        releaseStage: directNativeV2.releaseStage,
        activationStatus: directNativeV2.activationStatus,
        productionLaunchAuthorized:
          directNativeV2.productionLaunchAuthorized,
        api: directNativeV2.api,
        cli: directNativeV2.cli,
        statusUrl: "https://developers.programmable.family/api/v2/status",
        manifestUrl: "https://developers.programmable.family/api/v2/manifest",
        guideUrl: directNativeV2.guideUrl,
      },
    );
    assert.deepEqual(
      schemaIndex.schemas.map(({ name }) => name),
      [
        "common",
        "canonical-custom-registry-record-v3",
        "canonical-custom-registry-record-v4",
        "custom-fee-enforced-launch-profile-v2",
        "custom-launch-chain-deployment-v4",
        "custom-launch-preflight-v1",
        "custom-launch-lifecycle-queue-v3",
        "custom-launch-source-verification-v4",
        "direct-native-hook-graph-profile-discovery-v1",
        "direct-native-hook-graph-profile-discovery-v2",
        "direct-native-hook-graph-profile-discovery-v3",
        "launch-feed",
        "launch-partner-attribution-v1",
        "launch",
        "manifest",
        "problem",
        "robinhood-custom-launch-binding",
        "status",
        "token-list",
        "direct-chain-integration",
        "robinhood-direct-chain-evidence",
      ],
    );
    const v2Schemas = new Map(
      schemaIndex.schemas.map(({ name, url }) => [name, url]),
    );
    assert.equal(
      v2Schemas.get("custom-launch-chain-deployment-v4"),
      "https://developers.programmable.family/schemas/v2/custom-launch-chain-deployment-v4.schema.json",
    );
    assert.equal(
      v2Schemas.get("robinhood-custom-launch-binding"),
      "https://developers.programmable.family/schemas/v2/robinhood-custom-launch-binding.schema.json",
    );
    assert.ok(
      vercel.rewrites.some(
        ({ source, destination }) =>
          source === "/schemas/v2" &&
          destination === "/schemas/v2/index.json",
      ),
    );
    assert.ok(
      vercel.rewrites.some(
        ({ source, destination }) =>
          source === "/v2/chains/:chainId/launches/:launchId" &&
          destination === "/api/v2/chains/:chainId/launches/:launchId",
      ),
    );
    assert.ok(
      vercel.rewrites.some(
        ({ source, destination }) =>
          source === "/api/v2/launches/:launchId" &&
          destination === "/api/v2/launch-detail?launchId=:launchId",
      ),
    );
  });

  test("documents the historical V2 profile without broad product claims", async () => {
    const guide = await readFile(
      path.join(
        REPOSITORY_ROOT,
        "docs/guides/custom-fee-enforced-launch-profile-v2.md",
      ),
      "utf8",
    );
    assert.match(guide, /historical.*read-only/i);
    assert.match(
      guide,
      /programmable\.fee-enforced-isolated-after-swap\.zero-delta\.v1/,
    );
    assert.match(guide, /maximum custom return delta is exactly `0`/i);
    assert.match(
      guide,
      /customDeltaAccount.*0x0000000000000000000000000000000000000000/is,
    );
    assert.match(guide, /no `launchWallet` coupling/i);
    assert.match(guide, /gross amount of the unspecified pool currency/i);
    assert.match(guide, /Exact input \| Output currency/);
    assert.match(guide, /Exact output \| Input currency/);
    assert.match(guide, /single-resource route as the canonical polling\s+path/i);
    assert.match(guide, /self-reporting getters/i);
    assert.match(guide, /initializing the\s+deterministic pool first/i);
    assert.match(guide, /pinned permission mask is `0x2044`/i);
    assert.match(
      guide,
      /sha256:fd2d738117c4c69304efb49c75d402d2e8b8968832fd2e27548c3d9814c5c9ee/,
    );
    assert.match(
      guide,
      /0xb7ff874d418bc714d0ec6c36a2df03ea6251bc8b6eb125adc4f5b6b4899d2517/,
    );
    assert.match(guide, /PoolManager\s+ERC-6909 claims/i);
    assert.match(guide, /actual hook and vault\s+runtime code hashes/i);
    assert.match(guide, /409.*CUSTOM_LAUNCH_V2_READ_ONLY/is);
    assert.match(guide, /nonretryable|not retryable/i);
    assert.match(
      guide,
      /https:\/\/programmable\.market\/openapi\/custom-launch-v2\.json/,
    );
    assert.match(
      guide,
      /releases\/tag\/programmable-launch-v2\.0\.1/,
    );
    assert.match(guide, /npm install --global .*programmable-launch-2\.0\.1\.tgz/);
    assert.match(guide, /`submit` cannot create or replay a V2 request/i);
    assert.match(guide, /generic fee claiming for arbitrary hooks/i);
    assert.match(guide, /buybacks/i);
    assert.doesNotMatch(guide, /npm (?:install|i) @programmable\/launch/);
  });
});
