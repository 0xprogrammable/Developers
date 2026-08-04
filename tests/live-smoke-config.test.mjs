import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("live smoke allows a bounded serverless cold start", async () => {
  const source = await readFile(
    path.join(REPOSITORY_ROOT, "scripts/live-smoke.mjs"),
    "utf8",
  );

  assert.match(source, /const TIMEOUT_MS = 30_000;/u);
  assert.match(source, /signal: AbortSignal\.timeout\(TIMEOUT_MS\)/u);
});
