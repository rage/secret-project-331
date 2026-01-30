import { expect, Locator, Page } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"

export class PermissionsTab {
  constructor(private readonly page: Page) {}

  async waitForTab(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Research consents", exact: true }),
    ).toBeVisible()
  }

  async updateGeneralResearchConsent(
    consent: boolean,
    verifyUpdate: boolean = true,
  ): Promise<void> {
    await this.page.getByTestId("edit-research-consent-button").click()

    const targetLabel = consent
      ? /I want to participate in the educational research/
      : /I do not want to participate in the educational research/

    await this.page.getByLabel(targetLabel).click()

    await this.page.getByRole("button", { name: "Save" }).click()
    await waitForSuccessNotification(this.page, "Operation successful")

    if (verifyUpdate) {
      const actualValue = await this.getGeneralResearchConsentValue()
      const expectedValue = consent ? "Yes" : "No"
      expect(actualValue?.trim()).toBe(expectedValue)
    }
  }

  async getGeneralResearchConsentValue(): Promise<string | null> {
    return await this.page.getByTestId("general-research-consent-value").textContent()
  }

  async getCourseSpecificConsents(): Promise<
    Array<{ courseName: string; courseId: string; editLink: Locator | null }>
  > {
    const listContainer = this.page.getByTestId("course-specific-consents-list")
    if (!(await listContainer.isVisible())) {
      return []
    }

    await expect(
      listContainer
        .locator('[data-testid^="course-consent-item-"]:not([data-testid$="-name"])')
        .first(),
    ).toBeVisible({ timeout: 10000 })

    const courseItems = listContainer.locator(
      '[data-testid^="course-consent-item-"]:not([data-testid$="-name"])',
    )
    const count = await courseItems.count()
    const consents: Array<{ courseName: string; courseId: string; editLink: Locator | null }> = []

    for (let i = 0; i < count; i++) {
      const item = courseItems.nth(i)
      const testId = await item.getAttribute("data-testid")
      if (!testId || !testId.startsWith("course-consent-item-") || testId.endsWith("-name")) {
        continue
      }

      const courseId = testId.replace(/^course-consent-item-/, "")
      if (!courseId) {
        continue
      }

      const courseNameElement = item.getByTestId(`course-consent-item-${courseId}-name`)
      await expect(courseNameElement).toBeVisible()
      const courseName = await courseNameElement.textContent()
      const editLink = item.getByRole("link", { name: "Edit" })

      if (courseName) {
        consents.push({
          courseName: courseName.trim(),
          courseId,
          editLink: (await editLink.isVisible()) ? editLink : null,
        })
      }
    }

    return consents
  }

  async editCourseSpecificConsent(courseName: string): Promise<void> {
    const consents = await this.getCourseSpecificConsents()
    const consent = consents.find((c) => c.courseName === courseName)
    if (consent?.editLink) {
      await consent.editLink.click()
    } else {
      throw new Error(`Course consent for "${courseName}" not found or not editable`)
    }
  }

  async scrollToAuthorizedApplications(): Promise<void> {
    const appsSection = this.page.getByTestId("authorized-applications-section")
    await appsSection.scrollIntoViewIfNeeded()
    await expect(this.page.getByRole("heading", { name: "Authorized Applications" })).toBeVisible()
  }

  async getAuthorizedApplications(): Promise<
    Array<{ name: string; scopes: string; clientId: string; revokeButton: Locator }>
  > {
    const listContainer = this.page.getByTestId("authorized-applications-list")
    if (!(await listContainer.isVisible())) {
      return []
    }

    const appItems = listContainer.locator('[data-testid^="authorized-app-"]')
    const count = await appItems.count()

    const apps = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const item = appItems.nth(i)
        const testId = await item.getAttribute("data-testid")
        if (!testId) {
          return null
        }

        const clientId = testId.replace("authorized-app-", "")
        const name = await item.getByTestId(`app-name-${clientId}`).textContent()
        if (!name) {
          return null
        }

        const scopes = await item.getByTestId(`app-scopes-${clientId}`).textContent()
        const revokeButton = item.getByTestId(`revoke-app-${clientId}`)

        return {
          name: name.trim(),
          scopes: scopes?.trim() ?? "",
          clientId,
          revokeButton,
        }
      }),
    )

    return apps.filter((app): app is NonNullable<typeof app> => app !== null)
  }

  async revokeAuthorizedApplication(appName: string): Promise<void> {
    const apps = await this.getAuthorizedApplications()
    const app = apps.find((a) => a.name === appName)
    if (app) {
      await app.revokeButton.click()
      try {
        await waitForSuccessNotification(this.page, "Operation successful")
      } catch {
        const appsAfterClick = await this.getAuthorizedApplications()
        const stillExists = appsAfterClick.some((a) => a.name === appName)
        if (stillExists) {
          throw new Error(
            `Failed to revoke "${appName}": notification timeout and application still exists`,
          )
        }
      }
    } else {
      throw new Error(`Authorized application "${appName}" not found`)
    }
  }

  async initiateAccountDeletion(): Promise<void> {
    await this.page.getByTestId("delete-account-button").click()
  }

  async confirmAccountDeletionWithPassword(password: string): Promise<void> {
    await this.page.getByLabel("Password").fill(password)
    await this.page.getByRole("button", { name: "Confirm" }).click()
    await this.page.waitForURL(/\/account-deleted/, { timeout: 10000 })
  }
}
