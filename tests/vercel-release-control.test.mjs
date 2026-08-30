import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";

import { canonicalSha256, canonicalizeJson } from "../server/canonical.js";
import { keccak256 } from "../server/keccak.js";
import {
  CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
  CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
  CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
  CANONICAL_PROMOTION_BUNDLE_PATH,
  CANONICAL_STAGE_BUNDLE_PATH,
  DEVELOPERS_PROMOTION_INPUT_SCHEMA,
  PROMOTION_BUNDLE_SCHEMA,
  PROMOTION_PLAN_SCHEMA,
  PLANNED_DEPLOY_AUTHORIZATION_SCHEMA,
  PLANNED_DEPLOY_RECEIPT_SCHEMA,
  PLANNED_SMOKE_SCHEMA,
  PRODUCTION_ORIGIN,
  VERCEL_PRODUCTION_ORIGIN,
  PUBLIC_AUTHORIZATION_SCHEMA,
  PUBLIC_MUTATION_INTENT_SCHEMA,
  PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA,
  PUBLIC_MUTATION_RECOVERY_ATTEMPT_PROVENANCE_SCHEMA,
  PUBLIC_MUTATION_RECOVERY_READINESS_SCHEMA,
  RECOVERED_PROMOTION_RECEIPT_SCHEMA,
  RECOVERED_ROLLBACK_RECEIPT_SCHEMA,
  RELEASE_CONSTANTS,
  ROLLBACK_PLAN_SCHEMA,
  STAGE_RECEIPT_SCHEMA,
  STAGE_BUNDLE_SCHEMA,
  assertVercelDeploymentMetadata,
  assertVercelProjectBinding,
  assertVercelStagedDeployment,
  createPromotionPlan,
  createPromotionReceipt,
  createPublicAuthorization,
  createRollbackPlan,
  createRollbackReceipt,
  createSmokeReceipt,
  createStageProtectionEvidence,
  createStageReceipt,
  createVercelMutationControlEvidence,
  createVercelProductionBinding,
  createVercelProductionDomainInventory,
  createVercelProviderAliasBinding,
  createVercelProviderDeploymentResolution,
  createVercelPublicAliasBinding,
  createVercelPublicDeploymentResolution,
  createEvidenceOnlySourceTransition,
  createPlannedDeployAuthorization,
  createPlannedDeployReceipt,
  createPreMutationState,
  createPublicMutationIntent,
  createPublicMutationRecoveryAttempt,
  createPublicMutationRecoveryReadiness,
  createRecoveredPromotionReceipt,
  createRecoveredRollbackReceipt,
  frozenEthereumV3Identity,
  hashBuildOutput,
  normalizeVercelDeployment,
  parsePromotionBundle,
  parseIndexerReleaseAudit,
  parseStageBundle,
  parsePromotionPlan,
  parsePromotionReceipt,
  parseGitHubOwnerDispatchAuthorization,
  parsePlannedDeployAuthorization,
  parsePlannedDeployReceipt,
  parsePublicMutationIntent,
  parsePublicMutationIntentProvenance,
  parsePublicMutationRecoveryAttempt,
  parsePublicMutationRecoveryAttemptProvenance,
  parsePublicMutationRecoveryReadiness,
  parsePreMutationState,
  parsePublicAuthorization,
  parseRollbackPlan,
  parseRollbackReceipt,
  parseStageReceipt,
  parseVercelProductionBinding,
  parseVercelProductionDomainInventory,
  parseVercelProviderAliasBinding,
  parseVercelProviderDeploymentResolution,
  parseVercelPublicAliasBinding,
  parseVercelPublicDeploymentResolution,
  releaseSource,
  releaseTarget,
  releaseWorkflow,
  releaseRecoveryWorkflow,
  validateLiveRobinhoodManifest,
  validateGitHubArtifactEvidence,
  validateGitHubOwnerDispatchAuthorization,
  validateGitHubRunEvidence,
  validatePublicMutationIntentProvenance,
  validatePublicMutationRecoveryAttemptProvenance,
  validatePlannedPublicMutationReadiness,
  validatePreMutationReadiness,
  validatePlannedRobinhoodManifest,
} from "../scripts/lib/vercel-release.mjs";
import {
  PROTECTION_PROBE_RETRY_DELAYS_MS,
  PROTECTION_PROBE_TIMEOUT_MS,
  probeGeneratedDeploymentProtection,
} from "../scripts/lib/vercel-protection-probe.mjs";

const sha = (character) => `sha256:${character.repeat(64)}`;
const hash = (character) => `0x${character.repeat(64)}`;
const source = releaseSource(
  "a".repeat(40),
  "b".repeat(40),
);
const promotionSource = releaseSource(
  "c".repeat(40),
  "d".repeat(40),
);
const target = releaseTarget("team_programmable", "prj_developers");
const workflow = releaseWorkflow({
  repository: "programmablehq/Developers",
  workflowRef: "programmablehq/Developers/.github/workflows/vercel-release.yml@refs/heads/main",
  runId: "12345",
  runAttempt: "1",
  actor: "hazarxyz",
  actorId: "258789013",
});
const recoverySource = releaseSource("e".repeat(40), "f".repeat(40));
const recoveryWorkflow = releaseRecoveryWorkflow({
  repository: "programmablehq/Developers",
  workflowRef:
    "programmablehq/Developers/.github/workflows/vercel-release-recovery.yml@refs/heads/main",
  runId: "67890",
  runAttempt: "1",
  actor: "hazarxyz",
  actorId: "258789013",
});

function actionsRunEvidence(runSource = source) {
  return validateGitHubRunEvidence({
    id: Number(workflow.runId),
    run_attempt: Number(workflow.runAttempt),
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_sha: runSource.revision,
    head_branch: "main",
    path: ".github/workflows/vercel-release.yml",
    name: "Vercel release control",
    html_url: `https://github.com/programmablehq/Developers/actions/runs/${workflow.runId}`,
    repository: { full_name: "programmablehq/Developers" },
    actor: { login: workflow.actor, id: Number(workflow.actorId) },
    triggering_actor: { login: workflow.actor, id: Number(workflow.actorId) },
    head_commit: { id: runSource.revision, tree_id: runSource.tree },
  }, { runId: workflow.runId, runAttempt: workflow.runAttempt });
}

function recoveryActionsRunEvidence(runSource = recoverySource) {
  return validateGitHubRunEvidence({
    id: Number(recoveryWorkflow.runId),
    run_attempt: Number(recoveryWorkflow.runAttempt),
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_sha: runSource.revision,
    head_branch: "main",
    path: ".github/workflows/vercel-release-recovery.yml",
    name: "Vercel release recovery",
    html_url:
      `https://github.com/programmablehq/Developers/actions/runs/${recoveryWorkflow.runId}`,
    repository: { full_name: "programmablehq/Developers" },
    actor: { login: recoveryWorkflow.actor, id: Number(recoveryWorkflow.actorId) },
    triggering_actor: {
      login: recoveryWorkflow.actor,
      id: Number(recoveryWorkflow.actorId),
    },
    head_commit: { id: runSource.revision, tree_id: runSource.tree },
  }, {
    runId: recoveryWorkflow.runId,
    runAttempt: recoveryWorkflow.runAttempt,
    workflowRefs: [
      workflow.workflowRef,
      recoveryWorkflow.workflowRef,
    ],
  });
}

function actionsArtifact(name, artifactSource = source, id = 101, archive = null) {
  return validateGitHubArtifactEvidence({
    artifacts: [{
      id,
      name,
      digest: sha256Bytes(archive ?? Buffer.from(name, "utf8")),
      size_in_bytes: archive?.byteLength ?? 4096,
      expired: false,
      workflow_run: {
        id: Number(workflow.runId),
        head_branch: "main",
        head_sha: artifactSource.revision,
      },
    }],
  }, {
    name,
    runId: workflow.runId,
    runAttempt: workflow.runAttempt,
    sourceRevision: artifactSource.revision,
  });
}

function recoveryActionsArtifact(
  name, artifactSource = recoverySource, id = 201, archive = null,
) {
  return validateGitHubArtifactEvidence({
    artifacts: [{
      id,
      name,
      digest: sha256Bytes(archive ?? Buffer.from(name, "utf8")),
      size_in_bytes: archive?.byteLength ?? 4096,
      expired: false,
      workflow_run: {
        id: Number(recoveryWorkflow.runId),
        head_branch: "main",
        head_sha: artifactSource.revision,
      },
    }],
  }, {
    name,
    runId: recoveryWorkflow.runId,
    runAttempt: recoveryWorkflow.runAttempt,
    sourceRevision: artifactSource.revision,
  });
}

function storedZipEntry(entryName, bytesInput) {
  const name = Buffer.from(entryName, "utf8");
  const bytes = Buffer.from(bytesInput);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(bytes.byteLength, 18);
  local.writeUInt32LE(bytes.byteLength, 22);
  local.writeUInt16LE(name.byteLength, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(bytes.byteLength, 20);
  central.writeUInt32LE(bytes.byteLength, 24);
  central.writeUInt16LE(name.byteLength, 28);
  const centralOffset = local.byteLength + name.byteLength + bytes.byteLength;
  const centralSize = central.byteLength + name.byteLength;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, bytes, central, name, eocd]);
}

function mutationIntentProvenance(intent, archivedIntent = intent) {
  const intentCreated = Date.parse(intent.createdAt);
  const second = (value) => new Date(value).toISOString().replace(".000Z", "Z");
  const artifactName =
    `developers-vercel-mutation-intent-${intent.workflow.runId}-${intent.workflow.runAttempt}`;
  const archive = storedZipEntry(
    "public-mutation-intent.json",
    Buffer.from(`${JSON.stringify(archivedIntent, null, 2)}\n`, "utf8"),
  );
  return validatePublicMutationIntentProvenance({
    workflowRun: {
      id: Number(intent.workflow.runId),
      run_attempt: Number(intent.workflow.runAttempt),
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "failure",
      head_sha: intent.source.revision,
      head_branch: "main",
      path: ".github/workflows/vercel-release.yml",
      name: "Vercel release control",
      html_url:
        `https://github.com/programmablehq/Developers/actions/runs/${intent.workflow.runId}`,
      repository: { full_name: "programmablehq/Developers" },
      actor: { login: intent.workflow.actor, id: Number(intent.workflow.actorId) },
      triggering_actor: {
        login: intent.workflow.actor,
        id: Number(intent.workflow.actorId),
      },
      head_commit: { id: intent.source.revision, tree_id: intent.source.tree },
      created_at: second(intentCreated - 120_000),
      run_started_at: second(intentCreated - 90_000),
      updated_at: second(intentCreated + 2_000),
    },
    artifacts: {
      artifacts: [{
        id: 301,
        name: artifactName,
        digest: sha256Bytes(archive),
        size_in_bytes: archive.byteLength,
        expired: false,
        created_at: second(intentCreated),
        updated_at: second(intentCreated + 1_000),
        expires_at: second(intentCreated + 90 * 24 * 60 * 60_000),
        workflow_run: {
          id: Number(intent.workflow.runId),
          head_branch: "main",
          head_sha: intent.source.revision,
        },
      }],
    },
  }, {
    runId: intent.workflow.runId,
    runAttempt: intent.workflow.runAttempt,
    intent,
    artifactArchive: archive,
  });
}

function recoveryAttemptProvenance(attempt, {
  archivedAttempt = attempt,
  createdAt = new Date(Date.parse(attempt.authorizedAt)).toISOString().replace(".000Z", "Z"),
} = {}) {
  const archive = storedZipEntry(
    "recovery-attempt.json",
    Buffer.from(`${JSON.stringify(archivedAttempt, null, 2)}\n`, "utf8"),
  );
  const artifactName =
    `developers-vercel-recovery-attempt-${recoveryWorkflow.runId}-${recoveryWorkflow.runAttempt}`;
  return validatePublicMutationRecoveryAttemptProvenance({
    artifacts: [{
      id: 401,
      name: artifactName,
      digest: sha256Bytes(archive),
      size_in_bytes: archive.byteLength,
      expired: false,
      created_at: createdAt,
      updated_at: new Date(Date.parse(createdAt) + 1_000).toISOString().replace(".000Z", "Z"),
      expires_at: new Date(Date.parse(createdAt) + 90 * 24 * 60 * 60_000)
        .toISOString().replace(".000Z", "Z"),
      workflow_run: {
        id: Number(recoveryWorkflow.runId),
        head_branch: "main",
        head_sha: recoverySource.revision,
      },
    }],
  }, {
    attempt,
    source: recoverySource,
    workflow: recoveryWorkflow,
    artifactArchive: archive,
  });
}

function ownerDispatchAuthorization(observedAt, {
  runOverrides = {}, environmentOverrides = {}, source: runSource = promotionSource,
} = {}) {
  return validateGitHubOwnerDispatchAuthorization({
    workflowRun: {
      id: Number(workflow.runId),
      run_attempt: Number(workflow.runAttempt),
      event: "workflow_dispatch",
      status: "in_progress",
      conclusion: null,
      head_sha: runSource.revision,
      head_branch: "main",
      path: ".github/workflows/vercel-release.yml",
      name: "Vercel release control",
      repository: { full_name: "programmablehq/Developers" },
      actor: { login: workflow.actor, id: Number(workflow.actorId) },
      triggering_actor: { login: workflow.actor, id: Number(workflow.actorId) },
      head_commit: { id: runSource.revision, tree_id: runSource.tree },
      created_at: "2026-08-29T15:00:00Z",
      run_started_at: "2026-08-29T15:00:01Z",
      ...runOverrides,
    },
    environment: {
      id: 19441858925,
      name: "production",
      created_at: "2026-08-27T00:00:00Z",
      updated_at: "2026-08-27T00:05:00Z",
      can_admins_bypass: false,
      protection_rules: [{ type: "branch_policy" }],
      deployment_branch_policy: {
        protected_branches: true,
        custom_branch_policies: false,
      },
      ...environmentOverrides,
    },
  }, { workflow, source: runSource, observedAt });
}

