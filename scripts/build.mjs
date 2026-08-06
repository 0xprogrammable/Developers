import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(repositoryRoot, "public");

const trees = ["abis", "deployments", "openapi", "schemas"];
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

console.log("Static developer resources copied to public/.");
