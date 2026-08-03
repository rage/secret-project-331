/**
 * Shared vocabulary for the credit-registration specs: the seeded identifiers, logging in as a
 * seeded student, and reading the ledger through the same API the UI uses.
 *
 * Two facts shape every spec in `src/tests/credit-registration/`:
 *
 * - **The pipeline is alive.** `credit-registrar` and `suotar-syncer` run in the test deployment and
 *   tick every phase unscoped every few seconds. A row can therefore move without any spec asking,
 *   so an assertion is always "reaches state X", never "is still in state Y" — unless Y can only be
 *   left by something the spec itself controls, such as a mock submission that nothing has ripened.
 * - **Isolation is data partitioning.** One database, one pod, N workers. Each spec file owns a
 *   combination of students and courses; nothing resets between tests. Never assert a global count.
 */

import type { APIRequestContext, Page } from "@playwright/test"

import { omitUndefined } from "../shared-module/common/utils/nullability"
import { login } from "./login"
import { listMockSuotarCalls, type MockSuotarEndpoint } from "./mockSuotar"
import { pollUntil } from "./waitingUtils"

export const ORIGIN = "http://project-331.local"
export const MAIN_FRONTEND_API = `${ORIGIN}/api/v0/main-frontend`
export const CREDIT_REGISTRATIONS_API = `${MAIN_FRONTEND_API}/credit-registrations`
export const CREDIT_REGISTRATION_ADMIN_API = `${MAIN_FRONTEND_API}/credit-registration-admin`
export const COURSE_CREDIT_REGISTRATIONS_API = `${MAIN_FRONTEND_API}/course-credit-registrations`

/** Course slugs seeded by `seed_credit_registration.rs`. */
export const SUOTAR_COURSE_SLUG = "credit-registration-via-suotar"
export const ADMIN_COURSE_SLUG = "credit-registration-admin"
export const STATES_COURSE_SLUG = "credit-registration-states"
export const IMPORT_OUTCOMES_COURSE_SLUG = "credit-registration-import-outcomes"
export const BACKFILL_COURSE_SLUG = "credit-registration-backfill"
export const OLD_FLOW_COURSE_SLUG = "credit-registration-old-flow"

/** University course codes, which is what the mock Suotar keys its world on. */
export const CRS_101 = "CRS-101"
export const CRS_ADMIN_101 = "CRS-ADMIN-101"
export const CRS_IMPORT_101 = "CRS-IMPORT-101"
export const CRS_IMPORT_102 = "CRS-IMPORT-102"
export const CRS_IMPORT_103 = "CRS-IMPORT-103"
export const CRS_IMPORT_104 = "CRS-IMPORT-104"

export const CREDIT_REGISTRATION_ORGANIZATION_SLUG = "credit-registration"

/** The registrar the seed gives a known key to, so the legacy pull stream is readable from a test. */
export const PULL_REGISTRAR_SECRET_KEY = "credit-registration-system-tests-pull-registrar"

export const courseFrontPageUrl = (courseSlug: string): string =>
  `${ORIGIN}/org/${CREDIT_REGISTRATION_ORGANIZATION_SLUG}/courses/${courseSlug}`

export const completionRegistrationUrl = (courseModuleId: string): string =>
  `${ORIGIN}/completion-registration/${courseModuleId}`

export const PROFILE_CREDIT_REGISTRATION_URL = `${ORIGIN}/profile/credit-registration`

export const linkStudentNumberUrl = (token: string): string =>
  `${ORIGIN}/link-student-number/${token}`

/**
 * The seeded credit-registration accounts have no storage state: they are created by the seed rather
 * than by `global.setup.spec.ts`, and their password is the local part of their address.
 */
export const loginAsSeededStudent = async (page: Page, email: string): Promise<void> => {
  const [password] = email.split("@")
  if (password === undefined || password === "") {
    throw new Error(`${email} is not an address with a local part to use as a password.`)
  }
  await login(email, password, page, true)
}

const DIALOG_STATE_SELECTOR = `[data-testid="dialog-decision-state"]`
const CONSENT_DIALOG = "credit-registration-consent"

/**
 * Waits for the course-material dialog chain to settle on the consent dialog.
 *
 * The sentinel rather than the dialog itself: the gate is
 * `credit_registration_enabled_for_course && !asked`, and both halves are answered by queries that
 * may still be in flight, so looking for the buttons directly races the decision.
 */
