import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";

import { launchFeedPayload } from "../api/v2/launches.js";
import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { createSchemaRegistry, assertValid } from "../scripts/lib/schema.mjs";
import {
  developerManifestV2,
  isV2PublicLaunch,
  projectV2Dataset,
  serviceStatusV2,
} from "../server/v2-dataset.js";

const classic = await readJson(
  path.join(REPOSITORY_ROOT, "fixtures/v2/launches/classic-v4-pool.json"),
);
const registeredCustom = await readJson(
  path.join(
    REPOSITORY_ROOT,
    "fixtures/v2/launches/custom-registered-no-market.json",
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
  test("publishes only recognized Classic and registry-backed Custom launches", () => {
    const stock = {
      ...structuredClone(registeredCustom),
      launch: {
        ...registeredCustom.launch,
        modelId: "stock-paired",
        publicSubmission: false,
      },
    };
    const unregistered = {
      ...structuredClone(registeredCustom),
      verification: {
        ...registeredCustom.verification,
        registryAddress: null,
      },
    };

    assert.equal(isV2PublicLaunch(classic), true);
    assert.equal(isV2PublicLaunch(registeredCustom), true);
    assert.equal(isV2PublicLaunch(stock), false);
    assert.equal(isV2PublicLaunch(unregistered), false);
  });

  test("filters Stock-Paired without changing the legacy v1 dataset", () => {
    const records = [
      internalRecord(classic, "0003"),
      internalRecord(registeredCustom, "0002"),
      internalRecord(
        {
          ...registeredCustom,
          launch: {
            ...registeredCustom.launch,
            modelId: "stock-paired",
            publicSubmission: false,
          },
        },
        "0001",
      ),
    ];
    const legacy = { records, status: status() };
    const projected = projectV2Dataset(legacy);

    assert.equal(legacy.records.length, 3);
    assert.deepEqual(
      projected.records.map((record) => record.launch.modelId),
      ["classic", "custom-hook"],
    );
    assert.deepEqual(projected.status.counts, {
      total: 2,
      classic: 1,
      custom: 1,
    });
  });

  test("uses exact terminal labels and evidence bases", () => {
    const projected = projectV2Dataset({
      records: [
        internalRecord(classic, "0002"),
        internalRecord(registeredCustom, "0001"),
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
        {
          namespace: "programmable",
          category: "custom",
          label: "Programmable Custom",
          basis: "programmable-custom-registry-event",
        },
      ],
    );
  });

  test("serves a version 2 feed envelope", () => {
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
  });

  test("keeps Custom prelaunch until a registry is published", async () => {
    const manifest = await developerManifestV2();
    const publicStatus = serviceStatusV2(
      projectV2Dataset({ records: [internalRecord(classic, "0001")], status: status() })
        .status,
    );
    assert.equal(manifest.customRegistry.status, "prelaunch");
    assert.equal(manifest.customRegistry.address, null);
    assert.equal(manifest.deployments.some((item) => item.modelId === "stock-paired"), false);
    assert.equal(publicStatus.custom.status, "prelaunch");
  });

  test("fixtures conform to the version 2 schema", async () => {
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator("launch.schema.json");
    assertValid(validate, classic, "Classic v2 fixture");
    assertValid(validate, registeredCustom, "Custom v2 fixture");
  });
});
