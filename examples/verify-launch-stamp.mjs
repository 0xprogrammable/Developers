#!/usr/bin/env node

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { keccak256 } from "../server/keccak.js";

const DEFAULT_DISCOVERY_URL =
  "https://developers.programmable.family/.well-known/programmable.json";
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const QUERY_KINDS = new Set(["token", "pool", "component"]);

export async function verifyLaunchStamp({
  kind,
  values,
  rpcUrl = process.env.PROGRAMMABLE_RPC_URL,
  discoveryUrl =
    process.env.PROGRAMMABLE_DISCOVERY_URL || DEFAULT_DISCOVERY_URL,
  blockTag = process.env.PROGRAMMABLE_BLOCK_TAG || "finalized",
}) {
  validateQuery(kind, values);

  const discovery = await fetchJson(discoveryUrl, "discovery document");
  const manifest = await fetchJson(discovery.manifestUrl, "deployment manifest");
  const router = manifest.launchStampRouter;
  const unavailableReason = activationUnavailableReason(router, manifest);

  if (unavailableReason) {
    return outcome("unavailable", unavailableReason, {
      query: { kind, values },
      claim: "provenance-only",
    });
  }
  if (!rpcUrl) {
    return outcome("indeterminate", "missing-rpc-url", {
      query: { kind, values },
      claim: "provenance-only",
    });
  }

  try {
    return await verifyActiveRouter({
      kind,
      values,
      rpcUrl,
      blockTag,
      manifest,
      router,
    });
  } catch (error) {
    return outcome("indeterminate", errorCode(error), {
      query: { kind, values },
      claim: "provenance-only",
    });
  }
}

