import crypto from "crypto"

import type { APIRequestContext, Page } from "@playwright/test"

import {
  addManualCompletion,
  countMockCallsForStudent,
  CREDIT_REGISTRATION_ORGANIZATION_SLUG,
  CREDIT_REGISTRATION_STUDENT_3,
  CREDIT_REGISTRATION_STUDENT_3_USER_ID,
  CREDIT_REGISTRATIONS_API,
  getJson,
  MAIN_FRONTEND_API,
  type MockSuotarRecordedCall,
  recordEnrolmentPageVisit,
  seededStudentStorageState,
} from "@/utils/creditRegistration"
import {
  CREDIT_REGISTRATION_ADMIN_API,
  listAdminRegistrations,
} from "@/utils/creditRegistrationAdmin"
import {
  activeStudyRightPeriod,
  armMockSuotarFault,
  disarmMockSuotarFault,
  listMockSuotarCalls,
  upsertMockSuotarCourseUnits,
  upsertMockSuotarEnrolments,
} from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  CONTROL_BASE_URL,
  expireEnrolmentRecheckAllowance,
  getEnrolmentCheckSchedule,
  makeEnrolmentChecksDue,
  makeRosterListingsDue,
  runEnrolmentDiscoveryTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runTickUnchecked,
  setTestExclusiveHold,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns `credit-registration-student-3` on courses these tests create, one per test, with course
 * codes nothing else lists: pacing is only visible on a row nothing has checked yet, and the roster
 * tests list every code of their course.
 *
 * The live worker still sweeps these rows unscoped. The hold keeps it from checking them, but it may
 * park a row, or wake one off a roster listing, before this file's own tick does.
 */
test.use({ storageState: seededStudentStorageState(CREDIT_REGISTRATION_STUDENT_3.email) })

const STUDENT = CREDIT_REGISTRATION_STUDENT_3
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const BATCH_INTERVAL_MS = 5 * 60 * 1000
const TRANSIENT_RETRY_MS = 5 * 60 * 1000
/** Between this runner's clock and the server's. */
const CLOCK_SLACK_MS = 60 * 1000
/** The control surface's ceiling, and more than any one test here takes. */
const HOLD_SECS = 120
const UNAVAILABLE_WIRE_CODE = "serviceTemporarilyUnavailable"

const CHECK_ANSWER_FAULT_ID = "enrolment-check-pacing-not-found"
const ROSTER_FAULT_ID = "enrolment-check-pacing-roster"
const LOOKUP_OUTAGE_FAULT_ID = "enrolment-check-pacing-lookup-outage"

interface PacingCourse {
  courseId: string
  courseSlug: string
  /** In module order; the first is the default module a manual completion lands on. */
  modules: { id: string; courseCode: string }[]
}

interface CourseStructure {
  modules: { id: string; order_number: number }[]
}

