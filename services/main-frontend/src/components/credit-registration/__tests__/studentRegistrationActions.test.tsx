"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import React from "react"

import type {
  MyCreditRegistration,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"

import { useStudentRegistrationActions } from "../studentRegistrationActions"

// t is mocked in tests/setup-jest.js to return the key verbatim, so labels are asserted as keys.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const registration = (
  status: StudentFacingCreditRegistrationStatus,
  overrides: Partial<MyCreditRegistration> = {},
): MyCreditRegistration =>
  ({
    id: "registration-1",
    course_module_id: "module-1",
    course_name: "Introduction to Programming",
    student_facing_status: status,
    can_request_enrolment_recheck: true,
    status_is_moving: false,
    ...overrides,
  }) as MyCreditRegistration

const actionsFor = (
  reg: MyCreditRegistration,
  options: { canConfirmEmail?: boolean; linkToStatusPage?: boolean } = {},
) =>
  renderHook(
    () =>
      useStudentRegistrationActions({
        registration: reg,
        canConfirmEmail: options.canConfirmEmail ?? false,
        linkToStatusPage: options.linkToStatusPage ?? false,
      }),
    { wrapper },
  ).result.current

describe("useStudentRegistrationActions", () => {
  test("leads a missing enrolment with the enrolment page and offers a recheck beside it", () => {
    const { primaryAction, secondaryActions } = actionsFor(
      registration("needs_enrolment", { enrolment_link: "https://example.com/enrol" }),
    )

    expect(primaryAction?.href).toBe("https://example.com/enrol")
    expect(secondaryActions.map((action) => action.label)).toContain(
      "credit-registration-action-recheck-enrolment",
    )
  })

  test("says why a recheck is unavailable rather than only greying it out", () => {
    const { secondaryActions } = actionsFor(
      registration("needs_enrolment", {
        enrolment_link: "https://example.com/enrol",
        can_request_enrolment_recheck: false,
      }),
    )
    const recheck = secondaryActions.at(0)

    expect(recheck?.isDisabled).toBe(true)
    expect(recheck?.disabledReason).toBe("credit-registration-enrolment-checked-recently")
  })

  test("offers no primary action on a failure nobody but support can clear", () => {
    const { primaryAction, secondaryActions, supportMail } = actionsFor(
      registration("failed", { error_code: "misregistered" }),
    )

    expect(primaryAction).toBeNull()
    expect(secondaryActions).toHaveLength(0)
    expect(supportMail?.reference).toBe("registration-1")
  })

  test("sends a wrong student number to the settings page that can change it", () => {
    const { primaryAction } = actionsFor(
      registration("failed", { error_code: "person_not_found", student_number: "900000101" }),
    )

    expect(primaryAction?.label).toBe("credit-registration-action-label-check-own-student-number")
    expect(primaryAction?.href).toBe("/user-settings/student-number")
  })

  test("offers the email fast track while the emailed link is out of reach", () => {
    const withFastTrack = actionsFor(registration("needs_student_number"), {
      canConfirmEmail: true,
    })
    const withoutFastTrack = actionsFor(registration("needs_student_number"))

    expect(withFastTrack.primaryAction?.label).toBe("button-confirm-your-email-address")
    expect(withoutFastTrack.primaryAction).toBeNull()
    expect(withoutFastTrack.supportMail).not.toBeNull()
  })

  test("puts no support line under a registration that worked", () => {
    const { primaryAction, secondaryActions, supportMail } = actionsFor(
      registration("registered", { registered_at: "2026-02-03T10:00:00Z" }),
    )

    expect(primaryAction).toBeNull()
    expect(secondaryActions).toHaveLength(0)
    expect(supportMail).toBeNull()
  })

  test("promotes the support mail to primary and demotes the onward link to text when a failure has no lever of its own", () => {
    const { primaryAction, secondaryActions, supportMailPromoted } = actionsFor(
      registration("failed", { error_code: "misregistered" }),
      { linkToStatusPage: true },
    )

    expect(primaryAction?.label).toBe("credit-registration-action-label-contact-support")
    expect(primaryAction?.href).toMatch(/^mailto:/)
    expect(secondaryActions).toEqual([
      expect.objectContaining({
        label: "link-text-details-arrow",
        href: "/completion-registration/module-1",
        appearance: "link",
      }),
    ])
    expect(supportMailPromoted).toBe(true)
  })
})
