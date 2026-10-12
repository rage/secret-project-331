/**
 * Client for the mock mooc.fi (`/api/v0/mock-moocfi`), and the fixtures the mooc.fi credit
 * registration specs share.
 *
 * Hand-written like `mockSuotar.ts`: the mock's DTOs are not exported to the generated bindings.
 *
 * The mock keeps its completions in the server's memory, so they outlive a reseed and vanish on a
 * restart. A spec seeds what it reads, by fixed completion ids so a rerun replaces rather than adds,
 * and starts by forgetting its own student. Never reset the whole mock: the specs beside it seeded
 * theirs too.
 *
 * Each spec owns one seeded mooc.fi student, which `test-token-moocfi-student-N` signs in as:
 *
 * | Spec                    | Student            | mooc.fi courses          |
 * | ----------------------- | ------------------ | ------------------------ |
 * | moocfi-handoff          | moocfi-student-1   | delegated                |
 * | moocfi-pipeline         | moocfi-student-2   | delegated                |
 * | moocfi-student-page     | moocfi-student-3   | delegated, tiered, paused |
 * | moocfi-cutoff-split     | moocfi-student-4   | delegated                |
 * | moocfi-admin            | none               | paused (read only), its own |
 */

import type { APIRequestContext, Page } from "@playwright/test"
import { expect } from "@playwright/test"

import { getJson, MAIN_FRONTEND_API, ORIGIN } from "./creditRegistration"

export const MOCK_MOOCFI_URL = `${ORIGIN}/api/v0/mock-moocfi`
const CONTROL_URL = `${MOCK_MOOCFI_URL}/control`

/** Must match `MOCK_MOOCFI_ORGANIZATION_SLUG` in the backend: our registrations on mooc.fi. */
export const MOCK_MOOCFI_ORGANIZATION_SLUG = "courses-mooc-fi-mock"

/** Must match the `MOOCFI_*` constants in `seed_credit_registration.rs`. */
export const MOOCFI_CUTOFF = "2025-01-01T00:00:00Z"
/** Comfortably before every seeded target's cutoff. */
export const BEFORE_MOOCFI_CUTOFF = "2024-06-01T12:00:00Z"

export interface MoocfiCourse {
  id: string
  slug: string
}

/** Untiered, enabled, registering `CRS-MOOCFI-101`. */
export const MOOCFI_COURSE: MoocfiCourse = {
  id: "c5ed17ea-0011-4a5e-9e6e-c0de00000011",
  slug: "credit-registration-moocfi",
}
export const MOOCFI_TARGET_ID = "c5ed17ea-0a01-4a5e-9e6e-c0de00000a01"
export const MOOCFI_TARGET_NAME = "Delegated course"
export const CRS_MOOCFI_101 = "CRS-MOOCFI-101"

/** Tier 2 and tier 3 have a target each; tier 1 has none. */
export const MOOCFI_TIERED_COURSE: MoocfiCourse = {
  id: "c5ed17ea-0012-4a5e-9e6e-c0de00000012",
  slug: "credit-registration-moocfi-tiered",
}
export const MOOCFI_TIER_2_TARGET_NAME = "Tiered course, intermediate"

/** Enabled but paused, with a pending row for `moocfi-student-3` that nothing moves. */
export const MOOCFI_PAUSED_COURSE: MoocfiCourse = {
  id: "c5ed17ea-0013-4a5e-9e6e-c0de00000013",
  slug: "credit-registration-moocfi-paused",
}
export const MOOCFI_PAUSED_TARGET_ID = "c5ed17ea-0a04-4a5e-9e6e-c0de00000a04"
export const MOOCFI_PAUSED_TARGET_NAME = "Paused course"
export const MOOCFI_PAUSED_COMPLETION_ID = "c5ed17ea-0a11-4a5e-9e6e-c0de00000a11"
export const MOOCFI_PAUSED_REGISTRATION_ID = "c5ed17ea-0a21-4a5e-9e6e-c0de00000a21"
/** The raw grade the seed stored on the paused target's completion. */
export const MOOCFI_PAUSED_RAW_GRADE = "hyväksytty"

export interface MoocfiStudent {
  email: string
  /** The TMC user id the mock keys completions on. */
  upstreamId: number
  /** Signs in as this student in the mock's page and at the mint, in test mode only. */
  tmcAccessToken: string
}

const moocfiStudent = (n: number): MoocfiStudent => ({
  email: `moocfi-student-${n}@example.com`,
  upstreamId: 9_100_000 + n,
  tmcAccessToken: `test-token-moocfi-student-${n}`,
})

export const MOOCFI_STUDENT_1 = moocfiStudent(1)
/** Holds no student number until `moocfi-pipeline.spec.ts` links the one below. */
export const MOOCFI_STUDENT_2 = moocfiStudent(2)
export const MOOCFI_STUDENT_3 = moocfiStudent(3)
export const MOOCFI_STUDENT_4 = moocfiStudent(4)

/** The person `MOOCFI_LINKING_TOKEN` links; enrolled on `CRS-MOOCFI-101` in the mock Suotar. */
export const MOOCFI_PIPELINE_STUDENT_NUMBER = "090003017"
export const MOOCFI_LINKING_TOKEN = "55555555-5555-5555-5555-555555555555".repeat(4)

/** A completion as the mock's control endpoint takes it. Omitted fields keep the mock's defaults. */
export interface MockMoocfiCompletionSeed {
  id: string
  course_id: string
  user_upstream_id: number
  completion_date?: string
  completion_language?: string
  grade?: string | null
  tier?: number | null
  eligible_for_ects?: boolean
  registrations?: { organization_slug: string; registration_date: string; created_at: string }[]
}

