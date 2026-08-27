import { canonicalSha256 } from "./canonical.js";

export const LAUNCH_PARTNER_ATTRIBUTION_SCHEMA_VERSION =
  "programmable.launch-partner-attribution.v1";
export const LAUNCH_PARTNER_ATTRIBUTION_SOURCE =
  "authenticated-partner-api-key";
export const LAUNCH_PARTNER_ATTRIBUTION_VERSION = 1;

const EXACT_KEYS = Object.freeze([
  "attributionSource",
  "attributionVersion",
  "name",
  "partnerId",
  "schemaVersion",
  "snapshotDigest",
  "website",
]);
const OPEN_IDENTIFIER = /^[a-z0-9][a-z0-9._:-]*$/;
const SNAPSHOT_DIGEST = /^sha256:[0-9a-f]{64}$/;
const PROHIBITED_TEXT =
  /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactKeys(value) {
  if (!object(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === EXACT_KEYS.length &&
    actual.every((key, index) => key === EXACT_KEYS[index]);
}

function safeText(value, maximum) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= maximum && value.trim() === value &&
    !PROHIBITED_TEXT.test(value);
}

export function isCanonicalHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0 &&
      parsed.username === "" && parsed.password === "" &&
      parsed.href === value;
  } catch {
    return false;
  }
}

export function launchPartnerAttributionPreimage(value) {
  if (!object(value)) {
    throw new TypeError("launch partner attribution must be an object");
  }
  return {
    schemaVersion: value.schemaVersion,
    partnerId: value.partnerId,
    name: value.name,
    website: value.website,
    attributionSource: value.attributionSource,
    attributionVersion: value.attributionVersion,
  };
}

export function deriveLaunchPartnerAttributionSnapshotDigest(value) {
  return canonicalSha256(
    LAUNCH_PARTNER_ATTRIBUTION_SCHEMA_VERSION,
    launchPartnerAttributionPreimage(value),
  );
}

export function isExactLaunchPartnerAttribution(value) {
  if (
    !exactKeys(value) ||
    value.schemaVersion !== LAUNCH_PARTNER_ATTRIBUTION_SCHEMA_VERSION ||
    typeof value.partnerId !== "string" || value.partnerId.length > 128 ||
    !OPEN_IDENTIFIER.test(value.partnerId) ||
    !safeText(value.name, 128) ||
    !(value.website === null || isCanonicalHttpsUrl(value.website)) ||
    value.attributionSource !== LAUNCH_PARTNER_ATTRIBUTION_SOURCE ||
    value.attributionVersion !== LAUNCH_PARTNER_ATTRIBUTION_VERSION ||
    !SNAPSHOT_DIGEST.test(value.snapshotDigest ?? "")
  ) {
    return false;
  }
  return value.snapshotDigest ===
    deriveLaunchPartnerAttributionSnapshotDigest(value);
}

export function assertExactLaunchPartnerAttribution(value) {
  if (!isExactLaunchPartnerAttribution(value)) {
    throw new TypeError("launch partner attribution is invalid");
  }
  return value;
}
