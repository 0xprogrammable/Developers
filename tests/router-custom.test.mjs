import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import path from "node:path";

import { launchFeedPayload } from "../api/v2/launches.js";
import { tokenListPayload } from "../api/v2/token-list.js";
import { canonicalSha256 } from "../server/canonical.js";
import {
  feedStatusV2,
  isV2PublicLaunch,
  isV2DatasetPublishable,
  mergeRouterCustomRecords,
  projectV2Dataset,
  publicLaunchV2,
  serviceStatusV2,
} from "../server/v2-dataset.js";
import {
  createRouterCustomAcceptedMembership,
  FINALIZED_CUSTOM_METADATA_SOURCE_URL,
  hasExactRouterStampedCustomRecordShape,
  isRouterStampedCustom,
  readRouterCustomRecords,
  resetRouterCustomCacheForTest,
  ROUTER_CUSTOM_SOURCE_URL,
} from "../server/router-custom.js";
import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import {
  assertValid,
  createSchemaRegistry,
} from "../scripts/lib/schema.mjs";
import { validateLaunchSemantics } from "../scripts/lib/semantics.mjs";

const registry = await createSchemaRegistry("v2");
const manifest = await readJson(
  path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
);
const bundledSource = await readJson(
  path.join(REPOSITORY_ROOT, "snapshots/router-custom-identities.v1.json"),
);
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetRouterCustomCacheForTest();
});

function canonicalSourceEntry(entry) {
  const proof = {
    launchId: entry.launchId,
    stampHash: entry.stampHash,
  };
  const provenance = {
    schemaVersion: "programmable.launch-stamp-provenance.v1",
    kind: "custom-graph",
    chainId: 1,
    routerAddress: entry.routerAddress,
    routerRuntimeCodeHash: entry.routerRuntimeCodeHash,
    routerStartBlock: entry.routerStartBlock,
    finalityConfirmations: entry.finalityConfirmations,
    finalizedAtBlockNumber: entry.finalizedAtBlockNumber,
    launchId: entry.launchId,
    stampHash: entry.stampHash,
    transactionHash: entry.transactionHash,
    blockNumber: entry.blockNumber,
    blockHash: entry.blockHash,
    transactionIndex: entry.transactionIndex,
    launchLogIndex: entry.logIndex,
    launchWallet: entry.launchWallet,
    tokenProof: { ...proof, tokenAddress: entry.tokenAddress },
    poolId: entry.poolId,
    poolManagerAddress: entry.poolManagerAddress,
    poolProof: {
      ...proof,
      poolId: entry.poolId,
      poolManagerAddress: entry.poolManagerAddress,
    },
    poolKey: { hooks: entry.hookAddress },
    routeLauncherAddress: entry.routeLauncherAddress,
    routeLauncherRuntimeCodeHash: entry.routeLauncherRuntimeCodeHash,
    components: [
      {
        kind: "token",
        scope: "exclusive",
        address: entry.tokenAddress,
        exclusiveProof: proof,
      },
      {
        kind: "hook",
        scope: "exclusive",
        address: entry.hookAddress,
        exclusiveProof: proof,
      },
    ],
  };
  return {
    id: `1:${entry.tokenAddress.toLowerCase()}`,
    exploreKind: "token",
    tokenAddress: entry.tokenAddress,
    name: entry.tokenName,
    symbol: entry.tokenSymbol,
    tokenDecimals: entry.tokenDecimals,
    creatorAddress: entry.launchWallet,
    hookAddress: entry.hookAddress,
    poolId: entry.poolId,
    launchTransactionHash: entry.transactionHash,
    launchBlockNumber: entry.blockNumber,
    launchTransactionIndex: entry.transactionIndex,
    launchLogIndex: entry.logIndex,
    launchedAt: entry.launchedAt,
    launchModel: "custom-graph",
    launchModelVersion: "programmable-launch-stamp-router-v1",
    liquidityPath: "programmable-v4",
    totalSwapFeeBps: null,
    launchStampProvenance: provenance,
    launchCategoryProvenance: {
      schemaVersion: "programmable.explore-launch-category-provenance.v1",
      category: "custom",
      source: "canonical-launch-stamp-router",
      launchId: entry.launchId,
      stampHash: entry.stampHash,
      routerAddress: entry.routerAddress,
      transactionHash: entry.transactionHash,
      blockHash: entry.blockHash,
      blockNumber: entry.blockNumber,
      transactionIndex: entry.transactionIndex,
      logIndex: entry.logIndex,
    },
  };
}

