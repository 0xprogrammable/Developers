import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";
import {
  applyMutations,
  listFiles,
  readJson,
  REPOSITORY_ROOT,
} from "../scripts/lib/files.mjs";
import { createSchemaRegistry } from "../scripts/lib/schema.mjs";
import {
  validateFeedSemantics,
  validateLaunchSemantics,
  validateManifestSemantics,
} from "../scripts/lib/semantics.mjs";

const registry = await createSchemaRegistry();

describe("semantic conformance", () => {
  test("accepts every valid launch fixture", async () => {
    const files = await listFiles(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches"),
      (file) => file.endsWith(".json"),
    );
    for (const file of files) {
      assert.deepEqual(validateLaunchSemantics(await readJson(file)), [], file);
    }
  });

  test("accepts verified event provenance without block timestamp enrichment", async () => {
    const launch = await readJson(
      path.join(
        REPOSITORY_ROOT,
        "fixtures/v1/launches/classic-partial-token-identity.json",
      ),
    );
    const validate = registry.validator("launch.schema.json");
    assert.equal(validate(launch), true, JSON.stringify(validate.errors));
    assert.equal(launch.launch.timestamp, null);
    for (const key of [
      "transactionHash",
      "blockNumber",
      "blockHash",
      "logIndex",
    ]) {
      assert.notEqual(launch.launch[key], null, key);
    }
    assert.equal(launch.verification.provenanceStatus, "verified");
    assert.deepEqual(validateLaunchSemantics(launch), []);
  });

  test("rejects every malicious fixture at its declared layer", async () => {
    const validate = registry.validator("launch.schema.json");
    const cases = await listFiles(
      path.join(REPOSITORY_ROOT, "fixtures/v1/invalid"),
      (file) => file.endsWith(".json"),
    );
    for (const caseFile of cases) {
      const definition = await readJson(caseFile);
      const base = await readJson(path.resolve(path.dirname(caseFile), definition.baseFixture));
      const candidate = applyMutations(base, definition.mutations);
      const schemaValid = validate(candidate);
      if (definition.expectedLayer === "schema") {
        assert.equal(schemaValid, false, path.basename(caseFile));
        assert.ok(
          validate.errors.some((error) => error.keyword === definition.expectedCode),
          `${path.basename(caseFile)} errors: ${JSON.stringify(validate.errors)}`,
        );
      } else {
        assert.equal(schemaValid, true, JSON.stringify(validate.errors));
        const codes = validateLaunchSemantics(candidate).map((item) => item.code);
        assert.ok(codes.includes(definition.expectedCode), path.basename(caseFile));
      }
    }
  });

  test("requires a durable high-water cursor and consistent pagination state", async () => {
    const feed = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/feeds/empty-prelaunch.json"),
    );
    assert.deepEqual(validateFeedSemantics(feed), []);

    feed.snapshot = {
      blockNumber: "100",
      blockHash: `0x${"a".repeat(64)}`,
      indexedAt: "2026-08-04T08:00:00.000Z",
      finality: "confirmed",
      cursor: "head-a",
    };
    feed.page.resumeCursor = "different-head";
    feed.page.nextCursor = "next";
    feed.page.hasMore = false;
    const codes = validateFeedSemantics(feed).map((item) => item.code);
    assert.ok(codes.includes("RESUME_CURSOR_MISMATCH"));
    assert.ok(codes.includes("PAGINATION_CONTRADICTION"));
  });

  test("validates the deployment manifest invariants", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum.json"),
    );
    assert.deepEqual(validateManifestSemantics(manifest), []);
  });

  test("rejects executable wallet requests in manifest extensions", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum.json"),
    );
    manifest.extensions = {
      "evil.example/request": {
        to: "0x0000000000000000000000000000000000000001",
        data: "0xdeadbeef",
      },
    };
    assert.ok(
      validateManifestSemantics(manifest).some(
        (finding) => finding.code === "EXECUTABLE_METADATA",
      ),
    );
  });

  test("bounds extension traversal without recursive stack exhaustion", async () => {
    const launch = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches/classic-v4-pool.json"),
    );
    let current = {};
    launch.extensions["example.test/deep"] = current;
    for (let index = 0; index < 40; index += 1) {
      current.next = {};
      current = current.next;
    }
    assert.ok(
      validateLaunchSemantics(launch).some(
        (finding) => finding.code === "METADATA_TOO_COMPLEX",
      ),
    );
  });
});