async function verifyActiveRouter({
  kind,
  values,
  rpcUrl,
  blockTag,
  manifest,
  router,
}) {
  const callRpc = createRpcClient(rpcUrl);
  const rpcChainId = parseQuantity(await callRpc("eth_chainId", []), "chain ID");
  if (rpcChainId !== BigInt(manifest.chainId)) fail("chain-mismatch");

  const requestedBlock = normalizeBlockTag(blockTag);
  const block = await callRpc("eth_getBlockByNumber", [requestedBlock, false]);
  if (!block || !isHash32(block.hash) || !isQuantity(block.number)) {
    fail("canonical-block-unavailable");
  }
  const blockNumber = parseQuantity(block.number, "block number");
  if (requestedBlock !== "finalized") {
    const chainHead = parseQuantity(
      await callRpc("eth_blockNumber", []),
      "chain head",
    );
    const requiredConfirmations = BigInt(router.finalityConfirmations);
    if (
      chainHead < blockNumber ||
      chainHead - blockNumber < requiredConfirmations
    ) {
      fail("block-finality-insufficient");
    }
  }
  const startBlock = BigInt(router.startBlock);
  if (blockNumber < startBlock) fail("block-before-router-start");
  if (
    router.status === "retired" &&
    (!decimal(router.endBlock) || blockNumber > BigInt(router.endBlock))
  ) {
    fail("block-outside-router-range");
  }
  const canonicalBlock = {
    blockHash: block.hash.toLowerCase(),
    requireCanonical: true,
  };

  const runtimeCode = await callRpc("eth_getCode", [router.address, canonicalBlock]);
  if (!isBytecode(runtimeCode)) fail("router-code-unavailable");
  const runtimeCodeHash = keccak256(hexBytes(runtimeCode));
  if (runtimeCodeHash !== router.runtimeCodeHash.toLowerCase()) {
    fail("router-runtime-mismatch");
  }

  const { value: abi, sha256 } = await fetchJsonWithSha256(
    router.abiUrl,
    "Router ABI",
  );
  if (sha256 !== router.abiSha256) fail("router-abi-hash-mismatch");
  if (!Array.isArray(abi)) fail("router-abi-malformed");
  validatePublishedAbi(abi, router);
  await validateImmutableBindings({
    callRpc,
    block: canonicalBlock,
    abi,
    manifest,
    router,
  });

  const getter = router.getters[kind];
  const args = kind === "pool" ? values : [values[0]];
  const launchId = await readDescribedFunction({
    callRpc,
    address: router.address,
    block: canonicalBlock,
    abi,
    descriptor: getter,
    args,
  });
  if (!isHash32(launchId)) fail("launch-id-malformed");
  if (launchId === ZERO_BYTES32) {
    return outcome("not-stamped", "zero-launch-id", {
      chainId: manifest.chainId,
      router: router.address,
      routerStartBlock: router.startBlock,
      block: { number: blockNumber.toString(), hash: block.hash.toLowerCase() },
      query: { kind, values },
      launchId: null,
      launchKind: null,
      category: null,
      publicLabel: null,
      claim: "provenance-only",
    });
  }

  const record = await readDescribedFunction({
    callRpc,
    address: router.address,
    block: canonicalBlock,
    abi,
    descriptor: router.getters.record,
    args: [launchId],
  });
  validateRecord(record, { kind, values });
  const classification = classifyLaunchKind(record.kind);
  validateRouteRecord(record, classification, router.bindings);

  const currentRouteCode = await callRpc("eth_getCode", [
    record.routeLauncher,
    canonicalBlock,
  ]);
  const observedRouteRuntime =
    isBytecode(currentRouteCode) && currentRouteCode !== "0x"
      ? keccak256(hexBytes(currentRouteCode))
      : null;

  let componentRuntime = null;
  if (kind === "token" || kind === "component") {
    const proof = await readDescribedFunction({
      callRpc,
      address: router.address,
      block: canonicalBlock,
      abi,
      descriptor: router.getters.stampProof,
      args: [values[0]],
    });
    if (proof?.launchId !== launchId || proof?.stampHash !== record.stampHash) {
      fail("stamp-proof-mismatch");
    }
    const recorded = await readDescribedFunction({
      callRpc,
      address: router.address,
      block: canonicalBlock,
      abi,
      descriptor: router.getters.componentRuntimeCodeHash,
      args: [values[0]],
    });
    if (!isHash32(recorded) || recorded === ZERO_BYTES32) {
      fail("component-runtime-record-missing");
    }
    const currentCode = await callRpc("eth_getCode", [values[0], canonicalBlock]);
    componentRuntime = {
      recorded,
      observed:
        isBytecode(currentCode) && currentCode !== "0x"
          ? keccak256(hexBytes(currentCode))
          : null,
    };
    componentRuntime.matches =
      componentRuntime.observed === null
        ? null
        : componentRuntime.observed === componentRuntime.recorded;
  }

  return outcome("stamped", "canonical-router-record", {
    chainId: manifest.chainId,
    router: router.address,
    routerStartBlock: router.startBlock,
    block: { number: blockNumber.toString(), hash: block.hash.toLowerCase() },
    query: { kind, values },
    launchId,
    launchKind: classification.kind,
    category: classification.category,
    publicLabel: classification.publicLabel,
    stampHash: record.stampHash,
    route: {
      launcher: record.routeLauncher,
      recordedRuntimeCodeHash: record.routeLauncherRuntimeCodeHash,
      observedRuntimeCodeHash: observedRouteRuntime,
      runtimeMatches:
        observedRouteRuntime === null
          ? null
          : observedRouteRuntime === record.routeLauncherRuntimeCodeHash,
      routePayloadHash: record.routePayloadHash,
      expectedResultHash: record.expectedResultHash,
      permitDigest: record.permitDigest,
    },
    componentRuntime,
    claim: "provenance-only",
  });
}

function activationUnavailableReason(router, manifest) {
  if (!router || typeof router !== "object") return "router-not-published";
  if (router.status === "prelaunch") return "router-prelaunch";
  if (router.status !== "live" && router.status !== "retired") {
    return "router-status-unsupported";
  }
  if (
    !address(router.address) ||
    !decimal(router.startBlock) ||
    !isHash32(router.runtimeCodeHash) ||
    !isSha256(router.abiSha256) ||
    !httpsOrLocalUrl(router.abiUrl) ||
    !Number.isInteger(router.finalityConfirmations) ||
    router.finalityConfirmations <= 0 ||
    typeof router.atomicSignature !== "string" ||
    !selector(router.atomicSelector)
  ) {
    return "router-activation-incomplete";
  }
  if (
    router.status === "retired" &&
    (!decimal(router.endBlock) || BigInt(router.endBlock) < BigInt(router.startBlock))
  ) {
    return "router-retirement-range-invalid";
  }
  if (!completeBindings(router.bindings)) {
    return "router-bindings-incomplete";
  }
  if (
    !completeCanaryEvidence(router.canaryEvidence, router) ||
    !completeClassicCanaryEvidence(
      router.classicCanaryEvidence,
      router,
      manifest,
    )
  ) {
    return "router-canary-evidence-incomplete";
  }
  const requiredGetters = [
    router.getters?.chainId,
    router.getters?.permitAuthority,
    router.getters?.permitAuthorityRuntimeCodeHash,
    router.getters?.graphFactory,
    router.getters?.graphFactoryRuntimeCodeHash,
    router.getters?.poolManager,
    router.getters?.poolManagerRuntimeCodeHash,
    router.getters?.token,
    router.getters?.pool,
    router.getters?.component,
    router.getters?.componentRuntimeCodeHash,
    router.getters?.record,
    router.getters?.stampProof,
  ];
  if (requiredGetters.some((value) => !getterDescriptor(value))) {
    return "router-getters-incomplete";
  }
  if (
    !eventDescriptor(router.events?.launchStamped) ||
    !eventDescriptor(router.events?.launchRouteStamped) ||
    !eventDescriptor(router.events?.componentStamped)
  ) {
    return "router-events-incomplete";
  }
  return null;
}

