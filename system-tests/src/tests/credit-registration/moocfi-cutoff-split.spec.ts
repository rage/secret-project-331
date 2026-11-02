import { adminRegistrationDetails, listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import {
  BEFORE_MOOCFI_CUTOFF,
  forgetMockMoocfiStudent,
  MOOCFI_COURSE,
  MOOCFI_STUDENT_4,
  MOOCFI_TARGET_ID,
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
  await expect(page.getByRole("heading", { name: "Registered on mooc.fi" })).toBeVisible()
  await expect(
    page.getByText("This completion is from before credit registration moved here"),
  ).toBeVisible()

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