function recoveryOwnerDispatchAuthorization(observedAt, {
  runOverrides = {}, environmentOverrides = {}, source: runSource = recoverySource,
} = {}) {
  return validateGitHubOwnerDispatchAuthorization({
    workflowRun: {
      id: Number(recoveryWorkflow.runId),
      run_attempt: Number(recoveryWorkflow.runAttempt),
      event: "workflow_dispatch",
      status: "in_progress",
      conclusion: null,
      head_sha: runSource.revision,
      head_branch: "main",
      path: ".github/workflows/vercel-release-recovery.yml",
      name: "Vercel release recovery",
      repository: { full_name: "programmablehq/Developers" },
      actor: { login: recoveryWorkflow.actor, id: Number(recoveryWorkflow.actorId) },
      triggering_actor: {
        login: recoveryWorkflow.actor,
        id: Number(recoveryWorkflow.actorId),
      },
      head_commit: { id: runSource.revision, tree_id: runSource.tree },
      created_at: "2026-08-29T15:00:00Z",
      run_started_at: "2026-08-29T15:00:01Z",
      ...runOverrides,
    },
    environment: {
      id: 19441858925,
      name: "production",
      created_at: "2026-08-27T00:00:00Z",
      updated_at: "2026-08-27T00:05:00Z",
      can_admins_bypass: false,
      protection_rules: [{ type: "branch_policy" }],
      deployment_branch_policy: {
        protected_branches: true,
        custom_branch_policies: false,
      },
      ...environmentOverrides,
    },
  }, { workflow: recoveryWorkflow, source: runSource, observedAt });
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function artifact(artifactPath, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  return {
    path: artifactPath,
    sha256: sha256Bytes(bytes),
    byteLength: String(bytes.byteLength),
    value,
  };
}

function binaryArtifact(artifactPath, bytes) {
  return {
    path: artifactPath,
    sha256: sha256Bytes(bytes),
    byteLength: String(bytes.byteLength),
    bytesBase64: bytes.toString("base64"),
  };
}

function reseal(value, schema, digestKey) {
  const { [digestKey]: _digest, ...withoutDigest } = value;
  value[digestKey] = canonicalSha256(schema, withoutDigest);
  return value;
}

function sourceVerification() {
  const root = (
    name, fullyQualifiedName, address, standardJsonInputPath, standardJsonInputSha256, character,
  ) => ({
    chainId: "4663",
    address,
    match: "exact_match",
    creationMatch: "exact_match",
    runtimeMatch: "exact_match",
    matchId: `match-${name}`,
    verifiedAt: "2026-08-29T14:50:00.000Z",
    compiler: {
      language: "Solidity",
      compiler: "solc",
      compilerVersion: "0.8.26+commit.8a97fa7a",
      name,
      fullyQualifiedName,
      compilerSettingsDigest: sha(character),
    },
    sourceFilesDigest: sha(character),
    metadataDigest: sha(character),
    urlPath: `/server/v2/contract/4663/${address}?fields=all`,
    httpStatus: 200,
    contentType: "application/json",
    responseByteLength: "1024",
    standardJsonInputPath,
    standardJsonInputSha256,
    verificationResponseDigest: sha(character),
  });
  const graphFactory = root(
    "ProgrammableCreate2GraphDeployerV1",
    "src/ProgrammableCreate2GraphDeployerV1.sol:ProgrammableCreate2GraphDeployerV1",
    RELEASE_CONSTANTS.roots.graphFactory.address,
    "contracts/spec/robinhood-custom-launch/standard-json/ProgrammableCreate2GraphDeployerV1.standard-input.json",
    "sha256:8ab811a215d70b1d5aef0c71a47153173953ee78d7632725413833888369ec4d",
    "1",
  );
  const programmableLaunchStampRouter = root(
    "ProgrammableLaunchStampRouterV1",
    "src/robinhood-custom-launch/ProgrammableLaunchStampRouterV1.sol:ProgrammableLaunchStampRouterV1",
    RELEASE_CONSTANTS.roots.programmableLaunchStampRouter.address,
    "contracts/spec/robinhood-custom-launch/standard-json/ProgrammableLaunchStampRouterV1.standard-input.json",
    "sha256:6abca24d06b013599f4ff63e049976419c3f17455fa9bc343b15ec0d6e6a078a",
    "2",
  );
  const sourcify = [
    ["graphFactory", graphFactory],
    ["programmableLaunchStampRouter", programmableLaunchStampRouter],
  ].map(([contract, entry]) => ({
    contract,
    provider: "sourcify-v2",
    chainId: entry.chainId,
    address: entry.address,
    match: entry.match,
    creationMatch: entry.creationMatch,
    runtimeMatch: entry.runtimeMatch,
    matchId: entry.matchId,
    verifiedAt: entry.verifiedAt,
    compiler: structuredClone(entry.compiler),
    sourceFilesDigest: entry.sourceFilesDigest,
    standardJsonInputPath: entry.standardJsonInputPath,
    standardJsonInputSha256: entry.standardJsonInputSha256,
    metadataDigest: entry.metadataDigest,
    urlPath: entry.urlPath,
    httpStatus: entry.httpStatus,
    contentType: entry.contentType,
    responseByteLength: entry.responseByteLength,
    responseSha256: entry.verificationResponseDigest,
  }));
  const withoutDigest = {
    schemaVersion: "programmable.robinhood-custom-launch.source-verification-closure.v2",
    provider: "sourcify-v2",
    graphFactory,
    programmableLaunchStampRouter,
    permitAuthority: {
      address: RELEASE_CONSTANTS.roots.permitAuthority.address,
      kind: "official-source-pinned",
      sourceCommitment:
        "sha256:4591dc35029cba2a869f91919cb3cf7e7c68f26727cc68e4b03d99cdf1bc2ebb",
    },
    sourceVerificationClosureDigest: canonicalSha256(
      "programmable.robinhood-custom-launch.sourcify-response-closure.v2", sourcify,
    ),
  };
  return {
    ...withoutDigest,
    evidenceDigest: canonicalSha256(withoutDigest.schemaVersion, withoutDigest),
  };
}

function sourceClosure() {
  const withoutDigest = {
    schemaVersion: "programmable.launch-cli-v4-source-closure.v1",
    repository: "programmablehq/PROGRAMMABLE",
    repositoryId: "1314365508",
    branch: "production",
    protectedRef: "refs/heads/production",
    revision: "c".repeat(40),
    tree: "d".repeat(40),
    foundationSourceCommitment:
      "0xe87f5edc2dc839bd87a26a80cb53f14b021e603a1753d27aae3a02862058d730",
    entries: [
      {
        path:
          "contracts/spec/robinhood-custom-launch/standard-json/ProgrammableCreate2GraphDeployerV1.standard-input.json",
        byteLength: "1",
        sha256:
          "sha256:8ab811a215d70b1d5aef0c71a47153173953ee78d7632725413833888369ec4d",
      },
      {
        path:
          "contracts/spec/robinhood-custom-launch/standard-json/ProgrammableLaunchStampRouterV1.standard-input.json",
        byteLength: "1",
        sha256:
          "sha256:6abca24d06b013599f4ff63e049976419c3f17455fa9bc343b15ec0d6e6a078a",
      },
    ],
    sourceVerificationClosureDigest: sourceVerification().sourceVerificationClosureDigest,
  };
  return {
    ...withoutDigest,
    sourceClosureDigest: canonicalSha256(withoutDigest.schemaVersion, withoutDigest),
  };
}

function backendReadback(kind, hostname, requestPath, authentication, body, index, {
  method = "GET",
  requestBody = null,
} = {}) {
  const requestBodyBytes = requestBody === null
    ? Buffer.alloc(0) : Buffer.from(JSON.stringify(requestBody), "utf8");
  const contentType = method === "POST" ? "application/json" : null;
  const sanitized = Buffer.from(
    `${method} https://${hostname}${requestPath}\naccept: application/json\n`
      + `content-type: ${contentType ?? "none"}\n`
      + `authentication: ${authentication}\n\n${requestBodyBytes.toString("utf8")}`,
    "utf8",
  );
  const bodyBytes = Buffer.from(`${JSON.stringify(body)}\n`, "utf8");
  return {
    kind,
    request: {
      method,
      scheme: "https",
      hostname,
      path: requestPath,
      accept: "application/json",
      contentType,
      authentication,
      bodyBytesBase64: requestBodyBytes.toString("base64"),
      bodyByteLength: String(requestBodyBytes.byteLength),
      bodySha256: sha256Bytes(requestBodyBytes),
      sanitizedBytesBase64: sanitized.toString("base64"),
      byteLength: String(sanitized.byteLength),
      sha256: sha256Bytes(sanitized),
    },
    response: {
      httpStatus: 200,
      contentType: "application/json; charset=utf-8",
      date: "Sat, 29 Aug 2026 14:55:00 GMT",
      requestId: `fixture-${index}`,
      bodyBytesBase64: bodyBytes.toString("base64"),
      bodyByteLength: String(bodyBytes.byteLength),
      bodySha256: sha256Bytes(bodyBytes),
    },
  };
}

function legacyPromotionFixture() {
  const stage = stageFixture();
  const descriptorDigest = stage.finalizedBindings.chainDeploymentDescriptorDigest;
  const backendSource = {
    repository: "programmablehq/programmable-open-hook-v2-internal",
    sourceCommit: "8".repeat(40),
    sourceTree: "9".repeat(40),
  };
  const stageIdentity = stage.artifacts.cliReleaseBinding.value.releaseIdentity;
  const readinessIdentity = {
    schemaVersion: "programmable.custom-launch-api-release-identity.v4",
    status: "ready",
    service: "custom-launch-api-v1",
    sourceCommit: backendSource.sourceCommit,
    sourceTree: backendSource.sourceTree,
    chainId: "4663",
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    chainDeploymentDescriptorDigest: descriptorDigest,
    migration: { path: "migrations/0017_chain_aware_custom_launch_v4.sql", sha256: sha("2") },
    apiContract: { path: "release/custom-launch-api-contract.v4.json", sha256: sha("1") },
    uniswapRegistrySnapshot: {
      repository: "Uniswap/contracts",
      commit: "4cfc406c8e34da3ce04e60657a7825075b64fd22",
      sourcePath: "deployments/json/4663.json",
      releasePath: "release/assets/uniswap-4663-4cfc406.json",
      sha256: "sha256:21964cefbfc24b0ee89e7427acf74d223ce5a50aeb4216a9bac361a6148dea15",
    },
    policySource: structuredClone(stageIdentity.policySource),
    profile: {
      structuralProfileId: stageIdentity.profile.structuralProfileId,
      businessProfileId: stageIdentity.profile.businessProfileId,
      profileRevision: stageIdentity.profile.profileRevision,
      profileVersion: stageIdentity.profile.profileVersion,
      profileDigest: stageIdentity.profile.profileDigest,
    },
    providerQuorums: {
      robinhood: [
        { providerId: "quicknode", trustDomain: "quicknode.com" },
        { providerId: "alchemy", trustDomain: "alchemy.com" },
      ],
      ethereum: [
        { providerId: "drpc", trustDomain: "drpc.org" },
        { providerId: "quicknode", trustDomain: "quicknode.com" },
      ],
    },
    composition: Object.fromEntries([
      "authoritativeChainRuntime", "apiSignerObserverRoleAttestation", "durableLedger",
      "exactCredentialScopeRecheck", "isolatedImageDecoder", "dualProviderSimulation",
      "exactExternalContractVerifier", "permitDigestSigner", "durableFinalityWriter",
      "canonicalFinalitySubjectReader", "dualProviderSubmissionDiscovery", "finalityObserver",
      "finalityWorkerLifecycle",
    ].map((key) => [key, true])),
  };
  const observedAt = "2026-08-29T14:55:00Z";
  const machineId = "abcdef123456";
  const imageDigest = sha("5");
  const imageTag = `main-${backendSource.sourceCommit.slice(0, 12)}`;
  const readiness = backendReadback("readiness", "programmable-custom-launch-api.fly.dev",
    "/v4/chains/4663/readiness", "none", readinessIdentity, 0);
  const flyReadbacks = [
    backendReadback("releases", "api.fly.io", "/graphql", "fly-api-token-redacted", {
      data: { app: { releasesUnprocessed: { totalCount: 1, pageInfo: {
        hasNextPage: false, hasPreviousPage: false, startCursor: "a", endCursor: "a",
      }, nodes: [{ id: "release-1", version: 1, status: "complete", stable: true,
        imageRef: `registry.fly.io/programmable-custom-launch-api:${imageTag}`,
        image: { registry: "registry.fly.io", repository: "programmable-custom-launch-api",
          tag: imageTag, digest: imageDigest }, createdAt: observedAt }] } } },
    }, 1, { method: "POST", requestBody: {
      query: "query { releasesUnprocessed { nodes { id } } }",
      variables: { appName: "programmable-custom-launch-api", first: 256 },
    } }),
    backendReadback("app", "api.machines.dev", "/v1/apps/programmable-custom-launch-api",
      "fly-api-token-redacted", { name: "programmable-custom-launch-api", status: "deployed" }, 2),
    backendReadback("machine-list", "api.machines.dev",
      "/v1/apps/programmable-custom-launch-api/machines", "fly-api-token-redacted",
      [{ id: machineId }], 3),
    backendReadback(`machine:${machineId}`, "api.machines.dev",
      `/v1/apps/programmable-custom-launch-api/machines/${machineId}`,
      "fly-api-token-redacted", { id: machineId, state: "started" }, 4),
    backendReadback(`metadata:${machineId}`, "api.machines.dev",
      `/v1/apps/programmable-custom-launch-api/machines/${machineId}/metadata`,
      "fly-api-token-redacted", { fly_release_id: "release-1", fly_release_version: "1" }, 5),
  ];
  const backendInputWithoutDigest = {
    schemaVersion: "programmable.robinhood-custom-launch.backend-promotion-input.v1",
    captureId: "6".repeat(64),
    observedAt,
    backendSource,
    readinessReadback: readiness,
    flyReadbacks,
    backendPromotionInputDigest: null,
  };
  const backendPromotionInput = {
    ...backendInputWithoutDigest,
    backendPromotionInputDigest: canonicalSha256(
      backendInputWithoutDigest.schemaVersion, backendInputWithoutDigest,
    ),
  };
  const captureAuthorizationWithoutDigest = {
    schemaVersion: "programmable.robinhood-custom-launch.backend-capture-authorization.v1",
    trustClass: "github-artifact-attestation",
    subjectSha256: sha("7"),
    repository: backendSource.repository,
    repositoryId: "1318883798",
    workflow: ".github/workflows/capture-programmable-robinhood-promotion.yml",
    sourceRef: "refs/heads/main",
    sourceRevision: backendSource.sourceCommit,
    sourceTree: backendSource.sourceTree,
    verifiedAt: observedAt,
    verificationDigest: null,
  };
  const backendCaptureAuthorization = {
    ...captureAuthorizationWithoutDigest,
    verificationDigest: canonicalSha256(
      captureAuthorizationWithoutDigest.schemaVersion, captureAuthorizationWithoutDigest,
    ),
  };
  const rawReadbacksDigest = canonicalSha256(
    "programmable.custom-launch-api-fly-raw-readbacks.v1",
    flyReadbacks.map((entry) => ({ kind: entry.kind, requestSha256: entry.request.sha256,
      responseSha256: entry.response.bodySha256 })),
  );
  const backendEvidenceWithoutDigest = {
    schemaVersion: "programmable.launch-cli-v4-backend-release-evidence.v1",
    repository: backendSource.repository,
    sourceCommit: backendSource.sourceCommit,
    sourceTree: backendSource.sourceTree,
    chainDeploymentDescriptorDigest: descriptorDigest,
    backendPromotionInputDigest: backendPromotionInput.backendPromotionInputDigest,
    apiContract: structuredClone(readinessIdentity.apiContract),
    migration: structuredClone(readinessIdentity.migration),
    openApiSha256: stage.artifacts.cliReleaseBinding.value.machineContracts[0].sha256,
    profileDigest: stageIdentity.profile.profileDigest,
    admissionPolicyDigest: stageIdentity.profile.admissionPolicyDigest,
    finalityPolicyDigest: stageIdentity.finalityPolicy.policyDigest,
    runtimeReadiness: {
      schemaVersion: "programmable.custom-launch-api-runtime-readiness-receipt.v4",
      path: "/v4/chains/4663/readiness",
      httpStatus: 200,
      contentType: readiness.response.contentType,
      responseByteLength: readiness.response.bodyByteLength,
      responseSha256: readiness.response.bodySha256,
      releaseIdentityDigest: canonicalSha256(readinessIdentity.schemaVersion, readinessIdentity),
      observedAt,
      authorizationDigest: sha("d"),
    },
    flyControlPlane: {
      schemaVersion: "programmable.custom-launch-api-fly-control-plane-receipt.v1",
      app: "programmable-custom-launch-api",
      releaseId: "release-1",
      releaseVersion: "1",
      imageDigest,
      imageTag,
      machines: [{ id: machineId, state: "started", region: "iad", imageDigest }],
      readinessResponseSha256: readiness.response.bodySha256,
      rawReadbacksDigest,
      observedAt,
      authorizationDigest: sha("e"),
    },
  };
  const backendEvidence = {
    ...backendEvidenceWithoutDigest,
    backendReleaseEvidenceDigest: canonicalSha256(
      backendEvidenceWithoutDigest.schemaVersion, backendEvidenceWithoutDigest,
    ),
  };
  const backendAuthorizationWithoutDigest = {
    schemaVersion: "programmable.launch-cli-v4-backend-release-authorization.v1",
    trustClass: "github-artifact-attestation",
    repository: "programmablehq/PROGRAMMABLE",
    repositoryId: "1314365508",
    workflow: ".github/workflows/finalize-robinhood-custom-launch-promotion.yml",
    sourceRef: "refs/heads/production",
    sourceRevision: stage.sourceClosure.revision,
    sourceTree: stage.sourceClosure.tree,
    chainDeploymentDescriptorDigest: descriptorDigest,
    backendPromotionInputDigest: backendPromotionInput.backendPromotionInputDigest,
    backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
    runtimeReadinessResponseSha256: readiness.response.bodySha256,
    flyRawReadbacksDigest: rawReadbacksDigest,
    observedAt,
  };
  const backendAuthorization = {
    ...backendAuthorizationWithoutDigest,
    authorizationDigest: canonicalSha256(
      "programmable.launch-cli-v4-backend-release-authorization.v1",
      backendAuthorizationWithoutDigest,
    ),
  };
  const releaseManifestDigest = sha("f");
  const finalBinding = structuredClone(stage.artifacts.cliReleaseBinding.value);
  finalBinding.releaseReady = true;
  finalBinding.blockers = [];
  finalBinding.evidence.backend = backendEvidence;
  finalBinding.evidence.manifest = {
    releaseManifestDigest,
    backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
    chainDeploymentDescriptorDigest: descriptorDigest,
    sourceRevision: stage.sourceClosure.revision,
    sourceTree: stage.sourceClosure.tree,
    sourceClosureDigest: stage.sourceClosure.sourceClosureDigest,
    finalityEvidenceDigest: stage.finalizedBindings.finalityEvidenceDigest,
  };
  const common = {
    status: "authorized-live",
    publicAuthorization: true,
    publicWrites: true,
    backendPromotionInputDigest: backendPromotionInput.backendPromotionInputDigest,
    backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
    backendAuthorizationDigest: backendAuthorization.authorizationDigest,
    releaseManifestDigest,
  };
  const consumerInputs = {
    indexer: { ...structuredClone(stage.consumerInputs.indexer), ...common },
    cli: { ...structuredClone(stage.consumerInputs.cli), ...common },
    developers: { ...structuredClone(stage.consumerInputs.developers), ...common,
      backendRuntimeReadinessRequired: false, flyControlPlaneReceiptRequired: false },
    backend: { ...structuredClone(stage.consumerInputs.backend),
      state: "phase-b-authorized", publicAuthorization: true,
      backendPromotionInputDigest: backendPromotionInput.backendPromotionInputDigest,
      backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
      backendAuthorizationDigest: backendAuthorization.authorizationDigest,
      runtimeReadinessResponseSha256: readiness.response.bodySha256,
      flyRawReadbacksDigest: rawReadbacksDigest },
  };
  const stageBytes = Buffer.from(`${JSON.stringify(stage, null, 2)}\n`, "utf8");
  const withoutDigest = {
    schemaVersion: PROMOTION_BUNDLE_SCHEMA,
    state: "finalized-live",
    releaseReady: true,
    publicAuthorization: true,
    publicWrites: true,
    stageBundle: {
      path: CANONICAL_STAGE_BUNDLE_PATH,
      sha256: sha256Bytes(stageBytes),
      byteLength: String(stageBytes.byteLength),
      stageBundleDigest: stage.stageBundleDigest,
    },
    chainDeploymentId: stage.chainDeploymentId,
    inputEvidenceDigest: stage.inputEvidenceDigest,
    preparedArtifact: structuredClone(stage.preparedArtifact),
    captureAuthorization: structuredClone(stage.captureAuthorization),
    captureClosure: structuredClone(stage.captureClosure),
    sourceVerification: structuredClone(stage.sourceVerification),
    sourceClosure: structuredClone(stage.sourceClosure),
    backendReleaseAssets: structuredClone(stage.backendReleaseAssets),
    backendPromotionInput,
    backendCaptureAuthorization,
    backendAuthorization,
    finalizedBindings: { ...structuredClone(stage.finalizedBindings),
      backendPromotionInputDigest: backendPromotionInput.backendPromotionInputDigest,
      backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
      backendAuthorizationDigest: backendAuthorization.authorizationDigest,
      releaseManifestDigest },
    artifacts: {
      liveDeployment: structuredClone(stage.artifacts.liveDeployment),
      cliReleaseBinding: {
        ...artifact("docs/operations/releases/custom-launch-v4/cli-release-binding.json",
          finalBinding),
        replacesSha256: stage.artifacts.cliReleaseBinding.replacesSha256,
      },
      backendRelease: structuredClone(stage.artifacts.backendRelease),
    },
    consumerInputs,
  };
  return { ...withoutDigest,
    promotionBundleDigest: canonicalSha256(PROMOTION_BUNDLE_SCHEMA, withoutDigest) };
}

function promotionFixture() {
  const legacy = legacyPromotionFixture();
  const stage = stageFixture();
  const descriptorDigest = stage.finalizedBindings.chainDeploymentDescriptorDigest;
  const rawInput = legacy.backendPromotionInput;
  const observedAt = rawInput.observedAt;
  const backendSource = structuredClone(rawInput.backendSource);
  const privateBytes = Buffer.from(`${JSON.stringify(rawInput, null, 2)}\n`, "utf8");
  const publicArtifact = {
    path: "release/robinhood-chain-4663/backend-promotion-input.public.json",
    byteLength: "2048",
    sha256: sha("7"),
  };
  const publicInputDigest = sha("a");

  const safeReceipt = (readback) => ({
    kind: readback.kind,
    httpStatus: readback.response.httpStatus,
    contentType: "application/json",
    date: readback.response.date,
    requestIdSha256: sha256Bytes(Buffer.from(readback.response.requestId, "utf8")),
    requestByteLength: readback.request.byteLength,
    requestSha256: readback.request.sha256,
    responseBodyByteLength: readback.response.bodyByteLength,
    responseBodySha256: readback.response.bodySha256,
  });
  const readinessReceipt = safeReceipt(rawInput.readinessReadback);
  const flyReceipts = rawInput.flyReadbacks.map(safeReceipt);
  const rawReadbacksDigest = canonicalSha256(
    "programmable.custom-launch-api-fly-raw-readbacks.v1",
    flyReceipts,
  );
  const readbackReceipts = {
    readiness: readinessReceipt,
    fly: flyReceipts,
    digest: canonicalSha256(
      "programmable.robinhood-custom-launch.backend-safe-readback-receipts.v1",
      [readinessReceipt, ...flyReceipts],
    ),
  };
  const readinessIdentity = JSON.parse(Buffer.from(
    rawInput.readinessReadback.response.bodyBytesBase64,
    "base64",
  ).toString("utf8"));
  const runtimeReadiness = {
    schemaVersion: "programmable.custom-launch-api-runtime-readiness-receipt.v4",
    path: "/v4/chains/4663/readiness",
    httpStatus: 200,
    contentType: "application/json; charset=utf-8",
    responseByteLength: readinessReceipt.responseBodyByteLength,
    responseSha256: readinessReceipt.responseBodySha256,
    releaseIdentityDigest: canonicalSha256(readinessIdentity.schemaVersion, readinessIdentity),
    observedAt,
    authorizationDigest: canonicalSha256(
      "programmable.custom-launch-api-runtime-readiness-receipt.v4",
      {
        backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
        requestSha256: readinessReceipt.requestSha256,
        responseSha256: readinessReceipt.responseBodySha256,
      },
    ),
  };
  const legacyFly = legacy.artifacts.cliReleaseBinding.value.evidence.backend.flyControlPlane;
  const flyControlPlane = {
    ...structuredClone(legacyFly),
    rawReadbacksDigest,
    readinessResponseSha256: readinessReceipt.responseBodySha256,
    observedAt,
    authorizationDigest: canonicalSha256(
      "programmable.custom-launch-api-fly-control-plane-receipt.v1",
      {
        backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
        rawReadbacksDigest,
        readinessResponseSha256: readinessReceipt.responseBodySha256,
      },
    ),
  };

  const backendCaptureWithoutDigest = {
    schemaVersion: "programmable.robinhood-custom-launch.backend-capture-authorization.v1",
    trustClass: "github-artifact-attestation",
    subjectPath: publicArtifact.path,
    subjectByteLength: publicArtifact.byteLength,
    subjectSha256: publicArtifact.sha256,
    attestationBundlePath:
      "release/robinhood-chain-4663/backend-promotion-input.attestation.json",
    attestationBundleByteLength: "1024",
    attestationBundleSha256: sha("b"),
    trustedRootSource: "github-cli-embedded-tuf",
    trustedRootByteLength: "512",
    trustedRootSha256: sha("c"),
    repository: backendSource.repository,
    repositoryId: "1318883798",
    workflow: ".github/workflows/capture-programmable-robinhood-promotion.yml",
    sourceRef: "refs/heads/main",
    sourceRevision: backendSource.sourceCommit,
    sourceTree: backendSource.sourceTree,
    verifiedAt: observedAt,
    verificationDigest: null,
  };
  const backendCaptureAuthorization = {
    ...backendCaptureWithoutDigest,
    verificationDigest: canonicalSha256(
      backendCaptureWithoutDigest.schemaVersion,
      backendCaptureWithoutDigest,
    ),
  };
  const {
    schemaVersion: _backendCaptureSchema,
    verifiedAt: _backendCaptureVerifiedAt,
    ...captureAuthorization
  } = backendCaptureAuthorization;

  const legacyEvidence = legacy.artifacts.cliReleaseBinding.value.evidence.backend;
  const backendEvidenceWithoutDigest = {
    ...structuredClone(legacyEvidence),
    backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
    runtimeReadiness,
    flyControlPlane,
  };
  delete backendEvidenceWithoutDigest.backendReleaseEvidenceDigest;
  const backendEvidence = {
    ...backendEvidenceWithoutDigest,
    backendReleaseEvidenceDigest: canonicalSha256(
      backendEvidenceWithoutDigest.schemaVersion,
      backendEvidenceWithoutDigest,
    ),
  };
  const backendPromotionBinding = {
    schemaVersion: "programmable.robinhood-custom-launch.backend-promotion-binding.v1",
    publicArtifact,
    publicInputDigest,
    privateRawArtifact: {
      path: "release/robinhood-chain-4663/backend-promotion-input.json",
      byteLength: String(privateBytes.byteLength),
      sha256: sha256Bytes(privateBytes),
      captureId: rawInput.captureId,
      backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
    },
    readbackReceipts,
    backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
    backendSource,
    captureAuthorization,
    runtimeReadiness,
    flyControlPlane,
    backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
  };

  const stageBytes = Buffer.from(`${JSON.stringify(stage, null, 2)}\n`, "utf8");
  const backendAuthorizationWithoutDigest = {
    schemaVersion: "programmable.launch-cli-v4-backend-release-authorization.v1",
    trustClass: "github-artifact-attestation",
    repository: "programmablehq/PROGRAMMABLE",
    repositoryId: "1314365508",
    workflow: ".github/workflows/finalize-robinhood-custom-launch-promotion.yml",
    sourceRef: "refs/heads/production",
    producerRevision: "e".repeat(40),
    producerTree: "f".repeat(40),
    stageSourceRevision: stage.sourceClosure.revision,
    stageSourceTree: stage.sourceClosure.tree,
    stageBundlePath: CANONICAL_STAGE_BUNDLE_PATH,
    stageBundleSha256: sha256Bytes(stageBytes),
    stageBundleDigest: stage.stageBundleDigest,
    backendPromotionPublicInputPath: publicArtifact.path,
    backendPromotionPublicInputSha256: publicArtifact.sha256,
    backendPromotionPublicInputDigest: publicInputDigest,
    chainDeploymentDescriptorDigest: descriptorDigest,
    backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
    backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
    runtimeReadinessResponseSha256: runtimeReadiness.responseSha256,
    flyRawReadbacksDigest: flyControlPlane.rawReadbacksDigest,
    observedAt,
  };
  const backendAuthorization = {
    ...backendAuthorizationWithoutDigest,
    authorizationDigest: canonicalSha256(
      backendAuthorizationWithoutDigest.schemaVersion,
      backendAuthorizationWithoutDigest,
    ),
  };

  const releaseManifestDigest = sha("f");
  const finalBinding = structuredClone(stage.artifacts.cliReleaseBinding.value);
  finalBinding.releaseReady = true;
  finalBinding.blockers = [];
  finalBinding.evidence.backend = backendEvidence;
  finalBinding.evidence.manifest = {
    releaseManifestDigest,
    backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
    chainDeploymentDescriptorDigest: descriptorDigest,
    sourceRevision: stage.sourceClosure.revision,
    sourceTree: stage.sourceClosure.tree,
    sourceClosureDigest: stage.sourceClosure.sourceClosureDigest,
    finalityEvidenceDigest: stage.finalizedBindings.finalityEvidenceDigest,
  };
  const common = {
    status: "authorized-live",
    publicAuthorization: true,
    publicWrites: true,
    backendPromotionPublicInputDigest: publicInputDigest,
    backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
    backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
    backendAuthorizationDigest: backendAuthorization.authorizationDigest,
    releaseManifestDigest,
  };
  const consumerInputs = {
    indexer: { ...structuredClone(stage.consumerInputs.indexer), ...common },
    cli: { ...structuredClone(stage.consumerInputs.cli), ...common },
    developers: {
      ...structuredClone(stage.consumerInputs.developers),
      ...common,
      backendRuntimeReadinessRequired: false,
      flyControlPlaneReceiptRequired: false,
    },
    backend: {
      ...structuredClone(stage.consumerInputs.backend),
      state: "phase-b-authorized",
      publicAuthorization: true,
      backendPromotionPublicInputDigest: publicInputDigest,
      backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
      backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
      backendAuthorizationDigest: backendAuthorization.authorizationDigest,
      runtimeReadinessResponseSha256: runtimeReadiness.responseSha256,
      flyRawReadbacksDigest: flyControlPlane.rawReadbacksDigest,
    },
  };
  const withoutDigest = {
    schemaVersion: PROMOTION_BUNDLE_SCHEMA,
    state: "finalized-live",
    releaseReady: true,
    publicAuthorization: true,
    publicWrites: true,
    stageBundle: {
      path: CANONICAL_STAGE_BUNDLE_PATH,
      sha256: sha256Bytes(stageBytes),
      byteLength: String(stageBytes.byteLength),
      stageBundleDigest: stage.stageBundleDigest,
    },
    chainDeploymentId: stage.chainDeploymentId,
    inputEvidenceDigest: stage.inputEvidenceDigest,
    preparedArtifact: structuredClone(stage.preparedArtifact),
    captureAuthorization: structuredClone(stage.captureAuthorization),
    captureClosure: structuredClone(stage.captureClosure),
    sourceVerification: structuredClone(stage.sourceVerification),
    sourceClosure: structuredClone(stage.sourceClosure),
    backendReleaseAssets: structuredClone(stage.backendReleaseAssets),
    backendPromotionBinding,
    backendCaptureAuthorization,
    backendAuthorization,
    finalizedBindings: {
      ...structuredClone(stage.finalizedBindings),
      backendPromotionPublicInputDigest: publicInputDigest,
      backendPromotionInputDigest: rawInput.backendPromotionInputDigest,
      backendReleaseEvidenceDigest: backendEvidence.backendReleaseEvidenceDigest,
      backendAuthorizationDigest: backendAuthorization.authorizationDigest,
      releaseManifestDigest,
    },
    artifacts: {
      liveDeployment: structuredClone(stage.artifacts.liveDeployment),
      cliReleaseBinding: {
        ...artifact(
          "docs/operations/releases/custom-launch-v4/cli-release-binding.json",
          finalBinding,
        ),
        replacesSha256: stage.artifacts.cliReleaseBinding.replacesSha256,
      },
      backendRelease: structuredClone(stage.artifacts.backendRelease),
    },
    consumerInputs,
  };
  return {
    ...withoutDigest,
    promotionBundleDigest: canonicalSha256(PROMOTION_BUNDLE_SCHEMA, withoutDigest),
  };
}

const testL2EntryOrder = [
  "chainId", "rawTransaction", "transaction", "receipt", "deploymentBlock",
  "predecessorBlock", "genesisBlock", "multicall3Code", "prePermitAuthorityCode",
  "preGraphFactoryCode", "preRouterCode", "permitAuthorityCode", "graphFactoryCode",
  "routerCode", "safeSingletonCode", "safeFallbackHandlerCode", "permit2GenesisCode",
  "poolManagerRawTransaction", "poolManagerTransaction", "poolManagerReceipt",
  "poolManagerBlock", "poolManagerPredecessorBlock", "poolManagerCreate2DeployerCode",
  "prePoolManagerCode", "poolManagerCode", "positionManagerRawTransaction",
  "positionManagerTransaction", "positionManagerReceipt", "positionManagerBlock",
  "positionManagerPredecessorBlock", "positionManagerCreate2DeployerCode",
  "prePositionManagerCode", "positionManagerCode", "stateViewRawTransaction",
  "stateViewTransaction", "stateViewReceipt", "stateViewBlock",
  "stateViewPredecessorBlock", "stateViewCreate2DeployerCode", "preStateViewCode",
  "stateViewCode", "v4QuoterRawTransaction", "v4QuoterTransaction", "v4QuoterReceipt",
  "v4QuoterBlock", "v4QuoterPredecessorBlock", "v4QuoterCreate2DeployerCode",
  "preV4QuoterCode", "v4QuoterCode", "universalRouterRawTransaction",
  "universalRouterTransaction", "universalRouterReceipt", "universalRouterBlock",
  "universalRouterPredecessorBlock", "universalRouterCreate2DeployerCode",
  "preUniversalRouterCode", "universalRouterCode",
  "routerPermitAuthority", "routerPermitAuthorityCodeHash", "routerGraphFactory",
  "routerGraphFactoryCodeHash", "routerPoolManager", "routerPoolManagerCodeHash",
  "routerChainId", "safeOwners", "safeThreshold", "safeNonce", "safeModules",
  "safeVersion", "safeSingletonSlot", "safeFallbackHandlerSlot", "safeGuardSlot",
  "findBatchContainingBlock", "getL1Confirmations",
];
const testEthereumEntryOrder = [
  "chainId", "postingLogs", "postingReceipt", "postingBlock", "finalizedTag",
  "finalizedReread",
];
const testSafeOwners = [
  "0x032b1c7b96793717F0BD2f11eb86cd10CdefC4a3",
  "0x2Bb333d48DFAF1596D9036671d2E43168994249E",
];
const testExternalRoots = {
  poolManager: {
    transactionHash:
      "0x4fb28d4935866f462582c6c931c6f2705e55f5be5eb178c7d8d9329a95c44c41",
    startBlock: "9070",
  },
  positionManager: {
    transactionHash:
      "0x228c18ada6cb46b4fbcc18f4ec1519953415393e256fa8349aafbd5a2db037c8",
    startBlock: "9073",
  },
  stateView: {
    transactionHash:
      "0x3d61e2c9eeb482385b1aa436b9e8f812167ea579cc390e4f93bc5abde00582f4",
    startBlock: "9075",
  },
  v4Quoter: {
    transactionHash:
      "0x6bf436d72a17f87284ddcab43094689bd320dfb39b535213b9a0b669fabc4ab4",
    startBlock: "9074",
  },
  universalRouter: {
    transactionHash:
      "0xdfb76494e158d8dea4376160315239271636a18515207fd4526e574bc7eeb456",
    startBlock: "3347899",
  },
};

function testNormalizedResultDigest(order, key) {
  const index = order.indexOf(key);
  assert.notEqual(index, -1, `test inventory is missing ${key}`);
  return sha("0123456789abcdef"[index % 16]);
}

function testResponseDigest(order, key, seed) {
  const index = order.indexOf(key);
  assert.notEqual(index, -1, `test inventory is missing ${key}`);
  return sha("0123456789abcdef"[(index + Number.parseInt(seed, 16)) % 16]);
}

function testCaptureInventory(layer, providerId, trustDomain, order, character) {
  const entries = order.map((key, index) => ({
    key,
    method: index % 2 === 0 ? "eth_getBlockByNumber" : "eth_call",
    paramsSha256: sha(character),
    requestSha256: sha(character),
    responseSha256: testResponseDigest(order, key, character),
    normalizedResultSha256: testNormalizedResultDigest(order, key),
  }));
  return {
    layer,
    providerId,
    trustDomain,
    entries,
    inventoryDigest: canonicalSha256(
      "programmable.robinhood-custom-launch.rpc-inventory.v2", entries,
    ),
  };
}

function testCaptureVerifiedState(providerId, trustDomain) {
  const roots = RELEASE_CONSTANTS.roots;
  const transaction = {
    hash: hash("1"),
    from: testSafeOwners[1],
    to: "0xcA11bde05977b3631167028862bE2a173976CA11",
    valueWei: "0",
    selector: "0x82ad56cb",
    calldataHash:
      "0x3ba04469085b17e12843a94c154a335c9c384837f8f6531f179cb4915fd237d9",
    calldataBytes: 33_412,
    nonce: "7",
    transactionIndex: "2",
    blockNumber: "50000000",
    blockHash: hash("2"),
  };
  const emptyRuntime =
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
  const atomicRoots = ["permitAuthority", "graphFactory", "programmableLaunchStampRouter"]
    .map((contract) => ({
      contract,
      address: roots[contract].address,
      preDeploymentBlockNumber: "49999999",
      preDeploymentBlockHash: hash("3"),
      preDeploymentRuntimeCodeHash: emptyRuntime,
      deploymentBlockNumber: transaction.blockNumber,
      deploymentBlockHash: transaction.blockHash,
      deploymentRuntimeCodeHash: roots[contract].runtimeCodeHash,
    }));
  const externalRoots = Object.entries(testExternalRoots).map(([contract, expected], index) => ({
    contract,
    address: roots[contract].address,
    preStartBlockNumber: (BigInt(expected.startBlock) - 1n).toString(10),
    preStartBlockHash: hash(String(index + 4)),
    preStartBlockRuntimeCodeHash: emptyRuntime,
    runtimeCodeHash: roots[contract].runtimeCodeHash,
    transactionHash: expected.transactionHash,
    rawTransactionDigest: testNormalizedResultDigest(
      testL2EntryOrder, `${contract}RawTransaction`,
    ),
    transactionDigest: testNormalizedResultDigest(
      testL2EntryOrder, `${contract}Transaction`,
    ),
    startBlock: expected.startBlock,
    blockHash: hash("bcdef"[index]),
    transactionReceiptDigest: testNormalizedResultDigest(
      testL2EntryOrder, `${contract}Receipt`,
    ),
  }));
  return {
    providerId,
    trustDomain,
    transaction,
    receipt: {
      transactionHash: transaction.hash,
      from: transaction.from,
      to: transaction.to,
      status: "1",
      transactionIndex: transaction.transactionIndex,
      blockNumber: transaction.blockNumber,
      blockHash: transaction.blockHash,
      logs: [
        {
          address: roots.permitAuthority.address,
          topics: [hash("a")],
          data: "0x",
          logIndex: "1",
        },
        {
          address: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
          topics: [hash("b")],
          data: "0x",
          logIndex: "2",
        },
      ],
    },
    multicall3: {
      address: transaction.to,
      runtimeCodeHash:
        "0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891",
    },
    atomicRoots,
    routerState: {
      address: roots.programmableLaunchStampRouter.address,
      runtimeCodeHash: roots.programmableLaunchStampRouter.runtimeCodeHash,
      chainId: "4663",
      permitAuthority: roots.permitAuthority.address,
      permitAuthorityRuntimeCodeHash: roots.permitAuthority.runtimeCodeHash,
      graphFactory: roots.graphFactory.address,
      graphFactoryRuntimeCodeHash: roots.graphFactory.runtimeCodeHash,
      poolManager: roots.poolManager.address,
      poolManagerRuntimeCodeHash: roots.poolManager.runtimeCodeHash,
    },
    safeState: {
      blockNumber: transaction.blockNumber,
      blockHash: transaction.blockHash,
      proxyAddress: roots.permitAuthority.address,
      proxyRuntimeCodeHash: roots.permitAuthority.runtimeCodeHash,
      singleton: {
        address: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
        runtimeCodeHash:
          "0x1fe2df852ba3299d6534ef416eefa406e56ced995bca886ab7a553e6d0c5e1c4",
        version: "1.4.1",
      },
      fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
      fallbackHandlerRuntimeCodeHash:
        "0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9",
      owners: structuredClone(testSafeOwners),
      threshold: 1,
      nonce: "0",
      modules: [],
      modulesNext: "0x0000000000000000000000000000000000000001",
      guard: null,
      singletonSlot: "0x00000000000000000000000041675c099f32341bf84bfc5382af534df5c7461a",
      fallbackHandlerSlot:
        "0x000000000000000000000000fd0732dc9e303f09fcef3a7388ad10a83459ec99",
      guardSlot: `0x${"0".repeat(64)}`,
    },
    permit2Genesis: {
      address: roots.permit2.address,
      blockNumber: "0",
      blockHash: hash("f"),
      runtimeCodeHash: roots.permit2.runtimeCodeHash,
      runtimeCodeBytes: 9_152,
    },
    externalRoots,
  };
}

function testCaptureSourcify(verification) {
  return [
    ["graphFactory", verification.graphFactory],
    ["programmableLaunchStampRouter", verification.programmableLaunchStampRouter],
  ].map(([contract, entry]) => ({
    contract,
    provider: "sourcify-v2",
    chainId: entry.chainId,
    address: entry.address,
    match: entry.match,
    creationMatch: entry.creationMatch,
    runtimeMatch: entry.runtimeMatch,
    matchId: entry.matchId,
    verifiedAt: entry.verifiedAt,
    compiler: structuredClone(entry.compiler),
    sourceFilesDigest: entry.sourceFilesDigest,
    standardJsonInputPath: entry.standardJsonInputPath,
    standardJsonInputSha256: entry.standardJsonInputSha256,
    metadataDigest: entry.metadataDigest,
    urlPath: entry.urlPath,
    httpStatus: entry.httpStatus,
    contentType: entry.contentType,
    responseByteLength: entry.responseByteLength,
    responseSha256: entry.verificationResponseDigest,
  }));
}

function stageFixture() {
  const verification = sourceVerification();
  const closure = sourceClosure();
  const descriptor = {
    schemaVersion: "programmable.custom-launch-chain-deployment.v1",
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    chainId: "4663",
    caip2: "eip155:4663",
    finality: structuredClone(RELEASE_CONSTANTS.finalityPolicy),
    foundationSourceCommitment:
      "0xe87f5edc2dc839bd87a26a80cb53f14b021e603a1753d27aae3a02862058d730",
    deploymentEvidence: {
      transactionHash: hash("1"),
      blockNumber: "50000000",
      blockHash: hash("2"),
    },
    permit2GenesisProvenance: {},
    permitAuthoritySourceProvenance: {},
    externalRootDeploymentEvidence: [],
    contracts: structuredClone(RELEASE_CONSTANTS.roots),
  };
  const descriptorDigest = keccak256(
    new TextEncoder().encode(canonicalizeJson(descriptor)),
  );
  const authorizationWithoutDigest = {
    schemaVersion: "programmable.robinhood-custom-launch.capture-authorization.v1",
    trustClass: "github-artifact-attestation",
    subjectPath:
      "release/robinhood-chain-4663/programmable-postdeployment-capture.json",
    subjectByteLength: "4096",
    subjectSha256: sha("8"),
    attestationBundlePath:
      "release/robinhood-chain-4663/programmable-postdeployment-capture.attestation.json",
    attestationBundleByteLength: "2048",
    attestationBundleSha256: sha("9"),
    trustedRootSource: "github-cli-embedded-tuf",
    trustedRootByteLength: "1024",
    trustedRootSha256: sha("a"),
    productionVerifyProofPath:
      "release/robinhood-chain-4663/production-verify-proof.json",
    productionVerifyProofByteLength: "3072",
    productionVerifyProofSha256: sha("b"),
    productionVerifyAttestationBundlePath:
      "release/robinhood-chain-4663/production-verify-proof.attestation.json",
    productionVerifyAttestationBundleByteLength: "2048",
    productionVerifyAttestationBundleSha256: sha("c"),
    productionVerifyRunId: "123456",
    productionVerifyRunAttempt: "1",
    productionVerifyArtifactId: "98765",
    productionVerifyArtifactDigest: sha("d"),
    repository: "programmablehq/PROGRAMMABLE",
    repositoryId: "1314365508",
    workflow: ".github/workflows/capture-robinhood-custom-launch-postdeployment.yml",
    sourceRef: "refs/heads/production",
    sourceRevision: closure.revision,
    sourceTree: closure.tree,
    sourceClosureDigest: closure.sourceClosureDigest,
    verifiedAt: "2026-08-29T14:50:00.000Z",
    verificationDigest: null,
  };
  const captureAuthorization = {
    ...authorizationWithoutDigest,
    verificationDigest: canonicalSha256(
      authorizationWithoutDigest.schemaVersion,
      authorizationWithoutDigest,
    ),
  };
  const postingEvent = {
    batchNumber: "7",
    beforeAcc: hash("4"),
    afterAcc: hash("5"),
    delayedAcc: hash("6"),
    afterDelayedMessagesRead: "0",
    timeBounds: {
      delayBlocks: "1",
      futureBlocks: "2",
      delaySeconds: "3",
      futureSeconds: "4",
    },
    dataLocation: 0,
    transactionHash: hash("7"),
    transactionIndex: "1",
    blockNumber: "21000000",
    blockHash: hash("8"),
    logIndex: "1",
  };
  const l2ProviderPins = [
    { role: "primary", providerId: "quicknode", trustDomain: "quicknode.com" },
    { role: "secondary", providerId: "alchemy", trustDomain: "alchemy.com" },
  ];
  const l2ProviderReadbacks = l2ProviderPins.map((provider, index) => {
    const verifiedState = testCaptureVerifiedState(provider.providerId, provider.trustDomain);
    return {
      identity: {
        ...provider,
        authentication: "provider-credential",
        observedAt: `2026-08-29T14:49:0${index}.000Z`,
      },
      transactionHash: verifiedState.transaction.hash,
      signedTransactionSha256: sha(String(index + 1)),
      receiptDigest: testResponseDigest(testL2EntryOrder, "receipt", String(index + 1)),
      deploymentBlock: {
        blockNumber: "50000000",
        blockHash: hash("2"),
        predecessorBlockHash: hash("3"),
      },
      batchNumber: "7",
      l1Confirmations: String(index + 1),
      normalizedStateDigest: canonicalSha256(
        "programmable.robinhood-custom-launch.normalized-l2-state.v1", verifiedState,
      ),
      verifiedState,
      inventory: testCaptureInventory(
        "robinhood", provider.providerId, provider.trustDomain,
        testL2EntryOrder, String(index + 1),
      ),
    };
  });
  const ethereumProviderPins = [
    { role: "primary", providerId: "drpc", trustDomain: "drpc.org" },
    { role: "secondary", providerId: "quicknode", trustDomain: "quicknode.com" },
  ];
  const ethereumProviderReadbacks = ethereumProviderPins.map((provider, index) => ({
    identity: {
      ...provider,
      authentication: "provider-credential",
      observedAt: `2026-08-29T14:49:1${index}.000Z`,
    },
    postingEvent: structuredClone(postingEvent),
    receiptStatus: "1",
    postingReceiptDigest: testResponseDigest(
      testEthereumEntryOrder, "postingReceipt", String(index + 3),
    ),
    postingBlockDigest: testResponseDigest(
      testEthereumEntryOrder, "postingBlock", String(index + 3),
    ),
    finalizedCheckpoint: {
      blockNumber: "21000001",
      blockHash: hash("9"),
      tag: "finalized",
      firstReadDigest: testResponseDigest(
        testEthereumEntryOrder, "finalizedTag", String(index + 3),
      ),
      rereadDigest: testResponseDigest(
        testEthereumEntryOrder, "finalizedReread", String(index + 3),
      ),
    },
    inventory: testCaptureInventory(
      "ethereum", provider.providerId, provider.trustDomain,
      testEthereumEntryOrder, String(index + 3),
    ),
  }));
  const sourcify = testCaptureSourcify(verification);
  const captureInventorySubject = [
    ...l2ProviderReadbacks.map(({ inventory }) => inventory),
    ...ethereumProviderReadbacks.map(({ inventory }) => inventory),
    ...sourcify.map((entry) => ({
      layer: "sourcify",
      contract: entry.contract,
      responseSha256: entry.responseSha256,
      responseByteLength: entry.responseByteLength,
    })),
  ];
  const captureClosure = {
    schemaVersion: "programmable.robinhood-custom-launch.capture-closure.v3",
    captureId: "a".repeat(64),
    observedAt: "2026-08-29T14:49:00.000Z",
    expiresAt: "2026-08-29T15:09:00.000Z",
    profileDigest:
      "sha256:a3149f6a013eae1ca0fd932e0da0ddb8b8796d880ef53800830bfaaf49fe56c4",
    sourceOrigin: {
      repository: "programmablehq/PROGRAMMABLE",
      repositoryId: "1314365508",
      protectedRef: "refs/heads/production",
      revision: closure.revision,
      tree: closure.tree,
      sourceClosureDigest: closure.sourceClosureDigest,
    },
    authorization: captureAuthorization,
    l2Checkpoint: { blockNumber: "50000000", blockHash: hash("2") },
    l2ProviderReadbacks,
    batchNumber: "7",
    postingEvent,
    ethereumProviderReadbacks,
    ethereumFinalizedCheckpoint: {
      blockNumber: "21000001",
      blockHash: hash("9"),
      tag: "finalized",
    },
    sourcify,
    sourceVerificationClosureDigest: verification.sourceVerificationClosureDigest,
    captureInventoryDigest: canonicalSha256(
      "programmable.robinhood-custom-launch.capture-inventory.v3", captureInventorySubject,
    ),
    captureSubjectSha256: captureAuthorization.subjectSha256,
    captureClosureDigest: sha("5"),
  };
  const backendAssetWithoutDigest = {
    schemaVersion: "programmable.robinhood-custom-launch.backend-release-assets.v1",
    state: "phase-a-closed",
    publicAuthorization: false,
    chainDeploymentDescriptorDigest: descriptorDigest,
    chainDeployment: {
      path: "release/robinhood-v4-chain-deployment.v1.json",
      sha256: artifact("release/robinhood-v4-chain-deployment.v1.json", descriptor).sha256,
      byteLength: artifact("release/robinhood-v4-chain-deployment.v1.json", descriptor).byteLength,
    },
    preparedRootSourceManifest: {
      path: "release/robinhood-v4-prepared-root-source-manifest.v1.json",
      sha256: artifact("release/robinhood-v4-prepared-root-source-manifest.v1.json", {
        schemaVersion: "programmable.robinhood-prepared-root-source-manifest.v1",
      }).sha256,
      byteLength: artifact("release/robinhood-v4-prepared-root-source-manifest.v1.json", {
        schemaVersion: "programmable.robinhood-prepared-root-source-manifest.v1",
      }).byteLength,
    },
    standardJsonInputs: [
      {
        contract: "router",
        path:
          "release/assets/robinhood-v4/ProgrammableLaunchStampRouterV1.standard-input.json",
        sha256: sha256Bytes(Buffer.from("router", "utf8")),
        byteLength: "6",
      },
      {
        contract: "graphFactory",
        path:
          "release/assets/robinhood-v4/ProgrammableCreate2GraphDeployerV1.standard-input.json",
        sha256: sha256Bytes(Buffer.from("graph", "utf8")),
        byteLength: "5",
      },
    ],
    backendRuntimeReadinessRequired: true,
    flyControlPlaneReceiptRequired: true,
  };
  const backendReleaseAssets = {
    ...backendAssetWithoutDigest,
    backendReleaseAssetsDigest: canonicalSha256(
      backendAssetWithoutDigest.schemaVersion,
      backendAssetWithoutDigest,
    ),
  };
  const developers = {
    schemaVersion: DEVELOPERS_PROMOTION_INPUT_SCHEMA,
    status: "closed-awaiting-backend-readiness",
    publicAuthorization: false,
    publicWrites: false,
    chainId: "4663",
    caip2: "eip155:4663",
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    chainDeploymentDescriptorDigest: descriptorDigest,
    startBlock: "50000000",
    finalizedCheckpoint: { blockNumber: "50000000", blockHash: hash("2") },
    finalityPolicy: structuredClone(RELEASE_CONSTANTS.finalityPolicy),
    roots: structuredClone(RELEASE_CONSTANTS.roots),
    sourceVerificationEvidenceDigest: verification.evidenceDigest,
    sourceVerificationClosureDigest: verification.sourceVerificationClosureDigest,
    captureClosureDigest: captureClosure.captureClosureDigest,
    postingEventDigest: canonicalSha256(
      "programmable.robinhood-custom-launch.sequencer-posting-event.v1",
      postingEvent,
    ),
    backendReleaseAssetsDigest: backendReleaseAssets.backendReleaseAssetsDigest,
    backendPromotionPublicInputDigest: null,
    backendPromotionInputDigest: null,
    backendReleaseEvidenceDigest: null,
    backendAuthorizationDigest: null,
    releaseManifestDigest: null,
    backendRuntimeReadinessRequired: true,
    flyControlPlaneReceiptRequired: true,
    sourceRevision: closure.revision,
    sourceTree: closure.tree,
    sourceClosureDigest: closure.sourceClosureDigest,
  };
  const sourceManifest = {
    schemaVersion: "programmable.robinhood-prepared-root-source-manifest.v1",
  };
  const cliBinding = {
    releaseReady: false,
    blockers: ["releaseManifestEvidence", "backendReleaseEvidence"],
    evidence: { manifest: null, backend: null },
    releaseIdentity: {
      profile: {
        structuralProfileId: "programmable.custom-launch.robinhood-mainnet.v1",
        businessProfileId: "robinhood-production-launch",
        profileRevision: 4,
        profileVersion: "4.0.0",
        profileDigest: sha("a"),
        admissionPolicyDigest: sha("b"),
      },
      policySource: { schemaVersion: "programmable.custom-launch-policy-source.v1" },
      finalityPolicy: structuredClone(RELEASE_CONSTANTS.finalityPolicy),
    },
    machineContracts: [{ name: "openapi", sha256: sha("c") }],
  };
  const indexerConsumer = {
    schemaVersion: "programmable.robinhood-custom-launch.indexer-bootstrap.v1",
    status: "closed-awaiting-backend-readiness",
    publicAuthorization: false,
    publicWrites: false,
    chainId: "4663",
    caip2: "eip155:4663",
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    chainDeploymentDescriptorDigest: descriptorDigest,
    router: { ...structuredClone(RELEASE_CONSTANTS.roots.programmableLaunchStampRouter),
      startBlock: "50000000" },
    graphFactory: { ...structuredClone(RELEASE_CONSTANTS.roots.graphFactory),
      startBlock: "50000000" },
    permitAuthority: { ...structuredClone(RELEASE_CONSTANTS.roots.permitAuthority),
      startBlock: "50000000" },
    finalizedCheckpoint: structuredClone(developers.finalizedCheckpoint),
    finalityEvidenceDigest: sha("4"),
    sourceRevision: closure.revision,
    sourceTree: closure.tree,
    sourceClosureDigest: closure.sourceClosureDigest,
    sourceVerificationClosureDigest: verification.sourceVerificationClosureDigest,
    captureClosureDigest: captureClosure.captureClosureDigest,
    backendReleaseAssetsDigest: backendReleaseAssets.backendReleaseAssetsDigest,
    backendPromotionPublicInputDigest: null,
    backendPromotionInputDigest: null,
    backendReleaseEvidenceDigest: null,
    backendAuthorizationDigest: null,
    releaseManifestDigest: null,
    postingEventDigest: developers.postingEventDigest,
    standardJsonInputs: closure.entries.map(({ path: entryPath, sha256 }) => ({
      path: entryPath,
      sha256,
    })),
  };
  const cliConsumer = {
    schemaVersion: "programmable.robinhood-custom-launch.cli-promotion-input.v1",
    status: "closed-awaiting-backend-readiness",
    publicAuthorization: false,
    publicWrites: false,
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    chainDeploymentDescriptorDigest: descriptorDigest,
    chainDeploymentPath: "contracts/deployments/robinhood-custom-launch-v1.json",
    releaseBindingPath: "docs/operations/releases/custom-launch-v4/cli-release-binding.json",
    profile: structuredClone(cliBinding.releaseIdentity.profile),
    releaseManifestDigest: null,
    captureClosureDigest: captureClosure.captureClosureDigest,
    sourceVerificationClosureDigest: verification.sourceVerificationClosureDigest,
    backendReleaseAssetsDigest: backendReleaseAssets.backendReleaseAssetsDigest,
    backendPromotionPublicInputDigest: null,
    backendPromotionInputDigest: null,
    backendReleaseEvidenceDigest: null,
    backendAuthorizationDigest: null,
  };
  const backendConsumer = {
    schemaVersion: "programmable.robinhood-custom-launch.backend-release-input.v1",
    state: "phase-a-closed",
    publicAuthorization: false,
    chainId: "4663",
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    chainDeploymentDescriptorDigest: descriptorDigest,
    backendReleaseAssetsDigest: backendReleaseAssets.backendReleaseAssetsDigest,
    backendPromotionPublicInputDigest: null,
    backendPromotionInputDigest: null,
    backendReleaseEvidenceDigest: null,
    backendAuthorizationDigest: null,
    chainDeployment: structuredClone(backendReleaseAssets.chainDeployment),
    preparedRootSourceManifest: structuredClone(backendReleaseAssets.preparedRootSourceManifest),
    standardJsonInputs: structuredClone(backendReleaseAssets.standardJsonInputs),
    runtimeReadinessPath: "/v4/chains/4663/readiness",
    runtimeReadinessSchemaVersion: "programmable.custom-launch-api-release-identity.v4",
    flyControlPlaneReceiptRequired: true,
  };
  const withoutDigest = {
    schemaVersion: STAGE_BUNDLE_SCHEMA,
    state: "closed-awaiting-backend-readiness",
    releaseReady: false,
    publicAuthorization: false,
    publicWrites: false,
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    inputEvidenceDigest: sha("3"),
    preparedArtifact: {
      path: "contracts/deployments/robinhood-custom-launch-v1.predeployment.json",
      sha256:
        "sha256:2d58b964232d345f82aa7c7d58e678df03bf83828b9d95da42f3cd54ab03319e",
      state: "prepared-not-broadcast",
      preserved: true,
    },
    captureAuthorization,
    captureClosure,
    sourceVerification: verification,
    sourceClosure: closure,
    backendReleaseAssets,
    finalizedBindings: {
      chainId: "4663",
      caip2: "eip155:4663",
      chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
      chainDeploymentDescriptorDigest: descriptorDigest,
      deploymentTransactionHash: hash("1"),
      deploymentBlockNumber: "50000000",
      deploymentBlockHash: hash("2"),
      startBlock: "50000000",
      finalityEvidenceDigest: sha("4"),
      captureClosureDigest: captureClosure.captureClosureDigest,
      postingEventDigest: developers.postingEventDigest,
      sourceClosureDigest: closure.sourceClosureDigest,
      sourceVerificationClosureDigest: verification.sourceVerificationClosureDigest,
      backendReleaseAssetsDigest: backendReleaseAssets.backendReleaseAssetsDigest,
      backendPromotionPublicInputDigest: null,
      backendPromotionInputDigest: null,
      backendReleaseEvidenceDigest: null,
      backendAuthorizationDigest: null,
      releaseManifestDigest: null,
    },
    artifacts: {
      liveDeployment: artifact(
        "contracts/deployments/robinhood-custom-launch-v1.json",
        descriptor,
      ),
      cliReleaseBinding: {
        ...artifact(
          "docs/operations/releases/custom-launch-v4/cli-release-binding.json",
          cliBinding,
        ),
        replacesSha256: sha("4"),
      },
      backendRelease: {
        chainDeployment: artifact(
          "release/robinhood-v4-chain-deployment.v1.json",
          descriptor,
        ),
        preparedRootSourceManifest: artifact(
          "release/robinhood-v4-prepared-root-source-manifest.v1.json",
          sourceManifest,
        ),
        standardJsonInputs: [
          binaryArtifact(backendReleaseAssets.standardJsonInputs[0].path,
            Buffer.from("router", "utf8")),
          binaryArtifact(backendReleaseAssets.standardJsonInputs[1].path,
            Buffer.from("graph", "utf8")),
        ],
      },
    },
    consumerInputs: {
      indexer: indexerConsumer,
      cli: cliConsumer,
      developers,
      backend: backendConsumer,
    },
  };
  return {
    ...withoutDigest,
    stageBundleDigest: canonicalSha256(STAGE_BUNDLE_SCHEMA, withoutDigest),
  };
}

function liveManifest(bundle, phase = "promotion") {
  const promotion = phase === "stage" ? parseStageBundle(bundle) : parsePromotionBundle(bundle);
  const chainBindings = Object.fromEntries(
    Object.entries(RELEASE_CONSTANTS.roots).map(([name, root]) => [
      name,
      {
        ...structuredClone(root),
        provenance: name === "permit2" ? "genesis-allocation" : "deployment-block",
        startBlock: name === "permit2"
          ? "0"
          : ["poolManager", "positionManager", "stateView", "v4Quoter", "universalRouter"]
              .includes(name)
            ? ({
                poolManager: "9070",
                positionManager: "9073",
                stateView: "9075",
                v4Quoter: "9074",
                universalRouter: "3347899",
              })[name]
            : promotion.startBlock,
      },
    ]),
  );
  return {
    chainId: 4663,
    caip2: "eip155:4663",
    chains: [{ chainId: 4663, status: "live" }],
    customLaunchV4: {
      status: "live",
      chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
      chainDeploymentDescriptorDigest: promotion.descriptorDigest,
      finalityPolicy: structuredClone(RELEASE_CONSTANTS.finalityPolicy),
    },
    launchStampRouter: {
      status: "live",
      address: RELEASE_CONSTANTS.roots.programmableLaunchStampRouter.address,
      runtimeCodeHash:
        RELEASE_CONSTANTS.roots.programmableLaunchStampRouter.runtimeCodeHash,
      startBlock: promotion.startBlock,
    },
    robinhoodCustomLaunchBinding: {
      state: "finalized-live",
      chainDeployment: structuredClone(promotion.descriptor),
      chainBindings,
      deployment: {
        blockNumber: promotion.startBlock,
        blockHash: promotion.finalizedCheckpoint.blockHash,
        startBlock: promotion.startBlock,
      },
    },
    extensions: { "programmable/read-model-v1": { status: "live" } },
  };
}

function plannedManifest() {
  return {
    chainId: 4663,
    caip2: "eip155:4663",
    customLaunchV4: {
      status: "planned",
      chainDeploymentDescriptorDigest: null,
      profile: null,
      finalityPolicy: null,
    },
    launchStampRouter: {
      status: "planned",
      address: null,
      startBlock: null,
      runtimeCodeHash: null,
      artifact: null,
      deploymentEvidence: null,
      canaryEvidence: null,
    },
    robinhoodCustomLaunchBinding: {
      state: "prepared-not-broadcast",
      deployment: {
        transactionHash: null,
        blockNumber: null,
        blockHash: null,
        startBlock: null,
        finalizedBlockNumber: null,
        finalizedBlockHash: null,
        finalityEvidence: null,
      },
      chainDeployment: null,
      publication: null,
    },
    deployments: [],
  };
}

function ethereumManifest() {
  return {
    directNativeHookGraphProfileV3: {
      api: {
        openApiUrl: "https://programmable.market/openapi/custom-launch-v3.json",
        openApiVersion: "3.3.9",
        openApiSha256:
          "sha256:8c7f90255f62bb8c27083c868dfdef5a7cc15d9ed0815248c55b67b7b9302b6a",
        agentIntegration: {
          packConfigSchemaUrl:
            "https://programmable.market/schemas/custom-launch/v3/pack-config.json",
          packConfigSchemaSha256:
            "sha256:65e80af492582b8e42a440d9bbb23a776af31e22306ec828208959e8a790be15",
        },
      },
      cli: {
        packageName: "@programmable/launch",
        releaseVersion: "3.3.9",
        minimumSupportingVersion: "3.3.9",
        releaseUrl:
          "https://github.com/programmablehq/PROGRAMMABLE/releases/tag/programmable-launch-v3.3.9",
        tarballUrl:
          "https://github.com/programmablehq/PROGRAMMABLE/releases/download/programmable-launch-v3.3.9/programmable-launch-3.3.9.tgz",
        checksumUrl:
          "https://github.com/programmablehq/PROGRAMMABLE/releases/download/programmable-launch-v3.3.9/programmable-launch-3.3.9.tgz.sha256",
        tarballSha256:
          "sha256:44b71185355bea8db6820b61f12351db7cc1237aa7ecf9b0db3cfbb09bebee01",
        tarballByteLength: 309223,
        commands: ["pack", "validate", "submit", "status"],
      },
    },
  };
}

function deployment(id, url, aliases = []) {
  return {
    id,
    url: new URL(url).origin,
    target: "production",
    readyState: "READY",
    aliases,
    createdAt: 1_787_990_400_000,
  };
}

function publicResolution(
  value,
  checkedAt = "2026-08-29T15:00:00.000Z",
  resolutionTarget = target,
) {
  return createVercelPublicDeploymentResolution({
    origin: PRODUCTION_ORIGIN,
    deployment: value,
    target: resolutionTarget,
    checkedAt,
  });
}

const formalProductionAliases = [VERCEL_PRODUCTION_ORIGIN, PRODUCTION_ORIGIN]
  .map((origin) => new URL(origin).hostname)
  .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
const vercelProductionAliases = [new URL(VERCEL_PRODUCTION_ORIGIN).hostname];

function protectionProbeResponse(status, cancelled, headers = {}) {
  return {
    status,
    headers: new Headers(headers),
    body: {
      async cancel() {
        cancelled.push(status);
      },
    },
  };
}

test("retries only bounded unprotected generated-deployment responses", async () => {
  assert.equal(PROTECTION_PROBE_TIMEOUT_MS, 55_000);
  assert.deepEqual(PROTECTION_PROBE_RETRY_DELAYS_MS,
    [5_000, 10_000, 10_000, 10_000, 10_000]);

  const cancelled = [];
  const plannedUnavailableHeaders = {
    "content-type": "application/problem+json; charset=utf-8",
    "retry-after": "30",
    "x-programmable-status": "error",
  };
  const responses = [
    protectionProbeResponse(503, cancelled, plannedUnavailableHeaders),
    protectionProbeResponse(503, cancelled, plannedUnavailableHeaders),
    protectionProbeResponse(302, cancelled),
  ];
  const waits = [];
  const signal = new AbortController().signal;
  const requests = [];
  const response = await probeGeneratedDeploymentProtection(
    "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
    {
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return responses.shift();
      },
      waitImpl: async (delay, value, options) => {
        waits.push({ delay, value, options });
      },
      retryDelaysMs: [7, 11],
      signal,
    },
  );
  assert.equal(response.status, 302);
  assert.deepEqual(cancelled, [503, 503]);
  assert.deepEqual(waits.map(({ delay }) => delay), [7, 11]);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.url,
      "https://developers-stage.vercel.app/api/v2/status?chainId=4663");
    assert.deepEqual(request.options.headers, { accept: "text/html" });
    assert.equal(request.options.redirect, "manual");
    assert.equal(request.options.signal, signal);
  }
  assert.equal(waits.every(({ options }) => options.signal === signal), true);

  let unprotectedAttempts = 0;
  const stillUnprotected = await probeGeneratedDeploymentProtection(
    "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
    {
      fetchImpl: async () => {
        unprotectedAttempts += 1;
        return protectionProbeResponse(503, [], plannedUnavailableHeaders);
      },
      waitImpl: async () => {},
      retryDelaysMs: [0, 0],
      signal,
    },
  );
  assert.equal(stillUnprotected.status, 503);
  assert.equal(unprotectedAttempts, 3);
  const candidate = deployment(
    "dpl_unprotected123",
    "https://developers-stage.vercel.app",
  );
  assert.throws(() => createStageProtectionEvidence({
    deployment: candidate,
    projectId: target.projectId,
    projectProtection: {
      id: target.projectId,
      ssoProtection: { deploymentType: "prod_deployment_urls_and_all_previews" },
      protectionBypass: { "release-control": { scope: "automation-bypass" } },
    },
    response: {
      status: stillUnprotected.status,
      location: null,
      server: "Vercel",
      vercelId: "fra1::test",
    },
    checkedAt: "2026-08-29T14:59:00.000Z",
  }), /did not return its authentication redirect/u);

  for (const terminalStatus of [200, 301, 302, 401, 404, 429, 503]) {
    let attempts = 0;
    const terminal = await probeGeneratedDeploymentProtection(
      "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
      {
        fetchImpl: async () => {
          attempts += 1;
          return protectionProbeResponse(terminalStatus, []);
        },
        waitImpl: async () => assert.fail("terminal responses must not be retried"),
        retryDelaysMs: [0, 0],
        signal,
      },
    );
    assert.equal(terminal.status, terminalStatus);
    assert.equal(attempts, 1);
  }

  for (const malformedHeaders of [
    {},
    { ...plannedUnavailableHeaders, "content-type": "text/html" },
    { ...plannedUnavailableHeaders, "x-programmable-status": "ready" },
    { ...plannedUnavailableHeaders, "retry-after": "60" },
  ]) {
    let attempts = 0;
    const malformed = await probeGeneratedDeploymentProtection(
      "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
      {
        fetchImpl: async () => {
          attempts += 1;
          return protectionProbeResponse(503, [], malformedHeaders);
        },
        waitImpl: async () => assert.fail("unrelated 503 responses must not be retried"),
        retryDelaysMs: [0, 0],
        signal,
      },
    );
    assert.equal(malformed.status, 503);
    assert.equal(attempts, 1);
  }

  const abort = new DOMException("probe aborted", "AbortError");
  let abortedAttempts = 0;
  await assert.rejects(probeGeneratedDeploymentProtection(
    "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
    {
      fetchImpl: async () => {
        abortedAttempts += 1;
        throw abort;
      },
      retryDelaysMs: [0, 0],
      signal,
    },
  ), (error) => error === abort);
  assert.equal(abortedAttempts, 1);
});

