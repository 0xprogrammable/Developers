import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const DOCUMENTS = [
  "docs/status.md",
  "docs/README.md",
  "docs/quickstart.md",
  "docs/concepts/multi-chain.md",
  "docs/reference/http-api.md",
  "docs/reference/onchain-verification.md",
  "llms.txt",
  "llms-full.txt",
];
const V4_OPENAPI =
  "https://programmable.market/openapi/custom-launch-v4.json";
const V4_SOURCE_STATUS =
  "https://programmable.market/schemas/custom-launch/v4/source-verification-status.json";
const V4_DEVELOPER_PROJECTION =
  "https://developers.programmable.family/schemas/v2/custom-launch-source-verification-v4.schema.json";

async function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function selectedManifestExample(source) {
  const match = source.match(
    /selected[\s\S]*?```json\n([\s\S]*?)\n```/iu,
  );
  assert.ok(match, "selected planned manifest example is missing");
  return JSON.parse(match[1]);
}

describe("Robinhood V4 documentation contract", () => {
  test("links the separate V4 write and both source-verification contracts", async () => {
    for (const relativePath of DOCUMENTS) {
      const source = await read(relativePath);
      for (const url of [V4_OPENAPI, V4_SOURCE_STATUS, V4_DEVELOPER_PROJECTION]) {
        assert.ok(source.includes(url), `${relativePath} is missing ${url}`);
      }
    }
  });

  test("keeps illustrative planned negative examples fail-closed", async () => {
    for (const relativePath of [
      "docs/quickstart.md",
      "docs/concepts/multi-chain.md",
      "llms-full.txt",
    ]) {
      const source = await read(relativePath);
      assert.match(source, /illustrative\s+negative example/iu, relativePath);
      assert.match(source, /not the current/iu, relativePath);
      const manifest = selectedManifestExample(source);
      assert.equal(manifest.chainId, 4663, relativePath);
      assert.equal(manifest.caip2, "eip155:4663", relativePath);
      assert.deepEqual(manifest.deployments, [], relativePath);
      assert.equal(
        manifest.customRegistry.publicSubmissionsEnabled,
        false,
        relativePath,
      );
      assert.equal(manifest.customRegistry.address, null, relativePath);
      assert.equal(manifest.customRegistry.startBlock, null, relativePath);
      assert.equal(manifest.launchStampRouter.status, "planned", relativePath);
      assert.equal(manifest.launchStampRouter.address, null, relativePath);
      assert.equal(manifest.launchStampRouter.startBlock, null, relativePath);
      assert.equal(manifest.launchStampRouter.runtimeCodeHash, null, relativePath);
      assert.equal(
        manifest.launchStampRouter.deploymentEvidence,
        null,
        relativePath,
      );
      assert.equal(manifest.customLaunchV4.status, "planned", relativePath);
      assert.equal(manifest.customLaunchV4.profile, null, relativePath);
      assert.equal(manifest.customLaunchV4.finalityPolicy, null, relativePath);
      assert.equal(
        manifest.extensions["programmable/read-model-v1"]
          .absenceAuthoritative,
        false,
        relativePath,
      );
    }
  });

  test("separates chain write state and public evidence axes", async () => {
    const [status, http, onchain, llms, llmsFull] = await Promise.all([
      read("docs/status.md"),
      read("docs/reference/http-api.md"),
      read("docs/reference/onchain-verification.md"),
      read("llms.txt"),
      read("llms-full.txt"),
    ]);

    for (const source of [status, http, llms, llmsFull]) {
      assert.match(source, /chain(?:Id)?:?\s*1|chain-1/iu);
      assert.match(source, /V1[\s\S]*V2[\s\S]*(?:read-only|write-fenced|write-fence)/iu);
      assert.match(source, /V3(?: profile)? `?3\.3\.0`?[\s\S]*fresh/iu);
      assert.match(source, /4663[\s\S]*planned/iu);
      assert.match(source, /direct-chain[\s\S]*live|live[\s\S]*direct-chain/iu);
      assert.match(source, /hosted[\s\S]*(?:planned|unavailable)/iu);
      assert.match(source, /4663[\s\S]*(?:no public writes|public writes[^.]*unavailable)/iu);
    }

    for (const source of [status, http, onchain, llms, llmsFull]) {
      for (const term of [
        "finality",
        "exact source verification",
        "indexing",
        "public visibility",
      ]) {
        assert.match(source, new RegExp(term.replaceAll(" ", "\\s+"), "iu"));
      }
    }

    assert.match(status, /empty result means[\s\S]*unknown/iu);
    assert.match(http, /absenceAuthoritative: false/iu);
    assert.match(onchain, /empty[\s\S]*unavailable[\s\S]*non-authoritative/iu);
  });

  test("publishes a chain-4663 direct-chain terminal entry point with dynamic roots", async () => {
    const [page, home, sitemap, readme, docsIndex, llms, llmsFull] =
      await Promise.all([
        read("public/robinhood-terminal-indexer.html"),
        read("public/index.html"),
        read("public/sitemap.xml"),
        read("README.md"),
        read("docs/README.md"),
        read("llms.txt"),
        read("llms-full.txt"),
      ]);
    const publicUrl =
      "https://developers.programmable.family/robinhood-terminal-indexer";

    assert.match(page, /eip155:4663/u);
    assert.match(page, /platformId[\s\S]*programmable/u);
    assert.match(page, /category[\s\S]*custom/u);
    assert.match(page, /Programmable Custom/u);
    assert.match(page, /CustomGraph = 1/u);
    assert.match(page, /direct-chain/iu);
    assert.match(page, /hosted[\s\S]*(?:planned|unavailable)/iu);
    assert.match(page, /\/api\/v2\/manifests\/4663/u);
    assert.match(page, /programmable-launch-stamp-router-v1\.json/u);
    assert.doesNotMatch(page, /0x[0-9a-f]{40}/iu);

    assert.match(home, /href="\/robinhood-terminal-indexer"/u);
    for (const source of [sitemap, readme, docsIndex, llms, llmsFull]) {
      assert.ok(source.includes(publicUrl));
    }
  });
});
