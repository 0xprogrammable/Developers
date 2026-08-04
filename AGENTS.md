# Repository working rules

## Public contract

- Keep `classic` and `custom` as the only public launch categories.
- Preserve the v1 compatibility contract in `compatibility/core-v1.json`.
- Never remove, rename, or reinterpret a v1 field. Breaking changes require a
  parallel major version.
- Keep every recognized launch discoverable even when metadata, a pool, a
  chart, or an execution adapter is unavailable.
- Do not invent prices, liquidity, volume, pools, provenance, finality, or
  support state. Use explicit unavailable, unknown, partial, or prelaunch
  states.
- The public v1 API is read-only. Metadata, extensions, and adapter descriptors
  must never authorize a transaction or supply executable calldata.
- Deployment addresses and start blocks belong in the manifest, not consumer
  examples.

## Changes

1. Update schemas, fixtures, semantics, docs, OpenAPI, and examples together.
2. Keep Custom examples visibly prelaunch until deployment evidence exists.
3. Run `npm run build` and `npm run check` before committing.
4. Run `npm run smoke:live` only against an intentionally selected live target.
5. Do not commit secrets, generated `public/{abis,deployments,openapi,schemas}`
   trees, or local Vercel state.
