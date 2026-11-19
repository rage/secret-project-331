import type { APIRequestContext } from "@playwright/test"

import { adminRegistrationDetails, listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import {
  BEFORE_MOOCFI_CUTOFF,
  forgetMockMoocfiStudent,
  MOCK_MOOCFI_ORGANIZATION_SLUG,
  type MockMoocfiCompletionSeed,
  type MoocfiCourse,
  MOOCFI_COURSE,
  MOOCFI_GRADED_COURSE,
  MOOCFI_GRADED_TARGET_ID,
  MOOCFI_STUDENT_4,
  MOOCFI_TARGET_ID,
  MOOCFI_TIER_2_TARGET_ID,
  MOOCFI_TIERED_COURSE,
  myMoocfiCreditRegistrations,
  openRegistrationFromMoocfi,
  seedMockMoocfiCompletions,
} from "@/utils/mockMoocfi"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import { runMaterializeTick } from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/** Owns `moocfi-student-4` on the delegated mooc.fi course. */
const STUDENT = MOOCFI_STUDENT_4
const BEFORE_CUTOFF_ID = "c5ed17ea-4a01-4a5e-9e6e-c0de00004a01"
const AFTER_CUTOFF_ID = "c5ed17ea-4a02-4a5e-9e6e-c0de00004a02"
const completionId = (n: number) => `c5ed17ea-4b0${n}-4a5e-9e6e-c0de00004b0${n}`

/** Registered by the older platform's pull, as another organization on mooc.fi. */
const REGISTERED_BY_PULL: MockMoocfiCompletionSeed["registrations"] = [
  {
    organization_slug: `not-${MOCK_MOOCFI_ORGANIZATION_SLUG}`,
    registration_date: BEFORE_MOOCFI_CUTOFF,
    created_at: BEFORE_MOOCFI_CUTOFF,
  },
]

const completionOf = (
  course: MoocfiCourse,
  id: string,
  completion: Omit<MockMoocfiCompletionSeed, "id" | "course_id" | "user_upstream_id">,
): MockMoocfiCompletionSeed => ({
  id,
  course_id: course.id,
  user_upstream_id: STUDENT.upstreamId,
  eligible_for_ects: true,
  ...completion,
})

/** The moocfi completion ids of the student's ledger rows on a target. */
const ledgeredCompletionIds = async (
  adminApi: APIRequestContext,
  targetId: string,
): Promise<string[]> => {
  const { data } = await listAdminRegistrations(adminApi, { course_id: targetId })
  const mine = data.filter((row) => row.email === STUDENT.email)
  return Promise.all(
    mine.map(
      async (row) =>
        (await adminRegistrationDetails(adminApi, row.id)).moocfi_completion
          ?.moocfi_completion_id ?? "",
    ),
  )
}

test("A completion from before the cutoff stays with mooc.fi and only the later one is registered here", async ({
  page,
  request,
  adminApi,
}) => {
  await forgetMockMoocfiStudent(request, STUDENT)
  await seedMockMoocfiCompletions(request, [
    {
      id: BEFORE_CUTOFF_ID,
      course_id: MOOCFI_COURSE.id,
      user_upstream_id: STUDENT.upstreamId,
      completion_date: BEFORE_MOOCFI_CUTOFF,
      eligible_for_ects: true,
    },
    {
      id: AFTER_CUTOFF_ID,
      course_id: MOOCFI_COURSE.id,
      user_upstream_id: STUDENT.upstreamId,
      eligible_for_ects: true,
    },
  ])

  await openRegistrationFromMoocfi(page, MOOCFI_COURSE, STUDENT)
  // The later completion is the only one registering here, so the page opens its stepper alone.
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Register on the older version of the platform" }),
  ).toHaveCount(0)

  const { completions } = await myMoocfiCreditRegistrations(page.request, MOOCFI_COURSE)
  const before = completions.find(
    (completion) => completion.moocfi_completion_id === BEFORE_CUTOFF_ID,
  )
  const after = completions.find(
    (completion) => completion.moocfi_completion_id === AFTER_CUTOFF_ID,
  )
  expect(before?.status).toBe("before_cutoff")
  expect(before?.external_completion_id ?? null).toBeNull()
  expect(after?.status).toBe("registering_on_courses")
  expect(after?.external_completion_id).toBeTruthy()

  await runMaterializeTick(request, {
    externalCreditTargetId: MOOCFI_TARGET_ID,
    userEmail: STUDENT.email,
  })
  const rows = await pollUntil(
    async () => {
      const { data } = await listAdminRegistrations(adminApi, { course_id: MOOCFI_TARGET_ID })
      const mine = data.filter((row) => row.email === STUDENT.email)
      return mine.length > 0 ? mine : null
    },
    { description: `a ledger row for ${STUDENT.email} on the mooc.fi target` },
  )
  expect(rows).toHaveLength(1)
  const [row] = rows
  const details = await adminRegistrationDetails(adminApi, row?.id ?? "")
  expect(details.moocfi_completion?.moocfi_completion_id).toBe(AFTER_CUTOFF_ID)
})

