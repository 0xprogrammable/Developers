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
