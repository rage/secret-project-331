import { expect, Page } from "@playwright/test"

export class ConsentPage {
  constructor(
    private page: Page,
    private scopes: string[],
  ) {}
  private esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  private get scopesRegex() {
    return new RegExp(`\\b(${this.scopes.map(this.esc).join("|")})\\b`, "i")
  }
  private get ul() {
    return this.page
      .locator("ul")
      .filter({ has: this.page.locator("li", { hasText: this.scopesRegex }) })
      .first()
  }
  private get container() {
    return this.page.getByTestId("oauth-consent-form")
  }
  private get title() {
    return this.container.locator("h2").first()
  }

  async expectVisible(name: string | RegExp) {
    await expect(this.ul).toBeVisible()
    await expect(this.title).toBeVisible()
    await expect(this.title).toContainText(name)
    for (const s of this.scopes) {
      await expect(
        this.ul.locator("li", { hasText: new RegExp(`\\b${this.esc(s)}\\b`, "i") }).first(),
      ).toBeVisible()
    }
  }

  async approve() {
    const approveButton = this.page.getByTestId("oauth-consent-approve-button")
    await approveButton.click()
    // Wait for redirect to callback or success indicator
    // The callback page has "Callback OK" text
    try {
      await this.page.waitForURL(/callback/, { timeout: 10000 })
    } catch {
      // If URL doesn't change, wait for the callback page element
      await this.page.getByText("Callback OK").waitFor({ timeout: 10000 })
    }
  }

  async expectNotPresent() {
    await expect(this.title).toHaveCount(0)
  }
}
