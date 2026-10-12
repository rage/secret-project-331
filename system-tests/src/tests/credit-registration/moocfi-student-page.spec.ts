import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  BEFORE_MOOCFI_CUTOFF,
  deleteMockMoocfiCompletion,
  forgetMockMoocfiStudent,
  MOCK_MOOCFI_ORGANIZATION_SLUG,
  type MockMoocfiCompletionSeed,
  MOOCFI_COURSE,
  MOOCFI_PAUSED_COMPLETION_ID,
  MOOCFI_PAUSED_COURSE,
  MOOCFI_PAUSED_RAW_GRADE,
  MOOCFI_PAUSED_TARGET_NAME,
  MOOCFI_STUDENT_3,
  MOOCFI_TIER_2_TARGET_NAME,
  MOOCFI_TIERED_COURSE,
  moocfiRegistrationUrl,
  myMoocfiCreditRegistrations,
  openRegistrationFromMoocfi,
  seedMockMoocfiCompletions,
  setMockMoocfiAvailableFor,
} from "@/utils/mockMoocfi"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * Owns `moocfi-student-3` on every seeded mooc.fi course. One test, signed in by one handoff: each
 * handoff and each page load is rate limited.
 */
const STUDENT = MOOCFI_STUDENT_3

const completionId = (n: number) => `c5ed17ea-3a0${n}-4a5e-9e6e-c0de00003a0${n}`
const REGISTERING_ID = completionId(1)
const BEFORE_CUTOFF_ID = completionId(2)
const NOT_ELIGIBLE_ID = completionId(3)
const REGISTERED_ELSEWHERE_ID = completionId(4)
const NO_CREDIT_UNIT_ID = completionId(5)
const REMOVED_ID = completionId(6)

const tiered = (
  id: string,
  completion: Omit<MockMoocfiCompletionSeed, "id" | "course_id" | "user_upstream_id">,
): MockMoocfiCompletionSeed => ({
  id,
  course_id: MOOCFI_TIERED_COURSE.id,
  user_upstream_id: STUDENT.upstreamId,
  eligible_for_ects: true,
  ...completion,
})

const TIERED_COMPLETIONS: MockMoocfiCompletionSeed[] = [
  tiered(REGISTERING_ID, { tier: 2 }),
  tiered(BEFORE_CUTOFF_ID, { tier: 3, completion_date: BEFORE_MOOCFI_CUTOFF }),
  tiered(NOT_ELIGIBLE_ID, { tier: 2, eligible_for_ects: false }),
  tiered(REGISTERED_ELSEWHERE_ID, {
    tier: 3,
    registrations: [
      {
        organization_slug: `not-${MOCK_MOOCFI_ORGANIZATION_SLUG}`,
        registration_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ],
  }),
  tiered(NO_CREDIT_UNIT_ID, { tier: 1 }),
  tiered(REMOVED_ID, { tier: 3 }),
]

/** Matches the row the seed stored, so the sync does not mark it removed. */
const PAUSED_COMPLETION: MockMoocfiCompletionSeed = {
  id: MOOCFI_PAUSED_COMPLETION_ID,
  course_id: MOOCFI_PAUSED_COURSE.id,
  user_upstream_id: STUDENT.upstreamId,
  eligible_for_ects: true,
  grade: MOOCFI_PAUSED_RAW_GRADE,
}

test.beforeEach(async ({ request }) => {
  await forgetMockMoocfiStudent(request, STUDENT)
  await seedMockMoocfiCompletions(request, [...TIERED_COMPLETIONS, PAUSED_COMPLETION])
})

test.afterEach(async ({ request }) => {
  await setMockMoocfiAvailableFor(request, STUDENT, true)
})

test("Each completion says how it is registered, and stale or missing data says so", async ({
  page,
  request,
}) => {
  await openRegistrationFromMoocfi(page, MOOCFI_TIERED_COURSE, STUDENT)

  await test.step("Every status reads as its own card", async () => {
    await expect(page.getByRole("heading", { name: "Registered on mooc.fi" })).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "No credits for this completion" }),
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Already registered" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Not registered here" })).toBeVisible()
    await expect(page.getByText(MOOCFI_TIER_2_TARGET_NAME).first()).toBeVisible()
    await accessibilityCheck(page, "mooc.fi registration page with every status")

    const { completions } = await myMoocfiCreditRegistrations(page.request, MOOCFI_TIERED_COURSE)
    const statusOf = (id: string) =>
      completions.find((completion) => completion.moocfi_completion_id === id)?.status
    expect(statusOf(REGISTERING_ID)).toBe("registering_on_courses")
    expect(statusOf(BEFORE_CUTOFF_ID)).toBe("before_cutoff")
    expect(statusOf(NOT_ELIGIBLE_ID)).toBe("not_eligible")
    expect(statusOf(REGISTERED_ELSEWHERE_ID)).toBe("registered_on_moocfi")
    expect(statusOf(NO_CREDIT_UNIT_ID)).toBe("no_credit_unit")
    expect(statusOf(REMOVED_ID)).toBe("registering_on_courses")
  })

  await test.step("A completion deleted on mooc.fi reads as removed", async () => {
    await deleteMockMoocfiCompletion(request, REMOVED_ID)
    await page.reload()
    await expect(page.getByRole("heading", { name: "Completion removed" })).toBeVisible()
  })

  await test.step("When mooc.fi cannot be reached, the stored completions show with a notice", async () => {
    await setMockMoocfiAvailableFor(request, STUDENT, false)
    await page.reload()
    await expect(
      page.getByText(
        "We could not reach mooc.fi just now, so your latest completions may be missing",
      ),
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Already registered" })).toBeVisible()
    // Never stored, so nothing remembers it while mooc.fi is away.
    await expect(page.getByRole("heading", { name: "Not registered here" })).toHaveCount(0)
    await setMockMoocfiAvailableFor(request, STUDENT, true)
  })

  await test.step("A paused course says so instead of reading as under way", async () => {
    await page.goto(moocfiRegistrationUrl(MOOCFI_PAUSED_COURSE))
    await expect(page.getByRole("heading", { name: "Registration paused" })).toBeVisible()
    await expect(page.getByText(MOOCFI_PAUSED_TARGET_NAME)).toBeVisible()
    await expect(page.getByText("Being registered")).toHaveCount(0)
  })

  await test.step("A course with no completion of the student's shows the empty state", async () => {
    await page.goto(moocfiRegistrationUrl(MOOCFI_COURSE))
    await expect(page.getByRole("heading", { name: "No completion found" })).toBeVisible()
    await expect(
      page.getByText("If you completed the course recently, try again from mooc.fi"),
    ).toBeVisible()
  })
})
