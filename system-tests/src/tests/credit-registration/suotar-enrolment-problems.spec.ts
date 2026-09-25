import {
  completionRegistrationUrl,
  countMockCallsForStudent,
  CREDIT_REGISTRATION_STUDENT_1,
  CREDIT_REGISTRATION_STUDENT_5,
  CRS_101,
  CRS_B_101,
  CRS_B_101_ENROLMENT_LINK,
  seededStudentStorageState,
  STUDENT_7,
  SUOTAR_B_COURSE_ID,
  SUOTAR_B_COURSE_SLUG,
  SUOTAR_COURSE_ID,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { adminRegistrationDetails, listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import { getMockSuotarWorld, upsertMockSuotarEnrolments } from "@/utils/mockSuotar"
import { ADMIN_STORAGE_STATE, expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  expireEnrolmentRecheckAllowance,
  runEnrolmentCheckNow,
  runImportSubmissionTick,
  runMaterializeTick,
  runPhasesUpToSubmission,
  runResolveEnrolmentsTick,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns `student7` and `credit-registration-student-5` on `via-suotar-b` and
 * `credit-registration-student-1` on `via-suotar`.
 */
const NO_ENROLMENT_EMAIL = STUDENT_7.email
const NO_ENROLMENT_STUDENT_NUMBER = STUDENT_7.studentNumber
const EXPIRED_DEGREE_ENROLMENT_ID = `hy-enr-${NO_ENROLMENT_STUDENT_NUMBER}-${CRS_B_101}-expired-degree`
const OPEN_UNIVERSITY_ENROLMENT_ID = `hy-enr-${NO_ENROLMENT_STUDENT_NUMBER}-${CRS_B_101}-open-university`
const TWO_ENROLMENTS_EMAIL = CREDIT_REGISTRATION_STUDENT_1.email
const TWO_ENROLMENTS_STUDENT_NUMBER = CREDIT_REGISTRATION_STUDENT_1.studentNumber
/** The mock's seeded world gives this student a passed attainment on the course and no enrolment. */
const PRIOR_CREDIT_EMAIL = CREDIT_REGISTRATION_STUDENT_5.email
const PRIOR_CREDIT_STUDENT_NUMBER = CREDIT_REGISTRATION_STUDENT_5.studentNumber

const YEAR = 365 * 24 * 60 * 60 * 1000
const isoDate = (offsetMs: number) =>
  new Date(Date.now() + offsetMs).toISOString().slice(0, "2026-01-01".length)

test.describe("A student the University has no enrolment for", () => {
  test.use({ storageState: seededStudentStorageState(NO_ENROLMENT_EMAIL) })

  test("A student the University has not enrolled is told to enrol, and recovers once they do", async ({
    adminApi,
    page,
  }) => {
    const scope = { userEmail: NO_ENROLMENT_EMAIL, courseSlug: SUOTAR_B_COURSE_SLUG }

    await runMaterializeTick(page.request, scope)
    await runEnrolmentCheckNow(page.request, scope)

    const stuck = await waitForRegistrationState(page.request, adminApi, SUOTAR_B_COURSE_SLUG, [
      "no_usable_enrolment",
    ])
    expect(stuck.student_facing_status).toBe("needs_enrolment")
    // The check just made would otherwise hold off saying they have enrolled for half an hour.
    await expireEnrolmentRecheckAllowance(page.request, stuck.id)

    await test.step("The guidance is a working link, not an instruction to go looking", async () => {
      expect(stuck.enrolment_link).not.toBeNull()
      await page.goto(completionRegistrationUrl(stuck.course_module_id))
      await page.getByRole("radio", { name: "No", exact: true }).click()
      const enrol = page.getByRole("link", { name: "Enrol at the Open University" })
      await expect(enrol).toBeVisible()
      // The module's completion registration link override, so it lands the student somewhere
      // that works rather than on a generic front page.
      await expect(enrol).toHaveAttribute("href", CRS_B_101_ENROLMENT_LINK)
      expect(stuck.enrolment_link).toBe(CRS_B_101_ENROLMENT_LINK)
    })

    await test.step("Saying they have enrolled turns the page into a wait", async () => {
      await page.getByRole("button", { name: "I have enrolled" }).click()
      await expect(
        page.getByRole("heading", {
          name: "We are looking for your enrolment",
        }),
      ).toBeVisible()
      await expect(page.getByText("You told us you enrolled at the Open University")).toBeVisible()
      // The one lever left: sending them off to enrol again would contradict what they just said.
      await expect(page.getByRole("link", { name: "Enrol at the Open University" })).toBeHidden()
    })

    await test.step("It heals itself once the enrolment appears", async () => {
      await upsertMockSuotarEnrolments(page.request, [
        {
          id: EXPIRED_DEGREE_ENROLMENT_ID,
          studentNumber: NO_ENROLMENT_STUDENT_NUMBER,
          courseCode: CRS_B_101,
          kind: "degree",
          state: "ENROLLED",
          studyRightValidityPeriod: { startDate: isoDate(-3 * YEAR), endDate: isoDate(-YEAR) },
        },
        {
          id: OPEN_UNIVERSITY_ENROLMENT_ID,
          studentNumber: NO_ENROLMENT_STUDENT_NUMBER,
          courseCode: CRS_B_101,
          kind: "openUniversity",
          state: "ENROLLED",
          studyRightValidityPeriod: { startDate: isoDate(-YEAR), endDate: isoDate(YEAR) },
          // Suotar passes importer fields through, so one may be missing; the enrolment still counts.
          enrolmentDateTime: null,
        },
      ])
      // Answering the question already re-opens the look, so the row is due without the manual
      // lever, which only ever renders on a row still parked on a missing enrolment.
      await runResolveEnrolmentsTick(page.request, scope)
      await runImportSubmissionTick(page.request, scope)
      await waitForRegistrationState(page.request, adminApi, SUOTAR_B_COURSE_SLUG, [
        "ready_to_submit",
        "submitting",
        "awaiting_verification",
      ])
    })

    await test.step("The enrolment whose study right covers the completion wins over the degree one", async () => {
      await runResolveEnrolmentsTick(page.request, scope)
      const selected = await pollUntil(
        async () =>
          (
            await listAdminRegistrations(adminApi, {
              student_number: NO_ENROLMENT_STUDENT_NUMBER,
              course_id: SUOTAR_B_COURSE_ID,
            })
          ).data[0]?.selected_enrolment_id ?? null,
        { description: "an enrolment to be chosen" },
      )
      expect(selected).toBe(OPEN_UNIVERSITY_ENROLMENT_ID)
    })
  })
})

test.describe("A student enrolled both as a degree student and through the Open University", () => {
  test.use({ storageState: seededStudentStorageState(TWO_ENROLMENTS_EMAIL) })

  test("Enrolment selection prefers the degree enrolment over the open university one", async ({
    adminApi,
    page,
  }) => {
    const scope = { userEmail: TWO_ENROLMENTS_EMAIL, courseSlug: SUOTAR_COURSE_SLUG }

    await runPhasesUpToSubmission(page.request, scope)
    await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "awaiting_verification",
      "registered",
      "duplicate",
    ])

    // Both enrolments would have submitted successfully, so only the chosen id says the policy ran.
    // It is read back from the mock's world because the mock derives enrolment ids from an opaque
    // UUIDv5 rather than from the student number.
    const world = (await getMockSuotarWorld(page.request)) as {
      enrolments: Record<
        string,
        { id: string; studentNumber: string; courseCode: string; studyRightId: string | null }
      >
    }
    // Suotar derives an enrolment's kind from its study right, as the mock does: an open university
    // study right is the one whose id names it.
    const degreeEnrolment = Object.values(world.enrolments).find(
      (enrolment) =>
        enrolment.studentNumber === TWO_ENROLMENTS_STUDENT_NUMBER &&
        enrolment.courseCode === CRS_101 &&
        enrolment.studyRightId !== null &&
        !enrolment.studyRightId.includes("avoin"),
    )
    expect(degreeEnrolment, "the degree enrolment is missing from the mock's world").toBeDefined()

    const listed = await listAdminRegistrations(adminApi, {
      student_number: TWO_ENROLMENTS_STUDENT_NUMBER,
      course_id: SUOTAR_COURSE_ID,
    })
    expect(listed.data).toHaveLength(1)
    expect(listed.data[0]?.selected_enrolment_id).toBe(degreeEnrolment?.id)
  })
})

test.describe("A student the study registry already credited, with no enrolment", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test("The credit Sisu already holds settles the row, with nothing imported", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: PRIOR_CREDIT_EMAIL, courseSlug: SUOTAR_B_COURSE_SLUG }

    await runMaterializeTick(page.request, scope)
    await runEnrolmentCheckNow(page.request, scope)

    const settled = await pollUntil(
      async () => {
        const [row] = (
          await listAdminRegistrations(adminApi, {
            student_number: PRIOR_CREDIT_STUDENT_NUMBER,
            course_id: SUOTAR_B_COURSE_ID,
          })
        ).data
        return row?.state === "duplicate" ? row : null
      },
      { description: "the already credited row to settle as a duplicate" },
    )
    expect(settled.error_code).toBeNull()

    const { registration } = await adminRegistrationDetails(adminApi, settled.id)
    expect(registration.sisu_attainment_id).not.toBeNull()
    // Nothing was sent, so no Sisu person may stay frozen on the row.
    expect(registration.sisu_person_id).toBeNull()

    expect(
      await countMockCallsForStudent(
        page.request,
        PRIOR_CREDIT_STUDENT_NUMBER,
        CRS_B_101,
        "import_attainments",
      ),
    ).toBe(0)
  })
})
