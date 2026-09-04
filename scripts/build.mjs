import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderRobinhoodReference } from "./lib/reference-page.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(repositoryRoot, "public");

const trees = [
  "abis",
  "deployments",
  "event-sets",
  "openapi",
  "schemas",
  "specifications",
];
const files = ["llms.txt", "llms-full.txt"];
const schemaIndexes = ["v1", "v2"];

await mkdir(publicRoot, { recursive: true });

for (const tree of trees) {
  await rm(resolve(publicRoot, tree), { recursive: true, force: true });
  await cp(resolve(repositoryRoot, tree), resolve(publicRoot, tree), {
    recursive: true,
    force: true,
  });
}

for (const file of files) {
  await cp(resolve(repositoryRoot, file), resolve(publicRoot, file), {
    force: true,
  });
}

for (const version of schemaIndexes) {
  await cp(
    resolve(repositoryRoot, `schema-index-${version}.json`),
    resolve(publicRoot, `schemas/${version}/index.json`),
    { force: true },
  );
}

const reference = await readFile(resolve(repositoryRoot, "docs/guides/robinhood-terminal-indexer.md"), "utf8");
await writeFile(resolve(publicRoot, "robinhood-terminal-indexer.html"), renderRobinhoodReference(reference));
await writeFile(resolve(publicRoot, "robinhood-terminal-indexer.md"), reference);

console.log("Static developer resources and Markdown reference built in public/.");
