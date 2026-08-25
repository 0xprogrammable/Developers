const DEFAULT_ORIGIN = "https://developers.programmable.family"

export type Category = "classic" | "custom"
export type FinalityState = "observed" | "confirmed" | "finalized" | "orphaned"
export type FeedQuality = "ready" | "degraded" | "unavailable"

export interface TokenIdentity {
  address: string
  name: string | null
  symbol: string | null
  decimals: number | null
  [field: string]: unknown
}

export interface LaunchAsset {
  assetId: string
  role: string
  address?: string | null
  [field: string]: unknown
}

export interface MarketRecord {
  marketId: string
  kind: string
  status: string
  [field: string]: unknown
}

export interface ProviderAttribution {
  id: string
  displayName: string | null
  verificationStatus: "registry-bound" | "display-only" | "revoked"
  evidenceHash: string | null
  extensions: Record<string, unknown>
}

export interface LaunchRecord {
  schemaVersion: string
  launchId: string
  chainId: number
  category: Category
  token: TokenIdentity | null
  launch: Record<string, unknown>
  verification: Record<string, unknown>
  capabilities: unknown[]
  markets: MarketRecord[]
  fees: unknown[]
  extensions: Record<string, unknown>
  platformId?: "programmable"
  publicLabel?: "Programmable Classic" | "Programmable Custom"
  caip2?: string
  projectId?: string | null
  assets?: LaunchAsset[]
  provider?: ProviderAttribution | null
  finalityEvidence?: { status: FinalityState; [field: string]: unknown }
  [field: string]: unknown
}

export interface LaunchFeed {
  schemaVersion: string
  status: FeedQuality
  snapshot: Record<string, unknown> | null
  items: LaunchRecord[]
  page: {
    hasMore: boolean
    nextCursor: string | null
    resumeCursor: string | null
    [field: string]: unknown
  }
  [field: string]: unknown
}

export interface TokenList {
  schemaVersion: string
  status: FeedQuality
  name: string
  timestamp: string
  version: { major: 2; minor: number; patch: number }
  tokens: Array<Record<string, unknown>>
  [field: string]: unknown
}

export interface LaunchQuery {
  category?: Category
  chainId?: number
  after?: string
  cursor?: string
  limit?: number
}

export class ProgrammableClient {
  readonly origin: URL

  constructor(origin = DEFAULT_ORIGIN) {
    this.origin = new URL(origin)
    if (!new Set(["https:", "http:"]).has(this.origin.protocol)) {
      throw new Error("Programmable API origin must use HTTP or HTTPS")
    }
  }

  discovery(): Promise<Record<string, unknown>> {
    return this.get("/.well-known/programmable.json")
  }

  status(): Promise<Record<string, unknown>> {
    return this.get("/api/v2/status")
  }

  manifest(): Promise<Record<string, unknown>> {
    return this.get("/api/v2/manifest")
  }

  launches(query: LaunchQuery = {}): Promise<LaunchFeed> {
    if (query.after && query.cursor) {
      throw new Error("Use after to begin a poll or cursor to continue it, never both")
    }
    return this.get("/api/v2/launches", {
      category: query.category,
      chainId: query.chainId,
      after: query.after,
      cursor: query.cursor,
      limit: query.limit,
    })
  }

  launchById(launchId: string): Promise<LaunchRecord> {
    return this.get(`/api/v2/launches/${encodeURIComponent(required(launchId, "launchId"))}`)
  }

  launchByToken(chainId: number, tokenAddress: string): Promise<LaunchRecord> {
    if (!Number.isSafeInteger(chainId) || chainId <= 0) {
      throw new Error("chainId must be a positive safe integer")
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
      throw new Error("tokenAddress must be a 20-byte EVM address")
    }
    return this.get(`/api/v2/launches/${chainId}/${tokenAddress}`)
  }

  tokenList(query: Pick<LaunchQuery, "chainId" | "category"> = {}): Promise<TokenList> {
    return this.get("/api/v2/token-list", {
      chainId: query.chainId,
      category: query.category,
    })
  }

  private async get<T>(
    pathname: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(pathname, this.origin)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const response = await fetch(url, { headers: { accept: "application/json" } })
    if (!response.ok) {
      const problem = await response.json().catch(() => null) as
        | { detail?: unknown; title?: unknown }
        | null
      const detail =
        typeof problem?.detail === "string"
          ? problem.detail
          : typeof problem?.title === "string"
            ? problem.title
            : `Programmable API returned ${response.status}`
      throw new Error(detail)
    }

    return await response.json() as T
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${field} is required`)
  return normalized
}
