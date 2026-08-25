import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, test } from "node:test";

import {
  createLaunchesHandler,
  launchFeedPayload,
} from "../api/v2/launches.js";
import { createLaunchIdDetailHandler } from "../api/v2/launch-detail.js";
import { createLaunchDetailHandler } from
  "../api/v2/launches/[chainId]/[tokenAddress].js";
import {
  createTokenListHandler,
  tokenListPayload,
} from "../api/v2/token-list.js";
import { decodePageCursor, decodeResumeCursor } from "../server/http.js";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";
import {
  PLATFORM_FEE_RECIPIENT,
  validateLaunchSemantics,
} from "../scripts/lib/semantics.mjs";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function sortKey(block, identity = ZERO_ADDRESS) {
  return `${String(block).padStart(16, "0")}:0000000000:0000000000:${identity}`;
}

function launch(block, options = {}) {
  const address = options.address ??
    `0x${block.toString(16).padStart(40, "0")}`;
  return {
    schemaVersion: "2.0.0",
    platformId: "programmable",
    publicLabel: options.category === "custom"
      ? "Programmable Custom"
      : "Programmable Classic",
    launchId: options.launchId ?? `fixture:${block}`,
    category: options.category ?? "classic",
    chainId: options.chainId ?? 1,
    token: options.token === null
      ? null
      : {
          address,
          identityStatus: "complete",
          name: `Token ${block}`,
          symbol: `T${block}`,
          decimals: 18,
          metadata: { imageUrl: null },
        },
    launch: {
      modelId: options.category === "custom" ? "custom" : "classic",
      modelVersion: "1",
      finality: "finalized",
    },
    verification: { provenanceStatus: "verified" },
    capabilities: [],
    markets: [],
    fees: options.fees ?? [],
    extensions: {},
    sortKey: sortKey(block, address),
  };
}

function dataset(records, overrides = {}) {
  return {
    records,
    status: {
      status: "ready",
      generatedAt: "2026-08-06T00:00:00.000Z",
      chainId: 1,
      supportedChainIds: [1],
      coverage: {
        status: "complete",
        checkpoint: {
          blockNumber: 100_000,
          blockHash: `0x${"a".repeat(64)}`,
          finality: "finalized",
        },
      },
      customRegistry: {
        status: "unconfigured",
        highWaterGeneration: null,
      },
      customRegistryPublication: {
        status: "prelaunch",
        publicSubmissionsEnabled: false,
        sourceReady: false,
        publishedRegistries: 0,
      },
      ...overrides,
    },
  };
}

function syntheticPartnerLaunch(partnerId) {
  const partnerRecipient = "0x1111111111111111111111111111111111111111";
  const value = launch(20, { category: "custom" });
  value.caip2 = "eip155:1";
  value.model = { id: "custom", version: "1" };
  value.template = { id: `${partnerId}-template`, partnerId };
  value.partner = {
    id: partnerId,
    status: "active",
    recipient: { namespace: "eip155-address", value: partnerRecipient },
  };
  value.markets = [
    {
      marketId: "synthetic-verified-market",
      status: "active",
      verification: { status: "verified" },
    },
  ];
  value.feePolicy = {
    mode: "partner-template",
    programmableRecipient: {
      namespace: "eip155-address",
      value: PLATFORM_FEE_RECIPIENT,
    },
    totalFeeBps: 20,
    programmableShareBps: 5,
    partnerShareBps: 15,
    partnerRecipient: {
      namespace: "eip155-address",
      value: partnerRecipient,
    },
    chargeMode: "template-native-verified-market-path",
    normalProgrammableTenBpsApplied: false,
    verificationStatus: "verified",
    verifiedMarketIds: ["synthetic-verified-market"],
    claimRights: {
      programmable: "programmable-only",
      partner: "partner-only",
      independentlyClaimable: true,
      crossPartyClaimingProhibited: true,
    },
  };
  value.fees = [
    {
      kind: "partnership",
      share: "partner",
      rateBps: 15,
      recipient: partnerRecipient,
      basis: "verified-market-volume",
      currency: { kind: "market-defined" },
    },
    {
      kind: "partnership",
      share: "programmable",
      rateBps: 5,
      recipient: PLATFORM_FEE_RECIPIENT,
      basis: "verified-market-volume",
      currency: { kind: "market-defined" },
    },
  ];
  return value;
}