test("A later completion with the same grade and tier as a registered one is not registered again", async ({
  page,
  request,
  adminApi,
}) => {
  const registeredId = completionId(1)
  const repeatId = completionId(2)
  await forgetMockMoocfiStudent(request, STUDENT)
  await seedMockMoocfiCompletions(request, [
    completionOf(MOOCFI_COURSE, registeredId, {
      completion_date: BEFORE_MOOCFI_CUTOFF,
      grade: null,
      registrations: REGISTERED_BY_PULL,
    }),
    // A pass in other words, so the same grade.
    completionOf(MOOCFI_COURSE, repeatId, { grade: "Hyväksytty" }),
  ])

  await openRegistrationFromMoocfi(page, MOOCFI_COURSE, STUDENT)
  await expect(
    page.getByText(
      "An earlier completion of this course with the same grade and level has already been registered",
    ),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0)

  const { completions } = await myMoocfiCreditRegistrations(page.request, MOOCFI_COURSE)
  const repeat = completions.find((completion) => completion.moocfi_completion_id === repeatId)
  expect(repeat?.status).toBe("equivalent_registered")

  await runMaterializeTick(request, {
    externalCreditTargetId: MOOCFI_TARGET_ID,
    userEmail: STUDENT.email,
  })
  expect(await ledgeredCompletionIds(adminApi, MOOCFI_TARGET_ID)).not.toContain(repeatId)
})

test("A different grade or tier, or an earlier completion not registered, leaves a later one registrable", async ({
  page,
  request,
  adminApi,
}) => {
  const lowerGradeId = completionId(3)
  const higherGradeId = completionId(4)
  const otherTierId = completionId(5)
  const untieredId = completionId(6)
  const unregisteredId = completionId(7)
  const afterUnregisteredId = completionId(8)
  await forgetMockMoocfiStudent(request, STUDENT)
  await seedMockMoocfiCompletions(request, [
    completionOf(MOOCFI_GRADED_COURSE, lowerGradeId, {
      completion_date: BEFORE_MOOCFI_CUTOFF,
      grade: "3",
      registrations: REGISTERED_BY_PULL,
    }),
    completionOf(MOOCFI_GRADED_COURSE, higherGradeId, { grade: "5" }),
    completionOf(MOOCFI_COURSE, otherTierId, {
      completion_date: BEFORE_MOOCFI_CUTOFF,
      tier: 1,
      registrations: REGISTERED_BY_PULL,
    }),
    completionOf(MOOCFI_COURSE, untieredId, {}),
    completionOf(MOOCFI_TIERED_COURSE, unregisteredId, {
      completion_date: BEFORE_MOOCFI_CUTOFF,
      tier: 2,
    }),
    completionOf(MOOCFI_TIERED_COURSE, afterUnregisteredId, { tier: 2 }),
  ])

  await openRegistrationFromMoocfi(page, MOOCFI_COURSE, STUDENT)
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible()

  for (const [course, targetId, laterId] of [
    [MOOCFI_GRADED_COURSE, MOOCFI_GRADED_TARGET_ID, higherGradeId],
    [MOOCFI_COURSE, MOOCFI_TARGET_ID, untieredId],
    [MOOCFI_TIERED_COURSE, MOOCFI_TIER_2_TARGET_ID, afterUnregisteredId],
  ] as const) {
    await test.step(`${laterId} registers on ${course.slug}`, async () => {
      const { completions } = await myMoocfiCreditRegistrations(page.request, course)
      expect(
        completions.find((completion) => completion.moocfi_completion_id === laterId)?.status,
      ).toBe("registering_on_courses")
      await runMaterializeTick(request, {
        externalCreditTargetId: targetId,
        userEmail: STUDENT.email,
      })
      await pollUntil(
        async () => (await ledgeredCompletionIds(adminApi, targetId)).includes(laterId) || null,
        { description: `a ledger row for ${laterId}` },
      )
    })
  }
})
