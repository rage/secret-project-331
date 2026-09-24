/**
 * Shared vocabulary for the credit-registration specs in `src/tests/credit-registration/`.
 *
 * `credit-registrar` and `suotar-syncer` tick every phase unscoped in the test deployment, so a row
 * moves without any spec asking: assert "reaches state X", never "is still in state Y" unless only
 * this spec can leave Y (only a control transition moves a mock submission).
 *
 * Isolation is data partitioning — one database, N workers, nothing resets between tests. Never
 * assert a global count. Reading another file's rows is fine; writing to a pair you do not own
 * breaks its owner's assertions, so claim a free (account, course) pair in the table below first.
 *
 * Three corollaries that have each cost a broken spec:
 * - Never assert an exact `itemsProcessed`/`itemsFailed` from `runXTick`, except `0` for "nothing
 *   was ever eligible" (actor-independent). A live worker can run the same tick first and leave a
 *   correct count of 0 where the spec expected 1. Assert per-student call counts
 *   (`countMockCallsForStudent`) or reached state instead.
 * - `pausePhase` blocks the pausing spec's own explicit ticks against that phase too, not just the
 *   worker's — there is no way to pause the worker alone. Never pause a phase you still intend to
 *   tick yourself.
 * - A `requestLevel` fault with an owner (`armMockSuotarFault`) fires only when *every* item in the
 *   request matches; the unscoped worker can batch a foreign student into the same call and
 *   silently suppress it. Prefer an `itemLevel` fault for a single-student fault, and where the
 *   contract forces `requestLevel` (see `armMockSuotarFault`'s validation), hold the student's
 *   course with `setTestExclusiveHold` **before** materializing their row — it is then invisible to
 *   unscoped claims from birth, so the worker can never batch it with anything, while your own
 *   scoped ticks are unaffected. A hold set only after the row exists still races the
 *   worker's own next tick (it ticks every 10s regardless of any one test).
 *
 * Every seeded account holds one student number for good, so specs share accounts and own
 * (account, course) pairs instead. Scope every tick to both halves (`{ userEmail, courseSlug }`),
 * and filter mock calls, faults and admin listings by course code as well as by student number. A
 * spec that makes an iteration fail ticks by `creditRegistrationIds` once its row exists: the circuit
 * breaker is keyed on the scope, and a course scope shares it with every spec on that course.
 *
 * | Spec                        | Account                         | Course         |
 * | --------------------------- | ------------------------------- | -------------- |
 * | suotar-enrolment-problems   | credit-registration-student-1   | via-suotar     |
 * |                             | student7                        | via-suotar-b   |
 * | suotar-import-outcomes      | credit-registration-student-3   | via-suotar     |
 * |                             | credit-registration-student-3   | via-suotar-b   |
 * |                             | credit-registration-student-4   | via-suotar     |
 * |                             | credit-registration-student-5   | via-suotar     |
 * |                             | student8                        | import-outcomes|
 * | suotar-verify-outcomes      | student6                        | via-suotar-b   |
 * |                             | credit-registration-student-1   | via-suotar-b   |
 * |                             | credit-registration-student-2   | via-suotar-b   |
 * | suotar-sisu-outage          | credit-registration-student-4   | via-suotar-b   |
 * | suotar-student-emails       | credit-registration-student-2   | via-suotar     |
 * |                             | student8                        | via-suotar-b   |
 * | suotar-in-course-banner     | student7                        | via-suotar     |
 * |                             | student8                        | via-suotar     |
 * | suotar-grade-improvement    | credit-registration-student-2   | grade-improvement |
 * |                             | credit-registration-student-3   | grade-improvement |
 * | suotar-admin-dashboard      | credit-registration-student-1   | admin          |
 * | suotar-student-profile      | student6 (read only)            | via-suotar     |
 * |                             | student5 (nothing linked)       | via-suotar     |
 * | suotar-old-flow-coexistence | student7, student8              | old-flow       |
 * | completion-registration-certificate-detour | student7         | certificate-detour |
 * |                             | student8                        | certificate-detour |
 * | suotar-teacher-views        | credit-registration-student-1–4 | retry          |
 * |                             | frozen rows only                | states         |
 * | suotar-account-linking      | credit-registration-link-claimer | none          |
 *
 * `student6` holds nothing a student is asked to act on, because its studies page is asserted to be
 * clean.
 */

