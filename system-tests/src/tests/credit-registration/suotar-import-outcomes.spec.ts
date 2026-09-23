import {
  countMockCallsForStudent,
  CRS_101,
  IMPORT_OUTCOMES_COURSE_SLUG,
  myCreditRegistrations,
  myRegistrationOnCourse,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import {
  adminRegistrationDetails,
  listAdminRegistrations,
  makeRegistrationDueNow,
} from "@/utils/creditRegistrationAdmin"
import {
  applyMockSuotarScenario,
  armMockSuotarFault,
  disarmMockSuotarFault,
  transitionMockSuotarSubmissionsFor,
} from "@/utils/mockSuotar"
import { ADMIN_STORAGE_STATE, expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  runConfigValidationTick,
  runImportSubmissionTick,
  runMaterializeTick,
  runPhasesUpToSubmission,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runTickUnchecked,
  runVerifyPollTick,
  setTestExclusiveHold,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/** Owns student numbers `9000004xx`. */
const TIMEOUT_EMAIL = "credit-registration-import-timeout@example.com"
const TIMEOUT_STUDENT_NUMBER = "900000402"
const UNANSWERED_EMAIL = "credit-registration-import-unanswered@example.com"
const UNANSWERED_STUDENT_NUMBER = "900000403"
const OUTCOMES_EMAIL = "credit-registration-import-outcomes@example.com"
const MALFORMED_EMAIL = "credit-registration-import-malformed@example.com"
const MALFORMED_STUDENT_NUMBER = "900000404"
const BESIDE_MALFORMED_EMAIL = "credit-registration-import-beside-malformed@example.com"
const BESIDE_MALFORMED_STUDENT_NUMBER = "900000405"
const MALFORMED_FAULT_ID = "import-outcomes-malformed"

test.describe("An import the study registry never answered", () => {
  test.use({ storageState: seededStudentStorageState(TIMEOUT_EMAIL) })

  test("A Sisu timeout never re-imports, and recovers through verification only", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: TIMEOUT_EMAIL }

    // The scenario arms the timeout after the mock has already written the submission: the study
    // registry holds the attainment and we have no answer saying so.
    await applyMockSuotarScenario(page.request, "timeout-but-landed", {
      studentNumber: TIMEOUT_STUDENT_NUMBER,
      courseCode: CRS_101,
      owner: { user: TIMEOUT_EMAIL, course: SUOTAR_COURSE_SLUG },
    })

    await runMaterializeTick(page.request, scope)
    // The live credit-registrar worker keeps ticking this seeded-as-completed row regardless of
    // this spec: if it reached resolve-enrolments before the scenario above created the mock
    // enrolment, the row is now parked in `no_usable_enrolment` with a 24h backoff. Forcing it due
    // now is a no-op for a fresh row and the only way to unstick a backfilled one.
    const materialized = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)
    await makeRegistrationDueNow(adminApi, materialized.id)
    await runPreconditionsTick(page.request, scope)
    await runResolveEnrolmentsTick(page.request, scope)
    // A batch answered with nothing but `sisuTimeout` is what a Sisu outage looks like, so the
    // iteration fails, which counts it against the breaker that pauses import alone.
    const importTick = await runTickUnchecked(page.request, "import", scope)
    expect(importTick.status === "ran" ? importTick.error : null).not.toBeNull()

    const uncertain = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "submission_uncertain",
    ])
    // `sisuTimeout` still names the attainment it wrote, which is what verification polls by.
    const details = await adminRegistrationDetails(adminApi, uncertain.id)
    expect(details.registration.submitted_attainment_id).not.toBeNull()
    expect(
      await countMockCallsForStudent(page.request, TIMEOUT_STUDENT_NUMBER, "import_attainments"),
    ).toBe(1)

    await test.step("Further import passes send nothing", async () => {
      await runImportSubmissionTick(page.request, scope)
      await runImportSubmissionTick(page.request, scope)
      // Import never claims a `submission_uncertain` row, however many workers tick in between: a
      // second import would add a second attainment to a real transcript.
      const row = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)
      expect(row.state).toBe("submission_uncertain")
      expect(
        await countMockCallsForStudent(page.request, TIMEOUT_STUDENT_NUMBER, "import_attainments"),
      ).toBe(1)
    })

    await test.step("A pending submission keeps the row uncertain", async () => {
      await makeRegistrationDueNow(adminApi, uncertain.id)
      await runVerifyPollTick(page.request, scope)
      await pollUntil(
        async () =>
          (await countMockCallsForStudent(
            page.request,
            TIMEOUT_STUDENT_NUMBER,
            "verify_attainments",
          )) > 0 || null,
        { description: "the uncertain row to be verified" },
      )
      const row = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)
      expect(row.state).toBe("submission_uncertain")
    })

    await test.step("Verification is the only way out", async () => {
      await transitionMockSuotarSubmissionsFor(
        page.request,
        TIMEOUT_STUDENT_NUMBER,
        "registered",
        CRS_101,
      )
      await makeRegistrationDueNow(adminApi, uncertain.id)
      await runVerifyPollTick(page.request, scope)
      const registered = await waitForRegistrationState(
        page.request,
        adminApi,
        SUOTAR_COURSE_SLUG,
        ["registered"],
      )
      expect(registered.sisu_attainment_id).not.toBeNull()
      expect(
        await countMockCallsForStudent(page.request, TIMEOUT_STUDENT_NUMBER, "import_attainments"),
      ).toBe(1)
    })
  })
})

