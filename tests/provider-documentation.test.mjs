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

  test("requires atomic provenance and separates live discovery from prelaunch intake", async () => {
    const guide = await read("docs/guides/launch-providers.md");
    const proposal = await read(
      "proposals/custom-registry/IProgrammableCustomRegistryV1.sol",
    );

    assert.match(guide, /Custom Registry generation 1 is live/i);
    assert.match(guide, /Registry-based public submission intake remains prelaunch/i);
    assert.match(guide, /does not describe the separate Custom Launch API/i);
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
});
