import type { RefreshIndicator } from "@/shared-module/components"

/** How often the agent changes pages refetch while a changeset can still change. */
export const AGENT_CHANGESETS_REFETCH_INTERVAL_MS = 30_000

/** Refetches on an interval must not blur the page or block clicks. */
export const QUIET_REFRESH: RefreshIndicator = "quiet"