test.describe("An import whose answer left the item out", () => {
  test.use({ storageState: seededStudentStorageState(UNANSWERED_EMAIL) })

  test("The row is uncertain with no id, and the recovery lookup finds what landed", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: UNANSWERED_EMAIL }

    // The mock writes the submission and then drops the item from the response.
    await applyMockSuotarScenario(page.request, "import-unanswered", {
      studentNumber: UNANSWERED_STUDENT_NUMBER,
      courseCode: CRS_101,
      owner: { user: UNANSWERED_EMAIL, course: SUOTAR_COURSE_SLUG },
    })

    await runMaterializeTick(page.request, scope)
    // See the timeout spec above: a worker may have parked the row before the enrolment existed.
    const materialized = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)
    await makeRegistrationDueNow(adminApi, materialized.id)
    await runPreconditionsTick(page.request, scope)
    await runResolveEnrolmentsTick(page.request, scope)
    await runTickUnchecked(page.request, "import", scope)

    const uncertain = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "submission_uncertain",
    ])
    const details = await adminRegistrationDetails(adminApi, uncertain.id)
    expect(details.registration.submitted_attainment_id).toBeNull()

    await test.step("The attainment Sisu got is found through resolve-enrolments", async () => {
      const resolveCallsBefore = await countMockCallsForStudent(
        page.request,
        UNANSWERED_STUDENT_NUMBER,
        "resolve_enrolments",
      )
      await transitionMockSuotarSubmissionsFor(
        page.request,
        UNANSWERED_STUDENT_NUMBER,
        "registered",
        CRS_101,
      )
      await makeRegistrationDueNow(adminApi, uncertain.id)
      await runVerifyPollTick(page.request, scope)
      const found = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
        "duplicate",
      ])
      expect(found.sisu_attainment_id).not.toBeNull()
      expect(
        await countMockCallsForStudent(
          page.request,
          UNANSWERED_STUDENT_NUMBER,
          "resolve_enrolments",
        ),
      ).toBeGreaterThan(resolveCallsBefore)
      expect(
        await countMockCallsForStudent(
          page.request,
          UNANSWERED_STUDENT_NUMBER,
          "import_attainments",
        ),
      ).toBe(1)
      expect(
        await countMockCallsForStudent(
          page.request,
          UNANSWERED_STUDENT_NUMBER,
          "verify_attainments",
        ),
      ).toBe(0)
    })
  })
})

