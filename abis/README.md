# Verification ABIs

This directory contains minimal event ABIs for legacy launch discovery and full
verification ABIs for current provenance interfaces. Legacy deployment history
is recorded in [`deployments/ethereum.json`](../deployments/ethereum.json).
Current version 2 deployment identities are recorded in
[`deployments/ethereum-v2.json`](../deployments/ethereum-v2.json) and the live
manifest. Resolve addresses and start blocks from the manifest; do not bind an
integration to one launcher address.

| File | Deployments |
| --- | --- |
| `ethereum/classic-v2-launcher.json` | Classic v1 and v2 launch events |
| `ethereum/classic-v3-launcher.json` | Classic v3 launch events |
| `ethereum/stock-paired-launcher.json` | Stock-Paired v1, v2, and v3 launch events |
| `ethereum/stock-paired-coordinator.json` | Stock-Paired ETH coordinator event |
| `ethereum/programmable-custom-registry-v1.json` | Full normative Custom Registry V1 ABI |
| `ethereum/programmable-launch-stamp-router-v1.json` | Frozen Router V1 verification ABI for Router-stamped Classic and Custom launches; authoritative only when its hash and deployment identity match top-level `launchStampRouter` |

The Router file is the exact 44-item ABI from Forge artifact commit
`0a7134bbb912222639627fb9078df2f8dd3a6c38`. Its published ABI-file SHA-256 is
`bb4e728e9f9c850eb01f928e8a798ac206a82e241a8d93b3b3c686635c88ed86`.
The interface is frozen and the Router is live. Resolve its current address,
start block, runtime identity, finality policy, and immutable production
bindings from the [live version 2 manifest](https://developers.programmable.family/api/v2/manifest).
The repository snapshot is
[`deployments/ethereum-v2.json`](../deployments/ethereum-v2.json); this ABI file
is not deployment authority.

The Custom Registry ABI is intentionally full rather than event-only because
approval and registration integrations must use its canonical hash helpers.
Resolve its address, start block, runtime hash, event-set pin, and generation
from the version 2 manifest.

## Prelaunch Custom Generation 2 candidates

The following files are byte-for-byte ABI exports from contract release-candidate commit `e01f36a6d69136f674c203f83cca3ebdde0e0ded`:

| Candidate file | SHA-256 |
| --- | --- |
| `candidates/programmable-custom-registry-v2.json` | `7c5fe7d25cc874a319c3621435c31cd8f531a7abfcd7d5073fc163d10d60524f` |
| `candidates/programmable-custom-partner-factory-registry-v2.json` | `054b5d2740314335d202e37d405273cbb9d0922398cbc2909e7cb7cee845061e` |
| `candidates/programmable-custom-fee-policy-verifier-v2.json` | `0bc9bdda4a1e78e2c498568ddfa164b35c3cb5c297f563dd4771935e75304f62` |
| `candidates/programmable-custom-atomic-registrar-v2.json` | `a053f14e59c3c54a0dad47e6e772ba411c7659a46eab3313a6c124260ebcff1f` |

The snapshot's ordered 15-event candidate is published at [`event-sets/candidates/programmable-custom-registry-v2.json`](../event-sets/candidates/programmable-custom-registry-v2.json); its snapshot semantic event-set hash is `sha256:bcff2958529fecaa7ef8c4c654389829bfb7dd61a3246f0d681cf7db0a42a58c`. The fail-closed snapshot metadata is published at [`specifications/custom-registry-generation-2.release-candidate.json`](../specifications/custom-registry-generation-2.release-candidate.json).

These files are not the final Generation 2 ABI authority. The Public Registry root is still changing execution-policy, ordered route, and market-data-source evidence. That work changes ABI, topics, event count, Solidity hash preimages, artifact hashes, and the artifact-set hash. A byte-identical parity follow-up against the final Public commit and its Foundry golden vectors is mandatory before manifest activation.

These are integration candidates, not live deployment evidence. They have no published address, start block, runtime identity, verified source deployment, or canary. Do not scan them until the official v2 manifest publishes a complete Generation 2 four-contract set.

An event signature alone is not Programmable provenance. Accept events only
from a deployment in the current manifest and retain the chain, block hash,
transaction hash, transaction index, and log index.