test("retries only the exact Vercel deployment propagation 404", async () => {
  const propagationHeaders = {
    "content-type": "text/plain; charset=utf-8",
    server: "Vercel",
    "x-vercel-error": "DEPLOYMENT_NOT_FOUND",
    "x-vercel-id": "fra1::iad1::retry-test",
  };
  const cancelled = [];
  const responses = [
    protectionProbeResponse(404, cancelled, propagationHeaders),
    protectionProbeResponse(302, cancelled),
  ];
  let attempts = 0;
  const protectedResponse = await probeGeneratedDeploymentProtection(
    "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
    {
      fetchImpl: async () => {
        attempts += 1;
        return responses.shift();
      },
      waitImpl: async () => {},
      retryDelaysMs: [0],
      signal: new AbortController().signal,
    },
  );
  assert.equal(protectedResponse.status, 302);
  assert.equal(attempts, 2);
  assert.deepEqual(cancelled, [404]);

  for (const malformedHeaders of [
    {},
    { ...propagationHeaders, "content-type": "application/problem+json" },
    { ...propagationHeaders, server: "cloudflare" },
    { ...propagationHeaders, "x-vercel-error": "NOT_FOUND" },
    { ...propagationHeaders, "x-vercel-id": "?" },
  ]) {
    attempts = 0;
    const malformed = await probeGeneratedDeploymentProtection(
      "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
      {
        fetchImpl: async () => {
          attempts += 1;
          return protectionProbeResponse(404, [], malformedHeaders);
        },
        waitImpl: async () => assert.fail("unrelated 404 responses must not be retried"),
        retryDelaysMs: [0],
        signal: new AbortController().signal,
      },
    );
    assert.equal(malformed.status, 404);
    assert.equal(attempts, 1);
  }
});

test("requests the Vercel protection redirect representation", async () => {
  let observedAccept = null;
  const response = await probeGeneratedDeploymentProtection(
    "https://developers-stage.vercel.app/api/v2/status?chainId=4663",
    {
      fetchImpl: async (_url, options) => {
        observedAccept = options.headers.accept;
        return protectionProbeResponse(observedAccept === "text/html" ? 302 : 401, []);
      },
      waitImpl: async () => assert.fail("a protected response must not be retried"),
      retryDelaysMs: [0],
      signal: new AbortController().signal,
    },
  );
  assert.equal(observedAccept, "text/html");
  assert.equal(response.status, 302);
});

test("accepts automatic provider aliases on staged candidates and rejects formal domains", () => {
  const providerAlias = "programmable-developers-aficialais-projects.vercel.app";
  const candidate = deployment(
    "dpl_provideralias123",
    "https://developers-stage.vercel.app",
    [providerAlias],
  );
  assert.deepEqual(assertVercelStagedDeployment(candidate, "planned candidate"), candidate);

  for (const formalAlias of formalProductionAliases) {
    assert.throws(() => assertVercelStagedDeployment({
      ...candidate,
      aliases: [formalAlias],
    }, "planned candidate"), /formal production domain/u);
  }
});

function productionDomainInventory(
  checkedAt = "2026-08-29T15:00:30.000Z",
  overrides = {},
) {
  return createVercelProductionDomainInventory({
    domainsOutput: {
      domains: formalProductionAliases.map((name) => ({
        name,
        verified: true,
        gitBranch: null,
        customEnvironmentId: null,
        projectId: target.projectId,
        ...overrides[name],
      })),
    },
    projectId: target.projectId,
    checkedAt,
  });
}

