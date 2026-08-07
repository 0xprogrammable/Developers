import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";

import { launchFeedPayload } from "../api/v2/launches.js";
import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { createSchemaRegistry, assertValid } from "../scripts/lib/schema.mjs";
import {
  customRegistryGenesisCanaryRecord,
  developerManifestV2,
  isV2PublicLaunch,
  projectV2Dataset,
  serviceStatusV2,
} from "../server/v2-dataset.js";

const classic = await readJson(
  path.join(REPOSITORY_ROOT, "fixtures/v2/launches/classic-v4-pool.json"),
);
const prelaunchCustom = await readJson(
  path.join(
    REPOSITORY_ROOT,
    "fixtures/v2/launches/custom-project-only-prelaunch.json",
  ),
);
const genesisCanary = await readJson(
  path.join(
    REPOSITORY_ROOT,
    "fixtures/v2/launches/custom-registry-genesis-canary.json",
  ),
);

function internalRecord(record, sortKey) {
  return {
    ...structuredClone(record),
    sortKey,
    launch: { ...record.launch, transactionIndex: 0 },
  };
}

function status() {
  return {
    schemaVersion: "1.0.0",
    status: "ready",
    generatedAt: "2026-08-06T00:00:00.000Z",
    chainId: 1,
    source: {},
    chain: {},
    coverage: {
      status: "complete",
      checkpoint: {
        blockNumber: 25690000,
        blockHash: `0x${"e".repeat(64)}`,
        finality: "confirmed",
      },
    },
    counts: { total: 3, classic: 1, custom: 2 },
    errors: [],
  };
}

describe("version 2 classification", () => {
  test("publishes recognized Classic but not a prelaunch Custom fixture", () => {
    assert.equal(isV2PublicLaunch(classic), true);
    assert.equal(isV2PublicLaunch(prelaunchCustom), false);
  });

  test("publishes only the exact finality-bound Registry genesis record", async () => {
    const manifest = await developerManifestV2();
    assert.equal(isV2PublicLaunch(genesisCanary, manifest), true);
    assert.equal(isV2PublicLaunch({
      ...genesisCanary,
      launch: { ...genesisCanary.launch, logIndex: 409 },
    }, manifest), false);
  });

  test("filters prelaunch Custom without changing the legacy v1 dataset", () => {
    const records = [
      internalRecord(classic, "0003"),
      internalRecord(prelaunchCustom, "0002"),
    ];
    const legacy = { records, status: status() };
    const projected = projectV2Dataset(legacy);

    assert.equal(legacy.records.length, 2);
    assert.deepEqual(
      projected.records.map((record) => record.launch.modelId),
      ["classic"],
    );
    assert.deepEqual(projected.status.counts, {
      total: 1,
      classic: 1,
      custom: 0,
    });
  });

  test("uses exact terminal labels and evidence bases", () => {
    const projected = projectV2Dataset({
      records: [
        internalRecord(classic, "0002"),
      ],
      status: status(),
    });
    assert.deepEqual(
      projected.records.map(
        (record) => record.extensions["programmable/classification"],
      ),
      [
        {
          namespace: "programmable",
          category: "classic",
          label: "Programmable Classic",
          basis: "recognized-classic-launcher-event",
        },
      ],
    );
  });

  test("serves a version 2 feed envelope", async () => {
    const projected = projectV2Dataset({
      records: [
        internalRecord(
          classic,
          "0000000000000002:0000000000:0000000000:0x1111111111111111111111111111111111111111",
        ),
      ],
      status: status(),
    });
    const payload = launchFeedPayload(projected, { limit: 100 });
    assert.equal(payload.schemaVersion, "2.0.0");
    assert.equal(payload.items[0].schemaVersion, "2.0.0");
    assertValid(
      (await createSchemaRegistry("v2")).validator("launch-feed.schema.json"),
      payload,
      "produced v2 launch feed",
    );
  });

  test("publishes Registry discovery while keeping general intake prelaunch", async () => {
    const manifest = await developerManifestV2();
    const publicStatus = serviceStatusV2(
      projectV2Dataset({
        records: [internalRecord(classic, "0001"), genesisCanary],
        status: { ...status(), customRegistry: { status: "ready" } },
      }, manifest).status,
      manifest,
    );
    assert.equal(manifest.customRegistry.status, "live");
    assert.equal(
      manifest.customRegistry.address,
      "0x17e18c88bda9bfb73924cdc989c07b0707e72671",
    );
    assert.equal(manifest.customRegistry.publicSubmissionsEnabled, false);
    assert.equal(manifest.deployments.some((item) => item.modelId === "stock-paired"), false);
    assert.equal(publicStatus.custom.status, "live");
  });

  test("includes the immutable Registry genesis canary in the Custom feed", async () => {
    const manifest = await developerManifestV2();
    const internalGenesis = customRegistryGenesisCanaryRecord();
    const projected = projectV2Dataset({
      records: [internalGenesis],
      status: {
        ...status(),
        customRegistry: { status: "ready", highWaterGeneration: "1" },
      },
    }, manifest);
    const payload = launchFeedPayload(projected, {
      category: "custom",
      limit: 100,
    });

    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].launchId, genesisCanary.launchId);
    assert.equal("sortKey" in payload.items[0], false);
  });

  test("keeps Registry discovery independent from the general submission intake", async () => {
    const manifest = structuredClone(await developerManifestV2());
    manifest.customRegistry.status = "live";
    manifest.customRegistry.publicSubmissionsEnabled = false;
    const projected = projectV2Dataset({
      records: [internalRecord(classic, "0001")],
      status: {
        ...status(),
        customRegistry: { status: "ready" },
      },
    }, manifest);

    assert.equal(projected.status.customRegistryPublication.status, "live");
    assert.equal(
      projected.status.customRegistryPublication.publicSubmissionsEnabled,
      false,
    );
  });

  test("fixtures conform to the version 2 schema", async () => {
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator("launch.schema.json");
    assertValid(validate, classic, "Classic v2 fixture");
    assertValid(validate, prelaunchCustom, "Custom v2 fixture");
    assertValid(validate, genesisCanary, "Custom Registry genesis canary fixture");
  });
});
