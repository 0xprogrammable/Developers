import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { describe, test } from "node:test";
import path from "node:path";

import { verifyLaunchStamp } from "../examples/verify-launch-stamp.mjs";
import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { assertValid, createSchemaRegistry } from "../scripts/lib/schema.mjs";
import { keccak256 } from "../server/keccak.js";

const MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  "deployments/ethereum-v2.json",
);
const FIXTURE_PATH = path.join(
  REPOSITORY_ROOT,
  "fixtures/v2/launch-stamp/prelaunch.json",
);
const ABI_PATH = path.join(
  REPOSITORY_ROOT,
  "abis/ethereum/programmable-launch-stamp-router-v1.json",
);
const FROZEN_ARTIFACT_PATH =
  process.env.PROGRAMMABLE_LAUNCH_STAMP_ROUTER_ARTIFACT ??
  path.resolve(
    REPOSITORY_ROOT,
    "../programmable-launch-stamp-router-main-20260809/out/ProgrammableLaunchStampRouterV1.sol/ProgrammableLaunchStampRouterV1.json",
  );

const EXPECTED_CLASSIC_CANARY_EVIDENCE = {
  finality: "finalized",
  source: {
    sourceRepository: "https://github.com/programmablehq/PROGRAMMABLE-EVM",
    releaseCommit: "707d438576dcf47dc2667125789fd35eb1c3de50",
    releaseTree: "789161bc206ea145f12b809f9d1746bd1a83468a",
    manifestPublication: {
      commit: "ff51e713feb52e4e13f3c553d1c726f3c8f2858c",
      tree: "53a8ce252d98703008ba17408f6c24555b8be45e",
      path: "contracts/deployments/mainnet-classic-v4.json",
      url: "https://raw.githubusercontent.com/programmablehq/PROGRAMMABLE-EVM/ff51e713feb52e4e13f3c553d1c726f3c8f2858c/contracts/deployments/mainnet-classic-v4.json",
      sha256:
        "sha256:5005df478e1298bbf9c2f1ff9256192290c5ca3652ee7cae13c0326a62893fc6",
    },
  },
  transactionHash:
    "0xbb6b4c9fc70600e4d5dd394314a49630bf9f837a82065013c397ebebd978aa7c",
  blockNumber: "25854486",
  blockHash:
    "0x66d7201c8274251f7e94960edad2570e9121f7a0209f4528c09c41c5ea9cdb7c",
  transactionIndex: 188,
  launchId:
    "0x75503436c39192ea7f165d1c0140724fed5dbd73c9b4816de713e34fe5a3fc87",
  stampHash:
    "0xd173468420cfa5159890896d34746c9c2fc9bb5e3960a1062aa82d1c3ffb5941",
  launchKind: 2,
  route: {
    launcher: "0xBBDF30a2fE1394e4AA864aC269C6cF09b518E699",
    launcherRuntimeCodeHash:
      "0xc80a1d3b6b3f196a54cea46fc94913d59aec2937e94e70b53fe5c5fd7f5c4b12",
    routePayloadHash:
      "0x344818154572f460bc3fa598678f37fc8f4853e9785ca723419511e5179dab40",
    expectedResultHash:
      "0x44e56f4408bee94e5179b10ee30574f740b6bf0e3d47b202b1c0a0e0179403ab",
    permitDigest:
      "0xfe2e718590739692dfe500000a18d62c07cb11d44cf5035febb12cac6c4466df",
  },
  components: [
    {
      role: "positionRecipient",
      kind: 0,
      address: "0x0EC0ac6aA9724928aA678c407039D5b2d65cB7Ed",
      runtimeCodeHash:
        "0xbfcf00b05d7092f0e47d9dc8ed24cdfab992dfe82da0ac1c1ff8e2c3c2dbc7d7",
    },
    {
      role: "rewardVault",
      kind: 0,
      address: "0x541034C6613154e81a64F9A9Ca1A572819E426E3",
      runtimeCodeHash:
        "0x263080da69f045205235451b41e17da8f03955ece962f4589ee604ccc3c36625",
    },
    {
      role: "hook",
      kind: 2,
      address: "0xADF955a44FD7F009380240d56D71dFAfB46020cc",
      runtimeCodeHash:
        "0xf3a1a628ce898c527f24569b426aa795ec65ff9d97afa2b89e8ea5a2b99ad280",
    },
    {
      role: "token",
      kind: 1,
      address: "0xB382f738a99820276FD66EfB94b75Eca104c2B4D",
      runtimeCodeHash:
        "0x554847de232eb1242cae2befefb8882eb05947e2b103220baaebb3e2ab59b132",
    },
  ],
  pool: {
    poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
    poolId:
      "0xef513a3234ab2eb561aa0a7ee55619ace1624a900e5f7b55156ba6d0cc86334a",
    activeLiquidity: "47813640512503339560210",
  },
  lpPosition: {
    positionManager: "0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e",
    tokenId: "386488",
    owner: "0x0EC0ac6aA9724928aA678c407039D5b2d65cB7Ed",
  },
  platformFee: {
    rateBps: 10,
    recipient: "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c",
  },
  tokenTotalSupply: "1000000000000000000000000000",
  verification: {
    verificationBlock: "25855200",
    verificationBlockHash:
      "0x3de5eeb594e8431be0d090f65fe2ddfc38900f0c4bce9320f4a46bb280b9d905",
    releaseManifestDigest:
      "0xb08e7032c801ddc3d5ba958eb389d2728bb439e4105aef4e7706969f7426ee00",
    releaseBindingDigest:
      "0xf4bd9a33728b62deca13a68b3b5ceedab9504930bf4c1676f3abaa4fc4f8cb13",
    deploymentEvidenceDigest:
      "0xd21105b4d7e1a4104457a96cdea9054d027ec46142cc82da858ffb69730fdc7f",
    sourceEvidenceDigest:
      "0x8b0d405e1a05ca41b1ff7dee774b9795d0ee4465c7ab505cd26e77c7a7b3c005",
    lifecycleEvidenceDigest:
      "0x8cebe98625569273cb3612deb6ea14621ef124c9197418923e034a39db1c316a",
  },
};

