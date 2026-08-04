import { useQuery } from "@tanstack/react-query"

import {
  getAccountLinkingStatsOptions,
  getCreditRegistrationForAdminOptions,
  getCreditRegistrationOverviewOptions,
  getSuotarHealthOptions,
  listCreditRegistrationsForAdminOptions,
  listVerifiedStudentNumbersForAdminOptions,
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
