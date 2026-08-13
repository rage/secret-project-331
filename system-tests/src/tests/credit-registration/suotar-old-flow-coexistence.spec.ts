import {
  legacyPullStream,
  OLD_FLOW_COURSE_ID,
  OLD_FLOW_COURSE_SLUG,
} from "@/utils/creditRegistration"
import { listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import { expect, test } from "@/utils/fixtures"
import { runMaterializeTick } from "@/utils/suotarControl"

/**
 * Owns student numbers `9000010xx` and the `credit-registration-old-flow` course. Must be green
 * before the first real course is cut over.
 */
const STILL_LEGACY_EMAIL = "credit-registration-old-flow-still-legacy@example.com"
/** On the course's other module, which the seed treats as already cut over to Suotar. */
const ALREADY_CUT_OVER_EMAIL = "credit-registration-old-flow-already-cut-over@example.com"

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

test("A completion eligible under both paths is registered exactly once", async ({
  page,
  adminApi,
}) => {
  // The fixture's second module stands in for a course the moment after cutover: Suotar is on, but
  // this one completion predates it and was already registered through the legacy pull path.
  await test.step("The now-Suotar module has left the legacy pull stream", async () => {
    const stream = await legacyPullStream(page.request, OLD_FLOW_COURSE_SLUG)
    expect(stream).not.toContain(ALREADY_CUT_OVER_EMAIL)
  })

  await test.step("Materialize refuses to create a second registration for it", async () => {
    const materialized = await runMaterializeTick(page.request, {
      courseSlug: OLD_FLOW_COURSE_SLUG,
    })
    expect(materialized.itemsProcessed).toBe(0)
    const registrations = await listAdminRegistrations(adminApi, { course_id: OLD_FLOW_COURSE_ID })
    expect(registrations.data.some((row) => row.email === ALREADY_CUT_OVER_EMAIL)).toBe(false)
  })
})
