import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";

import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";

const MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  "deployments/ethereum-v2.json",
);
const FIXTURE_PATH = path.join(
  REPOSITORY_ROOT,
  "fixtures/v2/launch-stamp/prelaunch.json",
);

describe("launch stamp Router documentation", () => {
  test("publishes one top-level future-only Router descriptor", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const fixture = await readJson(FIXTURE_PATH);
    const router = manifest.launchStampRouter;

    assert.ok(router, "top-level launchStampRouter is required");
    assert.equal(manifest.customRegistry.launchStamp, undefined);
    assert.equal(router.status, "prelaunch");
    assert.equal(router.scope, "future-launches-only");
    assert.equal(router.supportsFutureClassic, true);
    assert.equal(router.supportsFutureCustom, true);
    assert.equal(router.supportsHistoricalLaunches, false);
    assert.equal(router.verificationMode, "canonical-router");
    assert.equal(router.launchIdentityScope, "chain-id+router-address+launch-id");
    assert.equal(router.provenanceOnly, true);
    assert.equal(router.contractName, "ProgrammableLaunchStampRouterV1");
    assert.equal(router.authorityMode, "eip-1271-contract-only");
    assert.equal(router.canonicalReadBlock, "finalized-or-explicit-canonical-block");
    assert.deepEqual(router, fixture);

    for (const value of [
      router.address,
      router.startBlock,
      router.endBlock,
      router.runtimeCodeHash,
      router.abiSha256,
      router.finalityConfirmations,
      router.atomicSelector,
      ...Object.values(router.bindings),
      ...Object.values(router.events),
      ...Object.values(router.getters),
    ]) {
      assert.equal(value, null, "prelaunch activation value must remain null");
    }
  });

  test("fails activation closed in the v2 manifest schema", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const schemas = await createSchemaRegistry("v2");
    const validate = schemas.validator("manifest.schema.json");

    assertValid(validate, manifest, "launchStampRouter manifest");

    const falseLive = structuredClone(manifest);
    falseLive.launchStampRouter.status = "live";
    assert.equal(
      validate(falseLive),
      false,
      "live Router requires a complete activation descriptor",
    );

    for (const mutate of [
      (router) => {
        router.address = "0x1111111111111111111111111111111111111111";
      },
      (router) => {
        router.startBlock = "1";
      },
      (router) => {
        router.runtimeCodeHash = `0x${"1".repeat(64)}`;
      },
      (router) => {
        router.bindings.permitAuthority =
          "0x1111111111111111111111111111111111111111";
      },
    ]) {
      const falsePrelaunch = structuredClone(manifest);
      mutate(falsePrelaunch.launchStampRouter);
      assert.equal(
        validate(falsePrelaunch),
        false,
        "prelaunch Router cannot carry partial deployment evidence",
      );
    }
  });

  test("documents the deterministic terminal algorithm and scope", async () => {
    const guide = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/launch-stamp.md"),
      "utf8",
    );

    assert.match(guide, /future Programmable Classic launches/i);
    assert.match(guide, /future Programmable Custom launches/i);
    assert.match(guide, /Historical Classic or Custom coins are not backfilled/i);
    assert.match(guide, /same canonical router/i);
    assert.match(guide, /LaunchKindV1\.Classic/);
    assert.match(guide, /LaunchKindV1\.CustomGraph/);
    assert.match(guide, /Classic hook is shared/i);
    assert.match(guide, /chainId \+ Router address \+ launchId/i);
    assert.match(guide, /finalized block or a caller-supplied canonical block/i);
    assert.match(guide, /same concrete block/i);
    assert.match(guide, /exact manifest router address/i);
    assert.match(guide, /correct topic from any other emitter is not Programmable provenance/i);
    assert.match(guide, /PoolManager \+ PoolId/);
    assert.match(guide, /Direct calls to the Classic V3 Factory or Graph Factory outside the router/i);
    assert.match(guide, /Single Factory is outside Router V1/i);
    assert.match(guide, /no EOA authority fallback/i);
    assert.match(guide, /proxy or beacon/i);
    assert.match(guide, /does not state that a contract is audited, safe, liquid, sellable/i);
    assert.match(guide, /Custom Registry, hosted launch feed, an indexer, Supabase/i);
    assert.doesNotMatch(guide, /Registry lifecycle/i);
  });

  test("keeps deployment identity out of both verifier examples", async () => {
    for (const relative of [
      "examples/verify-launch-stamp.mjs",
      "examples/verify-launch-stamp-viem.ts",
    ]) {
      const example = await readFile(path.join(REPOSITORY_ROOT, relative), "utf8");
      assert.match(example, /launchStampRouter/);
      assert.match(example, /eth_chainId|chainId/);
      assert.match(example, /finalized/i);
      assert.match(example, /runtimeCodeHash/);
      assert.doesNotMatch(example, /customRegistry\.launchStamp/);
      assert.doesNotMatch(example, /launchState\(/);
      assert.doesNotMatch(example, /0x[0-9a-fA-F]{40}/);
    }
  });
});
