import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  completionRegistrationUrl,
  CREDIT_REGISTRATIONS_API,
  myCreditRegistrations,
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

  test("The studies tab answers where the credits went, and the replaced attempt survives as history", async ({
    page,
  }) => {
    await page.goto(PROFILE_STUDIES_URL)

    await expect(page.getByRole("tab", { name: "Credit registration" })).toBeVisible()
    // The card is always open, so the module's registration status needs no click.
    await expect(page.getByText("Registered in Sisu").first()).toBeVisible()

    const [live] = (await myCreditRegistrations(page.request)).filter((row) => !row.superseded)
    expect(live, "the seeded pair has one live attempt").toBeDefined()
    await page.goto(completionRegistrationUrl(live!.course_module_id))
    // A student who saw grade 3 registered should not find that it never happened.
    await expect(page.getByRole("heading", { name: "Earlier attempts" })).toBeVisible()
    await expect(page.getByText("Attempt 1")).toBeVisible()

    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)
    for (const heading of ["Student number", "Registrations that need attention"]) {
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible()
    }
    // Nothing is wrong with a registered attempt, so the tab does not re-list it.
    await expect(page.getByText("Nothing needs your attention")).toBeVisible()

    await accessibilityCheck(page, "Profile credit registration tab")
  })
})

test.describe("A student on a Suotar course and nothing else", () => {
  test.use({ storageState: seededStudentStorageState(EMPTY_EMAIL) })

  test("A student with nothing linked sees explanatory copy, not empty cards", async ({ page }) => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)

    await expect(page.getByRole("heading", { level: 2, name: "Student number" })).toBeVisible()
    await expect(page.getByText("No student number is linked to this account yet.")).toBeVisible()
    await expect(page.getByText("Nothing needs your attention")).toBeVisible()
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

  test("The linked card names the number and how it was confirmed", async ({ page }) => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)

    await expect(page.getByText(LINKED_STUDENT_NUMBER)).toBeVisible()
    await expect(page.getByText("Linked").first()).toBeVisible()
    // We can see our own outbox and nothing else, so the copy may never claim delivery.
    await expect(page.getByText("delivered")).toHaveCount(0)
  })
})
