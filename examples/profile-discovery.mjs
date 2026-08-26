import { fetchJson, object } from "./lib/programmable-client.mjs";

const manifest = await fetchJson("/api/v2/manifest");
const profile = object(object(manifest).directNativeHookGraphProfileV2);

if (
  profile.schemaVersion !==
    "programmable.direct-native-hook-graph-profile-discovery.v2" ||
  profile.publicCategory !== "custom" ||
  profile.productionLaunchAuthorized !== true ||
  object(profile.api).publiclyRoutable !== true
) {
  throw new Error("Direct Native Hook Graph Profile V2 is not live");
}

console.log(JSON.stringify({
  profileId: profile.profileId,
  profileRevision: profile.profileRevision,
  category: profile.publicCategory,
  apiVersion: object(profile.api).apiVersion,
  cliVersion: object(profile.cli).releaseVersion,
  targetRange: [
    object(profile.graphContract).minimumTargets,
    object(profile.graphContract).maximumTargets,
  ],
  hookPermissionMaskRange: [
    object(profile.hookPermissions).minimumMask,
    object(profile.hookPermissions).maximumMask,
  ],
  fundingModes: object(profile.fundingPolicy).supportedModes,
  liquidityModels: Object.keys(object(object(profile.liquidityPolicy).models)),
  walletSignsSeparately: true,
}, null, 2));
