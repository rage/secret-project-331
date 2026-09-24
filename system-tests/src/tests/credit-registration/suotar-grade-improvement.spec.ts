import type { APIRequestContext, Page } from "@playwright/test"

import {
  addManualCompletion,
  completionRegistrationUrl,
  CREDIT_REGISTRATION_STUDENT_2,
  CREDIT_REGISTRATION_STUDENT_3,
  CREDIT_REGISTRATION_STUDENT_3_USER_ID,
  CREDIT_REGISTRATIONS_API,
  CRS_GRADED_101,
  countMockCallsForStudent,
  getJson,
  GRADE_IMPROVEMENT_COURSE_ID,
  GRADE_IMPROVEMENT_COURSE_SLUG,
  mockCallsForStudent,
  type MyCreditRegistration,
  myRegistrationOnCourse,
  seededStudentStorageState,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import {
  adminRegistrationDetails,
  listAdminRegistrations,
  makeRegistrationDueNow,
} from "@/utils/creditRegistrationAdmin"
import {
  activeStudyRightPeriod,
  mockSuotarSubmissionsFor,
  transitionMockSuotarSubmissionsFor,
  upsertMockSuotarAttainments,
  upsertMockSuotarEnrolments,
} from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  regradeCompletion,
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runStudentNotificationsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns the grade-improvement course outright, with `credit-registration-student-2` and
 * `credit-registration-student-3` on it: it is the only seeded module on a graded scale. The first two
 * tests regrade student 2's one completion in place; the last two give student 3 new completions
 * through the teacher's manual completion endpoint. Each pair continues from the one before it, so
 * they run in order and nothing else may write to that course.
 * `retries: 0` follows: a retry replays the group from its first test, which by then would run against
 * the grade the last one left behind, so retrying only turns one failure into three.
 */
const STUDENT_EMAIL = CREDIT_REGISTRATION_STUDENT_2.email
const STUDENT_NUMBER = CREDIT_REGISTRATION_STUDENT_2.studentNumber
const NUMERIC_SCALE = "sis-0-5"
const scope = { userEmail: STUDENT_EMAIL, courseSlug: GRADE_IMPROVEMENT_COURSE_SLUG }

test.use({ storageState: seededStudentStorageState(STUDENT_EMAIL) })
test.describe.configure({ mode: "serial", retries: 0 })

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
    // Only after enrolment resolution, which would otherwise settle the row as a duplicate: the
    // import call is what has to catch a better grade that reached the registry in between.
    await upsertMockSuotarAttainments(page.request, [
      {
        studentNumber: STUDENT_NUMBER,
        courseCode: CRS_GRADED_101,
        attainmentDate: new Date().toISOString().slice(0, 10),
        gradeScaleId: NUMERIC_SCALE,
        gradeId: "5",
      },
    ])
    await runImportSubmissionTick(page.request, scope)

    const details = await adminRegistrationDetails(adminApi, second.id)
    expect(details.registration.grade_id, "the new attempt froze the old grade").toBe("4")
    expect(details.registration.grade_scale_id).toBe(NUMERIC_SCALE)

    const imports = await mockCallsForStudent(
      page.request,
      STUDENT_NUMBER,
      CRS_GRADED_101,
      "import_attainments",
    )
    expect(imports).toHaveLength(2)
    const sentItemIds = imports.flatMap((call) => call.items.map((item) => item.requestItemId))
    // What makes a line in the registry's log map to one attempt rather than to the completion.
    const recordedItemIds = async (registrationId: string) =>
      (await adminRegistrationDetails(adminApi, registrationId)).events
        .map((event) => event.request_item_id)
        .filter((id) => id !== null && sentItemIds.includes(id))
    const firstItemIds = await recordedItemIds(first.id)
    const secondItemIds = await recordedItemIds(second.id)
    expect(firstItemIds.length).toBeGreaterThan(0)
    expect(secondItemIds.length).toBeGreaterThan(0)
    expect(firstItemIds.filter((id) => secondItemIds.includes(id))).toHaveLength(0)
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
      course_id: GRADE_IMPROVEMENT_COURSE_ID,
      state: "not_improved",
    })
    expect(bucket.data.map((row) => row.id)).toContain(second.id)
    const failureStates = ["failed_permanent", "failed_retryable"]
    const failedBuckets = await Promise.all(
      failureStates.map((state) =>
        listAdminRegistrations(adminApi, {
          student_number: STUDENT_NUMBER,
          course_id: GRADE_IMPROVEMENT_COURSE_ID,
          state,
        }),
      ),
    )
    failedBuckets.forEach((failed, index) => {
      expect(
        failed.data,
        `the declined attempt was counted as ${failureStates[index]}`,
      ).toHaveLength(0)
    })
  })

  await test.step("The student is told the registry already has a better grade", async () => {
    const live = await myRegistrationOnCourse(page.request, adminApi, GRADE_IMPROVEMENT_COURSE_SLUG)
    await page.goto(completionRegistrationUrl(live.course_module_id))
    await expect(page.getByText("Registered in Sisu").first()).toBeVisible()
    await expect(
      page.getByText("Sisu already holds an equal or better grade for this course"),
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
    CRS_GRADED_101,
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
        await countMockCallsForStudent(
          page.request,
          STUDENT_NUMBER,
          CRS_GRADED_101,
          "import_attainments",
        ),
      ).toBe(importsBefore)
    })
  }
})

