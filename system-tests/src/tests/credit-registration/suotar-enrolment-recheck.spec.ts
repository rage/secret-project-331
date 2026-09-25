import type { APIRequestContext, Locator, Page } from "@playwright/test"

import {
  COURSE_CREDIT_REGISTRATIONS_API,
  CREDIT_REGISTRATION_STUDENT_6,
  CRS_B_101,
  getJson,
  ORIGIN,
  SUOTAR_B_COURSE_ID,
  SUOTAR_B_COURSE_SLUG,
} from "@/utils/creditRegistration"
import {
  accountLinkingStats,
  adminRegistrationDetails,
  adminResolveStudentNumber,
  listAdminRegistrations,
} from "@/utils/creditRegistrationAdmin"
import {
  activeStudyRightPeriod,
  upsertMockSuotarEnrolments,
  upsertMockSuotarPersons,
} from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  expireEnrolmentRecheckAllowance,
  makeRosterListingsDue,
  runEnrolmentCheckNow,
  runEnrolmentDiscoveryTick,
  runMaterializeTick,
  runResolveEnrolmentsTick,
  setTestExclusiveHold,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns `credit-registration-student-6` on `via-suotar-b`, and the unlinked roster person
 * `900000971` on its course code.
 *
 * Serial and order-dependent: the teacher's recheck leaves the row parked again, which the discovery
 * test then wakes. `retries: 0` because the row does not come back from being registered.
 */
test.describe.configure({ mode: "serial", retries: 0 })

test.use({ storageState: "src/states/teacher@example.com.json" })

const STUDENT = CREDIT_REGISTRATION_STUDENT_6
const COMPLETIONS_URL = `${ORIGIN}/manage/courses/${SUOTAR_B_COURSE_ID}/students/completions`
/** The control surface's ceiling; renewed before each step that needs the live worker kept off. */
const HOLD_SECS = 120
const UNLINKED_STUDENT_NUMBER = "900000971"
const NOT_YET_SENT_STATES = ["pending", "ready_to_submit", "no_usable_enrolment"]

interface TeacherRegistration {
  id: string
  state: string
  can_request_enrolment_recheck: boolean
}

interface TeacherRegistrationDetails {
  registration: TeacherRegistration
  events: { kind: string; message: string | null; actor_user_id: string | null }[]
}

const teacherDetails = (request: APIRequestContext, id: string) =>
  getJson<TeacherRegistrationDetails>(
    request,
    `${COURSE_CREDIT_REGISTRATIONS_API}/registrations/${id}`,
  )

const rowInState = (adminApi: APIRequestContext, states: string[]) =>
  pollUntil(
    async () => {
      const [row] = (
        await listAdminRegistrations(adminApi, {
          student_number: STUDENT.studentNumber,
          course_id: SUOTAR_B_COURSE_ID,
        })
      ).data
      return row && states.includes(row.state) ? row : null
    },
    { description: `the registration to reach one of ${states.join(", ")}` },
  )

/** Parks the seeded completion on a check made just now, whatever its schedule. */
const parkOnMissingEnrolment = async (page: Page, adminApi: APIRequestContext) => {
  await setTestExclusiveHold(page.request, STUDENT.email, HOLD_SECS, SUOTAR_B_COURSE_ID)
  await runMaterializeTick(page.request, {
    userEmail: STUDENT.email,
    courseSlug: SUOTAR_B_COURSE_SLUG,
  })
  const materialized = await rowInState(adminApi, NOT_YET_SENT_STATES)
  await runEnrolmentCheckNow(page.request, { creditRegistrationIds: [materialized.id] })
  return await rowInState(adminApi, ["no_usable_enrolment"])
}

const recheckButton = (dialog: Locator) =>
  dialog.getByRole("button", { name: "Check enrolment again" })

const openDetails = async (page: Page) => {
  await page.goto(COMPLETIONS_URL)
  const dialog = page.getByRole("dialog")
  // A click that lands before hydration opens nothing.
  await expect(async () => {
    await page
      .getByRole("row")
      .filter({ hasText: STUDENT.lastName })
      .getByRole("button", { name: /Show credit registration details/ })
      .click()
    await expect(dialog).toBeVisible({ timeout: 2000 })
  }).toPass()
  return dialog
}

