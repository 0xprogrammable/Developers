import assert from "node:assert/strict";
import { describe, test } from "node:test";
import path from "node:path";

import { readJson, REPOSITORY_ROOT } from "../scripts/lib/files.mjs";
import { createSchemaRegistry } from "../scripts/lib/schema.mjs";
import { validateLaunchSemantics } from "../scripts/lib/semantics.mjs";
import {
  deriveLaunchPartnerAttributionSnapshotDigest,
  isExactLaunchPartnerAttribution,
} from "../server/partner-attribution.js";
import { projectV2Record, publicLaunchV2 } from "../server/v2-dataset.js";

const registry = await createSchemaRegistry("v2");
const attributionFixture = await readJson(path.join(
  REPOSITORY_ROOT,
  "fixtures/v2/attribution/launch-partner-attribution-v1.json",
));
const launchFixture = await readJson(path.join(
  REPOSITORY_ROOT,
  "fixtures/v2/launches/custom-complete-metadata-prelaunch.json",
));

describe("launch partner attribution", () => {
  test("binds the exact authenticated-partner snapshot", () => {
    const validate = registry.validator(
      "launch-partner-attribution-v1.schema.json",
    );
    assert.equal(validate(attributionFixture), true, JSON.stringify(validate.errors));
    assert.equal(isExactLaunchPartnerAttribution(attributionFixture), true);
    assert.equal(
      deriveLaunchPartnerAttributionSnapshotDigest(attributionFixture),
      attributionFixture.snapshotDigest,
    );

    for (const mutate of [
      (value) => { value.name = "Different Partner"; },
      (value) => { value.website = "https://partner.example"; },
      (value) => { value.snapshotDigest = `sha256:${"0".repeat(64)}`; },
      (value) => { value.slug = "fixture-partner"; },
      (value) => { value.verificationStatus = "server-verified"; },
    ]) {
      const candidate = structuredClone(attributionFixture);
      mutate(candidate);
      assert.equal(isExactLaunchPartnerAttribution(candidate), false);
    }
  });

  test("keeps launchedVia additive in the v2 read projection", () => {
    const candidate = structuredClone(launchFixture);
    candidate.launch.status = "live";
    candidate.launch.finality = "finalized";
    candidate.partnerAttribution = structuredClone(attributionFixture);
    const publicRecord = publicLaunchV2(projectV2Record(candidate));
    const validate = registry.validator("launch.schema.json");
    assert.equal(validate(publicRecord), true, JSON.stringify(validate.errors));
    assert.deepEqual(publicRecord.launchedVia, attributionFixture);
    assert.equal(publicRecord.partnerAttribution, undefined);
    assert.equal(publicRecord.category, "custom");
  });

  test("rejects conflicting source and public attribution snapshots", () => {
    const candidate = structuredClone(launchFixture);
    candidate.launch.status = "live";
    candidate.launch.finality = "finalized";
    candidate.partnerAttribution = structuredClone(attributionFixture);
    candidate.launchedVia = structuredClone(attributionFixture);
    candidate.launchedVia.name = "Conflicting Partner";
    candidate.launchedVia.snapshotDigest =
      deriveLaunchPartnerAttributionSnapshotDigest(candidate.launchedVia);
    assert.throws(() => projectV2Record(candidate), /projections conflict/u);
  });

  test("rejects source attribution before finalized Custom provenance", () => {
    const candidate = structuredClone(launchFixture);
    candidate.partnerAttribution = structuredClone(attributionFixture);
    assert.throws(
      () => projectV2Record(candidate),
      /requires finalized Custom provenance/u,
    );
  });

  test("publishes attribution only with finalized complete Custom metadata", () => {
    const prelaunch = structuredClone(launchFixture);
    prelaunch.launchedVia = structuredClone(attributionFixture);
    assert.ok(validateLaunchSemantics(prelaunch).some(
      (item) =>
        item.code === "LAUNCH_PARTNER_ATTRIBUTION_FINALIZED_REQUIRED",
    ));

    const incomplete = structuredClone(prelaunch);
    incomplete.token.metadata.imageUrl = null;
    assert.ok(validateLaunchSemantics(incomplete).some(
      (item) => item.code === "LAUNCH_PARTNER_METADATA_INCOMPLETE",
    ));

    const conflicting = structuredClone(prelaunch);
    conflicting.presentation.website = "https://different.example/";
    assert.ok(validateLaunchSemantics(conflicting).some(
      (item) => item.code === "LAUNCH_PARTNER_METADATA_CONFLICT",
    ));

    const classic = structuredClone(prelaunch);
    classic.category = "classic";
    classic.publicLabel = "Programmable Classic";
    assert.ok(validateLaunchSemantics(classic).some(
      (item) => item.code === "LAUNCH_PARTNER_ATTRIBUTION_CUSTOM_ONLY",
    ));
  });

  test("does not let an attribution claim verification or safety semantics", () => {
    const forged = structuredClone(attributionFixture);
    forged.safetyStatus = "safe";
    const validate = registry.validator(
      "launch-partner-attribution-v1.schema.json",
    );
    assert.equal(validate(forged), false);
    assert.equal(isExactLaunchPartnerAttribution(forged), false);
  });
});