function completeCanaryEvidence(evidence, router) {
  if (!evidence || typeof evidence !== "object") return false;
  if (
    evidence.finality !== "finalized" ||
    evidence.routeCoverage?.customGraphOnchainCanary !== true ||
    evidence.routeCoverage?.classicOnchainCanary !== true ||
    !evidence.source ||
    typeof evidence.source !== "object" ||
    !remoteHttpsUrl(evidence.source.sourceRepository) ||
    !sourceCommit(evidence.source.sourceCommit) ||
    typeof evidence.source.commitSubject !== "string" ||
    evidence.source.commitSubject.trim().length === 0 ||
    !nonzeroHash32(evidence.transactionHash) ||
    !decimal(evidence.blockNumber) ||
    BigInt(evidence.blockNumber) < BigInt(router.startBlock) ||
    !nonzeroHash32(evidence.blockHash) ||
    !nonzeroHash32(evidence.launchId) ||
    !nonzeroHash32(evidence.stampHash) ||
    evidence.launchKind !== 1 ||
    !isSha256(evidence.evidenceFileSha256) ||
    !isSha256(evidence.evidenceLineSha256)
  ) {
    return false;
  }

  const components = evidence.components;
  const componentAddresses = [
    components?.initializer,
    components?.token,
    components?.hook,
  ];
  const normalizedComponents = componentAddresses.map((value) =>
    nonzeroAddress(value) ? normalizeAddress(value) : null,
  );
  if (
    normalizedComponents.some((value) => value === null) ||
    new Set(normalizedComponents).size !== 3
  ) {
    return false;
  }

  if (
    !evidence.pool ||
    typeof evidence.pool !== "object" ||
    !nonzeroAddress(evidence.pool.poolManager) ||
    normalizeAddress(evidence.pool.poolManager) !==
      normalizeAddress(router.bindings.poolManager) ||
    !nonzeroHash32(evidence.pool.poolId) ||
    !positiveDecimal(evidence.pool.activeLiquidity) ||
    !evidence.lpPosition ||
    typeof evidence.lpPosition !== "object" ||
    !nonzeroAddress(evidence.lpPosition.positionManager) ||
    !positiveDecimal(evidence.lpPosition.tokenId) ||
    !nonzeroAddress(evidence.lpPosition.owner) ||
    !evidence.platformFee ||
    typeof evidence.platformFee !== "object" ||
    !Number.isSafeInteger(evidence.platformFee.feePips) ||
    evidence.platformFee.feePips < 0 ||
    evidence.platformFee.feePips > 1_000_000 ||
    !nonzeroAddress(evidence.platformFee.recipient) ||
    !positiveDecimal(evidence.tokenTotalSupply)
  ) {
    return false;
  }

  if (!Array.isArray(evidence.stampProofs) || evidence.stampProofs.length !== 3) {
    return false;
  }
  const proofComponents = [];
  for (const proof of evidence.stampProofs) {
    const component = normalizeAddress(proof?.component);
    if (
      component === null ||
      !sameHash32(proof?.launchId, evidence.launchId) ||
      !sameHash32(proof?.stampHash, evidence.stampHash)
    ) {
      return false;
    }
    proofComponents.push(component);
  }
  return (
    new Set(proofComponents).size === 3 &&
    normalizedComponents.every((component) => proofComponents.includes(component))
  );
}

