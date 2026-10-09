import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getAccountLinkingStatsOptions,
  getAccountLinkingStatsQueryKey,
  getCreditRegistrationAttentionItemsOptions,
  getCreditRegistrationAttentionItemsQueryKey,
  getCreditRegistrationEnrolmentChecksOptions,
  getCreditRegistrationErrorsByCodeOptions,
  getCreditRegistrationForAdminOptions,
  getCreditRegistrationLinkingCandidatesOptions,
  getCreditRegistrationOverviewOptions,
  getCreditRegistrationOverviewQueryKey,
  getCreditRegistrationPipelineHistoryOptions,
  getCreditRegistrationReconciliationOptions,
  getCreditRegistrationReconciliationQueryKey,
  getCreditRegistrationStatsByCourseOptions,
  getCreditRegistrationStatsByCourseQueryKey,
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
  CreditRegistrationAlertId,
  CreditRegistrationOverview,
  CreditRegistrationStatsByCourse,
  GetCreditRegistrationAttentionItemsData,
  ListCreditRegistrationAdminActionsData,
  ListCreditRegistrationsForAdminData,
  ListSuotarApiCallsData,
  ListVerifiedStudentNumbersForAdminData,
} from "@/generated/api/types.generated"

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
/** The shortest window the health endpoint reports. */
export const HOUR_SECS = 3600

/** The window the Linking page reads its linking email counts over. */
export const LINKING_STATS_WINDOW_DAYS = 30

const GC_TIME_MS = 5 * 60_000

// The global QueryClient sets gcTime/staleTime near zero, so without an opt-in every tab switch
// refetches everything. A polled query is fresh until its own interval is due anyway.
const polled = (intervalMs: number) => ({
  refetchInterval: intervalMs,
  staleTime: intervalMs,
  gcTime: GC_TIME_MS,
})

/** The alert banner and every tab badge share this key with the Overview tiles, so none can disagree. */
export const useCreditRegistrationOverview = () =>
  useQuery({
    ...getCreditRegistrationOverviewOptions(),
    ...polled(OVERVIEW_REFETCH_INTERVAL_MS),
    refetchOnWindowFocus: true,
  })

export const useSuotarHealth = () =>
  useQuery({
    ...getSuotarHealthOptions(),
    ...polled(OVERVIEW_REFETCH_INTERVAL_MS),
  })

/**
 * The call log for the filters currently in the URL. The caller-filter options come off this
 * response, so the previous page is kept while a new filter key loads rather than blanking both.
 */
export const useSuotarApiCalls = (query: NonNullable<ListSuotarApiCallsData["query"]>) =>
  useQuery({
    ...listSuotarApiCallsOptions({ query }),
    ...polled(CALL_LOG_REFETCH_INTERVAL_MS),
    placeholderData: keepPreviousData,
  })

export const useAdminCreditRegistrations = (
  query: NonNullable<ListCreditRegistrationsForAdminData["query"]>,
  { paused, enabled = true }: { paused: boolean; enabled?: boolean },
) =>
  useQuery({
    ...listCreditRegistrationsForAdminOptions({ query }),
    enabled,
    // A table that reshuffles under a click is worse than a stale one.
    refetchInterval: paused ? false : LIST_REFETCH_INTERVAL_MS,
    staleTime: LIST_REFETCH_INTERVAL_MS,
    gcTime: GC_TIME_MS,
  })

export const useAdminCreditRegistration = (creditRegistrationId: string) =>
  useQuery({
    ...getCreditRegistrationForAdminOptions({
      path: { credit_registration_id: creditRegistrationId },
    }),
    refetchInterval: (query) =>
      query.state.data?.registration.terminal_at ? false : LIVE_ITEM_REFETCH_INTERVAL_MS,
    staleTime: LIVE_ITEM_REFETCH_INTERVAL_MS,
    gcTime: GC_TIME_MS,
  })

/**
 * Fetches the code's enrolment list live from Sisu on every open; nothing is cached past the dialog.
 */
export const useLinkingCandidates = (creditRegistrationId: string, isEnabled: boolean) =>
  useQuery({
    ...getCreditRegistrationLinkingCandidatesOptions({
      path: { credit_registration_id: creditRegistrationId },
    }),
    enabled: isEnabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })

export const useAccountLinkingStats = (windowDays: number) =>
  useQuery({
    ...getAccountLinkingStatsOptions({ query: { window_days: windowDays } }),
    ...polled(LIST_REFETCH_INTERVAL_MS),
  })

export const useAdminVerifiedStudentNumbers = (
  query: NonNullable<ListVerifiedStudentNumbersForAdminData["query"]>,
) =>
  useQuery({
    ...listVerifiedStudentNumbersForAdminOptions({ query }),
    ...polled(LIST_REFETCH_INTERVAL_MS),
  })

export const useCreditRegistrationPhases = () =>
  useQuery({
    ...listCreditRegistrationPhasesOptions(),
    ...polled(PHASE_REFETCH_INTERVAL_MS),
  })

