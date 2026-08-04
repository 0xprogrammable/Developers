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

An event signature alone is not Programmable provenance. Accept events only
from a deployment in the current manifest and retain the chain, block hash,
transaction hash, transaction index, and log index.