function feeFindingCodes(value) {
  return validateLaunchSemantics(value)
    .map((finding) => finding.code)
    .filter((code) =>
      code.includes("FEE") ||
      code.includes("SHARE") ||
      code.includes("PARTNER"),
    );
}

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

async function call(handler, query = {}, url = "/api/v2/launches") {
  const response = mockResponse();
  await handler({ method: "GET", query, headers: {}, url }, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    body: response.body ? JSON.parse(response.body) : null,
  };
}

describe("v2 API contract", () => {
  test("keeps Custom prelaunch empty while serving complete Classic discovery", async () => {
    const current = dataset([launch(10)]);
    const handler = createLaunchesHandler(async () => current);

    const combined = await call(handler);
    assert.equal(combined.status, 200);
    assert.deepEqual(combined.body.items.map((item) => item.launchId), ["fixture:10"]);

    const custom = await call(handler, { category: "custom" });
    assert.equal(custom.status, 200);
    assert.deepEqual(custom.body.items, []);
  });

  test("keeps the Custom route readable with unavailable quality when its source is stale", async () => {
    const current = dataset([launch(10)], {
      customRegistry: { status: "unavailable", highWaterGeneration: "8" },
      customRegistryPublication: {
        status: "live",
        publicSubmissionsEnabled: true,
        sourceReady: false,
        publishedRegistries: 1,
      },
    });
    const handler = createLaunchesHandler(async () => current);

    const custom = await call(handler, { category: "custom" });
    assert.equal(custom.status, 200);
    assert.equal(custom.body.status, "unavailable");
    assert.deepEqual(custom.body.items, []);

    const combined = await call(handler);
    assert.equal(combined.status, 200);
    assert.equal(combined.body.status, "degraded");
    assert.equal(combined.body.items.length, 1);
  });

  test("publishes the recognized subset with degraded quality when Gen2 coverage is stale", async () => {
    const current = dataset([launch(10)], {
      customRegistry: {
        status: "unavailable",
        completeness: "incomplete",
        freshness: "stale",
        highWaterGeneration: "1",
      },
      customRegistryPublication: {
        status: "live",
        publicSubmissionsEnabled: false,
        sourceReady: false,
        activeGeneration: "2",
        requiresLiveSource: true,
        publishedRegistries: 2,
      },
    });
    const handler = createLaunchesHandler(async () => current);

    const combined = await call(handler);
    assert.equal(combined.status, 200);
    assert.equal(combined.body.status, "degraded");
    assert.deepEqual(combined.body.items.map((item) => item.launchId), ["fixture:10"]);
    const custom = await call(handler, { category: "custom" });
    assert.equal(custom.status, 200);
    assert.equal(custom.body.status, "unavailable");
    assert.deepEqual(custom.body.items, []);
    const classicOnly = await call(handler, { category: "classic" });
    assert.equal(classicOnly.status, 200);
  });

  test("binds opaque cursors to category and chain filters", async () => {
    const chainOne = launch(10, { chainId: 1 });
    const base = launch(9, { chainId: 8453 });
    const current = dataset([chainOne, base], { supportedChainIds: [1, 8453] });
    const handler = createLaunchesHandler(async () => current);

    const first = await call(handler, { chainId: "1", limit: "1" });
    assert.equal(first.status, 200);
    const wrongChain = await call(handler, {
      chainId: "8453",
      limit: "1",
      after: first.body.page.resumeCursor,
    });
    assert.equal(wrongChain.status, 400);
    assert.equal(wrongChain.body.code, "cursor-scope-mismatch");
  });

  test("looks up project-only launches by launchId without inventing a token", async () => {
    const project = launch(10, {
      category: "custom",
      launchId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      token: null,
    });
    const current = dataset([project]);
    const handler = createLaunchIdDetailHandler(async () => current);
    const response = await call(
      handler,
      { launchId: project.launchId },
      `/api/v2/launches/${project.launchId}`,
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.launchId, project.launchId);
    assert.equal(response.body.token, null);
  });

  test("token lookup ignores project-only records and avoids a false 404 on stale Custom coverage", async () => {
    const project = launch(10, { category: "custom", token: null });
    const current = dataset([project], {
      customRegistryPublication: {
        status: "live",
        publicSubmissionsEnabled: true,
        sourceReady: false,
        publishedRegistries: 1,
      },
    });
    const handler = createLaunchDetailHandler(async () => current);
    const response = await call(
      handler,
      {
        chainId: "1",
        tokenAddress: "0x1111111111111111111111111111111111111111",
      },
      "/api/v2/launches/1/0x1111111111111111111111111111111111111111",
    );
    assert.equal(response.status, 503);
    assert.equal(response.body.code, "index-coverage-incomplete");
  });

  test("never invents a default Programmable fee in the token list", async () => {
    const record = launch(10, { fees: [] });
    const payload = tokenListPayload([record], "2026-08-06T00:00:00.000Z");
    assert.equal(
      Object.hasOwn(
        payload.tokens[0].extensions.programmable,
        "programmableFeeBps",
      ),
      false,
    );
    assert.equal(payload.status, "ready");

    const handler = createTokenListHandler(async () => dataset([record]));
    const response = await call(handler, {}, "/api/v2/token-list");
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ready");
  });

  test("keeps recognized launch and token identities visible under partial coverage", async () => {
    const recognized = launch(10);
    const current = dataset([recognized]);
    current.status.status = "partial";
    current.status.coverage.status = "partial";

    const launchResponse = await call(
      createLaunchesHandler(async () => current),
    );
    assert.equal(launchResponse.status, 200);
    assert.equal(launchResponse.body.status, "degraded");
    assert.deepEqual(
      launchResponse.body.items.map((item) => item.launchId),
      [recognized.launchId],
    );

    const tokenResponse = await call(
      createTokenListHandler(async () => current),
      {},
      "/api/v2/token-list",
    );
    assert.equal(tokenResponse.status, 200);
    assert.equal(tokenResponse.body.status, "degraded");
    assert.deepEqual(
      tokenResponse.body.tokens.map((token) => token.address),
      [recognized.token.address],
    );
  });

  test("returns support-safe error metadata without credentials", async () => {
    const response = await call(
      createLaunchesHandler(async () => dataset([])),
      { category: "invalid" },
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.status, 400);
    assert.equal(response.body.requestId, response.headers.get("x-request-id"));
    assert.ok(Number.isFinite(Date.parse(response.body.timestamp)));
    assert.equal("apiKey" in response.body, false);
    assert.equal("authorization" in response.body, false);
    assertValid(
      (await createSchemaRegistry("v2")).validator("problem.schema.json"),
      response.body,
      "v2 problem response",
    );
  });

  test("exposes Retry-After for a transient response-production failure", async () => {
    const response = await call(
      createLaunchesHandler(async () => {
        throw new Error("synthetic upstream failure");
      }),
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "30");
    assert.match(
      response.headers.get("access-control-expose-headers"),
      /Retry-After/,
    );
    assert.ok(Number.isFinite(Date.parse(response.body.timestamp)));
  });

  test("accepts synthetic Basebit and Aion policy shapes only at exact 15/5 without a native overlay", () => {
    for (const partnerId of ["basebit-synthetic", "aion-synthetic"]) {
      assert.deepEqual(feeFindingCodes(syntheticPartnerLaunch(partnerId)), []);
    }
  });

  test("keeps partner attribution on a project-only launch without inventing a 20 bps path", () => {
    const value = syntheticPartnerLaunch("partner-game-synthetic");
    value.token = null;
    value.markets = [];
    value.fees = [];
    value.feePolicy = {
      ...value.feePolicy,
      mode: "no-qualifying-market",
      totalFeeBps: 0,
      programmableShareBps: 0,
      partnerShareBps: 0,
      partnerRecipient: null,
      chargeMode: "none-no-qualifying-market",
      basis: null,
      currency: null,
      accrual: null,
      claim: null,
      rounding: null,
      verifiedMarketIds: [],
      normalProgrammableTenBpsApplied: false,
      verificationStatus: "not_applicable",
      claimRights: {
        programmable: null,
        partner: null,
        independentlyClaimable: false,
        crossPartyClaimingProhibited: true,
      },
    };
    assert.deepEqual(feeFindingCodes(value), []);
    assert.equal(value.partner.id, "partner-game-synthetic");
    assert.equal(value.template.partnerId, value.partner.id);
  });

  test("fails partner policy closed for unverifiable, copied, paused, changed or overlaid attribution", () => {
    const cases = [];

    const unknownRecipient = syntheticPartnerLaunch("unknown-partner-synthetic");
    unknownRecipient.partner.recipient = null;
    cases.push(unknownRecipient);

    const copiedTemplate = syntheticPartnerLaunch("basebit-synthetic");
    copiedTemplate.template.partnerId = "copied-partner";
    cases.push(copiedTemplate);

    const paused = syntheticPartnerLaunch("aion-synthetic");
    paused.partner.status = "paused";
    cases.push(paused);

    const changedRecipient = syntheticPartnerLaunch("basebit-synthetic");
    changedRecipient.feePolicy.partnerRecipient.value =
      "0x2222222222222222222222222222222222222222";
    cases.push(changedRecipient);

    const overlaid = syntheticPartnerLaunch("aion-synthetic");
    overlaid.fees.push({
      kind: "programmable-platform",
      share: "programmable",
      rateBps: 10,
      recipient: PLATFORM_FEE_RECIPIENT,
      basis: "verified-market-volume",
      currency: { kind: "market-defined" },
    });
    cases.push(overlaid);

    const mismatchedCurrency = syntheticPartnerLaunch("basebit-synthetic");
    mismatchedCurrency.fees[0].currency = { kind: "other" };
    cases.push(mismatchedCurrency);

    const crossClaim = syntheticPartnerLaunch("aion-synthetic");
    crossClaim.feePolicy.claimRights.crossPartyClaimingProhibited = false;
    cases.push(crossClaim);

    for (const candidate of cases) {
      assert.ok(feeFindingCodes(candidate).length > 0);
    }
  });

  test("paginates a simulated 100,000-launch snapshot within a bounded resource pass", () => {
    const records = Array.from({ length: 100_000 }, (_, index) => {
      const block = 100_000 - index;
      return launch(block);
    });
    const current = dataset(records);
    const started = performance.now();
    const first = launchFeedPayload(current, { limit: 100 });
    const second = launchFeedPayload(current, {
      limit: 100,
      cursor: decodePageCursor(first.page.nextCursor),
    });
    const elapsed = performance.now() - started;

    assert.equal(first.items.length, 100);
    assert.equal(second.items.length, 100);
    assert.equal(
      new Set([...first.items, ...second.items].map((item) => item.launchId)).size,
      200,
    );
    assert.equal(
      decodeResumeCursor(first.page.resumeCursor).highWater,
      records[0].sortKey,
    );
    assert.ok(elapsed < 5_000, `100k pagination took ${elapsed.toFixed(1)}ms`);
  });
});
