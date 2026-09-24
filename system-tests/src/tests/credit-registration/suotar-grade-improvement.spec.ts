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
  myCreditRegistrations,
  type MyCreditRegistration,
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
  transitionMockSuotarSubmission,
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
 * tests regrade student 2's one completion in place; the rest give student 3 new completions
 * through the teacher's manual completion endpoint. Each test continues from the one before it, so
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

/** The completion's newest attempt: after a regrade the registered one stays live beside it. */
const latestAttempt = async (studentApi: APIRequestContext, adminApi: APIRequestContext) => {
  const [latest] = (await myCreditRegistrations(studentApi))
    .filter((row) => row.course_slug === GRADE_IMPROVEMENT_COURSE_SLUG && !row.superseded)
    .toSorted((left, right) => right.attempt_number - left.attempt_number)
  if (latest === undefined) {
    throw new Error(`No live registration on ${GRADE_IMPROVEMENT_COURSE_SLUG}`)
  }
  const { registration } = await adminRegistrationDetails(adminApi, latest.id)
  return { ...latest, state: registration.state }
}

const waitForLatestAttempt = (
  studentApi: APIRequestContext,
  adminApi: APIRequestContext,
  states: readonly string[],
) =>
  pollUntil(
    async () => {
      const latest = await latestAttempt(studentApi, adminApi)
      return states.includes(latest.state) ? latest : null
    },
    { description: `the newest attempt to reach one of ${states.join(", ")}` },
  )

