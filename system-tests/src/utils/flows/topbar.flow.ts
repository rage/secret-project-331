import { expect, Page } from "@playwright/test"

import { Topbar } from "../components/Topbar"

export async function logoutViaTopbar(page: Page) {
  const topbar = new Topbar(page)
  await topbar.expectDesktopVisible()
  await topbar.userMenu.clickItem("Log out")
  await expect(topbar.loginLink).toBeVisible()
}

export async function switchLanguageViaTopbar(page: Page, nativeLabel: string) {
  const topbar = new Topbar(page)
  await topbar.expectDesktopVisible()
  await topbar.languageMenu.clickItem(nativeLabel)
  await expect(page.locator("html")).toHaveAttribute("lang", /fi|en/)
}

export async function openCourseSettingsFromQuickActions(page: Page, label: string = "Settings") {
  const topbar = new Topbar(page)
  await topbar.expectDesktopVisible()
  await expect(topbar.quickActionsTrigger).toBeVisible()
  await topbar.quickActions.clickItem(label)
  await expect(page.getByRole("dialog")).toBeVisible()
}
