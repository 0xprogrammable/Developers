import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

describe("public repository navigation", () => {
  test("uses the current Programmable organization for mutable links", async () => {
    const files = [
      ".github/ISSUE_TEMPLATE/config.yml",
      "README.md",
      "SECURITY.md",
      "SUPPORT.md",
      "docs/README.md",
      "llms.txt",
      "llms-full.txt",
      "package.json",
      "public/.well-known/programmable.json",
      "public/index.html",
    ];
    const contents = await Promise.all(files.map(read));
    const retiredOwner = "0x" + "programmable";

    for (const [index, content] of contents.entries()) {
      assert.doesNotMatch(
        content,
        new RegExp(
          `(?:github\\.com|raw\\.githubusercontent\\.com)/${retiredOwner}/(?:Developers|developers|Launch-Policy)`,
          "u",
        ),
        files[index],
      );
      assert.doesNotMatch(
        content,
        new RegExp(
          `github\\.com/${retiredOwner}/PROGRAMMABLE/releases`,
          "u",
        ),
        files[index],
      );
    }

    assert.match(
      await read("llms.txt"),
      /Source repository: https:\/\/github\.com\/programmablehq\/Developers/u,
    );
    assert.match(
      await read("public/index.html"),
      /https:\/\/github\.com\/programmablehq\/Developers/u,
    );
    assert.equal(
      JSON.parse(await read("public/.well-known/programmable.json")).sourceUrl,
      "https://github.com/programmablehq/Developers",
    );
  });
});
