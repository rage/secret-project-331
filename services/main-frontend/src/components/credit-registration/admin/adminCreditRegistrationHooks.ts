import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getAccountLinkingStatsOptions,
  getAccountLinkingStatsQueryKey,
  getCreditRegistrationAttentionItemsOptions,
  getCreditRegistrationAttentionItemsQueryKey,
  getCreditRegistrationErrorsByCodeOptions,
  getCreditRegistrationForAdminOptions,
  getCreditRegistrationOverviewOptions,
  getCreditRegistrationOverviewQueryKey,
  getCreditRegistrationPipelineHistoryOptions,
  getCreditRegistrationReconciliationOptions,
  getCreditRegistrationReconciliationQueryKey,
  getCreditRegistrationStatsByCourseOptions,
  getCreditRegistrationStatsByCourseQueryKey,
  getCreditRegistrationThresholdsOptions,
  getSuotarHealthOptions,
  listCreditRegistrationAdminActionsOptions,
  listCreditRegistrationPhasesOptions,
  listCreditRegistrationsForAdminOptions,
  listCreditRegistrationsForAdminQueryKey,
  listSuotarApiCallsOptions,
  listVerifiedStudentNumbersForAdminOptions,
  listVerifiedStudentNumbersForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  ListCreditRegistrationAdminActionsData,
  ListCreditRegistrationsForAdminData,
  ListSuotarApiCallsData,
  ListVerifiedStudentNumbersForAdminData,
} from "@/generated/api/types.generated"

import { phaseNeedsAttention } from "./phaseStatus"

/** Group-bys over the ledger, so not a cheap read. */
const OVERVIEW_REFETCH_INTERVAL_MS = 30_000
const LIST_REFETCH_INTERVAL_MS = 60_000
const LIVE_ITEM_REFETCH_INTERVAL_MS = 5_000
/** Matches the other pod views in the repo: a wedged phase should show within seconds. */
const PHASE_REFETCH_INTERVAL_MS = 10_000
const ATTENTION_REFETCH_INTERVAL_MS = 20_000
/** The tab an operator sits on during an incident. */
const CALL_LOG_REFETCH_INTERVAL_MS = 15_000
const RECONCILIATION_REFETCH_INTERVAL_MS = 120_000
const HISTORY_REFETCH_INTERVAL_MS = 300_000
/** The shortest window the health endpoint reports, which is the one the tab badge reads. */
export const HOUR_SECS = 3600

