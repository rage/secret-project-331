import {
  completionRegistrationUrl,
  CRS_GRADED_101,
  countMockCallsForStudent,
  GRADE_IMPROVEMENT_COURSE_SLUG,
  mockCallsForStudent,
  myRegistrationOnCourse,
  seededStudentStorageState,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import {
  adminRegistrationDetails,
  listAdminRegistrations,
  makeRegistrationDueNow,
} from "@/utils/creditRegistrationAdmin"
import { expect, test } from "@/utils/fixtures"
import { transitionMockSuotarSubmissionsFor, upsertMockSuotarAttainments } from "@/utils/mockSuotar"
import {
  regradeCompletion,
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"

/**
 * Owns student numbers `9000012xx` and the grade-improvement course outright: it is the only seeded
 * module on a graded scale, and both tests below regrade the one completion on it, so they run in
 * order and nothing else may write to that course.
 */
const STUDENT_EMAIL = "credit-registration-grade-improvement@example.com"
const STUDENT_NUMBER = "900001201"
const NUMERIC_SCALE = "sis-0-5"
const scope = { userEmail: STUDENT_EMAIL }

test.use({ storageState: seededStudentStorageState(STUDENT_EMAIL) })
test.describe.configure({ mode: "serial" })

test("Raising a registered grade starts a new attempt and supersedes the old one", async ({
  page,
  adminApi,
}) => {
  const first = await test.step("The seeded grade-3 completion registers", async () => {
    await runMaterializeTick(page.request, scope)
    await runPreconditionsTick(page.request, scope)
    await runResolveEnrolmentsTick(page.request, scope)
    await runImportSubmissionTick(page.request, scope)
    const submitted = await waitForRegistrationState(
      page.request,
      adminApi,
      GRADE_IMPROVEMENT_COURSE_SLUG,
      ["awaiting_verification"],
    )
    await transitionMockSuotarSubmissionsFor(
      page.request,
      STUDENT_NUMBER,
      "registered",
      CRS_GRADED_101,
    )
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)
    return await waitForRegistrationState(page.request, adminApi, GRADE_IMPROVEMENT_COURSE_SLUG, [
      "registered",
    ])
  })

  await test.step("The registry gains a grade it will not let 4 replace", async () => {
    // Newer than the attempt-1 attainment, so enrolment resolution still matches that one and sees
    // a grade worth beating; only the import call compares against every attainment the person has.
    await upsertMockSuotarAttainments(page.request, [
      {
        studentNumber: STUDENT_NUMBER,
        courseCode: CRS_GRADED_101,
        attainmentDate: new Date().toISOString().slice(0, 10),
        gradeScaleId: NUMERIC_SCALE,
        gradeId: "5",
      },
    ])
  })

  const second = await test.step("Regrading to 4 supersedes the registered attempt", async () => {
    await regradeCompletion(page.request, { creditRegistrationId: first.id, grade: 4 })
    await runMaterializeTick(page.request, scope)

    const live = await waitForRegistrationState(
      page.request,
      adminApi,
      GRADE_IMPROVEMENT_COURSE_SLUG,
      [
        "ready_to_submit",
        "checking_enrolment",
        "submitting",
        "awaiting_verification",
        "not_improved",
      ],
    )
    expect(live.attempt_number).toBe(2)
    expect(live.id).not.toBe(first.id)

    const superseded = await adminRegistrationDetails(adminApi, first.id)
    expect(superseded.registration.superseded).toBe(true)
    // It really was registered; an implementation that rewrites the old row's state loses that.
    expect(superseded.registration.state).toBe("registered")
    expect(superseded.registration.terminal_at).not.toBeNull()
    return live
  })

  await test.step("Exactly one live row remains for the completion", async () => {
    const details = await adminRegistrationDetails(adminApi, second.id)
    expect(details.attempts.map((attempt) => attempt.attempt_number).toSorted()).toStrictEqual([
      1, 2,
    ])
    expect(details.attempts.filter((attempt) => !attempt.superseded)).toHaveLength(1)
  })

  await test.step("The new attempt is submitted under its own request item id", async () => {
    await runResolveEnrolmentsTick(page.request, scope)
    await runImportSubmissionTick(page.request, scope)

    const details = await adminRegistrationDetails(adminApi, second.id)
    expect(details.registration.grade_id, "the new attempt froze the old grade").toBe("4")
    expect(details.registration.grade_scale_id).toBe(NUMERIC_SCALE)

    const imports = await mockCallsForStudent(page.request, STUDENT_NUMBER, "import_attainments")
    expect(imports).toHaveLength(2)
    const requestItemIds = imports.flatMap((call) => call.items.map((item) => item.requestItemId))
    // What makes a line in the registry's log map to one attempt rather than to the completion.
    expect(requestItemIds).toContain(`cr-${first.id}`)
    expect(requestItemIds).toContain(`cr-${second.id}`)
  })

  await test.step("The registry declines it, and the verdict is its own outcome", async () => {
    const notImproved = await waitForRegistrationState(
      page.request,
      adminApi,
      GRADE_IMPROVEMENT_COURSE_SLUG,
      ["not_improved"],
    )
    expect(notImproved.id).toBe(second.id)

    const details = await adminRegistrationDetails(adminApi, second.id)
    expect(details.not_improved_attainment).toMatchObject({
      grade_id: "5",
      grade_scale_id: NUMERIC_SCALE,
    })
    // Not a failure and not something an operator is asked to look at.
    expect(details.registration.needs_admin_attention).toBe(false)

    const bucket = await listAdminRegistrations(adminApi, {
      student_number: STUDENT_NUMBER,
      state: "not_improved",
    })
    expect(bucket.data.map((row) => row.id)).toContain(second.id)
    for (const failure of ["failed_permanent", "failed_retryable"]) {
      const failed = await listAdminRegistrations(adminApi, {
        student_number: STUDENT_NUMBER,
        state: failure,
      })
      expect(failed.data, `the declined attempt was counted as ${failure}`).toHaveLength(0)
    }
  })

  await test.step("The student is told the registry already has a better grade", async () => {
    const live = await myRegistrationOnCourse(page.request, adminApi, GRADE_IMPROVEMENT_COURSE_SLUG)
    await page.goto(completionRegistrationUrl(live.course_module_id))
    await expect(page.getByText("Registered in Sisu").first()).toBeVisible()
    await expect(
      page.getByText("The study registry already holds an equal or better grade"),
    ).toBeVisible()
    // Collapsed beneath the live one, never hidden: the registry may hold both attainments.
    await expect(page.getByRole("heading", { name: "Earlier attempts" })).toBeVisible()
    await expect(page.getByText("Attempt 1, grade 3")).toBeVisible()
  })
})

test("A downward, equal or cross-scale regrade resubmits nothing", async ({ page, adminApi }) => {
  const live = await myRegistrationOnCourse(page.request, adminApi, GRADE_IMPROVEMENT_COURSE_SLUG)
  expect(live.attempt_number, "this test continues from the previous one").toBe(2)
  const importsBefore = await countMockCallsForStudent(
    page.request,
    STUDENT_NUMBER,
    "import_attainments",
  )

  // The same grade, a lower one, and one on a scale that does not rank against 4 at all: a
  // resubmit-on-any-change implementation passes every assertion above and fails all three of these.
  for (const grade of [4, 3, null]) {
    await test.step(`Regrading to ${grade ?? "pass/fail"} creates no attempt`, async () => {
      await regradeCompletion(page.request, { creditRegistrationId: live.id, grade })
      await runMaterializeTick(page.request, scope)

      const details = await adminRegistrationDetails(adminApi, live.id)
      expect(details.attempts).toHaveLength(2)
      expect(details.registration.superseded).toBe(false)
      expect(details.registration.state).toBe("not_improved")
      expect(details.registration.needs_admin_attention).toBe(false)
      expect(
        await countMockCallsForStudent(page.request, STUDENT_NUMBER, "import_attainments"),
      ).toBe(importsBefore)
    })
  }
})
