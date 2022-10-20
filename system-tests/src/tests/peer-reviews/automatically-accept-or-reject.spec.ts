import { test } from "@playwright/test"

test.describe("test AutomaticallyAcceptOrRejectByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("AutomaticallyAcceptOrRejectByAverage > Accepts", async ({ page, headless }) => {
    console.log("hello")
  })
  test("AutomaticallyAcceptOrRejectByAverage > Rejects", async ({ page, headless }) => {
    console.log("hello")
  })
})
