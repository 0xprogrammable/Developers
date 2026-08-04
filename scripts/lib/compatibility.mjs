const DOCUMENTATION_KEYS = new Set([
  "$comment",
  "description",
  "examples",
  "title",
]);

function stable(value) {
  return JSON.stringify(value, Object.keys(value ?? {}).sort());
}

function compareNode(previous, current, path, findings) {
  if (!previous || typeof previous !== "object") return;
  if (!current || typeof current !== "object") {
    findings.push(`${path || "/"} was removed or changed type`);
    return;
  }

  if (Array.isArray(previous)) {
    if (!Array.isArray(current) || stable(previous) !== stable(current)) {
      findings.push(`${path || "/"} changed a frozen array constraint`);
    }
    return;
  }

  for (const [key, previousValue] of Object.entries(previous)) {
    if (DOCUMENTATION_KEYS.has(key)) continue;
    if (!(key in current)) {
      findings.push(`${path}/${key} was removed`);
      continue;
    }
    if (key === "properties" || key === "$defs") {
      for (const [property, propertySchema] of Object.entries(previousValue)) {
        if (!(property in current[key])) {
          findings.push(`${path}/${key}/${property} was removed`);
        } else {
          compareNode(
            propertySchema,
            current[key][property],
            `${path}/${key}/${property}`,
            findings,
          );
        }
      }
      continue;
    }
    if (previousValue && typeof previousValue === "object") {
      compareNode(previousValue, current[key], `${path}/${key}`, findings);
      continue;
    }
    if (current[key] !== previousValue) {
      findings.push(`${path}/${key} changed from ${previousValue} to ${current[key]}`);
    }
  }

  const previousRequired = previous.required ?? [];
  const currentRequired = current.required ?? [];
  if (stable(previousRequired) !== stable(currentRequired)) {
    findings.push(`${path || "/"}/required changed within v1`);
  }

  if (previous.properties && current.properties) {
    for (const property of Object.keys(current.properties)) {
      if (!(property in previous.properties) && currentRequired.includes(property)) {
        findings.push(`${path}/properties/${property} is a new required v1 field`);
      }
    }
  }
}

export function compareV1Schemas(previous, current) {
  const findings = [];
  if (previous.$id !== current.$id) findings.push("/$id changed");
  compareNode(previous, current, "", findings);
  return [...new Set(findings)];
}

export function compareDeploymentManifests(previous, current) {
  const findings = [];
  const currentById = new Map(
    (current.deployments ?? []).map((deployment) => [deployment.deploymentId, deployment]),
  );
  const immutableKeys = [
    "category",
    "modelId",
    "modelVersion",
    "origin",
    "publicSubmission",
    "startBlock",
    "contracts",
  ];
  const lifecycleRank = { current: 0, legacy: 1, retired: 2 };

  for (const oldDeployment of previous.deployments ?? []) {
    const nextDeployment = currentById.get(oldDeployment.deploymentId);
    if (!nextDeployment) {
      findings.push(`deployment ${oldDeployment.deploymentId} was removed`);
      continue;
    }
    for (const key of immutableKeys) {
      if (JSON.stringify(oldDeployment[key]) !== JSON.stringify(nextDeployment[key])) {
        findings.push(`deployment ${oldDeployment.deploymentId}.${key} changed`);
      }
    }
    if (
      lifecycleRank[nextDeployment.lifecycle] < lifecycleRank[oldDeployment.lifecycle]
    ) {
      findings.push(`deployment ${oldDeployment.deploymentId} lifecycle moved backwards`);
    }
    if (
      oldDeployment.endBlock !== null &&
      oldDeployment.endBlock !== nextDeployment.endBlock
    ) {
      findings.push(`deployment ${oldDeployment.deploymentId}.endBlock changed`);
    }
    if (
      oldDeployment.evidence &&
      JSON.stringify(oldDeployment.evidence) !== JSON.stringify(nextDeployment.evidence)
    ) {
      findings.push(`deployment ${oldDeployment.deploymentId}.evidence changed`);
    }
  }

  if (
    JSON.stringify(previous.platformFee) !== JSON.stringify(current.platformFee)
  ) {
    findings.push("platformFee changed within v1");
  }
  if (previous.customRegistry?.address && previous.customRegistry.address !== current.customRegistry?.address) {
    findings.push("customRegistry.address changed after publication");
  }
  if (
    previous.customRegistry?.startBlock !== null &&
    previous.customRegistry?.startBlock !== current.customRegistry?.startBlock
  ) {
    findings.push("customRegistry.startBlock changed after publication");
  }
  return findings;
}

export function assertCoreContract(core, launchSchema, feedSchema) {
  const findings = [];
  if (launchSchema.properties?.schemaVersion?.$ref === undefined) {
    findings.push("launch schemaVersion is not bound to common v1 version");
  }
  if (stable(launchSchema.required) !== stable(core.launchRequired)) {
    findings.push("launch required fields drifted from compatibility/core-v1.json");
  }
  if (stable(feedSchema.required) !== stable(core.feedRequired)) {
    findings.push("feed required fields drifted from compatibility/core-v1.json");
  }
  const categories = launchSchema.properties?.category?.$ref;
  if (!categories?.includes("common.schema.json")) {
    findings.push("launch category no longer references the frozen common category");
  }
  for (const pointer of core.closedTrustObjects) {
    const parts = pointer.slice(1).split("/");
    let node = launchSchema;
    for (const part of parts) node = node?.[part];
    if (node?.additionalProperties !== false) {
      findings.push(`${pointer} is no longer closed to unrecognized trust fields`);
    }
  }
  return findings;
}