import type { APIRequestContext } from "@playwright/test"

import { omitUndefined } from "../shared-module/common/utils/nullability"
import { listMockSuotarCalls, type MockSuotarEndpoint } from "./mockSuotar"
import { pollUntil } from "./waitingUtils"

export const ORIGIN = "http://project-331.local"
export const MAIN_FRONTEND_API = `${ORIGIN}/api/v0/main-frontend`
export const CREDIT_REGISTRATIONS_API = `${MAIN_FRONTEND_API}/credit-registrations`
export const COURSE_CREDIT_REGISTRATIONS_API = `${MAIN_FRONTEND_API}/course-credit-registrations`

/** Course slugs seeded by `seed_credit_registration.rs`. */
export const SUOTAR_COURSE_SLUG = "credit-registration-via-suotar"
export const SUOTAR_B_COURSE_SLUG = "credit-registration-via-suotar-b"
export const ADMIN_COURSE_SLUG = "credit-registration-admin"
export const IMPORT_OUTCOMES_COURSE_SLUG = "credit-registration-import-outcomes"
export const OLD_FLOW_COURSE_SLUG = "credit-registration-old-flow"
export const GRADE_IMPROVEMENT_COURSE_SLUG = "credit-registration-grade-improvement"
export const CERTIFICATE_DETOUR_COURSE_SLUG = "credit-registration-certificate-detour"

/** Must match the `*_COURSE_ID` constants in `mock_suotar::fixtures`. */
export const SUOTAR_COURSE_ID = "c5ed17ea-0001-4a5e-9e6e-c0de00000001"
export const SUOTAR_B_COURSE_ID = "c5ed17ea-0003-4a5e-9e6e-c0de00000003"
export const GRADE_IMPROVEMENT_COURSE_ID = "c5ed17ea-0005-4a5e-9e6e-c0de00000005"
export const ADMIN_COURSE_ID = "c5ed17ea-0006-4a5e-9e6e-c0de00000006"
export const STATES_COURSE_ID = "c5ed17ea-0007-4a5e-9e6e-c0de00000007"
export const RETRY_COURSE_ID = "c5ed17ea-0009-4a5e-9e6e-c0de00000009"
export const OLD_FLOW_COURSE_ID = "c5ed17ea-0002-4a5e-9e6e-c0de00000002"

/** University course codes: what the mock Suotar keys its world on. */
export const CRS_101 = "CRS-101"
export const CRS_B_101 = "CRS-B-101"
export const CRS_ADMIN_101 = "CRS-ADMIN-101"
/** The states course's default module. */
export const CRS_STATES_101 = "CRS-STATES-101"
/** The completion registration link override the seed gives the module with this course code. */
export const seededEnrolmentLink = (courseCode: string): string =>
  `https://www.avoin.helsinki.fi/palvelut/esittely.aspx?s=seed-${courseCode}`
export const CRS_101_ENROLMENT_LINK = seededEnrolmentLink(CRS_101)
export const CRS_B_101_ENROLMENT_LINK = seededEnrolmentLink(CRS_B_101)
/** The one seeded module on a graded scale rather than pass/fail. */
export const CRS_GRADED_101 = "CRS-GRADED-101"

