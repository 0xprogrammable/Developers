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
      "/api/v1/status",
      "/api/v1/manifest",
      "/api/v1/launches",
      "/api/v1/token-list",
    ]) {
      assert.ok(readme.includes(endpoint), `README is missing ${endpoint}`);
    }
    assert.ok(readme.includes(FEE_RECIPIENT));
    assert.match(readme, /10 basis points, or 0\.1%/);
    assert.match(readme, /v1 API is read-only/i);
    assert.match(readme, /Open Custom intake and Custom Registry \| Prelaunch/);
  });

  test("never presents the read-only feed as transaction authorization", async () => {
    const reference = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"),
      "utf8",
    );
    assert.match(reference, /never returns transaction payloads/i);
    assert.match(reference, /neither authorizes nor constructs/i);
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
        path.join(REPOSITORY_ROOT, "schema-index-v1.json"),
        "utf8",
      ),
    );
    const vercel = JSON.parse(
      await readFile(path.join(REPOSITORY_ROOT, "vercel.json"), "utf8"),
    );

    assert.equal(schemaIndex.baseUrl, wellKnown.schemasBaseUrl);
    assert.deepEqual(
      schemaIndex.schemas.map(({ name }) => name),
      [
        "common",
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
          source === "/schemas/v1" &&
          destination === "/schemas/v1/index.json",
      ),
    );
  });
});