test.describe("A student whose modules are each broken in their own way", () => {
  test.use({ storageState: seededStudentStorageState(OUTCOMES_EMAIL) })

  test("Each broken module shape lands the row on its own error code", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: OUTCOMES_EMAIL }

    // Stamps Suotar's verdict on every module's course code, which is what holds a refused one back.
    await runConfigValidationTick(page.request, { courseSlug: IMPORT_OUTCOMES_COURSE_SLUG })
    await runPhasesUpToSubmission(page.request, scope)

    const failed = await pollUntil(
      async () => {
        const rows = (await myCreditRegistrations(page.request)).filter(
          (row) => row.course_slug === IMPORT_OUTCOMES_COURSE_SLUG && row.error_code !== null,
        )
        return rows.length === 3 ? rows : null
      },
      { description: "three import-outcome modules to carry an error code" },
    )

    expect(failed.map((row) => row.error_code).toSorted()).toStrictEqual([
      "invalid_credits",
      "no_grade_scale_mapping",
      "sisu_validation_failed",
    ])

    await test.step("A course code Suotar refuses waits rather than failing", async () => {
      const waiting = (await myCreditRegistrations(page.request)).filter(
        (row) => row.course_slug === IMPORT_OUTCOMES_COURSE_SLUG && row.error_code === null,
      )
      const [parked] = waiting
      expect(waiting).toHaveLength(1)
      expect(parked).toBeDefined()
      const { registration } = await adminRegistrationDetails(adminApi, parked!.id)
      expect(registration.state).toBe("pending")
      expect(registration.pending_reason).toBe("course_code")
    })

    // The student's own payload carries a code, never the study registry's wording, so there is
    // nothing for the frontend to leak even if it tried.
    const raw = JSON.stringify(await myCreditRegistrations(page.request))
    expect(raw).not.toContain("error_message")
  })
})

test.describe("A batch Suotar refuses as malformed because of one row", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  // The fault lives in the shared mock, so a failure before the end would leave it armed.
  test.afterEach(async ({ page }) => {
    await disarmMockSuotarFault(page.request, MALFORMED_FAULT_ID)
  })

  test("The batch is split until the bad row is alone, and only that row fails", async ({
    page,
    adminApi,
  }) => {
    const students = [
      { email: MALFORMED_EMAIL, studentNumber: MALFORMED_STUDENT_NUMBER },
      { email: BESIDE_MALFORMED_EMAIL, studentNumber: BESIDE_MALFORMED_STUDENT_NUMBER },
    ]
    // Suotar validates every item before acting on any, so one bad item refuses the whole batch.
    await armMockSuotarFault(page.request, {
      id: MALFORMED_FAULT_ID,
      when: [
        { endpoint: "import_attainments" },
        { stage: "resolve" },
        { studentNumber: MALFORMED_STUDENT_NUMBER },
      ],
      // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
      then: { kind: "requestLevel", status: 400, code: "malformedRequest" },
    })

    const rowIds: string[] = []
    for (const student of students) {
      const scope = { userEmail: student.email }
      await applyMockSuotarScenario(page.request, "happy-path", {
        studentNumber: student.studentNumber,
        courseCode: CRS_101,
        owner: { user: student.email, course: SUOTAR_COURSE_SLUG },
      })
      // See the outage spec: the hold keeps the background worker from batching these rows itself.
      await setTestExclusiveHold(page.request, student.email, 60)
      await runMaterializeTick(page.request, scope)
      const row = (
        await listAdminRegistrations(adminApi, { student_number: student.studentNumber })
      ).data[0]
      expect(row).toBeDefined()
      await makeRegistrationDueNow(adminApi, row!.id)
      await runPreconditionsTick(page.request, scope)
      await runResolveEnrolmentsTick(page.request, scope)
      rowIds.push(row!.id)
    }

    await runTickUnchecked(page.request, "import", { creditRegistrationIds: rowIds })

    const stateOf = async (studentNumber: string) =>
      (await listAdminRegistrations(adminApi, { student_number: studentNumber })).data[0]
    const malformed = await pollUntil(
      async () => {
        const row = await stateOf(MALFORMED_STUDENT_NUMBER)
        return row?.state === "failed_permanent" ? row : null
      },
      { description: "the malformed row to fail on its own" },
    )
    expect(malformed.error_code).toBe("malformed_request")
    expect(malformed.needs_admin_attention).toBe(true)
    expect((await stateOf(BESIDE_MALFORMED_STUDENT_NUMBER))?.state).toBe("awaiting_verification")
    // The shared batch, then each half on its own.
    expect(
      await countMockCallsForStudent(page.request, MALFORMED_STUDENT_NUMBER, "import_attainments"),
    ).toBe(2)
    expect(
      await countMockCallsForStudent(
        page.request,
        BESIDE_MALFORMED_STUDENT_NUMBER,
        "import_attainments",
      ),
    ).toBe(2)
  })
})
