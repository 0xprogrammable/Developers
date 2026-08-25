import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import path from "node:path";

import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import {
  assertValid,
  createSchemaRegistry,
} from "../scripts/lib/schema.mjs";

const PROFILE_KEY = "directNativeHookGraphProfileV1";
const EXTENSION_KEY = "programmable.direct-native-hook-graph-profile-v1";
const RECIPIENT = "0x4957f49620AFf3Adbbe8195a4f633E49cc93376c";
const ADMISSION_AUTHORITY = "0x755509eA6e3F5Ec1aA2E797bb68f1B87DD8b886b";
const ADMISSION_RUNTIME_HASH =
  "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c";

describe("Direct Native Hook Graph Profile V1 preview", () => {
  test("publishes one exact fail-closed descriptor", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const profile = manifest[PROFILE_KEY];
    const registry = await createSchemaRegistry("v2");
    const validate = registry.validator(
      "direct-native-hook-graph-profile-discovery-v1.schema.json",
    );

    assertValid(validate, profile, PROFILE_KEY);
    assert.equal(
      profile.schemaVersion,
      "programmable.direct-native-hook-graph-profile-discovery.v1",
    );
    assert.equal(profile.profileVersion, "1.0.0");
    assert.equal(profile.publicCategory, "custom");
    assert.equal(profile.releaseStage, "preview");
    assert.equal(profile.status, "gated");
    assert.equal(profile.productionLaunchAuthorized, false);
    assert.equal(profile.api.publiclyRoutable, false);
    assert.equal(profile.api.supportStatus, "integration-pending");
    assert.equal(profile.cli.supportStatus, "candidate-not-published");
    assert.deepEqual(profile.admissionTrustRoot, {
      kind: "EXISTING_IMMUTABLE_PERMIT_AUTHORITY",
      address: ADMISSION_AUTHORITY,
      runtimeCodeHash: ADMISSION_RUNTIME_HASH,
      defaultAction: "DENY",
      perLaunchExactReviewRequired: true,
      universalHookApproval: false,
      selfReportedHookConfigurationSufficient: false,
    });
    assert.equal(profile.feedContract.prelaunchProfileRecordsPublished, false);
    assert.equal(profile.feedContract.launchFeedPublication, "gated");
    assert.equal(profile.feedContract.tokenListPublication, "gated");

    for (const mutate of [
      (candidate) => { candidate.productionLaunchAuthorized = true; },
      (candidate) => { candidate.status = "live"; },
      (candidate) => { candidate.api.publiclyRoutable = true; },
      (candidate) => { candidate.cli.minimumSupportingVersion = "3.0.0-rc.1"; },
      (candidate) => { candidate.graphContract.minimumTargets = 2; },
      (candidate) => { candidate.graphContract.maximumTargets = 17; },
      (candidate) => { candidate.hookPermissions.supported.pop(); },
      (candidate) => { candidate.currencyContract.supportedPairs.push("native-native"); },
      (candidate) => { candidate.fundingAuthorizations.preSignatureExclusions.pop(); },
      (candidate) => { candidate.platformFee.programmableFeeHundredthsOfBip = "999"; },
      (candidate) => {
        candidate.profileSelectionBinding.platformFeeBinding
          .selectedTotalRangeHundredthsOfBip.minimum = "1000";
      },
      (candidate) => { candidate.admissionTrustRoot.address = RECIPIENT; },
      (candidate) => { candidate.feedContract.launchFeedPublication = "live"; },
    ]) {
      const candidate = structuredClone(profile);
      mutate(candidate);
      assert.equal(validate(candidate), false);
    }
  });

  test("binds graph, permissions, currencies, funding and fee semantics", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    const profile = manifest[PROFILE_KEY];

    assert.deepEqual(
      [profile.graphContract.minimumTargets, profile.graphContract.maximumTargets],
      [3, 16],
    );
    assert.deepEqual(
      [
        profile.graphContract.factoryMinimumTargets,
        profile.graphContract.factoryMaximumTargets,
      ],
      [1, 16],
    );
    assert.deepEqual(
      [
        profile.graphContract.routerMinimumTargets,
        profile.graphContract.routerMaximumTargets,
      ],
      [2, 16],
    );
    assert.equal(profile.graphContract.nativeHookTargets, "exactly-one");
    assert.equal(profile.graphContract.initializerTargets, "exactly-one");
    assert.deepEqual(profile.graphContract.requiredDistinctTargetRoles, [
      "token",
      "hook",
      "initializer",
    ]);
    assert.deepEqual(profile.graphContract.componentKinds, [
      "token",
      "hook",
      "other",
    ]);
    assert.deepEqual(profile.graphContract.componentKindByRole, {
      token: "token",
      hook: "hook",
      initializer: "other",
    });
    assert.equal(profile.graphContract.exclusiveComponentPerTargetRequired, true);
    assert.equal(profile.graphContract.expectedOutputsPerTarget, 1);
    assert.equal(profile.graphContract.exclusiveComponentsPerTarget, 1);
    assert.equal(profile.graphContract.targetResultIndexMapping, "one-to-one");
    assert.equal(profile.hookPermissions.supported.length, 14);
    assert.equal(profile.hookPermissions.mode, "per-launch-exact");
    assert.equal(profile.hookPermissions.selectionModel, "constrained-subset");
    assert.equal(profile.hookPermissions.arbitraryPowerSetAllowed, false);
    assert.ok(profile.hookPermissions.supported.includes("beforeSwapReturnDelta"));
    assert.ok(profile.hookPermissions.supported.includes("afterSwapReturnDelta"));
    assert.deepEqual(profile.hookPermissions.permissionDependencies, {
      beforeSwapReturnDelta: "beforeSwap",
      afterSwapReturnDelta: "afterSwap",
      afterAddLiquidityReturnDelta: "afterAddLiquidity",
      afterRemoveLiquidityReturnDelta: "afterRemoveLiquidity",
    });
    assert.equal(
      profile.hookPermissions.zeroPermissionPolicy,
      "v4-dynamic-fee-valid-but-not-profile-fee-capable",
    );
    assert.deepEqual(profile.hookPermissions.currentEnforcementSupport, {
      status: "canonical-volume-fee-v2-reference-only",
      policyId: "programmable-volume-fee-v2@2.0.0",
      referencePermissionMask: "0x20cc",
      variableOrCustomConformanceMode: "fail-closed-not-implemented",
    });
    assert.deepEqual(profile.currencyContract.supportedPairs, [
      "erc20-erc20",
      "native-erc20",
    ]);
    assert.equal(
      profile.currencyContract.nativeCurrencyAddress,
      "0x0000000000000000000000000000000000000000",
    );
    assert.equal(profile.currencyContract.nativeCurrencyPosition, "currency0-only");
    assert.equal(profile.currencyContract.canonicalAddressOrderingRequired, true);
    assert.equal(profile.currencyContract.distinctCurrenciesRequired, true);
    assert.equal(
      profile.currencyContract.tokenAndQuoteCurrencyMustEachMatchPoolCurrency,
      true,
    );
    assert.deepEqual(profile.currencyContract.lpFeePipsRange, {
      minimum: 0,
      maximum: 999999,
    });
    assert.equal(profile.api.apiVersion, "3");
    assert.equal(profile.api.plannedCollectionPath, "/v3/custom-launches");
    assert.equal(
      profile.api.plannedFundingAuthorizationPath,
      "/v3/wallet-admin/custom-launches/{launchId}/funding-authorization",
    );
    assert.equal(profile.api.plannedFundingAuthorizationMethod, "POST");
    assert.equal(
      profile.api.plannedFundingAuthorizationOperationRef,
      "https://programmable.market/openapi/custom-launch-v3.json#/paths/~1v3~1wallet-admin~1custom-launches~1%7BlaunchId%7D~1funding-authorization/post",
    );
    assert.equal(
      profile.fundingAuthorizations.flow,
      "two-stage-funding-authorization-then-router-transaction",
    );
    assert.equal(
      profile.fundingAuthorizations.fundingIntentHash.domain,
      "programmable.direct-native-hook-graph.funding-intent.v1",
    );
    assert.equal(
      profile.fundingAuthorizations.fundingIntentHash.abiTypes,
      "bytes32,uint256,address,address,address,bytes32,bytes32,bytes32,address,address,uint256,uint256,uint256",
    );
    assert.deepEqual(profile.fundingAuthorizations.fundingIntentHash.orderedFields, [
      "keccak256Utf8Domain",
      "chainId",
      "fundingToken",
      "router",
      "graphFactory",
      "routeNamespace",
      "routeNonce",
      "launchIntentHashAsBytes32",
      "from",
      "predictedInitializerTo",
      "exactValue",
      "validAfter",
      "validBefore",
    ]);
    assert.equal(
      profile.fundingAuthorizations.nonce.domain,
      "programmable.direct-native-hook-graph.funding-nonce.v1",
    );
    assert.ok(
      profile.fundingAuthorizations.launchIntentTransitiveBindings
        .includes("initializerSignaturePatchDescriptor"),
    );
    assert.deepEqual(profile.fundingAuthorizations.preSignatureExclusions, [
      "v",
      "r",
      "s",
      "initializerCalldataHash",
      "graphCommitment",
      "permitDigest",
    ]);
    assert.equal(
      profile.fundingAuthorizations.signatureSubmission.format,
      "strict-65-byte-signature",
    );
    assert.equal(profile.fundingAuthorizations.unlimitedApprovalRequired, false);
    assert.equal(profile.fundingAuthorizations.apiKeyOrAgentMaySign, false);
    assert.equal(profile.fundingAuthorizations.apiKeyOrAgentMayBroadcast, false);
    assert.deepEqual(profile.platformFee, {
      accountingMode: "inclusive-selected-total",
      rateDenominator: "1000000",
      programmableFeeHundredthsOfBip: "1000",
      minimumEffectiveSelectedHundredthsOfBip: "1000",
      recipient: RECIPIENT,
      readbackSelectors: {
        programmableHundredthsOfBip: "0x8a9585e4",
        programmableFeeOwner: "0x21466b6a",
        programmableFeePolicyHash: "0x677d6592",
        runtimeConfigurationHash: "0xca7751ad",
      },
    });
    assert.deepEqual(
      profile.profileSelectionBinding.requiredFields,
      [
        "schemaVersion",
        "profileId",
        "profileRevision",
        "targetRoles",
        "routeNamespace",
        "routeNonce",
        "hookPermissionMask",
        "predictedInitializer",
        "poolKey",
        "expectedPoolId",
        "fundingSignaturePatch",
        "platformFeeBinding",
      ],
    );
    assert.deepEqual(
      profile.profileSelectionBinding.targetRoles.componentKindByRole,
      {
        tokenTargetId: "token",
        hookTargetId: "hook",
        initializerTargetId: "other",
      },
    );
    assert.deepEqual(
      profile.profileSelectionBinding.poolKey.staticLpFeePipsRange,
      { minimum: 0, maximum: 999999 },
    );
    assert.deepEqual(
      profile.profileSelectionBinding.platformFeeBinding.requiredFields,
      [
        "targetId",
        "accountingMode",
        "rateDenominator",
        "programmableFeeHundredthsOfBip",
        "minimumEffectiveSelectedHundredthsOfBip",
        "selectedBuyHundredthsOfBip",
        "selectedSellHundredthsOfBip",
        "recipient",
        "readbackSelectors",
      ],
    );
    assert.deepEqual(
      profile.profileSelectionBinding.platformFeeBinding.readbackSelectors,
      profile.platformFee.readbackSelectors,
    );
    assert.deepEqual(
      profile.profileSelectionBinding.platformFeeBinding
        .selectedTotalRangeHundredthsOfBip,
      { minimum: "0", maximum: "999999" },
    );
    assert.equal(
      profile.profileSelectionBinding.platformFeeBinding.effectiveTotalFormula,
      "max-selected-total-and-1000",
    );
    assert.equal(
      profile.profileSelectionBinding.platformFeeBinding.projectFeeFormula,
      "effective-total-minus-1000",
    );
    assert.equal(profile.feePolicy.policyId, "programmable-volume-fee-v2@2.0.0");
    assert.equal(profile.feePolicy.referenceKernel.permissionMask, "0x20cc");
    assert.equal(
      profile.feePolicy.referenceKernel.variableOrCustomConformanceMode,
      "fail-closed-not-implemented",
    );
    assert.equal(profile.reviewAdmission.requiredFields.length, 13);
    assert.equal(profile.reviewAdmission.separateInitializerTrustRootRequired, false);
    assert.equal(profile.evidenceStatus.genericClaiming, "not-live");
    assert.equal(profile.evidenceStatus.buybacks, "not-live");
  });

  test("advertises preview discovery without publishing a launch", async () => {
    const [wellKnown, schemaIndex, guide, status, httpReference] = await Promise.all([
      readJson(path.join(REPOSITORY_ROOT, "public/.well-known/programmable.json")),
      readJson(path.join(REPOSITORY_ROOT, "schema-index-v2.json")),
      readFile(
        path.join(
          REPOSITORY_ROOT,
          "docs/guides/direct-native-hook-graph-profile-v1.md",
        ),
        "utf8",
      ),
      readFile(path.join(REPOSITORY_ROOT, "docs/status.md"), "utf8"),
      readFile(path.join(REPOSITORY_ROOT, "docs/reference/http-api.md"), "utf8"),
    ]);
    const extension = wellKnown.extensions[EXTENSION_KEY];

    assert.deepEqual(
      {
        discoverySchemaVersion: extension.discoverySchemaVersion,
        discoverySchemaUrl: extension.discoverySchemaUrl,
        profileId: extension.profileId,
        profileVersion: extension.profileVersion,
        status: extension.status,
        releaseStage: extension.releaseStage,
        productionLaunchAuthorized: extension.productionLaunchAuthorized,
        apiVersion: extension.apiVersion,
        apiSupportStatus: extension.apiSupportStatus,
        cliCandidateVersion: extension.cliCandidateVersion,
        cliSupportStatus: extension.cliSupportStatus,
        plannedFundingAuthorizationMethod:
          extension.plannedFundingAuthorizationMethod,
        plannedFundingAuthorizationOperationRef:
          extension.plannedFundingAuthorizationOperationRef,
        fundingFlow: extension.fundingFlow,
        platformFeeAccountingMode: extension.platformFeeAccountingMode,
        feedPublicationStatus: extension.feedPublicationStatus,
        admissionTrustRootStatus: extension.admissionTrustRootStatus,
        admissionTrustRootAddress: extension.admissionTrustRootAddress,
        admissionTrustRootRuntimeCodeHash:
          extension.admissionTrustRootRuntimeCodeHash,
      },
      {
        discoverySchemaVersion:
          "programmable.direct-native-hook-graph-profile-discovery.v1",
        discoverySchemaUrl:
          "https://developers.programmable.family/schemas/v2/direct-native-hook-graph-profile-discovery-v1.schema.json",
        profileId: "programmable.direct-native-hook-graph.v1",
        profileVersion: "1.0.0",
        status: "gated",
        releaseStage: "preview",
        productionLaunchAuthorized: false,
        apiVersion: "3",
        apiSupportStatus: "integration-pending",
        cliCandidateVersion: "3.0.0-rc.1",
        cliSupportStatus: "candidate-not-published",
        plannedFundingAuthorizationMethod: "POST",
        plannedFundingAuthorizationOperationRef:
          "https://programmable.market/openapi/custom-launch-v3.json#/paths/~1v3~1wallet-admin~1custom-launches~1%7BlaunchId%7D~1funding-authorization/post",
        fundingFlow: "two-stage-funding-authorization-then-router-transaction",
        platformFeeAccountingMode: "inclusive-selected-total",
        feedPublicationStatus: "gated",
        admissionTrustRootStatus: "existing-authority-profile-admission-pending",
        admissionTrustRootAddress: ADMISSION_AUTHORITY,
        admissionTrustRootRuntimeCodeHash: ADMISSION_RUNTIME_HASH,
      },
    );
    assert.ok(
      schemaIndex.schemas.some(
        ({ name }) => name === "direct-native-hook-graph-profile-discovery-v1",
      ),
    );
    for (const source of [guide, status, httpReference]) {
      assert.match(source, /gated preview|preview contract|gated/i);
      assert.match(source, /integration-pending|not published|not publicly routable/i);
    }
    assert.match(guide, /3 through 16/i);
    assert.match(guide, /Router target range.*2 through 16/is);
    assert.match(guide, /not an arbitrary power set/i);
    assert.match(guide, /wallet.*separately.*sign/is);
    assert.match(guide, /fundingIntentHash/iu);
    assert.match(guide, /profile-discovery\.v1/iu);
    assert.match(guide, /initializer role uses `other`/iu);
    assert.match(guide, /`1000000` is invalid/iu);
    assert.match(guide, /permitDigest/iu);
    assert.match(guide, /real operation|Funding OpenAPI operation/iu);
    assert.match(guide, /not `31000`/iu);
    assert.match(guide, /existing immutable Router permit authority/i);
    assert.match(guide, /Generic fee claiming.*not live/is);
    assert.match(httpReference, /creates no prelaunch item/i);
  });

  test("keeps the V3 preview descriptor optional for older v2 consumers", async () => {
    const manifest = await readJson(
      path.join(REPOSITORY_ROOT, "deployments/ethereum-v2.json"),
    );
    delete manifest[PROFILE_KEY];
    assertValid(
      (await createSchemaRegistry("v2")).validator("manifest.schema.json"),
      manifest,
      "v2 manifest without optional V3 direct-hook preview",
    );
  });
});