function mutationControl(
  checkedAt = "2026-08-29T15:00:01.000Z",
  projectOverrides = {},
) {
  return createVercelMutationControlEvidence({
    project: {
      id: target.projectId,
      rollingRelease: false,
      lastAliasRequest: null,
      ...projectOverrides,
    },
    target,
    checkedAt,
  });
}

function productionBinding(
  value,
  checkedAt = "2026-08-29T15:00:30.000Z",
  evidenceCheckedAt = checkedAt,
) {
  const providerResolution = createVercelProviderDeploymentResolution({
    origin: VERCEL_PRODUCTION_ORIGIN,
    deployment: value,
    target,
    checkedAt,
  });
  const publicResolution = createVercelPublicDeploymentResolution({
    origin: PRODUCTION_ORIGIN,
    deployment: value,
    target,
    checkedAt: evidenceCheckedAt,
  });
  return createVercelProductionBinding({
    deployment: value,
    target,
    providerResolution,
    providerAliasBinding: providerAliasBinding(value, evidenceCheckedAt),
    publicResolution,
    publicAliasBinding: publicAliasBinding(value, evidenceCheckedAt),
    productionDomainInventory: productionDomainInventory(evidenceCheckedAt),
  });
}

function providerAliasBinding(
  value,
  checkedAt = "2026-08-29T15:00:30.000Z",
  overrides = {},
) {
  return createVercelProviderAliasBinding({
    aliasOutput: {
      alias: new URL(VERCEL_PRODUCTION_ORIGIN).hostname,
      deploymentId: value.id,
      projectId: target.projectId,
      redirect: null,
      deletedAt: null,
      ...overrides,
    },
    deployment: value,
    projectId: target.projectId,
    checkedAt,
  });
}

function publicAliasBinding(
  value,
  checkedAt = "2026-08-29T15:00:30.000Z",
  overrides = {},
) {
  return createVercelPublicAliasBinding({
    aliasOutput: {
      alias: new URL(PRODUCTION_ORIGIN).hostname,
      deploymentId: value.id,
      projectId: target.projectId,
      redirect: null,
      deletedAt: null,
      ...overrides,
    },
    deployment: value,
    projectId: target.projectId,
    checkedAt,
  });
}

function protectionEvidence(
  value,
  checkedAt = "2026-08-29T14:59:00.000Z",
  deploymentType = "prod_deployment_urls_and_all_previews",
) {
  return createStageProtectionEvidence({
    deployment: value,
    projectId: target.projectId,
    projectProtection: {
      id: target.projectId,
      ssoProtection: {
        deploymentType,
      },
      protectionBypass: {
        "release-control": { scope: "automation-bypass" },
      },
    },
    response: {
      status: 307,
      location: "https://vercel.com/sso-api?url=developers-stage.vercel.app",
      server: "Vercel",
      vercelId: "fra1::test",
    },
    checkedAt,
  });
}

function smoke(
  mode,
  origin,
  bundle,
  checkedAt = "2026-08-29T15:00:00.000Z",
  bundlePhase = "promotion",
  manifestDigest = sha(mode === "live" ? "6" : "7"),
) {
  return createSmokeReceipt({
    mode,
    origin,
    ...(bundle ? { bundlePhase, bundle } : {}),
    manifestDigest,
    manifestStatus: mode,
    service: mode === "live" ? "operational" : "degraded",
    launchFeedStatus: mode === "live" ? "ready" : "unavailable",
    tokenListStatus: mode === "live" ? "ready" : "unavailable",
    launchCount: 0,
    tokenCount: 0,
    checkedAt,
  });
}

