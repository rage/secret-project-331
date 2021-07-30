import { chromium } from "@playwright/test"

import { login } from "../utils/login"

// Create session states for each user, state will be named as username, e.g. admin.json
async function globalSetup(): Promise<void> {
  console.log("Creating login states for supported test users.")
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await login("admin@example.com", "admin", page)
  await login("teacher@example.com", "teacher", page)
  await login("user@example.com", "user", page)
  await login("assistant@example.com", "assistant", page)
}

export default globalSetup