describe("launch stamp Router documentation", () => {
  test("publishes one top-level future-only Router descriptor", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const fixture = await readJson(FIXTURE_PATH);
    const router = manifest.launchStampRouter;

    assert.equal(manifest.manifestVersion, "12");
    assert.equal(manifest.generatedAt, "2026-08-28T21:45:04Z");
    assert.ok(router, "top-level launchStampRouter is required");
    assert.equal(manifest.customRegistry.launchStamp, undefined);
    assert.equal(router.status, "live");
    assert.equal(router.scope, "future-launches-only");
    assert.equal(router.supportsFutureClassic, true);
    assert.equal(router.supportsFutureCustom, true);
    assert.equal(router.supportsHistoricalLaunches, false);
    assert.equal(router.verificationMode, "canonical-router");
    assert.equal(router.launchIdentityScope, "chain-id+router-address+launch-id");
    assert.equal(router.provenanceOnly, true);
    assert.equal(router.contractName, "ProgrammableLaunchStampRouterV1");
    assert.equal(router.authorityMode, "eip-1271-contract-only");
    assert.equal(router.canonicalReadBlock, "finalized-or-explicit-canonical-block");
    assert.equal(router.artifact.artifactSha256, undefined);
    assert.deepEqual(router.deploymentEvidence, {
      verificationStatus: "finalized-verified",
      address: "0x8622DD5bAb44185f2A458ac90384Ac99248f8d56",
      deploymentTransactionHash:
        "0x3bc086661555c10040feb3fceb23d33003e22ca033e65cfae72592119ee8d486",
      deploymentBlockNumber: "25717612",
      deploymentBlockHash:
        "0x8e4512193217c2171624657717d32dbfe9896455e553cadc192fbfe32d3278bc",
      finalizedBlockNumber: "25717634",
      finalizedBlockHash:
        "0x4177a280cd7e43da181bf1d73900eb2431c26d5fe933a5ed0e583370064cbd6e",
      finalityDepth: 22,
      runtimeCodeBytes: 23013,
      runtimeCodeKeccak256:
        "0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546",
      runtimeCodeSha256:
        "sha256:0b0e89074bff270bd5bf80ca9642f748dca1857d1ab643cbce65f4f663937ec7",
      observedBindings: {
        chainId: 1,
        permitAuthority: "0x755509eA6e3F5Ec1aA2E797bb68f1B87DD8b886b",
        permitAuthorityRuntimeCodeHash:
          "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
        graphFactory: "0xB012e4A8F2c5FC4E8E4faCA9D5Ad6FfF13FBA887",
        graphFactoryRuntimeCodeHash:
          "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
        poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
        poolManagerRuntimeCodeHash:
          "0x785f1014552b7ce7d5fb7d0c970ca60edee94fd00425d7ca21609acac7ce1293",
      },
      getterBundleSha256:
        "sha256:6e6e8a93193bbe2f79f98594a1af32c27bae0746f8297dd13592d9608e2feb20",
      evidenceSha256:
        "sha256:f9786ebfb74c96a3c225567ad324f0fbecfd8520b8d8addec85ba58cd67e19ff",
    });
    assert.equal(
      BigInt(router.deploymentEvidence.finalizedBlockNumber) -
        BigInt(router.deploymentEvidence.deploymentBlockNumber),
      BigInt(router.deploymentEvidence.finalityDepth),
    );
    assert.deepEqual(router.enumValues.launchKind, {
      invalid: 0,
      customGraph: 1,
      classic: 2,
    });
    assert.equal(router.address, router.deploymentEvidence.address);
    assert.equal(router.startBlock, router.deploymentEvidence.deploymentBlockNumber);
    assert.equal(router.endBlock, null);
    assert.equal(
      router.runtimeCodeHash,
      router.deploymentEvidence.runtimeCodeKeccak256,
    );
    assert.equal(router.finalityConfirmations, 64);
    assert.deepEqual(router.bindings, {
      permitAuthority: "0x755509eA6e3F5Ec1aA2E797bb68f1B87DD8b886b",
      permitAuthorityRuntimeCodeHash:
        "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
      graphFactory: "0xB012e4A8F2c5FC4E8E4faCA9D5Ad6FfF13FBA887",
      graphFactoryRuntimeCodeHash:
        "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
      poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      poolManagerRuntimeCodeHash:
        "0x785f1014552b7ce7d5fb7d0c970ca60edee94fd00425d7ca21609acac7ce1293",
    });
    assert.equal(router.canaryEvidence.finality, "finalized");
    assert.equal(
      router.artifact.sourceCommit,
      "0a7134bbb912222639627fb9078df2f8dd3a6c38",
    );
    assert.equal(
      router.canaryEvidence.source.sourceCommit,
      "b3cfed41bb841ae8d6188dbb815eddb5e1440218",
    );
    assert.notEqual(
      router.artifact.sourceCommit,
      router.canaryEvidence.source.sourceCommit,
      "the canary source commit must not replace the deployed Router artifact source",
    );
    assert.deepEqual(router.canaryEvidence.routeCoverage, {
      customGraphOnchainCanary: true,
      classicOnchainCanary: true,
    });
    assert.equal(router.canaryEvidence.launchKind, router.enumValues.launchKind.customGraph);
    assert.equal(router.canaryEvidence.pool.poolManager, router.bindings.poolManager);
    assert.ok(
      BigInt(router.canaryEvidence.blockNumber) >= BigInt(router.startBlock),
      "canary must be at or after Router activation",
    );
    for (const proof of router.canaryEvidence.stampProofs) {
      assert.equal(proof.launchId, router.canaryEvidence.launchId);
      assert.equal(proof.stampHash, router.canaryEvidence.stampHash);
    }
    assert.deepEqual(
      router.canaryEvidence.stampProofs.map(({ component }) => component),
      Object.values(router.canaryEvidence.components),
    );
    assert.deepEqual(
      router.classicCanaryEvidence,
      EXPECTED_CLASSIC_CANARY_EVIDENCE,
    );
    const classicV4Deployments = manifest.deployments.filter(
      (deployment) =>
        deployment.category === "classic" &&
        deployment.modelVersion === "4" &&
        deployment.lifecycle === "current" &&
        deployment.discovery === "enabled",
    );
    assert.equal(classicV4Deployments.length, 1);
    const classicV4 = classicV4Deployments[0];
    assert.equal(
      router.classicCanaryEvidence.launchKind,
      router.enumValues.launchKind.classic,
    );
    assert.equal(
      router.classicCanaryEvidence.route.launcher,
      classicV4.contracts.launcher,
    );
    assert.equal(
      router.classicCanaryEvidence.route.launcherRuntimeCodeHash,
      classicV4.evidence.launcherRuntimeCodeHash,
    );
    assert.equal(
      router.classicCanaryEvidence.source.sourceRepository,
      classicV4.evidence.sourceRepository,
    );
    assert.equal(
      router.classicCanaryEvidence.source.releaseCommit,
      classicV4.evidence.sourceCommit,
    );
    const manifestPublication =
      router.classicCanaryEvidence.source.manifestPublication;
    assert.equal(
      manifestPublication.url,
      `https://raw.githubusercontent.com/programmablehq/PROGRAMMABLE-EVM/${manifestPublication.commit}/${manifestPublication.path}`,
    );
    assert.equal(
      router.classicCanaryEvidence.components.find(({ role }) => role === "hook")
        ?.address,
      classicV4.contracts.hook,
    );
    assert.equal(
      router.classicCanaryEvidence.pool.poolManager,
      router.bindings.poolManager,
    );
    assert.ok(
      BigInt(router.classicCanaryEvidence.blockNumber) >=
        BigInt(classicV4.startBlock),
      "Classic canary must be at or after Classic V4 activation",
    );
    assert.deepEqual(fixture, prelaunchDescriptor(router));
    assert.match(router.abiSha256, /^sha256:[0-9a-f]{64}$/);
    assert.match(router.atomicSelector, /^0x[0-9a-f]{8}$/);
    assert.ok(Object.values(router.events).every(Boolean));
    assert.ok(Object.values(router.getters).every(Boolean));
  });

  test("fails deployment activation closed in the v2 manifest schema", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const schemas = await createSchemaRegistry("v2");
    const validate = schemas.validator("manifest.schema.json");

    assertValid(validate, manifest, "launchStampRouter manifest");

    const prelaunch = structuredClone(manifest);
    prelaunch.launchStampRouter = prelaunchDescriptor(
      prelaunch.launchStampRouter,
    );
    assertValid(validate, prelaunch, "prelaunch Router fixture");

    for (const mutate of [
      (router) => {
        router.address = "0x1111111111111111111111111111111111111111";
      },
      (router) => {
        router.startBlock = "1";
      },
      (router) => {
        router.runtimeCodeHash = `0x${"1".repeat(64)}`;
      },
      (router) => {
        router.bindings.permitAuthority =
          "0x1111111111111111111111111111111111111111";
      },
      (router) => {
        router.canaryEvidence = {};
      },
      (router) => {
        router.classicCanaryEvidence = {};
      },
    ]) {
      const falsePrelaunch = structuredClone(prelaunch);
      mutate(falsePrelaunch.launchStampRouter);
      assert.equal(
        validate(falsePrelaunch),
        false,
        "prelaunch Router cannot carry partial activation data",
      );
    }

    for (const mutate of [
      (router) => {
        router.address = "0x1111111111111111111111111111111111111111";
      },
      (router) => {
        router.startBlock = "1";
      },
      (router) => {
        router.runtimeCodeHash = `0x${"1".repeat(64)}`;
      },
      (router) => {
        router.finalityConfirmations = 63;
      },
      (router) => {
        router.bindings.poolManager =
          "0x1111111111111111111111111111111111111111";
      },
      (router) => {
        router.canaryEvidence = null;
      },
      (router) => {
        router.classicCanaryEvidence = null;
      },
    ]) {
      const activationDrift = structuredClone(manifest);
      mutate(activationDrift.launchStampRouter);
      assert.equal(
        validate(activationDrift),
        false,
        "live Router activation drift must fail schema validation",
      );
    }

    for (const mutate of [
      (evidence) => {
        evidence.address = "0x1111111111111111111111111111111111111111";
      },
      (evidence) => {
        evidence.deploymentBlockNumber = "1";
      },
      (evidence) => {
        evidence.runtimeCodeKeccak256 = `0x${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.observedBindings.permitAuthority =
          "0x1111111111111111111111111111111111111111";
      },
      (evidence) => {
        evidence.evidenceSha256 = `sha256:${"1".repeat(64)}`;
      },
    ]) {
      const evidenceDrift = structuredClone(manifest);
      mutate(evidenceDrift.launchStampRouter.deploymentEvidence);
      assert.equal(
        validate(evidenceDrift),
        false,
        "finalized Router deployment evidence drift must fail schema validation",
      );
    }

    for (const mutate of [
      (evidence) => {
        evidence.finality = "pending";
      },
      (evidence) => {
        evidence.routeCoverage.classicOnchainCanary = false;
      },
      (evidence) => {
        evidence.source.sourceCommit = "1".repeat(40);
      },
      (evidence) => {
        evidence.transactionHash = `0x${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.blockNumber = "1";
      },
      (evidence) => {
        evidence.launchId = `0x${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.stampHash = `0x${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.components.token =
          "0x1111111111111111111111111111111111111111";
      },
      (evidence) => {
        evidence.pool.activeLiquidity = "1";
      },
      (evidence) => {
        evidence.lpPosition.tokenId = "1";
      },
      (evidence) => {
        evidence.platformFee.feePips = 1;
      },
      (evidence) => {
        evidence.tokenTotalSupply = "1";
      },
      (evidence) => {
        evidence.stampProofs[0].stampHash = `0x${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.evidenceFileSha256 = `sha256:${"1".repeat(64)}`;
      },
    ]) {
      const canaryDrift = structuredClone(manifest);
      mutate(canaryDrift.launchStampRouter.canaryEvidence);
      assert.equal(
        validate(canaryDrift),
        false,
        "approved finalized Router canary evidence drift must fail schema validation",
      );
    }

    for (const mutate of [
      (evidence) => {
        evidence.finality = "pending";
      },
      (evidence) => {
        evidence.source.releaseCommit = "1".repeat(40);
      },
      (evidence) => {
        evidence.source.manifestPublication = null;
      },
      (evidence) => {
        evidence.source.manifestPublication.commit = "1".repeat(40);
      },
      (evidence) => {
        evidence.source.manifestPublication.sha256 = `sha256:${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.transactionHash = `0x${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.route.launcher =
          "0x1111111111111111111111111111111111111111";
      },
      (evidence) => {
        evidence.components[0].runtimeCodeHash = `0x${"1".repeat(64)}`;
      },
      (evidence) => {
        evidence.pool.activeLiquidity = "1";
      },
      (evidence) => {
        evidence.lpPosition.owner =
          "0x1111111111111111111111111111111111111111";
      },
      (evidence) => {
        evidence.platformFee.rateBps = 1;
      },
      (evidence) => {
        evidence.verification.lifecycleEvidenceDigest = `0x${"1".repeat(64)}`;
      },
    ]) {
      const classicCanaryDrift = structuredClone(manifest);
      mutate(classicCanaryDrift.launchStampRouter.classicCanaryEvidence);
      assert.equal(
        validate(classicCanaryDrift),
        false,
        "approved finalized Classic Router canary evidence drift must fail schema validation",
      );
    }

    for (const mutate of [
      (router) => {
        router.abiSha256 = `sha256:${"1".repeat(64)}`;
      },
      (router) => {
        router.atomicSelector = "0x11111111";
      },
      (router) => {
        router.events.launchStamped.topic0 = `0x${"1".repeat(64)}`;
      },
      (router) => {
        router.events.launchRouteStamped.indexedInputs = ["launchId"];
      },
      (router) => {
        router.getters.stampProof.selector = "0x11111111";
      },
      (router) => {
        router.enumValues.launchKind.classic = 1;
      },
    ]) {
      const interfaceDrift = structuredClone(manifest);
      mutate(interfaceDrift.launchStampRouter);
      assert.equal(
        validate(interfaceDrift),
        false,
        "frozen Router interface drift must fail schema validation",
      );
    }
  });

  test("binds the published ABI, selectors, topics, tuples and enums", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const router = manifest.launchStampRouter;
    const source = await readFile(ABI_PATH);
    const abi = JSON.parse(source);
    const sha256 = `sha256:${createHash("sha256").update(source).digest("hex")}`;

    assert.equal(sha256, router.abiSha256);
    await assert.rejects(
      access(
        path.join(
          REPOSITORY_ROOT,
          "abis/ethereum/programmable-launch-stamp-v1.json",
        ),
      ),
      { code: "ENOENT" },
    );

    for (const descriptor of Object.values(router.getters)) {
      const item = abi.find(
        (candidate) =>
          candidate.type === "function" &&
          canonicalSignature(candidate) === descriptor.signature,
      );
      assert.ok(item, descriptor.signature);
      assert.equal(selectorOf(item), descriptor.selector, descriptor.signature);
    }

    for (const descriptor of Object.values(router.events)) {
      const item = abi.find(
        (candidate) =>
          candidate.type === "event" &&
          canonicalSignature(candidate) === descriptor.signature,
      );
      assert.ok(item, descriptor.signature);
      assert.equal(topicOf(item), descriptor.topic0, descriptor.signature);
      assert.deepEqual(
        item.inputs.filter(({ indexed }) => indexed).map(({ name }) => name),
        descriptor.indexedInputs,
      );
    }

    const atomic = abi.find(
      (item) => item.type === "function" && item.name === "launchAndStampV1",
    );
    assert.ok(atomic);
    assert.equal(canonicalSignature(atomic), router.atomicSignature);
    assert.equal(selectorOf(atomic), router.atomicSelector);
    assert.equal(atomic.stateMutability, "payable");
    assert.deepEqual(
      abi
        .filter((item) => item.type === "function" && item.stateMutability === "payable")
        .map(({ name }) => name),
      ["launchAndStampV1"],
    );
    assert.equal(
      abi.some((item) => item.type === "function" && item.name === "launchIdByHook"),
      false,
    );

    const record = abi.find(
      (item) => item.type === "function" && item.name === "launchStamp",
    );
    assert.deepEqual(
      record.outputs[0].components.map(({ name, type }) => [name, type]),
      [
        ["kind", "uint8"],
        ["launchWallet", "address"],
        ["token", "address"],
        ["hook", "address"],
        ["poolManager", "address"],
        ["poolId", "bytes32"],
        ["poolKeyHash", "bytes32"],
        ["componentSetHash", "bytes32"],
        ["routePayloadHash", "bytes32"],
        ["routeLauncher", "address"],
        ["routeLauncherRuntimeCodeHash", "bytes32"],
        ["expectedResultHash", "bytes32"],
        ["permitDigest", "bytes32"],
        ["stampHash", "bytes32"],
      ],
    );

    const proof = abi.find(
      (item) => item.type === "function" && item.name === "stampProof",
    );
    assert.deepEqual(
      proof.outputs.map(({ name, type }) => [name, type]),
      [
        ["launchId", "bytes32"],
        ["stampHash", "bytes32"],
      ],
    );
    assert.equal(
      keccakText(router.eip712.permitType),
      router.eip712.permitTypeHash,
    );
  });

  test("matches the exact frozen Forge artifact when available", async (context) => {
    try {
      await access(FROZEN_ARTIFACT_PATH);
    } catch (error) {
      if (error?.code === "ENOENT") {
        context.skip("frozen Forge artifact is not present in this checkout");
        return;
      }
      throw error;
    }

    const manifest = await readJson(MANIFEST_PATH);
    const artifactSource = await readFile(FROZEN_ARTIFACT_PATH);
    const artifact = JSON.parse(artifactSource);
    const publishedAbi = await readJson(ABI_PATH);
    assert.deepEqual(publishedAbi, artifact.abi);
    for (const [signature, value] of Object.entries(artifact.methodIdentifiers)) {
      const item = publishedAbi.find(
        (candidate) =>
          candidate.type === "function" &&
          canonicalSignature(candidate) === signature,
      );
      assert.ok(item, signature);
      assert.equal(selectorOf(item), `0x${value}`, signature);
    }
  });

  test("documents the deterministic terminal algorithm and exact scope", async () => {
    const guide = await readFile(
      path.join(REPOSITORY_ROOT, "docs/reference/launch-stamp.md"),
      "utf8",
    );
    const terminalGuide = await readFile(
      path.join(REPOSITORY_ROOT, "docs/guides/terminals-and-scanners.md"),
      "utf8",
    );
    const faq = await readFile(
      path.join(REPOSITORY_ROOT, "docs/faq.md"),
      "utf8",
    );
    const manifest = await readJson(MANIFEST_PATH);
    const router = manifest.launchStampRouter;

    assert.match(guide, /Programmable Classic launches with a valid Router stamp/i);
    assert.match(guide, /Programmable Custom launches with a valid Router stamp/i);
    assert.match(guide, /Historical Classic or Custom coins are not backfilled/i);
    assert.match(guide, /same canonical router/i);
    assert.match(guide, /LaunchKindV1\.Invalid.*0/s);
    assert.match(guide, /LaunchKindV1\.CustomGraph.*1/s);
    assert.match(guide, /LaunchKindV1\.Classic.*2/s);
    assert.match(guide, /Classic hook is shared/i);
    assert.match(guide, /chainId \+ Router address \+ launchId/i);
    assert.match(guide, /finalized block or a caller-supplied canonical block/i);
    assert.match(guide, /EIP-1898/);
    assert.match(guide, /closing hash to equal the opening hash/i);
    assert.match(guide, /Remote RPC URLs must use HTTPS/i);
    assert.match(guide, /exact manifest router address/i);
    assert.match(guide, /correct topic from any other emitter is not Programmable provenance/i);
    assert.match(guide, /PoolManager \+ PoolId/);
    assert.match(
      guide,
      /Direct calls to a Classic launcher or Graph Factory outside the Router/i,
    );
    assert.match(guide, /Single Factory is outside Router V1/i);
    assert.match(guide, /no EOA authority fallback/i);
    assert.match(guide, /proxy or beacon/i);
    assert.match(guide, /does not establish current pool state or current liquidity/i);
    assert.match(guide, /does not state that a contract is audited, safe, sellable/i);
    assert.match(guide, /Custom Registry, hosted launch feed, an indexer, Supabase/i);
    assert.match(guide, /generated container is not tracked/i);
    assert.match(guide, /raw hash is intentionally not a trust field/i);
    assert.match(guide, /Router V1 is live on Ethereum/i);
    assert.match(
      guide,
      /routeCoverage\.customGraphOnchainCanary`\s*\|\s*`true/,
    );
    assert.match(
      guide,
      /routeCoverage\.classicOnchainCanary`\s*\|\s*`true/,
    );
    assert.match(guide, /Finalized Classic V4 test vector/i);
    assert.match(guide, /launchStampRouter\.classicCanaryEvidence/);
    assert.match(guide, /\/launchStampRouter\/classicCanaryEvidence/);
    assert.match(
      guide,
      /classicCanaryEvidence\.source\.manifestPublication/,
    );
    assert.match(guide, /refresh.*manifest/i);
    assert.match(
      guide,
      /resolve the single enabled current Classic V4 deployment dynamically/i,
    );
    assert.match(
      guide,
      /cross-check `classicCanaryEvidence` against that release and the same canonical Router/i,
    );
    assert.match(
      guide,
      /Never copy its address, start block, or evidence values into client code/i,
    );
    assert.match(guide, /does not retroactively stamp Classic V3/i);
    assert.match(guide, /requires `64` confirmations/i);
    assert.match(guide, /finalized PCAN test vector/i);
    assert.match(guide, /\/launchStampRouter\/canaryEvidence/);
    assert.match(guide, /PCAN.*not an additional launch or trust identifier/i);
    assert.match(guide, /eth_getLogs/);
    assert.match(guide, /bounded chunks/i);
    assert.match(guide, /durable checkpoint only through the finalized boundary/i);
    assert.match(guide, /Replay an overlap window/i);
    assert.match(guide, /orphan affected observations/i);
    assert.match(guide, /rewind to the last common finalized checkpoint/i);
    assert.match(guide, /polling or a subscription/i);
    assert.match(guide, /backfill-to-live handoff has no gap/i);
    assert.match(guide, /Only a launch with a consistent record written by the exact canonical Router/i);
    assert.match(guide, /uninitialized before route execution and initialized before the stamp/i);
    assert.match(guide, /does not universally prove that every Classic component was newly created/i);
    assert.match(guide, /does not mean GMGN, Axiom, FOMO/i);
    assert.match(guide, /ordinary token and pool discovery/i);
    assert.match(guide, /not verification of the canonical Router stamp/i);
    assert.match(guide, /current pool state separately through PoolManager or StateView/i);
    assert.match(guide, /not an Explorer source-publication status/i);
    assert.match(
      guide,
      /Custom Launch API V1 and V2 retain historical reads.*409 CUSTOM_LAUNCH_V1_READ_ONLY.*409 CUSTOM_LAUNCH_V2_READ_ONLY.*GitHub approval flow must not be revived/is,
    );
    assert.match(terminalGuide, /finalized PCAN test vector/i);
    assert.match(terminalGuide, /backfill-to-live handoff has no gap/i);
    assert.match(terminalGuide, /subscription notification alone is not provenance/i);
    assert.match(terminalGuide, /does not mean GMGN, Axiom, FOMO/i);
    assert.match(terminalGuide, /ordinary market/i);
    assert.match(terminalGuide, /read current pool state separately through PoolManager or StateView/i);
    assert.match(faq, /Custom launches still use GitHub approval pull requests/i);
    assert.match(faq, /No credential signs, broadcasts, bypasses admission, or supplies attribution/i);
    assert.match(faq, /ordinary token and pool listing/i);
    assert.match(faq, /not canonical onchain evidence/i);
    assert.match(faq, /No\./);
    assert.doesNotMatch(guide, /Registry lifecycle/i);

    for (const value of [
      router.deploymentEvidence.address,
      router.deploymentEvidence.deploymentTransactionHash,
      router.deploymentEvidence.deploymentBlockNumber,
      router.deploymentEvidence.deploymentBlockHash,
      router.deploymentEvidence.finalizedBlockNumber,
      router.deploymentEvidence.finalizedBlockHash,
      router.deploymentEvidence.runtimeCodeKeccak256,
      router.deploymentEvidence.runtimeCodeSha256.slice("sha256:".length),
      router.deploymentEvidence.getterBundleSha256.slice("sha256:".length),
      router.deploymentEvidence.evidenceSha256.slice("sha256:".length),
      router.address,
      router.startBlock,
      router.runtimeCodeHash,
      router.abiUrl,
      router.canaryEvidence.source.sourceRepository,
      router.canaryEvidence.source.sourceCommit,
      router.canaryEvidence.source.commitSubject,
      router.canaryEvidence.transactionHash,
      router.canaryEvidence.blockNumber,
      router.canaryEvidence.blockHash,
      router.canaryEvidence.launchId,
      router.canaryEvidence.stampHash,
      ...Object.values(router.canaryEvidence.components),
      router.canaryEvidence.pool.poolManager,
      router.canaryEvidence.pool.poolId,
      router.canaryEvidence.pool.activeLiquidity,
      router.canaryEvidence.lpPosition.positionManager,
      router.canaryEvidence.lpPosition.tokenId,
      router.canaryEvidence.lpPosition.owner,
      router.canaryEvidence.platformFee.recipient,
      router.canaryEvidence.tokenTotalSupply,
      ...router.canaryEvidence.stampProofs.flatMap(
        ({ component, launchId, stampHash }) => [
          component,
          launchId,
          stampHash,
        ],
      ),
      router.canaryEvidence.evidenceFileSha256.slice("sha256:".length),
      router.canaryEvidence.evidenceLineSha256.slice("sha256:".length),
      router.abiSha256.slice("sha256:".length),
      router.atomicSelector,
      router.eip712.permitType,
      router.eip712.permitTypeHash,
      ...Object.values(router.events).flatMap(({ signature, topic0 }) => [
        signature,
        topic0,
      ]),
      ...Object.values(router.getters).flatMap(({ signature, selector }) => [
        signature,
        selector,
      ]),
    ]) {
      assert.ok(guide.includes(value), `guide must publish ${value}`);
    }
  });

  test("keeps deployment identity out of both verifier examples", async () => {
    for (const relative of [
      "examples/verify-launch-stamp.mjs",
      "examples/verify-launch-stamp-viem.ts",
    ]) {
      const example = await readFile(path.join(REPOSITORY_ROOT, relative), "utf8");
      assert.match(example, /launchStampRouter/);
      assert.match(example, /eth_chainId|chainId/);
      assert.match(example, /finalized/i);
      assert.match(example, /runtimeCodeHash/);
      assert.match(example, /stampProof/);
      assert.doesNotMatch(example, /customRegistry\.launchStamp/);
      assert.doesNotMatch(example, /launchIdByHook/);
      assert.doesNotMatch(example, /launchState\(/);
      assert.doesNotMatch(example, /0x[0-9a-fA-F]{40}/);
    }
  });

  test("returns unavailable from the published prelaunch fixture without RPC access", async () => {
    const manifest = await readJson(FIXTURE_PATH);
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      if (request.url === "/discovery.json") {
        const { port } = server.address();
        response.end(
          JSON.stringify({
            manifestUrl: `http://127.0.0.1:${port}/manifest.json`,
          }),
        );
        return;
      }
      if (request.url === "/manifest.json") {
        response.end(JSON.stringify({ chainId: 1, launchStampRouter: manifest }));
        return;
      }
      response.statusCode = 404;
      response.end("{}");
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const { port } = server.address();
      const result = await verifyLaunchStamp({
        kind: "token",
        values: ["0x1111111111111111111111111111111111111111"],
        discoveryUrl: `http://127.0.0.1:${port}/discovery.json`,
      });
      assert.deepEqual(result, {
        state: "unavailable",
        reason: "router-prelaunch",
        query: {
          kind: "token",
          values: ["0x1111111111111111111111111111111111111111"],
        },
        claim: "provenance-only",
      });
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  test("binds JSON-RPC reads to one canonical block hash and rejects remote plaintext RPC", async () => {
    const publishedManifest = await readJson(MANIFEST_PATH);
    const abiBytes = await readFile(ABI_PATH);
    const code = "0x6000";
    const runtimeCodeHash = keccak256(Uint8Array.from([0x60, 0x00]));
    const blockHash = `0x${"a".repeat(64)}`;
    const addresses = {
      router: "0x1111111111111111111111111111111111111111",
      permitAuthority: "0x2222222222222222222222222222222222222222",
      graphFactory: "0x3333333333333333333333333333333333333333",
      poolManager: "0x4444444444444444444444444444444444444444",
      token: "0x5555555555555555555555555555555555555555",
    };
    const router = structuredClone(publishedManifest.launchStampRouter);
    Object.assign(router, {
      status: "live",
      address: addresses.router,
      startBlock: "1",
      endBlock: null,
      runtimeCodeHash,
      finalityConfirmations: 1,
    });
    Object.assign(router.bindings, {
      permitAuthority: addresses.permitAuthority,
      permitAuthorityRuntimeCodeHash: runtimeCodeHash,
      graphFactory: addresses.graphFactory,
      graphFactoryRuntimeCodeHash: runtimeCodeHash,
      poolManager: addresses.poolManager,
      poolManagerRuntimeCodeHash: runtimeCodeHash,
    });
    router.canaryEvidence.pool.poolManager = addresses.poolManager;
    router.classicCanaryEvidence.pool.poolManager = addresses.poolManager;

    let servedManifest = { ...publishedManifest, launchStampRouter: router };
    let chainHead = 100n;
    const canonicalReadParams = [];
    const server = createServer(async (request, response) => {
      response.setHeader("content-type", "application/json");
      const { port } = server.address();
      if (request.method === "GET" && request.url === "/discovery.json") {
        response.end(
          JSON.stringify({
            manifestUrl: `http://127.0.0.1:${port}/manifest.json`,
          }),
        );
        return;
      }
      if (request.method === "GET" && request.url === "/manifest.json") {
        response.end(
          JSON.stringify({
            ...servedManifest,
            launchStampRouter: {
              ...servedManifest.launchStampRouter,
              abiUrl: `http://127.0.0.1:${port}/router-abi.json`,
            },
          }),
        );
        return;
      }
      if (request.method === "GET" && request.url === "/router-abi.json") {
        response.end(abiBytes);
        return;
      }
      if (request.method === "POST" && request.url === "/rpc") {
        const body = await readRequestJson(request);
        let result;
        if (body.method === "eth_chainId") {
          result = "0x1";
        } else if (body.method === "eth_blockNumber") {
          result = `0x${chainHead.toString(16)}`;
        } else if (body.method === "eth_getBlockByNumber") {
          result = { number: "0x64", hash: blockHash };
        } else if (body.method === "eth_getCode") {
          canonicalReadParams.push(body.params[1]);
          result = code;
        } else if (body.method === "eth_call") {
          canonicalReadParams.push(body.params[1]);
          const selector = body.params[0].data.slice(0, 10);
          result = immutableCallResult(router, selector);
        } else {
          response.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              error: { code: -32601, message: "method not found" },
            }),
          );
          return;
        }
        response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
        return;
      }
      response.statusCode = 404;
      response.end("{}");
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const { port } = server.address();
      const discoveryUrl = `http://127.0.0.1:${port}/discovery.json`;

      servedManifest = {
        ...servedManifest,
        launchStampRouter: { ...router, status: "paused" },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-status-unsupported",
      );

      servedManifest = {
        ...servedManifest,
        launchStampRouter: { ...router, finalityConfirmations: undefined },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-activation-incomplete",
      );

      servedManifest = {
        ...servedManifest,
        launchStampRouter: { ...router, finalityConfirmations: -1 },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-activation-incomplete",
      );

      servedManifest = {
        ...servedManifest,
        launchStampRouter: { ...router, finalityConfirmations: 0 },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-activation-incomplete",
      );

      servedManifest = {
        ...servedManifest,
        launchStampRouter: { ...router, canaryEvidence: null },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-canary-evidence-incomplete",
      );

      const falseClassicCoverage = structuredClone(router.canaryEvidence);
      falseClassicCoverage.routeCoverage.classicOnchainCanary = false;
      servedManifest = {
        ...servedManifest,
        launchStampRouter: {
          ...router,
          canaryEvidence: falseClassicCoverage,
        },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-canary-evidence-incomplete",
      );

      servedManifest = {
        ...servedManifest,
        launchStampRouter: { ...router, classicCanaryEvidence: null },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-canary-evidence-incomplete",
      );

      const corruptClassicEvidence = structuredClone(
        router.classicCanaryEvidence,
      );
      corruptClassicEvidence.route.launcher =
        "0x1111111111111111111111111111111111111111";
      servedManifest = {
        ...servedManifest,
        launchStampRouter: {
          ...router,
          classicCanaryEvidence: corruptClassicEvidence,
        },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-canary-evidence-incomplete",
      );

      const corruptPublicationEvidence = structuredClone(
        router.classicCanaryEvidence,
      );
      corruptPublicationEvidence.source.manifestPublication.sha256 =
        "sha256:malformed";
      servedManifest = {
        ...servedManifest,
        launchStampRouter: {
          ...router,
          classicCanaryEvidence: corruptPublicationEvidence,
        },
      };
      assert.equal(
        (await verifyLaunchStamp({
          kind: "token",
          values: [addresses.token],
          discoveryUrl,
        })).reason,
        "router-canary-evidence-incomplete",
      );

      servedManifest = { ...servedManifest, launchStampRouter: router };
      const insecureRpc = await verifyLaunchStamp({
        kind: "token",
        values: [addresses.token],
        discoveryUrl,
        rpcUrl: "http://rpc.example.invalid",
      });
      assert.equal(insecureRpc.state, "indeterminate");
      assert.equal(insecureRpc.reason, "rpc-url-https-required");

      const insufficientFinality = await verifyLaunchStamp({
        kind: "token",
        values: [addresses.token],
        discoveryUrl,
        rpcUrl: `http://127.0.0.1:${port}/rpc`,
        blockTag: "100",
      });
      assert.equal(insufficientFinality.state, "indeterminate");
      assert.equal(insufficientFinality.reason, "block-finality-insufficient");

      chainHead = 101n;
      const explicitFinalizedZero = await verifyLaunchStamp({
        kind: "token",
        values: [addresses.token],
        discoveryUrl,
        rpcUrl: `http://127.0.0.1:${port}/rpc`,
        blockTag: "100",
      });
      assert.equal(explicitFinalizedZero.state, "not-stamped");
      assert.equal(explicitFinalizedZero.reason, "zero-launch-id");

      const verifiedZero = await verifyLaunchStamp({
        kind: "token",
        values: [addresses.token],
        discoveryUrl,
        rpcUrl: `http://127.0.0.1:${port}/rpc`,
      });
      assert.equal(verifiedZero.state, "not-stamped");
      assert.equal(verifiedZero.reason, "zero-launch-id");
      assert.ok(canonicalReadParams.length > 0);
      for (const parameter of canonicalReadParams) {
        assert.deepEqual(parameter, {
          blockHash,
          requireCanonical: true,
        });
      }
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  test("keeps the viem example fail-closed across activation, transport and reorgs", async () => {
    const source = await readFile(
      path.join(REPOSITORY_ROOT, "examples/verify-launch-stamp-viem.ts"),
      "utf8",
    );

    assert.match(source, /router\.status !== "live" && router\.status !== "retired"/);
    assert.match(source, /typeof router\.finalityConfirmations !== "number"/);
    assert.match(source, /Number\.isInteger\(router\.finalityConfirmations\)/);
    assert.match(source, /router\.finalityConfirmations <= 0/);
    assert.match(source, /checkedHttpsOrLocalUrl\(rpcUrl\)/);
    assert.match(source, /await requireUnchangedBlock\(client, blockNumber, blockHash\)/);
    assert.match(source, /closingBlock\.hash\.toLowerCase\(\) !== expectedHash\.toLowerCase\(\)/);
  });
});

function prelaunchDescriptor(router) {
  const descriptor = structuredClone(router);
  Object.assign(descriptor, {
    status: "prelaunch",
    address: null,
    startBlock: null,
    endBlock: null,
    runtimeCodeHash: null,
    canaryEvidence: null,
    classicCanaryEvidence: null,
    finalityConfirmations: null,
  });
  for (const key of Object.keys(descriptor.bindings)) {
    descriptor.bindings[key] = null;
  }
  return descriptor;
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function immutableCallResult(router, selector) {
  const values = new Map([
    [router.getters.chainId.selector, word(1n)],
    [router.getters.permitAuthority.selector, word(router.bindings.permitAuthority)],
    [
      router.getters.permitAuthorityRuntimeCodeHash.selector,
      router.bindings.permitAuthorityRuntimeCodeHash,
    ],
    [router.getters.graphFactory.selector, word(router.bindings.graphFactory)],
    [
      router.getters.graphFactoryRuntimeCodeHash.selector,
      router.bindings.graphFactoryRuntimeCodeHash,
    ],
    [router.getters.poolManager.selector, word(router.bindings.poolManager)],
    [
      router.getters.poolManagerRuntimeCodeHash.selector,
      router.bindings.poolManagerRuntimeCodeHash,
    ],
    [router.getters.token.selector, `0x${"0".repeat(64)}`],
  ]);
  const value = values.get(selector);
  assert.ok(value, `unexpected eth_call selector ${selector}`);
  return value;
}

function word(value) {
  if (typeof value === "bigint") return `0x${value.toString(16).padStart(64, "0")}`;
  return `0x${value.slice(2).toLowerCase().padStart(64, "0")}`;
}

function canonicalSignature(item) {
  return `${item.name}(${(item.inputs ?? []).map(canonicalType).join(",")})`;
}

function canonicalType(input) {
  if (!input.type.startsWith("tuple")) return input.type;
  const suffix = input.type.slice("tuple".length);
  return `(${(input.components ?? []).map(canonicalType).join(",")})${suffix}`;
}

function selectorOf(item) {
  return keccakText(canonicalSignature(item)).slice(0, 10);
}

function topicOf(item) {
  return keccakText(canonicalSignature(item));
}

function keccakText(value) {
  return keccak256(new TextEncoder().encode(value));
}
