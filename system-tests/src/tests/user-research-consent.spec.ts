import { expect, test } from "@playwright/test"

import { Topbar } from "../utils/components/Topbar"
import { UserSettingsPage } from "../utils/components/UserSettings/UserSettingsPage"
import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"
test("Research consent form is visible on login, if not yet answered", async ({
  page,
  headless,
}, testInfo) => {
  await test.step("Research consent form is visible on login, if not yet answered", async () => {
    await page.goto("http://project-331.local/organizations")
    const topbar = new Topbar(page)
    await topbar.clickLogin()
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
    await waitForSuccessNotification(page, async () => {
      await page
        .getByTestId("research-consent-dialog")
        .getByRole("button", { name: "Save" })
        .click()
    })

    //Login again and check research consent form doesn't show again when already answered.
    await topbar.logout()
    await topbar.clickLogin()

    await page.click(`label:has-text("Email")`)
    await page.fill(`label:has-text("Email")`, "student-without-research-consent@example.com")

    await page.click(`label:has-text("Password")`)
    await page.fill(`label:has-text("Password")`, "student-without-research-consent")
    await page.locator("id=login-button").click()
    await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible()
  })

  await test.step("Can change research consent", async () => {
    await page.goto("http://project-331.local/organizations")
    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )
    await page.getByRole("link", { name: "Navigate to course 'Change language course'" }).click()
    await selectCourseInstanceIfPrompted(page)
    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState("networkidle")

    const topbar2 = new Topbar(page)
    await topbar2.logout()
    await topbar2.clickLogin()
    await page.click(`label:has-text("Email")`)
    await page.fill(`label:has-text("Email")`, "student-without-research-consent@example.com")

    await page.click(`label:has-text("Password")`)
    await page.fill(`label:has-text("Password")`, "student-without-research-consent")
    await page.locator("id=login-button").click()

    await selectCourseInstanceIfPrompted(page)

    const topbar3 = new Topbar(page)
    await topbar3.userMenu.clickItem("User settings")
    const userSettings = new UserSettingsPage(page)
    await userSettings.waitForPage()
    await userSettings.navigateToPermissionsTab()

    const consentValue = await userSettings.permissionsTab.getGeneralResearchConsentValue()
    expect(consentValue?.trim()).toBe("Yes")

    await userSettings.permissionsTab.updateGeneralResearchConsent(false)

    const updatedConsentValue = await userSettings.permissionsTab.getGeneralResearchConsentValue()
    expect(updatedConsentValue?.trim()).toBe("No")
  })
})