export const waitForCreditRegistrationConsentDialog = (page: Page): Promise<void> =>
  page
    .locator(
      `${DIALOG_STATE_SELECTOR}[data-dialogs-ready="true"][data-active-dialog="${CONSENT_DIALOG}"]`,
    )
    .waitFor({ state: "attached" })

export const activeCourseMaterialDialog = (page: Page): Promise<string | null> =>
  page.locator(DIALOG_STATE_SELECTOR).getAttribute("data-active-dialog")

export const answerCreditRegistrationConsent = async (
  page: Page,
  answer: "accept" | "decline",
): Promise<void> => {
  const button = page.getByTestId(`credit-registration-consent-${answer}-button`)
  await button.click()
  await button.waitFor({ state: "detached" })
}

/** The subset of `getMyCreditRegistrations` these specs assert on. */
export interface MyCreditRegistration {
  id: string
  course_id: string
  course_slug: string
  course_module_id: string
  course_module_name: string | null
  state: string
  student_facing_status: string
  error_code: string | null
  attempt_number: number
  superseded: boolean
  registered_at: string | null
  sisu_attainment_id: string | null
  enrolment_link: string | null
}

const readJson = async <T>(
  request: APIRequestContext,
  url: string,
  headers?: Record<string, string>,
): Promise<T> => {
  const response = await request.get(url, headers ? { headers } : undefined)
  if (!response.ok()) {
    throw new Error(`GET ${url} answered ${response.status()}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

export const myCreditRegistrations = (
  request: APIRequestContext,
): Promise<MyCreditRegistration[]> =>
  readJson<MyCreditRegistration[]>(request, `${CREDIT_REGISTRATIONS_API}/my`)

/**
 * The one live registration the logged-in student has on `courseSlug`.
 *
 * Live meaning not superseded: a replaced attempt is history and nothing actionable happens on it.
 */
export const myRegistrationOnCourse = async (
  request: APIRequestContext,
  courseSlug: string,
): Promise<MyCreditRegistration> => {
  const live = (await myCreditRegistrations(request)).filter(
    (row) => row.course_slug === courseSlug && !row.superseded,
  )
  const [only] = live
  if (live.length !== 1 || only === undefined) {
    throw new Error(
      `Expected exactly one live registration on ${courseSlug}, found ${live.length}: ${JSON.stringify(live)}`,
    )
  }
  return only
}

export const waitForRegistrationState = (
  request: APIRequestContext,
  courseSlug: string,
  states: readonly string[],
  timeout?: number,
): Promise<MyCreditRegistration> =>
  pollUntil(
    async () => {
      const row = await myRegistrationOnCourse(request, courseSlug)
      return states.includes(row.state) ? row : null
    },
    {
      ...omitUndefined({ timeout }),
      description: `the registration on ${courseSlug} to reach one of ${states.join(", ")}`,
    },
  )

/**
 * The whole call log rather than the default window: the log holds two thousand entries and a live
 * pipeline fills it, so a short scan would let an older call fall out and turn "exactly one import"
 * into a false pass.
 */
const CALL_LOG_SCAN = 2000

export interface MockSuotarRecordedCall {
  seq: number
  endpoint: MockSuotarEndpoint
  httpStatus: number
  items: {
    requestItemId: string
    studentNumber: string | null
    courseCode: string | null
    submittedAttainmentId: string | null
    status: string
    code: string
  }[]
}

export const mockCallsForStudent = async (
  request: APIRequestContext,
  studentNumber: string,
  endpoint?: MockSuotarEndpoint,
): Promise<MockSuotarRecordedCall[]> => {
  const result = await listMockSuotarCalls(request, {
    studentNumber,
    ...omitUndefined({ endpoint }),
    limit: CALL_LOG_SCAN,
  })
  return result.calls as MockSuotarRecordedCall[]
}

export const countMockCallsForStudent = async (
  request: APIRequestContext,
  studentNumber: string,
  endpoint?: MockSuotarEndpoint,
): Promise<number> => (await mockCallsForStudent(request, studentNumber, endpoint)).length

/** Reads the legacy pull stream as an authorized registrar would. */
export const legacyPullStream = async (
  request: APIRequestContext,
  courseIdentifier: string,
): Promise<string> => {
  const url = `${ORIGIN}/api/v0/study-registry/completions/${courseIdentifier}`
  const response = await request.get(url, {
    headers: { Authorization: `Basic ${PULL_REGISTRAR_SECRET_KEY}` },
  })
  if (!response.ok()) {
    throw new Error(`GET ${url} answered ${response.status()}: ${await response.text()}`)
  }
  return await response.text()
}
