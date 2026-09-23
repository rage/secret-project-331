import type { Page } from "@playwright/test"

import {
  CERTIFICATE_DETOUR_COURSE_SLUG,
  courseFrontPageUrl,
  OLD_FLOW_COURSE_SLUG,
  seededStudentStorageState,
  STUDENT_7,
  STUDENT_8,
} from "@/utils/creditRegistration"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * The detour between "I am not a University of Helsinki student" and the Open University
 * instructions, which only appears on a module whose certificate the student could take instead.
 *
 * This path never reaches Suotar. The fixture course is seeded by `seed_certificate_detour_course`,
 * and `credit-registration-old-flow` stands in for the modules that must keep showing the plain page.
 * `student7` has a completion on both. `student8` has its own completion on the same detour module,
 * so the failed-save test below never shares a (module, student) pair with the test that saves a
 * reason for good.
 */
const DETOUR_STUDENT_EMAIL = STUDENT_7.email
const OLD_FLOW_STUDENT_EMAIL = STUDENT_7.email
const FAILED_SAVE_STUDENT_EMAIL = STUDENT_8.email

const STUDENT_TYPE_QUESTION =
  "Are you a student or an exchange student at the University of Helsinki?"
const FINNISH_ID_QUESTION =
  "Are you Finnish, or do you have a Finnish personal identity code (henkilötunnus)?"
const WHICH_DO_YOU_NEED_QUESTION = "Which do you need?"
const IDENTIFICATION_QUESTION =
  "Are you able to identify yourself with any of the Suomi.fi e-identification methods?"
const RECONSIDER_QUESTION = "Reconsider: which do you need?"

const CERTIFICATE_OPTION = "A certificate of completion"
const CREDITS_OPTION = "Credits in the UH study registry"

const OPEN_UNIVERSITY_INSTRUCTIONS = /Use this email address on the enrollment form/
const JUSTIFICATION_ENDPOINT = "**/credit-justification"

/** Opens the registration page the way a student does: from the completed module's own card. */
const openRegistrationPage = async (page: Page, courseSlug: string) => {
  await page.goto(courseFrontPageUrl(courseSlug))
  await page.getByRole("link", { name: "Register", exact: true }).click()
  // The page loads its completion data before it can draw the first question, and clicking a
  // control that is still being replaced drops the click.
  await expect(page.getByText(STUDENT_TYPE_QUESTION)).toBeVisible()
}

const answer = (page: Page, question: string, option: string | RegExp) =>
  page.getByRole("radiogroup", { name: question }).getByRole("radio", { name: option }).check()

/** The identification question answers itself with plain buttons, not a radio group. */
const answerIdentification = (page: Page, option: string | RegExp) =>
  page.getByRole("button", { name: option, exact: true }).click()