function completeClassicCanaryEvidence(evidence, router, manifest) {
  if (!evidence || typeof evidence !== "object") return false;
  const release = activeClassicV4Deployment(manifest);
  if (!release) return false;
  const publication = evidence.source?.manifestPublication;
  const expectedPublicationUrl = rawGithubUrl(
    evidence.source?.sourceRepository,
    publication?.commit,
    publication?.path,
  );

  if (
    evidence.finality !== "finalized" ||
    !evidence.source ||
    typeof evidence.source !== "object" ||
    !remoteHttpsUrl(evidence.source.sourceRepository) ||
    evidence.source.sourceRepository !== release.evidence.sourceRepository ||
    !sourceCommit(evidence.source.releaseCommit) ||
    evidence.source.releaseCommit !== release.evidence.sourceCommit ||
    !sourceCommit(evidence.source.releaseTree) ||
    !publication ||
    typeof publication !== "object" ||
    !sourceCommit(publication.commit) ||
    !sourceCommit(publication.tree) ||
    !releaseManifestPath(publication.path) ||
    !remoteHttpsUrl(publication.url) ||
    expectedPublicationUrl === null ||
    publication.url !== expectedPublicationUrl ||
    !isSha256(publication.sha256) ||
    !nonzeroHash32(evidence.transactionHash) ||
    !decimal(evidence.blockNumber) ||
    BigInt(evidence.blockNumber) < BigInt(router.startBlock) ||
    BigInt(evidence.blockNumber) < BigInt(release.startBlock) ||
    !nonzeroHash32(evidence.blockHash) ||
    !Number.isSafeInteger(evidence.transactionIndex) ||
    evidence.transactionIndex < 0 ||
    !nonzeroHash32(evidence.launchId) ||
    !nonzeroHash32(evidence.stampHash) ||
    evidence.launchKind !== 2
  ) {
    return false;
  }

  if (
    !evidence.route ||
    typeof evidence.route !== "object" ||
    !nonzeroAddress(evidence.route.launcher) ||
    normalizeAddress(evidence.route.launcher) !==
      normalizeAddress(release.contracts.launcher) ||
    !nonzeroHash32(evidence.route.launcherRuntimeCodeHash) ||
    !sameHash32(
      evidence.route.launcherRuntimeCodeHash,
      release.evidence.launcherRuntimeCodeHash,
    ) ||
    !nonzeroHash32(evidence.route.routePayloadHash) ||
    !nonzeroHash32(evidence.route.expectedResultHash) ||
    !nonzeroHash32(evidence.route.permitDigest)
  ) {
    return false;
  }

  const expectedKinds = new Map([
    ["positionRecipient", 0],
    ["rewardVault", 0],
    ["hook", 2],
    ["token", 1],
  ]);
  if (!Array.isArray(evidence.components) || evidence.components.length !== 4) {
    return false;
  }
  const componentsByRole = new Map();
  const componentAddresses = new Set();
  for (const component of evidence.components) {
    const expectedKind = expectedKinds.get(component?.role);
    const normalized = normalizeAddress(component?.address);
    if (
      expectedKind === undefined ||
      component?.kind !== expectedKind ||
      normalized === null ||
      !nonzeroAddress(component.address) ||
      !nonzeroHash32(component.runtimeCodeHash) ||
      componentsByRole.has(component.role) ||
      componentAddresses.has(normalized)
    ) {
      return false;
    }
    componentsByRole.set(component.role, component);
    componentAddresses.add(normalized);
  }
  const hook = componentsByRole.get("hook");
  const token = componentsByRole.get("token");
  const positionRecipient = componentsByRole.get("positionRecipient");
  if (
    componentsByRole.size !== expectedKinds.size ||
    !hook ||
    !token ||
    !positionRecipient ||
    normalizeAddress(hook.address) !== normalizeAddress(release.contracts.hook) ||
    !nonzeroAddress(token.address)
  ) {
    return false;
  }

  const configuredFeeBps = manifest?.platformFee?.rateBps;
  if (
    !evidence.pool ||
    typeof evidence.pool !== "object" ||
    !nonzeroAddress(evidence.pool.poolManager) ||
    normalizeAddress(evidence.pool.poolManager) !==
      normalizeAddress(router.bindings.poolManager) ||
    !nonzeroHash32(evidence.pool.poolId) ||
    !positiveDecimal(evidence.pool.activeLiquidity) ||
    !evidence.lpPosition ||
    typeof evidence.lpPosition !== "object" ||
    !nonzeroAddress(evidence.lpPosition.positionManager) ||
    !positiveDecimal(evidence.lpPosition.tokenId) ||
    !nonzeroAddress(evidence.lpPosition.owner) ||
    normalizeAddress(evidence.lpPosition.owner) !==
      normalizeAddress(positionRecipient.address) ||
    !evidence.platformFee ||
    typeof evidence.platformFee !== "object" ||
    !Number.isSafeInteger(evidence.platformFee.rateBps) ||
    evidence.platformFee.rateBps < 0 ||
    evidence.platformFee.rateBps > 10_000 ||
    !decimal(configuredFeeBps) ||
    BigInt(evidence.platformFee.rateBps) !== BigInt(configuredFeeBps) ||
    !nonzeroAddress(evidence.platformFee.recipient) ||
    normalizeAddress(evidence.platformFee.recipient) !==
      normalizeAddress(manifest.platformFee.recipient) ||
    !positiveDecimal(evidence.tokenTotalSupply)
  ) {
    return false;
  }

  const verification = evidence.verification;
  if (
    !verification ||
    typeof verification !== "object" ||
    !decimal(verification.verificationBlock) ||
    BigInt(verification.verificationBlock) < BigInt(evidence.blockNumber) ||
    !nonzeroHash32(verification.verificationBlockHash) ||
    !nonzeroHash32(verification.releaseManifestDigest) ||
    !nonzeroHash32(verification.releaseBindingDigest) ||
    !nonzeroHash32(verification.deploymentEvidenceDigest) ||
    !nonzeroHash32(verification.sourceEvidenceDigest) ||
    !nonzeroHash32(verification.lifecycleEvidenceDigest)
  ) {
    return false;
  }
  return true;
}

