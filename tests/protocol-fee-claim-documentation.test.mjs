import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

describe("protocol fee claim documentation", () => {
  test("publishes the operator console and read-only discovery policy", async () => {
    const reference = await read("docs/reference/protocol-fee-claims.md");

    assert.match(reference, /https:\/\/claimhazard\.vercel\.app$/m);
    assert.match(
      reference,
      /https:\/\/claimhazard\.vercel\.app\/claim-discovery\.json/,
    );
    assert.match(reference, /not a\s+transaction, signature, approval/i);
    assert.match(reference, /Developer API remains read-only/i);
  });

  test("keeps source coverage and future admission exact", async () => {
    const reference = await read("docs/reference/protocol-fee-claims.md");

    assert.match(reference, /Classic V3 and V2/);
    assert.match(reference, /Classic V1/);
    assert.match(reference, /11 current and 7 legacy claim legs/);
    assert.match(reference, /complete canonical Registry event history/i);
    assert.match(reference, /supported 5 or 10 bps/);
    assert.match(reference, /Custom Registry V2/);
    assert.match(reference, /Remains `HOLD`/);
    assert.match(reference, /arbitrary Custom\s+hook requires a reviewed/i);
  });

  test("documents the one-wallet atomic fail-closed boundary", async () => {
    const reference = await read("docs/reference/protocol-fee-claims.md");

    assert.match(
      reference,
      /0x4957f49620AFf3Adbbe8195a4f633E49cc93376c/,
    );
    assert.match(reference, /one atomic EIP-5792 `wallet_sendCalls`\s+batch/);
    assert.match(reference, /fails closed\s+and sends no partial sequence/i);
    assert.match(
      reference,
      /Unknown or mismatched sources\s+block the common claim/i,
    );
  });

  test("indexes the reference in GitHub and agent documentation", async () => {
    const [readme, docsIndex, llms, llmsFull, fees] = await Promise.all([
      read("README.md"),
      read("docs/README.md"),
      read("llms.txt"),
      read("llms-full.txt"),
      read("docs/reference/fees.md"),
    ]);

    for (const content of [readme, docsIndex, llms, llmsFull, fees]) {
      assert.match(content, /Protocol fee claim discovery/i);
    }
  });
});
