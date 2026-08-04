import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";
import {
  cloneJson,
  readJson,
  REPOSITORY_ROOT,
} from "../scripts/lib/files.mjs";
import {
  assertCoreContract,
  compareDeploymentManifests,
  compareV1Schemas,
} from "../scripts/lib/compatibility.mjs";
import { terminalRow } from "../scripts/lib/consumer.mjs";
import { createSchemaRegistry } from "../scripts/lib/schema.mjs";

const registry = await createSchemaRegistry();

describe("v1 compatibility", () => {
  test("matches the frozen core contract", async () => {
    const core = await readJson(
      path.join(REPOSITORY_ROOT, "compatibility/core-v1.json"),
    );
    assert.deepEqual(
      assertCoreContract(
        core,
        registry.schemas.get("launch.schema.json"),
        registry.schemas.get("launch-feed.schema.json"),
      ),
      [],
    );
  });

  test("allows a new optional field but rejects removal, enum drift, and new required fields", () => {
    const previous = cloneJson(registry.schemas.get("launch.schema.json"));
    const optional = cloneJson(previous);
    optional.properties.futureDisplayHint = { type: "string" };
    assert.deepEqual(compareV1Schemas(previous, optional), []);

    const removed = cloneJson(previous);
    delete removed.properties.markets;
    assert.ok(compareV1Schemas(previous, removed).some((item) => item.includes("markets")));

    const enumDrift = cloneJson(previous);
    enumDrift.$defs.launch.properties.status.enum.push("migrated");
    assert.ok(compareV1Schemas(previous, enumDrift).some((item) => item.includes("enum")));

    const newRequired = cloneJson(optional);
    newRequired.required.push("futureDisplayHint");
    assert.ok(compareV1Schemas(previous, newRequired).some((item) => item.includes("required")));
  });

  test("a tolerant v1 consumer ignores unknown optional fields without losing the launch", async () => {
    const fixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches/custom-unknown-future-capability.json"),
    );
    const expected = terminalRow(fixture);
    fixture.futureOptionalEnvelope = { deeply: { unknown: true } };
    fixture.token.futureOptionalTokenHint = "ignored";
    assert.deepEqual(terminalRow(fixture), expected);
    assert.deepEqual(expected.unsupportedMarketKinds, ["future-market-kind-v99"]);
  });

  test("deployment history is append-only while allowing forward lifecycle changes", async () => {
    const previous = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum.json"),
    );
    const appended = cloneJson(previous);
    appended.deployments.push({
      ...appended.deployments.at(-1),
      deploymentId: "future-append-only-fixture",
      contracts: { launcher: "0xabababababababababababababababababababab" },
      evidence: undefined,
    });
    assert.deepEqual(compareDeploymentManifests(previous, appended), []);

    const removed = cloneJson(previous);
    const removedId = removed.deployments.shift().deploymentId;
    assert.ok(
      compareDeploymentManifests(previous, removed).some((item) => item.includes(removedId)),
    );

    const mutated = cloneJson(previous);
    mutated.deployments[0].contracts.launcher =
      "0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
    assert.ok(
      compareDeploymentManifests(previous, mutated).some((item) => item.includes("contracts")),
    );
  });
});
