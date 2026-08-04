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

const registry = await createSchemaRegistry();

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
});
