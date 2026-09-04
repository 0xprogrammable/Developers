import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {developerManifestForChain} from '../server/chain-manifests.js';
import {activeFinalizedV4Binding} from '../server/finalized-v4-feed.js';
import {createSchemaRegistry,assertValid} from '../scripts/lib/schema.mjs';
import {validateManifestSemantics} from '../scripts/lib/semantics.mjs';

const manifest=await developerManifestForChain(4663);
const registry=await createSchemaRegistry('v2');

test('direct-chain roots are independently released without opening hosted indexing or writes',()=>{
 assertValid(registry.validator('manifest.schema.json'),manifest,'Robinhood direct-chain manifest');
 assert.deepEqual(validateManifestSemantics(manifest),[]);
 assert.equal(manifest.publicCategories.custom.discoveryStatus,'live');
 assert.equal(manifest.directChainIntegration.publicLabel,'Programmable Custom');
 assert.equal(manifest.customLaunchV4.status,'planned');
 assert.equal(manifest.customLaunchV4.cli.status,'planned');
 assert.equal(activeFinalizedV4Binding(manifest),null);
});

test('direct-chain publication rejects absent finality, switched roots, and accidental hosted activation',()=>{
 for(const mutate of [
  m=>{m.directChainIntegration.publicWrites=true;},
  m=>{m.directChainIntegration.finality.mode='confirmations';},
  m=>{m.directChainIntegration.finality.explicitBlockRequiresFinalizedAncestor=false;},
  m=>{m.directChainIntegration.profile.profileDigest=`sha256:${'1'.repeat(64)}`;},
  m=>{m.launchStampRouter.startBlock='1';},
  m=>{m.extensions['programmable/read-model-v1'].status='live';},
  m=>{m.extensions['programmable/read-model-v1'].absenceAuthoritative=true;},
  m=>{m.customLaunchV4.api.status='live';},
  m=>{m.customLaunchV4.cli.status='live';},
 ]) {
  const changed=structuredClone(manifest); mutate(changed);
  assert.ok(validateManifestSemantics(changed).length>0,'changed trust boundary must fail semantics');
 }
});

test('public finalized launch evidence binds the canonical Router canary and deployment',async()=>{
 const evidence=JSON.parse(await readFile(new URL('../deployments/robinhood-direct-chain-evidence-v1.json',import.meta.url),'utf8'));
 assert.equal(evidence.chainId,4663);
 assert.equal(evidence.platformId,'programmable');
 assert.equal(evidence.category,'custom');
 assert.equal(evidence.publicLabel,'Programmable Custom');
 const canary=manifest.launchStampRouter.canaryEvidence;
 for(const key of ['transactionHash','blockNumber','blockHash','launchId'])
  assert.equal(evidence.launch[key],canary[key],key);
 assert.equal(evidence.deployment.transactionHash,manifest.robinhoodCustomLaunchBinding.deployment.transactionHash);
 assert.equal(evidence.deployment.blockNumber,manifest.launchStampRouter.startBlock);
 assert.ok(BigInt(evidence.finalizedCheckpoint.blockNumber)>=BigInt(canary.blockNumber));
 assert.equal(evidence.finalizedCheckpoint.tag,'finalized');
});