const LATER_STUDENT_EMAIL = CREDIT_REGISTRATION_STUDENT_3.email
const LATER_STUDENT_NUMBER = CREDIT_REGISTRATION_STUDENT_3.studentNumber
const laterScope = { userEmail: LATER_STUDENT_EMAIL, courseSlug: GRADE_IMPROVEMENT_COURSE_SLUG }

const laterStudentRows = async (adminApi: APIRequestContext, includeSuperseded: boolean) =>
  (
    await listAdminRegistrations(adminApi, {
      student_number: LATER_STUDENT_NUMBER,
      course_id: GRADE_IMPROVEMENT_COURSE_ID,
      include_superseded: includeSuperseded,
    })
  ).data

const waitForRowState = (adminApi: APIRequestContext, id: string, states: readonly string[]) =>
  pollUntil(
    async () => {
      const details = await adminRegistrationDetails(adminApi, id)
      return states.includes(details.registration.state) ? details : null
    },
    { description: `registration ${id} to reach one of ${states.join(", ")}` },
  )

/** Adds a completion as the teacher and returns the id of the ledger row materialize gives it. */
const addLaterCompletion = async (page: Page, adminApi: APIRequestContext, grade: number) => {
  const known = new Set((await laterStudentRows(adminApi, true)).map((row) => row.id))
  await addManualCompletion(adminApi, {
    courseId: GRADE_IMPROVEMENT_COURSE_ID,
    userId: CREDIT_REGISTRATION_STUDENT_3_USER_ID,
    grade,
  })
  await runMaterializeTick(page.request, laterScope)
  return pollUntil(
    async () =>
      (await laterStudentRows(adminApi, true)).find((row) => !known.has(row.id))?.id ?? null,
    { description: `a ledger row for the grade-${grade} completion` },
  )
}

const importCount = (page: Page) =>
  countMockCallsForStudent(page.request, LATER_STUDENT_NUMBER, CRS_GRADED_101, "import_attainments")

const submittedGrades = async (page: Page) =>
  (await mockSuotarSubmissionsFor(page.request, LATER_STUDENT_NUMBER, CRS_GRADED_101)).map(
    (submission) => submission.gradeId,
  )

let registeredId = ""
let betterId = ""