const postJson = async <T>(request: APIRequestContext, url: string, data: unknown): Promise<T> => {
  const response = await request.post(url, { data })
  if (!response.ok()) {
    throw new Error(`POST ${url} answered ${response.status()}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

/** What puts a module on the Suotar path under its own course code. */
const suotarModuleSettings = (courseCode: string) => ({
  uh_course_code: courseCode,
  ects_credits: 5,
  completion_policy: { policy: "manual" },
  completion_registration_link_override: `https://www.avoin.helsinki.fi/palvelut/esittely.aspx?s=${courseCode}`,
  enable_registering_completion_to_uh_open_university: false,
  enable_credit_registration_via_suotar: true,
})

/** A Suotar course with `moduleCount` modules, each on a course code of its own. */
const createPacingCourse = async (
  adminApi: APIRequestContext,
  request: APIRequestContext,
  moduleCount: number,
): Promise<PacingCourse> => {
  const suffix = crypto.randomUUID().slice(0, 8)
  const courseSlug = `credit-registration-pacing-${suffix}`
  const courseCodes = Array.from({ length: moduleCount }, (_, index) =>
    `CRS-PACE-${suffix}-${index + 1}`.toUpperCase(),
  )
  const organizations = await getJson<{ id: string; slug: string }[]>(
    adminApi,
    `${MAIN_FRONTEND_API}/organizations`,
  )
  const organization = organizations.find(
    (candidate) => candidate.slug === CREDIT_REGISTRATION_ORGANIZATION_SLUG,
  )
  if (organization === undefined) {
    throw new Error(`No organization ${CREDIT_REGISTRATION_ORGANIZATION_SLUG}`)
  }
  const course = await postJson<{ id: string }>(adminApi, `${MAIN_FRONTEND_API}/courses`, {
    name: `Credit registration pacing ${suffix}`,
    slug: courseSlug,
    organization_id: organization.id,
    language_code: "en-US",
    teacher_in_charge_name: "admin",
    teacher_in_charge_email: "admin@example.com",
    description: "",
    is_draft: false,
    is_test_mode: false,
    is_unlisted: true,
    copy_user_permissions: false,
    is_joinable_by_code_only: false,
    join_code: null,
    ask_marketing_consent: false,
    flagged_answers_threshold: null,
    can_add_chatbot: false,
  })
  const structureUrl = `${MAIN_FRONTEND_API}/courses/${course.id}/structure`
  const defaultModule = (await getJson<CourseStructure>(adminApi, structureUrl)).modules.find(
    (courseModule) => courseModule.order_number === 0,
  )
  if (defaultModule === undefined) {
    throw new Error(`Course ${course.id} has no default module`)
  }
  const [defaultCode, ...otherCodes] = courseCodes
  await postJson(adminApi, `${MAIN_FRONTEND_API}/courses/${course.id}/course-modules`, {
    new_modules: otherCodes.map((courseCode, index) => ({
      name: `Module ${courseCode}`,
      order_number: index + 1,
      chapters: [],
      ...suotarModuleSettings(courseCode),
    })),
    deleted_modules: [],
    modified_modules: [
      { id: defaultModule.id, name: null, order_number: 0, ...suotarModuleSettings(defaultCode!) },
    ],
    moved_chapters: [],
  })
  const modules = (await getJson<CourseStructure>(adminApi, structureUrl)).modules
    .toSorted((left, right) => left.order_number - right.order_number)
    .map((courseModule, index) => ({ id: courseModule.id, courseCode: courseCodes[index]! }))
  for (const courseModule of modules) {
    const response = await request.post(`${CONTROL_BASE_URL}/register-new-completions-via-suotar`, {
      data: { courseModuleId: courseModule.id },
    })
    if (!response.ok()) {
      throw new Error(
        `Opting ${courseModule.id} into Suotar answered ${response.status()}: ${await response.text()}`,
      )
    }
  }
  await upsertMockSuotarCourseUnits(
    request,
    courseCodes.map((courseCode) => ({
      courseCode,
      name: { fi: courseCode, sv: courseCode, en: courseCode },
      credits: { min: 5, max: 5 },
      gradeScaleId: "sis-hyl-hyv",
      realisations: [{ kind: "degree", activityPeriod: activeStudyRightPeriod() }],
      suotarCourse: { name: courseCode },
      ownerCourseSlug: courseSlug,
    })),
  )
  return { courseId: course.id, courseSlug, modules }
}

/**
 * Completes the course's default module for the student and runs the row as far as waiting for its
 * first enrolment check.
 */
const parkCompletedModule = async (
  page: Page,
  adminApi: APIRequestContext,
  course: PacingCourse,
) => {
  await setTestExclusiveHold(page.request, STUDENT.email, HOLD_SECS, course.courseId)
  const completedAt = Date.now()
  await addManualCompletion(adminApi, {
    courseId: course.courseId,
    userId: CREDIT_REGISTRATION_STUDENT_3_USER_ID,
    grade: 5,
  })
  await runMaterializeTick(page.request, { courseId: course.courseId })
  const id = await pollUntil(
    async () =>
      (await listAdminRegistrations(adminApi, { course_id: course.courseId })).data[0]?.id ?? null,
    { description: "the completion's ledger row" },
  )
  const rowScope = { creditRegistrationIds: [id] }
  await runPreconditionsTick(page.request, rowScope)
  return { id, rowScope, completedAt }
}

const msBetween = (from: string | null, to: string | null): number =>
  Date.parse(to ?? "") - Date.parse(from ?? "")

const requestRecheck = (request: APIRequestContext, registrationId: string) =>
  postJson<{ recheck_started: boolean }>(
    request,
    `${CREDIT_REGISTRATIONS_API}/my/${registrationId}/recheck-enrolment`,
    {},
  )

/** The newest listing call the mock recorded for the code. */
const latestListingOf = async (
  request: APIRequestContext,
  courseCode: string,
): Promise<MockSuotarRecordedCall> => {
  const { calls } = await listMockSuotarCalls(request, {
    endpoint: "list_by_course",
    courseCode,
    limit: 2000,
  })
  const [latest] = (calls as MockSuotarRecordedCall[]).toSorted(
    (left, right) => right.seq - left.seq,
  )
  if (latest === undefined) {
    throw new Error(`The mock recorded no listing of ${courseCode}`)
  }
  return latest
}

let rosterCourseId: string | null = null

test.afterEach(async ({ page }) => {
  for (const id of [CHECK_ANSWER_FAULT_ID, ROSTER_FAULT_ID, LOOKUP_OUTAGE_FAULT_ID]) {
    await disarmMockSuotarFault(page.request, id)
  }
  // A code that failed stays failing, and alerting every admin view, until it lists cleanly once.
  if (rosterCourseId !== null) {
    await makeRosterListingsDue(page.request, { courseId: rosterCourseId })
    await runTickUnchecked(page.request, "enrolment-discovery", { courseId: rosterCourseId })
    rosterCourseId = null
  }
})

test("A completed module waits a day for its first enrolment check, without asking Suotar", async ({
  page,
  adminApi,
}) => {
  const course = await createPacingCourse(adminApi, page.request, 1)
  const parked = await parkCompletedModule(page, adminApi, course)

  const schedule = await getEnrolmentCheckSchedule(page.request, parked.id)
  expect(schedule).toMatchObject({
    state: "no_usable_enrolment",
    group: "completed",
    step: 0,
    checkedAt: null,
    isBatched: true,
  })
  expect(Math.abs(Date.parse(schedule.anchorAt ?? "") - parked.completedAt)).toBeLessThan(
    CLOCK_SLACK_MS,
  )
  expect(msBetween(schedule.anchorAt, schedule.dueAt)).toBe(DAY_MS)
  const releasedAfterDueMs = msBetween(schedule.dueAt, schedule.nextAttemptAt)
  expect(releasedAfterDueMs).toBeGreaterThanOrEqual(0)
  expect(releasedAfterDueMs).toBeLessThan(BATCH_INTERVAL_MS)
  expect(
    await countMockCallsForStudent(
      page.request,
      STUDENT.studentNumber,
      course.modules[0]!.courseCode,
      "resolve_enrolments",
    ),
  ).toBe(0)
})

test("Opening the registration page moves the check to an hour after the visit", async ({
  page,
  adminApi,
}) => {
  const course = await createPacingCourse(adminApi, page.request, 1)
  const parked = await parkCompletedModule(page, adminApi, course)

  const visitedAt = Date.now()
  await recordEnrolmentPageVisit(page.request, course.modules[0]!.id)

  const schedule = await getEnrolmentCheckSchedule(page.request, parked.id)
  expect(schedule).toMatchObject({
    state: "no_usable_enrolment",
    group: "visited",
    step: 0,
    isBatched: false,
  })
  expect(Math.abs(Date.parse(schedule.anchorAt ?? "") - visitedAt)).toBeLessThan(CLOCK_SLACK_MS)
  expect(msBetween(schedule.anchorAt, schedule.dueAt)).toBe(HOUR_MS)
  expect(schedule.nextAttemptAt).toBe(schedule.dueAt)
})

test("Asking for a check runs one at once, and the next an hour later", async ({
  page,
  adminApi,
}) => {
  const course = await createPacingCourse(adminApi, page.request, 1)
  const parked = await parkCompletedModule(page, adminApi, course)

  expect(await requestRecheck(page.request, parked.id)).toStrictEqual({ recheck_started: true })
  expect(await getEnrolmentCheckSchedule(page.request, parked.id)).toMatchObject({
    state: "ready_to_submit",
    group: "check_requested",
    step: 0,
    source: "student_request",
    restartCount: 1,
  })

  await runResolveEnrolmentsTick(page.request, parked.rowScope)
  const answered = await getEnrolmentCheckSchedule(page.request, parked.id)
  expect(answered).toMatchObject({
    state: "no_usable_enrolment",
    group: "check_requested",
    step: 1,
  })
  expect(answered.checkedAt).not.toBeNull()
  expect(msBetween(answered.anchorAt, answered.dueAt)).toBe(HOUR_MS)
  expect(
    await countMockCallsForStudent(
      page.request,
      STUDENT.studentNumber,
      course.modules[0]!.courseCode,
      "resolve_enrolments",
    ),
  ).toBe(1)
})

test("Check requests wait out half an hour, and restart the schedule four times a day", async ({
  page,
  adminApi,
}) => {
  const course = await createPacingCourse(adminApi, page.request, 1)
  const parked = await parkCompletedModule(page, adminApi, course)

  expect(await requestRecheck(page.request, parked.id)).toStrictEqual({ recheck_started: true })
  await runResolveEnrolmentsTick(page.request, parked.rowScope)
  let previous = await getEnrolmentCheckSchedule(page.request, parked.id)

  await test.step("A second request within half an hour changes nothing", async () => {
    expect(await requestRecheck(page.request, parked.id)).toStrictEqual({
      recheck_started: false,
    })
    expect(await getEnrolmentCheckSchedule(page.request, parked.id)).toStrictEqual(previous)
  })

  await test.step("Each request after the wait restarts the schedule", async () => {
    for (const restartCount of [2, 3, 4]) {
      await expireEnrolmentRecheckAllowance(page.request, parked.id)
      expect(await requestRecheck(page.request, parked.id)).toStrictEqual({
        recheck_started: true,
      })
      const restarted = await getEnrolmentCheckSchedule(page.request, parked.id)
      expect(restarted).toMatchObject({ state: "ready_to_submit", step: 0, restartCount })
      expect(Date.parse(restarted.anchorAt ?? "")).toBeGreaterThan(
        Date.parse(previous.anchorAt ?? ""),
      )
      await runResolveEnrolmentsTick(page.request, parked.rowScope)
      previous = await getEnrolmentCheckSchedule(page.request, parked.id)
    }
  })

  await test.step("Past four restarts a request still checks, on the same schedule", async () => {
    await expireEnrolmentRecheckAllowance(page.request, parked.id)
    expect(await requestRecheck(page.request, parked.id)).toStrictEqual({ recheck_started: true })
    const checking = await getEnrolmentCheckSchedule(page.request, parked.id)
    expect(checking).toMatchObject({
      state: "ready_to_submit",
      anchorAt: previous.anchorAt,
      restartCount: 4,
    })
  })
})

test("A roster listing the student wakes the waiting row once per enrolment", async ({
  page,
  adminApi,
}) => {
  const course = await createPacingCourse(adminApi, page.request, 1)
  const courseCode = course.modules[0]!.courseCode
  const parked = await parkCompletedModule(page, adminApi, course)
  const enrolmentId = `hy-enr-${STUDENT.studentNumber}-${courseCode}-pacing`
  await upsertMockSuotarEnrolments(page.request, [
    {
      id: enrolmentId,
      studentNumber: STUDENT.studentNumber,
      courseCode,
      kind: "degree",
      state: "ENROLLED",
      studyRightValidityPeriod: activeStudyRightPeriod(),
    },
  ])

  await runEnrolmentDiscoveryTick(page.request, { courseId: course.courseId })
  const woken = await getEnrolmentCheckSchedule(page.request, parked.id)
  expect(woken.source).toBe("roster_listing")
  expect(Date.parse(woken.nextAttemptAt)).toBeLessThanOrEqual(Date.now() + CLOCK_SLACK_MS)
  expect(woken.seenEnrolmentIds).toContain(enrolmentId)

  await test.step("Once checked, the same enrolment listed again wakes nothing", async () => {
    // A registry answer that still has no usable enrolment for the student, as when the roster
    // is ahead of it.
    await armMockSuotarFault(page.request, {
      id: CHECK_ANSWER_FAULT_ID,
      when: [
        { endpoint: "resolve_enrolments" },
        { stage: "resolve" },
        { studentNumber: STUDENT.studentNumber },
        { courseCode },
      ],
      // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
      then: { kind: "itemLevel", code: "enrolmentNotFound" },
    })
    await runPreconditionsTick(page.request, parked.rowScope)
    await runResolveEnrolmentsTick(page.request, parked.rowScope)
    const checked = await getEnrolmentCheckSchedule(page.request, parked.id)
    expect(checked).toMatchObject({ state: "no_usable_enrolment", source: "schedule" })
    expect(Date.parse(checked.nextAttemptAt)).toBeGreaterThan(Date.now())

    await makeRosterListingsDue(page.request, { courseId: course.courseId })
    await runEnrolmentDiscoveryTick(page.request, { courseId: course.courseId })
    expect(await getEnrolmentCheckSchedule(page.request, parked.id)).toMatchObject({
      source: "schedule",
      nextAttemptAt: checked.nextAttemptAt,
    })
  })
})

test("A roster batch that fails as a whole is listed code by code, and the bad code alerts", async ({
  page,
  adminApi,
}) => {
  const course = await createPacingCourse(adminApi, page.request, 2)
  rosterCourseId = course.courseId
  const [good, bad] = course.modules.map((courseModule) => courseModule.courseCode)
  const parked = await parkCompletedModule(page, adminApi, course)
  const scope = { courseId: course.courseId }

  await armMockSuotarFault(page.request, {
    id: ROSTER_FAULT_ID,
    when: [{ endpoint: "list_by_course" }, { stage: "resolve" }, { courseCode: bad! }],
    // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
    then: { kind: "requestLevel", status: 503, code: UNAVAILABLE_WIRE_CODE },
  })

  await test.step("One bad code fails the listing of both", async () => {
    const tick = await runTickUnchecked(page.request, "enrolment-discovery", scope)
    expect(tick.status === "ran" ? tick.error : null).not.toBeNull()
    const batch = await latestListingOf(page.request, good!)
    expect(batch.httpStatus).toBe(503)
    expect(batch.items.map((item) => item.courseCode).toSorted()).toStrictEqual(
      [good, bad].toSorted(),
    )
  })

  // Only now, so no listing before the fallback can have woken the row.
  await upsertMockSuotarEnrolments(page.request, [
    {
      studentNumber: STUDENT.studentNumber,
      courseCode: good!,
      kind: "degree",
      state: "ENROLLED",
      studyRightValidityPeriod: activeStudyRightPeriod(),
    },
  ])

  await test.step("Listed alone, the good code wakes its row and the bad one fails", async () => {
    // The failed batch dropped the listing rate to where only one request goes out at a time.
    await makeRosterListingsDue(page.request, scope)
    await runTickUnchecked(page.request, "enrolment-discovery", scope)
    const goodAlone = await latestListingOf(page.request, good!)
    expect(goodAlone.httpStatus).toBe(200)
    expect(goodAlone.items.map((item) => item.courseCode)).toStrictEqual([good])
    const badAlone = await latestListingOf(page.request, bad!)
    expect(badAlone.httpStatus).toBe(503)
    expect(badAlone.items.map((item) => item.courseCode)).toStrictEqual([bad])

    const woken = await getEnrolmentCheckSchedule(page.request, parked.id)
    expect(woken.source).toBe("roster_listing")
    expect(Date.parse(woken.nextAttemptAt)).toBeLessThanOrEqual(Date.now() + CLOCK_SLACK_MS)
  })

  await test.step("The admin health alerts name the failing code", async () => {
    const overview = await getJson<{
      health: { alerts: { id: string; subject: string | null }[] }
    }>(adminApi, `${CREDIT_REGISTRATION_ADMIN_API}/overview`)
    expect(overview.health.alerts).toContainEqual(
      expect.objectContaining({ id: "roster_course_code_failing", subject: bad }),
    )
  })
})

test("A lookup that fails in transit leaves the waiting row where it was", async ({
  page,
  adminApi,
}) => {
  const course = await createPacingCourse(adminApi, page.request, 1)
  const courseCode = course.modules[0]!.courseCode
  const parked = await parkCompletedModule(page, adminApi, course)
  const before = await getEnrolmentCheckSchedule(page.request, parked.id)

  await armMockSuotarFault(page.request, {
    id: LOOKUP_OUTAGE_FAULT_ID,
    when: [
      { endpoint: "resolve_enrolments" },
      { stage: "resolve" },
      { studentNumber: STUDENT.studentNumber },
      { courseCode },
    ],
    // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
    then: { kind: "requestLevel", status: 503, code: UNAVAILABLE_WIRE_CODE },
  })
  await makeEnrolmentChecksDue(page.request, parked.rowScope)
  await runPreconditionsTick(page.request, parked.rowScope)
  const tick = await runTickUnchecked(page.request, "resolve-enrolments", parked.rowScope)
  expect(tick.status === "ran" ? tick.error : null).not.toBeNull()
  expect(
    await countMockCallsForStudent(
      page.request,
      STUDENT.studentNumber,
      courseCode,
      "resolve_enrolments",
    ),
  ).toBeGreaterThan(0)

  const after = await getEnrolmentCheckSchedule(page.request, parked.id)
  expect(after).toMatchObject({
    state: "no_usable_enrolment",
    errorCode: before.errorCode,
    firstFailedAt: null,
    submitRetryCount: 0,
    checkedAt: before.checkedAt,
    step: before.step,
    dueAt: before.dueAt,
  })
  const retryInMs = Date.parse(after.nextAttemptAt) - Date.now()
  expect(retryInMs).toBeGreaterThan(TRANSIENT_RETRY_MS - CLOCK_SLACK_MS)
  expect(retryInMs).toBeLessThan(TRANSIENT_RETRY_MS + CLOCK_SLACK_MS)
})
