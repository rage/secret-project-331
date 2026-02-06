import { expect, Page } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"

export class AccountTab {
  constructor(private readonly page: Page) {}

  async waitForTab(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Personal Information" })).toBeVisible()
  }

  async updatePersonalInformation(
    options: {
      firstName?: string
      lastName?: string
      email?: string
      country?: string
      emailConsent?: boolean
    },
    verifyUpdate?: {
      field: "country" | "email" | "firstName" | "lastName" | "emailConsent"
      expectedValue: string
    },
  ): Promise<void> {
    await this.page.getByTestId("edit-profile-button").click()

    if (options.firstName !== undefined) {
      await this.page.getByLabel("First name").fill(options.firstName)
    }
    if (options.lastName !== undefined) {
      await this.page.getByLabel("Last name").fill(options.lastName)
    }
    if (options.email !== undefined) {
      await this.page.getByLabel("Email").fill(options.email)
    }
    if (options.country !== undefined) {
      await this.page.getByLabel("Where do you live?").click()
      await this.page.getByRole("option", { name: options.country }).click()
    }
    if (options.emailConsent !== undefined) {
      const checkbox = this.page.getByLabel(/I consent to receiving email communication/)
      const isChecked = await checkbox.isChecked()
      if (isChecked !== options.emailConsent) {
        await checkbox.click()
      }
    }

    await waitForSuccessNotification(
      this.page,
      async () => {
        await this.page.getByRole("button", { name: "Save" }).click()
      },
      "Success",
    )

    if (verifyUpdate) {
      const personalInfo = await this.getPersonalInformation()
      let actualValue: string | null = null

      switch (verifyUpdate.field) {
        case "country":
          actualValue = personalInfo.country
          break
        case "email":
          actualValue = personalInfo.email
          break
        case "firstName":
          actualValue = personalInfo.firstName
          break
        case "lastName":
          actualValue = personalInfo.lastName
          break
        case "emailConsent":
          actualValue = personalInfo.emailConsent
          break
      }

      expect(actualValue?.trim()).toBe(verifyUpdate.expectedValue.trim())
    }
  }

  async cancelEditingPersonalInformation(): Promise<void> {
    await this.page.getByRole("button", { name: "Cancel" }).click()
  }

  async getPersonalInformation(): Promise<{
    email: string | null
    firstName: string | null
    lastName: string | null
    country: string | null
    emailConsent: string | null
  }> {
    return {
      email: await this.page.getByTestId("personal-info-email-value").textContent(),
      firstName: await this.page.getByTestId("personal-info-first-name-value").textContent(),
      lastName: await this.page.getByTestId("personal-info-last-name-value").textContent(),
      country: await this.page.getByTestId("personal-info-country-value").textContent(),
      emailConsent: await this.page.getByTestId("personal-info-email-consent-value").textContent(),
    }
  }

  async openPasswordChangeForm(): Promise<void> {
    await this.page.getByTestId("change-password-button").click()
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.openPasswordChangeForm()
    await this.page.getByLabel("Old password").fill(currentPassword)
    await this.page.getByLabel("New password").fill(newPassword)
    await this.page.getByLabel("Confirm new password").fill(newPassword)
    await waitForSuccessNotification(
      this.page,
      async () => {
        await this.page.getByRole("button", { name: "Save" }).click()
      },
      "Success",
    )
  }
}
