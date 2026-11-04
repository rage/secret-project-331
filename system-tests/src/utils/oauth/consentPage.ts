import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"

import { ensureRedirectServer } from "@/fixtures/oauth"

export class ConsentPage {
  private page: Page
  private scopes: string[]

  public constructor(page: Page, scopes: string[]) {
    this.page = page
    this.scopes = scopes
  }
  private esc = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
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

  public get clientId() {
    return this.container.getByTestId("oauth-consent-client-id")
  }

  public get redirectUri() {
    return this.container.getByTestId("oauth-consent-redirect-uri")
  }

  public get agentNote() {
    return this.container.getByTestId("oauth-consent-agent-note")
  }

  public scopeCheckbox(scope: string) {
    return this.container.getByTestId(`oauth-consent-scope-${scope}`).getByRole("checkbox")
  }

  public async expectVisible(name: string | RegExp) {
    await expect(this.ul).toBeVisible()
    await expect(this.title).toBeVisible()
    await expect(this.title).toContainText(name)
    for (const s of this.scopes) {
      await expect(
        this.ul.locator("li", { hasText: new RegExp(`\\b${this.esc(s)}\\b`, "i") }).first(),
      ).toBeVisible()
    }
  }

  /** Submits the consent without following the redirect, for tests that intercept it. */
  public async approveWithoutRedirect() {
    await this.page.getByTestId("oauth-consent-approve-button").click()
  }

  public async approve() {
    await ensureRedirectServer()
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

  public async expectNotPresent() {
    await expect(this.title).toHaveCount(0)
  }
}