function activeClassicV4Deployment(manifest) {
  if (!Array.isArray(manifest?.deployments)) return null;
  const matches = manifest.deployments.filter(
    (deployment) =>
      deployment?.category === "classic" &&
      deployment?.modelId === "classic" &&
      deployment?.modelVersion === "4" &&
      deployment?.lifecycle === "current" &&
      deployment?.discovery === "enabled" &&
      decimal(deployment?.startBlock) &&
      nonzeroAddress(deployment?.contracts?.launcher) &&
      nonzeroAddress(deployment?.contracts?.hook) &&
      remoteHttpsUrl(deployment?.evidence?.sourceRepository) &&
      sourceCommit(deployment?.evidence?.sourceCommit) &&
      nonzeroHash32(deployment?.evidence?.launcherRuntimeCodeHash),
  );
  return matches.length === 1 ? matches[0] : null;
}

function completeBindings(bindings) {
  return (
    nonzeroAddress(bindings?.permitAuthority) &&
    nonzeroHash32(bindings?.permitAuthorityRuntimeCodeHash) &&
    nonzeroAddress(bindings?.graphFactory) &&
    nonzeroHash32(bindings?.graphFactoryRuntimeCodeHash) &&
    nonzeroAddress(bindings?.poolManager) &&
    nonzeroHash32(bindings?.poolManagerRuntimeCodeHash)
  );
}

function validatePublishedAbi(abi, router) {
  for (const descriptor of Object.values(router.getters)) {
    if (!getterDescriptor(descriptor)) fail("getter-descriptor-invalid");
    const item = abi.find(
      (candidate) =>
        candidate?.type === "function" &&
        canonicalSignature(candidate) === descriptor.signature,
    );
    if (!item || functionSelector(item) !== descriptor.selector) {
      fail("getter-selector-mismatch");
    }
  }

  for (const descriptor of Object.values(router.events)) {
    if (!eventDescriptor(descriptor)) fail("event-descriptor-invalid");
    const item = abi.find(
      (candidate) =>
        candidate?.type === "event" &&
        canonicalSignature(candidate) === descriptor.signature,
    );
    if (!item || eventTopic(item) !== descriptor.topic0) {
      fail("event-topic-mismatch");
    }
    const indexedInputs = item.inputs
      .filter(({ indexed }) => indexed)
      .map(({ name }) => name);
    if (JSON.stringify(indexedInputs) !== JSON.stringify(descriptor.indexedInputs)) {
      fail("event-indexed-layout-mismatch");
    }
  }

  const atomic = abi.find(
    (candidate) =>
      candidate?.type === "function" &&
      canonicalSignature(candidate) === router.atomicSignature,
  );
  if (
    !atomic ||
    atomic.stateMutability !== "payable" ||
    functionSelector(atomic) !== router.atomicSelector
  ) {
    fail("atomic-selector-mismatch");
  }
  const payableFunctions = abi.filter(
    (candidate) =>
      candidate?.type === "function" && candidate.stateMutability === "payable",
  );
  if (payableFunctions.length !== 1 || payableFunctions[0] !== atomic) {
    fail("unexpected-payable-router-function");
  }
}

