import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";
import {
  listFiles,
  readJson,
  REPOSITORY_ROOT,
} from "../scripts/lib/files.mjs";
import {
  assertValid,
  createSchemaRegistry,
  validationSummary,
} from "../scripts/lib/schema.mjs";
import { canonicalSha256 } from "../server/canonical.js";
import {
  deriveFinalityPolicyHashV1,
  deriveOnchainFeePolicyHashV1,
  derivePublicFeePolicyBindingV1,
  deriveRegisteredRecordCommitmentV1,
  deriveRegisteredRecordComponentHashesV1,
  deriveRegistrationBindingHashV1,
  deriveVerifiedReviewEvidenceHashV1,
  validateRegisteredRecordBindingsV1,
} from "../server/registry-v3.js";

const registry = await createSchemaRegistry();
const registryV2 = await createSchemaRegistry("v2");

describe("JSON Schema registry", () => {
  test("compiles every v1 schema with unique local identifiers", () => {
    assert.ok(registry.files.length >= 7);
    assert.equal(registry.schemas.size, registry.files.length);
  });

  test("validates every launch fixture", async () => {
    const validate = registry.validator("launch.schema.json");
    const files = await listFiles(
      path.join(REPOSITORY_ROOT, "fixtures", "v1", "launches"),
      (file) => file.endsWith(".json"),
    );
    for (const file of files) {
      assertValid(validate, await readJson(file), path.basename(file));
    }
  });

  test("validates the real deployment manifest", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments", "ethereum.json"),
    );
    assertValid(
      registry.validator("manifest.schema.json"),
      manifest,
      "deployments/ethereum.json",
    );
  });

  test("requires operation-specific authorities for Registry generation 1", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments", "ethereum-v2.json"),
    );
    const validate = registryV2.validator("manifest.schema.json");
    assertValid(validate, manifest, "deployments/ethereum-v2.json");

    delete manifest.registryGenerations[0].operationAuthorities;
    assert.equal(validate(manifest), false);
    assert.match(validationSummary(validate), /operationAuthorities/);
  });

  test("keeps the Custom Fee-Enforced V2 release candidate fail closed", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments", "ethereum-v2.json"),
    );
    const validate = registryV2.validator(
      "custom-fee-enforced-launch-profile-v2.schema.json",
    );
    assertValid(
      validate,
      manifest.customFeeEnforcedLaunchProfileV2,
      "Custom Fee-Enforced V2 RC descriptor",
    );
    assert.equal(manifest.platformFee.nativeCustom.status, "unavailable");
    assert.equal(manifest.platformFee.partnerTemplate.status, "unavailable");
    assert.equal(
      manifest.customFeeEnforcedLaunchProfileV2.evidenceStatus.securityReview,
      "release-blockers-open",
    );
    assert.ok(
      manifest.customFeeEnforcedLaunchProfileV2.activationRequirements.includes(
        "pool-initialization-front-run-protected",
      ),
    );
    assert.deepEqual(
      manifest.customFeeEnforcedLaunchProfileV2.finalArtifactLiterals,
      {
        status: "pinned-release-candidate",
        launchProfileHash:
          "sha256:c2c8df0ce28ef4eea1d5124bc366c634675873d095e9978bc7e968792a4c738d",
        contractPolicyId:
          "0xb7ff874d418bc714d0ec6c36a2df03ea6251bc8b6eb125adc4f5b6b4899d2517",
      },
    );
    assert.deepEqual(
      manifest.customFeeEnforcedLaunchProfileV2.requiredBindings
        .canonicalPoolManager,
      {
        address: "0x000000000004444c5dc75cB358380D2e3dE08A90",
        runtimeCodeHash:
          "0x785f1014552b7ce7d5fb7d0c970ca60edee94fd00425d7ca21609acac7ce1293",
      },
    );
    assert.equal(
      manifest.customFeeEnforcedLaunchProfileV2.feeSemantics
        .requiredHookFlags,
      "0x2044",
    );
    assert.equal(
      manifest.customFeeEnforcedLaunchProfileV2.feeSemantics.settlementMode,
      "pool-manager-erc6909-claims-in-sealed-vault",
    );
    assert.equal(
      manifest.customFeeEnforcedLaunchProfileV2.feeSemantics.claimAuthority,
      "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
    );
    assert.equal(
      manifest.customFeeEnforcedLaunchProfileV2.artifactCommitments.compiler
        .settingsHash,
      "0xd8985cd6554daab2848a8df4d90f9d5e0d81f15d062ee04bcd8414f292ccaf43",
    );
    assert.deepEqual(
      manifest.customFeeEnforcedLaunchProfileV2.artifactCommitments.components
        .map(({ role }) => role),
      ["token", "feeVault", "feeHook", "poolInitializer"],
    );
    assert.deepEqual(
      manifest.customFeeEnforcedLaunchProfileV2.moduleSemantics,
      {
        mode: "isolated-external-module",
        callback: "afterSwap",
        arbitraryCallbacks: false,
        maximumCustomReturnDelta: 0,
        customDeltaAccount: "0x0000000000000000000000000000000000000000",
      },
    );
    assert.deepEqual(
      manifest.customFeeEnforcedLaunchProfileV2.api.heldResponse,
      {
        httpStatus: 503,
        retryAfter: "required",
        retryable: true,
      },
    );
    assert.deepEqual(manifest.customFeeEnforcedLaunchProfileV2.cli, {
      packageName: "@programmable/launch",
      version: "2.0.0-rc.1",
      distributionStatus: "github-release-candidate",
      releaseUrl:
        "https://github.com/0xprogrammable/PROGRAMMABLE/releases/tag/programmable-launch-v2.0.0-rc.1",
      packageAssetUrl:
        "https://github.com/0xprogrammable/PROGRAMMABLE/releases/download/programmable-launch-v2.0.0-rc.1/programmable-launch-2.0.0-rc.1.tgz",
      commands: ["pack", "validate", "submit", "status"],
    });

    for (const mutate of [
      (profile) => { profile.productionLaunchAuthorized = true; },
      (profile) => { profile.status = "live"; },
      (profile) => { profile.api.publiclyRoutable = true; },
      (profile) => { profile.cli.distributionStatus = "published"; },
      (profile) => { profile.cli.packageAssetUrl = "https://example.com/package.tgz"; },
      (profile) => { profile.feeSemantics.ratePpm = 999; },
      (profile) => { profile.moduleSemantics.maximumCustomReturnDelta = 1; },
      (profile) => { profile.moduleSemantics.customDeltaAccount = "launchWallet"; },
      (profile) => { profile.api.heldResponse.httpStatus = 409; },
      (profile) => { profile.api.heldResponse.retryAfter = "optional"; },
      (profile) => { profile.api.openApiUrl = null; },
      (profile) => { profile.finalArtifactLiterals.contractPolicyId = `0x${"1".repeat(64)}`; },
      (profile) => { profile.artifactCommitments.compiler.optimizer.runs = 999; },
      (profile) => { profile.feeSemantics.claimAuthority = `0x${"1".repeat(40)}`; },
      (profile) => { profile.requiredBindings.exactPoolId = "optional"; },
    ]) {
      const profile = structuredClone(manifest.customFeeEnforcedLaunchProfileV2);
      mutate(profile);
      assert.equal(validate(profile), false);
    }
  });

  test("validates feed and token-list fixtures", async () => {
    assertValid(
      registry.validator("launch-feed.schema.json"),
      await readJson(
        path.join(REPOSITORY_ROOT, "fixtures/v1/feeds/empty-prelaunch.json"),
      ),
      "empty launch feed",
    );
    assertValid(
      registry.validator("token-list.schema.json"),
      await readJson(path.join(REPOSITORY_ROOT, "fixtures/v1/token-list.json")),
      "token list",
    );
    assertValid(
      registryV2.validator("token-list.schema.json"),
      await readJson(path.join(REPOSITORY_ROOT, "fixtures/v2/token-list.partial.json")),
      "partial v2 token list",
    );
  });

  test("strict producer schema rejects fabricated trust and executable adapter fields", async () => {
    const validate = registry.validator("launch.schema.json");
    const fixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches/classic-v4-pool.json"),
    );
    fixture.verification.securityApproved = true;
    assert.equal(validate(fixture), false);
    assert.match(validationSummary(validate), /additionalProperties/);

    delete fixture.verification.securityApproved;
    fixture.markets[0].adapter.executionUrl = "https://evil.example/transaction";
    assert.equal(validate(fixture), false);
    assert.match(validationSummary(validate), /additionalProperties/);
  });

  test("rejects credential-bearing URLs and oversized EVM decimal strings", async () => {
    const validate = registry.validator("launch.schema.json");
    const fixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches/classic-v4-pool.json"),
    );
    fixture.token.metadata.imageUrl = "https://user:password@example.com/token.png";
    assert.equal(validate(fixture), false);
    assert.match(validationSummary(validate), /pattern/);

    fixture.token.metadata.imageUrl = null;
    fixture.token.totalSupplyRaw = "1".repeat(79);
    assert.equal(validate(fixture), false);
    assert.match(validationSummary(validate), /maxLength/);
  });

  test("keeps v1 frozen and rejects a forged platform identity in v2", async () => {
    const validateV1 = registry.validator("launch.schema.json");
    const fixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches/classic-v4-pool.json"),
    );
    fixture.platformId = "creator-declared-programmable";
    assert.equal(validateV1(fixture), false);
    assert.match(validationSummary(validateV1), /additionalProperties/);

    const validateV2 = registryV2.validator("launch.schema.json");
    const v2Fixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v2/launches/classic-v4-pool.json"),
    );
    v2Fixture.platformId = "creator-declared-programmable";
    assert.equal(validateV2(v2Fixture), false);
    assert.match(validationSummary(validateV2), /const/);
  });

  test("defines provider attribution without upgrading display-only data", async () => {
    const validate = registryV2.validator("launch.schema.json");
    const fixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v2/launches/classic-v4-pool.json"),
    );
    fixture.provider = {
      id: "future-provider-v99",
      displayName: "Future Provider",
      verificationStatus: "display-only",
      evidenceHash: null,
      extensions: {
        "future-provider/display": { unfamiliar: true },
      },
    };
    assertValid(validate, fixture, "display-only provider attribution");

    fixture.provider.verificationStatus = "registry-bound";
    assert.equal(validate(fixture), false);
    assert.match(validationSummary(validate), /type/);

    fixture.provider.evidenceHash = `0x${"1".repeat(64)}`;
    assertValid(validate, fixture, "registry-bound provider attribution");

    fixture.provider.untrustedAuthority = true;
    assert.equal(validate(fixture), false);
    assert.match(validationSummary(validate), /additionalProperties/);
  });

  test("round-trips the exact Approval v3 producer fixture and hash domains", async () => {
    const validate = registryV2.validator(
      "custom-launch-registry-record-v3.schema.json",
    );
    const fixture = await readJson(
      path.join(
        REPOSITORY_ROOT,
        "fixtures/v2/custom-launch-registry-record-v3.golden.json",
      ),
    );
    assertValid(validate, fixture, "Approval producer v3 golden fixture");

    const { schemaVersion: _schemaVersion, envelopeDigest, ...preimage } = fixture;
    assert.equal(
      envelopeDigest,
      canonicalSha256(
        "programmable.custom-launch-registry-envelope-digest.v3",
        preimage,
      ),
    );
    assert.equal(
      canonicalSha256("programmable.custom-launch-registry-record.v3", fixture),
      "sha256:6bde61c0d7347b389e53999f984a8cb1f4fdc66395b1136b08eb328e1a53e2af",
    );
    assert.equal(
      fixture.registryOrigin.registryLaunchIdRaw,
      `0x${fixture.launchId.slice("sha256:".length)}`,
    );
    assert.notEqual(
      fixture.envelopeDigest,
      fixture.registryOrigin.registeredRecordHash,
    );
    const components = deriveRegisteredRecordComponentHashesV1(
      fixture.registeredRecordPreimage,
    );
    assert.deepEqual(components, fixture.registeredRecordComponentHashes);
    assert.equal(
      deriveRegisteredRecordCommitmentV1(components),
      fixture.registeredRecordCommitment,
    );
    assert.equal(
      deriveRegistrationBindingHashV1(fixture.registeredRecordCommitment),
      fixture.registrationBindingHash,
    );
    assert.equal(
      fixture.registryOrigin.registeredRecordHash,
      fixture.registeredRecordCommitment,
    );
    assert.equal(
      derivePublicFeePolicyBindingV1(fixture.feePolicy),
      fixture.feePolicy.publicPolicyBindingHash,
    );
    assert.equal(
      fixture.onchainFeePolicy.publicPolicyBindingHash,
      `0x${fixture.feePolicy.publicPolicyBindingHash.slice("sha256:".length)}`,
    );
    assert.equal(
      deriveOnchainFeePolicyHashV1(fixture.onchainFeePolicy),
      fixture.registeredRecordPreimage.feePolicyHash,
    );
    assert.equal(
      deriveVerifiedReviewEvidenceHashV1(fixture.verifiedReview),
      fixture.verifiedReview.reviewEvidenceHash,
    );
    assert.equal(
      deriveFinalityPolicyHashV1(fixture.finalityPolicy),
      fixture.registeredRecordPreimage.finalityPolicyHash,
    );
    assert.equal(validateRegisteredRecordBindingsV1(fixture), true);

    const aliased = structuredClone(fixture);
    aliased.deploymentBinding.contracts[0].runtimeCodeHash =
      aliased.deploymentBinding.contracts[0].runtimeCodeKeccak256;
    assert.equal(validate(aliased), false);
    assert.match(validationSummary(validate), /additionalProperties/);
  });
});