/** One `register-completions` call the mock received. */
export interface MockMoocfiRegisterCall {
  received_at: string
  completions: { completion_id: string; student_number: string; registration_date: string }[]
}

const expectOk = async (
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
  what: string,
): Promise<void> => {
  if (!response.ok()) {
    throw new Error(
      `${what} answered ${response.status()}: ${await response.text()}. Is USE_MOCK_MOOCFI_ENDPOINT on?`,
    )
  }
}

/** Adds the completions, replacing any with the same id. */
export const seedMockMoocfiCompletions = async (
  request: APIRequestContext,
  completions: MockMoocfiCompletionSeed[],
): Promise<void> => {
  await expectOk(
    await request.post(`${CONTROL_URL}/completions`, { data: completions }),
    "Seeding mock mooc.fi completions",
  )
}

/** Deletes a completion, as an admin deleting it on mooc.fi would. */
export const deleteMockMoocfiCompletion = async (
  request: APIRequestContext,
  completionId: string,
): Promise<void> => {
  await expectOk(
    await request.delete(`${CONTROL_URL}/completions/${completionId}`),
    "Deleting a mock mooc.fi completion",
  )
}

/** Forgets the student's completions, the register calls about them and their outage. */
export const forgetMockMoocfiStudent = async (
  request: APIRequestContext,
  student: MoocfiStudent,
): Promise<void> => {
  await expectOk(
    await request.delete(`${CONTROL_URL}/users/${student.upstreamId}`),
    "Forgetting a mock mooc.fi student",
  )
}

/** Makes mooc.fi's lookup fail for this student only, or work again. */
export const setMockMoocfiAvailableFor = async (
  request: APIRequestContext,
  student: MoocfiStudent,
  isAvailable: boolean,
): Promise<void> => {
  await expectOk(
    await request.put(`${CONTROL_URL}/availability`, {
      data: { is_available: isAvailable, user_upstream_id: student.upstreamId },
    }),
    "Setting mock mooc.fi availability",
  )
}

/** Every completion entry the mock was asked to register for `completionId`, one per post. */
export const mockMoocfiRegistrationsOf = async (
  request: APIRequestContext,
  completionId: string,
): Promise<MockMoocfiRegisterCall["completions"]> => {
  const calls = await getJson<MockMoocfiRegisterCall[]>(request, `${CONTROL_URL}/register-calls`)
  return calls
    .flatMap((call) => call.completions)
    .filter((registration) => registration.completion_id === completionId)
}

/** The mock's stand-in for mooc.fi's registration page, signed in as `student`. */
export const mockMoocfiRegistrationPageUrl = (course: MoocfiCourse, student: MoocfiStudent) =>
  `${MOCK_MOOCFI_URL}/register-completion/${course.slug}?tmc_access_token=${student.tmcAccessToken}`

/** The courses page a redeemed handoff lands on. */
export const moocfiRegistrationUrl = (course: MoocfiCourse): string =>
  `${ORIGIN}/completion-registration/mooc-fi/${course.id}`

/**
 * Presses the mock mooc.fi page's button as `student` and waits for the landing page. The browser
 * navigates the way it would from www.mooc.fi, so `Sec-Fetch-Site` is the browser's own.
 */
export const openRegistrationFromMoocfi = async (
  page: Page,
  course: MoocfiCourse,
  student: MoocfiStudent,
): Promise<void> => {
  await page.goto(mockMoocfiRegistrationPageUrl(course, student))
  await page.getByRole("button", { name: "Register in courses.mooc.fi" }).click()
  await page.waitForURL(moocfiRegistrationUrl(course))
  await expect(page.getByText(`Signed in as ${student.email}`)).toBeVisible()
}

/** Mints a handoff the way mooc.fi's backend does for its page, and returns the redeem URL. */
export const mintMoocfiHandoff = async (
  request: APIRequestContext,
  course: MoocfiCourse,
  student: MoocfiStudent,
): Promise<string> => {
  const response = await request.post(
    `${MOCK_MOOCFI_URL}/api/credit-registration-handoff/${course.slug}`,
    { headers: { Authorization: `Bearer ${student.tmcAccessToken}` } },
  )
  await expectOk(response, "Minting a mooc.fi handoff")
  return ((await response.json()) as { redirect_url: string }).redirect_url
}

export type MoocfiCompletionStatus =
  | "registering_on_courses"
  | "registration_paused"
  | "before_cutoff"
  | "not_eligible"
  | "registered_on_moocfi"
  | "no_credit_unit"
  | "removed_from_moocfi"

/** The subset of `getMyMoocfiCreditRegistrations` these specs assert on. */
export interface MyMoocfiCreditRegistrations {
  signed_in_email: string
  is_up_to_date: boolean
  completions: {
    moocfi_completion_id: string
    status: MoocfiCompletionStatus
    external_completion_id: string | null
    credit_registration_id: string | null
  }[]
}

/**
 * What the signed-in student's registration page reads. Each call syncs from the mock and is rate
 * limited per student, so read it once per step rather than polling it.
 */
export const myMoocfiCreditRegistrations = (
  request: APIRequestContext,
  course: MoocfiCourse,
): Promise<MyMoocfiCreditRegistrations> =>
  getJson<MyMoocfiCreditRegistrations>(
    request,
    `${MAIN_FRONTEND_API}/moocfi-credit-registrations/${course.id}`,
  )
