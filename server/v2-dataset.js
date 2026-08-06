import { readFile } from "node:fs/promises";

import { API_V2_SCHEMA_VERSION } from "./constants.js";
import { feedStatus, getDataset } from "./dataset.js";

let manifestPromise = null;

function isRegisteredCustom(record) {
  return Boolean(
    record?.category === "custom" &&
      record.launch?.modelId !== "stock-paired" &&
      record.launch?.publicSubmission === true &&
      record.launch?.transactionHash &&
      record.launch?.blockNumber !== null &&
      record.launch?.logIndex !== null &&
      record.verification?.registryAddress &&
      record.verification?.provenanceStatus === "verified",
  );
}

export function isV2PublicLaunch(record) {
  if (record?.category === "classic") {
    return record.launch?.modelId === "classic";
  }
  return isRegisteredCustom(record);
}

function classification(record) {
  const isClassic = record.category === "classic";
  return {
    namespace: "programmable",
    category: record.category,
    label: isClassic ? "Programmable Classic" : "Programmable Custom",
    basis: isClassic
      ? "recognized-classic-launcher-event"
      : "programmable-custom-registry-event",
  };
}

export function projectV2Record(record) {
  return {
    ...record,
    schemaVersion: API_V2_SCHEMA_VERSION,
    extensions: {
      ...record.extensions,
      "programmable/classification": classification(record),
    },
  };
}

export function projectV2Dataset(dataset) {
  const records = dataset.records
    .filter(isV2PublicLaunch)
    .map(projectV2Record);
  const counts = {
    total: records.length,
    classic: records.filter((record) => record.category === "classic").length,
    custom: records.filter((record) => record.category === "custom").length,
  };
  return {
    records,
    status: {
      ...dataset.status,
      schemaVersion: API_V2_SCHEMA_VERSION,
      counts,
    },
  };
}

export async function getV2Dataset() {
  return projectV2Dataset(await getDataset());
}

export function serviceStatusV2(status, customRegistryStatus = "prelaunch") {
  const routesAvailable = Boolean(
    status.coverage?.status === "complete" && status.coverage?.checkpoint,
  );
  const feeds = routesAvailable ? feedStatus(status.status) : "unavailable";
  return {
    schemaVersion: API_V2_SCHEMA_VERSION,
    apiVersion: "2",
    service: feeds === "ready" ? "operational" : "degraded",
    checkedAt: status.generatedAt,
    chainId: status.chainId,
    classic: {
      status: "live",
      note: "Current and historical Programmable Classic launches are discoverable.",
    },
    custom: {
      status: customRegistryStatus === "live" ? "live" : "prelaunch",
      note:
        customRegistryStatus === "live"
          ? "Approved Custom Registry launches are discoverable as Programmable Custom."
          : "Programmable Custom begins with approved Custom Registry launches. No registry deployment is published yet.",
    },
    feeds: {
      manifest: "ready",
      launches: feeds,
      tokenList: feeds,
    },
    source: status.source,
    chain: status.chain,
    coverage: status.coverage,
    counts: status.counts,
    errors: status.errors,
  };
}

export async function developerManifestV2() {
  manifestPromise ??= readFile(
    new URL("../deployments/ethereum-v2.json", import.meta.url),
    "utf8",
  ).then((source) => JSON.parse(source));
  return structuredClone(await manifestPromise);
}
