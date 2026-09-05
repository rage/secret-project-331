import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  completionRegistrationUrl,
  CREDIT_REGISTRATIONS_API,
  myCreditRegistrations,
  ORIGIN,
  PROFILE_CREDIT_REGISTRATION_URL,
  PROFILE_STUDIES_URL,
  seededStudentStorageState,
} from "@/utils/creditRegistration"
import { ADMIN_REGISTRATIONS_URL } from "@/utils/creditRegistrationAdmin"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * Owns student numbers `9000016xx` and reads two fixtures the seed writes rather than drives: the
 * already-linked student and the replaced attempt pair. Ticks nothing; every other file that touches
 * those rows only reads them too.
 */
const LINKED_EMAIL = "credit-registration-linked-student@example.com"
const LINKED_STUDENT_NUMBER = "900000101"
const SUPERSEDED_EMAIL = "credit-registration-superseded@example.com"
const EMPTY_EMAIL = "credit-registration-profile-empty@example.com"

test.describe("A student whose grade was registered twice", () => {
  test.use({ storageState: seededStudentStorageState(SUPERSEDED_EMAIL) })

  test("The studies page answers where the credits went, and the replaced attempt survives as history", async ({
    page,
  }) => {
    await page.goto(PROFILE_STUDIES_URL)

    // The card is always open, so the module's registration status needs no click.
    await expect(page.getByText("Registered in Sisu").first()).toBeVisible()
    // A registered, non-superseded attempt needs nothing from the student, so the section is absent.
    await expect(
      page.getByRole("heading", { name: "Registrations that need attention" }),
    ).toHaveCount(0)

    const [live] = (await myCreditRegistrations(page.request)).filter((row) => !row.superseded)
    expect(live, "the seeded pair has one live attempt").toBeDefined()
    await page.goto(completionRegistrationUrl(live!.course_module_id))
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
  test.use({ storageState: seededStudentStorageState(EMPTY_EMAIL) })

  test("A student with nothing linked sees explanatory copy, not empty cards", async ({ page }) => {
    await page.goto(PROFILE_STUDIES_URL)

    await expect(page.getByText("No student number linked yet.")).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Registrations that need attention" }),
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
