/**
 * Shared vocabulary for the credit-registration specs in `src/tests/credit-registration/`.
 *
 * `credit-registrar` and `suotar-syncer` tick every phase unscoped in the test deployment, so a row
 * moves without any spec asking: assert "reaches state X", never "is still in state Y" unless only
 * this spec can leave Y (nothing ripens a mock submission on its own).
 *
 * Isolation is data partitioning — one database, N workers, nothing resets between tests. Never
 * assert a global count. Reading another file's rows is fine; writing to a range you do not own
 * breaks its owner's assertions, so claim a free range here first.
 *
 * | Student numbers | File                             | Courses it writes to        |
 * | --------------- | -------------------------------- | --------------------------- |
 * | `9000001xx`     | suotar-happy-path                | via-suotar                  |
 * | `9000002xx`     | suotar-account-linking           | none (seeded link tokens)   |
 * | `9000003xx`     | suotar-enrolment-problems        | via-suotar                  |
 * | `9000004xx`     | suotar-import-outcomes           | via-suotar, import-outcomes |
 * | `9000005xx`     | suotar-verify-outcomes           | via-suotar                  |
 * | `9000006xx`     | suotar-sisu-outage               | not written yet             |
 * | `9000007xx`     | suotar-consent                   | via-suotar                  |
 * | `9000008xx`     | suotar-teacher-views             | none (states course, paused)|
 * | `9000009xx`     | suotar-admin-dashboard           | admin                       |
 * | `9000010xx`     | suotar-old-flow-coexistence      | old-flow                    |
 * | `9000011xx`     | suotar-backfill-and-late-consent | backfill                    |
 * | `9000012xx`     | suotar-grade-improvement         | not written yet             |
 * | `9000013xx`     | suotar-student-emails            | not written yet             |
 * | `9000014xx`     | suotar-fast-track-linking        | not written yet             |
 * | `9000015xx`     | suotar-in-course-banner          | not written yet             |
 * | `9000016xx`     | suotar-student-profile           | none (reads seeded rows)    |
 */

import type { APIRequestContext, Page } from "@playwright/test"

import { omitUndefined } from "../shared-module/common/utils/nullability"
import { listMockSuotarCalls, type MockSuotarEndpoint } from "./mockSuotar"
import { pollUntil } from "./waitingUtils"

export const ORIGIN = "http://project-331.local"
export const MAIN_FRONTEND_API = `${ORIGIN}/api/v0/main-frontend`
export const CREDIT_REGISTRATIONS_API = `${MAIN_FRONTEND_API}/credit-registrations`
export const COURSE_CREDIT_REGISTRATIONS_API = `${MAIN_FRONTEND_API}/course-credit-registrations`

/** Course slugs seeded by `seed_credit_registration.rs`. */
export const SUOTAR_COURSE_SLUG = "credit-registration-via-suotar"
export const ADMIN_COURSE_SLUG = "credit-registration-admin"
export const IMPORT_OUTCOMES_COURSE_SLUG = "credit-registration-import-outcomes"
export const BACKFILL_COURSE_SLUG = "credit-registration-backfill"
export const OLD_FLOW_COURSE_SLUG = "credit-registration-old-flow"

/** Must match the `*_COURSE_ID` constants in `seed_credit_registration.rs`. */
export const ADMIN_COURSE_ID = "c5ed17ea-0006-4a5e-9e6e-c0de00000006"
export const BACKFILL_COURSE_ID = "c5ed17ea-0003-4a5e-9e6e-c0de00000003"
export const STATES_COURSE_ID = "c5ed17ea-0007-4a5e-9e6e-c0de00000007"
export const OLD_FLOW_COURSE_ID = "c5ed17ea-0002-4a5e-9e6e-c0de00000002"

/** University course codes: what the mock Suotar keys its world on. */
export const CRS_101 = "CRS-101"
export const CRS_ADMIN_101 = "CRS-ADMIN-101"

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
 * Seeded students whose sessions `global.setup.spec.ts` stores; only the ones some spec signs in as.
 * The seed creates the accounts and hashes the local part of the address as the password, so the
 * setup needs nothing but the addresses.
 */
export const CREDIT_REGISTRATION_STUDENT_EMAILS = [
  "credit-registration-backfill-2@example.com",
  "credit-registration-consent-withdrawn@example.com",
  "credit-registration-consent-withheld@example.com",
  "credit-registration-consented-linked@example.com",
  "credit-registration-import-outcomes@example.com",
  "credit-registration-import-timeout@example.com",
  "credit-registration-link-claimer@example.com",
  "credit-registration-no-enrolment@example.com",
  "credit-registration-not-consented@example.com",
  "credit-registration-profile-empty@example.com",
  "credit-registration-superseded@example.com",
  "credit-registration-two-enrolments@example.com",
  "credit-registration-verify-misregistered@example.com",
  "credit-registration-verify-polling@example.com",
] as const

export type CreditRegistrationStudentEmail = (typeof CREDIT_REGISTRATION_STUDENT_EMAILS)[number]

/**
 * Stored session for a seeded student, for `test.use({ storageState })`. Typed to the list above so
 * an address the setup never logs in fails to compile rather than at run time on a missing file.
 */
export const seededStudentStorageState = (email: CreditRegistrationStudentEmail): string =>
  `src/states/${email}.json`

const DIALOG_STATE_SELECTOR = `[data-testid="dialog-decision-state"]`
const CONSENT_DIALOG = "credit-registration-consent"

/**
 * Waits on the dialog-chain sentinel rather than the consent buttons: both halves of the gate are
 * answered by queries that may still be in flight, so looking for the buttons races the decision.
 */
export const waitForCreditRegistrationConsentDialog = (page: Page): Promise<void> =>
  page
    .locator(
      `${DIALOG_STATE_SELECTOR}[data-dialogs-ready="true"][data-active-dialog="${CONSENT_DIALOG}"]`,
    )
    .waitFor({ state: "attached" })

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

/**
 * Throws with the status and the body on any non-2xx; a spec proving a refusal calls `request.get`
 * itself.
 */
export const getJson = async <T>(
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

export const queryString = (
  params: Record<string, string | number | boolean | undefined>,
): string => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.append(key, String(value))
    }
  }
  const query = search.toString()
  return query === "" ? "" : `?${query}`
}

export const myCreditRegistrations = (
  request: APIRequestContext,
): Promise<MyCreditRegistration[]> =>
  getJson<MyCreditRegistration[]>(request, `${CREDIT_REGISTRATIONS_API}/my`)

/** The one live (not superseded) registration the logged-in student has on `courseSlug`. */
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
 * Scans the whole log rather than the default window: a live pipeline fills it, and an older call
 * falling out of a short scan turns "exactly one import" into a false pass.
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