function currentSourcePayload() {
  const entries = bundledSource.entries
    .map(canonicalSourceEntry)
    .sort((left, right) =>
      BigInt(left.launchBlockNumber) < BigInt(right.launchBlockNumber) ? -1 : 1);
  const next = {
    ...bundledSource.entries[0],
    finalizedAtBlockNumber: "25833390",
    launchId: `0x${"a".repeat(64)}`,
    stampHash: `0x${"b".repeat(64)}`,
    transactionHash: `0x${"c".repeat(64)}`,
    blockNumber: "25833320",
    blockHash: `0x${"d".repeat(64)}`,
    transactionIndex: 1,
    logIndex: 2,
    launchedAt: "2026-08-25T16:30:00.000Z",
    tokenAddress: "0x1111111111111111111111111111111111111111",
    tokenName: "Next Router Token",
    tokenSymbol: "NEXT",
    hookAddress: "0x2222222222222222222222222222222222222222",
    poolId: `0x${"e".repeat(64)}`,
  };
  entries.push(canonicalSourceEntry(next));
  const payload = {
    schemaVersion: "programmable.router-custom-identity-snapshot.v1",
    source: "canonical-launch-stamp-router",
    status: "current",
    generatedAt: "2026-08-25T16:31:00.000Z",
    asOfBlock: "25833400",
    asOfBlockHash: `0x${"f".repeat(64)}`,
    finalityConfirmations: 64,
    identityCommitment: null,
    entries,
  };
  payload.identityCommitment = canonicalSha256(payload.schemaVersion, {
    chainId: 1,
    source: payload.source,
    asOfBlock: payload.asOfBlock,
    asOfBlockHash: payload.asOfBlockHash,
    finalityConfirmations: payload.finalityConfirmations,
    entries: payload.entries,
  });
  return payload;
}

function recommitSourcePayload(payload) {
  payload.identityCommitment = canonicalSha256(payload.schemaVersion, {
    chainId: 1,
    source: payload.source,
    asOfBlock: payload.asOfBlock,
    asOfBlockHash: payload.asOfBlockHash,
    finalityConfirmations: payload.finalityConfirmations,
    entries: payload.entries,
  });
  return payload;
}

function finalizedMetadataPayload(entry, chainPayload) {
  const provenance = entry.launchStampProvenance;
  const projectMetadata = {
    schemaVersion: "programmable.project-metadata.v1",
    token: { name: entry.name, symbol: entry.symbol },
    presentation: {
      schemaVersion: "programmable.launch-presentation-draft.v1",
      description: "A canonical Router launch with exact creator-declared metadata.",
      image: {
        uri: "https://example.com/next.png",
        contentSha256: `sha256:${"1".repeat(64)}`,
        mediaType: "image/png",
        byteLength: 1_024,
        width: 512,
        height: 512,
      },
      links: [
        { kind: "website", uri: "https://example.com/" },
        { kind: "x", uri: "https://x.com/example" },
      ],
    },
    tokenMetadataBinding: {
      schemaVersion: "programmable.project-token-metadata-binding.v1",
      tokenTargetId: "token",
      declarationBinding: "request-and-launch-id",
      standardReadModel: { name: true, symbol: true },
      name: {
        staticSource: "constructor-argument",
        argumentIndex: 0,
        argumentName: "name_",
      },
      symbol: {
        staticSource: "constructor-argument",
        argumentIndex: 1,
        argumentName: "symbol_",
      },
      postDeploymentReadback: "required",
    },
  };
  const checkpoint = {
    schemaVersion: "programmable.ethereum-finalized-checkpoint-quorum.v1",
    blockNumber: chainPayload.asOfBlock,
    blockHash: chainPayload.asOfBlockHash,
    quorumSize: 2,
    observations: ["primary", "secondary"].map((provider) => ({
      provider,
      finalizedBlockNumber: chainPayload.asOfBlock,
      finalizedBlockHash: chainPayload.asOfBlockHash,
      commonBlockHash: chainPayload.asOfBlockHash,
    })),
  };
  return {
    schemaVersion: "programmable.finalized-custom-launch-metadata-list.v1",
    generatedAt: chainPayload.generatedAt,
    launches: [{
      schemaVersion: "programmable.finalized-custom-launch-metadata.v1",
      resourceId: "123e4567-e89b-42d3-a456-426614174000",
      routerLaunchId: provenance.launchId,
      chainId: "1",
      router: provenance.routerAddress,
      token: entry.tokenAddress,
      hook: entry.hookAddress,
      poolManager: provenance.poolManagerAddress,
      poolId: entry.poolId,
      projectMetadata,
      projectMetadataHash: canonicalSha256(
        "programmable.project-metadata.v1",
        projectMetadata,
      ),
      bindings: {
        requestHash: `sha256:${"2".repeat(64)}`,
        launchIntentHash: `sha256:${"3".repeat(64)}`,
        graphBundleHash: `sha256:${"4".repeat(64)}`,
        unboundGraphBundleHash: `sha256:${"5".repeat(64)}`,
        artifactHash: `sha256:${"6".repeat(64)}`,
      },
      tokenMetadataReadback: {
        status: "matching",
        declared: { name: entry.name, symbol: entry.symbol },
        observed: { name: entry.name, symbol: entry.symbol },
        observedAtBlockNumber: chainPayload.asOfBlock,
        observedAt: chainPayload.generatedAt,
      },
      finality: {
        state: "finalized",
        transactionHash: provenance.transactionHash,
        blockNumber: provenance.blockNumber,
        blockHash: provenance.blockHash,
        logIndex: provenance.launchLogIndex,
        confirmationDepth: String(
          BigInt(chainPayload.asOfBlock) - BigInt(provenance.blockNumber),
        ),
        requiredConfirmationDepth: String(provenance.finalityConfirmations),
        finalizedCheckpoint: checkpoint,
      },
      createdAt: "2026-08-25T16:29:00.000Z",
      finalizedAt: chainPayload.generatedAt,
    }],
    nextCursor: null,
    quality: {
      status: "complete",
      sourceRowCount: 1,
      publishedRowCount: 1,
      quarantinedRowCount: 0,
      diagnostics: [],
    },
  };
}

function quantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function word(value) {
  if (typeof value === "number" || typeof value === "bigint") {
    return BigInt(value).toString(16).padStart(64, "0");
  }
  assert.equal(typeof value, "string");
  const raw = value.startsWith("0x") ? value.slice(2) : value;
  assert.match(raw, /^[0-9a-f]+$/i);
  return raw.toLowerCase().padStart(64, "0");
}

function rpcIdentity(entry) {
  const provenance = entry.launchStampProvenance;
  return {
    launchId: provenance.launchId.toLowerCase(),
    stampHash: provenance.stampHash.toLowerCase(),
    transactionHash: provenance.transactionHash.toLowerCase(),
    blockNumber: provenance.blockNumber,
    blockHash: provenance.blockHash.toLowerCase(),
    transactionIndex: provenance.transactionIndex,
    logIndex: provenance.launchLogIndex,
    launchedAt: entry.launchedAt,
    launchWallet: provenance.launchWallet,
    tokenAddress: entry.tokenAddress,
    hookAddress: entry.hookAddress,
    poolManagerAddress: provenance.poolManagerAddress,
    poolId: provenance.poolId,
    routeLauncherAddress: provenance.routeLauncherAddress,
    routeLauncherRuntimeCodeHash: provenance.routeLauncherRuntimeCodeHash,
  };
}

function launchLog(identity) {
  return {
    address: manifest.launchStampRouter.address,
    topics: [
      manifest.launchStampRouter.events.launchStamped.topic0,
      identity.launchId,
      `0x${word(identity.tokenAddress)}`,
      `0x${word(identity.hookAddress)}`,
    ],
    data: `0x${[
      identity.poolManagerAddress,
      identity.poolId,
      identity.stampHash,
    ].map(word).join("")}`,
    blockNumber: quantity(identity.blockNumber),
    blockHash: identity.blockHash,
    transactionHash: identity.transactionHash,
    transactionIndex: quantity(identity.transactionIndex),
    logIndex: quantity(identity.logIndex),
    removed: false,
  };
}

function stampRecord(identity) {
  return `0x${[
    1,
    identity.launchWallet,
    identity.tokenAddress,
    identity.hookAddress,
    identity.poolManagerAddress,
    identity.poolId,
    `0x${"1".repeat(64)}`,
    `0x${"2".repeat(64)}`,
    `0x${"3".repeat(64)}`,
    identity.routeLauncherAddress,
    identity.routeLauncherRuntimeCodeHash,
    `0x${"4".repeat(64)}`,
    `0x${"5".repeat(64)}`,
    identity.stampHash,
  ].map(word).join("")}`;
}

