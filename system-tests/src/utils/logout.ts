import { Page } from "playwright"

import { logoutViaTopbar } from "./flows/topbar.flow"

export async function logout(page: Page): Promise<void> {
  await logoutViaTopbar(page)
}
