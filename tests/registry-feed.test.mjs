import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createLaunchesHandler } from "../api/v1/launches.js";
import { projectV2Record, publicLaunchV2 } from "../server/v2-dataset.js";
import { canonicalSha256, canonicalizeJson } from "../server/canonical.js";
import { deriveUniswapV4PoolId, keccak256 } from "../server/keccak.js";
import {
  normalizeRegistryCustomItem,
  readRegistryCustomFeed,
  createMemoryRegistryCheckpointStore,
  registryCustomFeedConfiguration,
  validateRegistryCustomRecord,
} from "../server/registry.js";
import { createSchemaRegistry } from "../scripts/lib/schema.mjs";
import { publicLaunch } from "../server/normalize.js";

const HASH = (label) => canonicalSha256("programmable.developer-api-test-value.v1", label);
const TX = `0x${"a".repeat(64)}`;
const BLOCK = `0x${"b".repeat(64)}`;
const TARGET = HASH("target");
const FEE_RECIPIENT = "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";
const PRIMARY_TOKEN = "0x2222222222222222222222222222222222222222";
const QUOTE_TOKEN = "0x1111111111111111111111111111111111111111";
const POOL_MANAGER = "0x5555555555555555555555555555555555555555";
const ROOT = "0x3333333333333333333333333333333333333333";
const POOL_ID = deriveUniswapV4PoolId({
  currency0: QUOTE_TOKEN,
  currency1: PRIMARY_TOKEN,
  feeRaw: "3000",
  tickSpacing: "60",
  hooks: "0x0000000000000000000000000000000000000000",
});
const configuration = Object.freeze({
  feedUrl: "https://registry.example/v2/custom-launch-feed",
  audience: "programmable-developer-feed",
  targetBindingHash: TARGET,
  tokenEndpoint: "https://identity.example/token",
  issuer: "programmable-workload-issuer",
  subject: "programmable-developer-api",
  subjectToken: { kind: "inline", value: "unused-test-subject-token-0001" },
});

