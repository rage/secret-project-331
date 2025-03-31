import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test("Research consent form is visible on login, if not yet answered", async ({
  page,
  headless,
}, testInfo) => {
  await test.step("Research consent form is visible on login, if not yet answered", async () => {
    await page.goto("http://project-331.local/organizations")
    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "Log in" }).click()
    await page.click(`label:has-text("Email")`)
    await page.fill(`label:has-text("Email")`, "student-without-research-consent@example.com")

    await page.click(`label:has-text("Password")`)
    await page.fill(`label:has-text("Password")`, "student-without-research-consent")
    await page.locator("id=login-button").click()
    await expect(page.getByText("Regarding research done on courses")).toBeVisible()

    await page
      .getByLabel(
        "I want to participate in the educational research. By choosing this, you help both current and future students.",
      )
      .check()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "research-consent-form",
      waitForTheseToBeVisibleAndStable: [page.getByText("Regarding research done on courses")],
    })
    await page.getByRole("button", { name: "Save" }).click()
    await page.getByText("Operation successful").waitFor()

    //Login again and check research consent form doesn't show again when already answered.
    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.getByRole("button", { name: "Log in" }).click()

    await page.click(`label:has-text("Email")`)
    await page.fill(`label:has-text("Email")`, "student-without-research-consent@example.com")

    await page.click(`label:has-text("Password")`)
    await page.fill(`label:has-text("Password")`, "student-without-research-consent")
    await page.locator("id=login-button").click()
    await expect(page.getByText("Organizations")).toBeVisible()
  })

  await test.step("Can change research consent", async () => {
    await page.goto("http://project-331.local/organizations")
    await page
      .getByRole("link", {
        name: "University of Helsinki, Department of Mathematics and Statistics",
      })
      .click()
    await page.getByRole("link", { name: "Navigate to course 'Introduction to citations'" }).click()
    await selectCourseInstanceIfPrompted(page)

    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "Log in" }).click()
    await page.click(`label:has-text("Email")`)
    await page.fill(`label:has-text("Email")`, "student-without-research-consent@example.com")

    await page.click(`label:has-text("Password")`)
    await page.fill(`label:has-text("Password")`, "student-without-research-consent")
    await page.locator("id=login-button").click()

    await selectCourseInstanceIfPrompted(page)

    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "User settings" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    expect(
      await page
        .getByLabel(
          "I want to participate in the educational research. By choosing this, you help both current and future students.",
        )
        .isChecked(),
    )

    await page.getByLabel("I do not want to participate in the educational research.").check()
    await page.getByRole("button", { name: "Save" }).click()
    await page.getByText("Operation successful").waitFor()
    await page.getByRole("button", { name: "Edit" }).click()
    expect(
      await page
        .getByLabel("I do not want to participate in the educational research.")
        .isChecked(),
    )
  })
})
