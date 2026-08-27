import { pathToFileURL } from "node:url";
import path from "node:path";

import { REPOSITORY_ROOT } from "./lib/files.mjs";
import { lintOpenApiGraph } from "./lib/openapi.mjs";

const entry = pathToFileURL(
  path.join(REPOSITORY_ROOT, "openapi", "programmable-v2.yaml"),
);
const result = await lintOpenApiGraph(entry);

process.stdout.write(
  `OpenAPI strict graph OK: ${result.documentCount} documents, ` +
    `${result.referenceDocumentCount} referenced documents\n`,
);
