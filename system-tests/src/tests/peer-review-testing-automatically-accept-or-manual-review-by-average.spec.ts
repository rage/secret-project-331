import { test } from "@playwright/test"

test.describe("test AutomaticallyAcceptOrManualReviewByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("AutomaticallyAcceptOrManualReviewByAverage > Accepts", async ({ page, headless }) => {
    console.log("hello")
  })
  test("AutomaticallyAcceptOrManualReviewByAverage > Sends to manual review", async ({
    page,
    headless,
  }) => {
    console.log("hello")
  })
})