function serveSource(payload, options = {}) {
  const chainPayload = options.chainPayload ?? currentSourcePayload();
  const identities = chainPayload.entries.map(rpcIdentity);
  const byLaunch = new Map(identities.map((entry) => [entry.launchId, entry]));
  const next = identities.find((entry) =>
    BigInt(entry.blockNumber) > BigInt(bundledSource.asOfBlock));
  assert.ok(next);
  globalThis.fetch = async (url, init = {}) => {
    if (String(url) === ROUTER_CUSTOM_SOURCE_URL) {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).startsWith(FINALIZED_CUSTOM_METADATA_SOURCE_URL)) {
      return options.finalizedMetadata
        ? new Response(JSON.stringify(options.finalizedMetadata), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        : new Response("unavailable", { status: 503 });
    }
    const request = JSON.parse(String(init.body));
    const [first, second] = request.params ?? [];
    let result;
    if (request.method === "eth_getBlockByNumber") {
      if (first === "finalized") {
        result = {
          number: quantity(chainPayload.asOfBlock),
          hash: chainPayload.asOfBlockHash,
          timestamp: quantity(Date.parse(chainPayload.generatedAt) / 1_000),
        };
      } else {
        const blockNumber = Number(BigInt(first));
        const identity = identities.find((entry) =>
          Number(entry.blockNumber) === blockNumber);
        const isSourceBoundary = blockNumber === Number(payload.asOfBlock);
        result = {
          number: first,
          hash: identity?.blockHash ?? (
            isSourceBoundary ? payload.asOfBlockHash : chainPayload.asOfBlockHash
          ),
          timestamp: quantity(identity
            ? Date.parse(identity.launchedAt) / 1_000
            : Date.parse(payload.generatedAt) / 1_000),
        };
      }
    } else if (request.method === "eth_blockNumber") {
      result = quantity(Number(chainPayload.asOfBlock) + 10);
    } else if (request.method === "eth_chainId") {
      result = "0x1";
    } else if (request.method === "eth_getLogs") {
      const fromBlock = Number(BigInt(first.fromBlock));
      const toBlock = Number(BigInt(first.toBlock));
      result = Number(next.blockNumber) >= fromBlock &&
        Number(next.blockNumber) <= toBlock
        ? [launchLog(next)]
        : [];
    } else if (request.method === "eth_getTransactionReceipt") {
      const identity = identities.find((entry) =>
        entry.transactionHash === String(first).toLowerCase());
      result = identity ? {
        status: options.receiptStatus ?? "0x1",
        to: manifest.launchStampRouter.address,
        transactionHash: identity.transactionHash,
        blockNumber: quantity(identity.blockNumber),
        blockHash: identity.blockHash,
        transactionIndex: quantity(identity.transactionIndex),
        logs: [launchLog(identity)],
      } : null;
    } else if (request.method === "eth_call") {
      const data = first.data.toLowerCase();
      if (data.startsWith(manifest.launchStampRouter.getters.record.selector)) {
        const identity = byLaunch.get(`0x${data.slice(-64)}`);
        assert.ok(identity);
        result = stampRecord(identity);
      } else if (data.startsWith(manifest.launchStampRouter.getters.token.selector)) {
        const address = `0x${data.slice(-40)}`;
        result = identities.find((entry) =>
          entry.tokenAddress.toLowerCase() === address)?.launchId ??
          `0x${"0".repeat(64)}`;
      } else if (data.startsWith(
        manifest.launchStampRouter.getters.stampProof.selector,
      )) {
        const address = `0x${data.slice(-40)}`;
        const identity = identities.find((entry) =>
          entry.tokenAddress.toLowerCase() === address);
        result = identity
          ? `0x${word(identity.launchId)}${word(identity.stampHash)}`
          : `0x${"0".repeat(128)}`;
      } else {
        assert.fail(`unexpected eth_call ${data.slice(0, 10)}`);
      }
      assert.ok(second);
    } else {
      assert.fail(`unexpected RPC method ${request.method}`);
    }
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      result,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

async function fallbackRecords() {
  resetRouterCustomCacheForTest();
  globalThis.fetch = async () => {
    throw new Error("current Router source unavailable in fixture");
  };
  return readRouterCustomRecords(manifest);
}

describe("Router Custom v2 projection", () => {
  test("keeps the bounded PCAN and FADE identities when live enrichment is unavailable", async () => {
    const snapshot = await fallbackRecords();
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
    assert.deepEqual(
      snapshot.records.map((record) => record.token.symbol),
      ["FADE", "PCAN"],
    );
    assert.deepEqual(
      snapshot.records.map((record) => record.token.address.toLowerCase()),
      [
        "0x69d278968abf120f878f2e1e016ab615d3686c19",
        "0x9deeb39d2590b0cad5fc473f755c5f97dcc8f7ce",
      ],
    );
    assert.equal(
      ROUTER_CUSTOM_SOURCE_URL,
      "https://programmable.market/api/indexers/v1/router-custom-identities",
    );
    assert.equal(
      snapshot.snapshotSha256,
      "sha256:25f47a745c4704af13787340dc855ad13a9e3eb12023352c88b0befc2d93d771",
    );
  });

  test("accepts a complete snapshot only with exact finalized Router evidence", async () => {
    const payload = currentSourcePayload();
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "current");
    assert.equal(snapshot.verifiedIdentityCount, 3);
    assert.ok(snapshot.records.some((record) => record.token.symbol === "NEXT"));
    const projected = projectV2Dataset({
      records: snapshot.records,
      status: {
        status: "ready",
        generatedAt: payload.generatedAt,
        chainId: 1,
        coverage: {
          status: "complete",
          checkpoint: {
            blockNumber: 25833400,
            blockHash: payload.asOfBlockHash,
            finality: "finalized",
          },
        },
      },
    }, manifest);
    assert.equal(projected.records.length, 3);
    const currentRecord = publicLaunchV2(projected.records.find((record) =>
      record.token.symbol === "NEXT"));
    assert.deepEqual(validateLaunchSemantics(currentRecord), []);
    const acceptedRouterCustomMembership =
      createRouterCustomAcceptedMembership(snapshot.records, manifest);
    const transportedRecord = JSON.parse(JSON.stringify(currentRecord));
    assert.equal(isRouterStampedCustom(transportedRecord, manifest), false);
    assert.ok(validateLaunchSemantics(transportedRecord).some((finding) =>
      finding.code === "FEE_POLICY_REQUIRED"));
    assert.deepEqual(validateLaunchSemantics(transportedRecord, {
      acceptedRouterCustomMembership,
    }), []);

    const forgedMembership = structuredClone(transportedRecord);
    forgedMembership.extensions["programmable/router-stamp-v1"]
      .sourceIdentityCommitment = `sha256:${"1".repeat(64)}`;
    assert.equal(
      hasExactRouterStampedCustomRecordShape(forgedMembership),
      true,
      "the adversarial record remains shape-valid",
    );
    assert.ok(validateLaunchSemantics(forgedMembership, {
      acceptedRouterCustomMembership,
    }).some((finding) => finding.code === "FEE_POLICY_REQUIRED"));
    assert.ok(validateLaunchSemantics(transportedRecord, {
      acceptedRouterCustomMembership: { accepts: () => true },
    }).some((finding) => finding.code === "FEE_POLICY_REQUIRED"));

    transportedRecord.markets[0].hookAddress =
      "0x3333333333333333333333333333333333333333";
    assert.ok(validateLaunchSemantics(transportedRecord).some((finding) =>
      finding.code === "FEE_POLICY_REQUIRED"));
  });

  test("joins creator metadata only through an exact finalized Router identity", async () => {
    const payload = currentSourcePayload();
    const next = payload.entries.find((entry) => entry.symbol === "NEXT");
    assert.ok(next);
    const finalizedMetadata = finalizedMetadataPayload(next, payload);
    serveSource(payload, { finalizedMetadata });

    const snapshot = await readRouterCustomRecords(manifest);
    const raw = snapshot.records.find((record) => record.token.symbol === "NEXT");
    assert.ok(raw);
    assert.equal(raw.token.metadata.description, null);

    const projected = projectV2Dataset({
      records: snapshot.records,
      status: {
        status: "ready",
        generatedAt: payload.generatedAt,
        chainId: 1,
        coverage: {
          status: "complete",
          checkpoint: {
            blockNumber: Number(payload.asOfBlock),
            blockHash: payload.asOfBlockHash,
            finality: "finalized",
          },
        },
      },
    }, manifest);
    const record = publicLaunchV2(projected.records.find((candidate) =>
      candidate.token.symbol === "NEXT"));
    assert.deepEqual(record.token.metadata, {
      description: "A canonical Router launch with exact creator-declared metadata.",
      imageUrl: "https://example.com/next.png",
      links: {
        website: "https://example.com/",
        x: "https://x.com/example",
      },
      trustStatus: "creator-declared",
    });
    assert.equal(
      record.extensions["programmable/finalized-project-metadata-v1"]
        .projectMetadataHash,
      finalizedMetadata.launches[0].projectMetadataHash,
    );
    assert.equal(isRouterStampedCustom(record, manifest), true);
    assertValid(
      registry.validator("launch.schema.json"),
      record,
      "metadata-enriched Router launch",
    );
    assert.deepEqual(validateLaunchSemantics(record), []);

    const membership = createRouterCustomAcceptedMembership(
      snapshot.records,
      manifest,
    );
    const transported = JSON.parse(JSON.stringify(record));
    assert.deepEqual(validateLaunchSemantics(transported, {
      acceptedRouterCustomMembership: membership,
    }), []);
    transported.token.metadata.description = "forged display metadata";
    assert.equal(hasExactRouterStampedCustomRecordShape(transported), false);
    assert.ok(validateLaunchSemantics(transported, {
      acceptedRouterCustomMembership: membership,
    }).some((finding) => finding.code === "FEE_POLICY_REQUIRED"));
  });

  test("keeps Router identity while rejecting invalid metadata quality", async () => {
    const payload = currentSourcePayload();
    const next = payload.entries.find((entry) => entry.symbol === "NEXT");
    assert.ok(next);
    const finalizedMetadata = finalizedMetadataPayload(next, payload);
    finalizedMetadata.quality.publishedRowCount = 0;
    serveSource(payload, { finalizedMetadata });

    const snapshot = await readRouterCustomRecords(manifest);
    const record = publicLaunchV2(snapshot.records.find((candidate) =>
      candidate.token.symbol === "NEXT"));
    assert.ok(record);
    assert.deepEqual(record.token.metadata, {
      description: null,
      imageUrl: null,
      links: null,
      trustStatus: "unavailable",
    });
    assert.equal(isRouterStampedCustom(record, manifest), true);
  });

  test("accepts a cached Router record bound to its feed snapshot", async () => {
    const payload = currentSourcePayload();
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    const record = JSON.parse(JSON.stringify(publicLaunchV2(
      snapshot.records.find((entry) => entry.token.symbol === "NEXT"),
    )));
    const extension = record.extensions["programmable/router-stamp-v1"];
    extension.snapshotSha256 = `sha256:${"1".repeat(64)}`;
    extension.sourceIdentityCommitment = `sha256:${"2".repeat(64)}`;
    extension.snapshotGeneratedAt = "2026-08-25T16:30:30.000Z";
    extension.snapshotAsOfBlock = "25833390";
    extension.snapshotAsOfBlockHash = `0x${"3".repeat(64)}`;
    const transportBoundary = {
      blockNumber: extension.snapshotAsOfBlock,
      blockHash: extension.snapshotAsOfBlockHash,
      finality: "finalized",
      identityCommitment: extension.sourceIdentityCommitment,
    };
    const membership = createRouterCustomAcceptedMembership(
      snapshot.records,
      manifest,
      { transportBoundary },
    );

    assert.deepEqual(validateLaunchSemantics(record, {
      acceptedRouterCustomMembership: membership,
    }), []);

    record.extensions["programmable/router-stamp-v1"]
      .sourceIdentityCommitment = `sha256:${"4".repeat(64)}`;
    assert.ok(validateLaunchSemantics(record, {
      acceptedRouterCustomMembership: membership,
    }).some((finding) => finding.code === "FEE_POLICY_REQUIRED"));
  });

  test("publishes a finalized launch when the source cursor equals its launch block", async () => {
    const payload = currentSourcePayload();
    const next = payload.entries.find((entry) => entry.symbol === "NEXT");
    assert.ok(next);
    payload.asOfBlock = next.launchStampProvenance.blockNumber;
    payload.asOfBlockHash = next.launchStampProvenance.blockHash;
    recommitSourcePayload(payload);
    serveSource(payload);

    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "current");
    assert.equal(snapshot.verifiedIdentityCount, 3);
    const record = snapshot.records.find((entry) =>
      entry.token.symbol === "NEXT");
    assert.ok(record);
    assert.equal(
      record.extensions["programmable/router-stamp-v1"].snapshotAsOfBlock,
      next.launchStampProvenance.blockNumber,
    );
    assert.equal(isRouterStampedCustom(record, manifest), true);
  });

  test("does not treat a valid response self-hash as publication authority", async () => {
    const payload = currentSourcePayload();
    serveSource(payload, { receiptStatus: "0x0" });
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
    assert.ok(!snapshot.records.some((record) => record.token.symbol === "NEXT"));
  });

  test("accepts a pinned identity at a later finality observation", async () => {
    const payload = currentSourcePayload();
    const rehydrated = payload.entries.find((entry) => entry.symbol === "FADE");
    assert.ok(rehydrated);
    rehydrated.launchStampProvenance.finalizedAtBlockNumber = "25833400";
    recommitSourcePayload(payload);
    serveSource(payload);

    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "current");
    assert.equal(snapshot.verifiedIdentityCount, 3);
    assert.equal(
      snapshot.records.find((record) => record.token.symbol === "FADE")
        .extensions["programmable/router-stamp-v1"].finalizedAtBlockNumber,
      "25833400",
    );
  });

  test("allows only monotonic null-to-validated token metadata enrichment", async () => {
    const partial = currentSourcePayload();
    partial.entries.at(-1).name = null;
    partial.entries.at(-1).symbol = null;
    delete partial.entries.at(-1).tokenDecimals;
    recommitSourcePayload(partial);
    serveSource(partial);
    const first = await readRouterCustomRecords(manifest);
    assert.equal(first.status, "current");
    assert.equal(first.records.find((record) =>
      record.launchId === `0x${"a".repeat(64)}`).token.identityStatus, "partial");

    resetRouterCustomCacheForTest({ preserveAcceptedSource: true });
    const enriched = currentSourcePayload();
    serveSource(enriched);
    const second = await readRouterCustomRecords(manifest);
    assert.equal(second.status, "current");
    assert.equal(second.records.find((record) =>
      record.launchId === `0x${"a".repeat(64)}`).token.symbol, "NEXT");

    for (const mutate of [
      (entry) => { entry.name = "Rewritten"; },
      (entry) => { entry.symbol = null; },
      (entry) => { delete entry.tokenDecimals; },
    ]) {
      resetRouterCustomCacheForTest({ preserveAcceptedSource: true });
      const changed = currentSourcePayload();
      mutate(changed.entries.at(-1));
      recommitSourcePayload(changed);
      serveSource(changed);
      const rejected = await readRouterCustomRecords(manifest);
      assert.equal(rejected.status, "last-known-good");
      assert.equal(rejected.records.find((record) =>
        record.launchId === `0x${"a".repeat(64)}`).token.symbol, "NEXT");
    }
  });

  test("rejects an immutable launch-time rewrite", async () => {
    const payload = currentSourcePayload();
    payload.entries[0].launchedAt = "2026-08-25T16:00:00.000Z";
    recommitSourcePayload(payload);
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
  });

  test("keeps every warm accepted finalized identity across later shrink or rewrite", async () => {
    const first = currentSourcePayload();
    serveSource(first);
    const accepted = await readRouterCustomRecords(manifest);
    assert.equal(accepted.status, "current");
    assert.equal(accepted.verifiedIdentityCount, 3);

    const shrunk = currentSourcePayload();
    shrunk.entries.pop();
    shrunk.generatedAt = "2026-08-25T16:32:00.000Z";
    shrunk.asOfBlock = "25833401";
    shrunk.asOfBlockHash = `0x${"1".repeat(64)}`;
    recommitSourcePayload(shrunk);
    resetRouterCustomCacheForTest({ preserveAcceptedSource: true });
    serveSource(shrunk);
    const afterShrink = await readRouterCustomRecords(manifest);
    assert.equal(afterShrink.status, "last-known-good");
    assert.equal(afterShrink.verifiedIdentityCount, 3);
    assert.ok(afterShrink.records.some((record) => record.token.symbol === "NEXT"));

    const rewritten = currentSourcePayload();
    const next = rewritten.entries.at(-1);
    next.hookAddress = "0x3333333333333333333333333333333333333333";
    next.launchStampProvenance.poolKey.hooks = next.hookAddress;
    for (const component of next.launchStampProvenance.components) {
      if (component.kind === "hook") component.address = next.hookAddress;
    }
    rewritten.generatedAt = "2026-08-25T16:33:00.000Z";
    rewritten.asOfBlock = "25833402";
    rewritten.asOfBlockHash = `0x${"2".repeat(64)}`;
    recommitSourcePayload(rewritten);
    resetRouterCustomCacheForTest({ preserveAcceptedSource: true });
    serveSource(rewritten);
    const afterRewrite = await readRouterCustomRecords(manifest);
    assert.equal(afterRewrite.status, "last-known-good");
    assert.equal(afterRewrite.verifiedIdentityCount, 3);
    assert.equal(
      afterRewrite.records.find((record) => record.token.symbol === "NEXT")
        .markets[0].hookAddress,
      "0x2222222222222222222222222222222222222222",
    );
  });

  test("does not accept a finalized suffix shrink after a cold restart", async () => {
    const shrunk = currentSourcePayload();
    shrunk.entries.pop();
    recommitSourcePayload(shrunk);
    serveSource(shrunk);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
  });

  test("rejects a source mutation under an unchanged commitment", async () => {
    const payload = currentSourcePayload();
    payload.entries.at(-1).hookAddress =
      "0x3333333333333333333333333333333333333333";
    payload.entries.at(-1).launchStampProvenance.poolKey.hooks =
      "0x3333333333333333333333333333333333333333";
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
    assert.ok(!snapshot.records.some((record) => record.token.symbol === "NEXT"));
  });

  test("rejects duplicate pool identity even under a recomputed commitment", async () => {
    const payload = currentSourcePayload();
    const duplicatePool = payload.entries[0].launchStampProvenance;
    const next = payload.entries.at(-1);
    next.poolId = duplicatePool.poolId;
    next.launchStampProvenance.poolId = duplicatePool.poolId;
    next.launchStampProvenance.poolProof.poolId = duplicatePool.poolId;
    recommitSourcePayload(payload);
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    assert.equal(snapshot.status, "last-known-good");
    assert.equal(snapshot.verifiedIdentityCount, 2);
  });

  test("keeps a current Router identity with partial token metadata in launches only", async () => {
    const payload = currentSourcePayload();
    delete payload.entries.at(-1).tokenDecimals;
    recommitSourcePayload(payload);
    serveSource(payload);
    const snapshot = await readRouterCustomRecords(manifest);
    const next = snapshot.records.find((record) => record.token.symbol === "NEXT");
    assert.equal(snapshot.status, "current");
    assert.equal(next.token.identityStatus, "partial");
    assert.equal(next.token.decimals, null);
    const tokens = tokenListPayload(
      snapshot.records,
      snapshot.generatedAt,
      "custom",
      1,
      "ready",
    );
    assert.ok(!tokens.tokens.some((token) => token.symbol === "NEXT"));
  });

  test("rejects every public-field mutation instead of bypassing Router and fee gates", async () => {
    const snapshot = await fallbackRecords();
    const source = publicLaunchV2(snapshot.records[0]);
    const mutations = [
      ["chain", (record) => { record.chainId = 10; }],
      ["caip2", (record) => { record.caip2 = "eip155:10"; }],
      ["token", (record) => {
        record.token.address = "0x1111111111111111111111111111111111111111";
      }],
      ["transaction", (record) => {
        record.launch.transactionHash = `0x${"1".repeat(64)}`;
      }],
      ["launch block", (record) => { record.launch.blockNumber = "25827141"; }],
      ["verification launcher", (record) => {
        record.verification.launcherAddress =
          "0x1111111111111111111111111111111111111111";
      }],
      ["hook", (record) => {
        record.markets[0].hookAddress =
          "0x1111111111111111111111111111111111111111";
      }],
      ["pool", (record) => { record.markets[0].poolId = `0x${"1".repeat(64)}`; }],
      ["stamp", (record) => {
        record.extensions["programmable/router-stamp-v1"].stampHash =
          `0x${"1".repeat(64)}`;
      }],
      ["finality", (record) => {
        record.extensions["programmable/router-stamp-v1"]
          .finalizedAtBlockNumber = "0";
      }],
      ["snapshot digest", (record) => {
        record.extensions["programmable/router-stamp-v1"].snapshotSha256 =
          `sha256:${"1".repeat(64)}`;
      }],
      ["entry digest", (record) => {
        record.extensions["programmable/router-stamp-v1"].entrySha256 =
          `sha256:${"1".repeat(64)}`;
      }],
    ];
    for (const [name, mutate] of mutations) {
      const changed = structuredClone(source);
      mutate(changed);
      assert.equal(isRouterStampedCustom(changed, manifest), false, name);
      assert.ok(
        validateLaunchSemantics(changed).some((finding) =>
          finding.code === "FEE_POLICY_REQUIRED"),
        `${name} must not retain the fee-policy exception`,
      );
    }
  });

  test("publishes only manifest-bound finalized Router records", async () => {
    const snapshot = await fallbackRecords();
    const validate = registry.validator("launch.schema.json");
    for (const record of snapshot.records) {
      assert.equal(isRouterStampedCustom(record, manifest), true);
      assert.equal(isV2PublicLaunch(record, manifest), true);
      const publicRecord = publicLaunchV2(record);
      assertValid(validate, publicRecord, record.token.symbol);
      assert.deepEqual(validateLaunchSemantics(publicRecord), []);
      assert.equal(publicRecord.launch.finality, "finalized");
      assert.equal(publicRecord.verification.provenanceStatus, "verified");
      assert.equal(publicRecord.token.supplyStatus, "unavailable");
      assert.equal(publicRecord.fees.length, 0);
      assert.equal(
        publicRecord.extensions["programmable/router-stamp-v1"]
          .feePolicyStatus,
        "unavailable",
      );
      assert.deepEqual(publicRecord.markets[0].metrics, {
        price: { status: "unavailable", value: null },
        liquidity: { status: "unavailable", value: null },
        volume24h: { status: "unavailable", value: null },
        updatedAt: null,
      });
    }
  });

  test("keeps Router Custom independent from Registry publication readiness", async () => {
    const snapshot = await fallbackRecords();
    const projected = projectV2Dataset(
      {
        records: snapshot.records,
        status: {
          status: "partial",
          generatedAt: "2026-08-25T16:20:39.656Z",
          chainId: 1,
          coverage: {
            status: "complete",
            checkpoint: {
              blockNumber: 25833303,
              blockHash:
                "0x8a41eb9adef78cdf523beff49f0b8d19225394991ff3e7be1bb8d24e34e7cdce",
              finality: "finalized",
            },
          },
          customRegistry: {
            configured: true,
            status: "unavailable",
            completeness: "incomplete",
            freshness: "stale",
            highWaterGeneration: "0",
            launches: 0,
          },
        },
      },
      manifest,
    );
    assert.equal(projected.records.length, 2);
    assert.ok(projected.records.every((record) => record.category === "custom"));
    assert.deepEqual(projected.status.counts, {
      total: 2,
      classic: 0,
      custom: 2,
    });
  });

  test("adds complete Router token identities to the wallet-compatible token list", async () => {
    const snapshot = await fallbackRecords();
    const payload = tokenListPayload(
      snapshot.records,
      snapshot.generatedAt,
      "custom",
      1,
      "degraded",
    );
    assert.equal(payload.status, "degraded");
    assert.deepEqual(payload.tokens.map((token) => token.symbol), ["FADE", "PCAN"]);
    assert.ok(
      payload.tokens.every((token) =>
        token.extensions.programmable.category === "custom" &&
        token.extensions.programmable.finality === "finalized" &&
        !("programmableFeeBps" in token.extensions.programmable)),
    );
    assertValid(
      registry.validator("token-list.schema.json"),
      payload,
      "Router Custom token list",
    );
  });

  test("reports the pinned Router snapshot as degraded and non-authoritative", async () => {
    const snapshot = await fallbackRecords();
    const projected = projectV2Dataset({
      records: snapshot.records,
      status: {
        status: "ready",
        generatedAt: "2026-08-25T16:20:39.656Z",
        chainId: 1,
        coverage: {
          status: "complete",
          checkpoint: {
            blockNumber: 25833000,
            blockHash: `0x${"e".repeat(64)}`,
            finality: "finalized",
          },
        },
        routerCustom: {
          source: "canonical-launch-stamp-router",
          status: snapshot.status,
          generatedAt: snapshot.generatedAt,
          asOfBlock: snapshot.asOfBlock,
          asOfBlockHash: snapshot.asOfBlockHash,
          sourceIdentityCommitment: snapshot.sourceIdentityCommitment,
          snapshotSha256: snapshot.snapshotSha256,
          verifiedIdentityCount: snapshot.verifiedIdentityCount,
          publishedIdentityCount: snapshot.records.length,
        },
      },
    }, manifest);

    assert.equal(feedStatusV2(projected), "degraded");
    assert.equal(feedStatusV2(projected, "custom"), "degraded");
    assert.equal(isV2DatasetPublishable(projected, "custom"), false);
    const service = serviceStatusV2(projected.status, manifest);
    assert.equal(service.feeds.launches, "degraded");
    assert.equal(service.routerCustom.status, "last-known-good");
    assertValid(
      registry.validator("status.schema.json"),
      service,
      "Router Custom service status",
    );
    const feed = launchFeedPayload(projected, { category: "custom", limit: 100 });
    assert.equal(feed.snapshot.blockNumber, snapshot.asOfBlock);
    assert.equal(feed.snapshot.blockHash, snapshot.asOfBlockHash);
    assert.equal(feed.snapshot.sources.routerCustom.blockNumber, snapshot.asOfBlock);
    assert.equal(
      feed.snapshot.sources.routerCustom.blockHash,
      snapshot.asOfBlockHash,
    );
    assert.equal(
      feed.snapshot.sources.routerCustom.identityCommitment,
      snapshot.sourceIdentityCommitment,
    );
    assert.ok(feed.items.every((record) =>
      record.extensions["programmable/classification"].basis ===
        "canonical-launch-stamp-router"));
  });

  test("fails closed when Router identity collides with another public source", async () => {
    const snapshot = await fallbackRecords();
    const conflict = structuredClone(snapshot.records[0]);
    conflict.launchId = `0x${"f".repeat(64)}`;
    assert.throws(
      () => mergeRouterCustomRecords(
        { records: [conflict], status: {} },
        snapshot,
      ),
      /conflicts with another public source/,
    );
  });
});
