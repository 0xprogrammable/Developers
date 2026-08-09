import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { describe, test } from "node:test";
import path from "node:path";

import { verifyLaunchStamp } from "../examples/verify-launch-stamp.mjs";
import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";
import { keccak256 } from "../server/keccak.js";

const MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  "deployments/ethereum-v2.json",
);
const FIXTURE_PATH = path.join(
  REPOSITORY_ROOT,
  "fixtures/v2/launch-stamp/prelaunch.json",
);
const ABI_PATH = path.join(
  REPOSITORY_ROOT,
  "abis/ethereum/programmable-launch-stamp-router-v1.json",
);
const FROZEN_ARTIFACT_PATH =
  process.env.PROGRAMMABLE_LAUNCH_STAMP_ROUTER_ARTIFACT ??
  path.resolve(
    REPOSITORY_ROOT,
    "../programmable-launch-stamp-router-main-20260809/out/ProgrammableLaunchStampRouterV1.sol/ProgrammableLaunchStampRouterV1.json",
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
    assert.equal(router.artifact.artifactSha256, undefined);
    assert.deepEqual(router.enumValues.launchKind, {
      invalid: 0,
      customGraph: 1,
      classic: 2,
    });
    assert.deepEqual(router, fixture);

    for (const value of [
      router.address,
      router.startBlock,
      router.endBlock,
      router.runtimeCodeHash,
      router.finalityConfirmations,
      ...Object.values(router.bindings),
    ]) {
      assert.equal(value, null, "prelaunch deployment value must remain null");
    }
    assert.match(router.abiSha256, /^sha256:[0-9a-f]{64}$/);
    assert.match(router.atomicSelector, /^0x[0-9a-f]{8}$/);
    assert.ok(Object.values(router.events).every(Boolean));
    assert.ok(Object.values(router.getters).every(Boolean));
  });

  test("fails deployment activation closed in the v2 manifest schema", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const schemas = await createSchemaRegistry("v2");
    const validate = schemas.validator("manifest.schema.json");

    assertValid(validate, manifest, "launchStampRouter manifest");

    const falseLive = structuredClone(manifest);
    falseLive.launchStampRouter.status = "live";
    assert.equal(
      validate(falseLive),
      false,
      "live Router requires complete deployment evidence",
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

    for (const mutate of [
      (router) => {
        router.abiSha256 = `sha256:${"1".repeat(64)}`;
      },
      (router) => {
        router.atomicSelector = "0x11111111";
      },
      (router) => {
        router.events.launchStamped.topic0 = `0x${"1".repeat(64)}`;
      },
      (router) => {
        router.events.launchRouteStamped.indexedInputs = ["launchId"];
      },
      (router) => {
        router.getters.stampProof.selector = "0x11111111";
      },
      (router) => {
        router.enumValues.launchKind.classic = 1;
      },
    ]) {
      const interfaceDrift = structuredClone(manifest);
      mutate(interfaceDrift.launchStampRouter);
      assert.equal(
        validate(interfaceDrift),
        false,
        "frozen Router interface drift must fail schema validation",
      );
    }
  });

  test("binds the published ABI, selectors, topics, tuples and enums", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const router = manifest.launchStampRouter;
    const source = await readFile(ABI_PATH);
    const abi = JSON.parse(source);
    const sha256 = `sha256:${createHash("sha256").update(source).digest("hex")}`;

    assert.equal(sha256, router.abiSha256);
    await assert.rejects(
      access(
        path.join(
          REPOSITORY_ROOT,
          "abis/ethereum/programmable-launch-stamp-v1.json",
        ),
      ),
      { code: "ENOENT" },
    );

    for (const descriptor of Object.values(router.getters)) {
      const item = abi.find(
        (candidate) =>
          candidate.type === "function" &&
          canonicalSignature(candidate) === descriptor.signature,
      );
      assert.ok(item, descriptor.signature);
      assert.equal(selectorOf(item), descriptor.selector, descriptor.signature);
    }

    for (const descriptor of Object.values(router.events)) {
      const item = abi.find(
        (candidate) =>
          candidate.type === "event" &&
          canonicalSignature(candidate) === descriptor.signature,
      );
      assert.ok(item, descriptor.signature);
      assert.equal(topicOf(item), descriptor.topic0, descriptor.signature);
      assert.deepEqual(
        item.inputs.filter(({ indexed }) => indexed).map(({ name }) => name),
        descriptor.indexedInputs,
      );
    }

    const atomic = abi.find(
      (item) => item.type === "function" && item.name === "launchAndStampV1",
    );
    assert.ok(atomic);
    assert.equal(canonicalSignature(atomic), router.atomicSignature);
    assert.equal(selectorOf(atomic), router.atomicSelector);
    assert.equal(atomic.stateMutability, "payable");
    assert.deepEqual(
      abi
        .filter((item) => item.type === "function" && item.stateMutability === "payable")
        .map(({ name }) => name),
      ["launchAndStampV1"],
    );
    assert.equal(
      abi.some((item) => item.type === "function" && item.name === "launchIdByHook"),
      false,
    );

    const record = abi.find(
      (item) => item.type === "function" && item.name === "launchStamp",
    );
    assert.deepEqual(
      record.outputs[0].components.map(({ name, type }) => [name, type]),
      [
        ["kind", "uint8"],
        ["launchWallet", "address"],
        ["token", "address"],
        ["hook", "address"],
        ["poolManager", "address"],
        ["poolId", "bytes32"],
        ["poolKeyHash", "bytes32"],
        ["componentSetHash", "bytes32"],
        ["routePayloadHash", "bytes32"],
        ["routeLauncher", "address"],
        ["routeLauncherRuntimeCodeHash", "bytes32"],
        ["expectedResultHash", "bytes32"],
        ["permitDigest", "bytes32"],
        ["stampHash", "bytes32"],
      ],
    );

    const proof = abi.find(
      (item) => item.type === "function" && item.name === "stampProof",
    );
    assert.deepEqual(
      proof.outputs.map(({ name, type }) => [name, type]),
      [
        ["launchId", "bytes32"],
        ["stampHash", "bytes32"],
      ],
    );
    assert.equal(
      keccakText(router.eip712.permitType),
      router.eip712.permitTypeHash,
    );
  });

  test("matches the exact frozen Forge artifact when available", async (context) => {
    try {
      await access(FROZEN_ARTIFACT_PATH);
    } catch (error) {
      if (error?.code === "ENOENT") {
        context.skip("frozen Forge artifact is not present in this checkout");
        return;
      }
      throw error;
    }

    const manifest = await readJson(MANIFEST_PATH);
    const artifactSource = await readFile(FROZEN_ARTIFACT_PATH);
    const artifact = JSON.parse(artifactSource);
    const publishedAbi = await readJson(ABI_PATH);
    assert.deepEqual(publishedAbi, artifact.abi);
    for (const [signature, value] of Object.entries(artifact.methodIdentifiers)) {
      const item = publishedAbi.find(
        (candidate) =>
          candidate.type === "function" &&
          canonicalSignature(candidate) === signature,
      );
      assert.ok(item, signature);
      assert.equal(selectorOf(item), `0x${value}`, signature);
    }
  });

  test("documents the deterministic terminal algorithm and exact scope", async () => {
    const guide = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/launch-stamp.md"),
      "utf8",
    );
    const manifest = await readJson(MANIFEST_PATH);
    const router = manifest.launchStampRouter;

    assert.match(guide, /future Programmable Classic launches/i);
    assert.match(guide, /future Programmable Custom launches/i);
    assert.match(guide, /Historical Classic or Custom coins are not backfilled/i);
    assert.match(guide, /same canonical router/i);
    assert.match(guide, /LaunchKindV1\.Invalid.*0/s);
    assert.match(guide, /LaunchKindV1\.CustomGraph.*1/s);
    assert.match(guide, /LaunchKindV1\.Classic.*2/s);
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
    assert.match(guide, /generated container is not tracked/i);
    assert.match(guide, /raw hash is intentionally not a trust field/i);
    assert.doesNotMatch(guide, /Registry lifecycle/i);

    for (const value of [
      router.abiSha256.slice("sha256:".length),
      router.atomicSelector,
      router.eip712.permitType,
      router.eip712.permitTypeHash,
      ...Object.values(router.events).flatMap(({ signature, topic0 }) => [
        signature,
        topic0,
      ]),
      ...Object.values(router.getters).flatMap(({ signature, selector }) => [
        signature,
        selector,
      ]),
    ]) {
      assert.ok(guide.includes(value), `guide must publish ${value}`);
    }
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
      assert.match(example, /stampProof/);
      assert.doesNotMatch(example, /customRegistry\.launchStamp/);
      assert.doesNotMatch(example, /launchIdByHook/);
      assert.doesNotMatch(example, /launchState\(/);
      assert.doesNotMatch(example, /0x[0-9a-fA-F]{40}/);
    }
  });

  test("returns unavailable from the published prelaunch fixture without RPC access", async () => {
    const manifest = await readJson(FIXTURE_PATH);
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      if (request.url === "/discovery.json") {
        const { port } = server.address();
        response.end(
          JSON.stringify({
            manifestUrl: `http://127.0.0.1:${port}/manifest.json`,
          }),
        );
        return;
      }
      if (request.url === "/manifest.json") {
        response.end(JSON.stringify({ chainId: 1, launchStampRouter: manifest }));
        return;
      }
      response.statusCode = 404;
      response.end("{}");
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const { port } = server.address();
      const result = await verifyLaunchStamp({
        kind: "token",
        values: ["0x1111111111111111111111111111111111111111"],
        discoveryUrl: `http://127.0.0.1:${port}/discovery.json`,
      });
      assert.deepEqual(result, {
        state: "unavailable",
        reason: "router-prelaunch",
        query: {
          kind: "token",
          values: ["0x1111111111111111111111111111111111111111"],
        },
        claim: "provenance-only",
      });
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

function canonicalSignature(item) {
  return `${item.name}(${(item.inputs ?? []).map(canonicalType).join(",")})`;
}

function canonicalType(input) {
  if (!input.type.startsWith("tuple")) return input.type;
  const suffix = input.type.slice("tuple".length);
  return `(${(input.components ?? []).map(canonicalType).join(",")})${suffix}`;
}

function selectorOf(item) {
  return keccakText(canonicalSignature(item)).slice(0, 10);
}

function topicOf(item) {
  return keccakText(canonicalSignature(item));
}

function keccakText(value) {
  return keccak256(new TextEncoder().encode(value));
}
