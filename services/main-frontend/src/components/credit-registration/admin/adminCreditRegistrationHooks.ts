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

/** Group-bys over the ledger rather than a cheap read, so slower than the repo's k8s dashboards. */
const OVERVIEW_REFETCH_INTERVAL_MS = 30_000
const LIST_REFETCH_INTERVAL_MS = 60_000
/** While a row is still moving, the detail page is worth watching. */
const LIVE_ITEM_REFETCH_INTERVAL_MS = 5_000

/**
 * The one aggregate the Overview and the alert banner share.
 *
 * The banner is on every tab and reads this: one query key means the tiles and the banner cannot
 * disagree, and a tab that only needs the banner pays for one request rather than two.
 */
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
