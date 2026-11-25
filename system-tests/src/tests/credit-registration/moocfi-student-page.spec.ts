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
  MOOCFI_TIER_2_CODE_NAME,
  MOOCFI_TIERED_COURSE,
  moocfiRegistrationUrl,
  myMoocfiCreditRegistrations,
  openRegistrationFromMoocfi,
  seedMockMoocfiCompletions,
  setMockMoocfiAvailableFor,
  unitStatusesOf,
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
const TIER_1_ID = completionId(5)
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
  tiered(TIER_1_ID, { tier: 1 }),
  // Dated before the registered tier 3 completion, which would otherwise make it a repeat.
  tiered(REMOVED_ID, { tier: 3, completion_date: "2025-06-01T12:00:00Z" }),
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

  await test.step("Every completion reads as its own row", async () => {
    await expect(
      page.getByRole("heading", { name: "Register on the older version of the platform" }),
    ).toBeVisible()
    // The tier 1 completion earns no course, and the ineligible one no credits.
    await expect(page.getByRole("heading", { name: "No credits for this completion" })).toHaveCount(
      2,
    )
    await expect(page.getByRole("heading", { name: "Already registered" })).toBeVisible()
    await expect(page.getByText(MOOCFI_TIER_2_CODE_NAME).first()).toBeVisible()
    await accessibilityCheck(page, "mooc.fi registration page with every status")

    const registrations = await myMoocfiCreditRegistrations(page.request, MOOCFI_TIERED_COURSE)
    const statusesOf = (id: string) => unitStatusesOf(registrations, id)
    expect(statusesOf(REGISTERING_ID)).toStrictEqual(["registering_on_courses"])
    expect(statusesOf(BEFORE_CUTOFF_ID)).toStrictEqual(["before_cutoff", "before_cutoff"])
    expect(statusesOf(NOT_ELIGIBLE_ID)).toStrictEqual(["not_eligible"])
    expect(statusesOf(REGISTERED_ELSEWHERE_ID)).toStrictEqual([
      "registered_on_moocfi",
      "registered_on_moocfi",
    ])
    expect(statusesOf(TIER_1_ID)).toStrictEqual([])
    expect(statusesOf(REMOVED_ID)).toStrictEqual([
      "registering_on_courses",
      "registering_on_courses",
    ])
  })

  await test.step("Two completions registering each get their own page", async () => {
    await expect(page.getByText("You have more than one completion of this course.")).toBeVisible()
    const showLinks = page.getByRole("link", { name: "Show registration" })
    await expect(showLinks).toHaveCount(2)
    await showLinks.first().click()
    await page.waitForURL(/\?completion=/)
    await expect(page.getByRole("link", { name: "Show registration" })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Already registered" })).toHaveCount(0)
    await page.getByRole("link", { name: "All your completions" }).click()
    await page.waitForURL(moocfiRegistrationUrl(MOOCFI_TIERED_COURSE))
    await expect(showLinks).toHaveCount(2)
  })

  await test.step("A completion deleted on mooc.fi reads as removed", async () => {
    await deleteMockMoocfiCompletion(request, REMOVED_ID)
    await page.reload()
    // With one completion left registering, the page opens its stepper alone.
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Show registration" })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Already registered" })).toHaveCount(0)
    expect(
      unitStatusesOf(
        await myMoocfiCreditRegistrations(page.request, MOOCFI_TIERED_COURSE),
        REMOVED_ID,
      ),
    ).toStrictEqual(["removed_from_moocfi", "removed_from_moocfi"])
  })

  await test.step("When mooc.fi cannot be reached, the stored completions show with a notice", async () => {
    await setMockMoocfiAvailableFor(request, STUDENT, false)
    await page.reload()
    await expect(
      page.getByText(
        "We could not check the older version of the platform just now, so your latest completions may be missing",
      ),
    ).toBeVisible()
    const registrations = await myMoocfiCreditRegistrations(page.request, MOOCFI_TIERED_COURSE)
    expect(unitStatusesOf(registrations, REGISTERED_ELSEWHERE_ID)).toContain("registered_on_moocfi")
    // Never stored, so nothing remembers it while mooc.fi is away.
    expect(
      registrations.completions.map((completion) => completion.moocfi_completion_id),
    ).not.toContain(TIER_1_ID)
    await setMockMoocfiAvailableFor(request, STUDENT, true)
  })

  await test.step("A paused course says so instead of reading as under way", async () => {
    await page.goto(moocfiRegistrationUrl(MOOCFI_PAUSED_COURSE))
    await expect(page.getByRole("heading", { name: "Registration paused" })).toBeVisible()
    await expect(page.getByText(`Course: ${MOOCFI_PAUSED_TARGET_NAME}`)).toBeVisible()
    await expect(page.getByText("Being registered")).toHaveCount(0)
  })

  await test.step("A course with no completion of the student's shows the empty state", async () => {
    await page.goto(moocfiRegistrationUrl(MOOCFI_COURSE))
    await expect(page.getByRole("heading", { name: "No completion found" })).toBeVisible()
    await expect(
      page.getByText("If you completed the course just now, wait a moment"),
    ).toBeVisible()
  })
})