test("Raising a registered grade starts a new attempt, and the registered one stays the credit", async ({
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

  const second = await test.step("Regrading to 4 starts a new attempt", async () => {
    await regradeCompletion(page.request, { creditRegistrationId: first.id, grade: 4 })
    await runMaterializeTick(page.request, scope)

    const live = await waitForLatestAttempt(page.request, adminApi, [
      "ready_to_submit",
      "checking_enrolment",
      "submitting",
      "awaiting_verification",
      "not_improved",
    ])
    expect(live.attempt_number).toBe(2)
    expect(live.id).not.toBe(first.id)
    return live
  })

  await test.step("The registered attempt stays live until the new one replaces it", async () => {
    // Sisu holds grade 3 until grade 4 is registered: a new attempt that fails must not leave the
    // student looking at a failure for a credit they have.
    const held = await adminRegistrationDetails(adminApi, first.id)
    expect(held.registration.superseded).toBe(false)
    expect(held.registration.state).toBe("registered")
    expect(held.registration.terminal_at).not.toBeNull()

    const details = await adminRegistrationDetails(adminApi, second.id)
    expect(details.attempts.map((attempt) => attempt.attempt_number).toSorted()).toStrictEqual([
      1, 2,
    ])
    expect(details.attempts.filter((attempt) => !attempt.superseded)).toHaveLength(2)
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
    const notImproved = await waitForLatestAttempt(page.request, adminApi, ["not_improved"])
    expect(notImproved.id).toBe(second.id)
    expect((await adminRegistrationDetails(adminApi, first.id)).registration.superseded).toBe(false)

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
    const live = await latestAttempt(page.request, adminApi)
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
  const live = await latestAttempt(page.request, adminApi)
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
let reversedId = ""
let betterId = ""

const submittedAttainmentIdOf = async (adminApi: APIRequestContext, id: string) => {
  const submitted = (await adminRegistrationDetails(adminApi, id)).registration
    .submitted_attainment_id
  if (!submitted) {
    throw new Error(`registration ${id} has no submitted attainment id`)
  }
  return submitted
}

const myModuleView = (studentApi: APIRequestContext, courseModuleId: string) =>
  getJson<{
    registration: MyCreditRegistration
    earlier_attempts: MyCreditRegistration[]
  }>(studentApi, `${CREDIT_REGISTRATIONS_API}/my/by-course-module/${courseModuleId}`)

/** The grade-3 row is still the credit Sisu holds: live, registered and replaced by nothing. */
const expectRegisteredGradeHeld = async (adminApi: APIRequestContext) => {
  const { registration } = await adminRegistrationDetails(adminApi, registeredId)
  expect(registration.state).toBe("registered")
  expect(registration.superseded).toBe(false)
  expect(registration.superseded_by_id).toBeNull()
  expect((await laterStudentRows(adminApi, false)).map((row) => row.id)).toContain(registeredId)
}

const expectStudentSeesRegisteredGrade = async (
  studentApi: APIRequestContext,
  courseModuleId: string,
  liveId: string,
) => {
  const mine = await myModuleView(studentApi, courseModuleId)
  expect(mine.registration.id).toBe(liveId)
  expect(mine.earlier_attempts.find((attempt) => attempt.id === registeredId)).toMatchObject({
    superseded: false,
    student_facing_status: "registered",
  })
  return mine
}

test("A better grade given as a new completion is sent, and the registered one stays held meanwhile", async ({
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

  await test.step("The teacher's grade-5 completion is resolved without replacing it", async () => {
    reversedId = await addLaterCompletion(page, adminApi, 5)
    await runPreconditionsTick(page.request, laterScope)
    await runResolveEnrolmentsTick(page.request, laterScope)
    const improving = await waitForRowState(adminApi, reversedId, [
      "checking_enrolment",
      "submitting",
      "awaiting_verification",
    ])
    expect(improving.registration.grade_id).toBe("5")
    await expectRegisteredGradeHeld(adminApi)
    expect((await laterStudentRows(adminApi, false)).map((row) => row.id).toSorted()).toStrictEqual(
      [registeredId, reversedId].toSorted(),
    )
  })

  await test.step("The better grade is submitted beside the earlier one", async () => {
    await runImportSubmissionTick(page.request, laterScope)
    await waitForRowState(adminApi, reversedId, ["awaiting_verification"])
    expect(await importCount(page)).toBe(2)
    expect(await submittedGrades(page)).toStrictEqual(["3", "5"])
  })

  await test.step("An assessment item attainment alone replaces nothing", async () => {
    await transitionMockSuotarSubmission(
      page.request,
      await submittedAttainmentIdOf(adminApi, reversedId),
      "partiallyRegistered",
    )
    const pollsBefore = await countMockCallsForStudent(
      page.request,
      LATER_STUDENT_NUMBER,
      CRS_GRADED_101,
      "verify_attainments",
    )
    await makeRegistrationDueNow(adminApi, reversedId)
    await runVerifyPollTick(page.request, laterScope)
    expect(
      await countMockCallsForStudent(
        page.request,
        LATER_STUDENT_NUMBER,
        CRS_GRADED_101,
        "verify_attainments",
      ),
    ).toBeGreaterThan(pollsBefore)
    expect((await adminRegistrationDetails(adminApi, reversedId)).registration.state).toBe(
      "awaiting_verification",
    )
    await expectRegisteredGradeHeld(adminApi)
  })

  await test.step("The student sees the new attempt waiting and the registered grade beneath it", async () => {
    const { registration } = await adminRegistrationDetails(adminApi, reversedId)
    const studentApi = await playwright.request.newContext({
      storageState: seededStudentStorageState(LATER_STUDENT_EMAIL),
    })
    const mine = await expectStudentSeesRegisteredGrade(
      studentApi,
      registration.course_module_id,
      reversedId,
    )
    await studentApi.dispose()
    expect(mine.registration.student_facing_status).toBe("waiting_for_sisu")
  })
})

test("An improvement Sisu reverses leaves the registered grade as the credit, with nothing resent", async ({
  page,
  adminApi,
  playwright,
}) => {
  expect(reversedId, "this test continues from the previous one").not.toBe("")

  await test.step("Sisu reverses the grade-5 attainment", async () => {
    await transitionMockSuotarSubmission(
      page.request,
      await submittedAttainmentIdOf(adminApi, reversedId),
      "misregistered",
    )
    await makeRegistrationDueNow(adminApi, reversedId)
    await runVerifyPollTick(page.request, laterScope)
    await waitForRowState(adminApi, reversedId, ["misregistered"])
  })

  await test.step("The registered grade is the live credit, and neither grade is sent again", async () => {
    await expectRegisteredGradeHeld(adminApi)
    await runMaterializeTick(page.request, laterScope)
    await runResolveEnrolmentsTick(page.request, laterScope)
    await runImportSubmissionTick(page.request, laterScope)
    expect(await importCount(page)).toBe(2)
    expect(await submittedGrades(page)).toStrictEqual(["3", "5"])

    const { registration } = await adminRegistrationDetails(adminApi, reversedId)
    const studentApi = await playwright.request.newContext({
      storageState: seededStudentStorageState(LATER_STUDENT_EMAIL),
    })
    await expectStudentSeesRegisteredGrade(studentApi, registration.course_module_id, reversedId)
    await studentApi.dispose()
  })
})

test("A later completion that is not better waits for the one in flight and is never sent", async ({
  page,
  adminApi,
}) => {
  expect(reversedId, "this test continues from the previous one").not.toBe("")

  await test.step("Another grade-5 completion goes out while grade 3 stays held", async () => {
    betterId = await addLaterCompletion(page, adminApi, 5)
    await runPreconditionsTick(page.request, laterScope)
    await runResolveEnrolmentsTick(page.request, laterScope)
    await runImportSubmissionTick(page.request, laterScope)
    await waitForRowState(adminApi, betterId, ["awaiting_verification"])
    expect(await submittedGrades(page)).toStrictEqual(["3", "5", "5"])
    await expectRegisteredGradeHeld(adminApi)
  })

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

  await test.step("Once grade 5 registers it replaces grade 3, and grade 4 settles unsent", async () => {
    await transitionMockSuotarSubmission(
      page.request,
      await submittedAttainmentIdOf(adminApi, betterId),
      "registered",
    )
    await makeRegistrationDueNow(adminApi, betterId)
    await runVerifyPollTick(page.request, laterScope)
    await waitForRowState(adminApi, betterId, ["registered"])

    const earlier = await adminRegistrationDetails(adminApi, registeredId)
    expect(earlier.registration.superseded_by_id).toBe(betterId)
    // Kept as history: the registry really does hold that attainment.
    expect(earlier.registration.state).toBe("registered")

    await runResolveEnrolmentsTick(page.request, laterScope)
    await waitForRowState(adminApi, worseId, ["duplicate"])
    expect(await importCount(page)).toBe(3)
    expect(await submittedGrades(page)).toStrictEqual(["3", "5", "5"])

    const better = await adminRegistrationDetails(adminApi, betterId)
    expect(better.registration.state).toBe("registered")
    expect(better.registration.superseded).toBe(false)
    expect((await laterStudentRows(adminApi, false)).map((row) => row.id).toSorted()).toStrictEqual(
      [reversedId, betterId, worseId].toSorted(),
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
