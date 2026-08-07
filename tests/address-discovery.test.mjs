import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";
import { listFiles, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { hardcodedDeploymentFindings } from "../scripts/lib/source-scan.mjs";

const FEE_RECIPIENT = "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";

describe("documentation contract", () => {
  test("does not hardcode any launcher, hook, coordinator, or registry address", async () => {
    assert.deepEqual(await hardcodedDeploymentFindings(), []);
  });

  test("publishes the required read-only endpoints and fee disclosure", async () => {
    const readme = await readFile(path.join(REPOSITORY_ROOT, "README.md"), "utf8");
    for (const endpoint of [
      "/api/v2/status",
      "/api/v2/manifest",
      "/api/v2/launches",
      "/api/v2/token-list",
    ]) {
      assert.ok(readme.includes(endpoint), `README is missing ${endpoint}`);
    }
    assert.ok(readme.includes(FEE_RECIPIENT));
    assert.match(readme, /10 basis points, or 0\.1%/);
    assert.match(readme, /v2 API is read-only/i);
    assert.match(readme, /Programmable Custom Registry discovery \| Live on Ethereum/i);
    assert.match(readme, /Programmable Custom public intake \| Prelaunch/i);
    assert.match(readme, /Stock-Paired records are not part of the v2/i);
  });

  test("never presents the read-only feed as transaction authorization", async () => {
    const reference = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"),
      "utf8",
    );
    assert.match(reference, /never returns transaction payloads/i);
    assert.match(reference, /neither authorizes nor constructs/i);
  });

  test("publishes one bounded ingestion reference and explicit manifest precedence", async () => {
    const quickstart = await readFile(
      path.join(REPOSITORY_ROOT, "docs/quickstart.md"),
      "utf8",
    );
    const reference = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"),
      "utf8",
    );
    for (const contract of [
      /maximumPages = 1_000/,
      /AbortSignal\.timeout\(10_000\)/,
      /attempt <= 3/,
      /retry-after/,
      /Page cursor loop detected/,
      /recordsByLaunchId\.set\(record\.launchId, record\)/,
      /commitRecordsAndCursor\(backfill\)/,
      /ingestTraversal\(durableResumeCursor\)/,
    ]) {
      assert.match(quickstart, contract);
    }
    assert.match(reference, /operational presentation mirror/i);
    assert.match(reference, /Developer manifest.*takes precedence/i);
    assert.match(reference, /must not be resolved by merging fields/i);
  });

  test("all local Markdown links resolve", async () => {
    const files = [
      path.join(REPOSITORY_ROOT, "README.md"),
      ...(await listFiles(path.join(REPOSITORY_ROOT, "docs"), (file) =>
        file.endsWith(".md"),
      )),
    ];
    const failures = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].trim();
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const pathOnly = target.split("#", 1)[0];
        if (!pathOnly) continue;
        try {
          await access(path.resolve(path.dirname(file), pathOnly));
        } catch {
          failures.push(`${path.relative(REPOSITORY_ROOT, file)} -> ${target}`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  test("publishes an openable index for the advertised schema base URL", async () => {
    const wellKnown = JSON.parse(
      await readFile(
        path.join(REPOSITORY_ROOT, "public/.well-known/programmable.json"),
        "utf8",
      ),
    );
    const schemaIndex = JSON.parse(
      await readFile(
        path.join(REPOSITORY_ROOT, "schema-index-v2.json"),
        "utf8",
      ),
    );
    const vercel = JSON.parse(
      await readFile(path.join(REPOSITORY_ROOT, "vercel.json"), "utf8"),
    );

    assert.equal(schemaIndex.baseUrl, wellKnown.schemasBaseUrl);
    const manifest = JSON.parse(
      await readFile(
        path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
        "utf8",
      ),
    );
    assert.deepEqual(wellKnown.publicCategories.custom, {
      discoveryStatus: "live",
      publicSubmissionStatus: "prelaunch",
      registryAddress: manifest.customRegistry.address,
      registryStartBlock: manifest.customRegistry.startBlock,
      registryGeneration: manifest.customRegistry.generation,
      note: "Finalized approved Custom Registry launches are discoverable. General public submissions remain prelaunch.",
    });
    assert.deepEqual(
      schemaIndex.schemas.map(({ name }) => name),
      [
        "common",
        "canonical-custom-registry-record-v3",
        "canonical-custom-registry-record-v4",
        "launch-feed",
        "launch",
        "manifest",
        "problem",
        "status",
        "token-list",
      ],
    );
    assert.ok(
      vercel.rewrites.some(
        ({ source, destination }) =>
          source === "/schemas/v2" &&
          destination === "/schemas/v2/index.json",
      ),
    );
  });
});
