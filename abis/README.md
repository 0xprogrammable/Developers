# Event ABIs

These minimal event ABIs are the direct-onchain discovery surface for the
deployments listed in [`deployments/ethereum.json`](../deployments/ethereum.json).
Resolve addresses and start blocks from the manifest; do not bind an
integration to one launcher address.

| File | Deployments |
| --- | --- |
| `ethereum/classic-v2-launcher.json` | Classic v1 and v2 launch events |
| `ethereum/classic-v3-launcher.json` | Classic v3 launch events |
| `ethereum/stock-paired-launcher.json` | Stock-Paired v1, v2, and v3 launch events |
| `ethereum/stock-paired-coordinator.json` | Stock-Paired ETH coordinator event |

## Prelaunch Custom Generation 2 candidates

The following files are byte-for-byte ABI exports from contract release-candidate commit `e01f36a6d69136f674c203f83cca3ebdde0e0ded`:

| Candidate file | SHA-256 |
| --- | --- |
| `candidates/programmable-custom-registry-v2.json` | `7c5fe7d25cc874a319c3621435c31cd8f531a7abfcd7d5073fc163d10d60524f` |
| `candidates/programmable-custom-partner-factory-registry-v2.json` | `054b5d2740314335d202e37d405273cbb9d0922398cbc2909e7cb7cee845061e` |
| `candidates/programmable-custom-fee-policy-verifier-v2.json` | `0bc9bdda4a1e78e2c498568ddfa164b35c3cb5c297f563dd4771935e75304f62` |
| `candidates/programmable-custom-atomic-registrar-v2.json` | `a053f14e59c3c54a0dad47e6e772ba411c7659a46eab3313a6c124260ebcff1f` |

The ordered 15-event candidate is `fixtures/v2/custom-registry-event-set-v2.candidate.json`; its semantic event-set hash is `sha256:bcff2958529fecaa7ef8c4c654389829bfb7dd61a3246f0d681cf7db0a42a58c`.

These are integration candidates, not live deployment evidence. They have no published address, start block, runtime identity, verified source deployment, or canary. Do not scan them until the official v2 manifest publishes a complete Generation 2 four-contract set.

An event signature alone is not Programmable provenance. Accept events only
from a deployment in the current manifest and retain the chain, block hash,
transaction hash, transaction index, and log index.