async function validateImmutableBindings({
  callRpc,
  block,
  abi,
  manifest,
  router,
}) {
  const expected = [
    ["chainId", BigInt(manifest.chainId), "chain-id"],
    ["permitAuthority", router.bindings.permitAuthority, "address"],
    [
      "permitAuthorityRuntimeCodeHash",
      router.bindings.permitAuthorityRuntimeCodeHash,
      "hash",
    ],
    ["graphFactory", router.bindings.graphFactory, "address"],
    [
      "graphFactoryRuntimeCodeHash",
      router.bindings.graphFactoryRuntimeCodeHash,
      "hash",
    ],
    ["poolManager", router.bindings.poolManager, "address"],
    [
      "poolManagerRuntimeCodeHash",
      router.bindings.poolManagerRuntimeCodeHash,
      "hash",
    ],
  ];

  for (const [key, expectedValue, kind] of expected) {
    const observed = await readDescribedFunction({
      callRpc,
      address: router.address,
      block,
      abi,
      descriptor: router.getters[key],
      args: [],
    });
    if (
      (kind === "chain-id" && observed !== expectedValue) ||
      (kind === "address" && normalizeAddress(observed) !== normalizeAddress(expectedValue)) ||
      (kind === "hash" && observed !== expectedValue)
    ) {
      fail(`immutable-${key}-mismatch`);
    }
  }

  for (const [addressKey, hashKey] of [
    ["permitAuthority", "permitAuthorityRuntimeCodeHash"],
    ["graphFactory", "graphFactoryRuntimeCodeHash"],
    ["poolManager", "poolManagerRuntimeCodeHash"],
  ]) {
    const code = await callRpc("eth_getCode", [router.bindings[addressKey], block]);
    if (!isBytecode(code) || code === "0x" || keccak256(hexBytes(code)) !== router.bindings[hashKey]) {
      fail(`binding-${addressKey}-runtime-mismatch`);
    }
  }
}

async function readDescribedFunction({
  callRpc,
  address: target,
  block,
  abi,
  descriptor,
  args,
}) {
  if (!getterDescriptor(descriptor)) fail("getter-descriptor-invalid");
  const item = abi.find(
    (candidate) =>
      candidate?.type === "function" &&
      canonicalSignature(candidate) === descriptor.signature,
  );
  if (!item) fail("getter-abi-missing");
  const derivedSelector = functionSelector(item);
  if (derivedSelector !== descriptor.selector) fail("getter-selector-mismatch");
  const data = `${derivedSelector}${encodeArguments(item.inputs, args)}`;
  const result = await callRpc("eth_call", [{ to: target, data }, block]);
  return decodeOutputs(item.outputs, result);
}

function validateRecord(record, { kind, values }) {
  if (!record || typeof record !== "object") fail("stamp-record-malformed");
  if (!isHash32(record.stampHash) || record.stampHash === ZERO_BYTES32) {
    fail("stamp-record-empty");
  }
  for (const field of [
    "poolId",
    "poolKeyHash",
    "componentSetHash",
    "routePayloadHash",
    "routeLauncherRuntimeCodeHash",
    "expectedResultHash",
    "permitDigest",
  ]) {
    if (!isHash32(record[field]) || record[field] === ZERO_BYTES32) {
      fail(`stamp-record-${field}-missing`);
    }
  }
  for (const field of ["launchWallet", "token", "hook", "poolManager", "routeLauncher"]) {
    if (!address(record[field])) fail(`stamp-record-${field}-invalid`);
  }
  if (kind === "token" && normalizeAddress(record.token) !== normalizeAddress(values[0])) {
    fail("stamp-record-token-mismatch");
  }
  if (
    kind === "pool" &&
    (normalizeAddress(record.poolManager) !== normalizeAddress(values[0]) ||
      record.poolId?.toLowerCase() !== values[1].toLowerCase())
  ) {
    fail("stamp-record-pool-mismatch");
  }
}

function validateRouteRecord(record, classification, bindings) {
  if (normalizeAddress(record.poolManager) !== normalizeAddress(bindings.poolManager)) {
    fail("stamp-record-pool-manager-mismatch");
  }
  if (
    classification.kind === "CustomGraph" &&
    (normalizeAddress(record.routeLauncher) !== normalizeAddress(bindings.graphFactory) ||
      record.routeLauncherRuntimeCodeHash !== bindings.graphFactoryRuntimeCodeHash)
  ) {
    fail("custom-graph-route-binding-mismatch");
  }
}

