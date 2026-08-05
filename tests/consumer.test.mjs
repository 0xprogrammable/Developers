import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";
import {
  cloneJson,
  listFiles,
  readJson,
  REPOSITORY_ROOT,
} from "../scripts/lib/files.mjs";
import {
  discoverDeploymentAddresses,
  terminalRow,
} from "../scripts/lib/consumer.mjs";

describe("terminal consumer contract", () => {
  test("never upgrades an unknown category or platform identity to Programmable Custom", async () => {
    const fixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches/classic-v4-pool.json"),
    );
    fixture.platformId = "untrusted";
    fixture.category = "future-category";
    const row = terminalRow(fixture);
    assert.equal(row.platformId, null);
    assert.equal(row.category, "Unrecognized");
  });

  test("renders Classic, no-market Custom, contract-market Custom, and unknown future Custom", async () => {
    const launchFiles = await listFiles(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches"),
      (file) => file.endsWith(".json"),
    );
    const launches = [];
    for (const file of launchFiles) launches.push(await readJson(file));
    launches.sort((left, right) => left.launchId.localeCompare(right.launchId));

    const expected = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/expected/terminal-rows.json"),
    );
    expected.sort((left, right) => left.launchId.localeCompare(right.launchId));
    assert.deepEqual(launches.map(terminalRow), expected);
  });

  test("keeps a token visible when it has no market", async () => {
    const launch = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v1/launches/custom-no-market-prelaunch.json"),
    );
    const row = terminalRow(launch);
    assert.equal(row.category, "Programmable Custom");
    assert.equal(row.marketCount, 0);
    assert.equal(row.hasActiveMarket, false);
  });

  test("represents multiple, delayed, paused, and unknown non-pool markets together", async () => {
    const launch = await readJson(
      path.join(
        REPOSITORY_ROOT,
        "fixtures/v1/launches/custom-multiple-markets-prelaunch.json",
      ),
    );
    const row = terminalRow(launch);
    assert.equal(row.marketCount, 3);
    assert.deepEqual(
      launch.markets.map((market) => market.status),
      ["planned", "paused", "planned"],
    );
    assert.deepEqual(row.unsupportedMarketKinds, ["geospatial-game-market"]);
    assert.ok(row.capabilityIds.includes("delayed-market-activation"));
  });

  test("keeps dynamic supply, burn, and game rewards independent from trading markets", async () => {
    const dynamic = await readJson(
      path.join(
        REPOSITORY_ROOT,
        "fixtures/v1/launches/custom-dynamic-supply-burn-prelaunch.json",
      ),
    );
    const game = await readJson(
      path.join(
        REPOSITORY_ROOT,
        "fixtures/v1/launches/custom-game-rewards-prelaunch.json",
      ),
    );
    assert.equal(dynamic.token.totalSupplyRaw, null);
    assert.equal(dynamic.token.supplyStatus, "unavailable");
    assert.equal(dynamic.markets.length, 0);
    assert.ok(terminalRow(dynamic).capabilityIds.includes("sell-triggered-burn"));
    assert.equal(game.markets.length, 0);
    assert.ok(terminalRow(game).capabilityIds.includes("kill-to-earn"));
  });

  test("discovers newly appended deployments without changing consumer code", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum.json"),
    );
    const original = discoverDeploymentAddresses(manifest);
    const expanded = cloneJson(manifest);
    expanded.deployments.push({
      ...expanded.deployments.at(-1),
      deploymentId: "future-custom-v99",
      contracts: {
        launcher: "0xabababababababababababababababababababab",
      },
    });
    const next = discoverDeploymentAddresses(expanded);
    assert.equal(original.includes("0xabababababababababababababababababababab"), false);
    assert.equal(next.includes("0xabababababababababababababababababababab"), true);
    assert.equal(next.length, original.length + 1);
  });
});
