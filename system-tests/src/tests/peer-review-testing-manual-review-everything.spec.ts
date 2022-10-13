import { test } from "@playwright/test"

test.describe("test ManualReviewEverything behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("ManualReviewEverything > That gets a perfect score gets sent to manual review", async ({
    page,
    headless,
  }) => {
    console.log("hello")
  })
  test("ManualReviewEverything > That gets the worst score gets sent to manual review", async ({
    page,
    headless,
  }) => {
    console.log("hello")
  })
  test("ManualReviewEverything > When an answer goes to manual review, the student won't get the points straight away", async ({
    page,
    headless,
  }) => {
    console.log("hello")
  })
  test("ManualReviewEverything > When the teacher manually reviews an answer, the user gets the points after it", async ({
    page,
    headless,
  }) => {
    console.log("hello")
  })
  test("ManualReviewEverything > If user submits multiple submissions to an exercise, and the answer goes to manual review after that, the manual review ui shows those submissions as grouped instead of two separate entries", async ({
    page,
    headless,
  }) => {
    console.log("hello")
  })
})