/** The Needs attention tab's sections. Each lists its oldest rows; every count covers all of them. */
export const useCreditRegistrationAttentionItems = (
  query: NonNullable<GetCreditRegistrationAttentionItemsData["query"]>,
) =>
  useQuery({
    ...getCreditRegistrationAttentionItemsOptions({ query }),
    ...polled(ATTENTION_REFETCH_INTERVAL_MS),
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

const alertTotal = (
  overview: CreditRegistrationOverview,
  ids: readonly CreditRegistrationAlertId[],
): number =>
  overview.health.alerts
    .filter((alert) => ids.includes(alert.id))
    .reduce((sum, alert) => sum + alert.count, 0)

// Both counts are phase counts, so their sum is still a number of phases.
const SYSTEM_ALERT_IDS: readonly CreditRegistrationAlertId[] = [
  "phase_failing",
  "phase_heartbeat_stale",
]

const selectNeedsAttention = (overview: CreditRegistrationOverview) =>
  overview.needs_attention_count

const selectUnhealthyPhases = (overview: CreditRegistrationOverview) =>
  alertTotal(overview, SYSTEM_ALERT_IDS)

const useOverviewCount = (select: (overview: CreditRegistrationOverview) => number) =>
  useQuery({
    ...getCreditRegistrationOverviewOptions(),
    ...polled(OVERVIEW_REFETCH_INTERVAL_MS),
    select,
  })

/** Registrations the detectors say need a human. */
export const useCreditRegistrationAttentionCount = () => useOverviewCount(selectNeedsAttention)

/**
 * Course modules whose current facts fail the configuration check.
 *
 * The same field the Courses page leads with, not the alert rule's count: a badge that disagrees
 * with the page it opens costs the reader more than it tells them.
 */
export const useCreditRegistrationMisconfiguredCourseCount = () =>
  useQuery({
    ...getCreditRegistrationStatsByCourseOptions(),
    ...polled(LIST_REFETCH_INTERVAL_MS),
    select: (stats: CreditRegistrationStatsByCourse) => stats.misconfigured_count,
  })

const BLOCKING_ALERT_IDS: readonly CreditRegistrationAlertId[] = [
  "phase_failing",
  "phase_heartbeat_stale",
  "pipeline_paused_globally",
  "roster_course_code_failing",
]

const selectHasBlockingAlert = (overview: CreditRegistrationOverview) =>
  alertTotal(overview, BLOCKING_ALERT_IDS) > 0

/**
 * Whether a processing phase is paused or late or a course code is failing: problems that hold up
 * many registrations, which the Needs attention count leaves out.
 */
export const useHasBlockingProblem = (): boolean => {
  const hasBlockingAlert = useQuery({
    ...getCreditRegistrationOverviewOptions(),
    ...polled(OVERVIEW_REFETCH_INTERVAL_MS),
    select: selectHasBlockingAlert,
  }).data
  const hasPausedPhase = useCreditRegistrationPhases().data?.phases.some(
    (phase) => phase.paused_at !== null && phase.paused_at !== undefined,
  )
  return Boolean(hasBlockingAlert || hasPausedPhase)
}

/** Pipeline phases that are failing or overdue. */
export const useCreditRegistrationUnhealthyPhaseCount = () =>
  useOverviewCount(selectUnhealthyPhases)

const ROSTER_ALERT_IDS: readonly CreditRegistrationAlertId[] = ["roster_course_code_failing"]

const selectFailingRosterCodes = (overview: CreditRegistrationOverview) =>
  alertTotal(overview, ROSTER_ALERT_IDS)

/** Course codes whose roster listing is backing off after repeated failures. */
export const useCreditRegistrationFailingRosterCodeCount = () =>
  useOverviewCount(selectFailingRosterCodes)

export const useCreditRegistrationErrorsByCode = (windowSecs: number) =>
  useQuery({
    ...getCreditRegistrationErrorsByCodeOptions({ query: { window_secs: windowSecs } }),
    ...polled(ATTENTION_REFETCH_INTERVAL_MS),
  })

/** A once-a-day series, so there is nothing to gain from polling it briskly. */
export const useCreditRegistrationPipelineHistory = (days: number) =>
  useQuery({
    ...getCreditRegistrationPipelineHistoryOptions({ query: { days } }),
    ...polled(HISTORY_REFETCH_INTERVAL_MS),
  })

export const useCreditRegistrationAdminActions = (
  query: NonNullable<ListCreditRegistrationAdminActionsData["query"]>,
) =>
  useQuery({
    ...listCreditRegistrationAdminActionsOptions({ query }),
    ...polled(LIST_REFETCH_INTERVAL_MS),
  })

/** Heavier queries over absences rather than rows, and slow-moving with it. */
export const useCreditRegistrationReconciliation = () =>
  useQuery({
    ...getCreditRegistrationReconciliationOptions(),
    ...polled(RECONCILIATION_REFETCH_INTERVAL_MS),
  })

/** Materializing creates ledger rows, so the counts the reconciliation panel sits under move too. */
export const useInvalidateAfterMaterialize = () => {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationReconciliationQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
      queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
    ])
}

/** The pacing dashboard: lateness, cost, population and findings for the chosen window. */
export const useCreditRegistrationEnrolmentChecks = (windowSecs: number) =>
  useQuery({
    ...getCreditRegistrationEnrolmentChecksOptions({ query: { window_secs: windowSecs } }),
    ...polled(LIST_REFETCH_INTERVAL_MS),
  })

export const useCreditRegistrationCourseStats = () =>
  useQuery({
    ...getCreditRegistrationStatsByCourseOptions(),
    ...polled(LIST_REFETCH_INTERVAL_MS),
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