/** Seeded accounts with a linked student number. Must match `mock_suotar::fixtures`. */
export const STUDENT_6 = {
  email: "student6@example.com",
  studentNumber: "900000006",
  lastName: "Studentsix",
} as const
export const STUDENT_7 = {
  email: "student7@example.com",
  studentNumber: "900000007",
  lastName: "Studentseven",
} as const
export const STUDENT_8 = {
  email: "student8@example.com",
  studentNumber: "900000008",
  lastName: "Studenteight",
} as const
export const CREDIT_REGISTRATION_STUDENT_1 = {
  email: "credit-registration-student-1@example.com",
  studentNumber: "900000011",
  lastName: "Crsone",
} as const
/** Linked by support by hand rather than by the mailed link. */
export const CREDIT_REGISTRATION_STUDENT_2 = {
  email: "credit-registration-student-2@example.com",
  studentNumber: "900000012",
  lastName: "Crstwo",
} as const
export const CREDIT_REGISTRATION_STUDENT_3 = {
  email: "credit-registration-student-3@example.com",
  studentNumber: "900000013",
  lastName: "Crsthree",
} as const
/** Derived by the seed from the address, so stable across reseeds. */
export const CREDIT_REGISTRATION_STUDENT_3_USER_ID = "02df8948-d804-5e37-af84-1776c1050516"
export const CREDIT_REGISTRATION_STUDENT_4 = {
  email: "credit-registration-student-4@example.com",
  studentNumber: "900000014",
  lastName: "Crsfour",
} as const
export const CREDIT_REGISTRATION_STUDENT_5 = {
  email: "credit-registration-student-5@example.com",
  studentNumber: "900000015",
  lastName: "Crsfive",
} as const

export const CREDIT_REGISTRATION_ORGANIZATION_SLUG = "credit-registration"

/** The registrar the seed gives a known key to, so the legacy pull stream is readable from a test. */
export const PULL_REGISTRAR_SECRET_KEY = "credit-registration-system-tests-pull-registrar"

export const courseFrontPageUrl = (courseSlug: string): string =>
  `${ORIGIN}/org/${CREDIT_REGISTRATION_ORGANIZATION_SLUG}/courses/${courseSlug}`

export const completionRegistrationUrl = (courseModuleId: string): string =>
  `${ORIGIN}/completion-registration/${courseModuleId}`

export const PROFILE_STUDIES_URL = `${ORIGIN}/profile/studies`

export const PROFILE_CREDIT_REGISTRATION_URL = `${ORIGIN}/profile/credit-registration`

export const linkStudentNumberUrl = (token: string): string =>
  `${ORIGIN}/link-student-number/${token}`

/**
 * Seeded students whose sessions `global.setup.spec.ts` stores; only the ones some spec signs in as.
 * Every one's password is the local part of its address, so the setup needs nothing but these.
 */
export const CREDIT_REGISTRATION_STUDENT_EMAILS = [
  "student6@example.com",
  "student7@example.com",
  "student8@example.com",
  "credit-registration-student-1@example.com",
  "credit-registration-student-2@example.com",
  "credit-registration-student-3@example.com",
  "credit-registration-link-claimer@example.com",
] as const

export type CreditRegistrationStudentEmail = (typeof CREDIT_REGISTRATION_STUDENT_EMAILS)[number]

/**
 * Stored session for a seeded student, for `test.use({ storageState })`. Typed to the list above so
 * an address the setup never logs in fails to compile rather than at run time on a missing file.
 */
export const seededStudentStorageState = (email: CreditRegistrationStudentEmail): string =>
  `src/states/${email}.json`

/**
 * The subset of `getMyCreditRegistrations` these specs assert on.
 *
 * No `state`: the ledger state is deliberately not on this wire (a suspected cheater must not be able
 * to infer their own flag from it). A spec that needs it passes an `adminApi` context to
 * `myRegistrationOnCourse`/`waitForRegistrationState`, which read it from the admin API instead.
 */
export interface MyCreditRegistration {
  id: string
  course_id: string
  course_slug: string
  course_module_id: string
  course_module_name: string | null
  student_facing_status: string
  error_code: string | null
  attempt_number: number
  superseded: boolean
  registered_at: string | null
  sisu_attainment_id: string | null
  enrolment_link: string | null
  /** The chosen enrolment's realisation name in Finnish, else English, else Swedish. */
  enrolment_realisation_name: string | null
}