test("A teacher asks for the enrolment to be checked again, within the student's allowance", async ({
  page,
  adminApi,
}) => {
  const parked = await parkOnMissingEnrolment(page, adminApi)

  await test.step("Just after the pipeline checked, the action is hidden for half an hour", async () => {
    const dialog = await openDetails(page)
    await expect(recheckButton(dialog)).toBeHidden()
    const row = (await teacherDetails(page.request, parked.id)).registration
    expect(row.can_request_enrolment_recheck).toBe(false)
  })

  await test.step("Once the half hour is up it starts a recheck and says who asked", async () => {
    await expireEnrolmentRecheckAllowance(page.request, parked.id)
    const dialog = await openDetails(page)
    await recheckButton(dialog).click()
    await expect(
      dialog.getByText("We will check the student's enrolment again within a few minutes."),
    ).toBeVisible()

    const details = await teacherDetails(page.request, parked.id)
    expect(details.registration.state).toBe("no_usable_enrolment")
    expect(details.events).toContainEqual(
      expect.objectContaining({
        kind: "admin_action",
        message: "A teacher of the course asked us to check for an enrolment again.",
      }),
    )
  })

  await test.step("The check it started counts against the allowance again", async () => {
    await setTestExclusiveHold(page.request, STUDENT.email, HOLD_SECS, SUOTAR_B_COURSE_ID)
    await runResolveEnrolmentsTick(page.request, { creditRegistrationIds: [parked.id] })
    await rowInState(adminApi, ["no_usable_enrolment"])

    const refused = await page.request.post(
      `${COURSE_CREDIT_REGISTRATIONS_API}/registrations/${parked.id}/recheck-enrolment`,
    )
    await expect(refused).toBeOK()
    expect(await refused.json()).toMatchObject({ recheck_started: false })
    expect((await teacherDetails(page.request, parked.id)).registration.state).toBe(
      "no_usable_enrolment",
    )
  })
})

test("With account linking off, discovery wakes a linked student and mails nobody", async ({
  page,
  adminApi,
}) => {
  const parked = await parkOnMissingEnrolment(page, adminApi)
  const parkedUntil = (await adminRegistrationDetails(adminApi, parked.id)).registration
    .next_attempt_at
  expect(new Date(parkedUntil).getTime()).toBeGreaterThan(Date.now())

  await upsertMockSuotarPersons(page.request, [
    {
      studentNumber: UNLINKED_STUDENT_NUMBER,
      firstNames: "Zzyzx",
      lastName: "Rosteronly",
      primaryEmail: "zzyzx.rosteronly@helsinki.example.com",
    },
  ])
  await upsertMockSuotarEnrolments(page.request, [
    {
      studentNumber: UNLINKED_STUDENT_NUMBER,
      courseCode: CRS_B_101,
      kind: "degree",
      state: "ENROLLED",
      studyRightValidityPeriod: activeStudyRightPeriod(),
    },
    {
      studentNumber: STUDENT.studentNumber,
      courseCode: CRS_B_101,
      kind: "degree",
      state: "ENROLLED",
      studyRightValidityPeriod: activeStudyRightPeriod(),
    },
  ])

  // Compared around the tick alone: the live worker runs with linking on, so it may mail the
  // roster person on its own schedule.
  const mailsBefore = (await adminResolveStudentNumber(adminApi, UNLINKED_STUDENT_NUMBER))
    .linking_emails
  const listedBefore = (await accountLinkingStats(adminApi)).modules.find(
    (row) => row.course_id === SUOTAR_B_COURSE_ID,
  )?.last_listed_at
  await setTestExclusiveHold(page.request, STUDENT.email, HOLD_SECS, SUOTAR_B_COURSE_ID)
  await makeRosterListingsDue(page.request, { courseSlug: SUOTAR_B_COURSE_SLUG })
  await runEnrolmentDiscoveryTick(
    page.request,
    { courseSlug: SUOTAR_B_COURSE_SLUG },
    { accountLinkingEnabled: false },
  )
  const mailsAfter = (await adminResolveStudentNumber(adminApi, UNLINKED_STUDENT_NUMBER))
    .linking_emails

  await test.step("Nobody on the roster was mailed, and no linking run was recorded", async () => {
    expect(mailsAfter.map((mail) => mail.id)).toStrictEqual(mailsBefore.map((mail) => mail.id))
    const listedAfter = (await accountLinkingStats(adminApi)).modules.find(
      (row) => row.course_id === SUOTAR_B_COURSE_ID,
    )?.last_listed_at
    expect(listedAfter).toBe(listedBefore)
  })

  await test.step("The linked student's registration moves on with the enrolment", async () => {
    const woken = (await adminRegistrationDetails(adminApi, parked.id)).registration
    expect(new Date(woken.next_attempt_at).getTime()).toBeLessThanOrEqual(Date.now())

    await runResolveEnrolmentsTick(page.request, { creditRegistrationIds: [parked.id] })
    await rowInState(adminApi, ["checking_enrolment", "submitting", "awaiting_verification"])
  })
})