function indexerEvidence(bundle) {
  const promotion = parsePromotionBundle(bundle);
  const identityWithoutDigest = {
    schemaVersion: "programmable.robinhood-indexer-release-identity.v1",
    deployment: "robinhood-production-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".slice(0, 28),
    sourceCommit: "a".repeat(40),
    sourceTree: "b".repeat(40),
    configSha256: hash("1"),
    schemaSha256: hash("2"),
    handlerSha256: hash("3"),
    sourceRegistrySha256: hash("4"),
    eventSetSha256: hash("5"),
    eventCount: 3,
    chainId: 4663,
    caip2: "eip155:4663",
    chainDeploymentId: "robinhood-mainnet-custom-launch-v1",
    promotionBundleDigest: promotion.promotionBundleDigest,
    chainDeploymentDescriptorDigest: promotion.descriptorDigest,
    sourceClosureDigest: promotion.sourceClosure.sourceClosureDigest,
    finalityEvidenceDigest: promotion.finalizedBindings.finalityEvidenceDigest,
    router: {
      ...structuredClone(RELEASE_CONSTANTS.roots.programmableLaunchStampRouter),
      startBlock: promotion.startBlock,
    },
    finalizedCheckpoint: structuredClone(promotion.finalizedCheckpoint),
  };
  identityWithoutDigest.deployment =
    `robinhood-production-${identityWithoutDigest.sourceCommit.slice(0, 7)}`;
  const baseReleaseIdentity = {
    ...identityWithoutDigest,
    releaseIdentityDigest: canonicalSha256(
      identityWithoutDigest.schemaVersion, identityWithoutDigest,
    ),
  };
  const receiptWithoutDigest = {
    schemaVersion: "programmable.robinhood-indexer.envio-deployment-receipt.v1",
    capturedAt: "2026-08-29T14:58:00.000Z",
    provider: {
      platform: "envio-cloud",
      owner: "0xprogrammable",
      project: "programmable-indexer",
    },
    deploymentId: "envio-deployment-1",
    deploymentLabel: baseReleaseIdentity.deployment,
    endpointId: "abcdef123456",
    graphqlEndpoint: "https://indexer.hyperindex.xyz/abcdef123456/v1/graphql",
    sourceCommit: baseReleaseIdentity.sourceCommit,
    configSha256: baseReleaseIdentity.configSha256,
    releaseIdentityDigest: baseReleaseIdentity.releaseIdentityDigest,
    handoffDigest: sha("a"),
    previousDeploymentEvidenceDigest: sha("b"),
    status: "ready-awaiting-release-audit",
    providerReceiptSha256: sha("c"),
  };
  const baseDeploymentReceipt = {
    ...receiptWithoutDigest,
    receiptDigest: canonicalSha256(receiptWithoutDigest.schemaVersion, receiptWithoutDigest),
  };
  const protectionSnapshotWithoutDigest = {
    schemaVersion: "programmable.robinhood-indexer.github-protection-snapshot.v1",
    capturedAt: "2026-08-29T14:57:00.000Z",
    repository: "programmablehq/programmable-indexer",
    repositoryId: 1318021881,
    mechanism: "legacy-branch-protection-no-rulesets",
    branch: "production",
    ref: "refs/heads/production",
    observedHead: "c".repeat(40),
    policy: {
      strictRequiredStatusChecks: true,
      requiredStatusChecks: ["Credential leak gate", "Repository checks"],
      requiredCheckAppId: 15368,
      requiredApprovingReviewCount: 1,
      dismissStaleReviews: true,
      requiredConversationResolution: true,
      requiredLinearHistory: true,
      requiredSignatures: true,
      enforceAdmins: true,
      allowForcePushes: false,
      allowDeletions: false,
      pullRequestBypassAllowed: false,
    },
    apiClosure: {
      branchResponseSha256: sha("4"),
      branchProtectionResponseSha256: sha("5"),
      requiredSignaturesResponseSha256: sha("6"),
      repositoryRulesetsResponseSha256: sha("7"),
    },
  };
  const protectionSnapshot = {
    ...protectionSnapshotWithoutDigest,
    snapshotDigest: canonicalSha256(
      protectionSnapshotWithoutDigest.schemaVersion,
      protectionSnapshotWithoutDigest,
    ),
  };
  const protectedRefWithoutDigest = {
    schemaVersion: "programmable.robinhood-indexer.github-protected-run.v1",
    branch: "production",
    ref: "refs/heads/production",
    sourceRevision: "c".repeat(40),
    workflowSha: "c".repeat(40),
    nativeRefProtected: true,
    protectionSnapshot,
  };
  const protectedRef = {
    ...protectedRefWithoutDigest,
    protectedRunDigest: canonicalSha256(
      protectedRefWithoutDigest.schemaVersion,
      protectedRefWithoutDigest,
    ),
  };
  const producer = {
    repository: "programmablehq/programmable-indexer",
    repositoryId: 1318021881,
    workflowRef:
      "programmablehq/programmable-indexer/.github/workflows/publish-robinhood-indexer-release-evidence.yml@refs/heads/production",
    runId: "10001",
    runAttempt: "1",
    artifactName: "robinhood-indexer-release-evidence-10001-1",
    publishedAt: "2026-08-29T15:00:30.000Z",
    sourceRevision: "c".repeat(40),
    sourceTree: "d".repeat(40),
    protectedRef,
  };
  const auditWithoutDigest = {
    schemaVersion: "programmable.robinhood-indexer.release-audit.v1",
    status: "verified-ready-for-explicit-promotion",
    publicAuthorization: false,
    producer,
    closureDigest: sha("8"),
    capturedAt: "2026-08-29T14:59:00.000Z",
    evidenceWindow: {
      previousDeploymentCapturedAt: "2026-08-29T14:50:00.000Z",
      providerDeploymentCapturedAt: baseDeploymentReceipt.capturedAt,
      primaryRpcCapturedAt: "2026-08-29T14:58:10.000Z",
      secondaryRpcCapturedAt: "2026-08-29T14:58:20.000Z",
      indexerCapturedAt: "2026-08-29T14:58:30.000Z",
      observationWindowMilliseconds: 20_000,
      auditDelayMilliseconds: 30_000,
    },
    chainId: 4663,
    caip2: "eip155:4663",
    releaseIdentityDigest: baseReleaseIdentity.releaseIdentityDigest,
    handoffDigest: baseDeploymentReceipt.handoffDigest,
    deploymentReceiptDigest: baseDeploymentReceipt.receiptDigest,
    snapshotDigest: sha("d"),
    rpcEvidenceDigests: [sha("e"), sha("f")],
    reconciliationDigest: sha("1"),
    backfill: {
      throughBlock: promotion.startBlock,
      throughBlockHash: promotion.finalizedCheckpoint.blockHash,
      counts: { RouterLaunch: 0, RouterRoute: 0, RouterComponent: 0 },
      totalLogs: 0,
      backfillDigest: sha("2"),
    },
    promotionAuthority: "explicit-product-owner",
  };
  const releaseAudit = {
    ...auditWithoutDigest,
    auditDigest: canonicalSha256(auditWithoutDigest.schemaVersion, auditWithoutDigest),
  };
  const releaseIdentityWithoutDigest = {
    schemaVersion: "programmable.robinhood-indexer.published-release-identity.v1",
    evidence: baseReleaseIdentity,
    producer,
  };
  const releaseIdentity = {
    ...releaseIdentityWithoutDigest,
    publicationDigest: canonicalSha256(
      releaseIdentityWithoutDigest.schemaVersion,
      releaseIdentityWithoutDigest,
    ),
  };
  const deploymentReceiptWithoutDigest = {
    schemaVersion: "programmable.robinhood-indexer.published-envio-deployment-receipt.v1",
    evidence: baseDeploymentReceipt,
    producer,
  };
  const deploymentReceipt = {
    ...deploymentReceiptWithoutDigest,
    publicationDigest: canonicalSha256(
      deploymentReceiptWithoutDigest.schemaVersion,
      deploymentReceiptWithoutDigest,
    ),
  };
  const tracked = (artifactPath, value, character) => ({
    path: artifactPath,
    gitBlob: character.repeat(40),
    sha256: sha256Bytes(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")),
  });
  return {
    releaseIdentity,
    deploymentReceipt,
    releaseAudit,
    artifacts: {
      releaseIdentity: tracked(
        CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
        releaseIdentity,
        "1",
      ),
      deploymentReceipt: tracked(
        CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
        deploymentReceipt,
        "2",
      ),
      releaseAudit: tracked(
        CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
        releaseAudit,
        "3",
      ),
    },
  };
}

test("keeps Phase A closed and accepts Phase B only through its distinct parser", () => {
  const stageBundle = stageFixture();
  const stage = parseStageBundle(stageBundle);
  assert.equal(stage.bundleDigest, stageBundle.stageBundleDigest);
  assert.equal(stage.developers.status, "closed-awaiting-backend-readiness");
  assert.equal(stage.developers.publicAuthorization, false);
  assert.equal(stage.developers.publicWrites, false);
  assert.equal(stageBundle.artifacts.cliReleaseBinding.value.releaseReady, false);
  assert.throws(() => parsePromotionBundle(stageBundle));

  for (const mutate of [
    (candidate) => { candidate.captureAuthorization.trustClass = "test-only"; },
    (candidate) => {
      candidate.captureClosure.l2ProviderReadbacks[0].identity.providerId = "drpc";
      candidate.captureClosure.l2ProviderReadbacks[0].identity.trustDomain = "drpc.org";
    },
    (candidate) => {
      candidate.captureClosure.schemaVersion =
        "programmable.robinhood-custom-launch.capture-closure.v2";
    },
    (candidate) => {
      candidate.captureClosure.l2ProviderReadbacks[0].inventory.entries[0]
        .responseBase64 = "e30=";
    },
    (candidate) => {
      candidate.captureClosure.l2ProviderReadbacks[0].inventory.entries[0].key =
        "rawTransaction";
      candidate.captureClosure.l2ProviderReadbacks[0].inventory.inventoryDigest =
        canonicalSha256(
          "programmable.robinhood-custom-launch.rpc-inventory.v2",
          candidate.captureClosure.l2ProviderReadbacks[0].inventory.entries,
        );
    },
    (candidate) => {
      const provider = candidate.captureClosure.l2ProviderReadbacks[0];
      provider.verifiedState.externalRoots[0].preStartBlockRuntimeCodeHash =
        RELEASE_CONSTANTS.roots.poolManager.runtimeCodeHash;
      provider.normalizedStateDigest = canonicalSha256(
        "programmable.robinhood-custom-launch.normalized-l2-state.v1",
        provider.verifiedState,
      );
    },
    (candidate) => {
      for (const provider of candidate.captureClosure.l2ProviderReadbacks) {
        provider.verifiedState.externalRoots[0].rawTransactionDigest = sha("f");
        provider.normalizedStateDigest = canonicalSha256(
          "programmable.robinhood-custom-launch.normalized-l2-state.v1",
          provider.verifiedState,
        );
      }
      const { stageBundleDigest: _digest, ...withoutDigest } = candidate;
      candidate.stageBundleDigest = canonicalSha256(STAGE_BUNDLE_SCHEMA, withoutDigest);
    },
    (candidate) => {
      for (const provider of candidate.captureClosure.l2ProviderReadbacks) {
        const root = provider.verifiedState.externalRoots[0];
        [root.rawTransactionDigest, root.transactionDigest, root.transactionReceiptDigest] = [
          root.transactionReceiptDigest,
          root.rawTransactionDigest,
          root.transactionDigest,
        ];
        provider.normalizedStateDigest = canonicalSha256(
          "programmable.robinhood-custom-launch.normalized-l2-state.v1",
          provider.verifiedState,
        );
      }
      const { stageBundleDigest: _digest, ...withoutDigest } = candidate;
      candidate.stageBundleDigest = canonicalSha256(STAGE_BUNDLE_SCHEMA, withoutDigest);
    },
    (candidate) => {
      for (const provider of candidate.captureClosure.ethereumProviderReadbacks) {
        [provider.postingReceiptDigest, provider.finalizedCheckpoint.firstReadDigest] = [
          provider.finalizedCheckpoint.firstReadDigest,
          provider.postingReceiptDigest,
        ];
      }
      const { stageBundleDigest: _digest, ...withoutDigest } = candidate;
      candidate.stageBundleDigest = canonicalSha256(STAGE_BUNDLE_SCHEMA, withoutDigest);
    },
    (candidate) => {
      candidate.captureClosure.ethereumProviderReadbacks[1].postingEvent.blockHash = hash("f");
    },
    (candidate) => {
      candidate.captureClosure.sourcify[0].responseSha256 = sha("f");
      candidate.captureClosure.sourceVerificationClosureDigest = canonicalSha256(
        "programmable.robinhood-custom-launch.sourcify-response-closure.v2",
        candidate.captureClosure.sourcify,
      );
    },
    (candidate) => { candidate.consumerInputs.developers.publicAuthorization = true; },
    (candidate) => { candidate.artifacts.cliReleaseBinding.value.releaseReady = true; },
    (candidate) => { candidate.backendReleaseAssets.backendReleaseAssetsDigest = sha("f"); },
    (candidate) => { candidate.stageBundleDigest = sha("e"); },
  ]) {
    const candidate = structuredClone(stageBundle);
    mutate(candidate);
    assert.throws(() => parseStageBundle(candidate));
  }

  const bundle = promotionFixture();
  const promotion = parsePromotionBundle(bundle, { stageBundle });
  assert.equal(promotion.promotionBundleDigest, bundle.promotionBundleDigest);
  assert.equal(promotion.developers.publicAuthorization, true);
  assert.equal(promotion.developers.publicWrites, true);
  assert.equal(promotion.startBlock, "50000000");
  assert.equal(JSON.stringify(bundle).includes("bodyBytesBase64"), false);
  assert.equal(JSON.stringify(bundle).includes("sanitizedBytesBase64"), false);
  assert.equal(JSON.stringify(bundle).includes("requestBase64"), false);
  assert.equal(JSON.stringify(bundle).includes("responseBase64"), false);
  assert.throws(() => parseStageBundle(bundle));
  assert.throws(() => parsePromotionBundle(legacyPromotionFixture()),
    /promotion bundle/u, "legacy raw Phase-B input must stay rejected");

  for (const mutate of [
    (candidate) => { candidate.extra = true; },
    (candidate) => { candidate.backendPromotionInput = legacyPromotionFixture()
      .backendPromotionInput; },
    (candidate) => {
      candidate.backendPromotionBinding.readbackReceipts.readiness.responseBase64 = "e30=";
    },
    (candidate) => {
      candidate.backendPromotionBinding.privateRawArtifact.bodyBytesBase64 = "e30=";
    },
    (candidate) => { candidate.consumerInputs.developers.publicAuthorization = false; },
    (candidate) => { candidate.state = "test-only-finalized"; },
    (candidate) => {
      candidate.consumerInputs.developers.roots.poolManager.address =
        "0x1111111111111111111111111111111111111111";
    },
    (candidate) => { candidate.sourceClosure.sourceClosureDigest = sha("f"); },
    (candidate) => { candidate.stageBundle.stageBundleDigest = sha("d"); },
    (candidate) => { candidate.backendPromotionBinding.readinessReadback = {}; },
    (candidate) => {
      candidate.backendPromotionBinding.captureAuthorization.verificationDigest = sha("0");
    },
    (candidate) => {
      candidate.backendAuthorization.producerRevision =
        candidate.backendAuthorization.stageSourceRevision;
      const { authorizationDigest: _authorizationDigest, ...withoutDigest } =
        candidate.backendAuthorization;
      candidate.backendAuthorization.authorizationDigest = canonicalSha256(
        candidate.backendAuthorization.schemaVersion,
        withoutDigest,
      );
    },
    (candidate) => { candidate.backendPromotionBinding.publicInputDigest = sha("0"); },
    (candidate) => { candidate.backendAuthorization.backendReleaseEvidenceDigest = sha("c"); },
    (candidate) => { candidate.promotionBundleDigest = sha("e"); },
  ]) {
    const candidate = structuredClone(bundle);
    mutate(candidate);
    assert.throws(() => parsePromotionBundle(candidate));
  }
});

test("requires fresh, exact protected Indexer publication evidence", () => {
  const evidence = indexerEvidence(promotionFixture());
  assert.doesNotThrow(() => parseIndexerReleaseAudit(evidence.releaseAudit, {
    releaseIdentity: evidence.releaseIdentity,
    deploymentReceipt: evidence.deploymentReceipt,
  }));

  const reseal = (candidate) => {
    const snapshot = candidate.producer.protectedRef.protectionSnapshot;
    const { snapshotDigest: _snapshotDigest, ...snapshotWithoutDigest } = snapshot;
    snapshot.snapshotDigest = canonicalSha256(snapshot.schemaVersion, snapshotWithoutDigest);
    const protectedRef = candidate.producer.protectedRef;
    const { protectedRunDigest: _protectedRunDigest, ...protectedRefWithoutDigest } = protectedRef;
    protectedRef.protectedRunDigest = canonicalSha256(
      protectedRef.schemaVersion,
      protectedRefWithoutDigest,
    );
    const { auditDigest: _auditDigest, ...auditWithoutDigest } = candidate;
    candidate.auditDigest = canonicalSha256(candidate.schemaVersion, auditWithoutDigest);
  };
  for (const mutate of [
    (candidate) => { candidate.producer.protectedRef.nativeRefProtected = false; },
    (candidate) => {
      candidate.producer.protectedRef.protectionSnapshot.policy.requiredStatusChecks.reverse();
    },
    (candidate) => {
      candidate.evidenceWindow.observationWindowMilliseconds = 20_001;
    },
    (candidate) => {
      candidate.producer.protectedRef.protectionSnapshot.capturedAt =
        "2026-08-28T14:56:59.999Z";
    },
    (candidate) => { candidate.producer.publishedAt = "2026-08-30T15:05:00.000Z"; },
  ]) {
    const candidate = structuredClone(evidence.releaseAudit);
    mutate(candidate);
    reseal(candidate);
    assert.throws(() => parseIndexerReleaseAudit(candidate, {
      releaseIdentity: evidence.releaseIdentity,
      deploymentReceipt: evidence.deploymentReceipt,
    }));
  }

  const mismatchedIdentity = structuredClone(evidence.releaseIdentity);
  mismatchedIdentity.producer.sourceTree = "e".repeat(40);
  const { publicationDigest: _publicationDigest, ...identityWithoutDigest } =
    mismatchedIdentity;
  mismatchedIdentity.publicationDigest = canonicalSha256(
    mismatchedIdentity.schemaVersion,
    identityWithoutDigest,
  );
  assert.throws(() => parseIndexerReleaseAudit(evidence.releaseAudit, {
    releaseIdentity: mismatchedIdentity,
    deploymentReceipt: evidence.deploymentReceipt,
  }), /share exact producer provenance/u);
});

test("keeps planned/null state non-live and accepts live state only against the bundle", () => {
  const stageBundle = stageFixture();
  const stage = parseStageBundle(stageBundle);
  const bundle = promotionFixture();
  const promotion = parsePromotionBundle(bundle);
  assert.equal(validatePlannedRobinhoodManifest(plannedManifest()).chainId, 4663);
  assert.equal(validateLiveRobinhoodManifest(
    liveManifest(stageBundle, "stage"), stage,
  ).customLaunchV4.status, "live");
  const live = liveManifest(bundle);
  assert.equal(validateLiveRobinhoodManifest(live, promotion).customLaunchV4.status, "live");

  const syntacticLive = plannedManifest();
  syntacticLive.customLaunchV4.status = "live";
  assert.throws(() => validatePlannedRobinhoodManifest(syntacticLive));
  const substituted = structuredClone(live);
  substituted.launchStampRouter.startBlock = "50000001";
  assert.throws(() => validateLiveRobinhoodManifest(substituted, promotion));
  const zeroRoot = structuredClone(live);
  zeroRoot.robinhoodCustomLaunchBinding.chainBindings.poolManager.startBlock = "0";
  assert.throws(() => validateLiveRobinhoodManifest(zeroRoot, promotion));
});

test("freezes exact Ethereum CLI 3.3.9 and programmablehq release identity", () => {
  const current = ethereumManifest();
  assert.match(frozenEthereumV3Identity(current).digest, /^sha256:[0-9a-f]{64}$/u);
  for (const mutate of [
    (candidate) => { candidate.directNativeHookGraphProfileV3.cli.releaseVersion = "3.4.0"; },
    (candidate) => { candidate.directNativeHookGraphProfileV3.cli.tarballByteLength += 1; },
    (candidate) => {
      candidate.directNativeHookGraphProfileV3.api.agentIntegration
        .packConfigSchemaSha256 = sha("f");
    },
  ]) {
    const candidate = structuredClone(current);
    mutate(candidate);
    assert.throws(() => frozenEthereumV3Identity(candidate));
  }
});

test("normalizes Vercel evidence and rejects a stage selected by the public origin", () => {
  const stageBundle = stageFixture();
  const deploy = {
    status: "ok",
    deployment: {
      id: "dpl_stage123",
      url: "https://developers-stage.vercel.app",
      readyState: "READY",
      target: "production",
    },
  };
  const inspect = {
    id: "dpl_stage123",
    url: "developers-stage.vercel.app",
    target: "production",
    readyState: "READY",
    createdAt: 1_787_990_400_000,
  };
  const api = {
    id: "dpl_stage123",
    url: "developers-stage.vercel.app",
    target: "production",
    readyState: "READY",
    createdAt: 1_787_990_400_000,
    teamId: target.orgId,
    projectId: target.projectId,
    alias: [],
    meta: {
      programmableSourceRevision: source.revision,
      programmableSourceTree: source.tree,
      programmableStageBundleDigest: stageBundle.stageBundleDigest,
    },
  };
  const normalized = normalizeVercelDeployment({
    deployOutput: deploy,
    inspectOutput: inspect,
    apiOutput: api,
  });
  assert.equal(normalized.id, "dpl_stage123");
  assert.deepEqual(assertVercelProjectBinding(api, {
    orgId: target.orgId,
    projectId: target.projectId,
  }, target), target);
  const ownerBoundApi = structuredClone(api);
  delete ownerBoundApi.teamId;
  ownerBoundApi.ownerId = target.orgId;
  ownerBoundApi.team = { id: target.orgId };
  ownerBoundApi.project = { id: target.projectId };
  assert.deepEqual(assertVercelProjectBinding(ownerBoundApi, {
    orgId: target.orgId,
    projectId: target.projectId,
  }, target), target);
  const contradictoryOwnerApi = structuredClone(api);
  contradictoryOwnerApi.ownerId = "team_other";
  assert.throws(() => assertVercelProjectBinding(contradictoryOwnerApi, {
    orgId: target.orgId,
    projectId: target.projectId,
  }, target), /protected project and organization/u);
  const missingOwnerApi = structuredClone(api);
  delete missingOwnerApi.teamId;
  assert.throws(() => assertVercelProjectBinding(missingOwnerApi, {
    orgId: target.orgId,
    projectId: target.projectId,
  }, target), /protected project and organization/u);
  const contradictoryProjectApi = structuredClone(ownerBoundApi);
  contradictoryProjectApi.project.id = "prj_other";
  assert.throws(() => assertVercelProjectBinding(contradictoryProjectApi, {
    orgId: target.orgId,
    projectId: target.projectId,
  }, target), /protected project and organization/u);
  assert.doesNotThrow(() => assertVercelDeploymentMetadata(api, {
    source,
    stageBundleDigest: stageBundle.stageBundleDigest,
  }));
  const plannedApi = structuredClone(api);
  delete plannedApi.meta.programmableStageBundleDigest;
  plannedApi.meta.programmableReleaseMode = "planned";
  assert.doesNotThrow(() => assertVercelDeploymentMetadata(plannedApi, {
    source,
    releaseMode: "planned",
  }));
  plannedApi.meta.programmableStageBundleDigest = stageBundle.stageBundleDigest;
  assert.throws(() => assertVercelDeploymentMetadata(plannedApi, {
    source,
    releaseMode: "planned",
  }), /selects a phase bundle/u);
  assert.throws(() => protectionEvidence(
    normalized,
    "2026-08-29T14:59:00.000Z",
    "all",
  ), /without protecting its public domain/u);

  const aliased = structuredClone(api);
  aliased.alias = vercelProductionAliases;
  const publicDeployment = normalizeVercelDeployment({
    deployOutput: deploy,
    inspectOutput: inspect,
    apiOutput: aliased,
  });
  assert.throws(() => createStageReceipt({
    bundle: stageBundle,
    manifest: liveManifest(stageBundle, "stage"),
    ethereumManifest: ethereumManifest(),
    deployment: publicDeployment,
    currentProductionBinding: productionBinding(publicDeployment),
    protectionEvidence: protectionEvidence(normalized),
    stagedSmoke: smoke("live", normalized.url, stageBundle,
      "2026-08-29T15:00:00.000Z", "stage"),
    buildOutputDigest: sha("8"),
    source,
    target,
    workflow,
    stagedAt: "2026-08-29T15:00:00.000Z",
  }), /formal production domain/u);

  const resolvedProduction = normalizeVercelDeployment({
    inspectOutput: { ...inspect, aliases: vercelProductionAliases },
    apiOutput: aliased,
    providerOrigin: VERCEL_PRODUCTION_ORIGIN,
    providerRereadOutput: { ...inspect, aliases: vercelProductionAliases },
  });
  assert.deepEqual(resolvedProduction.aliases, vercelProductionAliases);
  const binding = publicAliasBinding(resolvedProduction);
  assert.deepEqual(parseVercelPublicAliasBinding(binding, {
    deployment: resolvedProduction,
    projectId: target.projectId,
  }), binding);
  const providerBinding = providerAliasBinding(resolvedProduction);
  assert.deepEqual(parseVercelProviderAliasBinding(providerBinding, {
    deployment: resolvedProduction,
    projectId: target.projectId,
  }), providerBinding);
  const missingProviderDomain = structuredClone(aliased);
  missingProviderDomain.alias = [];
  assert.throws(() => normalizeVercelDeployment({
    inspectOutput: inspect,
    apiOutput: missingProviderDomain,
    providerOrigin: VERCEL_PRODUCTION_ORIGIN,
    providerRereadOutput: inspect,
  }), /Vercel production alias/u);
  assert.throws(() => normalizeVercelDeployment({
    inspectOutput: inspect,
    apiOutput: aliased,
    providerOrigin: VERCEL_PRODUCTION_ORIGIN,
    providerRereadOutput: { ...inspect, id: "dpl_other123" },
  }), /reread differs/u);
  for (const aliasOverrides of [
    { deploymentId: "dpl_other123" },
    { projectId: "prj_other" },
    { redirect: "redirect.example" },
    { deletedAt: 1_787_990_400_000 },
  ]) {
    assert.throws(() => publicAliasBinding(resolvedProduction,
      "2026-08-29T15:00:30.000Z", aliasOverrides),
    /does not bind the protected deployment/u);
  }
  for (const aliasOverrides of [
    { deploymentId: "dpl_other123" },
    { projectId: "prj_other" },
    { redirect: "redirect.example" },
    { deletedAt: 1_787_990_400_000 },
  ]) {
    assert.throws(() => providerAliasBinding(resolvedProduction,
      "2026-08-29T15:00:30.000Z", aliasOverrides),
    /does not bind the protected deployment/u);
  }
  const inventory = productionDomainInventory();
  assert.deepEqual(parseVercelProductionDomainInventory(inventory, {
    projectId: target.projectId,
  }), inventory);
  for (const [name, overrides] of [
    [new URL(PRODUCTION_ORIGIN).hostname, { verified: false }],
    [new URL(PRODUCTION_ORIGIN).hostname, { gitBranch: "main" }],
    [new URL(PRODUCTION_ORIGIN).hostname, { customEnvironmentId: "env_preview" }],
    [new URL(VERCEL_PRODUCTION_ORIGIN).hostname, { projectId: "prj_other" }],
  ]) {
    assert.throws(() => productionDomainInventory(
      "2026-08-29T15:00:30.000Z", { [name]: overrides },
    ), /verified production domain/u);
  }
  const completeBinding = productionBinding(resolvedProduction);
  const otherProduction = deployment(
    "dpl_otherproduction123",
    "https://developers-other-production.vercel.app/",
    vercelProductionAliases,
  );
  assert.throws(() => createVercelProductionBinding({
    deployment: resolvedProduction,
    target,
    providerResolution: completeBinding.providerResolution,
    providerAliasBinding: completeBinding.providerAliasBinding,
    publicResolution: publicResolution(otherProduction),
    publicAliasBinding: publicAliasBinding(otherProduction),
    productionDomainInventory: completeBinding.productionDomainInventory,
  }), /selected a different deployment/u,
  "a mixed provider/public production binding must fail before release mutation");
});

test("binds both planned Vercel mutations to fresh owner and protected-candidate evidence", () => {
  const currentDeployment = deployment(
    "dpl_previous123",
    "https://developers-previous.vercel.app/",
    vercelProductionAliases,
  );
  const candidateDeployment = deployment(
    "dpl_planned123",
    "https://developers-planned.vercel.app/",
  );
  const creationAuthorizedAt = "2026-08-29T15:01:00.000Z";
  const creationProductionBinding = productionBinding(
    currentDeployment,
    "2026-08-29T15:00:30.000Z",
    "2026-08-29T15:00:20.000Z",
  );
  const creation = createPlannedDeployAuthorization({
    mutation: "create-candidate",
    source,
    target,
    currentDeployment,
    currentProductionBinding: creationProductionBinding,
    ownerDispatchAuthorization: ownerDispatchAuthorization(creationAuthorizedAt, { source }),
    workflow,
    authorizedAt: creationAuthorizedAt,
  });
  assert.equal(creation.schemaVersion,
    "programmable.developers.vercel-planned-deploy-authorization.v2");
  assert.equal(creation.schemaVersion, PLANNED_DEPLOY_AUTHORIZATION_SCHEMA);
  assert.equal(creation.publicAuthorization, false);
  assert.equal(creation.publicWrites, false);
  assert.deepEqual(creation.currentDeployment.aliases, vercelProductionAliases);
  assert.deepEqual(parseVercelProductionBinding(creation.currentProductionBinding, {
    deployment: currentDeployment,
    target,
  }), creationProductionBinding);
  assert.equal(parsePlannedDeployAuthorization(creation).mutation, "create-candidate");
  const earlyLegacyCreationWithoutDigest = {
    schemaVersion: "programmable.developers.vercel-planned-deploy-authorization.v1",
    state: "owner-authorized-planned-deploy",
    mutation: "create-candidate",
    publicAuthorization: false,
    publicWrites: false,
    source,
    target,
    currentDeployment: {
      ...currentDeployment,
      aliases: [new URL(PRODUCTION_ORIGIN).hostname],
    },
    candidateDeployment: null,
    candidateProtectionEvidence: null,
    candidateSmokeDigest: null,
    ownerDispatchAuthorization: creation.ownerDispatchAuthorization,
    workflow,
    authorizedAt: creationAuthorizedAt,
  };
  const earlyLegacyCreation = {
    ...earlyLegacyCreationWithoutDigest,
    authorizationDigest: canonicalSha256(
      earlyLegacyCreationWithoutDigest.schemaVersion,
      earlyLegacyCreationWithoutDigest,
    ),
  };
  assert.equal(parsePlannedDeployAuthorization(earlyLegacyCreation).mutation,
    "create-candidate");
  const tamperedLegacyCreation = structuredClone(earlyLegacyCreation);
  tamperedLegacyCreation.currentDeployment.aliases = [];
  const { authorizationDigest: _legacyDigest, ...tamperedLegacyWithoutDigest } =
    tamperedLegacyCreation;
  tamperedLegacyCreation.authorizationDigest = canonicalSha256(
    tamperedLegacyCreation.schemaVersion,
    tamperedLegacyWithoutDigest,
  );
  assert.throws(() => parsePlannedDeployAuthorization(tamperedLegacyCreation),
    /lacks the public production alias/u);

  const protection = protectionEvidence(
    candidateDeployment,
    "2026-08-29T15:02:00.000Z",
  );
  const candidateSmoke = smoke(
    "planned",
    candidateDeployment.url,
    undefined,
    "2026-08-29T15:03:00.000Z",
  );
  const promotionAuthorizedAt = "2026-08-29T15:04:00.000Z";
  const promotionProductionBinding = productionBinding(
    currentDeployment,
    "2026-08-29T15:03:30.000Z",
    "2026-08-29T15:03:20.000Z",
  );
  const promotion = createPlannedDeployAuthorization({
    mutation: "promote-candidate",
    source,
    target,
    currentDeployment,
    currentProductionBinding: promotionProductionBinding,
    candidateDeployment,
    candidateProtectionEvidence: protection,
    candidateSmoke,
    ownerDispatchAuthorization: ownerDispatchAuthorization(promotionAuthorizedAt, { source }),
    workflow,
    authorizedAt: promotionAuthorizedAt,
  });
  assert.equal(promotion.schemaVersion,
    "programmable.developers.vercel-planned-deploy-authorization.v2");
  assert.equal(promotion.publicAuthorization, false);
  assert.equal(promotion.publicWrites, false);
  assert.equal(promotion.candidateProtectionEvidence.publicAccess, false);
  assert.equal(parsePlannedDeployAuthorization(promotion).mutation, "promote-candidate");
  const resolvedLegacyPromotionWithoutDigest = {
    schemaVersion: "programmable.developers.vercel-planned-deploy-authorization.v1",
    state: "owner-authorized-planned-deploy",
    mutation: "promote-candidate",
    publicAuthorization: false,
    publicWrites: false,
    source,
    target,
    currentDeployment: { ...currentDeployment, aliases: [] },
    currentPublicResolution: promotion.currentProductionBinding.publicResolution,
    candidateDeployment: { ...promotion.candidateDeployment, aliases: [] },
    candidateProtectionEvidence: promotion.candidateProtectionEvidence,
    candidateSmokeDigest: promotion.candidateSmokeDigest,
    ownerDispatchAuthorization: promotion.ownerDispatchAuthorization,
    workflow,
    authorizedAt: promotionAuthorizedAt,
  };
  const resolvedLegacyPromotion = {
    ...resolvedLegacyPromotionWithoutDigest,
    authorizationDigest: canonicalSha256(
      resolvedLegacyPromotionWithoutDigest.schemaVersion,
      resolvedLegacyPromotionWithoutDigest,
    ),
  };
  assert.equal(parsePlannedDeployAuthorization(resolvedLegacyPromotion).mutation,
    "promote-candidate");
  const providerAliasedLegacyPromotion = structuredClone(resolvedLegacyPromotion);
  providerAliasedLegacyPromotion.candidateDeployment.aliases = vercelProductionAliases;
  const { authorizationDigest: _providerLegacyDigest, ...providerAliasedLegacyWithoutDigest } =
    providerAliasedLegacyPromotion;
  providerAliasedLegacyPromotion.authorizationDigest = canonicalSha256(
    providerAliasedLegacyPromotion.schemaVersion,
    providerAliasedLegacyWithoutDigest,
  );
  assert.equal(parsePlannedDeployAuthorization(providerAliasedLegacyPromotion).mutation,
    "promote-candidate");
  const familyAliasedLegacyPromotion = structuredClone(providerAliasedLegacyPromotion);
  familyAliasedLegacyPromotion.candidateDeployment.aliases = formalProductionAliases;
  const { authorizationDigest: _resolvedLegacyDigest, ...familyAliasedLegacyWithoutDigest } =
    familyAliasedLegacyPromotion;
  familyAliasedLegacyPromotion.authorizationDigest = canonicalSha256(
    familyAliasedLegacyPromotion.schemaVersion,
    familyAliasedLegacyWithoutDigest,
  );
  assert.throws(() => parsePlannedDeployAuthorization(familyAliasedLegacyPromotion),
    /already carries the public production alias/u);

  assert.throws(() => createPlannedDeployAuthorization({
    mutation: "promote-candidate",
    source,
    target,
    currentDeployment,
    currentProductionBinding: promotionProductionBinding,
    candidateDeployment,
    candidateProtectionEvidence: protectionEvidence(
      candidateDeployment,
      "2026-08-29T14:50:00.000Z",
    ),
    candidateSmoke,
    ownerDispatchAuthorization: ownerDispatchAuthorization(promotionAuthorizedAt, { source }),
    workflow,
    authorizedAt: promotionAuthorizedAt,
  }), /must complete within five minutes/u);
  assert.throws(() => createPlannedDeployAuthorization({
    mutation: "create-candidate",
    source,
    target,
    currentDeployment,
    currentProductionBinding: creationProductionBinding,
    candidateDeployment,
    ownerDispatchAuthorization: ownerDispatchAuthorization(creationAuthorizedAt, { source }),
    workflow,
    authorizedAt: creationAuthorizedAt,
  }), /must not claim a candidate/u);
  assert.throws(() => createPlannedDeployAuthorization({
    mutation: "create-candidate",
    source,
    target,
    currentDeployment,
    currentProductionBinding: productionBinding(
      currentDeployment,
      "2026-08-29T14:55:00.000Z",
      "2026-08-29T14:54:50.000Z",
    ),
    ownerDispatchAuthorization: ownerDispatchAuthorization(creationAuthorizedAt, { source }),
    workflow,
    authorizedAt: creationAuthorizedAt,
  }), /must complete within five minutes/u);
  assert.throws(() => createVercelPublicDeploymentResolution({
    origin: "https://other.example",
    deployment: currentDeployment,
    target,
    checkedAt: "2026-08-29T15:00:30.000Z",
  }), /canonical production origin/u);
  const otherDeployment = deployment(
    "dpl_other123",
    "https://developers-other.vercel.app/",
    vercelProductionAliases,
  );
  assert.throws(() => createPlannedDeployAuthorization({
    mutation: "create-candidate",
    source,
    target,
    currentDeployment,
    currentProductionBinding: productionBinding(otherDeployment),
    ownerDispatchAuthorization: ownerDispatchAuthorization(creationAuthorizedAt, { source }),
    workflow,
    authorizedAt: creationAuthorizedAt,
  }), /selected a different deployment/u);
  const substitutedBinding = structuredClone(creationProductionBinding);
  substitutedBinding.deploymentId = "dpl_other123";
  assert.throws(() => createPlannedDeployAuthorization({
    mutation: "create-candidate",
    source,
    target,
    currentDeployment,
    currentProductionBinding: substitutedBinding,
    ownerDispatchAuthorization: ownerDispatchAuthorization(creationAuthorizedAt, { source }),
    workflow,
    authorizedAt: creationAuthorizedAt,
  }), /digest is invalid|provider evidence disagrees/u);
  assert.throws(() => createPlannedDeployAuthorization({
    mutation: "create-candidate",
    source,
    target,
    currentDeployment: { ...currentDeployment, aliases: [] },
    currentProductionBinding: creationProductionBinding,
    ownerDispatchAuthorization: ownerDispatchAuthorization(creationAuthorizedAt, { source }),
    workflow,
    authorizedAt: creationAuthorizedAt,
  }), /lacks the Vercel production alias/u);
});

test("recovers immutable public intent only from exact old or target state", () => {
  const oldDeployment = deployment(
    "dpl_recoveryold123",
    "https://developers-recovery-old.vercel.app/",
    vercelProductionAliases,
  );
  const candidateDeployment = deployment(
    "dpl_recoverytarget123",
    "https://developers-recovery-target.vercel.app/",
  );
  const candidateProtection = protectionEvidence(
    candidateDeployment,
    "2026-08-29T15:01:00.000Z",
  );
  const candidateSmoke = smoke(
    "planned",
    candidateDeployment.url,
    undefined,
    "2026-08-29T15:02:00.000Z",
  );
  const authorization = createPlannedDeployAuthorization({
    mutation: "promote-candidate",
    source,
    target,
    currentDeployment: oldDeployment,
    currentProductionBinding: productionBinding(
      oldDeployment,
      "2026-08-29T15:00:30.000Z",
      "2026-08-29T15:00:20.000Z",
    ),
    candidateDeployment,
    candidateProtectionEvidence: candidateProtection,
    candidateSmoke,
    ownerDispatchAuthorization: ownerDispatchAuthorization(
      "2026-08-29T15:03:00.000Z",
      { source },
    ),
    workflow,
    authorizedAt: "2026-08-29T15:03:00.000Z",
  });
  const intent = createPublicMutationIntent({
    operation: "deploy-planned",
    authorization,
    selectedSmoke: candidateSmoke,
    createdAt: "2026-08-29T15:03:30.000Z",
  });
  const archiveSubstitutedIntent = createPublicMutationIntent({
    operation: "deploy-planned",
    authorization,
    selectedSmoke: candidateSmoke,
    createdAt: "2026-08-29T15:03:31.000Z",
  });
  assert.throws(() => mutationIntentProvenance(archiveSubstitutedIntent, intent),
    /archive entry differs/u,
  "artifact metadata and archive for intent A cannot authenticate intent B");
  assert.equal(intent.schemaVersion, PUBLIC_MUTATION_INTENT_SCHEMA);
  assert.equal(parsePublicMutationIntent(intent, {
    operation: "deploy-planned",
    authorization,
    selectedSmoke: candidateSmoke,
  }).mutationIntentDigest, intent.mutationIntentDigest);
  const finalCandidateSmoke = smoke(
    "planned",
    candidateDeployment.url,
    undefined,
    "2026-08-29T15:03:50.000Z",
  );
  const finalAuthorization = createPlannedDeployAuthorization({
    mutation: "promote-candidate",
    source,
    target,
    currentDeployment: oldDeployment,
    currentProductionBinding: productionBinding(
      oldDeployment,
      "2026-08-29T15:03:40.000Z",
      "2026-08-29T15:03:30.000Z",
    ),
    candidateDeployment,
    candidateProtectionEvidence: protectionEvidence(
      candidateDeployment,
      "2026-08-29T15:03:45.000Z",
    ),
    candidateSmoke: finalCandidateSmoke,
    ownerDispatchAuthorization: ownerDispatchAuthorization(
      "2026-08-29T15:04:00.000Z",
      { source },
    ),
    workflow,
    authorizedAt: "2026-08-29T15:04:00.000Z",
  });
  const plannedReadinessInput = {
    intent,
    intentAuthorization: authorization,
    intentSelectedSmoke: candidateSmoke,
    authorization: finalAuthorization,
    candidateSmoke: finalCandidateSmoke,
    currentDeployment: oldDeployment,
    currentProductionBinding: productionBinding(
      oldDeployment,
      "2026-08-29T15:04:10.000Z",
      "2026-08-29T15:04:05.000Z",
    ),
    mutationControl: mutationControl("2026-08-29T15:04:15.000Z"),
    confirmedAt: "2026-08-29T15:04:20.000Z",
  };
  assert.equal(validatePlannedPublicMutationReadiness(plannedReadinessInput)
    .mutationIntentDigest, intent.mutationIntentDigest);
  assert.throws(() => createVercelMutationControlEvidence({
    project: { id: target.projectId, rollingRelease: { state: "ACTIVE" } },
    target,
    checkedAt: "2026-08-29T15:04:15.000Z",
  }), /Rolling Releases to be disabled/u);
  const pendingMutationControl = mutationControl("2026-08-29T15:04:15.000Z", {
    lastAliasRequest: {
      jobStatus: "pending",
      requestedAt: Date.parse("2026-08-29T15:04:14.000Z"),
      toDeploymentId: candidateDeployment.id,
      type: "promote",
    },
  });
  assert.equal(pendingMutationControl.mutationAvailable, false);
  assert.throws(() => validatePlannedPublicMutationReadiness({
    ...plannedReadinessInput,
    mutationControl: pendingMutationControl,
  }), /pending or in-progress/u,
  "the final boundary must reject a queued Vercel alias mutation");
  const delayedSuccessfulMutation = mutationControl("2026-08-29T15:04:15.000Z", {
    lastAliasRequest: {
      jobStatus: "succeeded",
      requestedAt: Date.parse("2026-08-29T14:54:14.000Z"),
      toDeploymentId: candidateDeployment.id,
      type: "promote",
    },
  });
  assert.throws(() => validatePlannedPublicMutationReadiness({
    ...plannedReadinessInput,
    mutationControl: delayedSuccessfulMutation,
  }), /successful Vercel alias request differs/u,
  "an old request that completed late may not be replayed while public resolution still reads old");
  assert.throws(() => mutationControl("2026-08-29T15:04:15.000Z", {
    lastAliasRequest: {
      jobStatus: "succeeded",
      requestedAt: Date.parse("2026-08-29T15:04:16.000Z"),
      toDeploymentId: candidateDeployment.id,
      type: "promote",
    },
  }), /future-dated/u);
  const staleProtectionAuthorization = createPlannedDeployAuthorization({
    mutation: "promote-candidate",
    source,
    target,
    currentDeployment: oldDeployment,
    currentProductionBinding: productionBinding(
      oldDeployment, "2026-08-29T15:03:40.000Z",
      "2026-08-29T15:03:30.000Z",
    ),
    candidateDeployment,
    candidateProtectionEvidence: protectionEvidence(
      candidateDeployment, "2026-08-29T14:59:10.000Z",
    ),
    candidateSmoke: finalCandidateSmoke,
    ownerDispatchAuthorization: ownerDispatchAuthorization(
      "2026-08-29T15:04:00.000Z", { source },
    ),
    workflow,
    authorizedAt: "2026-08-29T15:04:00.000Z",
  });
  assert.throws(() => validatePlannedPublicMutationReadiness({
    intent,
    intentAuthorization: authorization,
    intentSelectedSmoke: candidateSmoke,
    authorization: staleProtectionAuthorization,
    candidateSmoke: finalCandidateSmoke,
    currentDeployment: oldDeployment,
    currentProductionBinding: productionBinding(
      oldDeployment, "2026-08-29T15:04:10.000Z",
      "2026-08-29T15:04:05.000Z",
    ),
    mutationControl: mutationControl("2026-08-29T15:04:15.000Z"),
    confirmedAt: "2026-08-29T15:04:20.000Z",
  }), /candidate protection and mutation readiness/u,
  "planned readiness must reject pairwise-fresh but total-stale target protection");

  function recoveryInput(currentDeployment, {
    currentAt = "2026-08-29T16:00:00.000Z",
    protectionAt = "2026-08-29T16:00:30.000Z",
    smokeAt = "2026-08-29T16:01:00.000Z",
    authorizedAt = "2026-08-29T16:01:30.000Z",
    mutationControlAt = new Date(Date.parse(currentAt) + 5_000).toISOString(),
  } = {}) {
    return {
      intent,
      intentProvenance: mutationIntentProvenance(intent),
      source: recoverySource,
      workflow: recoveryWorkflow,
      ownerDispatchAuthorization: recoveryOwnerDispatchAuthorization(authorizedAt),
      currentDeployment,
      currentProductionBinding: productionBinding(
        currentDeployment,
        currentAt,
        new Date(Date.parse(currentAt) - 5_000).toISOString(),
      ),
      mutationControl: mutationControl(mutationControlAt),
      targetDeployment: candidateDeployment,
      targetProtectionEvidence: protectionEvidence(candidateDeployment, protectionAt),
      targetSmoke: smoke("planned", candidateDeployment.url, undefined, smokeAt),
      authorizedAt,
    };
  }

  const oldAttempt = createPublicMutationRecoveryAttempt(recoveryInput(oldDeployment));
  const oldAttemptProvenance = recoveryAttemptProvenance(oldAttempt);
  assert.equal(oldAttemptProvenance.schemaVersion,
    PUBLIC_MUTATION_RECOVERY_ATTEMPT_PROVENANCE_SCHEMA);
  assert.equal(parsePublicMutationRecoveryAttemptProvenance(
    oldAttemptProvenance, { attempt: oldAttempt },
  ).recoveryAttemptDigest, oldAttempt.recoveryAttemptDigest);
  const substitutedAttempt = structuredClone(oldAttempt);
  substitutedAttempt.classification = "target";
  substitutedAttempt.publicMutationRequired = false;
  {
    const { recoveryAttemptDigest: _digest, ...withoutDigest } = substitutedAttempt;
    substitutedAttempt.recoveryAttemptDigest = canonicalSha256(
      PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA, withoutDigest,
    );
  }
  assert.throws(() => recoveryAttemptProvenance(substitutedAttempt, {
    archivedAttempt: oldAttempt,
  }), /archive entry differs/u,
  "the uploaded attempt artifact must contain the exact readiness-bound attempt");
  assert.equal(oldAttempt.schemaVersion, PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA);
  assert.equal(oldAttempt.classification, "old");
  assert.equal(oldAttempt.publicMutationRequired, true);
  assert.equal(parsePublicMutationRecoveryAttempt(oldAttempt, { intent }).classification, "old");
  const wrongOriginAttempt = structuredClone(oldAttempt);
  wrongOriginAttempt.targetSmoke.origin = "https://wrong-recovery-target.vercel.app";
  {
    const { smokeDigest: _smokeDigest, ...smokeWithoutDigest } =
      wrongOriginAttempt.targetSmoke;
    wrongOriginAttempt.targetSmoke.smokeDigest = canonicalSha256(
      PLANNED_SMOKE_SCHEMA, smokeWithoutDigest,
    );
    const { recoveryAttemptDigest: _attemptDigest, ...attemptWithoutDigest } =
      wrongOriginAttempt;
    wrongOriginAttempt.recoveryAttemptDigest = canonicalSha256(
      PUBLIC_MUTATION_RECOVERY_ATTEMPT_SCHEMA, attemptWithoutDigest,
    );
  }
  assert.throws(() => parsePublicMutationRecoveryAttempt(
    wrongOriginAttempt, { intent },
  ), /smoke differs from its target deployment/u,
  "recovery attempt parsing must bind the full smoke receipt to the target");

  const oldReadinessInput = recoveryInput(oldDeployment, {
    protectionAt: "2026-08-29T16:02:30.000Z",
    smokeAt: "2026-08-29T16:03:00.000Z",
    authorizedAt: "2026-08-29T16:03:30.000Z",
    currentAt: "2026-08-29T16:03:40.000Z",
  });
  const oldReadiness = createPublicMutationRecoveryReadiness({
    ...oldReadinessInput,
    attempt: oldAttempt,
    attemptProvenance: oldAttemptProvenance,
    confirmedAt: "2026-08-29T16:03:50.000Z",
  });
  assert.equal(oldReadiness.schemaVersion, PUBLIC_MUTATION_RECOVERY_READINESS_SCHEMA);
  assert.equal(oldReadiness.classification, "old");
  assert.equal(oldReadiness.publicMutationRequired, true);
  assert.throws(() => createPublicMutationRecoveryReadiness({
    ...oldReadinessInput,
    currentProductionBinding: productionBinding(
      oldDeployment,
      "2026-08-29T16:03:29.999Z",
      "2026-08-29T16:03:24.999Z",
    ),
    attempt: oldAttempt,
    attemptProvenance: oldAttemptProvenance,
    confirmedAt: "2026-08-29T16:03:50.000Z",
  }), /final production-binding provider re-query/u,
  "recovery must re-query both production origins after its fresh authorization");
  assert.throws(() => createPublicMutationRecoveryReadiness({
    ...oldReadinessInput,
    mutationControl: mutationControl("2026-08-29T16:03:45.000Z", {
      lastAliasRequest: {
        jobStatus: "succeeded",
        requestedAt: Date.parse("2026-08-29T15:53:45.000Z"),
        toDeploymentId: candidateDeployment.id,
        type: "promote",
      },
    }),
    attempt: oldAttempt,
    attemptProvenance: oldAttemptProvenance,
    confirmedAt: "2026-08-29T16:03:50.000Z",
  }), /successful Vercel alias request differs/u,
  "recovery must reject an old request that completed after the public-origin read");

  const thirdDeployment = deployment(
    "dpl_recoverythird123",
    "https://developers-recovery-third.vercel.app/",
  );
  const thirdReadinessInput = recoveryInput(thirdDeployment, {
    protectionAt: "2026-08-29T16:02:30.000Z",
    smokeAt: "2026-08-29T16:03:00.000Z",
    authorizedAt: "2026-08-29T16:03:30.000Z",
    currentAt: "2026-08-29T16:03:40.000Z",
  });
  assert.throws(() => createPublicMutationRecoveryReadiness({
    ...thirdReadinessInput,
    attempt: oldAttempt,
    attemptProvenance: oldAttemptProvenance,
    confirmedAt: "2026-08-29T16:03:50.000Z",
  }), /third deployment state/u,
  "out-of-band old-to-third drift after durable sealing must stop recovery");

  const promotedCandidateDeployment = {
    ...candidateDeployment,
    aliases: vercelProductionAliases,
  };
  const targetReadinessInput = recoveryInput(promotedCandidateDeployment, {
    protectionAt: "2026-08-29T16:02:30.000Z",
    smokeAt: "2026-08-29T16:03:00.000Z",
    authorizedAt: "2026-08-29T16:03:30.000Z",
    currentAt: "2026-08-29T16:03:40.000Z",
  });
  const targetReadiness = createPublicMutationRecoveryReadiness({
    ...targetReadinessInput,
    attempt: oldAttempt,
    attemptProvenance: oldAttemptProvenance,
    confirmedAt: "2026-08-29T16:03:50.000Z",
  });
  assert.equal(targetReadiness.classification, "target");
  assert.equal(targetReadiness.publicMutationRequired, false,
    "exact target recovery must never perform a second mutation");
  assert.equal(parsePublicMutationRecoveryReadiness(targetReadiness, {
    intent,
    attempt: oldAttempt,
  }).classification, "target");

  const receipt = createPlannedDeployReceipt({
    intent,
    recoveryAttempt: oldAttempt,
    recoveryReadiness: targetReadiness,
    productionDeployment: promotedCandidateDeployment,
    productionBinding: productionBinding(
      promotedCandidateDeployment,
      "2026-08-29T16:04:15.000Z",
      "2026-08-29T16:04:12.000Z",
    ),
    productionSmoke: smoke(
      "planned",
      PRODUCTION_ORIGIN,
      undefined,
      "2026-08-29T16:04:10.000Z",
    ),
    completedAt: "2026-08-29T16:04:20.000Z",
  });
  assert.equal(receipt.schemaVersion, PLANNED_DEPLOY_RECEIPT_SCHEMA);
  assert.equal(receipt.publicMutationPerformed, false);
  assert.equal(parsePlannedDeployReceipt(receipt).state, "planned-public-verified");
  const mismatchedPlannedLineage = structuredClone(receipt);
  mismatchedPlannedLineage.recoveryAttemptDigest = sha("9");
  reseal(mismatchedPlannedLineage, PLANNED_DEPLOY_RECEIPT_SCHEMA,
    "plannedDeployReceiptDigest");
  assert.throws(() => parsePlannedDeployReceipt(mismatchedPlannedLineage),
    /exact recovery lineage/u,
  "planned recovery receipt parsing must revalidate its embedded lineage");
  const mismatchedPlannedManifest = structuredClone(receipt);
  mismatchedPlannedManifest.productionSmoke = smoke(
    "planned", PRODUCTION_ORIGIN, undefined, "2026-08-29T16:04:10.000Z",
    "promotion", sha("9"),
  );
  mismatchedPlannedManifest.productionSmokeDigest =
    mismatchedPlannedManifest.productionSmoke.smokeDigest;
  reseal(mismatchedPlannedManifest, PLANNED_DEPLOY_RECEIPT_SCHEMA,
    "plannedDeployReceiptDigest");
  assert.throws(() => parsePlannedDeployReceipt(mismatchedPlannedManifest),
    /exact recovery lineage/u,
  "planned recovery receipt parsing must bind the public manifest to the exact target smoke");

  assert.throws(() => createPublicMutationRecoveryAttempt(recoveryInput(
    thirdDeployment,
  )), /third deployment state/u,
  "an initially observed third state must stop recovery");
  assert.throws(() => createPublicMutationRecoveryAttempt(recoveryInput(oldDeployment, {
    currentAt: "2026-08-29T16:00:00.000Z",
    protectionAt: "2026-08-29T16:00:30.000Z",
    smokeAt: "2026-08-29T16:05:30.001Z",
    authorizedAt: "2026-08-29T16:05:40.000Z",
  })), /within five minutes/u,
  "recovery must reject evidence older than five minutes");
  assert.throws(() => createPublicMutationRecoveryAttempt(recoveryInput(oldDeployment, {
    currentAt: "2026-08-29T16:01:00.000Z",
    protectionAt: "2026-08-29T16:00:30.000Z",
    smokeAt: "2026-08-29T16:01:30.000Z",
    authorizedAt: "2026-08-29T16:02:00.000Z",
  })), /provider readbacks/u,
  "recovery must reject reversed provider chronology");

  const otherCandidate = deployment(
    "dpl_recoveryother123",
    "https://developers-recovery-other.vercel.app/",
  );
  const otherSmoke = smoke(
    "planned",
    otherCandidate.url,
    undefined,
    "2026-08-29T15:02:00.000Z",
  );
  const otherAuthorization = createPlannedDeployAuthorization({
    mutation: "promote-candidate",
    source,
    target,
    currentDeployment: oldDeployment,
    currentProductionBinding: productionBinding(
      oldDeployment,
      "2026-08-29T15:00:30.000Z",
      "2026-08-29T15:00:20.000Z",
    ),
    candidateDeployment: otherCandidate,
    candidateProtectionEvidence: protectionEvidence(
      otherCandidate,
      "2026-08-29T15:01:00.000Z",
    ),
    candidateSmoke: otherSmoke,
    ownerDispatchAuthorization: ownerDispatchAuthorization(
      "2026-08-29T15:03:00.000Z",
      { source },
    ),
    workflow,
    authorizedAt: "2026-08-29T15:03:00.000Z",
  });
  const substitutedIntent = createPublicMutationIntent({
    operation: "deploy-planned",
    authorization: otherAuthorization,
    selectedSmoke: otherSmoke,
    createdAt: "2026-08-29T15:03:30.000Z",
  });
  assert.throws(() => parsePublicMutationIntent(substitutedIntent, {
    operation: "deploy-planned",
    authorization,
    selectedSmoke: candidateSmoke,
  }), /artifact substitution/u);
  assert.throws(() => parsePublicMutationIntentProvenance(
    mutationIntentProvenance(intent), { intent: substitutedIntent },
  ), /differs from its authenticated producer provenance/u,
  "artifact provenance must bind the exact mutation intent digest");
});

test("separates stage, owner authorization, promotion, and exact rollback receipts", () => {
  const stageBundle = stageFixture();
  const bundle = promotionFixture();
  const stageDeployment = deployment(
    "dpl_stage123",
    "https://developers-stage.vercel.app/",
  );
  const previousDeployment = deployment(
    "dpl_previous123",
    "https://developers-previous.vercel.app/",
    vercelProductionAliases,
  );
  const stage = createStageReceipt({
    bundle: stageBundle,
    manifest: liveManifest(stageBundle, "stage"),
    ethereumManifest: ethereumManifest(),
    deployment: stageDeployment,
    currentProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:00:10.000Z",
      "2026-08-29T15:00:05.000Z",
    ),
    protectionEvidence: protectionEvidence(
      stageDeployment, "2026-08-29T14:59:50.000Z",
    ),
    stagedSmoke: smoke("live", stageDeployment.url, stageBundle,
      "2026-08-29T15:00:00.000Z", "stage"),
    buildOutputDigest: sha("8"),
    source,
    target,
    workflow,
    stagedAt: "2026-08-29T15:00:20.000Z",
  });
  assert.equal(stage.schemaVersion, STAGE_RECEIPT_SCHEMA);
  assert.equal(stage.schemaVersion, "programmable.developers.vercel-stage-receipt.v3");
  assert.equal(stage.publicAuthorization, false);
  assert.equal(stage.currentProductionBinding.deploymentId, previousDeployment.id);
  assert.equal(parseStageReceipt(stage, {
    bundle: stageBundle,
    source,
    target,
    stagedSmoke: smoke("live", stageDeployment.url, stageBundle,
      "2026-08-29T15:00:00.000Z", "stage"),
  }).state,
    "staged-not-public");
  const stageV2 = structuredClone(stage);
  delete stageV2.currentProductionBinding;
  stageV2.schemaVersion = "programmable.developers.vercel-stage-receipt.v2";
  reseal(stageV2, stageV2.schemaVersion, "stageReceiptDigest");
  assert.equal(parseStageReceipt(stageV2, {
    bundle: stageBundle,
    source,
    target,
    stagedSmoke: smoke("live", stageDeployment.url, stageBundle,
      "2026-08-29T15:00:00.000Z", "stage"),
  }).schemaVersion, "programmable.developers.vercel-stage-receipt.v2");
  const collidingStageV2 = structuredClone(stage);
  collidingStageV2.schemaVersion = "programmable.developers.vercel-stage-receipt.v2";
  reseal(collidingStageV2, collidingStageV2.schemaVersion, "stageReceiptDigest");
  assert.throws(() => parseStageReceipt(collidingStageV2), /unsupported field set/u,
    "a v3 stage receipt cannot be relabeled into the exact v2 namespace");
  const legacyStage = structuredClone(stageV2);
  legacyStage.schemaVersion = "programmable.developers.vercel-stage-receipt.v1";
  legacyStage.deployment.aliases = vercelProductionAliases;
  reseal(legacyStage, legacyStage.schemaVersion, "stageReceiptDigest");
  assert.equal(parseStageReceipt(legacyStage, {
    bundle: stageBundle,
    source,
    target,
    deployment: legacyStage.deployment,
    stagedSmoke: smoke("live", stageDeployment.url, stageBundle,
      "2026-08-29T15:00:00.000Z", "stage"),
  }).schemaVersion, "programmable.developers.vercel-stage-receipt.v1");
  const familyAliasedLegacyStage = structuredClone(legacyStage);
  delete familyAliasedLegacyStage.stageReceiptDigest;
  familyAliasedLegacyStage.deployment.aliases = formalProductionAliases;
  familyAliasedLegacyStage.stageReceiptDigest = canonicalSha256(
    familyAliasedLegacyStage.schemaVersion,
    familyAliasedLegacyStage,
  );
  assert.throws(() => parseStageReceipt(familyAliasedLegacyStage),
    /public production alias/u);
  const providerAliasedStageV2 = structuredClone(stageV2);
  providerAliasedStageV2.deployment.aliases = vercelProductionAliases;
  reseal(providerAliasedStageV2, providerAliasedStageV2.schemaVersion,
    "stageReceiptDigest");
  assert.throws(() => parseStageReceipt(providerAliasedStageV2),
    /formal production domain/u);

  const plan = createPromotionPlan({
    stageReceipt: stage,
    stageBundle,
    promotionBundle: bundle,
    stagedSmoke: smoke(
      "live", stageDeployment.url, stageBundle, "2026-08-29T15:00:00.000Z", "stage",
    ),
    stageProtectionEvidence: protectionEvidence(
      stageDeployment, "2026-08-29T14:59:50.000Z",
    ),
    previousMode: "planned",
    previousSmoke: smoke(
      "planned", PRODUCTION_ORIGIN, undefined, "2026-08-29T15:00:40.000Z",
    ),
    previousDeployment,
    previousProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:00:30.000Z",
      "2026-08-29T15:00:25.000Z",
    ),
    indexerEvidence: indexerEvidence(bundle),
    stageRunEvidence: actionsRunEvidence(),
    stageArtifact: actionsArtifact(
      `developers-vercel-stage-${workflow.runId}-${workflow.runAttempt}`,
    ),
    stagedProviderDeployment: stageDeployment,
    sourceTransition: createEvidenceOnlySourceTransition({
      stagedSource: source,
      promotionSource,
      addedPaths: [
        CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
        CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
        CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
        CANONICAL_PROMOTION_BUNDLE_PATH,
      ],
      buildOutputDigest: sha("8"),
    }),
    currentBuildOutputDigest: sha("8"),
    source: promotionSource,
    target,
    workflow,
    preparedAt: "2026-08-29T15:01:00.000Z",
  });
  assert.equal(plan.schemaVersion, PROMOTION_PLAN_SCHEMA);
  assert.equal(plan.schemaVersion, "programmable.developers.vercel-promotion-plan.v3");
  assert.equal(plan.publicAuthorization, false);
  assert.equal(plan.stageBundleDigest, stage.stageBundleDigest);
  assert.equal(plan.promotionBundleDigest, bundle.promotionBundleDigest);
  assert.equal(plan.stageRunEvidence.sourceTree, source.tree);
  assert.deepEqual(plan.stagedProviderDeployment, stageDeployment);
  assert.equal(plan.stageProtectionEvidence.deploymentId, stageDeployment.id);
  assert.equal(plan.previousProductionBinding.deploymentId, previousDeployment.id);
  assert.deepEqual(plan.sourceTransition.addedPaths, [
    CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
    CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
    CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
    CANONICAL_PROMOTION_BUNDLE_PATH,
  ]);
  assert.equal(parsePromotionPlan(plan, {
    promotionBundle: bundle,
    stageBundle,
    stageReceipt: stage,
    target,
  }).state,
    "ready-awaiting-owner-authorization");
  const planV2 = structuredClone(plan);
  delete planV2.previousProductionBinding;
  delete planV2.previousPromotionReceipt;
  delete planV2.previousPromotionRun;
  delete planV2.previousPromotionArtifactArchiveDigest;
  delete planV2.previousPromotionArtifactEntryPath;
  delete planV2.previousPromotionArtifactEntrySha256;
  delete planV2.previousRelease.source;
  delete planV2.previousRelease.workflow;
  planV2.stageReceiptDigest = stageV2.stageReceiptDigest;
  planV2.schemaVersion = "programmable.developers.vercel-promotion-plan.v2";
  reseal(planV2, planV2.schemaVersion, "promotionPlanDigest");
  assert.equal(parsePromotionPlan(planV2, {
    promotionBundle: bundle,
    stageBundle,
    stageReceipt: stageV2,
    target,
  }).schemaVersion, "programmable.developers.vercel-promotion-plan.v2");
  const collidingPlanV2 = structuredClone(plan);
  collidingPlanV2.schemaVersion = "programmable.developers.vercel-promotion-plan.v2";
  reseal(collidingPlanV2, collidingPlanV2.schemaVersion, "promotionPlanDigest");
  assert.throws(() => parsePromotionPlan(collidingPlanV2), /unsupported field set/u,
    "a v3 promotion plan cannot be relabeled into the exact v2 namespace");
  const legacyPlan = structuredClone(planV2);
  legacyPlan.schemaVersion = "programmable.developers.vercel-promotion-plan.v1";
  legacyPlan.stageReceiptDigest = legacyStage.stageReceiptDigest;
  legacyPlan.stagedDeployment.aliases = vercelProductionAliases;
  legacyPlan.stagedProviderDeployment.aliases = vercelProductionAliases;
  reseal(legacyPlan, legacyPlan.schemaVersion, "promotionPlanDigest");
  assert.equal(parsePromotionPlan(legacyPlan, {
    promotionBundle: bundle,
    stageBundle,
    stageReceipt: legacyStage,
    target,
  }).schemaVersion, "programmable.developers.vercel-promotion-plan.v1");
  const familyAliasedLegacyPlan = structuredClone(legacyPlan);
  delete familyAliasedLegacyPlan.promotionPlanDigest;
  familyAliasedLegacyPlan.stagedDeployment.aliases = formalProductionAliases;
  familyAliasedLegacyPlan.stagedProviderDeployment.aliases = formalProductionAliases;
  familyAliasedLegacyPlan.promotionPlanDigest = canonicalSha256(
    familyAliasedLegacyPlan.schemaVersion,
    familyAliasedLegacyPlan,
  );
  assert.throws(() => parsePromotionPlan(familyAliasedLegacyPlan),
    /public production alias/u);
  const providerAliasedPlanV2 = structuredClone(planV2);
  providerAliasedPlanV2.stagedDeployment.aliases = vercelProductionAliases;
  providerAliasedPlanV2.stagedProviderDeployment.aliases = vercelProductionAliases;
  reseal(providerAliasedPlanV2, providerAliasedPlanV2.schemaVersion,
    "promotionPlanDigest");
  assert.throws(() => parsePromotionPlan(providerAliasedPlanV2),
    /formal production domain/u);
  const tamperedAuthorization = structuredClone(
    ownerDispatchAuthorization("2026-08-29T15:02:00.000Z"),
  );
  tamperedAuthorization.owner.login = "impostor";
  assert.throws(() => createPublicAuthorization({
    operation: "promote",
    plan,
    workflow,
    ownerDispatchAuthorization: tamperedAuthorization,
    authorizedAt: "2026-08-29T15:02:00.000Z",
  }), /authorization evidence is invalid/u);
  assert.throws(() => createPublicAuthorization({
    operation: "promote",
    plan,
    workflow,
    ownerDispatchAuthorization:
      ownerDispatchAuthorization("2026-08-29T15:31:00.001Z"),
    authorizedAt: "2026-08-29T15:31:00.001Z",
  }), /plan prepared within 30 minutes/u);

  const authorization = createPublicAuthorization({
    operation: "promote",
    plan,
    workflow,
    ownerDispatchAuthorization:
      ownerDispatchAuthorization("2026-08-29T15:02:00.000Z"),
    authorizedAt: "2026-08-29T15:02:00.000Z",
  });
  assert.equal(authorization.schemaVersion, PUBLIC_AUTHORIZATION_SCHEMA);
  assert.equal(authorization.publicAuthorization, true);
  assert.equal(parsePublicAuthorization(authorization, {
    operation: "promote",
    plan,
  }).planDigest, plan.promotionPlanDigest);

  const promotedDeployment = { ...stageDeployment, aliases: vercelProductionAliases };
  const promotionInput = {
    plan,
    authorization,
    bundle,
    context: { promotionBundle: bundle, stageBundle, stageReceipt: stage, target },
    preMutationState: createPreMutationState({
      operation: "promote",
      plan,
      currentDeployment: previousDeployment,
      currentProductionBinding: productionBinding(
        previousDeployment,
        "2026-08-29T15:02:25.000Z",
        "2026-08-29T15:02:15.000Z",
      ),
      selectedDeployment: stageDeployment,
      selectedProtectionEvidence: protectionEvidence(
        stageDeployment, "2026-08-29T15:02:20.000Z",
      ),
      selectedSmoke: smoke(
        "live", stageDeployment.url, bundle, "2026-08-29T15:02:30.000Z",
      ),
      selectedBundle: bundle,
      checkedAt: "2026-08-29T15:02:30.000Z",
    }),
    selectedSmoke: smoke(
      "live", stageDeployment.url, bundle, "2026-08-29T15:02:30.000Z",
    ),
    productionDeployment: promotedDeployment,
    productionSmoke: smoke(
      "live", PRODUCTION_ORIGIN, bundle, "2026-08-29T15:02:50.000Z",
    ),
    productionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:02:55.000Z",
      "2026-08-29T15:02:53.000Z",
    ),
    workflow,
    promotedAt: "2026-08-29T15:03:00.000Z",
  };
  const promotionIntent = createPublicMutationIntent({
    operation: "promote",
    plan,
    authorization,
    preMutationState: promotionInput.preMutationState,
    selectedSmoke: promotionInput.selectedSmoke,
    selectedBundle: bundle,
    createdAt: "2026-08-29T15:02:31.000Z",
  });
  const finalPromotionAuthorization = createPublicAuthorization({
    operation: "promote",
    plan,
    workflow,
    ownerDispatchAuthorization:
      ownerDispatchAuthorization("2026-08-29T15:02:35.000Z"),
    authorizedAt: "2026-08-29T15:02:35.000Z",
  });
  const finalPromotionReadinessInput = {
    operation: "promote",
    intent: promotionIntent,
    intentAuthorization: authorization,
    intentPreMutationState: promotionInput.preMutationState,
    intentSelectedSmoke: promotionInput.selectedSmoke,
    plan,
    authorization: finalPromotionAuthorization,
    preMutationState: promotionInput.preMutationState,
    selectedSmoke: promotionInput.selectedSmoke,
    selectedBundle: bundle,
    currentDeployment: previousDeployment,
    currentProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:02:40.000Z",
      "2026-08-29T15:02:38.000Z",
    ),
    mutationControl: mutationControl("2026-08-29T15:02:42.000Z"),
    confirmedAt: "2026-08-29T15:02:45.000Z",
  };
  const finalPromotionReadiness = validatePreMutationReadiness(
    finalPromotionReadinessInput,
  );
  assert.equal(finalPromotionReadiness.mutationIntentDigest,
    promotionIntent.mutationIntentDigest);
  assert.throws(() => validatePreMutationReadiness({
    ...finalPromotionReadinessInput,
    currentProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:02:34.999Z",
      "2026-08-29T15:02:34.000Z",
    ),
  }), /owner authorization and final production-binding provider re-query/u,
  "the mutation boundary must re-query both production origins after authorization");
  assert.throws(() => validatePreMutationReadiness({
    ...finalPromotionReadinessInput,
    mutationControl: mutationControl("2026-08-29T15:02:42.000Z", {
      lastAliasRequest: {
        jobStatus: "succeeded",
        requestedAt: Date.parse("2026-08-29T14:52:42.000Z"),
        toDeploymentId: stageDeployment.id,
        type: "promote",
      },
    }),
  }), /successful Vercel alias request differs/u,
  "live readiness must reject an old request that completed after the public-origin read");
  const totalStalePromotionState = createPreMutationState({
    operation: "promote",
    plan,
    currentDeployment: previousDeployment,
    currentProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:02:10.000Z",
      "2026-08-29T15:02:05.000Z",
    ),
    selectedDeployment: stageDeployment,
    selectedProtectionEvidence: protectionEvidence(
      stageDeployment, "2026-08-29T14:57:35.000Z",
    ),
    selectedSmoke: promotionInput.selectedSmoke,
    selectedBundle: bundle,
    checkedAt: "2026-08-29T15:02:30.000Z",
  });
  assert.throws(() => validatePreMutationReadiness({
    ...finalPromotionReadinessInput,
    preMutationState: totalStalePromotionState,
  }), /selected deployment protection and mutation readiness/u,
  "live readiness must reject pairwise-fresh but total-stale target protection");
  const mismatchedPreMutationProtection = protectionEvidence(
    stageDeployment, "2026-08-29T14:57:29.999Z",
  );
  assert.throws(() => createPreMutationState({
    operation: "promote",
    plan,
    currentDeployment: previousDeployment,
    currentProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:02:25.000Z",
      "2026-08-29T15:02:15.000Z",
    ),
    selectedDeployment: stageDeployment,
    selectedProtectionEvidence: mismatchedPreMutationProtection,
    selectedSmoke: smoke(
      "live", stageDeployment.url, bundle, "2026-08-29T15:02:30.000Z",
    ),
    selectedBundle: bundle,
    checkedAt: "2026-08-29T15:02:30.000Z",
  }), /selected deployment verification/u);
  assert.throws(() => createPreMutationState({
    operation: "promote",
    plan,
    currentDeployment: previousDeployment,
    currentProductionBinding: productionBinding(
      stageDeployment,
      "2026-08-29T15:02:10.000Z",
      "2026-08-29T15:02:05.000Z",
    ),
    selectedDeployment: stageDeployment,
    selectedProtectionEvidence: protectionEvidence(
      stageDeployment, "2026-08-29T15:02:20.000Z",
    ),
    selectedSmoke: smoke(
      "live", stageDeployment.url, bundle, "2026-08-29T15:02:30.000Z",
    ),
    selectedBundle: bundle,
    checkedAt: "2026-08-29T15:02:30.000Z",
  }), /selected a different deployment/u);
  Object.assign(promotionInput, {
    authorization: finalPromotionAuthorization,
    intent: promotionIntent,
    mutationReadiness: finalPromotionReadiness,
  });
  const promotion = createPromotionReceipt(promotionInput);
  assert.equal(parsePromotionReceipt(promotion, { bundle, target }).state, "promoted-live");
  assert.equal(promotion.productionBinding.deploymentId, promotedDeployment.id);
  assert.throws(() => createPromotionReceipt({
    ...promotionInput,
    productionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:02:50.000Z",
      "2026-08-29T15:02:45.000Z",
    ),
  }), /selected a different deployment/u);
  assert.throws(() => createPromotionReceipt({
    ...promotionInput,
    productionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:02:20.000Z",
      "2026-08-29T15:02:15.000Z",
    ),
  }), /public smoke and production binding/u);
  const legacyPreMutationState = structuredClone(promotionInput.preMutationState);
  delete legacyPreMutationState.currentProductionBinding;
  delete legacyPreMutationState.preMutationStateDigest;
  legacyPreMutationState.schemaVersion =
    "programmable.developers.vercel-pre-mutation-state.v1";
  legacyPreMutationState.currentDeployment.aliases = formalProductionAliases;
  legacyPreMutationState.selectedDeployment.aliases = vercelProductionAliases;
  legacyPreMutationState.preMutationStateDigest = canonicalSha256(
    legacyPreMutationState.schemaVersion,
    legacyPreMutationState,
  );
  assert.equal(parsePreMutationState(legacyPreMutationState, {
    operation: "promote",
    plan,
    selectedSmoke: promotionInput.selectedSmoke,
    selectedBundle: bundle,
  }).schemaVersion, "programmable.developers.vercel-pre-mutation-state.v1");
  const promotionV2 = structuredClone(promotion);
  delete promotionV2.mutationIntentDigest;
  delete promotionV2.mutationReadinessDigest;
  delete promotionV2.previousProductionBinding;
  delete promotionV2.previousRelease.source;
  delete promotionV2.previousRelease.workflow;
  promotionV2.schemaVersion =
    "programmable.developers.vercel-promotion-receipt.v2";
  reseal(promotionV2, promotionV2.schemaVersion, "promotionReceiptDigest");
  assert.equal(parsePromotionReceipt(promotionV2, { bundle, target }).state,
    "promoted-live");
  const collidingPromotionV2 = structuredClone(promotion);
  collidingPromotionV2.schemaVersion =
    "programmable.developers.vercel-promotion-receipt.v2";
  reseal(collidingPromotionV2, collidingPromotionV2.schemaVersion,
    "promotionReceiptDigest");
  assert.throws(() => parsePromotionReceipt(collidingPromotionV2),
    /unsupported field set/u,
  "a v3 promotion receipt cannot be relabeled into the exact v2 namespace");
  const legacyPromotion = structuredClone(promotionV2);
  delete legacyPromotion.productionBinding;
  legacyPromotion.schemaVersion =
    "programmable.developers.vercel-promotion-receipt.v1";
  reseal(legacyPromotion, legacyPromotion.schemaVersion, "promotionReceiptDigest");
  assert.equal(parsePromotionReceipt(legacyPromotion, { bundle, target }).state,
    "promoted-live");
  assert.throws(() => createPromotionReceipt({
    ...promotionInput,
    productionSmoke: smoke(
      "live", PRODUCTION_ORIGIN, bundle, "2026-08-29T15:00:00.000Z", "promotion",
      sha("9"),
    ),
  }), /public manifest differs/u);
  assert.throws(() => createPromotionReceipt({
    ...promotionInput,
    selectedSmoke: smoke(
      "live", stageDeployment.url, bundle, "2026-08-29T14:57:59.999Z",
    ),
    preMutationState: createPreMutationState({
      operation: "promote",
      plan,
      currentDeployment: previousDeployment,
      currentProductionBinding: productionBinding(
        previousDeployment,
        "2026-08-29T14:57:55.000Z",
        "2026-08-29T14:57:45.000Z",
      ),
      selectedDeployment: stageDeployment,
      selectedProtectionEvidence: protectionEvidence(
        stageDeployment, "2026-08-29T14:57:50.000Z",
      ),
      selectedSmoke: smoke(
        "live", stageDeployment.url, bundle, "2026-08-29T14:57:59.999Z",
      ),
      selectedBundle: bundle,
      checkedAt: "2026-08-29T14:57:59.999Z",
    }),
  }), /fresh selected deployment smoke time/u);

  const recoveredAttemptInput = {
    intent: promotionIntent,
    intentProvenance: mutationIntentProvenance(promotionIntent),
    source: recoverySource,
    workflow: recoveryWorkflow,
    ownerDispatchAuthorization: recoveryOwnerDispatchAuthorization(
      "2026-08-29T15:03:40.000Z",
    ),
    currentDeployment: promotedDeployment,
    currentProductionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:03:10.000Z",
      "2026-08-29T15:03:05.000Z",
    ),
    targetDeployment: stageDeployment,
    targetProtectionEvidence: protectionEvidence(
      stageDeployment,
      "2026-08-29T15:03:20.000Z",
    ),
    targetSmoke: smoke(
      "live", stageDeployment.url, bundle, "2026-08-29T15:03:30.000Z",
    ),
    selectedBundle: bundle,
    authorizedAt: "2026-08-29T15:03:40.000Z",
  };
  const recoveredAttempt = createPublicMutationRecoveryAttempt(recoveredAttemptInput);
  assert.equal(recoveredAttempt.classification, "target");
  const recoveredReadinessInput = {
    ...recoveredAttemptInput,
    ownerDispatchAuthorization: recoveryOwnerDispatchAuthorization(
      "2026-08-29T15:04:30.000Z",
    ),
    currentProductionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:04:40.000Z",
      "2026-08-29T15:04:35.000Z",
    ),
    mutationControl: mutationControl("2026-08-29T15:04:45.000Z"),
    targetProtectionEvidence: protectionEvidence(
      stageDeployment,
      "2026-08-29T15:04:10.000Z",
    ),
    targetSmoke: smoke(
      "live", stageDeployment.url, bundle, "2026-08-29T15:04:20.000Z",
    ),
    authorizedAt: "2026-08-29T15:04:30.000Z",
  };
  const recoveredReadiness = createPublicMutationRecoveryReadiness({
    ...recoveredReadinessInput,
    attempt: recoveredAttempt,
    attemptProvenance: recoveryAttemptProvenance(recoveredAttempt),
    confirmedAt: "2026-08-29T15:04:50.000Z",
  });
  const recoveredPromotion = createRecoveredPromotionReceipt({
    intent: promotionIntent,
    plan,
    intentAuthorization: authorization,
    intentPreMutationState: promotionInput.preMutationState,
    intentSelectedSmoke: promotionInput.selectedSmoke,
    bundle,
    recoveryAttempt: recoveredAttempt,
    recoveryReadiness: recoveredReadiness,
    productionDeployment: promotedDeployment,
    productionSmoke: smoke(
      "live", PRODUCTION_ORIGIN, bundle, "2026-08-29T15:05:00.000Z",
    ),
    productionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:05:10.000Z",
      "2026-08-29T15:05:05.000Z",
    ),
    promotedAt: "2026-08-29T15:05:20.000Z",
  });
  assert.equal(recoveredPromotion.schemaVersion, RECOVERED_PROMOTION_RECEIPT_SCHEMA);
  assert.equal(recoveredPromotion.publicMutationPerformed, false);
  assert.deepEqual(recoveredPromotion.source, recoverySource);
  assert.deepEqual(recoveredPromotion.deploymentSource, promotionSource);
  const mismatchedPromotionLineage = structuredClone(recoveredPromotion);
  mismatchedPromotionLineage.recoveryClassification = "old";
  mismatchedPromotionLineage.publicMutationPerformed = true;
  reseal(mismatchedPromotionLineage, RECOVERED_PROMOTION_RECEIPT_SCHEMA,
    "promotionReceiptDigest");
  assert.throws(() => parsePromotionReceipt(mismatchedPromotionLineage, {
    bundle, target,
  }), /exact recovery lineage/u,
  "recovered promotion parsing must reject a resealed classification substitution");
  const mismatchedRecoveredPromotionManifest = structuredClone(recoveredPromotion);
  mismatchedRecoveredPromotionManifest.productionSmoke = smoke(
    "live", PRODUCTION_ORIGIN, bundle, "2026-08-29T15:05:00.000Z", "promotion",
    sha("9"),
  );
  mismatchedRecoveredPromotionManifest.productionSmokeDigest =
    mismatchedRecoveredPromotionManifest.productionSmoke.smokeDigest;
  reseal(mismatchedRecoveredPromotionManifest, RECOVERED_PROMOTION_RECEIPT_SCHEMA,
    "promotionReceiptDigest");
  assert.throws(() => parsePromotionReceipt(mismatchedRecoveredPromotionManifest, {
    bundle, target,
  }), /exact recovery lineage/u,
  "recovered promotion parsing must bind the public manifest to the exact target smoke");
  const staleRecoveredPromotion = structuredClone(recoveredPromotion);
  staleRecoveredPromotion.productionSmoke = smoke(
    "live", PRODUCTION_ORIGIN, bundle, "2026-08-29T15:10:00.000Z",
  );
  staleRecoveredPromotion.productionSmokeDigest =
    staleRecoveredPromotion.productionSmoke.smokeDigest;
  staleRecoveredPromotion.productionBinding = productionBinding(
    promotedDeployment,
    "2026-08-29T15:10:10.000Z",
    "2026-08-29T15:10:05.000Z",
  );
  staleRecoveredPromotion.promotedAt = "2026-08-29T15:10:20.000Z";
  reseal(staleRecoveredPromotion, RECOVERED_PROMOTION_RECEIPT_SCHEMA,
    "promotionReceiptDigest");
  assert.throws(() => parsePromotionReceipt(staleRecoveredPromotion, {
    bundle, target,
  }), /within five minutes/u,
  "recovered promotion parsing must enforce readiness-to-seal total freshness");
  const recoveredPromotionArchive = storedZipEntry(
    "promotion-receipt.json",
    Buffer.from(`${JSON.stringify(recoveredPromotion, null, 2)}\n`, "utf8"),
  );
  const rollbackFromRecovery = createRollbackPlan({
    promotionReceipt: recoveredPromotion,
    promotionRun: recoveryActionsRunEvidence(),
    bundle,
    currentSmoke: smoke(
      "live", PRODUCTION_ORIGIN, bundle, "2026-08-29T15:05:20.000Z",
    ),
    currentDeployment: promotedDeployment,
    currentProductionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:05:10.000Z",
      "2026-08-29T15:05:05.000Z",
    ),
    promotionArtifact: recoveryActionsArtifact(
      `developers-vercel-promotion-${recoveryWorkflow.runId}-${recoveryWorkflow.runAttempt}`,
      recoverySource,
      201,
      recoveredPromotionArchive,
    ),
    promotionArtifactArchive: recoveredPromotionArchive,
    targetSmoke: smoke(
      "planned", previousDeployment.url, undefined, "2026-08-29T15:05:30.000Z",
    ),
    targetDeployment: { ...previousDeployment, aliases: [] },
    targetProtectionEvidence: protectionEvidence(
      { ...previousDeployment, aliases: [] },
      "2026-08-29T15:05:25.000Z",
    ),
    target,
    workflow,
    preparedAt: "2026-08-29T15:05:40.000Z",
  });
  assert.deepEqual(rollbackFromRecovery.source, recoverySource,
    "recovered promotion artifact source must remain authorizable by rollback");
  assert.equal(parseRollbackPlan(rollbackFromRecovery, {
    bundle,
    promotionReceipt: recoveredPromotion,
    target,
  }).promotionReceiptDigest, recoveredPromotion.promotionReceiptDigest);

  const standardPromotionArchive = storedZipEntry(
    "promotion-receipt.json",
    Buffer.from(`${JSON.stringify(promotion, null, 2)}\n`, "utf8"),
  );
  const rollbackPlanInput = {
    promotionReceipt: promotion,
    promotionRun: actionsRunEvidence(promotionSource),
    bundle,
    currentSmoke: smoke("live", PRODUCTION_ORIGIN, bundle, "2026-08-29T15:04:00.000Z"),
    currentDeployment: promotedDeployment,
    currentProductionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:03:50.000Z",
      "2026-08-29T15:03:45.000Z",
    ),
    promotionArtifact: actionsArtifact(
      `developers-vercel-promotion-${workflow.runId}-${workflow.runAttempt}`,
      promotionSource,
      102,
      standardPromotionArchive,
    ),
    promotionArtifactArchive: standardPromotionArchive,
    targetSmoke: smoke("planned", previousDeployment.url, undefined,
      "2026-08-29T15:04:00.000Z"),
    targetDeployment: { ...previousDeployment, aliases: [] },
    targetProtectionEvidence: protectionEvidence(
      { ...previousDeployment, aliases: [] }, "2026-08-29T15:04:00.000Z",
    ),
    target,
    workflow,
    preparedAt: "2026-08-29T15:04:00.000Z",
  };
  const rollbackPlan = createRollbackPlan(rollbackPlanInput);
  const substitutedPromotionArchive = storedZipEntry(
    "promotion-receipt.json",
    Buffer.from(`${JSON.stringify(legacyPromotion, null, 2)}\n`, "utf8"),
  );
  assert.throws(() => createRollbackPlan({
    ...rollbackPlanInput,
    promotionArtifact: actionsArtifact(
      `developers-vercel-promotion-${workflow.runId}-${workflow.runAttempt}`,
      promotionSource,
      103,
      substitutedPromotionArchive,
    ),
    promotionArtifactArchive: substitutedPromotionArchive,
  }), /archive entry differs from the exact local evidence bytes/u,
  "rollback planning must bind the authenticated archive to the exact promotion receipt bytes");
  assert.equal(rollbackPlan.schemaVersion, ROLLBACK_PLAN_SCHEMA);
  assert.equal(rollbackPlan.schemaVersion, "programmable.developers.vercel-rollback-plan.v3");
  assert.equal(rollbackPlan.rollbackDeployment.aliases.length, 0);
  assert.equal(rollbackPlan.currentProductionBinding.deploymentId, promotedDeployment.id);
  assert.equal(rollbackPlan.targetProtectionEvidence.deploymentId, previousDeployment.id);
  assert.equal(parseRollbackPlan(rollbackPlan, {
    bundle,
    promotionReceipt: promotion,
    target,
  }).rollbackTarget.deployment.id, previousDeployment.id);
  const rollbackPlanV2 = structuredClone(rollbackPlan);
  delete rollbackPlanV2.promotionReceipt;
  delete rollbackPlanV2.promotionRun;
  delete rollbackPlanV2.promotionArtifactArchiveDigest;
  delete rollbackPlanV2.promotionArtifactEntryPath;
  delete rollbackPlanV2.promotionArtifactEntrySha256;
  delete rollbackPlanV2.currentProductionBinding;
  delete rollbackPlanV2.rollbackTarget.source;
  delete rollbackPlanV2.rollbackTarget.workflow;
  rollbackPlanV2.schemaVersion =
    "programmable.developers.vercel-rollback-plan.v2";
  reseal(rollbackPlanV2, rollbackPlanV2.schemaVersion, "rollbackPlanDigest");
  assert.equal(parseRollbackPlan(rollbackPlanV2, {
    bundle,
    promotionReceipt: promotion,
    target,
  }).schemaVersion, "programmable.developers.vercel-rollback-plan.v2");
  const collidingRollbackPlanV2 = structuredClone(rollbackPlan);
  collidingRollbackPlanV2.schemaVersion =
    "programmable.developers.vercel-rollback-plan.v2";
  reseal(collidingRollbackPlanV2, collidingRollbackPlanV2.schemaVersion,
    "rollbackPlanDigest");
  assert.throws(() => parseRollbackPlan(collidingRollbackPlanV2),
    /unsupported field set/u,
  "a v3 rollback plan cannot be relabeled into the exact v2 namespace");
  const legacyRollbackPlan = structuredClone(rollbackPlanV2);
  legacyRollbackPlan.schemaVersion = "programmable.developers.vercel-rollback-plan.v1";
  legacyRollbackPlan.rollbackDeployment.aliases = vercelProductionAliases;
  reseal(legacyRollbackPlan, legacyRollbackPlan.schemaVersion, "rollbackPlanDigest");
  assert.equal(parseRollbackPlan(legacyRollbackPlan, {
    bundle,
    promotionReceipt: promotion,
    target,
  }).schemaVersion, "programmable.developers.vercel-rollback-plan.v1");
  const familyAliasedLegacyRollbackPlan = structuredClone(legacyRollbackPlan);
  delete familyAliasedLegacyRollbackPlan.rollbackPlanDigest;
  familyAliasedLegacyRollbackPlan.rollbackDeployment.aliases = formalProductionAliases;
  familyAliasedLegacyRollbackPlan.rollbackPlanDigest = canonicalSha256(
    familyAliasedLegacyRollbackPlan.schemaVersion,
    familyAliasedLegacyRollbackPlan,
  );
  assert.throws(() => parseRollbackPlan(familyAliasedLegacyRollbackPlan),
    /public production alias/u);
  const providerAliasedRollbackPlanV2 = structuredClone(rollbackPlanV2);
  providerAliasedRollbackPlanV2.rollbackDeployment.aliases = vercelProductionAliases;
  reseal(providerAliasedRollbackPlanV2, providerAliasedRollbackPlanV2.schemaVersion,
    "rollbackPlanDigest");
  assert.throws(() => parseRollbackPlan(providerAliasedRollbackPlanV2),
    /formal production domain/u);
  const rollbackAuthorization = createPublicAuthorization({
    operation: "rollback",
    plan: rollbackPlan,
    workflow,
    ownerDispatchAuthorization:
      ownerDispatchAuthorization("2026-08-29T15:05:00.000Z"),
    authorizedAt: "2026-08-29T15:05:00.000Z",
  });
  const rollbackInput = {
    plan: rollbackPlan,
    authorization: rollbackAuthorization,
    preMutationState: createPreMutationState({
      operation: "rollback",
      plan: rollbackPlan,
      currentDeployment: promotedDeployment,
      currentProductionBinding: productionBinding(
        promotedDeployment,
        "2026-08-29T15:05:25.000Z",
        "2026-08-29T15:05:15.000Z",
      ),
      selectedDeployment: { ...previousDeployment, aliases: [] },
      selectedProtectionEvidence: protectionEvidence(
        { ...previousDeployment, aliases: [] }, "2026-08-29T15:05:20.000Z",
      ),
      selectedSmoke: smoke("planned", previousDeployment.url, undefined,
        "2026-08-29T15:05:30.000Z"),
      checkedAt: "2026-08-29T15:05:30.000Z",
    }),
    selectedSmoke: smoke("planned", previousDeployment.url, undefined,
      "2026-08-29T15:05:30.000Z"),
    productionDeployment: previousDeployment,
    productionSmoke: smoke("planned", PRODUCTION_ORIGIN, undefined,
      "2026-08-29T15:06:00.000Z"),
    productionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:06:10.000Z",
      "2026-08-29T15:06:05.000Z",
    ),
    workflow,
    rolledBackAt: "2026-08-29T15:06:20.000Z",
  };
  const rollbackIntent = createPublicMutationIntent({
    operation: "rollback",
    plan: rollbackPlan,
    authorization: rollbackAuthorization,
    preMutationState: rollbackInput.preMutationState,
    selectedSmoke: rollbackInput.selectedSmoke,
    createdAt: "2026-08-29T15:05:40.000Z",
  });
  const finalRollbackAuthorization = createPublicAuthorization({
    operation: "rollback",
    plan: rollbackPlan,
    workflow,
    ownerDispatchAuthorization:
      ownerDispatchAuthorization("2026-08-29T15:05:35.000Z"),
    authorizedAt: "2026-08-29T15:05:35.000Z",
  });
  const finalRollbackReadiness = validatePreMutationReadiness({
    operation: "rollback",
    intent: rollbackIntent,
    intentAuthorization: rollbackAuthorization,
    intentPreMutationState: rollbackInput.preMutationState,
    intentSelectedSmoke: rollbackInput.selectedSmoke,
    plan: rollbackPlan,
    authorization: finalRollbackAuthorization,
    preMutationState: rollbackInput.preMutationState,
    selectedSmoke: rollbackInput.selectedSmoke,
    currentDeployment: promotedDeployment,
    currentProductionBinding: productionBinding(
      promotedDeployment,
      "2026-08-29T15:05:40.000Z",
      "2026-08-29T15:05:38.000Z",
    ),
    mutationControl: mutationControl("2026-08-29T15:05:42.000Z"),
    confirmedAt: "2026-08-29T15:05:45.000Z",
  });
  Object.assign(rollbackInput, {
    authorization: finalRollbackAuthorization,
    intent: rollbackIntent,
    mutationReadiness: finalRollbackReadiness,
  });
  const rollback = createRollbackReceipt(rollbackInput);
  assert.equal(rollback.state, "rolled-back-verified");
  assert.equal(rollback.deployment.id, "dpl_previous123");
  assert.equal(rollback.productionBinding.deploymentId, previousDeployment.id);
  const rollbackRecoveryAttemptInput = {
    intent: rollbackIntent,
    intentProvenance: mutationIntentProvenance(rollbackIntent),
    source: recoverySource,
    workflow: recoveryWorkflow,
    ownerDispatchAuthorization: recoveryOwnerDispatchAuthorization(
      "2026-08-29T15:06:30.000Z",
    ),
    currentDeployment: previousDeployment,
    currentProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:06:00.000Z",
      "2026-08-29T15:05:55.000Z",
    ),
    targetDeployment: { ...previousDeployment, aliases: [] },
    targetProtectionEvidence: protectionEvidence(
      { ...previousDeployment, aliases: [] },
      "2026-08-29T15:06:10.000Z",
    ),
    targetSmoke: smoke(
      "planned", previousDeployment.url, undefined, "2026-08-29T15:06:20.000Z",
    ),
    authorizedAt: "2026-08-29T15:06:30.000Z",
  };
  const rollbackRecoveryAttempt = createPublicMutationRecoveryAttempt(
    rollbackRecoveryAttemptInput,
  );
  const rollbackRecoveryReadinessInput = {
    ...rollbackRecoveryAttemptInput,
    ownerDispatchAuthorization: recoveryOwnerDispatchAuthorization(
      "2026-08-29T15:07:30.000Z",
    ),
    currentProductionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:07:40.000Z",
      "2026-08-29T15:07:35.000Z",
    ),
    mutationControl: mutationControl("2026-08-29T15:07:45.000Z"),
    targetProtectionEvidence: protectionEvidence(
      { ...previousDeployment, aliases: [] },
      "2026-08-29T15:07:10.000Z",
    ),
    targetSmoke: smoke(
      "planned", previousDeployment.url, undefined, "2026-08-29T15:07:20.000Z",
    ),
    authorizedAt: "2026-08-29T15:07:30.000Z",
  };
  const rollbackRecoveryReadiness = createPublicMutationRecoveryReadiness({
    ...rollbackRecoveryReadinessInput,
    attempt: rollbackRecoveryAttempt,
    attemptProvenance: recoveryAttemptProvenance(rollbackRecoveryAttempt),
    confirmedAt: "2026-08-29T15:07:50.000Z",
  });
  const recoveredRollback = createRecoveredRollbackReceipt({
    intent: rollbackIntent,
    plan: rollbackPlan,
    intentAuthorization: rollbackAuthorization,
    intentPreMutationState: rollbackInput.preMutationState,
    intentSelectedSmoke: rollbackInput.selectedSmoke,
    recoveryAttempt: rollbackRecoveryAttempt,
    recoveryReadiness: rollbackRecoveryReadiness,
    productionDeployment: previousDeployment,
    productionSmoke: smoke(
      "planned", PRODUCTION_ORIGIN, undefined, "2026-08-29T15:08:00.000Z",
    ),
    productionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:08:10.000Z",
      "2026-08-29T15:08:05.000Z",
    ),
    rolledBackAt: "2026-08-29T15:08:20.000Z",
  });
  assert.equal(recoveredRollback.schemaVersion, RECOVERED_ROLLBACK_RECEIPT_SCHEMA);
  assert.equal(recoveredRollback.publicMutationPerformed, false);
  assert.equal(parseRollbackReceipt(recoveredRollback).state, "rolled-back-verified");
  const mismatchedRollbackLineage = structuredClone(recoveredRollback);
  mismatchedRollbackLineage.authorizationDigest = sha("8");
  reseal(mismatchedRollbackLineage, RECOVERED_ROLLBACK_RECEIPT_SCHEMA,
    "rollbackReceiptDigest");
  assert.throws(() => parseRollbackReceipt(mismatchedRollbackLineage),
    /exact recovery lineage/u,
  "recovered rollback parsing must revalidate its embedded owner authorization");
  const mismatchedRecoveredRollbackManifest = structuredClone(recoveredRollback);
  mismatchedRecoveredRollbackManifest.productionSmoke = smoke(
    "planned", PRODUCTION_ORIGIN, undefined, "2026-08-29T15:08:00.000Z",
    "promotion", sha("9"),
  );
  mismatchedRecoveredRollbackManifest.productionSmokeDigest =
    mismatchedRecoveredRollbackManifest.productionSmoke.smokeDigest;
  reseal(mismatchedRecoveredRollbackManifest, RECOVERED_ROLLBACK_RECEIPT_SCHEMA,
    "rollbackReceiptDigest");
  assert.throws(() => parseRollbackReceipt(mismatchedRecoveredRollbackManifest),
    /exact recovery lineage/u,
  "recovered rollback parsing must bind the public manifest to the exact target smoke");
  assert.throws(() => createRollbackReceipt({
    ...rollbackInput,
    productionBinding: productionBinding(
      previousDeployment,
      "2026-08-29T15:05:20.000Z",
      "2026-08-29T15:05:15.000Z",
    ),
  }), /public smoke and production binding/u);
  const rollbackV2 = structuredClone(rollback);
  delete rollbackV2.mutationIntentDigest;
  delete rollbackV2.mutationReadinessDigest;
  rollbackV2.schemaVersion =
    "programmable.developers.vercel-rollback-receipt.v2";
  reseal(rollbackV2, rollbackV2.schemaVersion, "rollbackReceiptDigest");
  assert.equal(parseRollbackReceipt(rollbackV2, { target }).state,
    "rolled-back-verified");
  const collidingRollbackV2 = structuredClone(rollback);
  collidingRollbackV2.schemaVersion =
    "programmable.developers.vercel-rollback-receipt.v2";
  reseal(collidingRollbackV2, collidingRollbackV2.schemaVersion,
    "rollbackReceiptDigest");
  assert.throws(() => parseRollbackReceipt(collidingRollbackV2),
    /unsupported field set/u,
  "a v3 rollback receipt cannot be relabeled into the exact v2 namespace");
  const legacyRollback = structuredClone(rollbackV2);
  delete legacyRollback.productionBinding;
  legacyRollback.schemaVersion =
    "programmable.developers.vercel-rollback-receipt.v1";
  reseal(legacyRollback, legacyRollback.schemaVersion, "rollbackReceiptDigest");
  assert.equal(parseRollbackReceipt(legacyRollback, { target }).state,
    "rolled-back-verified");
  assert.throws(() => createRollbackReceipt({
    ...rollbackInput,
    productionSmoke: smoke(
      "planned", PRODUCTION_ORIGIN, undefined, "2026-08-29T15:06:00.000Z", "promotion",
      sha("9"),
    ),
  }), /public manifest differs/u);
  assert.throws(() => createRollbackReceipt({
    ...rollbackInput,
    selectedSmoke: smoke("planned", previousDeployment.url, undefined,
      "2026-08-29T15:00:59.999Z"),
    preMutationState: createPreMutationState({
      operation: "rollback",
      plan: rollbackPlan,
      currentDeployment: promotedDeployment,
      currentProductionBinding: productionBinding(
        promotedDeployment,
        "2026-08-29T15:00:55.000Z",
        "2026-08-29T15:00:45.000Z",
      ),
      selectedDeployment: { ...previousDeployment, aliases: [] },
      selectedProtectionEvidence: protectionEvidence(
        { ...previousDeployment, aliases: [] }, "2026-08-29T15:00:50.000Z",
      ),
      selectedSmoke: smoke("planned", previousDeployment.url, undefined,
        "2026-08-29T15:00:59.999Z"),
      checkedAt: "2026-08-29T15:00:59.999Z",
    }),
  }), /fresh selected deployment smoke time/u);
});