export interface MyCreditRegistrationWithState extends MyCreditRegistration {
  state: string
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

/** The `state` of one registration, read from the admin API by a spec that already holds `adminApi`. */
const adminStateOf = async (
  adminApi: APIRequestContext,
  registrationId: string,
): Promise<string> => {
  const details = await getJson<{ registration: { state: string } }>(
    adminApi,
    `${MAIN_FRONTEND_API}/credit-registration-admin/registrations/${registrationId}`,
  )
  return details.registration.state
}

/** The one live (not superseded) registration the logged-in student has on `courseSlug`. */
export const myRegistrationOnCourse = async (
  request: APIRequestContext,
  adminApi: APIRequestContext,
  courseSlug: string,
): Promise<MyCreditRegistrationWithState> => {
  const live = (await myCreditRegistrations(request)).filter(
    (row) => row.course_slug === courseSlug && !row.superseded,
  )
  const [only] = live
  if (live.length !== 1 || only === undefined) {
    throw new Error(
      `Expected exactly one live registration on ${courseSlug}, found ${live.length}: ${JSON.stringify(live)}`,
    )
  }
  return { ...only, state: await adminStateOf(adminApi, only.id) }
}

export const waitForRegistrationState = (
  request: APIRequestContext,
  adminApi: APIRequestContext,
  courseSlug: string,
  states: readonly string[],
  timeout?: number,
): Promise<MyCreditRegistrationWithState> =>
  pollUntil(
    async () => {
      const row = await myRegistrationOnCourse(request, adminApi, courseSlug)
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

/** One student's calls about one course code: a student number alone spans every spec it serves. */
export const mockCallsForStudent = async (
  request: APIRequestContext,
  studentNumber: string,
  courseCode: string,
  endpoint?: MockSuotarEndpoint,
): Promise<MockSuotarRecordedCall[]> => {
  const result = await listMockSuotarCalls(request, {
    studentNumber,
    courseCode,
    ...omitUndefined({ endpoint }),
    limit: CALL_LOG_SCAN,
  })
  return result.calls as MockSuotarRecordedCall[]
}

export const countMockCallsForStudent = async (
  request: APIRequestContext,
  studentNumber: string,
  courseCode: string,
  endpoint?: MockSuotarEndpoint,
): Promise<number> =>
  (await mockCallsForStudent(request, studentNumber, courseCode, endpoint)).length

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

/**
 * Gives `userId` a completion on the course's default module the way a teacher does from the
 * students page, which is how a later grade arrives in production: as a new completion row, never
 * as an edit of the old one. Posted as the admin, into the course's first instance.
 */
export const addManualCompletion = async (
  adminApi: APIRequestContext,
  params: { courseId: string; userId: string; grade: number },
): Promise<void> => {
  const [instance] = await getJson<{ id: string }[]>(
    adminApi,
    `${MAIN_FRONTEND_API}/courses/${params.courseId}/course-instances`,
  )
  const structure = await getJson<{ modules: { id: string; order_number: number }[] }>(
    adminApi,
    `${MAIN_FRONTEND_API}/courses/${params.courseId}/structure`,
  )
  const defaultModule = structure.modules.find((module) => module.order_number === 0)
  if (instance === undefined || defaultModule === undefined) {
    throw new Error(`Course ${params.courseId} has no instance or no default module.`)
  }
  const url = `${MAIN_FRONTEND_API}/course-instances/${instance.id}/completions`
  const response = await adminApi.post(url, {
    data: {
      course_module_id: defaultModule.id,
      new_completions: [{ user_id: params.userId, grade: params.grade, passed: true }],
      skip_duplicate_completions: false,
    },
  })
  if (!response.ok()) {
    throw new Error(`POST ${url} answered ${response.status()}: ${await response.text()}`)
  }
}