test.describe("A module whose certificate a student could take instead of the credits", () => {
  test.use({ storageState: seededStudentStorageState(DETOUR_STUDENT_EMAIL) })

  test("A Finnish student is asked nothing beyond the first question", async ({ page }) => {
    await openRegistrationPage(page, CERTIFICATE_DETOUR_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")
    await answer(page, FINNISH_ID_QUESTION, "Yes")

    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()
    await expect(page.getByRole("radiogroup", { name: WHICH_DO_YOU_NEED_QUESTION })).toHaveCount(0)
  })

  test("A student the certificate serves is handed it and asked nothing else", async ({ page }) => {
    await openRegistrationPage(page, CERTIFICATE_DETOUR_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")
    await answer(page, FINNISH_ID_QUESTION, "No")
    await answer(page, WHICH_DO_YOU_NEED_QUESTION, CERTIFICATE_OPTION)

    const certificateLink = page.getByRole("link", { name: "Go to certificate" })
    await expect(certificateLink).toHaveAttribute(
      "href",
      /\/generate-certificate\?module=.+&ccid=.+/,
    )
    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toHaveCount(0)
    // A certificate is issued to the account, so the email-matching notes have nothing to warn about.
    await expect(
      page.getByText("I have changed my email address since completing this course"),
    ).toHaveCount(0)

    await certificateLink.click()
    await expect(page).toHaveURL(/\/generate-certificate\?module=/)
  })

  test("A student with eIDAS is told where it lives in Sisu and sent on", async ({ page }) => {
    await openRegistrationPage(page, CERTIFICATE_DETOUR_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")
    await answer(page, FINNISH_ID_QUESTION, "No")
    await answer(page, WHICH_DO_YOU_NEED_QUESTION, CREDITS_OPTION)
    await expect(page.getByRole("heading", { name: IDENTIFICATION_QUESTION })).toBeVisible()
    await answerIdentification(page, "eIDAS")

    await expect(page.getByText(/Then select Identification methods for foreigners/)).toBeVisible()
    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()
    await expect(page.getByRole("link", { name: "Go to enrollment form" })).toBeVisible()
  })

  test("A student with another Suomi.fi method gets the other tip", async ({ page }) => {
    await openRegistrationPage(page, CERTIFICATE_DETOUR_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")
    await answer(page, FINNISH_ID_QUESTION, "No")
    await answer(page, WHICH_DO_YOU_NEED_QUESTION, CREDITS_OPTION)
    await answerIdentification(page, "Another Suomi.fi e-identification method")

    await expect(page.getByText(/Then select your identification method/)).toBeVisible()
    await expect(page.getByText(/Then select Identification methods for foreigners/)).toHaveCount(0)
    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()
  })

  test("A student facing a manual identity check is offered the certificate once more", async ({
    page,
  }) => {
    await openRegistrationPage(page, CERTIFICATE_DETOUR_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")
    await answer(page, FINNISH_ID_QUESTION, "No")
    await answer(page, WHICH_DO_YOU_NEED_QUESTION, CREDITS_OPTION)
    await answerIdentification(page, "No")
    await answer(page, RECONSIDER_QUESTION, CERTIFICATE_OPTION)

    await expect(page.getByRole("link", { name: "Go to certificate" })).toBeVisible()
    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toHaveCount(0)
  })

  test("A student who still wants the credits says why, and the answer survives a reload", async ({
    page,
  }) => {
    await openRegistrationPage(page, CERTIFICATE_DETOUR_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")
    await answer(page, FINNISH_ID_QUESTION, "No")
    await answer(page, WHICH_DO_YOU_NEED_QUESTION, CREDITS_OPTION)
    await answerIdentification(page, "No")
    await answer(page, RECONSIDER_QUESTION, CREDITS_OPTION)

    await test.step("An empty answer is refused rather than saved", async () => {
      await page.getByRole("button", { name: "Continue" }).click()
      await expect(page.getByText("Tell us briefly why you need the credits.")).toBeVisible()
      await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toHaveCount(0)
    })

    const reason = "My degree programme in Finland counts these credits."
    await page.getByRole("textbox", { name: "Your reason" }).fill(reason)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page.getByText("Your answer has been saved.")).toBeVisible()
    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()

    await test.step("Coming back finds the answer still there", async () => {
      await page.reload()
      await answer(page, STUDENT_TYPE_QUESTION, "No")
      await answer(page, FINNISH_ID_QUESTION, "No")
      await answer(page, WHICH_DO_YOU_NEED_QUESTION, CREDITS_OPTION)
      await answerIdentification(page, "No")
      await answer(page, RECONSIDER_QUESTION, CREDITS_OPTION)

      await expect(page.getByRole("textbox", { name: "Your reason" })).toHaveValue(reason)
      await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()
      // A saved reason means the flow already continued past this band.
      await expect(page.getByRole("button", { name: "Update reason" })).toBeVisible()
    })

    await test.step("Changing an answer above it takes the instructions back down", async () => {
      await answer(page, FINNISH_ID_QUESTION, "Yes")
      await expect(page.getByRole("radiogroup", { name: RECONSIDER_QUESTION })).toHaveCount(0)
      // Q1 = Yes has instructions of its own, so they are still on screen; the questions are not.
      await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()

      await answer(page, FINNISH_ID_QUESTION, "No")
      await expect(page.getByRole("radiogroup", { name: RECONSIDER_QUESTION })).toBeVisible()
      await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()
    })
  })
})

test.describe("A failed save on the certificate detour module", () => {
  test.use({ storageState: seededStudentStorageState(FAILED_SAVE_STUDENT_EMAIL) })

  test("A failed save is reported instead of quietly letting the student past", async ({
    page,
  }) => {
    await page.route(JUSTIFICATION_ENDPOINT, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    )
    await openRegistrationPage(page, CERTIFICATE_DETOUR_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")
    await answer(page, FINNISH_ID_QUESTION, "No")
    await answer(page, WHICH_DO_YOU_NEED_QUESTION, CREDITS_OPTION)
    await answerIdentification(page, "No")
    await answer(page, RECONSIDER_QUESTION, CREDITS_OPTION)
    await page.getByRole("textbox", { name: "Your reason" }).fill("I need them in the registry.")
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page.getByText("Saving your answer failed. Please try again.")).toBeVisible()
    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toHaveCount(0)
    await expect(page.getByRole("textbox", { name: "Your reason" })).toBeVisible()
  })
})

test.describe("A module with no certificate to offer", () => {
  test.use({ storageState: seededStudentStorageState(OLD_FLOW_STUDENT_EMAIL) })

  test("The Open University instructions follow the first answer with nothing in between", async ({
    page,
  }) => {
    await openRegistrationPage(page, OLD_FLOW_COURSE_SLUG)

    await answer(page, STUDENT_TYPE_QUESTION, "No")

    await expect(page.getByText(OPEN_UNIVERSITY_INSTRUCTIONS)).toBeVisible()
    await expect(page.getByRole("radiogroup", { name: FINNISH_ID_QUESTION })).toHaveCount(0)
  })
})
