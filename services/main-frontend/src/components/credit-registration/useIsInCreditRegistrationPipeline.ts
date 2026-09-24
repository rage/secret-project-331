"use client"

import { useQuery } from "@tanstack/react-query"

import {
  getMyCreditRegistrationsOptions,
  getMyStudiesOptions,
} from "@/generated/api/@tanstack/react-query.generated"

/**
 * Whether this student's credits register through this service, which decides whether their student
 * number is shown to them at all. `undefined` until known.
 *
 * A linked number alone does not count: the old flow's registrar reports link one for everyone it
 * ever registered.
 */
export const useIsInCreditRegistrationPipeline = (): boolean | undefined => {
  const myStudies = useQuery({ ...getMyStudiesOptions() })
  const registrations = useQuery({ ...getMyCreditRegistrationsOptions() })
  if (
    myStudies.data?.any_module_supports_credit_registration === true ||
    (registrations.data?.length ?? 0) > 0
  ) {
    return true
  }
  if (myStudies.data && registrations.data) {
    return false
  }
  return undefined
}