function classifyLaunchKind(value) {
  const kind = typeof value === "bigint" ? value : BigInt(value);
  if (kind === 1n) {
    return {
      kind: "CustomGraph",
      category: "custom",
      publicLabel: "Programmable Custom",
    };
  }
  if (kind === 2n) {
    return {
      kind: "Classic",
      category: "classic",
      publicLabel: "Programmable Classic",
    };
  }
  fail("launch-kind-unknown");
}

function encodeArguments(inputs = [], values = []) {
  if (inputs.length !== values.length) fail("getter-argument-count-mismatch");
  return inputs.map((input, index) => encodeWord(input.type, values[index])).join("");
}

function encodeWord(type, value) {
  if (type === "address") {
    if (!address(value)) fail("query-address-invalid");
    return value.slice(2).toLowerCase().padStart(64, "0");
  }
  if (type === "bytes32") {
    if (!isHash32(value)) fail("query-bytes32-invalid");
    return value.slice(2).toLowerCase();
  }
  fail("getter-input-type-unsupported");
}

function decodeOutputs(outputs = [], value) {
  if (!/^0x(?:[0-9a-fA-F]{64})+$/.test(value ?? "")) {
    fail("getter-result-malformed");
  }
  const words = value.slice(2).match(/.{64}/g) ?? [];
  let cursor = 0;
  const decoded = outputs.map((output, index) => {
    const result = decodeStatic(output, words, cursor);
    cursor = result.cursor;
    return [output.name || String(index), result.value];
  });
  if (cursor !== words.length) fail("getter-result-size-mismatch");
  if (decoded.length === 1) return decoded[0][1];
  return Object.fromEntries(decoded);
}

function decodeStatic(parameter, words, cursor) {
  if (parameter.type === "tuple") {
    const entries = [];
    for (const [index, component] of (parameter.components ?? []).entries()) {
      const result = decodeStatic(component, words, cursor);
      cursor = result.cursor;
      entries.push([component.name || String(index), result.value]);
    }
    return { value: Object.fromEntries(entries), cursor };
  }
  const word = words[cursor];
  if (!word) fail("getter-result-truncated");
  if (parameter.type === "address") {
    if (!/^0{24}[0-9a-fA-F]{40}$/.test(word)) fail("getter-address-malformed");
    return { value: `0x${word.slice(24).toLowerCase()}`, cursor: cursor + 1 };
  }
  if (parameter.type === "bytes32") {
    return { value: `0x${word.toLowerCase()}`, cursor: cursor + 1 };
  }
  if (/^uint(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(parameter.type)) {
    return { value: BigInt(`0x${word}`), cursor: cursor + 1 };
  }
  if (parameter.type === "bool") {
    const numeric = BigInt(`0x${word}`);
    if (numeric !== 0n && numeric !== 1n) fail("getter-bool-malformed");
    return { value: numeric === 1n, cursor: cursor + 1 };
  }
  fail("getter-output-type-unsupported");
}

function canonicalSignature(item) {
  return `${item.name}(${(item.inputs ?? []).map(canonicalType).join(",")})`;
}

function canonicalType(parameter) {
  if (!parameter.type.startsWith("tuple")) return parameter.type;
  const suffix = parameter.type.slice("tuple".length);
  return `(${(parameter.components ?? []).map(canonicalType).join(",")})${suffix}`;
}

function functionSelector(item) {
  return keccak256(new TextEncoder().encode(canonicalSignature(item))).slice(0, 10);
}

function eventTopic(item) {
  return keccak256(new TextEncoder().encode(canonicalSignature(item)));
}

function createRpcClient(rpcUrl) {
  const url = checkedUrl(rpcUrl, "RPC URL", false);
  let id = 0;
  return async (method, params) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) fail(`rpc-http-${response.status}`);
    const payload = await response.json();
    if (payload?.error) fail(`rpc-error-${payload.error.code}`);
    if (!("result" in payload)) fail("rpc-result-missing");
    return payload.result;
  };
}

async function fetchJson(url, label) {
  const { value } = await fetchJsonWithSha256(url, label);
  return value;
}

async function fetchJsonWithSha256(url, label) {
  const parsed = checkedUrl(url, label, false);
  const response = await fetch(parsed, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) fail(`${slug(label)}-http-${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail(`${slug(label)}-json-malformed`);
  }
  return {
    value,
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

function checkedUrl(value, label, allowRemoteHttp) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${slug(label)}-invalid`);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password) fail(`${slug(label)}-credentials-forbidden`);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (allowRemoteHttp || local))) {
    fail(`${slug(label)}-https-required`);
  }
  return url;
}

