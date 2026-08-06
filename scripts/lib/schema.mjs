import path from "node:path";
import AjvDraft7 from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { listFiles, readJson, REPOSITORY_ROOT } from "./files.mjs";

export async function createSchemaRegistry(version = "v1") {
  if (version !== "v1" && version !== "v2") {
    throw new Error(`Unsupported schema version: ${version}`);
  }
  const schemaDirectory = path.join(REPOSITORY_ROOT, "schemas", version);
  const files = await listFiles(schemaDirectory, (file) => file.endsWith(".json"));
  const schemas = new Map();
  const identifiers = new Set();

  for (const file of files) {
    const schema = await readJson(file);
    const expectedId = `https://developers.programmable.family/schemas/${version}/${path.basename(file)}`;
    const canonicalProducerSchema =
      version === "v2" &&
      path.basename(file) ===
        "custom-launch-registry-record-v3.schema.json" &&
      schema.$schema === "http://json-schema.org/draft-07/schema#" &&
      schema.$id ===
        "https://schemas.programmable.family/autonomous-approval/v1/custom-launch-registry-record-v3.schema.json";
    if (
      schema.$schema !== "https://json-schema.org/draft/2020-12/schema" &&
      !canonicalProducerSchema
    ) {
      throw new Error(
        `${path.basename(file)} must use JSON Schema 2020-12 or the exact canonical Registry v3 producer schema`,
      );
    }
    if (!canonicalProducerSchema && schema.$id !== expectedId) {
      throw new Error(`${path.basename(file)} must use canonical $id ${expectedId}`);
    }
    if (identifiers.has(schema.$id)) {
      throw new Error(`${path.basename(file)} has a duplicate $id`);
    }
    identifiers.add(schema.$id);
    rejectRemoteReferences(schema, file);
    schemas.set(path.basename(file), schema);
  }

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: true,
    validateFormats: false,
  });
  const draft7Ajv = new AjvDraft7({
    allErrors: true,
    strict: true,
    strictRequired: true,
  });
  for (const schema of schemas.values()) {
    if (schema.$schema === "http://json-schema.org/draft-07/schema#") {
      draft7Ajv.addSchema(schema);
    } else {
      ajv.addSchema(schema);
    }
  }
  for (const schema of schemas.values()) {
    const selected = schema.$schema === "http://json-schema.org/draft-07/schema#"
      ? draft7Ajv
      : ajv;
    selected.getSchema(schema.$id);
  }

  function validator(name) {
    const schema = schemas.get(name);
    if (!schema) throw new Error(`Unknown schema: ${name}`);
    const selected = schema.$schema === "http://json-schema.org/draft-07/schema#"
      ? draft7Ajv
      : ajv;
    const validate = selected.getSchema(schema.$id);
    if (!validate) throw new Error(`Schema did not compile: ${name}`);
    return validate;
  }

  return { ajv, draft7Ajv, files, schemas, validator };
}

function rejectRemoteReferences(value, file) {
  if (Array.isArray(value)) {
    for (const item of value) rejectRemoteReferences(item, file);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (
    typeof value.$ref === "string" &&
    /^(https?:)?\/\//.test(value.$ref)
  ) {
    throw new Error(`${path.basename(file)} contains remote $ref ${value.$ref}`);
  }
  for (const child of Object.values(value)) rejectRemoteReferences(child, file);
}

export function validationSummary(validate) {
  return (validate.errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.keyword}: ${error.message}`)
    .join("; ");
}

export function assertValid(validate, value, label) {
  if (!validate(value)) {
    throw new Error(`${label} is schema-invalid: ${validationSummary(validate)}`);
  }
}
