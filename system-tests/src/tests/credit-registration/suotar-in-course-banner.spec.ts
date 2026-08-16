import type { APIRequestContext, Page } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import {
  courseFrontPageUrl,
  CREDIT_REGISTRATIONS_API,
  CRS_101,
  getJson,
  type MyCreditRegistration,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { expect, test } from "@/utils/fixtures"
import { upsertMockSuotarEnrolments } from "@/utils/mockSuotar"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import {
  runMaterializeTick,
  runPreconditionsTick,
  runProductTokenRefreshTick,
  runResolveEnrolmentsTick,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns student numbers `9000015xx` and reads the seeded chapter page of
 * `credit-registration-via-suotar`.
 *
 * The banner's substance — a working enrolment link and a check-again action on a missing enrolment
 * — is asserted on the status page in suotar-enrolment-problems.spec.ts. What is only testable here
 * is where it appears, that it does not block reading, and that its visibility follows the ledger
 * state rather than the browser.
 */
const STUCK_EMAIL = "credit-registration-banner-stuck@example.com"
const REENROLS_EMAIL = "credit-registration-banner-reenrols@example.com"
const REENROLS_STUDENT_NUMBER = "900001502"

const CHAPTER_PAGE_URL = `${courseFrontPageUrl(SUOTAR_COURSE_SLUG)}/chapter-1/page-1`
const CHAPTER_FRONT_PAGE_URL = `${courseFrontPageUrl(SUOTAR_COURSE_SLUG)}/chapter-1`
const MATERIAL_TEXT = "Completing this module registers credits into Sisu."

const YEAR = 365 * 24 * 60 * 60 * 1000
const isoDate = (offsetMs: number) =>
  new Date(Date.now() + offsetMs).toISOString().slice(0, "2026-01-01".length)

const banner = (page: Page) => page.getByTestId("credit-registration-enrolment-banner")

/** Drives the student's seeded completion to the state the banner exists for. */
const parkOnMissingEnrolment = async (
  page: Page,
  adminApi: APIRequestContext,
  userEmail: string,
) => {
  const scope = { userEmail }
  await runProductTokenRefreshTick(page.request, { courseSlug: SUOTAR_COURSE_SLUG })
  await runMaterializeTick(page.request, scope)
  await runPreconditionsTick(page.request, scope)
  await runResolveEnrolmentsTick(page.request, scope)
  return await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
    "no_usable_enrolment",
  ])
}

const bannersDue = (request: APIRequestContext, courseId: string) =>
  getJson<MyCreditRegistration[]>(
    request,
    `${CREDIT_REGISTRATIONS_API}/my/enrolment-banners/by-course/${courseId}`,
  )

test.describe("A student the University has no enrolment for", () => {
  test.use({ storageState: seededStudentStorageState(STUCK_EMAIL) })

  test("The banner renders above readable content and does not block reading the page", async ({
    page,
    adminApi,
  }) => {
    await parkOnMissingEnrolment(page, adminApi, STUCK_EMAIL)

    await page.goto(CHAPTER_PAGE_URL)
    await selectCourseInstanceIfPrompted(page)

    const notice = banner(page)
    await expect(notice).toBeVisible()
    await expect(notice.getByText("Enrolment needed")).toBeVisible()
    await expect(
      notice.getByRole("link", { name: "Enrol at the Open University" }),
    ).toHaveAttribute("href", /token/)
    await expect(notice.getByRole("button", { name: "I have enrolled, check again" })).toBeVisible()

    await test.step("It is a banner, not a dialog", async () => {
      await expect(page.getByRole("dialog")).toHaveCount(0)
      // Clicking the material checks actionability, so an overlay covering it fails here.
      await page.getByText(MATERIAL_TEXT).click()
      await expect(page.getByText(MATERIAL_TEXT)).toBeVisible()
      await expect(notice).toBeVisible()
    })
  })

  test("Dismissal hides it, but a fresh enrolment problem brings it back", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: STUCK_EMAIL }
    const parked = await parkOnMissingEnrolment(page, adminApi, STUCK_EMAIL)

    await page.goto(CHAPTER_PAGE_URL)
    await selectCourseInstanceIfPrompted(page)
    await banner(page).getByRole("button", { name: "Dismiss" }).click()
    await expect(banner(page)).toHaveCount(0)

    await test.step("The dismissal is server state, not sessionStorage", async () => {
      await page.goto(CHAPTER_FRONT_PAGE_URL)
      await expect(banner(page)).toHaveCount(0)
      await page.reload()
      await expect(banner(page)).toHaveCount(0)
    })

    await test.step("A new run of the same problem brings it back", async () => {
      const recheck = await page.request.post(
        `${CREDIT_REGISTRATIONS_API}/my/${parked.id}/recheck-enrolment`,
      )
      expect(recheck.ok()).toBe(true)
      await runResolveEnrolmentsTick(page.request, scope)
      // The mock still has no enrolment, so the row lands back in the same state, which is what
      // clears the dismissal.
      await pollUntil(async () => (await bannersDue(page.request, parked.course_id)).length > 0, {
        description: "the dismissed banner to become due again",
      })

      await page.reload()
      await expect(banner(page)).toBeVisible()
    })
  })
})

test.describe("A student who enrols after being told to", () => {
  test.use({ storageState: seededStudentStorageState(REENROLS_EMAIL) })

  test("It survives navigation and reload, and disappears once the student re-enrols", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: REENROLS_EMAIL }
    await parkOnMissingEnrolment(page, adminApi, REENROLS_EMAIL)

    await page.goto(CHAPTER_PAGE_URL)
    await selectCourseInstanceIfPrompted(page)
    await expect(banner(page)).toBeVisible()

    await test.step("It survives navigation and a reload", async () => {
      await page.goto(CHAPTER_FRONT_PAGE_URL)
      await expect(banner(page)).toBeVisible()
      await page.reload()
      await expect(banner(page)).toBeVisible()
    })

    await test.step("It goes away on its own once the enrolment appears", async () => {
      await upsertMockSuotarEnrolments(page.request, [
        {
          studentNumber: REENROLS_STUDENT_NUMBER,
          courseCode: CRS_101,
          kind: "degree",
          state: "ENROLLED",
          studyRightValidityPeriod: { startDate: isoDate(-YEAR), endDate: isoDate(YEAR) },
        },
      ])
      await waitForSuccessNotification(
        page,
        async () => {
          await banner(page).getByRole("button", { name: "I have enrolled, check again" }).click()
        },
        "Success",
      )
      await runResolveEnrolmentsTick(page.request, scope)
      await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
        "checking_enrolment",
        "submitting",
        "awaiting_verification",
        "registered",
        "duplicate",
      ])

      // Gone without a dismissal: the ledger state is the whole visibility predicate.
      await page.reload()
      await expect(banner(page)).toHaveCount(0)
    })
  })
})
