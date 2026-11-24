import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { Select } from "@/utils/components/Select"
import { fillSignupForm, submitSignupForm } from "@/utils/flows/signup.flow"
import { waitForErrorNotification, waitForSuccessNotification } from "@/utils/notificationUtils"

const ACCOUNT_FORMS_URL = "http://project-331.local/manage/account-forms"
const DROPPED_DOMAIN = "account-forms-dropped.example.com"
const RULE_NAME = "System test domain rule"

function rulesTable(page: Page) {
  return page.getByRole("table", { name: "Rules" })
}

test.describe("Account form rules", () => {
  test.use({ storageState: "src/states/admin@example.com.json" })

  test("A drop rule creates nothing, answers with an error and is logged", async ({
    page,
    browser,
  }) => {
    await test.step("Add an enforced domain rule", async () => {
      await page.goto(ACCOUNT_FORMS_URL)
      await page.getByRole("button", { name: "Add a rule" }).click()
      const dialog = page.getByRole("dialog")
      await dialog.getByRole("textbox", { name: "Name" }).fill(RULE_NAME)
      await Select.labelled(page, "Matches by", dialog).chooseOption("Domain list")
      await dialog.getByRole("textbox", { name: "Entries, one per line" }).fill(DROPPED_DOMAIN)
      await Select.labelled(page, "Outcome", dialog).chooseOption("Drop silently")
      await dialog.getByRole("checkbox", { name: "Log only" }).uncheck()
      await waitForSuccessNotification(page, async () => {
        await dialog.getByRole("button", { name: "Save" }).click()
      })
      await expect(rulesTable(page).getByRole("cell", { name: RULE_NAME })).toBeVisible()
    })

    await test.step("A signup to the domain fails and creates no account", async () => {
      const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
      const visitorPage = await visitor.newPage()
      const signup = {
        firstName: "Dropped",
        lastName: "Signup",
        email: `${Date.now()}@${DROPPED_DOMAIN}`,
        password: "account-forms-password",
      }
      // An existing address would answer that the account exists, so the same error twice shows
      // that the first attempt created nothing.
      for (let attempt = 0; attempt < 2; attempt++) {
        await fillSignupForm(visitorPage, signup)
        await waitForErrorNotification(
          visitorPage,
          async () => {
            await visitorPage.getByRole("button", { name: "Create an account" }).click()
          },
          /Something went wrong/,
        )
        await expect(visitorPage.getByText("You already have an account")).toHaveCount(0)
      }
      const loggedIn = await visitorPage.request.get(
        "http://project-331.local/api/v0/auth/logged-in",
      )
      expect(await loggedIn.json()).toBe(false)
      await visitor.close()
    })

    await test.step("The log shows the dropped signup", async () => {
      await page.goto(ACCOUNT_FORMS_URL)
      const latest = page.getByRole("table", { name: "Latest entries" })
      const row = latest.getByRole("row").filter({ hasText: DROPPED_DOMAIN }).first()
      await expect(row).toContainText("Sign-up")
      await expect(row).toContainText("Drop silently")
      await expect(row).toContainText(RULE_NAME)
    })

    await test.step("A dry run of the rule finds the logged signup", async () => {
      const ruleRow = rulesTable(page).getByRole("row").filter({ hasText: RULE_NAME })
      await ruleRow.getByRole("button", { name: "Edit" }).click()
      const dialog = page.getByRole("dialog")
      await dialog.getByRole("button", { name: "Try on the log" }).click()
      await expect(dialog.getByRole("table", { name: "Latest matches" })).toContainText(
        DROPPED_DOMAIN,
      )
      await dialog.getByRole("button", { name: "Cancel" }).click()
    })

    await test.step("Delete the rule, and its history stays", async () => {
      const ruleRow = rulesTable(page).getByRole("row").filter({ hasText: RULE_NAME })
      await ruleRow.getByRole("button", { name: "Delete" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
      })
      await expect(rulesTable(page).getByRole("cell", { name: RULE_NAME })).toHaveCount(0)
    })
  })

  test("A log-only rule matches without affecting the signup", async ({ page, browser }) => {
    const ruleName = "System test log-only expression"
    await page.goto(ACCOUNT_FORMS_URL)
    await page.getByRole("button", { name: "Add a rule" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox", { name: "Name" }).fill(ruleName)
    await dialog
      .getByRole("textbox", { name: "Expression" })
      .fill('action == "signup" && profile.name_has_digit')
    await Select.labelled(page, "Outcome", dialog).chooseOption("Drop silently")
    await waitForSuccessNotification(page, async () => {
      await dialog.getByRole("button", { name: "Save" }).click()
    })

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const visitorPage = await visitor.newPage()
    await submitSignupForm(visitorPage, {
      firstName: "Logged1",
      lastName: "Signup",
      email: `account-forms-log-only-${Date.now()}@example.com`,
      password: "account-forms-password",
    })
    await expect(
      visitorPage.getByRole("heading", { name: "Regarding research done on" }),
    ).toBeVisible()
    await visitor.close()

    await page.reload()
    const row = page
      .getByRole("table", { name: "Latest entries" })
      .getByRole("row")
      .filter({ hasText: ruleName })
      .first()
    await expect(row).toContainText("Allow")

    const ruleRow = rulesTable(page).getByRole("row").filter({ hasText: ruleName })
    await ruleRow.getByRole("button", { name: "Delete" }).click()
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
    })
  })
})
