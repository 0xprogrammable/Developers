import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";

import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";

describe("launch stamp documentation", () => {
  test("keeps live Registry and prelaunch stamp evidence explicit", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const registry = manifest.customRegistry;
    const stamp = registry.launchStamp;
    const prelaunchFixture = await readJson(
      path.join(REPOSITORY_ROOT, "fixtures/v2/launch-stamp/prelaunch.json"),
    );

    assert.equal(registry.status, "live");
    assert.match(registry.address, /^0x[0-9a-fA-F]{40}$/);
    assert.match(registry.startBlock, /^[0-9]+$/);
    assert.equal(stamp.status, "prelaunch");
    assert.equal(stamp.verificationMode, "canonical-stamp-and-registry");
    assert.equal(stamp.launchIdentityScope, "chain-id+stamp-address+launch-id");
    assert.equal(stamp.provenanceOnly, true);
    assert.equal(stamp.address, null);
    assert.equal(stamp.startBlock, null);
    assert.equal(stamp.contractName, "ProgrammableLaunchStampV1");
    assert.equal(stamp.getters.token.signature, "launchIdByToken(address)");
    assert.equal(stamp.getters.hook.signature, "launchIdByHook(address)");
    assert.equal(stamp.getters.pool.signature, "launchIdByPool(address,bytes32)");
    assert.equal(stamp.getters.component.signature, "launchIdByComponent(address)");
    assert.equal(stamp.lifecycle.contract, "customRegistry");
    assert.deepEqual(stamp.lifecycle.statusCodes, {
      0: "none",
      1: "observed",
      2: "finalized",
      3: "revoked",
    });
    assert.deepEqual(stamp, prelaunchFixture);

    const schema = await createSchemaRegistry("v2");
    assertValid(schema.validator("manifest.schema.json"), manifest, "launch stamp manifest");

    const validate = schema.validator("manifest.schema.json");
    const falseLive = structuredClone(manifest);
    falseLive.customRegistry.launchStamp.status = "live";
    assert.equal(validate(falseLive), false, "live stamp must publish address and start block");

    const falsePrelaunch = structuredClone(manifest);
    falsePrelaunch.customRegistry.launchStamp.address =
      "0x1111111111111111111111111111111111111111";
    assert.equal(validate(falsePrelaunch), false, "prelaunch stamp must keep address null");
  });

  test("binds manifest signatures to the published verification ABI", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const abi = await readJson(
      path.join(
        REPOSITORY_ROOT,
        "abis/ethereum/programmable-launch-stamp-v1.json",
      ),
    );
    const signatures = new Set(
      abi.map((item) => `${item.name}(${item.inputs.map(({ type }) => type).join(",")})`),
    );
    const stamp = manifest.customRegistry.launchStamp;

    assert.ok(signatures.has(stamp.events.launchStamped.signature));
    assert.ok(signatures.has(stamp.events.componentStamped.signature));
    for (const getter of Object.values(stamp.getters)) {
      assert.ok(signatures.has(getter.signature), getter.signature);
    }
  });

  test("documents canonical-address spoof resistance and serverless lookups", async () => {
    const guide = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/launch-stamp.md"),
      "utf8",
    );

    assert.match(guide, /no Programmable API, database, server, SDK, or indexer/i);
    assert.match(guide, /exact canonical stamp address/i);
    assert.match(guide, /storage and logs at another address are not Programmable provenance/i);
    assert.match(guide, /PoolManager \+ PoolId/);
    assert.match(guide, /launchId == bytes32\(0\)/);
    assert.match(guide, /does not by itself establish an audit, safety/i);
    assert.match(guide, /point-in-time launch provenance/i);
    assert.match(guide, /matching proxy shell hash does not prove/i);
    assert.match(guide, /implementation, beacon, admin, upgrade authority/i);
  });

  test("keeps deployment identity out of the copy-paste verifier", async () => {
    const example = await readFile(
      path.join(REPOSITORY_ROOT, "examples/verify-launch-stamp.mjs"),
      "utf8",
    );

    assert.match(example, /discovery\.manifestUrl/);
    assert.match(example, /stamp\.address/);
    assert.match(example, /eth_chainId/);
    assert.match(example, /stamp\.getters\?\.\[kind\]/);
    assert.doesNotMatch(example, /0x[0-9a-fA-F]{40}/);
  });
});
