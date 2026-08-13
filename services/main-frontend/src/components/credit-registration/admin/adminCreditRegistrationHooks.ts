import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getAccountLinkingStatsOptions,
  getAccountLinkingStatsQueryKey,
  getCreditRegistrationForAdminOptions,
  getCreditRegistrationOverviewOptions,
  getCreditRegistrationOverviewQueryKey,
  getSuotarHealthOptions,
  listCreditRegistrationsForAdminOptions,
  listCreditRegistrationsForAdminQueryKey,
  listVerifiedStudentNumbersForAdminOptions,
  listVerifiedStudentNumbersForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  ListCreditRegistrationsForAdminData,
  ListVerifiedStudentNumbersForAdminData,
} from "@/generated/api/types.generated"

/** Group-bys over the ledger, so not a cheap read. */
const OVERVIEW_REFETCH_INTERVAL_MS = 30_000
const LIST_REFETCH_INTERVAL_MS = 60_000
const LIVE_ITEM_REFETCH_INTERVAL_MS = 5_000

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