test("binds selected GitHub runs, artifacts, and the canonical owner dispatch", () => {
  const runRaw = {
    id: 12345,
    run_attempt: 1,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_sha: source.revision,
    head_branch: "main",
    path: ".github/workflows/vercel-release.yml",
    name: "Vercel release control",
    html_url: "https://github.com/programmablehq/Developers/actions/runs/12345",
    repository: { full_name: "programmablehq/Developers" },
    actor: { login: "hazarxyz", id: 258789013 },
    triggering_actor: { login: "hazarxyz", id: 258789013 },
    head_commit: { id: source.revision, tree_id: source.tree },
  };
  const run = validateGitHubRunEvidence(runRaw, { runId: "12345", runAttempt: "1" });
  assert.equal(run.sourceTree, source.tree);
  const wrongBranch = structuredClone(runRaw);
  wrongBranch.head_branch = "feature";
  assert.throws(() => validateGitHubRunEvidence(wrongBranch, {
    runId: "12345", runAttempt: "1",
  }), /exact successful protected release run/u);

  const artifactName = "developers-vercel-stage-12345-1";
  const artifactRaw = {
    artifacts: [{
      id: 123,
      name: artifactName,
      digest: sha("a"),
      size_in_bytes: 1234,
      expired: false,
      workflow_run: { id: 12345, head_branch: "main", head_sha: source.revision },
    }],
  };
  assert.equal(validateGitHubArtifactEvidence(artifactRaw, {
    name: artifactName,
    runId: "12345",
    runAttempt: "1",
    sourceRevision: source.revision,
  }).artifactId, "123");
  const expired = structuredClone(artifactRaw);
  expired.artifacts[0].expired = true;
  assert.throws(() => validateGitHubArtifactEvidence(expired, {
    name: artifactName,
    runId: "12345",
    runAttempt: "1",
    sourceRevision: source.revision,
  }), /exact protected source run/u);

  const ownerDispatch = ownerDispatchAuthorization("2026-08-29T15:02:00.000Z");
  assert.equal(ownerDispatch.owner.login, "hazarxyz");
  assert.equal(ownerDispatch.owner.id, "258789013");
  assert.equal(ownerDispatch.observedAt, "2026-08-29T15:02:00.000Z");
  assert.equal(ownerDispatch.environment.id, "19441858925");
  assert.equal(ownerDispatch.environment.createdAt, "2026-08-27T00:00:00Z");
  assert.equal(ownerDispatch.environment.updatedAt, "2026-08-27T00:05:00Z");
  assert.equal(ownerDispatch.environment.protectedBranchesOnly, true);
  assert.equal(ownerDispatch.environment.canAdminsBypass, false);
  assert.deepEqual(parseGitHubOwnerDispatchAuthorization(ownerDispatch, {
    workflow,
    source: promotionSource,
  }), ownerDispatch);
  assert.throws(() => ownerDispatchAuthorization("2026-08-29T15:02:00.000Z", {
    runOverrides: {
      actor: { login: "programmable-infra", id: 309941960 },
      triggering_actor: { login: "programmable-infra", id: 309941960 },
    },
  }), /canonical owner workflow_dispatch/u);
  assert.throws(() => ownerDispatchAuthorization("2026-08-29T15:02:00.000Z", {
    environmentOverrides: { can_admins_bypass: true },
  }), /admin bypass disabled/u);
  assert.throws(() => ownerDispatchAuthorization("2026-08-29T15:02:00.000Z", {
    environmentOverrides: {
      protection_rules: [{ type: "required_reviewers" }],
    },
  }), /must not invent a second-party reviewer gate/u);
  assert.throws(() => ownerDispatchAuthorization("2026-08-29T15:02:00.000Z", {
    environmentOverrides: { created_at: "2026-08-27T00:00:00.000Z" },
  }), /canonical UTC second/u);
  assert.throws(() => ownerDispatchAuthorization("2026-08-29T15:02:00.000Z", {
    environmentOverrides: { created_at: "2026-02-31T00:00:00Z" },
  }), /canonical UTC second/u);
  const fractionalEvidence = structuredClone(ownerDispatch);
  fractionalEvidence.environment.updatedAt = "2026-08-27T00:05:00.000Z";
  assert.throws(() => parseGitHubOwnerDispatchAuthorization(fractionalEvidence),
    /canonical UTC second/u);
  const impossibleEvidence = structuredClone(ownerDispatch);
  impossibleEvidence.environment.createdAt = "2026-02-31T00:00:00Z";
  assert.throws(() => parseGitHubOwnerDispatchAuthorization(impossibleEvidence),
    /canonical UTC second/u);
});