function mockResponse() {
  return {
    headers: new Map(),
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

async function callLaunches(handler, query = {}) {
  const response = mockResponse();
  await handler(
    { method: "GET", query, headers: {}, url: "/api/v1/launches" },
    response,
  );
  return {
    status: response.statusCode,
    body: response.body ? JSON.parse(response.body) : null,
  };
}

function feeObligation(chainId = "1") {
  const feeAssessmentHash = HASH("fee-assessment");
  const feeObligationHash = HASH("fee-obligation");
  const feeAssessmentObligationBindingHash = HASH("fee-binding");
  return {
    feeAssessmentHash,
    feeObligationHash,
    feeAssessmentObligationBindingHash,
    value: {
      schemaVersion: "programmable.launch-fee-obligation.v2",
      feeAssessmentHash,
      chainId,
      chainProfileId: "ethereum-mainnet",
      chainProfileHash: HASH("chain-profile"),
      ratePpm: 1_000,
      recipient: { namespace: `eip155:${chainId}`, value: FEE_RECIPIENT },
      applicabilityPredicate: "all-qualifying-launch-flows",
      qualifyingFlowBasis: "qualifying-swap-volume",
      qualifyingFlowBasisBindingHash: HASH("flow-basis"),
      feeBasis: "gross-qualifying-flow-volume",
      enforcementRouteId: "custom-route",
      enforcementRouteBindingHash: HASH("enforcement-route"),
      enforcementModuleId: "programmable-fee-module",
      enforcementModuleBindingHash: HASH("enforcement-module"),
      claimSemantics: "recipient-claimable-accrual",
      feeObligationHash,
      feeAssessmentObligationBindingHash,
    },
  };
}

function assetSet(advertisesToken = false) {
  const assets = advertisesToken
    ? [
        {
          assetId: "manager",
          role: "controller",
          identity: { namespace: "eip155:1", value: POOL_MANAGER },
          provenance: {
            kind: "adopted-external",
            relationship: "uniswap-v4-pool-manager",
            dependencyId: "dependency:uniswap-v4-pool-manager",
            capabilityId: "capability:uniswap-v4-pool-manager",
            reviewedRole: "uniswap-v4-pool-manager",
            chainProfileId: "ethereum-mainnet",
            identity: { namespace: "eip155:1", value: POOL_MANAGER },
            expectedRuntimeCodeKeccak256: `0x${"6".repeat(64)}`,
            expectedRuntimeCodeSha256: HASH("pool-manager-runtime"),
            reviewEvidenceBindingHash: HASH("pool-manager-review"),
            interfaceEvidenceBindingHash: HASH("pool-manager-interface"),
            stateObservationIds: [],
          },
          identityEvidenceHash: HASH("manager-identity"),
          onchainMetadata: null,
          onchainMetadataHash: null,
        },
        {
          assetId: "pool",
          role: "pool",
          identity: { namespace: "eip155:1:uniswap-v4-pool-id", value: POOL_ID },
          provenance: { kind: "launch-produced" },
          identityEvidenceHash: HASH("pool-identity"),
          onchainMetadata: null,
          onchainMetadataHash: null,
        },
        {
          assetId: "primary-token",
          role: "primary-token",
          identity: { namespace: "eip155:1", value: PRIMARY_TOKEN },
          provenance: { kind: "launch-produced" },
          identityEvidenceHash: HASH("primary-identity"),
          onchainMetadata: {
            schemaVersion: "programmable.discoverable-launch-token-metadata.v2",
            status: "available",
            source: "finality-resolved-onchain",
            name: "Registry Token",
            symbol: "REG",
            decimals: 18,
            evidenceHash: HASH("metadata-evidence"),
          },
          onchainMetadataHash: null,
        },
        {
          assetId: "root",
          role: "root",
          identity: { namespace: "eip155:1:contract", value: ROOT },
          provenance: { kind: "launch-produced" },
          identityEvidenceHash: HASH("root-identity"),
          onchainMetadata: null,
          onchainMetadataHash: null,
        },
        {
          assetId: "secondary-token",
          role: "secondary-token",
          identity: { namespace: "eip155:1", value: QUOTE_TOKEN },
          provenance: { kind: "protocol-external", relationship: "quote-token" },
          identityEvidenceHash: HASH("secondary-identity"),
          onchainMetadata: null,
          onchainMetadataHash: null,
        },
      ]
    : [{
        assetId: "root",
        role: "root",
        identity: { namespace: "eip155:1:contract", value: ROOT },
        provenance: { kind: "launch-produced" },
        identityEvidenceHash: HASH("root-identity"),
        onchainMetadata: null,
        onchainMetadataHash: null,
      }];
  if (advertisesToken) {
    assets[2].onchainMetadataHash = canonicalSha256(
      "programmable.discoverable-launch-token-metadata-hash.v2",
      assets[2].onchainMetadata,
    );
  }
  const assetIdentitySetHash = canonicalSha256(
    "programmable.discoverable-launch-asset-set-hash.v2",
    {
      schemaVersion: "programmable.discoverable-launch-asset-set.v2",
      advertisesToken,
      assets,
    },
  );
  const markets = advertisesToken
    ? [{
        marketId: "primary-v4-market",
        kind: "uniswap-v4-pool",
        status: "active",
        marketAssetId: "pool",
        baseAssetId: "primary-token",
        quoteAssetId: "secondary-token",
        marketEvidenceHash: HASH("market-evidence"),
        verification: {
          status: "verified",
          verifierAdapterId: "uniswap-v4-pool-finality:v2",
          verifierBindingHash: canonicalSha256(
            "programmable.uniswap-v4-pool-finality-verifier-binding.v2",
            {
              poolManagerReviewEvidenceBindingHash: HASH("pool-manager-review"),
              poolManagerInterfaceEvidenceBindingHash: HASH("pool-manager-interface"),
              poolManagerRuntimeCodeKeccak256: `0x${"6".repeat(64)}`,
              poolManagerRuntimeCodeSha256: HASH("pool-manager-runtime"),
              poolKeyEvidenceHash: HASH("pool-key-evidence"),
            },
          ),
        },
        uniswapV4: {
          poolId: POOL_ID,
          poolManager: { namespace: "eip155:1", value: POOL_MANAGER },
          poolManagerReviewEvidenceBindingHash: HASH("pool-manager-review"),
          poolManagerInterfaceEvidenceBindingHash: HASH("pool-manager-interface"),
          poolManagerRuntimeCodeKeccak256: `0x${"6".repeat(64)}`,
          poolManagerRuntimeCodeSha256: HASH("pool-manager-runtime"),
          currency0AssetId: "secondary-token",
          currency1AssetId: "primary-token",
          feeRaw: "3000",
          dynamicFee: false,
          tickSpacing: "60",
          hooksAssetId: null,
          poolKeyEvidenceHash: HASH("pool-key-evidence"),
        },
      }]
    : [];
  const marketSetHash = canonicalSha256(
    "programmable.discoverable-launch-market-set-hash.v2",
    {
      schemaVersion: "programmable.discoverable-launch-market-set.v2",
      assetIdentitySetHash,
      markets,
    },
  );
  return { assets, assetIdentitySetHash, markets, marketSetHash };
}

function registryRecord({ advertisesToken = false } = {}) {
  const fee = feeObligation();
  const discovery = assetSet(advertisesToken);
  const record = {
    schemaVersion: "programmable.custom-launch-registry-record.v2",
    platformId: "programmable",
    origin: "programmable",
    category: "custom",
    modelId: advertisesToken ? "dynamic-v4-token" : "contract-game",
    launchFamily: "custom",
    projectId: null,
    launchId: null,
    grantId: "grant-1",
    grantBindingHash: HASH("grant"),
    githubPrincipalHash: HASH("github"),
    sourceKind: "browser-wallet-report",
    finalizedLaunchBindingHash: HASH("finalized"),
    sourceRecordBindingHash: HASH("finality-attestation"),
    chainId: "1",
    chainProfileId: "ethereum-mainnet",
    chainProfileHash: HASH("chain-profile"),
    launchRouteId: "custom-route",
    launchRouteBindingHash: HASH("launch-route"),
    executionMode: "evm-transaction",
    launchIdentity: { namespace: "eip155:1:contract", value: ROOT },
    advertisesToken,
    discoverableAssets: discovery.assets,
    assetIdentitySetHash: discovery.assetIdentitySetHash,
    discoverableMarkets: discovery.markets,
    marketSetHash: discovery.marketSetHash,
    launchTransactionId: TX,
    blockHash: BLOCK,
    blockNumber: "25650000",
    transactionIndex: "3",
    logIndex: null,
    launchEventHash: HASH("event"),
    launchArtifactCommitmentHash: HASH("artifact"),
    deploymentCalldataHash: HASH("calldata"),
    permitId: HASH("permit"),
    permitConsumptionHash: HASH("permit-consumption"),
    feeAssessmentHash: fee.feeAssessmentHash,
    feeObligationHash: fee.feeObligationHash,
    feeAssessmentObligationBindingHash: fee.feeAssessmentObligationBindingHash,
    feeObligation: fee.value,
    feeObligationVerificationAuthorityHash: HASH("fee-authority"),
    feeObligationVerificationEvidenceHash: HASH("fee-evidence"),
    finalityEvidenceHash: HASH("finality-evidence"),
    finalityVerificationAuthorityHash: HASH("finality-authority"),
    presentationVersion: null,
    presentationBindingHash: null,
    presentation: null,
    registryProjectionGeneration: "1",
    websiteProjectionGeneration: "1",
    launchedAt: "2026-08-05T10:00:00.000Z",
    finalizedAt: "2026-08-05T10:01:00.000Z",
  };
  rehashLaunchIdentity(record);
  return record;
}

function rehashLaunchIdentity(record) {
  record.projectId = canonicalSha256("programmable.custom-launch-project-id.v2", {
    launchFamily: "custom",
    grantId: record.grantId,
    grantBindingHash: record.grantBindingHash,
  });
  record.launchId = canonicalSha256("programmable.custom-launch-id.v2", {
    launchFamily: "custom",
    projectId: record.projectId,
    chainId: record.chainId,
    launchIdentity: record.launchIdentity,
  });
}

function rehashDiscovery(record) {
  const primary = record.discoverableAssets.find((asset) => asset.role === "primary-token");
  if (primary?.onchainMetadata) {
    primary.onchainMetadataHash = canonicalSha256(
      "programmable.discoverable-launch-token-metadata-hash.v2",
      primary.onchainMetadata,
    );
  }
  record.assetIdentitySetHash = canonicalSha256(
    "programmable.discoverable-launch-asset-set-hash.v2",
    {
      schemaVersion: "programmable.discoverable-launch-asset-set.v2",
      advertisesToken: record.advertisesToken,
      assets: record.discoverableAssets,
    },
  );
  record.marketSetHash = canonicalSha256(
    "programmable.discoverable-launch-market-set-hash.v2",
    {
      schemaVersion: "programmable.discoverable-launch-market-set.v2",
      assetIdentitySetHash: record.assetIdentitySetHash,
      markets: record.discoverableMarkets,
    },
  );
}

function registryItem(record, generation = "1") {
  return {
    generation,
    projectionKey: `custom:${record.launchId}`,
    recordHash: canonicalSha256("programmable.custom-launch-registry-record.v2", record),
    record,
  };
}

function feed(record) {
  const item = registryItem(record);
  return {
    schemaVersion: "programmable.custom-launch-registry-feed.v1",
    source: {
      sourceId: "programmable-custom-launch-registry-v2",
      status: "ready",
      completeness: "complete",
      freshness: "current",
      checkedAt: "2026-08-05T10:02:00.000Z",
      latestAcceptedAt: "2026-08-05T10:01:00.000Z",
    },
    snapshot: { highWaterGeneration: "1", indexedAt: "2026-08-05T10:02:00.000Z" },
    items: [item],
    page: { nextCursor: null, resumeCursor: "registry-resume-cursor-0001", hasMore: false },
  };
}

describe("authenticated Custom Registry ingestion", () => {
  test("matches the canonical Keccak-256 and Uniswap v4 PoolId derivation", () => {
    assert.equal(
      keccak256(new Uint8Array()),
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
    assert.match(POOL_ID, /^0x[0-9a-f]{64}$/);
  });

  test("requires complete explicit deployment configuration without fake defaults", () => {
    assert.equal(registryCustomFeedConfiguration({}), null);
    assert.throws(
      () => registryCustomFeedConfiguration({ PROGRAMMABLE_REGISTRY_CUSTOM_FEED_URL: configuration.feedUrl }),
      /configuration is incomplete/,
    );
    assert.throws(
      () => registryCustomFeedConfiguration({ PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN: "stray-secret-token-0001" }),
      /configuration is incomplete/,
    );
  });

  test("binds a fresh credential to the exact feed request and normalizes a project-only launch", async () => {
    const source = feed(registryRecord());
    let credentialRequest;
    const result = await readRegistryCustomFeed({
      configuration,
      now: () => Date.parse("2026-08-05T10:02:30.000Z"),
      accessToken: async (input) => {
        credentialRequest = input.request;
        return "test-registry-feed-token-0001";
      },
      fetchImplementation: async (url, init) => {
        assert.equal(url.searchParams.get("limit"), "100");
        assert.equal(init.headers["x-programmable-projection-kind"], "registry.custom-launched");
        assert.equal(init.headers.authorization, "Bearer test-registry-feed-token-0001");
        return new Response(canonicalizeJson(source), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    assert.equal(credentialRequest.method, "GET");
    assert.equal(credentialRequest.lane, "registry.custom-launched");
    assert.match(credentialRequest.projectionKey, /^feed:sha256:[0-9a-f]{64}$/);
    assert.equal(result.records.length, 1);

    const launch = normalizeRegistryCustomItem(result.records[0]);
    assert.equal(launch.platformId, "programmable");
    assert.equal(launch.category, "custom");
    assert.equal(launch.launch.modelId, "contract-game");
    assert.equal(launch.launch.launchRouteId, undefined);
    assert.equal(launch.extensions["programmable/registry-v2"].launchRouteId, "custom-route");
    assert.equal(launch.extensions["programmable/registry-v2"].sourceKind, "browser-wallet-report");
    assert.equal(launch.token, null);
    assert.equal(launch.assets.length, 1);
    assert.equal(launch.assets[0].role, "root");
    assert.deepEqual(launch.markets, []);
    assert.equal(launch.fees[0].ratePpm, 1_000);
    assert.equal(launch.fees[0].chargeMode, "added-on-top");
    assert.equal(launch.fees[0].recipient.toLowerCase(), FEE_RECIPIENT.toLowerCase());

    const schemas = await createSchemaRegistry("v2");
    const validate = schemas.validator("launch.schema.json");
    assert.equal(
      validate(publicLaunchV2(projectV2Record(launch))),
      true,
      JSON.stringify(validate.errors),
    );
  });

  test("does not leak a project-only Registry record through frozen GET /v1/launches", async () => {
    const source = feed(registryRecord());
    const ingested = await readRegistryCustomFeed({
      configuration,
      now: () => Date.parse("2026-08-05T10:02:30.000Z"),
      accessToken: async () => "test-registry-feed-token-0001",
      fetchImplementation: async () => new Response(canonicalizeJson(source), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });
    const launch = normalizeRegistryCustomItem(ingested.records[0]);
    const handler = createLaunchesHandler(async () => ({
      records: [launch],
      status: {
        status: "ready",
        generatedAt: "2026-08-05T10:02:30.000Z",
        coverage: {
          status: "complete",
          checkpoint: {
            blockNumber: 25_650_000,
            blockHash: BLOCK,
            finality: "finalized",
          },
        },
        customRegistry: {
          configured: true,
          status: "ready",
          sourceId: source.source.sourceId,
          completeness: source.source.completeness,
          freshness: source.source.freshness,
          highWaterGeneration: source.snapshot.highWaterGeneration,
        },
      },
    }));

    const response = await callLaunches(handler, { category: "custom", limit: "10" });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ready");
    assert.equal(response.body.items.length, 0);
  });

  test("maps only the authenticated Registry v4 kind to the frozen public v1 kind", () => {
    const record = registryRecord({ advertisesToken: true });
    assert.equal(validateRegistryCustomRecord(record), true);
    const item = feed(record).items[0];
    const launch = normalizeRegistryCustomItem(item);
    assert.equal(launch.token.address, PRIMARY_TOKEN);
    assert.equal(launch.markets[0].kind, "uniswap-v4");
    assert.equal(launch.markets[0].status, "active");
    assert.equal(launch.markets[0].verification.verifierAdapterId, "uniswap-v4-pool-finality:v2");
    assert.equal(launch.markets[0].uniswapV4.feeRaw, "3000");
    const contractNamespace = registryRecord({ advertisesToken: true });
    contractNamespace.discoverableAssets.find((asset) => asset.role === "primary-token")
      .identity.namespace = "eip155:1:contract";
    rehashDiscovery(contractNamespace);
    assert.equal(
      normalizeRegistryCustomItem(registryItem(contractNamespace)).token.address,
      PRIMARY_TOKEN,
    );
  });

  test("preserves an unknown authenticated market without presenting it as active or tradable", () => {
    const record = registryRecord({ advertisesToken: true });
    record.discoverableMarkets[0].kind = "contract-priced-market";
    record.discoverableMarkets[0].status = "verification_pending";
    record.discoverableMarkets[0].verification = {
      status: "pending",
      verifierAdapterId: null,
      verifierBindingHash: null,
    };
    record.discoverableMarkets[0].uniswapV4 = null;
    record.marketSetHash = canonicalSha256(
      "programmable.discoverable-launch-market-set-hash.v2",
      {
        schemaVersion: "programmable.discoverable-launch-market-set.v2",
        assetIdentitySetHash: record.assetIdentitySetHash,
        markets: record.discoverableMarkets,
      },
    );
    assert.equal(validateRegistryCustomRecord(record), true);
    const item = feed(record).items[0];
    const market = normalizeRegistryCustomItem(item).markets[0];
    assert.equal(market.kind, "contract-priced-market");
    assert.equal(market.sourceStatus, "verification_pending");
    assert.equal(market.status, "planned");
    assert.equal(market.verificationStatus, "verification-pending");
    assert.equal(market.support.execution, "unavailable");
    assert.equal(market.poolId, null);
  });

  test("preserves producer metadata boundaries byte-for-byte and rejects overflow or sanitization", () => {
    const record = registryRecord({ advertisesToken: true });
    const metadata = record.discoverableAssets.find((asset) => asset.role === "primary-token").onchainMetadata;
    metadata.name = "é".repeat(128);
    metadata.symbol = "🚀".repeat(16);
    rehashDiscovery(record);
    assert.equal(validateRegistryCustomRecord(record), true);
    const launch = normalizeRegistryCustomItem(feed(record).items[0]);
    assert.equal(launch.token.name, metadata.name);
    assert.equal(launch.token.symbol, metadata.symbol);

    metadata.name += "é";
    rehashDiscovery(record);
    assert.equal(validateRegistryCustomRecord(record), false);

    const controls = registryRecord({ advertisesToken: true });
    controls.discoverableAssets.find((asset) => asset.role === "primary-token").onchainMetadata.symbol = "SAFE\u202eTXT";
    rehashDiscovery(controls);
    assert.equal(validateRegistryCustomRecord(controls), false);

    const kind = registryRecord({ advertisesToken: true });
    kind.discoverableMarkets[0].kind = "MixedCaseMarket";
    rehashDiscovery(kind);
    assert.equal(validateRegistryCustomRecord(kind), false);

    const externalPrimary = registryRecord({ advertisesToken: true });
    externalPrimary.discoverableAssets.find((asset) => asset.role === "primary-token").provenance = {
      kind: "protocol-external",
      relationship: "adopted-token",
    };
    rehashDiscovery(externalPrimary);
    assert.equal(validateRegistryCustomRecord(externalPrimary), false);
  });

  test("preserves adopted-external provenance and rejects provenance or verifier substitution", () => {
    const record = registryRecord({ advertisesToken: true });
    const secondary = record.discoverableAssets.find((asset) => asset.role === "secondary-token");
    secondary.provenance = {
      kind: "adopted-external",
      relationship: "quote-token",
      dependencyId: "wrapped-native-token",
      capabilityId: "erc20-transfer",
      reviewedRole: "quote-asset",
      chainProfileId: "ethereum-mainnet",
      identity: { ...secondary.identity },
      expectedRuntimeCodeKeccak256: `0x${"7".repeat(64)}`,
      expectedRuntimeCodeSha256: HASH("external-runtime"),
      reviewEvidenceBindingHash: HASH("external-review"),
      interfaceEvidenceBindingHash: HASH("external-interface"),
      stateObservationIds: ["total-supply", "owner-state"],
    };
    rehashDiscovery(record);
    assert.equal(validateRegistryCustomRecord(record), true);
    const launch = normalizeRegistryCustomItem(feed(record).items[0]);
    assert.deepEqual(
      launch.assets.find((asset) => asset.assetId === "secondary-token").provenance,
      secondary.provenance,
    );

    secondary.provenance.identity.value = "0x9999999999999999999999999999999999999999";
    rehashDiscovery(record);
    assert.equal(validateRegistryCustomRecord(record), false);

    const verifier = registryRecord({ advertisesToken: true });
    verifier.discoverableMarkets[0].verification.verifierAdapterId = "forged-verifier";
    rehashDiscovery(verifier);
    assert.equal(validateRegistryCustomRecord(verifier), false);

    const binding = registryRecord({ advertisesToken: true });
    binding.discoverableMarkets[0].verification.verifierBindingHash = HASH("forged-binding");
    rehashDiscovery(binding);
    assert.equal(validateRegistryCustomRecord(binding), false);

    const pool = registryRecord({ advertisesToken: true });
    pool.discoverableMarkets[0].uniswapV4.poolId = `0x${"9".repeat(64)}`;
    pool.discoverableAssets.find((asset) => asset.role === "pool").identity.value = `0x${"9".repeat(64)}`;
    rehashDiscovery(pool);
    assert.equal(validateRegistryCustomRecord(pool), false);

    const crossChain = registryRecord({ advertisesToken: true });
    const manager = crossChain.discoverableAssets.find((asset) => asset.assetId === "manager");
    manager.identity.namespace = "eip155:2";
    manager.provenance.identity.namespace = "eip155:2";
    crossChain.discoverableMarkets[0].uniswapV4.poolManager.namespace = "eip155:2";
    rehashDiscovery(crossChain);
    assert.equal(validateRegistryCustomRecord(crossChain), false);

    const spoofedAuthority = registryRecord({ advertisesToken: true });
    spoofedAuthority.discoverableAssets.find((asset) => asset.assetId === "manager")
      .provenance.reviewedRole = "creator-declared-manager";
    rehashDiscovery(spoofedAuthority);
    assert.equal(validateRegistryCustomRecord(spoofedAuthority), false);
  });

  test("rejects source identity forgery and incomplete Registry snapshots", async () => {
    for (const field of ["platformId", "origin", "category", "modelId"]) {
      const record = registryRecord();
      record[field] = field === "modelId" ? "INVALID MODEL" : "forged";
      assert.equal(validateRegistryCustomRecord(record), false, field);
    }
    const substitutedSource = registryRecord();
    substitutedSource.sourceKind = "legacy-browser-hybrid";
    assert.equal(validateRegistryCustomRecord(substitutedSource), false);
    const legacySource = registryRecord();
    legacySource.sourceKind = "legacy-executor";
    legacySource.sourceRecordBindingHash = HASH("durable-legacy-finalized-record");
    assert.equal(validateRegistryCustomRecord(legacySource), true);
    assert.equal(
      normalizeRegistryCustomItem(registryItem(legacySource))
        .extensions["programmable/registry-v2"].sourceKind,
      "legacy-executor",
    );
    const missingSourceProof = registryRecord();
    missingSourceProof.sourceRecordBindingHash = null;
    assert.equal(validateRegistryCustomRecord(missingSourceProof), false);
    const substitutedProjectionKey = registryItem(registryRecord());
    substitutedProjectionKey.projectionKey = "custom:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const badProjectionFeed = feed(registryRecord());
    badProjectionFeed.items = [substitutedProjectionKey];
    await assert.rejects(
      () => readRegistryCustomFeed({
        configuration,
        now: () => Date.parse("2026-08-05T10:02:30.000Z"),
        accessToken: async () => "test-registry-feed-token-0001",
        fetchImplementation: async () => new Response(canonicalizeJson(badProjectionFeed), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      }),
      /item is invalid/,
    );

    const source = feed(registryRecord());
    source.snapshot.highWaterGeneration = "2";
    await assert.rejects(
      () => readRegistryCustomFeed({
        configuration,
        now: () => Date.parse("2026-08-05T10:02:30.000Z"),
        accessToken: async () => "test-registry-feed-token-0001",
        fetchImplementation: async () => new Response(canonicalizeJson(source), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      }),
      /incomplete/,
    );
  });

  test("accepts only an exact all-or-nothing presentation snapshot", () => {
    const record = registryRecord();
    record.presentationVersion = "7";
    record.presentationBindingHash = HASH("presentation-binding");
    record.presentation = {
      schemaVersion: "programmable.launch-presentation-draft.v1",
      description: "A custom launch with exact authenticated presentation data.",
      image: {
        uri: "https://cdn.programmable.app/project.webp",
        contentSha256: HASH("presentation-image"),
        mediaType: "image/webp",
        byteLength: 4096,
        width: 1200,
        height: 1200,
      },
      links: [
        { kind: "documentation", uri: "https://docs.programmable.app/project" },
        { kind: "website", uri: "https://programmable.app/project" },
      ],
    };
    assert.equal(validateRegistryCustomRecord(record), true);
    const launch = normalizeRegistryCustomItem(registryItem(record));
    assert.equal(launch.extensions["programmable/registry-v2"].presentationVersion, "7");
    assert.deepEqual(launch.extensions["programmable/registry-v2"].presentation, record.presentation);

    for (const missing of ["presentationVersion", "presentationBindingHash", "presentation"]) {
      const partial = structuredClone(record);
      partial[missing] = null;
      assert.equal(validateRegistryCustomRecord(partial), false, missing);
    }
    const forgedLink = structuredClone(record);
    forgedLink.presentation.links[0].uri = "http://localhost/secrets";
    assert.equal(validateRegistryCustomRecord(forgedLink), false);
    const reordered = structuredClone(record);
    reordered.presentation.links.reverse();
    assert.equal(validateRegistryCustomRecord(reordered), false);
  });

  test("pins a multipage high-water and resumes incrementally from the stored Registry cursor", async () => {
    const firstRecord = registryRecord();
    const secondRecord = registryRecord();
    secondRecord.grantId = "grant-2";
    secondRecord.grantBindingHash = HASH("grant-2");
    rehashLaunchIdentity(secondRecord);
    const thirdRecord = registryRecord();
    thirdRecord.grantId = "grant-3";
    thirdRecord.grantBindingHash = HASH("grant-3");
    rehashLaunchIdentity(thirdRecord);
    const pageOne = feed(firstRecord);
    pageOne.snapshot.highWaterGeneration = "2";
    pageOne.items = [registryItem(firstRecord, "1")];
    pageOne.page = {
      nextCursor: "registry-page-cursor-0002",
      resumeCursor: "registry-resume-cursor-0002",
      hasMore: true,
    };
    const pageTwo = structuredClone(pageOne);
    pageTwo.items = [registryItem(secondRecord, "2")];
    pageTwo.page = {
      nextCursor: null,
      resumeCursor: "registry-resume-cursor-0002",
      hasMore: false,
    };
    const incremental = feed(thirdRecord);
    incremental.snapshot.highWaterGeneration = "3";
    incremental.items = [registryItem(thirdRecord, "3")];
    incremental.page.resumeCursor = "registry-resume-cursor-0003";
    const checkpointStore = createMemoryRegistryCheckpointStore();
    const firstCursors = [];
    const first = await readRegistryCustomFeed({
      configuration,
      checkpointStore,
      now: () => Date.parse("2026-08-05T10:02:30.000Z"),
      accessToken: async () => "test-registry-feed-token-0001",
      fetchImplementation: async (url) => {
        firstCursors.push(url.searchParams.get("cursor"));
        const body = firstCursors.length === 1 ? pageOne : pageTwo;
        return new Response(canonicalizeJson(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    assert.deepEqual(firstCursors, [null, "registry-page-cursor-0002"]);
    assert.deepEqual(first.records.map((item) => item.generation), ["1", "2"]);

    let resumedCursor;
    const resumed = await readRegistryCustomFeed({
      configuration,
      checkpointStore,
      now: () => Date.parse("2026-08-05T10:02:30.000Z"),
      accessToken: async () => "test-registry-feed-token-0001",
      fetchImplementation: async (url) => {
        resumedCursor = url.searchParams.get("cursor");
        return new Response(canonicalizeJson(incremental), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    assert.equal(resumedCursor, "registry-resume-cursor-0002");
    assert.deepEqual(resumed.records.map((item) => item.generation), ["1", "2", "3"]);
    assert.equal(resumed.snapshot.highWaterGeneration, "3");
  });

  test("rejects cursor loops and impossible Registry source times", async () => {
    const looping = feed(registryRecord());
    looping.snapshot.highWaterGeneration = "3";
    looping.page = {
      nextCursor: "registry-loop-cursor-0001",
      resumeCursor: "registry-resume-cursor-0003",
      hasMore: true,
    };
    let generation = 0;
    await assert.rejects(
      () => readRegistryCustomFeed({
        configuration,
        now: () => Date.parse("2026-08-05T10:02:30.000Z"),
        accessToken: async () => "test-registry-feed-token-0001",
        fetchImplementation: async () => {
          generation += 1;
          const page = structuredClone(looping);
          page.items = [registryItem(registryRecord(), String(generation))];
          return new Response(canonicalizeJson(page), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      }),
      /cursor loop/,
    );

    const impossible = feed(registryRecord());
    impossible.source.latestAcceptedAt = "2026-08-05T10:03:00.000Z";
    await assert.rejects(
      () => readRegistryCustomFeed({
        configuration,
        now: () => Date.parse("2026-08-05T10:02:30.000Z"),
        accessToken: async () => "test-registry-feed-token-0001",
        fetchImplementation: async () => new Response(canonicalizeJson(impossible), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      }),
      /not current/,
    );
  });
});
