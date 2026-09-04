import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

describe("launch-provider documentation", () => {
  test("keeps provider attribution under the stable Custom category", async () => {
    const guide = await read("docs/guides/launch-providers.md");

    assert.match(guide, /API category: custom/);
    assert.match(guide, /Terminal label: Programmable Custom/);
    assert.match(guide, /do not create additional public categories/i);
  });

  test("requires atomic provenance and separates live discovery from closed legacy intake", async () => {
    const guide = await read("docs/guides/launch-providers.md");
    const proposal = await read(
      "proposals/custom-registry/IProgrammableCustomRegistryV1.sol",
    );

    assert.match(guide, /Custom Registry generation 1 is live/i);
    assert.match(guide, /Legacy Registry and GitHub submission intake are closed/i);
    assert.match(guide, /409 CUSTOM_LAUNCH_V1_READ_ONLY/i);
    assert.match(guide, /statuses marked retryable.*Retry-After/i);
    assert.match(guide, /authenticated Custom Launch API V3/i);
    assert.doesNotMatch(guide, /V2 remains unavailable for public launches/i);
    assert.match(guide, /Programmable adapter/);
    assert.match(guide, /Provider factory callback/);
    assert.match(guide, /webhook.*does not prove/is);
    assert.match(guide, /token and hook addresses normally differ on every launch/i);
    assert.match(guide, /terminals poll one feed/i);
    assert.match(proposal, /This is not a deployed ABI/);
  });

  test("does not turn registration into a blanket safety claim", async () => {
    const guide = await read("docs/guides/launch-providers.md");

    assert.match(guide, /does not imply.*safe.*audited.*sellable.*unruggable/is);
    assert.match(guide, /beforeSwapReturnDelta/);
    assert.match(guide, /keep the provider integration prelaunch/i);
  });

  test("keeps the visual documentation on the branded product route", async () => {
    const vercel = JSON.parse(await read("vercel.json"));
    const rootRedirect = vercel.redirects.find(
      (redirect) => redirect.source === "/",
    );

    assert.deepEqual(rootRedirect, {
      source: "/",
      destination: "https://programmable.family/docs/developers",
      permanent: false,
    });
  });

  test("pins API CORS at the CDN layer, including cache-generated 304 responses", async () => {
    const vercel = JSON.parse(await read("vercel.json"));
    for (const source of ["/api/(.*)", "/v1/(.*)", "/v2/(.*)"]) {
      const route = vercel.headers.find((entry) => entry.source === source);
      const headers = Object.fromEntries(
        (route?.headers ?? []).map(({ key, value }) => [key, value]),
      );

      assert.equal(headers["Access-Control-Allow-Origin"], "*", source);
      assert.equal(
        headers["Access-Control-Allow-Methods"],
        "GET, OPTIONS",
        source,
      );
      assert.match(headers["Access-Control-Allow-Headers"], /If-None-Match/u);
      assert.match(headers["Access-Control-Expose-Headers"], /ETag/u);
      assert.match(
        headers["Access-Control-Expose-Headers"],
        /X-Programmable-Status/u,
      );
      assert.match(headers["Access-Control-Expose-Headers"], /X-Request-Id/u);
      assert.match(headers["Access-Control-Expose-Headers"], /Retry-After/u);
    }
  });
});