test("pins planned deployment/readback and a protected two-phase Vercel workflow", async () => {
  const workflowPath = path.resolve(".github/workflows/vercel-release.yml");
  const text = await readFile(workflowPath, "utf8");
  const document = parseYaml(text);
  assert.deepEqual(Object.keys(document.jobs), [
    "validate-source", "verify-planned", "deploy-planned", "stage", "prepare-promotion",
    "promote", "prepare-rollback", "rollback",
  ]);
  assert.deepEqual(document.permissions, { contents: "read", actions: "read" });
  assert.equal(document.env.ROBINHOOD_STAGE_BUNDLE_PATH, undefined);
  assert.equal(document.env.ROBINHOOD_PROMOTION_BUNDLE_PATH, undefined);
  assert.equal(document.env.PRODUCTION_ORIGIN, PRODUCTION_ORIGIN);
  assert.equal(document.env.VERCEL_PRODUCTION_ORIGIN, VERCEL_PRODUCTION_ORIGIN);
  assert.equal(document.env.CANONICAL_ROBINHOOD_STAGE_BUNDLE_PATH,
    CANONICAL_STAGE_BUNDLE_PATH);
  assert.equal(document.env.CANONICAL_ROBINHOOD_PROMOTION_BUNDLE_PATH,
    CANONICAL_PROMOTION_BUNDLE_PATH);
  assert.equal(document.env.INDEXER_RELEASE_IDENTITY_PATH,
    CANONICAL_INDEXER_RELEASE_IDENTITY_PATH);
  assert.equal(document.env.INDEXER_DEPLOYMENT_RECEIPT_PATH,
    CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH);
  assert.equal(document.env.INDEXER_RELEASE_AUDIT_PATH,
    CANONICAL_INDEXER_RELEASE_AUDIT_PATH);
  for (const [name, job] of Object.entries(document.jobs)) {
    assert.equal(job.if.includes("github.repository == 'programmablehq/Developers'"), true,
      `${name} must pin the repository`);
    assert.equal(job.if.includes("github.ref == 'refs/heads/main'"), true,
      `${name} must pin main`);
    assert.equal(job.if.includes("github.ref_protected == true"), true,
      `${name} must require a protected ref`);
    assert.equal(job.if.includes("github.actor == 'hazarxyz'"), true,
      `${name} must pin the canonical owner dispatcher`);
    assert.equal(job.if.includes("github.actor_id == '258789013'"), true,
      `${name} must pin the canonical owner account id`);
    assert.equal(job.if.includes("github.triggering_actor == 'hazarxyz'"), true,
      `${name} must reject collaborator re-runs`);
    const checkout = job.steps.find((step) =>
      typeof step.uses === "string" && step.uses.startsWith("actions/checkout@"));
    assert.equal(checkout?.with?.ref, "${{ github.sha }}",
      `${name} must detach at the dispatched SHA`);
    const sourceGate = job.steps.find((step) =>
      step.name === "Require current detached protected main");
    assert.match(sourceGate?.run ?? "",
      /\+refs\/heads\/main:refs\/remotes\/origin\/main/u,
      `${name} must fetch current origin/main`);
    assert.match(sourceGate?.run ?? "", /origin\/main\^\{commit\}.*GITHUB_SHA/su,
      `${name} must reject stale queued dispatches`);
    assert.match(sourceGate?.run ?? "", /GITHUB_REF.*refs\/heads\/main/su,
      `${name} must bind the protected main ref`);
    assert.match(sourceGate?.run ?? "", /GITHUB_REF_PROTECTED.*true/su,
      `${name} must bind GitHub's native protected-ref state`);
    assert.match(sourceGate?.run ?? "", /--abbrev-ref HEAD.*HEAD/su,
      `${name} must require a detached checkout`);
    assert.match(sourceGate?.run ?? "", /git status --porcelain/u,
      `${name} must require a clean checkout`);
  }
  assert.equal(document.jobs.promote.environment, "production");
  assert.equal(document.jobs.rollback.environment, "production");
  assert.equal(document.jobs["verify-planned"].environment, "production");
  assert.equal(document.jobs["deploy-planned"].environment, "production");
  for (const name of ["deploy-planned", "stage", "promote", "rollback"]) {
    const mutationGate = document.jobs[name].steps.find((step) =>
      step.name === "Reconfirm current protected main before Vercel mutation");
    assert.match(mutationGate?.run ?? "", /origin\/main\^\{commit\}.*GITHUB_SHA/su,
      `${name} must reject main drift immediately before mutation`);
    assert.match(mutationGate?.run ?? "", /GITHUB_REF.*refs\/heads\/main/su,
      `${name} must rebind the protected main ref immediately before mutation`);
    assert.match(mutationGate?.run ?? "", /GITHUB_REF_PROTECTED.*true/su,
      `${name} must rebind native protection immediately before mutation`);
    assert.match(mutationGate?.run ?? "", /--abbrev-ref HEAD.*HEAD/su,
      `${name} must remain detached immediately before mutation`);
    assert.match(mutationGate?.run ?? "", /git status --porcelain/u,
      `${name} must remain clean immediately before mutation`);
  }
  for (const [name, job] of Object.entries(document.jobs)) {
    assert.equal(job.env, undefined, `${name} must not receive job-wide secrets`);
  }
  const actionRefs = [...text.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/gu)].map((match) => match[1]);
  assert.equal(actionRefs.length > 0, true);
  assert.equal(actionRefs.every((reference) => /^[0-9a-f]{40}$/u.test(reference)), true);
  assert.doesNotMatch(text, /\bnpx\b|npm exec|--package=/u);
  assert.doesNotMatch(text, /--token\b/u);
  const plannedReadback = JSON.stringify(document.jobs["verify-planned"]);
  assert.match(plannedReadback, /--release-mode planned/u);
  assert.match(plannedReadback, /--mode planned --protection-bypass false/u);
  assert.match(plannedReadback,
    /VERCEL_PRODUCTION_ORIGIN[\s\S]*provider-smoke\.json[\s\S]*PRODUCTION_ORIGIN[\s\S]*smoke\.json/u);
  assert.match(plannedReadback,
    /provider-smoke\.json[\s\S]*manifestDigest[\s\S]*smoke\.json[\s\S]*manifestDigest/u);
  assert.doesNotMatch(plannedReadback,
    /ROBINHOOD_(?:STAGE|PROMOTION)_BUNDLE_PATH|vercel (?:deploy|promote|rollback)|--skip-domain/u,
    "planned verification must not select a phase bundle or mutate Vercel");
  const plannedDeployJob = document.jobs["deploy-planned"];
  const plannedDeploy = JSON.stringify(plannedDeployJob);
  assert.match(plannedDeploy,
    /unset ROBINHOOD_STAGE_BUNDLE_PATH ROBINHOOD_PROMOTION_BUNDLE_PATH/u);
  for (const step of plannedDeployJob.steps) {
    assert.equal(step.env?.ROBINHOOD_STAGE_BUNDLE_PATH, undefined,
      `${step.name} must not select the stage bundle`);
    assert.equal(step.env?.ROBINHOOD_PROMOTION_BUNDLE_PATH, undefined,
      `${step.name} must not select the promotion bundle`);
  }
  assert.doesNotMatch(plannedDeploy, /--bundle(?:-phase)?/u);
  assert.match(plannedDeploy,
    /vercel deploy --prebuilt --target=production[\s\S]*--skip-domain/u);
  const plannedCandidateDeploy = plannedDeployJob.steps.find((step) =>
    step.name === "Create source-bound planned candidate without formal domains");
  assert.equal(plannedCandidateDeploy?.env?.VERCEL_PROJECT_ID,
    "${{ secrets.VERCEL_PROJECT_ID }}",
    "planned candidate creation must provide the Vercel project binding");
  const plannedCandidateBinding = plannedDeployJob.steps.find((step) =>
    step.name === "Bind exact candidate without formal domains to planned source");
  assert.match(plannedCandidateBinding?.run ?? "",
    /candidate-create\.json --path id/u,
    "planned candidate binding must read Vercel CLI JSON at its exact top-level ID");
  assert.match(plannedDeploy,
    /programmableReleaseMode=planned/u);
  assert.match(plannedDeploy,
    /candidate_url[\s\S]*--mode planned --protection-bypass true/u);
  assert.match(plannedDeploy,
    /candidate\.json[\s\S]*--protection-output \.release-evidence\/planned-deploy\/candidate-protection\.json/u);
  assert.match(plannedDeploy,
    /candidate-pre-mutation\.json[\s\S]*--protection-output[\s\S]*candidate-protection-pre-mutation\.json/u);
  const protectedCandidateSmokeSteps = plannedDeployJob.steps.filter((step) =>
    step.env?.VERCEL_AUTOMATION_BYPASS_SECRET !== undefined);
  assert.deepEqual(protectedCandidateSmokeSteps.map((step) => step.name), [
    "Smoke exact protected planned candidate through scoped bypass",
    "Fresh authenticated smoke of provider-verified planned candidate",
  ]);
  for (const step of protectedCandidateSmokeSteps) {
    assert.equal(step.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      "${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}");
    assert.match(step.run, /candidate[^\n]*[\s\S]*--mode planned --protection-bypass true/u);
    assert.doesNotMatch(step.run, /PRODUCTION_ORIGIN/u);
  }
  const finalPlannedBoundary = plannedDeployJob.steps.find((step) =>
    step.name === "Promote only the verified planned candidate");
  assert.equal(finalPlannedBoundary.env.VERCEL_AUTOMATION_BYPASS_SECRET, undefined);
  assert.equal(finalPlannedBoundary.env.RELEASE_SMOKE_BYPASS_SECRET,
    "${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}");
  assert.match(finalPlannedBoundary.run,
    /PRODUCTION_ORIGIN[\s\S]*candidate-final\.json[\s\S]*--protection-bypass true/u);
  assert.match(finalPlannedBoundary.run,
    /VERCEL_AUTOMATION_BYPASS_SECRET="\$smoke_bypass_secret"[\s\S]*smoke:chain-4663/u);
  assert.match(finalPlannedBoundary.run,
    /unset RELEASE_GITHUB_TOKEN RELEASE_VERCEL_TOKEN RELEASE_SMOKE_BYPASS_SECRET/u);
  assert.match(finalPlannedBoundary.run,
    /actions\/runs\/\$GITHUB_RUN_ID[\s\S]*environments\/production/u);
  assert.match(finalPlannedBoundary.run,
    /validate-planned-mutation-readiness[\s\S]*vercel promote/u);
  for (const step of plannedDeployJob.steps.filter((candidate) =>
    !protectedCandidateSmokeSteps.includes(candidate))) {
    assert.equal(step.env?.VERCEL_AUTOMATION_BYPASS_SECRET, undefined,
      `${step.name} must not receive the Vercel automation bypass secret`);
  }
  const candidateAuthorization = plannedDeployJob.steps.find((step) =>
    step.name === "Authorize protected planned candidate creation");
  const promotionAuthorization = plannedDeployJob.steps.find((step) =>
    step.name === "Reauthorize protected planned alias mutation");
  for (const authorizationStep of [candidateAuthorization, promotionAuthorization]) {
    assert.match(authorizationStep?.run ?? "", /actions\/runs\/\$GITHUB_RUN_ID/u);
    assert.match(authorizationStep?.run ?? "", /environments\/production/u);
    assert.match(authorizationStep?.run ?? "", /authorize-planned-deploy/u);
    assert.equal(authorizationStep?.env?.RELEASE_CONTROL_ENVIRONMENT, "production");
  }
  assert.match(candidateAuthorization.run, /--mutation create-candidate/u);
  assert.match(candidateAuthorization.run,
    /--current-deployment \.release-evidence\/planned-deploy\/previous-deployment\.json/u);
  assert.match(promotionAuthorization.run, /--mutation promote-candidate/u);
  assert.match(promotionAuthorization.run,
    /--candidate-deployment[\s\S]*--candidate-protection-evidence[\s\S]*--candidate-smoke/u);
  const plannedStepNames = plannedDeployJob.steps.map((step) => step.name);
  const candidateSourceGate = plannedDeployJob.steps.find((step) =>
    step.name === "Reconfirm current protected main before planned candidate creation");
  assert.match(candidateSourceGate?.run ?? "", /origin\/main\^\{commit\}.*GITHUB_SHA/su);
  assert.equal(plannedStepNames.indexOf(
    "Reconfirm current protected main before planned candidate creation",
  ) < plannedStepNames.indexOf("Authorize protected planned candidate creation"), true);
  assert.equal(plannedStepNames.indexOf("Authorize protected planned candidate creation") <
    plannedStepNames.indexOf("Create source-bound planned candidate without formal domains"), true);
  assert.equal(plannedStepNames.indexOf("Provider-requery exact candidate before alias mutation") <
    plannedStepNames.indexOf("Reauthorize protected planned alias mutation"), true);
  assert.equal(plannedStepNames.indexOf("Reconfirm current protected main before Vercel mutation") <
    plannedStepNames.indexOf("Reauthorize protected planned alias mutation"), true);
  assert.equal(plannedStepNames.indexOf("Reauthorize protected planned alias mutation") <
    plannedStepNames.indexOf("Promote only the verified planned candidate"), true);
  assert.equal(plannedStepNames.indexOf("Upload immutable planned intent before public mutation") <
    plannedStepNames.indexOf("Promote only the verified planned candidate"), true);
  assert.match(plannedDeploy,
    /previous-deployment-pre-mutation\.json[\s\S]*test [^\n]*previous_id[^\n]*current_id/u,
    "planned publication must reject concurrent public-alias drift");
  assert.match(plannedDeploy,
    /vercel promote[^\n]*candidate_id[^\n]*--yes/u);
  assert.match(plannedDeploy,
    /promotion-authorization\.json[\s\S]*--path candidateDeployment\.id[\s\S]*vercel promote/u,
    "planned alias mutation must select the candidate from its sealed authorization");
  assert.match(plannedDeploy,
    /VERCEL_PRODUCTION_ORIGIN[\s\S]*--release-mode planned[\s\S]*PRODUCTION_ORIGIN[\s\S]*--mode planned --protection-bypass false[\s\S]*public-smoke\.json/u);
  assert.match(plannedDeploy,
    /candidate-smoke-pre-mutation\.json[\s\S]*manifestDigest[\s\S]*public-smoke\.json[\s\S]*manifestDigest/u);
  const providerCaptureSelectors = [...text.matchAll(
    /capture:vercel-provider[\s\S]{0,180}?--selector "\$(PRODUCTION_ORIGIN|VERCEL_PRODUCTION_ORIGIN)"/gu,
  )].map((match) => match[1]);
  assert.equal(providerCaptureSelectors.length > 0, true);
  assert.equal(providerCaptureSelectors.every((selector) =>
    selector === "VERCEL_PRODUCTION_ORIGIN"), true,
  "provider capture must use the formal Vercel mutation domain, never the public smoke origin");
  const sourceValidation = JSON.stringify(document.jobs["validate-source"]);
  assert.match(sourceValidation,
    /verify-planned[\s\S]*unset ROBINHOOD_STAGE_BUNDLE_PATH ROBINHOOD_PROMOTION_BUNDLE_PATH/u,
    "planned source validation must clear both phase selectors");
  assert.match(text, /--skip-domain/u);
  const stageCandidateDeploy = document.jobs.stage.steps.find((step) =>
    step.name === "Create production-target deployment without formal domains");
  assert.equal(stageCandidateDeploy?.env?.VERCEL_PROJECT_ID,
    "${{ secrets.VERCEL_PROJECT_ID }}",
    "stage candidate creation must provide the Vercel project binding");
  const stageCandidateBinding = document.jobs.stage.steps.find((step) =>
    step.name === "Provider-requery stage and protection");
  assert.match(stageCandidateBinding?.run ?? "",
    /stage\/deploy\.json --path id/u,
    "stage binding must read Vercel CLI JSON at its exact top-level ID");
  assert.match(text, /--phase "\$phase"/u);
  assert.match(text, /--bundle-phase stage --bundle "\$ROBINHOOD_STAGE_BUNDLE_PATH"/u);
  assert.match(text, /--bundle-phase promotion/u);
  assert.doesNotMatch(text,
    /--mode live --bundle-phase stage[^\n]*--protection-bypass false/u);
  assert.match(text,
    /--stage-bundle "\$ROBINHOOD_STAGE_BUNDLE_PATH"[\s\S]*--promotion-bundle "\$ROBINHOOD_PROMOTION_BUNDLE_PATH"/u);
  assert.match(text, /--protection-bypass true/u);
  assert.match(text, /--protection-bypass false/u);
  assert.match(text, /capture:github-release-evidence/u);
  assert.match(text, /create-pre-mutation-state/u);
  assert.match(text,
    /Resolve both production domains before sealing dark stage[\s\S]*--selector "\$VERCEL_PRODUCTION_ORIGIN"[\s\S]*current-production-deployment\.json/u,
    "the dark-stage receipt must bind both production domains through the provider origin");
  assert.match(text,
    /--current-production-deployment[\s\S]*\.release-evidence\/stage\/current-production-deployment\.json/u,
    "the stage receipt must consume the exact dual-domain production capture");
  assert.match(text,
    /--stage-protection-evidence \.release-evidence\/plan\/stage-protection\.json/u);
  assert.match(text,
    /--stage-run-evidence \.release-evidence\/plan\/stage-run-evidence\.json/u);
  assert.match(text,
    /--staged-deployment \.release-evidence\/plan\/stage-deployment\.json/u);
  assert.match(text,
    /--target-protection-evidence \.release-evidence\/rollback\/target-protection\.json/u);
  assert.match(text,
    /promotion-artifact-evidence\.json[\s\S]*actions\/artifacts\/\$artifact_id\/zip[\s\S]*--promotion-artifact-archive/u,
    "rollback planning must bind the exact downloaded promotion receipt archive bytes");
  assert.match(text,
    /prior-artifact-evidence\.json[\s\S]*actions\/artifacts\/\$artifact_id\/zip[\s\S]*--previous-promotion-artifact-archive/u,
    "a live prior promotion must bind the exact downloaded receipt archive bytes");
  assert.equal((text.match(/--selected-protection-evidence/gmu) ?? []).length, 4,
    "both public mutations must bind initial and immediate provider protection proofs");
  assert.equal((text.match(/--path checkedAt/gmu) ?? []).length, 4,
    "both public mutations must bind initial and immediate smoke timestamps");
  assert.equal((text.match(/developers-vercel-mutation-intent-/gmu) ?? []).length, 3,
    "all three public routing operations must upload immutable intent before mutation");
  for (const [jobName, mutationStepName] of [
    ["deploy-planned", "Promote only the verified planned candidate"],
    ["promote", "Promote only authorization-bound deployment"],
    ["rollback", "Roll back only to authorization-bound deployment"],
  ]) {
    const step = document.jobs[jobName].steps.find(({ name }) => name === mutationStepName);
    assert.match(step.run, /actions\/runs\/\$GITHUB_RUN_ID/u);
    assert.match(step.run, /environments\/production/u);
    assert.match(step.run, /--selector "\$VERCEL_PRODUCTION_ORIGIN"/u);
    assert.match(step.run, /--protection-output/u);
    assert.match(step.run, /--protection-bypass true/u);
    assert.match(step.run, /vercel promote/u);
    assert.equal(step.env.RELEASE_CONTROL_ENVIRONMENT, "production");
    assert.equal(step.env.VERCEL_AUTOMATION_BYPASS_SECRET, undefined,
      `${step.name} must not export the bypass secret to provider capture`);
    assert.equal(step.env.RELEASE_SMOKE_BYPASS_SECRET,
      "${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}");
    assert.match(step.run,
      /VERCEL_AUTOMATION_BYPASS_SECRET="\$smoke_bypass_secret"[\s\S]*smoke:chain-4663/u);
    assert.match(step.run,
      /unset RELEASE_GITHUB_TOKEN RELEASE_VERCEL_TOKEN RELEASE_SMOKE_BYPASS_SECRET/u);
    assert.match(step.run, /Authorization: Bearer \$github_token/u);
    assert.match(step.run, /VERCEL_TOKEN="\$vercel_token" npm run capture:vercel-provider/u);
    assert.match(step.run,
      /authorized_at[\s\S]*--selector "\$VERCEL_PRODUCTION_ORIGIN"[\s\S]*--mutation-control-output[\s\S]*--mutation-control[\s\S]*vercel promote/u,
      `${step.name} must bind post-authorization provider mutation control before its one mutation`);
  }
  assert.match(text, /owner-dispatch-run\.raw\.json/u);
  assert.match(text, /production-environment\.raw\.json/u);
  assert.match(text, /indexerEvidence\.auditDigest/u);
  assert.match(text, /publicAuthorization:false/u);
  const vercelConfig = JSON.parse(await readFile(path.resolve("vercel.json"), "utf8"));
  assert.deepEqual(vercelConfig.git, { deploymentEnabled: false },
    "Git pushes must not bypass the tracked stage/promote control plane");
  const { git: _gitReleaseControl, ...frozenRoutingDefaults } = vercelConfig;
  assert.equal(canonicalSha256(
    "programmable.developers.vercel-routing-defaults.v1",
    frozenRoutingDefaults,
  ), "sha256:c7f50c104e54e4c0496abce63bb218c4f2edb3ebf71d8b640b09166c06fe1074",
  "V1/V2 routes, asset defaults, redirects, and security headers must remain byte-semantic stable");
  const releaseCliSource = await readFile(path.resolve("scripts/vercel-release.mjs"), "utf8");
  assert.match(releaseCliSource,
    /exactTrackedJson[\s\S]*metadata\.size > MAX_JSON_BYTES/u,
    "tracked release inputs need a local size budget independent of public provider lengths");
  assert.match(releaseCliSource,
    /authorizePlannedDeployCommand[\s\S]*validateGitHubOwnerDispatchAuthorization[\s\S]*createPlannedDeployAuthorization/u,
    "planned mutations must reuse the canonical owner and environment validator");
  assert.match(releaseCliSource,
    /GITHUB_EVENT_NAME[\s\S]*workflow_dispatch[\s\S]*GITHUB_REF_PROTECTED[\s\S]*RELEASE_CONTROL_ENVIRONMENT[\s\S]*production/u,
    "planned mutation authorization must require the protected manual production environment");
  const packageManifest = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.resolve("package-lock.json"), "utf8"));
  assert.equal(packageManifest.devDependencies.vercel, "59.10.0");
  assert.deepEqual(packageLock.packages[""].devDependencies,
    packageManifest.devDependencies);
  for (const [packagePath, version] of Object.entries({
    "node_modules/@tootallnate/once": "2.0.1",
    "node_modules/@vercel/node/node_modules/path-to-regexp": "6.3.0",
    "node_modules/js-yaml": "4.3.1",
    "node_modules/minimatch": "10.2.6",
    "node_modules/path-to-regexp": "8.4.2",
    "node_modules/smol-toml": "1.8.0",
    "node_modules/tar": "7.5.22",
    "node_modules/undici": "6.28.0",
    "node_modules/vercel": "59.10.0",
  })) {
    assert.equal(packageLock.packages[packagePath]?.version, version,
      `${packagePath} must resolve to the audited release-tool version`);
  }
  const providerCapture = await readFile(
    path.resolve("scripts/vercel-provider-capture.mjs"), "utf8",
  );
  assert.match(providerCapture,
    /path\.join\(ROOT, "node_modules", "\.bin", "vercel"\)/u);
  assert.doesNotMatch(providerCapture, /\bnpx\b|--token\b/u);
  assert.match(providerCapture,
    /DEPLOYMENT_ID\.test\(selector\)[\s\S]*assertVercelStagedDeployment\(deployment/u,
    "planned capture must allow provider aliases while rejecting formal production domains");
  assert.match(providerCapture,
    /protectionOutput[\s\S]*createStageProtectionEvidence/u,
    "planned candidates must use the same provider protection proof as live stages");
  assert.match(providerCapture,
    /probeGeneratedDeploymentProtection[\s\S]*createStageProtectionEvidence/u,
    "generated deployment protection propagation must remain bounded before strict validation");
  assert.match(providerCapture,
    /inspect", PRODUCTION_ORIGIN[\s\S]*createVercelPublicDeploymentResolution/u,
    "public-origin resolution evidence must come from a direct public-domain inspection");
  assert.match(providerCapture,
    /deploymentId = inspect\.id[\s\S]*\/v13\/deployments\/\$\{deploymentId\}[\s\S]*publicInspect[\s\S]*\/v9\/projects\/\$\{projectId\}\/domains[\s\S]*\/v4\/aliases\/\$\{new URL\(VERCEL_PRODUCTION_ORIGIN\)\.hostname\}[\s\S]*\/v4\/aliases\/\$\{new URL\(PRODUCTION_ORIGIN\)\.hostname\}[\s\S]*providerReread[\s\S]*createVercelProductionBinding/u,
    "production capture must end its two-domain evidence window with a provider-domain reread");
  for (const operation of ["promote", "rollback"]) {
    const label = operation === "promote" ? "promotion" : "rollback";
    const smokeIndex = text.indexOf(`Post-${label} public smoke without bypass`);
    const recaptureIndex = text.indexOf(
      `Reconfirm both production domains after ${label} smoke`,
    );
    const receiptIndex = text.indexOf(`Seal immutable ${label} receipt`);
    assert.equal(smokeIndex >= 0 && smokeIndex < recaptureIndex && recaptureIndex < receiptIndex,
      true, `${operation} receipt must seal a provider recapture taken after public smoke`);
    assert.match(text.slice(recaptureIndex, receiptIndex + 1_000),
      new RegExp(`${operation}/production-deployment-after-smoke\\.json`, "u"));
  }
  const chainSmoke = await readFile(path.resolve("scripts/chain-4663-live-smoke.mjs"), "utf8");
  assert.doesNotMatch(chainSmoke, /planned\/public smoke may not use a Vercel protection bypass/u);
  assert.match(chainSmoke,
    /VERCEL_AUTOMATION_BYPASS_SECRET[\s\S]*hostname\.endsWith\("\.vercel\.app"\)/u,
    "a planned bypass must remain limited to a secret-authenticated generated Vercel origin");
  const repositoryCheck = await readFile(path.resolve("scripts/check.mjs"), "utf8");
  assert.match(repositoryCheck, /git.*ls-files.*--error-unmatch/su,
    "ordinary repository checks must require tracked phase evidence");
  assert.match(repositoryCheck,
    /canonicalTrackedBundlePresent[\s\S]*metadata\.size > MAX_RELEASE_BUNDLE_BYTES/u,
    "ordinary checks need a local release-bundle budget without trusting public byte lengths");
  assert.match(repositoryCheck,
    /promotionBundlePresent[\s\S]*\?[\s\S]*"promotion"[\s\S]*stageBundlePresent[\s\S]*"stage"/u,
    "ordinary repository checks must select Phase B over Phase A once both are tracked");
  assert.match(repositoryCheck, /Phase A cannot be selected after.*Phase-B bundle exists/u,
    "release checks must not let Phase A inherit Phase-B public authority");
  const runbook = await readFile(path.resolve("docs/vercel-release-control.md"), "utf8");
  for (const required of [
    "`production`", "@hazarxyz", "258789013", "protected branches only",
    "administrator bypass disabled", "VERCEL_TOKEN", "VERCEL_ORG_ID",
    "VERCEL_PROJECT_ID", "VERCEL_AUTOMATION_BYPASS_SECRET",
  ]) {
    assert.match(runbook, new RegExp(required, "u"),
      `release runbook must document ${required}`);
  }
  assert.match(runbook, /no established distinct release reviewer/u,
    "release runbook must explain the repository-grounded single-owner boundary");
  assert.match(runbook,
    /operation: verify-planned[\s\S]*never creates a Vercel deployment[\s\S]*publicWrites:false/u,
    "release runbook must preserve the non-mutating planned/null boundary");
  assert.match(runbook,
    /programmableReleaseMode=planned[\s\S]*must not carry `programmableStageBundleDigest`/u,
    "planned deployment documentation must bind source without phase evidence");
  assert.match(runbook,
    /operation: deploy-planned[\s\S]*--skip-domain[\s\S]*vercel promote[\s\S]*publicWrites:false/u,
    "runbook must document candidate-first planned publication and its read-only boundary");
  assert.match(runbook,
    /external Vercel deployment and alias mutation[\s\S]*can_admins_bypass:true[\s\S]*stops the job/u,
    "runbook must distinguish external provider mutation from Robinhood write authority");
  assert.match(runbook,
    /both formal domains[\s\S]*\/v4\/aliases[\s\S]*that exact[\s\S]*deployment ID[\s\S]*redirect:null[\s\S]*deletedAt:null/u,
    "runbook must document the exact two-domain provider and alias binding");
  assert.match(runbook,
    /prod_deployment_urls_and_all_previews[\s\S]*--protection-bypass true[\s\S]*public[\s\S]{0,80}origin[\s\S]*--protection-bypass false/u,
    "runbook must keep generated candidates protected while public reads use no bypass");
  assert.match(runbook,
    /not an atomic Vercel compare-and-swap[\s\S]*external Vercel writes remain an explicit[\s\S]*operator boundary/u,
    "runbook must scope at-most-once to the workflow rather than claim global ABA safety");
  assert.match(await readFile(path.resolve(".gitignore"), "utf8"),
    /^\.release-evidence\/$/mu,
    "runtime evidence must stay untracked without weakening canonical evidence paths");
});

