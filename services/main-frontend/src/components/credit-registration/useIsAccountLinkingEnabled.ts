"use client"

import { useQuery } from "@tanstack/react-query"

import { getCreditRegistrationSettingsOptions } from "@/generated/api/@tanstack/react-query.generated"

/**
 * Whether linking mails can be sent in this deployment: undefined while loading, false if the
 * lookup failed. Use [`useIsAccountLinkingEnabled`] where unknown can safely read as off.
 */
export const useAccountLinkingSetting = (): boolean | undefined => {
  const query = useQuery({ ...getCreditRegistrationSettingsOptions() })
  if (query.isPending) {
    return undefined
  }
  return query.data?.account_linking_enabled === true
}

/**
 * Whether linking mails can be sent and resent in this deployment. False until known, so a resend
 * the server would refuse is never offered.
 */
export const useIsAccountLinkingEnabled = (): boolean => useAccountLinkingSetting() === true
