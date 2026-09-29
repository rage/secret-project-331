import {
  legacyPullStream,
  OLD_FLOW_COURSE_ID,
  OLD_FLOW_COURSE_SLUG,
  STUDENT_7,
  STUDENT_8,
} from "@/utils/creditRegistration"
import { listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import { runMaterializeTick } from "@/utils/suotarControl"

/**
 * Owns the `credit-registration-old-flow` course, with `student7` and `student8` on it. Must be green
 * before the first real course is cut over.
 */
const STILL_LEGACY_EMAIL = STUDENT_7.email
/** On the course's other module, which is opted into Suotar but not for this completion. */
const PREDATES_OPT_IN_EMAIL = STUDENT_8.email

test("A course left on the old flow keeps registering through the legacy pull API", async ({
  page,
  adminApi,
}) => {
  const stream = await legacyPullStream(page.request, OLD_FLOW_COURSE_SLUG)
  expect(stream).toContain(STILL_LEGACY_EMAIL)

  const materialized = await runMaterializeTick(page.request, { courseSlug: OLD_FLOW_COURSE_SLUG })
  expect(materialized.itemsProcessed).toBe(0)
  const registrations = await listAdminRegistrations(adminApi, { course_id: OLD_FLOW_COURSE_ID })
  expect(registrations.total_count).toBe(0)
})

test("A completion that predates the module's opt-in stays with the old flow", async ({
  page,
  adminApi,
}) => {
  await test.step("The legacy pull stream still offers it", async () => {
    const stream = await legacyPullStream(page.request, OLD_FLOW_COURSE_SLUG)
    expect(stream).toContain(PREDATES_OPT_IN_EMAIL)
  })

  await test.step("Materialize creates no Suotar registration for it", async () => {
    const materialized = await runMaterializeTick(page.request, {
      courseSlug: OLD_FLOW_COURSE_SLUG,
    })
    expect(materialized.itemsProcessed).toBe(0)
    const registrations = await listAdminRegistrations(adminApi, { course_id: OLD_FLOW_COURSE_ID })
    expect(registrations.data.some((row) => row.email === PREDATES_OPT_IN_EMAIL)).toBe(false)
  })
})
