import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";

import {
  readBoundedBytes,
  readBoundedJson,
} from "../server/bounded-body.js";
import { parseQuantity } from "../server/rpc.js";

describe("network response boundaries", () => {
  test("reads a valid JSON response within the byte limit", async () => {
    const response = new Response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    });
    assert.deepEqual(await readBoundedJson(response, 64), { ok: true });
  });

  test("rejects an oversized declared response before reading it", async () => {
    const response = new Response("{}", {
      headers: { "content-length": "1000" },
    });
    await assert.rejects(() => readBoundedBytes(response, 16), /byte limit/);
  });

  test("stops an oversized streamed response without relying on Content-Length", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(12));
          controller.enqueue(new Uint8Array(12));
          controller.close();
        },
      }),
    );
    await assert.rejects(() => readBoundedBytes(response, 16), /byte limit/);
  });

  test("rejects RPC quantities larger than one EVM word", () => {
    assert.equal(parseQuantity("0xff"), 255);
    assert.throws(() => parseQuantity(`0x1${"0".repeat(64)}`), /invalid RPC quantity/);
  });

  test("fails closed when a production cursor signing key is missing", () => {
    const moduleUrl = new URL("../server/http.js", import.meta.url).href;
    const sortKey = `0000000000000001:0000000000:0000000000:0x${"1".repeat(40)}`;
    const script = `import { encodeCursor } from ${JSON.stringify(moduleUrl)}; encodeCursor(${JSON.stringify(sortKey)});`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", script],
      { encoding: "utf8", env: { NODE_ENV: "production" } },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /production cursor signing key is unavailable/);
  });
});