function normalizeBlockTag(value) {
  if (value === "finalized") return value;
  if (decimal(value)) return quantity(BigInt(value));
  if (isQuantity(value)) return quantity(BigInt(value));
  fail("block-tag-must-be-finalized-or-explicit");
}

function validateQuery(kind, values) {
  if (!QUERY_KINDS.has(kind)) fail("query-kind-invalid");
  if (!Array.isArray(values)) fail("query-values-invalid");
  if (kind === "pool") {
    if (values.length !== 2 || !address(values[0]) || !isHash32(values[1])) {
      fail("pool-query-invalid");
    }
    return;
  }
  if (values.length !== 1 || !address(values[0])) fail(`${kind}-query-invalid`);
}

function getterDescriptor(value) {
  return (
    value &&
    typeof value.signature === "string" &&
    selector(value.selector) &&
    typeof value.result === "string"
  );
}

function eventDescriptor(value) {
  return (
    value &&
    typeof value.name === "string" &&
    typeof value.signature === "string" &&
    isHash32(value.topic0) &&
    Array.isArray(value.indexedInputs)
  );
}

function address(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function nonzeroAddress(value) {
  return address(value) && !/^0x0{40}$/i.test(value);
}

function normalizeAddress(value) {
  return address(value) ? value.toLowerCase() : null;
}

function decimal(value) {
  return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value);
}

function positiveDecimal(value) {
  return decimal(value) && BigInt(value) > 0n;
}

function isHash32(value) {
  return typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value);
}

function nonzeroHash32(value) {
  return isHash32(value) && value !== ZERO_BYTES32;
}

function sameHash32(left, right) {
  return (
    nonzeroHash32(left) &&
    nonzeroHash32(right) &&
    left.toLowerCase() === right.toLowerCase()
  );
}

function sourceCommit(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function releaseManifestPath(value) {
  return (
    typeof value === "string" &&
    value === "contracts/deployments/mainnet-classic-v4.json"
  );
}

function rawGithubUrl(sourceRepository, commit, path) {
  if (!sourceCommit(commit) || !releaseManifestPath(path)) return null;
  const match =
    typeof sourceRepository === "string"
      ? /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(sourceRepository)
      : null;
  if (!match) return null;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${commit}/${path}`;
}

function isSha256(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function selector(value) {
  return typeof value === "string" && /^0x[0-9a-f]{8}$/.test(value);
}

function isQuantity(value) {
  return typeof value === "string" && /^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(value);
}

function parseQuantity(value, label) {
  if (!isQuantity(value)) fail(`${slug(label)}-malformed`);
  return BigInt(value);
}

function quantity(value) {
  return `0x${value.toString(16)}`;
}

function isBytecode(value) {
  return typeof value === "string" && /^0x(?:[0-9a-fA-F]{2})*$/.test(value);
}

function hexBytes(value) {
  return Uint8Array.from(Buffer.from(value.slice(2), "hex"));
}

function httpsOrLocalUrl(value) {
  try {
    checkedUrl(value, "URL", false);
    return true;
  } catch {
    return false;
  }
}

function remoteHttpsUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function outcome(state, reason, details) {
  return { state, reason, ...details };
}

function errorCode(error) {
  return error instanceof VerificationFailure ? error.code : "verification-failed";
}

function fail(code) {
  throw new VerificationFailure(code);
}

function slug(value) {
  return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

class VerificationFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function usage() {
  console.error(
    "Usage:\n" +
      "  PROGRAMMABLE_RPC_URL=https://... node examples/verify-launch-stamp.mjs token <address>\n" +
      "  PROGRAMMABLE_RPC_URL=https://... node examples/verify-launch-stamp.mjs pool <poolManager> <poolId>\n" +
      "  PROGRAMMABLE_RPC_URL=https://... node examples/verify-launch-stamp.mjs component <address>",
  );
  process.exitCode = 2;
}

async function main() {
  const [kind, ...values] = process.argv.slice(2);
  if (!kind) return usage();
  let result;
  try {
    result = await verifyLaunchStamp({ kind, values });
  } catch (error) {
    result = outcome("indeterminate", errorCode(error), {
      query: { kind, values },
      claim: "provenance-only",
    });
  }
  console.log(JSON.stringify(result, jsonReplacer, 2));
  if (result.state === "indeterminate") process.exitCode = 1;
}

function jsonReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