test("pins recovery to immutable intent and exact old-target-third classification", async () => {
  const workflowPath = path.resolve(".github/workflows/vercel-release-recovery.yml");
  const text = await readFile(workflowPath, "utf8");
  const document = parseYaml(text);
  assert.equal(document.name, "Vercel release recovery");
  assert.deepEqual(Object.keys(document.jobs), ["recover"]);
  assert.deepEqual(document.permissions, { contents: "read", actions: "read" });
  assert.equal(document.concurrency.group, "developers-vercel-release-control");
  assert.equal(document.concurrency["cancel-in-progress"], false);
  assert.deepEqual(document.on.workflow_dispatch.inputs.operation.options,
    ["deploy-planned", "promote", "rollback"]);
  const job = document.jobs.recover;
  assert.equal(job.environment, "production");
  for (const required of [
    "github.repository == 'programmablehq/Developers'",
    "github.ref == 'refs/heads/main'",
    "github.ref_protected == true",
    "github.actor == 'hazarxyz'",
    "github.actor_id == '258789013'",
    "github.triggering_actor == 'hazarxyz'",
  ]) assert.equal(job.if.includes(required), true);
  assert.equal(job.env, undefined);
  const actionRefs = [...text.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/gu)]
    .map((match) => match[1]);
  assert.equal(actionRefs.length > 0, true);
  assert.equal(actionRefs.every((reference) => /^[0-9a-f]{40}$/u.test(reference)), true);
  assert.doesNotMatch(text, /\bnpx\b|npm exec|--package=|--token\b/u);
  assert.doesNotMatch(text, /vercel deploy/u,
    "recovery may never create a replacement candidate");
  const names = job.steps.map(({ name }) => name);
  assert.equal(names.indexOf("Download exact immutable mutation intent artifact") <
    names.indexOf("Reject operation or artifact substitution"), true);
  assert.equal(names.indexOf("Prepare fresh owner-authorized recovery attempt") <
    names.indexOf("Upload immutable recovery attempt before any public mutation"), true);
  assert.equal(names.indexOf("Upload immutable recovery attempt before any public mutation") <
    names.indexOf("Recover exact old state or verify exact target without a second mutation"),
  true);
  const substitution = job.steps.find(({ name }) =>
    name === "Reject operation or artifact substitution");
  assert.match(substitution.run,
    /--artifact-archive[\s\S]*workflow\.runId[\s\S]*workflow\.runAttempt[\s\S]*create-public-mutation-intent[\s\S]*cmp --silent/u);
  assert.doesNotMatch(substitution.run, /marker=/u,
    "an intent marker must not become a crash-stranding retry lock");
  const attempt = job.steps.find(({ name }) =>
    name === "Prepare fresh owner-authorized recovery attempt");
  assert.equal(attempt.env.VERCEL_AUTOMATION_BYPASS_SECRET, undefined);
  assert.equal(attempt.env.RELEASE_SMOKE_BYPASS_SECRET,
    "${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}");
  assert.match(attempt.run,
    /--selector "\$VERCEL_PRODUCTION_ORIGIN"[\s\S]*--protection-output[\s\S]*--protection-bypass true/u);
  assert.match(attempt.run,
    /VERCEL_AUTOMATION_BYPASS_SECRET="\$smoke_bypass_secret"[\s\S]*smoke:chain-4663/u);
  assert.match(attempt.run,
    /actions\/runs\/\$GITHUB_RUN_ID[\s\S]*environments\/production[\s\S]*create-recovery-attempt/u);
  const boundary = job.steps.find(({ name }) =>
    name === "Recover exact old state or verify exact target without a second mutation");
  assert.equal(boundary.env.RELEASE_CONTROL_ENVIRONMENT, "production");
  assert.equal(boundary.env.VERCEL_AUTOMATION_BYPASS_SECRET, undefined);
  assert.equal(boundary.env.RELEASE_SMOKE_BYPASS_SECRET,
    "${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}");
  assert.match(boundary.run,
    /--selector "\$target_id"[\s\S]*--protection-output[\s\S]*--protection-bypass true/u);
  assert.match(boundary.run,
    /VERCEL_AUTOMATION_BYPASS_SECRET="\$smoke_bypass_secret"[\s\S]*smoke:chain-4663/u);
  for (const scoped of [attempt, boundary]) {
    assert.match(scoped.run,
      /unset RELEASE_GITHUB_TOKEN RELEASE_VERCEL_TOKEN RELEASE_SMOKE_BYPASS_SECRET/u);
    assert.match(scoped.run, /VERCEL_TOKEN="\$vercel_token" npm run capture:vercel-provider/u);
    assert.match(scoped.run, /Authorization: Bearer \$github_token/u);
  }
  assert.match(boundary.run,
    /actions\/runs\/\$GITHUB_RUN_ID[\s\S]*environments\/production[\s\S]*authorized_at[\s\S]*--selector "\$VERCEL_PRODUCTION_ORIGIN"[\s\S]*--mutation-control-output[\s\S]*create-recovery-readiness[\s\S]*--mutation-control/u);
  assert.match(boundary.run,
    /attempt-artifacts\.raw\.json[\s\S]*attempt-artifact\.zip[\s\S]*create-recovery-attempt-provenance[\s\S]*--attempt-provenance/u,
    "recovery readiness must bind the provider-authenticated uploaded attempt bytes");
  assert.match(boundary.run,
    /create-recovery-attempt-provenance[\s\S]*actions\/runs\/\$GITHUB_RUN_ID[\s\S]*environments\/production[\s\S]*authorized_at[\s\S]*--selector "\$VERCEL_PRODUCTION_ORIGIN"/u,
    "final owner/environment observations must follow archive verification and immediately precede provider readiness");
  assert.match(boundary.run,
    /case "\$classification"[\s\S]*old\)[\s\S]*vercel promote[\s\S]*target\)[\s\S]*no second Vercel mutation/u);
  assert.equal((boundary.run.match(/vercel promote/gmu) ?? []).length, 1,
    "recovery may perform at most one exact target mutation");
  assert.match(text,
    /create-recovered-promotion-receipt[\s\S]*developers-vercel-promotion-\$\{\{ github\.run_id \}\}/u,
    "recovered promotion must yield the canonical artifact consumed by rollback");
  assert.match(text,
    /create-planned-deploy-receipt[\s\S]*create-recovered-promotion-receipt[\s\S]*create-recovered-rollback-receipt/u);
});

test("hashes build output deterministically and rejects symlinks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "developers-vercel-build-"));
  try {
    await mkdir(path.join(root, "static"), { recursive: true });
    await writeFile(path.join(root, "static", "index.txt"), "programmable\n");
    const first = await hashBuildOutput(root);
    const second = await hashBuildOutput(root);
    assert.equal(first.digest, second.digest);
    await symlink(path.join(root, "static", "index.txt"), path.join(root, "link"));
    await assert.rejects(() => hashBuildOutput(root), /symlink/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