/** The alert banner shares this key with the Overview tiles, so the two cannot disagree. */
export const useCreditRegistrationOverview = () =>
  useQuery({
    ...getCreditRegistrationOverviewOptions(),
    refetchInterval: OVERVIEW_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

export const useSuotarHealth = () =>
  useQuery({
    ...getSuotarHealthOptions(),
    refetchInterval: OVERVIEW_REFETCH_INTERVAL_MS,
  })

/**
 * Calls the study registry rejected wholesale in the last hour, which is the API log's tab badge.
 * Read off the health windows rather than the call log so no clock arithmetic reaches a query key.
 */
export const useSuotarRequestFailureCount = () =>
  useQuery({
    ...getSuotarHealthOptions(),
    refetchInterval: OVERVIEW_REFETCH_INTERVAL_MS,
    select: (health) =>
      (health.windows.find((window) => window.window_secs === HOUR_SECS)?.endpoints ?? []).reduce(
        (sum, endpoint) => sum + endpoint.failed_call_count,
        0,
      ),
  })

export const useSuotarApiCalls = (query: NonNullable<ListSuotarApiCallsData["query"]>) =>
  useQuery({
    ...listSuotarApiCallsOptions({ query }),
    refetchInterval: CALL_LOG_REFETCH_INTERVAL_MS,
  })

export const useAdminCreditRegistrations = (
  query: NonNullable<ListCreditRegistrationsForAdminData["query"]>,
  { paused }: { paused: boolean },
) =>
  useQuery({
    ...listCreditRegistrationsForAdminOptions({ query }),
    // A table that reshuffles under a click is worse than a stale one.
    refetchInterval: paused ? false : LIST_REFETCH_INTERVAL_MS,
  })

export const useAdminCreditRegistration = (creditRegistrationId: string) =>
  useQuery({
    ...getCreditRegistrationForAdminOptions({
      path: { credit_registration_id: creditRegistrationId },
    }),
    refetchInterval: (query) =>
      query.state.data?.registration.terminal_at ? false : LIVE_ITEM_REFETCH_INTERVAL_MS,
  })

export const useAccountLinkingStats = (windowDays: number) =>
  useQuery({
    ...getAccountLinkingStatsOptions({ query: { window_days: windowDays } }),
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
  })

export const useAdminVerifiedStudentNumbers = (
  query: NonNullable<ListVerifiedStudentNumbersForAdminData["query"]>,
) =>
  useQuery({
    ...listVerifiedStudentNumbersForAdminOptions({ query }),
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
  })

export const useCreditRegistrationPhases = () =>
  useQuery({
    ...listCreditRegistrationPhasesOptions(),
    refetchInterval: PHASE_REFETCH_INTERVAL_MS,
  })

export const useCreditRegistrationPhasesNeedingAttentionCount = () =>
  useQuery({
    ...listCreditRegistrationPhasesOptions(),
    refetchInterval: PHASE_REFETCH_INTERVAL_MS,
    select: (list) => list.phases.filter(phaseNeedsAttention).length,
  })

/** The thresholds the detectors and the alert rules share, so the page never states a number of its own. */
export const useCreditRegistrationThresholds = () =>
  useQuery(getCreditRegistrationThresholdsOptions())

export const useCreditRegistrationAttentionItems = () =>
  useQuery({
    ...getCreditRegistrationAttentionItemsOptions(),
    refetchInterval: ATTENTION_REFETCH_INTERVAL_MS,
  })

export const useCreditRegistrationAttentionCount = () =>
  useQuery({
    ...getCreditRegistrationAttentionItemsOptions(),
    refetchInterval: ATTENTION_REFETCH_INTERVAL_MS,
    select: (items) => items.total_count,
  })

export const useInvalidateAttentionItems = () => {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationAttentionItemsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
    ])
}

export const useCreditRegistrationErrorsByCode = (windowSecs: number) =>
  useQuery({
    ...getCreditRegistrationErrorsByCodeOptions({ query: { window_secs: windowSecs } }),
    refetchInterval: ATTENTION_REFETCH_INTERVAL_MS,
  })

/** A once-a-day series, so there is nothing to gain from polling it briskly. */
export const useCreditRegistrationPipelineHistory = (days: number) =>
  useQuery({
    ...getCreditRegistrationPipelineHistoryOptions({ query: { days } }),
    refetchInterval: HISTORY_REFETCH_INTERVAL_MS,
  })

export const useCreditRegistrationAdminActions = (
  query: NonNullable<ListCreditRegistrationAdminActionsData["query"]>,
) =>
  useQuery({
    ...listCreditRegistrationAdminActionsOptions({ query }),
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
  })

/** Heavier queries over absences rather than rows, and slow-moving with it. */
export const useCreditRegistrationReconciliation = () =>
  useQuery({
    ...getCreditRegistrationReconciliationOptions(),
    refetchInterval: RECONCILIATION_REFETCH_INTERVAL_MS,
  })

export const useCreditRegistrationFindingCount = () =>
  useQuery({
    ...getCreditRegistrationReconciliationOptions(),
    refetchInterval: RECONCILIATION_REFETCH_INTERVAL_MS,
    select: (reconciliation) => reconciliation.finding_count,
  })

export const useInvalidateReconciliation = () => {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: getCreditRegistrationReconciliationQueryKey() })
}

export const useCreditRegistrationCourseStats = () =>
  useQuery({
    ...getCreditRegistrationStatsByCourseOptions(),
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
  })

export const useCreditRegistrationMisconfiguredCourseCount = () =>
  useQuery({
    ...getCreditRegistrationStatsByCourseOptions(),
    refetchInterval: LIST_REFETCH_INTERVAL_MS,
    select: (stats) => stats.misconfigured_count,
  })

export const useInvalidateCourseStats = () => {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: getCreditRegistrationStatsByCourseQueryKey() })
}

/** Both the unlink and manual-link mutations recompute linking preconditions, so they invalidate the same surfaces. */
export const useInvalidateAfterLinkingChange = () => {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: listVerifiedStudentNumbersForAdminQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getAccountLinkingStatsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
    ])
}