test("A better grade given as a new completion supersedes the registered one and is sent", async ({
  page,
  adminApi,
  playwright,
}) => {
  await test.step("The first completion, graded 3, registers", async () => {
    await upsertMockSuotarEnrolments(page.request, [
      {
        studentNumber: LATER_STUDENT_NUMBER,
        courseCode: CRS_GRADED_101,
        kind: "degree",
        state: "ENROLLED",
        studyRightValidityPeriod: activeStudyRightPeriod(),
      },
    ])
    registeredId = await addLaterCompletion(page, adminApi, 3)
    await runPreconditionsTick(page.request, laterScope)
    await runResolveEnrolmentsTick(page.request, laterScope)
    await runImportSubmissionTick(page.request, laterScope)
    await waitForRowState(adminApi, registeredId, ["awaiting_verification"])
    await transitionMockSuotarSubmissionsFor(
      page.request,
      LATER_STUDENT_NUMBER,
      "registered",
      CRS_GRADED_101,
    )
    await makeRegistrationDueNow(adminApi, registeredId)
    await runVerifyPollTick(page.request, laterScope)
    await waitForRowState(adminApi, registeredId, ["registered"])
  })

  await test.step("The teacher's grade-5 completion takes over the registration", async () => {
    betterId = await addLaterCompletion(page, adminApi, 5)
    await runPreconditionsTick(page.request, laterScope)
    await runResolveEnrolmentsTick(page.request, laterScope)
    const better = await waitForRowState(adminApi, betterId, [
      "checking_enrolment",
      "submitting",
      "awaiting_verification",
    ])
    expect(better.registration.grade_id).toBe("5")

    const earlier = await adminRegistrationDetails(adminApi, registeredId)
    expect(earlier.registration.superseded_by_id).toBe(betterId)
    // Kept as history: the registry really does hold that attainment.
    expect(earlier.registration.state).toBe("registered")
    expect((await laterStudentRows(adminApi, false)).map((row) => row.id)).toStrictEqual([betterId])
  })

  await test.step("The better grade is submitted beside the earlier one", async () => {
    await runImportSubmissionTick(page.request, laterScope)
    await waitForRowState(adminApi, betterId, ["awaiting_verification"])
    expect(await importCount(page)).toBe(2)
    expect(await submittedGrades(page)).toStrictEqual(["3", "5"])
  })

  await test.step("The student sees the new attempt with the earlier one beneath it", async () => {
    const { registration } = await adminRegistrationDetails(adminApi, betterId)
    const studentApi = await playwright.request.newContext({
      storageState: seededStudentStorageState(LATER_STUDENT_EMAIL),
    })
    const mine = await getJson<{
      registration: MyCreditRegistration
      earlier_attempts: MyCreditRegistration[]
    }>(
      studentApi,
      `${CREDIT_REGISTRATIONS_API}/my/by-course-module/${registration.course_module_id}`,
    )
    await studentApi.dispose()
    expect(mine.registration.id).toBe(betterId)
    expect(mine.earlier_attempts.map((attempt) => [attempt.id, attempt.superseded])).toContainEqual(
      [registeredId, true],
    )
  })
})

test("A later completion that is not better waits for the one in flight and is never sent", async ({
  page,
  adminApi,
}) => {
  expect(betterId, "this test continues from the previous one").not.toBe("")
  const resolvesBefore = await countMockCallsForStudent(
    page.request,
    LATER_STUDENT_NUMBER,
    CRS_GRADED_101,
    "resolve_enrolments",
  )

  const worseId =
    await test.step("A grade-4 completion is held while grade 5 is in flight", async () => {
      const id = await addLaterCompletion(page, adminApi, 4)
      await runPreconditionsTick(page.request, laterScope)
      await waitForRowState(adminApi, id, ["ready_to_submit"])
      await runResolveEnrolmentsTick(page.request, laterScope)
      // Nothing but a resolve claim moves it on, and that claim holds it back.
      expect((await adminRegistrationDetails(adminApi, id)).registration.state).toBe(
        "ready_to_submit",
      )
      expect(
        await countMockCallsForStudent(
          page.request,
          LATER_STUDENT_NUMBER,
          CRS_GRADED_101,
          "resolve_enrolments",
        ),
      ).toBe(resolvesBefore)
      return id
    })

  await test.step("Once grade 5 registers, grade 4 settles without a submission", async () => {
    await transitionMockSuotarSubmissionsFor(
      page.request,
      LATER_STUDENT_NUMBER,
      "registered",
      CRS_GRADED_101,
    )
    await makeRegistrationDueNow(adminApi, betterId)
    await runVerifyPollTick(page.request, laterScope)
    await waitForRowState(adminApi, betterId, ["registered"])

    await runResolveEnrolmentsTick(page.request, laterScope)
    await waitForRowState(adminApi, worseId, ["duplicate"])
    expect(await importCount(page)).toBe(2)
    expect(await submittedGrades(page)).toStrictEqual(["3", "5"])

    const better = await adminRegistrationDetails(adminApi, betterId)
    expect(better.registration.state).toBe("registered")
    expect(better.registration.superseded).toBe(false)
    expect((await laterStudentRows(adminApi, false)).map((row) => row.id).toSorted()).toStrictEqual(
      [betterId, worseId].toSorted(),
    )
  })

  await test.step("Only the registered grade is mailed as registered", async () => {
    await runStudentNotificationsTick(page.request, laterScope)
    const registeredMails = async (id: string) =>
      (await adminRegistrationDetails(adminApi, id)).notification_emails.filter(
        (mail) => mail.kind === "registered",
      )
    expect(await registeredMails(betterId)).toHaveLength(1)
    expect(await registeredMails(worseId)).toHaveLength(0)
  })
})
