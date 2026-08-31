import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const MANIFESTS = ["ethereum-v2.json", "robinhood-v2.json"];

async function apiEntries(directory, prefix = "api/v2") {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      result.push(...await apiEntries(path.join(directory, entry.name), relative));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      result.push(relative);
    }
  }
  return result.sort();
}

export async function verifyVercelFunctionManifests(root) {
  const entries = await apiEntries(path.join(root, "api/v2"));
  if (entries.length === 0) throw new TypeError("Vercel V2 API source entries are missing");
  const expected = await Promise.all(MANIFESTS.map((name) =>
    readFile(path.join(root, "deployments", name))));
  for (const entry of entries) {
    const functionRoot = path.join(root, ".vercel/output/functions",
      entry.replace(/\.js$/u, ".func"));
    for (const [index, name] of MANIFESTS.entries()) {
      let actual;
      try {
        actual = await readFile(path.join(functionRoot, "deployments", name));
      } catch {
        throw new TypeError(`Vercel function ${entry} is missing ${name}`);
      }
      if (!actual.equals(expected[index])) {
        throw new TypeError(`Vercel function ${entry} has a changed ${name}`);
      }
    }
  }
  return { apiFunctionCount: entries.length, manifestChecks: entries.length * MANIFESTS.length };
}
