import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  completionRegistrationUrl,
  CREDIT_REGISTRATIONS_API,
  myCreditRegistrations,
  ORIGIN,
  PROFILE_CREDIT_REGISTRATION_URL,
  PROFILE_STUDIES_URL,
  seededStudentStorageState,
  STUDENT_6,
  SUOTAR_COURSE_SLUG,
} from "@/utils/creditRegistration"
import { ADMIN_REGISTRATIONS_URL } from "@/utils/creditRegistrationAdmin"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * Reads what the seed writes rather than drives: `student6`'s linked number and its replaced attempt
 * pair on `credit-registration-via-suotar`, and `student5`, which has nothing linked. Ticks nothing.
 */
const LINKED_EMAIL = STUDENT_6.email
const LINKED_STUDENT_NUMBER = STUDENT_6.studentNumber
const SUPERSEDED_EMAIL = STUDENT_6.email
const EMPTY_STORAGE_STATE = "src/states/student5@example.com.json"

test.describe("A student whose grade was registered twice", () => {
  test.use({ storageState: seededStudentStorageState(SUPERSEDED_EMAIL) })

  test("The studies page answers where the credits went, and the replaced attempt survives as history", async ({
    page,
  }) => {
    await page.goto(PROFILE_STUDIES_URL)

    // The card is always open, so the module's registration status needs no click.
    await expect(page.getByText("Registered in Sisu").first()).toBeVisible()
    // A registered, non-superseded attempt needs nothing from the student, so the section is absent.
    await expect(page.getByRole("heading", { name: "Something you need to do" })).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Credits that did not go through" }),
    ).toHaveCount(0)

    const [firstLive] = (await myCreditRegistrations(page.request)).filter(
      (row) => row.course_slug === SUOTAR_COURSE_SLUG && !row.superseded,
    )
    const live = assertNotNullOrUndefined(firstLive)
    // The seed's realisation name has Finnish and English; Finnish wins.
    expect(live.enrolment_realisation_name).toBe("Rekisteröinnin testitoteutus")
    await page.goto(completionRegistrationUrl(live.course_module_id))
    // A student who saw grade 3 registered should not find that it never happened.
    await expect(page.getByRole("heading", { name: "Earlier attempts" })).toBeVisible()
    await expect(page.getByText("Attempt 1")).toBeVisible()

    await accessibilityCheck(page, "Profile studies page")
  })

  test("the old credit-registration tab link still lands on the studies page", async ({ page }) => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)
    await expect(page).toHaveURL(PROFILE_STUDIES_URL)
  })
})

test.describe("A student on a Suotar course and nothing else", () => {
  test.use({ storageState: EMPTY_STORAGE_STATE })

  test("A student with nothing linked is not told about credit registration", async ({ page }) => {
    await page.goto(PROFILE_STUDIES_URL)

    // Without a linked number no completion of theirs goes through Suotar, so a promise of a
    // confirmation mail would be false.
    await expect(
      page.getByRole("heading", { name: "Credit registration via Suotar" }),
    ).toBeVisible()
    await expect(page.getByText("No student number is linked yet.")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Something you need to do" })).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Credits that did not go through" }),
    ).toHaveCount(0)
  })

  test("A student cannot read another student's credit registrations", async ({ page }) => {
    // Ownership is filtered in SQL by the session's user, so asking for the whole collection is the
    // strongest attempt available: there is no path to another student's rows at all.
    const mine = await page.request.get(`${CREDIT_REGISTRATIONS_API}/my`)
    await expect(mine).toBeOK()
    expect(await mine.json()).toStrictEqual([])

    const someoneElsesProfile = await page.request.get(ADMIN_REGISTRATIONS_URL)
    expect(someoneElsesProfile.status()).toBe(403)
  })
})

test.describe("A student whose number was confirmed by the mailed link", () => {
  test.use({ storageState: seededStudentStorageState(LINKED_EMAIL) })

  test("The studies page points at the linked number, and the settings page names it in full", async ({
    page,
  }) => {
    await page.goto(PROFILE_STUDIES_URL)
    await expect(page.getByText(LINKED_STUDENT_NUMBER)).toBeVisible()

    await page.goto(`${ORIGIN}/user-settings/student-number`)
    await expect(page.getByText(LINKED_STUDENT_NUMBER)).toBeVisible()
    // We can see our own outbox and nothing else, so the copy may never claim delivery.
    await expect(page.getByText("delivered")).toHaveCount(0)
  })
})
