import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = fileURLToPath(
  new URL("../../", import.meta.url),
);

export async function listFiles(directory, predicate = () => true) {
  const output = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && predicate(absolute)) output.push(absolute);
    }
  }
  await visit(directory);
  return output;
}

export async function readJson(file) {
  const source = await readFile(file, "utf8");
  return JSON.parse(source);
}

export async function assertCanonicalJson(file) {
  const source = await readFile(file, "utf8");
  const canonical = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
  if (source !== canonical) {
    throw new Error(`${path.relative(REPOSITORY_ROOT, file)} is not canonical JSON`);
  }
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function pointerSegments(pointer) {
  if (!pointer.startsWith("/")) throw new Error(`Invalid JSON pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function getAtPointer(value, pointer) {
  if (pointer === "") return value;
  return pointerSegments(pointer).reduce((current, segment) => {
    if (current === null || current === undefined) return undefined;
    return current[segment];
  }, value);
}

export function setAtPointer(value, pointer, nextValue) {
  const segments = pointerSegments(pointer);
  const leaf = segments.pop();
  let current = value;
  for (const segment of segments) {
    if (current[segment] === undefined) {
      current[segment] = /^\d+$/.test(segment) ? [] : {};
    }
    current = current[segment];
  }
  current[leaf] = nextValue;
}

export function applyMutations(value, mutations) {
  const output = cloneJson(value);
  for (const mutation of mutations) {
    if (mutation.operation === "set") {
      setAtPointer(output, mutation.path, cloneJson(mutation.value));
      continue;
    }
    if (mutation.operation === "copy") {
      const source = getAtPointer(output, mutation.from);
      if (source === undefined) throw new Error(`Mutation source not found: ${mutation.from}`);
      setAtPointer(output, mutation.path, cloneJson(source));
      continue;
    }
    throw new Error(`Unsupported fixture mutation: ${mutation.operation}`);
  }
  return output;
}
