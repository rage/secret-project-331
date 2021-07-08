import { test } from "@playwright/test"
import { login } from "./utils/login"

test("test", async ({ page }) => {
  await login("admin", "admin")

  // You are logged in!
})
