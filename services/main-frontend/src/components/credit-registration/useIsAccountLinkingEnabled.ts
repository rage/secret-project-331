"use client"

import { useQuery } from "@tanstack/react-query"

import { getCreditRegistrationSettingsOptions } from "@/generated/api/@tanstack/react-query.generated"

/**
 * Whether linking mails can be sent and resent in this deployment. False until known, so a resend
 * the server would refuse is never offered.
 */
export const useIsAccountLinkingEnabled = (): boolean =>
  useQuery({ ...getCreditRegistrationSettingsOptions() }).data?.account_linking_enabled === true
