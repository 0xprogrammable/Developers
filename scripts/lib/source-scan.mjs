import { readFile } from "node:fs/promises";
import path from "node:path";
import { listFiles, readJson, REPOSITORY_ROOT } from "./files.mjs";

const ADDRESS_PATTERN = /0x[0-9a-fA-F]{40}/g;
const GUIDANCE_DIRECTORIES = ["docs", "examples"];
const GUIDANCE_ROOT_FILES = ["README.md"];

export async function hardcodedDeploymentFindings() {
  const manifestPath = path.join(REPOSITORY_ROOT, "deployments", "ethereum.json");
  const manifest = await readJson(manifestPath);
  const deploymentAddresses = new Set(
    manifest.deployments.flatMap((deployment) =>
      Object.values(deployment.contracts ?? {}).map((address) => address.toLowerCase()),
    ),
  );
  if (manifest.customRegistry?.address) {
    deploymentAddresses.add(manifest.customRegistry.address.toLowerCase());
  }

  const files = [];
  for (const file of GUIDANCE_ROOT_FILES) files.push(path.join(REPOSITORY_ROOT, file));
  for (const directory of GUIDANCE_DIRECTORIES) {
    files.push(
      ...(await listFiles(path.join(REPOSITORY_ROOT, directory), (file) =>
        /\.(md|mjs|js|sh)$/.test(file),
      )),
    );
  }

  const findings = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const address of source.match(ADDRESS_PATTERN) ?? []) {
      if (deploymentAddresses.has(address.toLowerCase())) {
        findings.push(
          `${path.relative(REPOSITORY_ROOT, file)} hardcodes deployment address ${address}`,
        );
      }
    }
    if (/deployments\s*\[\s*0\s*\]/.test(source)) {
      findings.push(
        `${path.relative(REPOSITORY_ROOT, file)} assumes the first deployment is canonical`,
      );
    }
  }
  return findings;
}
